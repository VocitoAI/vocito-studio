"""
Video renderer: combines all assets into a single MP4 using ffmpeg.
Two-pass approach: first mix audio, then combine with video.
"""
import os
import logging
import subprocess
import tempfile
from pathlib import Path

import httpx
from supabase import Client

logger = logging.getLogger(__name__)

STORAGE_BUCKET_ASSETS = "studio-assets"
STORAGE_BUCKET_VIDEOS = "studio-videos"
FPS = 30
TOTAL_DURATION = 33
W = 1920
H = 1080


async def render_video(supabase: Client, prompt_id: str, run_id: str) -> str:
    """Render MP4 from scene plan + assets. Returns storage path."""
    logger.info(f"[video] Starting render for {run_id}")

    plan_resp = (
        supabase.table("studio_prompts")
        .select("scene_plan")
        .eq("id", prompt_id)
        .single()
        .execute()
    )
    scene_plan = plan_resp.data["scene_plan"]

    # Get signed URLs
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
        signed = supabase.storage.from_(STORAGE_BUCKET_ASSETS).create_signed_url(
            asset["supabase_storage_path"], 3600
        )
        url = signed.get("signedURL") or (signed.get("data", {}) or {}).get("signedUrl")
        if url:
            asset_urls[link["usage_context"]] = url

    logger.info(f"[video] Assets: {list(asset_urls.keys())}")

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Download all audio
        audio_files = {}
        async with httpx.AsyncClient(timeout=60.0) as client:
            for key, url in asset_urls.items():
                path = tmp / f"{key}.mp3"
                resp = await client.get(url, follow_redirects=True)
                if resp.status_code == 200:
                    path.write_bytes(resp.content)
                    audio_files[key] = str(path)
                    logger.info(f"[video] Downloaded {key}: {len(resp.content)} bytes")

        # PASS 1: Mix all audio into one file
        mixed_audio = str(tmp / "mixed.mp3")
        _mix_audio(audio_files, scene_plan, mixed_audio)

        # PASS 2: Generate video with text overlays + mixed audio
        output_path = str(tmp / f"{run_id}.mp4")
        text_filter = _build_text_filter(scene_plan)
        _render_final(mixed_audio, text_filter, output_path)

        file_size = os.path.getsize(output_path)
        logger.info(f"[video] Render done: {file_size} bytes ({file_size // 1024}KB)")

        # Upload
        storage_path = f"renders/{run_id}.mp4"
        with open(output_path, "rb") as f:
            supabase.storage.from_(STORAGE_BUCKET_VIDEOS).upload(
                storage_path,
                f.read(),
                file_options={"content-type": "video/mp4", "upsert": "true"},
            )

        logger.info(f"[video] Uploaded to {storage_path}")
        return storage_path


def _mix_audio(audio_files: dict, scene_plan: dict, output: str):
    """Mix music + VO + SFX into single audio file."""
    cmd = ["ffmpeg", "-y"]
    filter_parts = []
    labels = []
    idx = 0

    # Music
    if "music_main" in audio_files:
        cmd += ["-i", audio_files["music_main"]]
        vol = scene_plan["audio"]["mixLevels"]["musicBase"]
        filter_parts.append(f"[{idx}:a]volume={vol}[a{idx}]")
        labels.append(f"[a{idx}]")
        idx += 1

    # VO with 3s delay
    if "vo_main" in audio_files:
        cmd += ["-i", audio_files["vo_main"]]
        vol = scene_plan["audio"]["mixLevels"]["voVolume"]
        filter_parts.append(f"[{idx}:a]adelay=3000|3000,volume={vol}[a{idx}]")
        labels.append(f"[a{idx}]")
        idx += 1

    # SFX with timing
    for key in sorted(audio_files.keys()):
        if not key.startswith("sfx_"):
            continue
        cmd += ["-i", audio_files[key]]
        delay_ms, vol = _get_sfx_timing(key, scene_plan)
        filter_parts.append(f"[{idx}:a]adelay={delay_ms}|{delay_ms},volume={vol}[a{idx}]")
        labels.append(f"[a{idx}]")
        idx += 1

    if not labels:
        # No audio — create silence
        subprocess.run([
            "ffmpeg", "-y", "-f", "lavfi", "-i",
            f"anullsrc=r=44100:cl=stereo:d={TOTAL_DURATION}",
            "-c:a", "libmp3lame", output,
        ], capture_output=True, timeout=30)
        return

    mix_str = "".join(labels)
    filter_parts.append(f"{mix_str}amix=inputs={len(labels)}:duration=longest[out]")

    cmd += ["-filter_complex", ";".join(filter_parts)]
    cmd += ["-map", "[out]", "-c:a", "libmp3lame", "-t", str(TOTAL_DURATION), output]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
    if result.returncode != 0:
        logger.error(f"[video] Audio mix failed: {result.stderr[-300:]}")
        raise RuntimeError(f"Audio mix failed: {result.stderr[-200:]}")

    logger.info(f"[video] Audio mixed: {os.path.getsize(output)} bytes")


def _render_final(audio_path: str, text_filter: str, output: str):
    """Render final MP4: dark bg + text overlays + mixed audio."""
    vf = text_filter if text_filter else "null"

    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi", "-i", f"color=c=0x05060a:s={W}x{H}:r={FPS}:d={TOTAL_DURATION}",
        "-i", audio_path,
        "-vf", vf,
        "-map", "0:v", "-map", "1:a",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-t", str(TOTAL_DURATION),
        "-movflags", "+faststart",
        "-shortest",
        output,
    ]

    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        logger.error(f"[video] Final render failed: {result.stderr[-300:]}")
        raise RuntimeError(f"Render failed: {result.stderr[-200:]}")


def _build_text_filter(scene_plan: dict) -> str:
    """Build ffmpeg drawtext filter for scene text."""
    filters = []

    for scene in scene_plan["scenes"]:
        copy = scene.get("visual", {}).get("copy")
        if not copy:
            continue

        text = copy["text"].replace("'", "\u2019").replace(":", "\\:").replace("%", "%%")
        start = scene["frameStart"] / FPS
        end = scene["frameEnd"] / FPS
        fade = min(copy.get("animationDurationMs", 800) / 1000, 1.0)
        size = {"xl": 72, "lg": 56, "md": 42, "sm": 32}.get(copy.get("size", "lg"), 56)

        alpha = (
            f"if(lt(t\\,{start})\\,0\\,"
            f"if(lt(t\\,{start + fade})\\,(t-{start})/{fade}\\,"
            f"if(lt(t\\,{end - 0.3})\\,1\\,(({end}-t)/0.3))))"
        )

        filters.append(
            f"drawtext=text='{text}'"
            f":fontsize={size}:fontcolor=white"
            f":x=(w-text_w)/2:y=(h-text_h)/2"
            f":alpha='{alpha}'"
        )

    return ",".join(filters)


def _get_sfx_timing(key: str, scene_plan: dict) -> tuple[int, float]:
    """Get delay_ms and volume for an SFX key."""
    for scene in scene_plan["scenes"]:
        for si, sfx in enumerate(scene.get("audio", {}).get("sfxRequests") or []):
            if f"sfx_{scene['id']}_{si}" == key:
                delay = int((scene["frameStart"] + sfx.get("frameOffset", 0)) / FPS * 1000)
                return delay, sfx.get("volume", 0.5)
    return 0, 0.5
