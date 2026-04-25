"""
VO Generator: generates full VO for a plan, caches as studio_asset.
"""
import logging
from datetime import datetime, timezone

from supabase import Client
from services.voice_router import generate_vo, select_provider, hash_vo_request

logger = logging.getLogger(__name__)

STORAGE_BUCKET = "studio-assets"


async def generate_plan_vo(supabase: Client, prompt_id: str) -> str:
    """Generate VO for plan, cache, link. Returns asset_id."""
    logger.info(f"[vo] Starting VO generation for prompt {prompt_id}")

    plan_response = (
        supabase.table("studio_prompts")
        .select("scene_plan, language")
        .eq("id", prompt_id)
        .single()
        .execute()
    )
    plan = plan_response.data
    scene_plan = plan["scene_plan"]

    full_script = scene_plan["audio"]["voiceover"]["fullScript"]
    speed = scene_plan["audio"]["voiceover"].get("speed", 0.88)
    language = scene_plan["meta"]["language"]

    provider, voice_id = select_provider(language)
    text_hash = hash_vo_request(full_script, language, voice_id, speed)

    # Check cache
    cache = (
        supabase.table("studio_assets")
        .select("id")
        .eq("vo_text_hash", text_hash)
        .eq("download_status", "ready")
        .limit(1)
        .execute()
    )

    if cache.data:
        cached_id = cache.data[0]["id"]
        logger.info(f"[vo] CACHE HIT for VO hash {text_hash}")
        _link_vo(supabase, cached_id, prompt_id)
        return cached_id

    # Generate
    logger.info(f"[vo] Cache miss, generating via {provider}")
    audio_bytes, metadata = await generate_vo(full_script, language, speed)
    logger.info(f"[vo] Generated {len(audio_bytes)} bytes")

    # Upload
    storage_path = f"vo/{text_hash}.mp3"
    supabase.storage.from_(STORAGE_BUCKET).upload(
        storage_path,
        audio_bytes,
        file_options={"content-type": "audio/mpeg", "upsert": "true"},
    )

    # Create asset row
    now = datetime.now(timezone.utc).isoformat()
    asset_row = (
        supabase.table("studio_assets")
        .upsert(
            {
                "source": metadata["provider"],
                "external_id": text_hash,
                "asset_type": "vo",
                "title": full_script[:80],
                "supabase_storage_path": storage_path,
                "download_status": "ready",
                "used_in_runs": 1,
                "vo_provider": metadata["provider"],
                "vo_language": metadata["language"],
                "vo_voice_id": metadata["voice_id"],
                "vo_text_hash": text_hash,
            },
            on_conflict="source,external_id",
        )
        .execute()
    )

    asset_id = asset_row.data[0]["id"]
    logger.info(f"[vo] Stored VO asset {asset_id}")
    _link_vo(supabase, asset_id, prompt_id)
    return asset_id


def _link_vo(supabase: Client, asset_id: str, prompt_id: str):
    try:
        supabase.table("studio_prompt_assets").upsert(
            {
                "prompt_id": prompt_id,
                "asset_id": asset_id,
                "usage_context": "vo_main",
                "scene_id": None,
                "frame_offset": 0,
                "volume": 1.0,
            },
            on_conflict="prompt_id,usage_context",
        ).execute()
    except Exception as e:
        logger.warning(f"[vo] Link failed: {e}")
