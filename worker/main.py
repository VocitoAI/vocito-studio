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
    """Poll for approved plans with ready assets that have no video run yet."""
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

            if response.data:
                for plan in response.data:
                    prompt_id = plan["id"]

                    # Check if a video run already exists for this plan
                    existing = (
                        supabase.table("studio_video_runs")
                        .select("id")
                        .eq("prompt_id", prompt_id)
                        .limit(1)
                        .execute()
                    )

                    if not existing.data:
                        logger.info(f"[render-poll] Plan {prompt_id} ready but no render triggered yet — waiting for manual trigger")

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
    """Full pipeline: VO generation → asset assembly."""
    now = datetime.now(timezone.utc).isoformat()
    pipeline_log: list[str] = []

    def log_step(run_id: str, status: str, message: str, **extra):
        pipeline_log.append(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] {message}")
        # Only use columns that exist in the A3 schema
        update: dict = {"status": status, "current_step": message}
        # Store full log in error_message field temporarily (notes doesn't exist)
        update["error_message"] = "\n".join(pipeline_log) if status == "failed" else None
        for k, v in extra.items():
            if k in ("started_at", "completed_at", "vo_url", "output_url", "progress_percent"):
                update[k] = v
        supabase.table("studio_video_runs").update(update).eq("id", run_id).execute()
        logger.info(f"[render] {message}")

    # Create video_run record (A3 schema: scene_plan is NOT NULL)
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
    run_id = run_row.data[0]["id"]
    logger.info(f"[render] Created video run {run_id}")

    try:
        # Fetch scene plan
        log_step(run_id, "generating_vo", "Fetching scene plan...")
        plan_resp = (
            supabase.table("studio_prompts")
            .select("scene_plan, language")
            .eq("id", prompt_id)
            .single()
            .execute()
        )
        scene_plan = plan_resp.data["scene_plan"]
        language = plan_resp.data.get("language", "en")

        supabase.table("studio_video_runs").update(
            {"scene_plan": scene_plan}
        ).eq("id", run_id).execute()

        log_step(run_id, "generating_vo", f"Scene plan loaded ({language.upper()}). Starting VO generation...")

        # Step 1: Generate VO
        vo_asset_id = await generate_plan_vo(supabase, prompt_id)
        log_step(
            run_id, "rendering",
            f"VO generated successfully (asset {vo_asset_id[:8]}...)",
            vo_url=vo_asset_id,
            progress_percent=50,
        )

        # Step 2: Build asset URL map
        log_step(run_id, "rendering", "Building asset URL map...")

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
                log_step(run_id, "rendering", f"  ✓ {link['usage_context']}")

        log_step(run_id, "rendering", f"All {len(asset_urls)} asset URLs ready")

        # Step 3: Mark as completed
        log_step(
            run_id, "completed",
            f"Pipeline complete. VO + {len(asset_urls)} assets assembled. Remotion render pending.",
            completed_at=datetime.now(timezone.utc).isoformat(),
            progress_percent=100,
        )

    except Exception as e:
        logger.exception(f"[render] Failed for {prompt_id}")
        pipeline_log.append(f"[{datetime.now(timezone.utc).strftime('%H:%M:%S')}] ERROR: {str(e)[:500]}")
        supabase.table("studio_video_runs").update(
            {
                "status": "failed",
                "error_message": str(e)[:1000],
                "notes": "\n".join(pipeline_log),
            }
        ).eq("id", run_id).execute()


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
