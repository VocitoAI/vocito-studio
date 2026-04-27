"""
Vocito Studio Worker — FastAPI + background polling.
Handles: asset resolution, VO generation, render pipeline.
"""
import os
import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.responses import JSONResponse
import uvicorn
from supabase import create_client, Client

from services.asset_resolver import AssetResolver
from services.vo_generator import generate_plan_vo
from services.video_renderer import render_video
from services.iteration_pipeline import create_iteration

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL_SECONDS", "5"))

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
asset_resolver = AssetResolver(supabase)


async def asset_poll_loop():
    """Poll for approved plans needing asset resolution."""
    logger.info("Asset poll loop started")
    while True:
        try:
            response = (
                supabase.table("studio_prompts")
                .select("id, scene_plan")
                .eq("status", "plan_approved")
                .is_("assets_status", "null")
                .order("created_at", desc=False)
                .limit(1)
                .execute()
            )

            if response.data:
                prompt = response.data[0]
                prompt_id = prompt["id"]
                logger.info(f"[poll] Found approved plan needing assets: {prompt_id}")

                supabase.table("studio_prompts").update(
                    {"assets_status": "downloading"}
                ).eq("id", prompt_id).is_("assets_status", "null").execute()

                await asset_resolver.resolve(prompt_id)

        except Exception as e:
            logger.error(f"[poll] Asset error: {e}", exc_info=True)

        await asyncio.sleep(POLL_INTERVAL)


async def render_poll_loop():
    """Poll for approved plans with ready assets → auto-render."""
    logger.info("Render poll loop started")
    while True:
        try:
            # Find approved plans with ready assets
            response = (
                supabase.table("studio_prompts")
                .select("id")
                .eq("status", "plan_approved")
                .eq("assets_status", "ready")
                .order("created_at", desc=False)
                .limit(5)
                .execute()
            )

            for plan in response.data or []:
                prompt_id = plan["id"]

                # Idempotency: skip if any video run exists (any status)
                existing = (
                    supabase.table("studio_video_runs")
                    .select("id, status")
                    .eq("prompt_id", prompt_id)
                    .limit(1)
                    .execute()
                )

                if existing.data:
                    run = existing.data[0]
                    # Skip completed/failed runs
                    if run["status"] in ("completed", "failed"):
                        continue
                    # Skip actively rendering runs (less than 10 min old)
                    continue

                # Claim: create the run immediately to prevent duplicates
                logger.info(f"[render-poll] Found plan {prompt_id}, starting render")
                await _run_render_pipeline(prompt_id)

        except Exception as e:
            logger.error(f"[render-poll] Error: {e}", exc_info=True)

        await asyncio.sleep(10)


@asynccontextmanager
async def lifespan(app: FastAPI):
    asset_task = asyncio.create_task(asset_poll_loop())
    render_task = asyncio.create_task(render_poll_loop())
    logger.info("Vocito Studio Worker started")
    yield
    asset_task.cancel()
    render_task.cancel()


app = FastAPI(title="Vocito Studio Worker", lifespan=lifespan)


@app.get("/health")
async def health():
    return JSONResponse({"status": "ok", "service": "vocito-studio-worker"})


@app.post("/webhooks/plan-approved")
async def webhook_plan_approved(body: dict):
    """Triggered when a plan is approved. Starts asset resolution."""
    prompt_id = body.get("prompt_id")
    if not prompt_id:
        return JSONResponse({"error": "prompt_id required"}, status_code=400)

    logger.info(f"[webhook] Plan approved: {prompt_id}")

    supabase.table("studio_prompts").update(
        {"assets_status": "downloading"}
    ).eq("id", prompt_id).is_("assets_status", "null").execute()

    asyncio.create_task(asset_resolver.resolve(prompt_id))

    return JSONResponse({"message": "Asset resolution triggered"})


@app.post("/jobs/iterate/start")
async def start_iteration(body: dict):
    """Triggered when user rejects a render with feedback."""
    parent_run_id = body.get("parentRunId")
    if not parent_run_id:
        return JSONResponse({"error": "parentRunId required"}, status_code=400)

    logger.info(f"[iteration] Iteration requested for parent {parent_run_id}")

    async def _safe_iterate():
        try:
            await create_iteration(supabase, parent_run_id)
        except Exception as e:
            import traceback
            logger.error(f"[iteration] CRASHED: {traceback.format_exc()}")

    asyncio.create_task(_safe_iterate())

    return JSONResponse({"message": "Iteration started", "parentRunId": parent_run_id})


@app.post("/jobs/render/start")
async def start_render(body: dict):
    """Manual render trigger (kept for compatibility, poll loop handles auto)."""
    prompt_id = body.get("promptId")
    if not prompt_id:
        return JSONResponse({"error": "promptId required"}, status_code=400)

    logger.info(f"[render] Manual render requested for {prompt_id}")

    # Check if run already exists
    existing = (
        supabase.table("studio_video_runs")
        .select("id")
        .eq("prompt_id", prompt_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        return JSONResponse({"message": "Run already exists", "runId": existing.data[0]["id"]})

    asyncio.create_task(_run_render_pipeline(prompt_id))
    return JSONResponse({"message": "Render started", "promptId": prompt_id})


async def _run_render_pipeline(prompt_id: str):
    """Full pipeline: VO generation → asset assembly."""
    now = datetime.now(timezone.utc).isoformat()

    def update_run(run_id: str, **fields):
        supabase.table("studio_video_runs").update(fields).eq("id", run_id).execute()

    # Create video_run record (claims this plan)
    try:
        run_row = (
            supabase.table("studio_video_runs")
            .insert(
                {
                    "prompt_id": prompt_id,
                    "status": "generating_vo",
                    "started_at": now,
                    "scene_plan": {"pending": True},
                    "current_step": "Pipeline starting...",
                    "progress_percent": 5,
                }
            )
            .execute()
        )
    except Exception as e:
        logger.error(f"[render] Failed to create video_run for {prompt_id}: {e}")
        return

    run_id = run_row.data[0]["id"]
    logger.info(f"[render-poll] Created video_run {run_id} for plan {prompt_id}")

    try:
        # Fetch scene plan
        update_run(run_id, current_step="Fetching scene plan...", progress_percent=10)
        plan_resp = (
            supabase.table("studio_prompts")
            .select("scene_plan, language")
            .eq("id", prompt_id)
            .single()
            .execute()
        )
        scene_plan = plan_resp.data["scene_plan"]
        language = plan_resp.data.get("language", "en")

        update_run(run_id, scene_plan=scene_plan)
        logger.info(f"[render-poll] Scene plan loaded ({language.upper()})")

        # Step 1: Generate VO
        update_run(
            run_id,
            current_step=f"Generating voice-over ({language.upper()})...",
            progress_percent=20,
        )
        logger.info(f"[render-poll] VO generation start for {prompt_id}")

        vo_asset_id = await generate_plan_vo(supabase, prompt_id)

        logger.info(f"[render-poll] VO generation complete: {vo_asset_id}")
        update_run(
            run_id,
            status="rendering",
            current_step="VO generated. Building asset URLs...",
            vo_url=vo_asset_id,
            progress_percent=60,
        )

        # Step 2: Build asset URL map
        asset_links = (
            supabase.table("studio_prompt_assets")
            .select("usage_context, asset:studio_assets(supabase_storage_path, storage_bucket)")
            .eq("prompt_id", prompt_id)
            .execute()
        )

        asset_count = 0
        for link in asset_links.data or []:
            asset = link.get("asset")
            if asset and asset.get("supabase_storage_path"):
                asset_count += 1

        update_run(
            run_id,
            current_step=f"All {asset_count} assets ready. Rendering video...",
            progress_percent=70,
        )
        logger.info(f"[render-poll] {asset_count} assets ready, starting ffmpeg render")

        # Step 3: Render MP4 with ffmpeg
        storage_path = await render_video(supabase, prompt_id, run_id)

        # Step 4: Mark as completed with video URL
        update_run(
            run_id,
            status="completed",
            current_step="Video rendered. Ready to download.",
            completed_at=datetime.now(timezone.utc).isoformat(),
            progress_percent=100,
            output_url=storage_path,
        )
        logger.info(f"[render-poll] Render complete: {storage_path}")

    except Exception as e:
        import traceback
        tb = traceback.format_exc()
        error_msg = f"{type(e).__name__}: {str(e)}\n{tb[-1500:]}"
        logger.error(f"[render] Failed for {prompt_id}: {error_msg}")
        try:
            update_run(
                run_id,
                status="failed",
                error_message=error_msg[:1000],
                current_step="Pipeline failed",
            )
        except Exception as inner:
            logger.error(f"[render] Failed to save error: {inner}")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
