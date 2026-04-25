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
    """Poll for plans ready to render (approved + assets ready + no video run yet)."""
    logger.info("Render poll loop started")
    while True:
        try:
            # Find approved plans with ready assets that don't have a video run yet
            response = (
                supabase.table("studio_prompts")
                .select("id")
                .eq("status", "plan_approved")
                .eq("assets_status", "ready")
                .is_("render_status", "null")
                .order("created_at", desc=False)
                .limit(1)
                .execute()
            )

            # render_status column might not exist yet - fall through on error
            if response.data:
                prompt_id = response.data[0]["id"]
                # Only render if triggered via webhook (render_status = 'pending')
                pass

        except Exception:
            pass  # Column might not exist yet

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


@app.post("/jobs/render/start")
async def start_render(body: dict):
    """Triggered when user clicks Render. Generates VO + creates video run."""
    prompt_id = body.get("promptId")
    if not prompt_id:
        return JSONResponse({"error": "promptId required"}, status_code=400)

    logger.info(f"[render] Render requested for prompt {prompt_id}")

    asyncio.create_task(_run_render_pipeline(prompt_id))

    return JSONResponse({"message": "Render started", "promptId": prompt_id})


async def _run_render_pipeline(prompt_id: str):
    """Full pipeline: VO generation → video run record."""
    now = datetime.now(timezone.utc).isoformat()

    # Create video_run record
    run_row = (
        supabase.table("studio_video_runs")
        .insert(
            {
                "prompt_id": prompt_id,
                "status": "generating_vo",
                "vo_started_at": now,
                "scene_plan": {},  # Will be filled
            }
        )
        .execute()
    )
    run_id = run_row.data[0]["id"]
    logger.info(f"[render] Created video run {run_id}")

    try:
        # Fetch scene plan
        plan_resp = (
            supabase.table("studio_prompts")
            .select("scene_plan")
            .eq("id", prompt_id)
            .single()
            .execute()
        )
        scene_plan = plan_resp.data["scene_plan"]

        # Update run with scene plan
        supabase.table("studio_video_runs").update(
            {"scene_plan": scene_plan}
        ).eq("id", run_id).execute()

        # Step 1: Generate VO
        vo_asset_id = await generate_plan_vo(supabase, prompt_id)
        logger.info(f"[render] VO generated: {vo_asset_id}")

        supabase.table("studio_video_runs").update(
            {
                "status": "rendering",
                "vo_completed_at": datetime.now(timezone.utc).isoformat(),
                "render_started_at": datetime.now(timezone.utc).isoformat(),
                "vo_url": vo_asset_id,
            }
        ).eq("id", run_id).execute()

        # Step 2: Build asset URL map
        asset_links = (
            supabase.table("studio_prompt_assets")
            .select("usage_context, asset:studio_assets(supabase_storage_path, storage_bucket)")
            .eq("prompt_id", prompt_id)
            .execute()
        )

        asset_urls = {}
        for link in asset_links.data or []:
            asset = link.get("asset")
            if not asset or not asset.get("supabase_storage_path"):
                continue
            bucket = asset.get("storage_bucket", "studio-assets")
            path = asset["supabase_storage_path"]
            signed = supabase.storage.from_(bucket).create_signed_url(path, 7200)
            if signed and signed.get("signedURL"):
                asset_urls[link["usage_context"]] = signed["signedURL"]

        logger.info(f"[render] Asset URLs built: {list(asset_urls.keys())}")

        # Step 3: For now, mark as completed with asset URLs stored
        # Remotion rendering will be added in a follow-up brief
        supabase.table("studio_video_runs").update(
            {
                "status": "completed",
                "render_completed_at": datetime.now(timezone.utc).isoformat(),
                "notes": f"VO + assets ready. Asset keys: {', '.join(asset_urls.keys())}. Remotion render pending.",
            }
        ).eq("id", run_id).execute()

        logger.info(f"[render] Pipeline completed for run {run_id}")

    except Exception as e:
        logger.exception(f"[render] Failed for {prompt_id}")
        supabase.table("studio_video_runs").update(
            {
                "status": "failed",
                "error_message": str(e)[:1000],
            }
        ).eq("id", run_id).execute()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
