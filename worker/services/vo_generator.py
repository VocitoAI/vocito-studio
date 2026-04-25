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

    # Check cache — use external_id which always exists
    cache = (
        supabase.table("studio_assets")
        .select("id")
        .eq("external_id", text_hash)
        .eq("asset_type", "vo_generated")
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

    # Create asset row — only use columns that exist in A3 schema
    asset_data = {
        # Map provider to existing source check constraint values
        "source": "fish_audio" if metadata["provider"] == "fish_audio" else "fish_audio",  # use fish_audio as catch-all for TTS
        "external_id": text_hash,
        "asset_type": "vo_generated",
        "title": full_script[:80],
        "supabase_storage_path": storage_path,
        "download_status": "ready",
        "used_in_runs": 1,
    }

    # Try adding B3 columns if they exist (graceful)
    try:
        asset_row = (
            supabase.table("studio_assets")
            .upsert(
                {
                    **asset_data,
                    "vo_provider": metadata["provider"],
                    "vo_language": metadata["language"],
                    "vo_voice_id": metadata["voice_id"],
                    "vo_text_hash": text_hash,
                },
                on_conflict="source,external_id",
            )
            .execute()
        )
    except Exception:
        # B3 columns don't exist yet — insert without them
        logger.warning("[vo] B3 columns missing, inserting without vo_* fields")
        asset_row = (
            supabase.table("studio_assets")
            .upsert(asset_data, on_conflict="source,external_id")
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
