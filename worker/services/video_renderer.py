"""
Remotion video renderer. Replaces the old ffmpeg stub.
Renders 1920x1080 MP4 via npx remotion render CLI.
"""
import os
import asyncio
import json
import logging
from pathlib import Path

from supabase import Client

logger = logging.getLogger(__name__)

REMOTION_PROJECT_PATH = os.environ.get("REMOTION_PROJECT_PATH", "/app/remotion")
STORAGE_BUCKET = "studio-videos"


async def render_video(supabase: Client, prompt_id: str, run_id: str) -> str:
    """Render MP4 via Remotion CLI. Returns storage path after upload."""
    logger.info(f"[remotion] Starting render for {run_id}")

    # Fetch scene plan
    plan_resp = (
        supabase.table("studio_prompts")
        .select("scene_plan")
        .eq("id", prompt_id)
        .single()
        .execute()
    )
    scene_plan = plan_resp.data["scene_plan"]

    # Build asset URL map
    links_resp = (
        supabase.table("studio_prompt_assets")
        .select("usage_context, asset:studio_assets(supabase_storage_path)")
        .eq("prompt_id", prompt_id)
        .execute()
    )

    asset_urls = {}
    for link in links_resp.data or []:
        asset = link.get("asset")
        if not asset or not asset.get("supabase_storage_path"):
            continue
        signed = supabase.storage.from_("studio-assets").create_signed_url(
            asset["supabase_storage_path"], 7200
        )
        url = signed.get("signedURL") or (signed.get("data", {}) or {}).get("signedUrl")
        if url:
            asset_urls[link["usage_context"]] = url

    logger.info(f"[remotion] Asset URLs: {list(asset_urls.keys())}")

    # Write props to temp JSON file
    props_path = f"/tmp/props_{run_id}.json"
    with open(props_path, "w") as f:
        json.dump({"scenePlan": scene_plan, "assetUrls": asset_urls}, f)

    output_path = f"/tmp/render_{run_id}.mp4"

    # Run Remotion CLI
    cmd = [
        "npx", "remotion", "render",
        "VocitoLaunchVideo", output_path,
        f"--props={props_path}",
        "--codec=h264", "--crf=18",
        "--concurrency=1", "--log=info",
    ]

    logger.info(f"[remotion] Running: {' '.join(cmd[:6])}...")

    process = await asyncio.create_subprocess_exec(
        *cmd,
        cwd=REMOTION_PROJECT_PATH,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )

    stdout, stderr = await process.communicate()

    if process.returncode != 0:
        error = stderr.decode()[-1000:]
        logger.error(f"[remotion] Failed: {error}")
        raise RuntimeError(f"Remotion render failed: {error[-300:]}")

    if not Path(output_path).exists():
        raise RuntimeError("Remotion completed but output file missing")

    file_size = Path(output_path).stat().st_size
    logger.info(f"[remotion] Render done: {file_size} bytes ({file_size // 1024 // 1024}MB)")

    # Upload to Supabase Storage
    storage_path = f"renders/{run_id}.mp4"
    with open(output_path, "rb") as f:
        supabase.storage.from_(STORAGE_BUCKET).upload(
            storage_path, f.read(),
            file_options={"content-type": "video/mp4", "upsert": "true"},
        )

    # Cleanup temp files
    Path(output_path).unlink(missing_ok=True)
    Path(props_path).unlink(missing_ok=True)

    logger.info(f"[remotion] Uploaded to {storage_path}")
    return storage_path
