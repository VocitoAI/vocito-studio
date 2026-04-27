"""
VO Generator: generates per-scene VO chunks for frame-perfect sync.
Each scene with voText gets its own MP3 file, linked to the scene's frame range.
"""
import logging
from datetime import datetime, timezone

from supabase import Client
from services.voice_router import generate_vo, select_provider, hash_vo_request

logger = logging.getLogger(__name__)

STORAGE_BUCKET = "studio-assets"

# Scenes that have VO (scene 1 has no VO)
VO_SCENES = [
    "scene2_pain_01",
    "scene3_pain_02",
    "scene4_action",
    "scene5_promise_01",
    "scene6_promise_02",
    "scene7_tagline",
    "scene8_wordmark",
]


async def generate_plan_vo(supabase: Client, prompt_id: str) -> list[str]:
    """Generate per-scene VO chunks. Returns list of asset_ids."""
    logger.info(f"[vo] Starting per-scene VO generation for {prompt_id}")

    plan = supabase.table("studio_prompts").select("scene_plan, language").eq(
        "id", prompt_id
    ).single().execute().data
    scene_plan = plan["scene_plan"]
    speed = scene_plan["audio"]["voiceover"].get("speed", 0.88)
    language = scene_plan["meta"]["language"]
    provider, voice_id = select_provider(language)

    asset_ids = []

    for scene in scene_plan["scenes"]:
        vo_text = scene.get("audio", {}).get("voText")
        if not vo_text or not vo_text.strip():
            continue

        scene_id = scene["id"]
        emotion = scene.get("audio", {}).get("voEmotion", "thoughtful")
        usage_context = f"vo_{scene_id}"

        # Add emotion tag if not already present
        if not vo_text.strip().startswith("["):
            vo_text = f"[{emotion}] {vo_text}"

        text_hash = hash_vo_request(vo_text, language, voice_id, speed)

        # Check cache
        cache = supabase.table("studio_assets").select("id").eq(
            "external_id", text_hash
        ).eq("asset_type", "vo_generated").limit(1).execute()

        if cache.data:
            asset_id = cache.data[0]["id"]
            logger.info(f"[vo] CACHE HIT for {scene_id}")
        else:
            # Generate
            logger.info(f"[vo] Generating {scene_id}: '{vo_text[:50]}...'")
            audio_bytes, metadata = await generate_vo(vo_text, language, speed)
            logger.info(f"[vo] {scene_id}: {len(audio_bytes)} bytes")

            # Upload
            storage_path = f"vo/{text_hash}.mp3"
            supabase.storage.from_(STORAGE_BUCKET).upload(
                storage_path, audio_bytes,
                file_options={"content-type": "audio/mpeg", "upsert": "true"},
            )

            # Create asset
            asset_row = supabase.table("studio_assets").upsert({
                "source": "fish_audio",
                "external_id": text_hash,
                "asset_type": "vo_generated",
                "title": vo_text[:80],
                "supabase_storage_path": storage_path,
                "download_status": "ready",
                "used_in_runs": 1,
            }, on_conflict="source,external_id").execute()

            asset_id = asset_row.data[0]["id"]

        # Link to prompt with scene-specific context
        supabase.table("studio_prompt_assets").upsert({
            "prompt_id": prompt_id,
            "asset_id": asset_id,
            "usage_context": usage_context,
            "scene_id": scene_id,
            "frame_offset": 0,
            "volume": 1.0,
        }, on_conflict="prompt_id,usage_context").execute()

        asset_ids.append(asset_id)
        logger.info(f"[vo] Linked {scene_id} -> {asset_id}")

    # Also keep a vo_main link pointing to first chunk (for backwards compat)
    if asset_ids:
        supabase.table("studio_prompt_assets").upsert({
            "prompt_id": prompt_id,
            "asset_id": asset_ids[0],
            "usage_context": "vo_main",
            "scene_id": None,
            "frame_offset": 0,
            "volume": 1.0,
        }, on_conflict="prompt_id,usage_context").execute()

    logger.info(f"[vo] Generated {len(asset_ids)} VO chunks")
    return asset_ids
