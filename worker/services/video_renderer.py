"""
Video renderer: combines VO + music + SFX into MP4 using ffmpeg.
Generates scene text overlays on dark background.
"""
import os
import json
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
    logger.info(f"[video] Starting ffmpeg render for {run_id}")

    # Fetch scene plan
    plan_resp = (
        supabase.table("studio_prompts")
        .select("scene_plan")
        .eq("id", prompt_id)
        .single()
        .execute()
    )
    scene_plan = plan_resp.data["scene_plan"]

    # Fetch linked assets with signed URLs
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

    logger.info(f"[video] Asset URLs: {list(asset_urls.keys())}")

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp = Path(tmpdir)

        # Download all audio files
        audio_files = {}
        async with httpx.AsyncClient(timeout=60.0) as client:
            for key, url in asset_urls.items():
                path = tmp / f"{key}.mp3"
                resp = await client.get(url, follow_redirects=True)
                if resp.status_code == 200:
                    path.write_bytes(resp.content)
                    audio_files[key] = str(path)
                    logger.info(f"[video] Downloaded {key}: {len(resp.content)} bytes")

        # Build ffmpeg filter for audio mixing
        output_path = str(tmp / f"{run_id}.mp4")

        # Generate scene text overlay script for ffmpeg drawtext
        drawtext_filters = _build_drawtext_filters(scene_plan)

        # Build ffmpeg command
        cmd = _build_ffmpeg_cmd(audio_files, scene_plan, drawtext_filters, output_path)
        logger.info(f"[video] Running ffmpeg...")

        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=120
        )

        if proc.returncode != 0:
            logger.error(f"[video] ffmpeg failed: {proc.stderr[-500:]}")
            raise RuntimeError(f"ffmpeg failed: {proc.stderr[-300:]}")

        # Check output
        file_size = os.path.getsize(output_path)
        logger.info(f"[video] Render complete: {file_size} bytes")

        # Upload to Supabase Storage
        storage_path = f"renders/{run_id}.mp4"
        with open(output_path, "rb") as f:
            supabase.storage.from_(STORAGE_BUCKET_VIDEOS).upload(
                storage_path,
                f.read(),
                file_options={"content-type": "video/mp4", "upsert": "true"},
            )

        logger.info(f"[video] Uploaded to {storage_path}")
        return storage_path


def _build_drawtext_filters(scene_plan: dict) -> str:
    """Build ffmpeg drawtext filter chain for scene text overlays."""
    filters = []

    for scene in scene_plan["scenes"]:
        copy = scene.get("visual", {}).get("copy")
        if not copy:
            continue

        text = copy["text"].replace("'", "'\\''").replace(":", "\\:")
        start_time = scene["frameStart"] / FPS
        end_time = scene["frameEnd"] / FPS
        fade_dur = min(copy.get("animationDurationMs", 800) / 1000, 1.0)

        font_size = {"xl": 72, "lg": 56, "md": 42, "sm": 32}.get(copy.get("size", "lg"), 56)

        # Fade in alpha
        alpha_expr = (
            f"if(lt(t\\,{start_time})\\,0\\,"
            f"if(lt(t\\,{start_time + fade_dur})\\,"
            f"(t-{start_time})/{fade_dur}\\,"
            f"if(lt(t\\,{end_time - 0.3})\\,1\\,"
            f"(({end_time}-t)/0.3))))"
        )

        filters.append(
            f"drawtext=text='{text}'"
            f":fontsize={font_size}"
            f":fontcolor=white"
            f":x=(w-text_w)/2"
            f":y=(h-text_h)/2"
            f":alpha='{alpha_expr}'"
        )

    return ",".join(filters) if filters else ""


def _build_ffmpeg_cmd(
    audio_files: dict,
    scene_plan: dict,
    drawtext_filters: str,
    output_path: str,
) -> list[str]:
    """Build the full ffmpeg command."""
    cmd = ["ffmpeg", "-y"]

    # Video: dark background
    cmd += [
        "-f", "lavfi",
        "-i", f"color=c=0x05060a:s={W}x{H}:r={FPS}:d={TOTAL_DURATION}",
    ]

    # Audio inputs
    audio_inputs = []
    input_idx = 1  # 0 is the video

    if "music_main" in audio_files:
        cmd += ["-i", audio_files["music_main"]]
        audio_inputs.append(("music", input_idx))
        input_idx += 1

    if "vo_main" in audio_files:
        cmd += ["-i", audio_files["vo_main"]]
        audio_inputs.append(("vo", input_idx))
        input_idx += 1

    # SFX inputs
    sfx_entries = []
    for key, path in sorted(audio_files.items()):
        if key.startswith("sfx_"):
            cmd += ["-i", path]
            sfx_entries.append((key, input_idx))
            input_idx += 1

    # Video filter: drawtext overlays
    vf = drawtext_filters if drawtext_filters else "null"
    cmd += ["-vf", vf]

    # Audio filter: mix all audio tracks
    if audio_inputs or sfx_entries:
        filter_parts = []
        mix_inputs = []
        mix_idx = 0

        for name, idx in audio_inputs:
            if name == "music":
                # Music: lower volume
                vol = scene_plan["audio"]["mixLevels"]["musicBase"]
                filter_parts.append(f"[{idx}:a]volume={vol}[m{mix_idx}]")
                mix_inputs.append(f"[m{mix_idx}]")
                mix_idx += 1
            elif name == "vo":
                # VO: delay 3s (scene 1 is music only), full volume
                vol = scene_plan["audio"]["mixLevels"]["voVolume"]
                filter_parts.append(
                    f"[{idx}:a]adelay=3000|3000,volume={vol}[m{mix_idx}]"
                )
                mix_inputs.append(f"[m{mix_idx}]")
                mix_idx += 1

        for key, idx in sfx_entries:
            # Find frame offset from scene plan
            delay_ms = 0
            for scene in scene_plan["scenes"]:
                for si, sfx in enumerate(scene.get("audio", {}).get("sfxRequests") or []):
                    sfx_key = f"sfx_{scene['id']}_{si}"
                    if sfx_key == key:
                        delay_ms = int((scene["frameStart"] + sfx.get("frameOffset", 0)) / FPS * 1000)
                        vol = sfx.get("volume", 0.5)
                        filter_parts.append(
                            f"[{idx}:a]adelay={delay_ms}|{delay_ms},volume={vol}[m{mix_idx}]"
                        )
                        mix_inputs.append(f"[m{mix_idx}]")
                        mix_idx += 1

        if mix_inputs:
            mix_str = "".join(mix_inputs)
            filter_parts.append(f"{mix_str}amix=inputs={len(mix_inputs)}:duration=longest[aout]")
            cmd += ["-filter_complex", ";".join(filter_parts)]
            cmd += ["-map", "0:v", "-map", "[aout]"]
        else:
            cmd += ["-an"]
    else:
        cmd += ["-an"]

    cmd += [
        "-c:v", "libx264",
        "-preset", "fast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-t", str(TOTAL_DURATION),
        "-movflags", "+faststart",
        output_path,
    ]

    return cmd
