"""
Vocito Studio Worker — FastAPI + background polling.
"""
import os
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import JSONResponse
import uvicorn
from supabase import create_client, Client

from services.supabase_queue import SupabaseQueue
from services.asset_resolver import AssetResolver

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
POLL_INTERVAL = int(os.environ.get("POLL_INTERVAL_SECONDS", "5"))

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
queue = SupabaseQueue(supabase)
asset_resolver = AssetResolver(supabase)


async def poll_loop():
    """Background loop: poll for approved plans needing asset resolution."""
    logger.info("Asset poll loop started")
    while True:
        try:
            # Check for approved plans needing assets
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

                # Claim it
                supabase.table("studio_prompts").update(
                    {"assets_status": "downloading", "assets_started_at": "now()"}
                ).eq("id", prompt_id).is_("assets_status", "null").execute()

                await asset_resolver.resolve(prompt_id)

        except Exception as e:
            logger.error(f"[poll] Error: {e}", exc_info=True)

        await asyncio.sleep(POLL_INTERVAL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(poll_loop())
    logger.info("Vocito Studio Worker started")
    yield
    task.cancel()


app = FastAPI(title="Vocito Studio Worker", lifespan=lifespan)


@app.get("/health")
async def health():
    return JSONResponse({"status": "ok", "service": "vocito-studio-worker"})


@app.post("/webhooks/plan-approved")
async def webhook_plan_approved(body: dict):
    """Webhook from Next.js when a plan is approved. Triggers asset resolution."""
    prompt_id = body.get("prompt_id")
    if not prompt_id:
        return JSONResponse({"error": "prompt_id required"}, status_code=400)

    logger.info(f"[webhook] Plan approved: {prompt_id}")

    # Claim and resolve in background
    supabase.table("studio_prompts").update(
        {"assets_status": "downloading"}
    ).eq("id", prompt_id).is_("assets_status", "null").execute()

    asyncio.create_task(asset_resolver.resolve(prompt_id))

    return JSONResponse({"message": "Asset resolution triggered", "prompt_id": prompt_id})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8080"))
    uvicorn.run(app, host="0.0.0.0", port=port)
