"""
Iteration pipeline: takes parent run + feedback, creates new iteration
with selective regeneration of assets/VO/scene plan.
"""
import logging
from datetime import datetime, timezone

from supabase import Client
from services.regeneration_logic import merge_regeneration_scope
from services.scene_plan_regenerator import regenerate_scene_plan
from services.vo_generator import generate_plan_vo
from services.asset_resolver import AssetResolver
from services.video_renderer import render_video

logger = logging.getLogger(__name__)


async def create_iteration(supabase: Client, parent_run_id: str):
    """Create new iteration from parent run's feedback."""
    logger.info(f"[iteration] Starting from parent {parent_run_id}")

    # Fetch parent run
    parent = (
        supabase.table("studio_video_runs")
        .select("*")
        .eq("id", parent_run_id)
        .single()
        .execute()
        .data
    )

    feedback = parent.get("review_feedback_structured")
    if not feedback:
        raise RuntimeError(f"No feedback on parent {parent_run_id}")

    categories = feedback.get("categories", [])
    if not categories:
        raise RuntimeError("No categories in feedback")

    prompt_id = parent["prompt_id"]
    scope = merge_regeneration_scope(categories)
    logger.info(f"[iteration] Categories: {categories}, scope: {scope}")

    # Get current scene plan
    prompt = (
        supabase.table("studio_prompts")
        .select("scene_plan")
        .eq("id", prompt_id)
        .single()
        .execute()
        .data
    )
    current_plan = prompt["scene_plan"]

    # Create child run FIRST (so UI sees something)
    new_run = (
        supabase.table("studio_video_runs")
        .insert(
            {
                "prompt_id": prompt_id,
                "parent_run_id": parent_run_id,
                "status": "generating_vo",
                "current_step": "Regenerating scene plan...",
                "regeneration_scope": categories,
                "scene_plan": current_plan,  # snapshot current, will update after regen
                "started_at": datetime.now(timezone.utc).isoformat(),
                "progress_percent": 10,
            }
        )
        .execute()
        .data[0]
    )
    run_id = new_run["id"]
    logger.info(f"[iteration] Created run {run_id}")

    # Mark parent as superseded
    supabase.table("studio_video_runs").update(
        {"review_decision": "superseded"}
    ).eq("id", parent_run_id).execute()

    def update(run_id: str, **fields):
        supabase.table("studio_video_runs").update(fields).eq("id", run_id).execute()

    try:
        # Regenerate scene plan via Claude
        update(run_id, current_step="Calling Claude to modify plan...", progress_percent=15)
        new_plan = await regenerate_scene_plan(current_plan, feedback)
        logger.info(f"[iteration] Scene plan regenerated, updating prompt...")

        # Update prompt + run with new plan
        supabase.table("studio_prompts").update({"scene_plan": new_plan}).eq("id", prompt_id).execute()
        update(run_id, scene_plan=new_plan, current_step="Plan updated. Processing assets...", progress_percent=25)
        # Selective asset regeneration
        if scope["regenerate_music"] or scope["regenerate_sfx"]:
            update(run_id, current_step="Re-resolving audio assets...", progress_percent=20)
            supabase.table("studio_prompts").update({"assets_status": None}).eq(
                "id", prompt_id
            ).execute()
            resolver = AssetResolver(supabase)
            await resolver.resolve(prompt_id)

        if scope["regenerate_vo"]:
            update(run_id, current_step="Regenerating voice-over...", progress_percent=40)
            # Delete old VO link so a new one is generated
            supabase.table("studio_prompt_assets").delete().eq(
                "prompt_id", prompt_id
            ).eq("usage_context", "vo_main").execute()
            await generate_plan_vo(supabase, prompt_id)

        # Render
        update(run_id, status="rendering", current_step="Rendering video...", progress_percent=60)
        storage_path = await render_video(supabase, prompt_id, run_id)

        update(
            run_id,
            status="completed",
            current_step="Iteration complete.",
            progress_percent=100,
            output_url=storage_path,
            completed_at=datetime.now(timezone.utc).isoformat(),
        )
        logger.info(f"[iteration] Completed {run_id}")

    except Exception as e:
        import traceback
        logger.error(f"[iteration] Failed: {traceback.format_exc()}")
        update(
            run_id,
            status="failed",
            current_step="Iteration failed",
            error_message=f"{type(e).__name__}: {str(e)}"[:1000],
        )
