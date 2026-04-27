"""
Iteration pipeline: feedback → regenerate plan → re-render.
"""
import logging
import traceback
from datetime import datetime, timezone

from supabase import Client
from services.regeneration_logic import merge_regeneration_scope
from services.scene_plan_regenerator import regenerate_scene_plan
from services.vo_generator import generate_plan_vo
from services.asset_resolver import AssetResolver
from services.video_renderer import render_video

logger = logging.getLogger(__name__)


async def create_iteration(supabase: Client, parent_run_id: str):
    """Full iteration: regen plan → regen assets/VO → re-render."""
    run_id = None
    try:
        logger.info(f"[iteration] Starting from parent {parent_run_id}")

        parent = supabase.table("studio_video_runs").select("*").eq("id", parent_run_id).single().execute().data
        feedback = parent.get("review_feedback_structured")
        if not feedback or not feedback.get("categories"):
            logger.error(f"[iteration] No feedback/categories on {parent_run_id}")
            return

        prompt_id = parent["prompt_id"]
        categories = feedback["categories"]
        scope = merge_regeneration_scope(categories)
        logger.info(f"[iteration] Categories: {categories}")

        current_plan = supabase.table("studio_prompts").select("scene_plan").eq("id", prompt_id).single().execute().data["scene_plan"]

        # Create child run
        new_run = supabase.table("studio_video_runs").insert({
            "prompt_id": prompt_id,
            "parent_run_id": parent_run_id,
            "status": "generating_vo",
            "current_step": "Regenerating scene plan via Claude...",
            "regeneration_scope": categories,
            "scene_plan": current_plan,
            "started_at": datetime.now(timezone.utc).isoformat(),
            "progress_percent": 10,
        }).execute().data[0]
        run_id = new_run["id"]
        logger.info(f"[iteration] Created run {run_id}")

        # Mark parent as rejected (superseded by this iteration)
        supabase.table("studio_video_runs").update({"review_decision": "rejected"}).eq("id", parent_run_id).execute()

        def step(msg: str, pct: int, **extra):
            supabase.table("studio_video_runs").update({"current_step": msg, "progress_percent": pct, **extra}).eq("id", run_id).execute()
            logger.info(f"[iteration] {msg}")

        # Regen scene plan
        new_plan = await regenerate_scene_plan(current_plan, feedback)
        supabase.table("studio_prompts").update({"scene_plan": new_plan}).eq("id", prompt_id).execute()
        step("Plan regenerated. Processing...", 30, scene_plan=new_plan)

        # Selective asset regen
        if scope["regenerate_music"] or scope["regenerate_sfx"]:
            step("Re-resolving audio assets...", 35)
            supabase.table("studio_prompts").update({"assets_status": None}).eq("id", prompt_id).execute()
            await AssetResolver(supabase).resolve(prompt_id)

        if scope["regenerate_vo"]:
            step("Regenerating voice-over...", 45)
            supabase.table("studio_prompt_assets").delete().eq("prompt_id", prompt_id).eq("usage_context", "vo_main").execute()
            await generate_plan_vo(supabase, prompt_id)

        # Render
        step("Rendering video...", 60, status="rendering")
        storage_path = await render_video(supabase, prompt_id, run_id)

        supabase.table("studio_video_runs").update({
            "status": "completed",
            "current_step": "Iteration complete.",
            "progress_percent": 100,
            "output_url": storage_path,
            "completed_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", run_id).execute()
        logger.info(f"[iteration] DONE {run_id}")

    except Exception as e:
        tb = traceback.format_exc()
        logger.error(f"[iteration] FAILED: {tb}")
        if run_id:
            try:
                supabase.table("studio_video_runs").update({
                    "status": "failed",
                    "current_step": "Iteration failed",
                    "error_message": f"{type(e).__name__}: {str(e)}\n{tb[-500:]}"[:1000],
                }).eq("id", run_id).execute()
            except Exception:
                pass
