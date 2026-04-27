"""
VO Generator: per-scene chunks + concatenated full VO for natural dynamics.
Chunks are kept for B4 selective regen. Full concat is used by Remotion.
"""
import logging
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from supabase import Client
from services.voice_router import generate_vo, select_provider, hash_vo_request

logger = logging.getLogger(__name__)

STORAGE_BUCKET = "studio-assets"
FPS = 30

# Scene boundaries (frameStart, frameEnd)
SCENE_FRAMES = {
    "scene1_materializes": (0, 90),
    "scene2_pain_01": (90, 180),
    "scene3_pain_02": (180, 270),
    "scene4_action": (270, 450),
    "scene5_promise_01": (450, 570),
    "scene6_promise_02": (570, 690),
    "scene7_tagline": (690, 870),
    "scene8_wordmark": (870, 990),
}


async def generate_plan_vo(supabase: Client, prompt_id: str) -> list[str]:
    """Generate per-scene VO chunks + concatenated full VO."""
    logger.info(f"[vo] Starting per-scene VO generation for {prompt_id}")

    plan = supabase.table("studio_prompts").select("scene_plan, language").eq(
        "id", prompt_id
    ).single().execute().data
    scene_plan = plan["scene_plan"]
    speed = scene_plan["audio"]["voiceover"].get("speed", 0.88)
    language = scene_plan["meta"]["language"]
    provider, voice_id = select_provider(language)

    chunk_paths = {}  # scene_id -> (local_path, asset_id)
    asset_ids = []

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        for scene in scene_plan["scenes"]:
            vo_text = scene.get("audio", {}).get("voText")
            scene_id = scene["id"]

            if not vo_text or not vo_text.strip():
                chunk_paths[scene_id] = None
                continue

            emotion = scene.get("audio", {}).get("voEmotion", "thoughtful")
            usage_context = f"vo_{scene_id}"

            # Add emotion tag if not present
            if not vo_text.strip().startswith("["):
                vo_text = f"[{emotion}] {vo_text}"

            text_hash = hash_vo_request(vo_text, language, voice_id, speed)

            # Check cache
            cache = supabase.table("studio_assets").select("id, supabase_storage_path").eq(
                "external_id", text_hash
            ).eq("asset_type", "vo_generated").limit(1).execute()

            if cache.data:
                asset_id = cache.data[0]["id"]
                storage_path = cache.data[0]["supabase_storage_path"]
                logger.info(f"[vo] CACHE HIT for {scene_id}")

                # Download cached chunk for concatenation
                signed = supabase.storage.from_(STORAGE_BUCKET).create_signed_url(storage_path, 600)
                url = signed.get("signedURL") or (signed.get("data", {}) or {}).get("signedUrl")
                if url:
                    import httpx
                    async with httpx.AsyncClient(timeout=30) as client:
                        resp = await client.get(url, follow_redirects=True)
                        chunk_file = tmp / f"{scene_id}.mp3"
                        chunk_file.write_bytes(resp.content)
                        chunk_paths[scene_id] = (str(chunk_file), asset_id)
            else:
                # Generate
                logger.info(f"[vo] Generating {scene_id}: '{vo_text[:40]}...'")
                audio_bytes, metadata = await generate_vo(vo_text, language, speed)
                logger.info(f"[vo] {scene_id}: {len(audio_bytes)} bytes")

                # Save locally for concatenation
                chunk_file = tmp / f"{scene_id}.mp3"
                chunk_file.write_bytes(audio_bytes)

                # Upload chunk
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
                chunk_paths[scene_id] = (str(chunk_file), asset_id)

            # Link chunk to prompt
            supabase.table("studio_prompt_assets").upsert({
                "prompt_id": prompt_id,
                "asset_id": asset_id,
                "usage_context": usage_context,
                "scene_id": scene_id,
                "frame_offset": 0,
                "volume": 1.0,
            }, on_conflict="prompt_id,usage_context").execute()
            asset_ids.append(asset_id)

        # Concatenate chunks into single VO file with silence padding
        full_vo_path = str(tmp / "vo_full.mp3")
        _concatenate_with_silence(chunk_paths, full_vo_path, scene_plan)

        if Path(full_vo_path).exists() and Path(full_vo_path).stat().st_size > 0:
            # Upload concatenated VO
            full_hash = hash_vo_request("FULL:" + prompt_id, language, voice_id, speed)
            full_storage = f"vo/full_{full_hash}.mp3"

            with open(full_vo_path, "rb") as f:
                supabase.storage.from_(STORAGE_BUCKET).upload(
                    full_storage, f.read(),
                    file_options={"content-type": "audio/mpeg", "upsert": "true"},
                )

            full_asset = supabase.table("studio_assets").upsert({
                "source": "fish_audio",
                "external_id": full_hash,
                "asset_type": "vo_generated",
                "title": "Full VO (concatenated)",
                "supabase_storage_path": full_storage,
                "download_status": "ready",
                "used_in_runs": 1,
            }, on_conflict="source,external_id").execute()

            full_asset_id = full_asset.data[0]["id"]

            # Link as vo_main (used by Remotion)
            supabase.table("studio_prompt_assets").upsert({
                "prompt_id": prompt_id,
                "asset_id": full_asset_id,
                "usage_context": "vo_main",
                "scene_id": None,
                "frame_offset": 0,
                "volume": 1.0,
            }, on_conflict="prompt_id,usage_context").execute()

            logger.info(f"[vo] Full VO uploaded: {full_storage}")

    logger.info(f"[vo] Generated {len(asset_ids)} chunks + 1 full VO")
    return asset_ids


def _concatenate_with_silence(chunk_paths: dict, output_path: str, scene_plan: dict):
    """Concatenate scene VO chunks with silence padding based on frame timings."""
    # Build ffmpeg concat filter
    inputs = []
    filter_parts = []
    idx = 0

    for scene in scene_plan["scenes"]:
        scene_id = scene["id"]
        frames = SCENE_FRAMES.get(scene_id, (0, 0))
        scene_duration = (frames[1] - frames[0]) / FPS

        chunk = chunk_paths.get(scene_id)

        if chunk is None:
            # No VO for this scene — insert silence
            filter_parts.append(f"anullsrc=r=44100:cl=mono:d={scene_duration}[s{idx}]")
            inputs.append(f"[s{idx}]")
            idx += 1
        else:
            chunk_file, _ = chunk
            filter_parts.append(f"amovie={chunk_file}[c{idx}]")
            # Pad chunk to exactly scene duration
            filter_parts.append(f"[c{idx}]apad=whole_dur={scene_duration}[p{idx}]")
            # Trim to scene duration (in case chunk is longer)
            filter_parts.append(f"[p{idx}]atrim=0:{scene_duration}[s{idx}]")
            inputs.append(f"[s{idx}]")
            idx += 1

    # Concat all segments
    concat_inputs = "".join(inputs)
    filter_parts.append(f"{concat_inputs}concat=n={idx}:v=0:a=1[out]")

    filter_str = ";".join(filter_parts)

    cmd = [
        "ffmpeg", "-y",
        "-filter_complex", filter_str,
        "-map", "[out]",
        "-c:a", "libmp3lame", "-b:a", "128k",
        output_path,
    ]

    logger.info(f"[vo] Concatenating {idx} segments into full VO...")
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)

    if result.returncode != 0:
        logger.error(f"[vo] Concat failed: {result.stderr[-300:]}")
    else:
        size = Path(output_path).stat().st_size
        logger.info(f"[vo] Full VO: {size} bytes ({size // 1024}KB)")
