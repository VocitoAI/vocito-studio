"""
Video renderer: combines all assets into a single MP4 using ffmpeg.
Renders blob gradient, scene text overlays, and mixed audio.
"""
import os
import logging
import subprocess
import tempfile
import math
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

    # Get signed URLs for all assets
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

        # Generate blob frames as a video with ffmpeg
        # Use lavfi to create a gradient circle (blob) animation
        blob_filter = _build_blob_filter(scene_plan)
        text_filter = _build_text_filter(scene_plan)

        output_path = str(tmp / f"{run_id}.mp4")

        # Build ffmpeg command
        cmd = ["ffmpeg", "-y"]

        # Input 0: dark background with blob overlay
        cmd += [
            "-f", "lavfi",
            "-i", f"color=c=0x05060a:s={W}x{H}:r={FPS}:d={TOTAL_DURATION}",
        ]

        # Audio inputs
        input_idx = 1
        audio_input_map = {}

        for key in ["music_main", "vo_main"]:
            if key in audio_files:
                cmd += ["-i", audio_files[key]]
                audio_input_map[key] = input_idx
                input_idx += 1

        sfx_inputs = []
        for key in sorted(audio_files.keys()):
            if key.startswith("sfx_"):
                cmd += ["-i", audio_files[key]]
                sfx_inputs.append((key, input_idx))
                input_idx += 1

        # Video filter: blob + text
        vf_parts = []
        if blob_filter:
            vf_parts.append(blob_filter)
        if text_filter:
            vf_parts.append(text_filter)
        vf = ",".join(vf_parts) if vf_parts else "null"
        cmd += ["-vf", vf]

        # Audio filter: mix everything
        filter_complex = _build_audio_filter(
            scene_plan, audio_input_map, sfx_inputs
        )
        if filter_complex:
            cmd += ["-filter_complex", filter_complex]
            cmd += ["-map", "0:v", "-map", "[aout]"]
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

        logger.info(f"[video] Running ffmpeg...")
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)

        if proc.returncode != 0:
            logger.error(f"[video] ffmpeg stderr: {proc.stderr[-500:]}")
            raise RuntimeError(f"ffmpeg failed: {proc.stderr[-300:]}")

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


def _build_blob_filter(scene_plan: dict) -> str:
    """Build a ffmpeg filter that draws a glowing gradient circle (blob)."""
    # Use geq (generic equation) filter for a radial gradient blob
    # The blob is a purple-teal gradient circle in the center
    parts = []

    for scene in scene_plan["scenes"]:
        blob = scene.get("visual", {}).get("blob")
        if not blob:
            continue

        start = scene["frameStart"] / FPS
        end = scene["frameEnd"] / FPS
        opacity = blob.get("opacity", 0.8)
        scale = blob.get("scale", 1.0)
        state = blob.get("state", "breathing")

        # Render blob as a semi-transparent purple ellipse overlay
        # Using drawbox with rounded corners isn't possible, so we use
        # a radial gradient approach with the geq filter
        # Simplified: draw a colored circle using drawtext with a unicode circle
        r = int(150 * scale)
        cx = W // 2
        cy = H // 2

        if state == "materializing":
            alpha_expr = f"if(between(t,{start},{end}),(t-{start})/({end}-{start})*{opacity},0)"
        elif state == "fading":
            alpha_expr = f"if(between(t,{start},{end}),{opacity}*(1-(t-{start})/({end}-{start})*0.7),0)"
        else:
            alpha_expr = f"if(between(t,{start},{end}),{opacity},0)"

        # Draw a filled purple circle
        parts.append(
            f"drawbox=x={cx - r}:y={cy - r}:w={r * 2}:h={r * 2}"
            f":color=0xa78bff@'{alpha_expr}':t=fill"
            f":enable='between(t,{start},{end})'"
        )

        # Overlay a teal smaller circle for gradient effect
        r2 = int(r * 0.6)
        parts.append(
            f"drawbox=x={cx - r2}:y={cy - r2}:w={r2 * 2}:h={r2 * 2}"
            f":color=0x5eead4@'{alpha_expr}':t=fill"
            f":enable='between(t,{start},{end})'"
        )

    # Apply gaussian blur to make it look like a blob
    if parts:
        parts.append("gblur=sigma=80")

    return ",".join(parts)


def _build_text_filter(scene_plan: dict) -> str:
    """Build ffmpeg drawtext filters for scene copy."""
    filters = []

    for scene in scene_plan["scenes"]:
        copy = scene.get("visual", {}).get("copy")
        if not copy:
            continue

        text = copy["text"].replace("'", "'\\''").replace(":", "\\:").replace("%", "%%")
        start = scene["frameStart"] / FPS
        end = scene["frameEnd"] / FPS
        fade_dur = min(copy.get("animationDurationMs", 800) / 1000, 1.0)

        size = {"xl": 72, "lg": 56, "md": 42, "sm": 32}.get(copy.get("size", "lg"), 56)

        alpha = (
            f"if(lt(t\\,{start})\\,0\\,"
            f"if(lt(t\\,{start + fade_dur})\\,(t-{start})/{fade_dur}\\,"
            f"if(lt(t\\,{end - 0.3})\\,1\\,(({end}-t)/0.3))))"
        )

        filters.append(
            f"drawtext=text='{text}'"
            f":fontsize={size}"
            f":fontcolor=white"
            f":x=(w-text_w)/2"
            f":y=(h-text_h)/2"
            f":alpha='{alpha}'"
        )

    return ",".join(filters)


def _build_audio_filter(
    scene_plan: dict,
    audio_map: dict,
    sfx_inputs: list,
) -> str:
    """Build ffmpeg filter_complex for audio mixing."""
    parts = []
    mix_labels = []
    idx = 0

    if "music_main" in audio_map:
        vol = scene_plan["audio"]["mixLevels"]["musicBase"]
        i = audio_map["music_main"]
        parts.append(f"[{i}:a]volume={vol}[a{idx}]")
        mix_labels.append(f"[a{idx}]")
        idx += 1

    if "vo_main" in audio_map:
        vol = scene_plan["audio"]["mixLevels"]["voVolume"]
        i = audio_map["vo_main"]
        parts.append(f"[{i}:a]adelay=3000|3000,volume={vol}[a{idx}]")
        mix_labels.append(f"[a{idx}]")
        idx += 1

    for key, i in sfx_inputs:
        delay_ms = 0
        vol = 0.5
        for scene in scene_plan["scenes"]:
            for si, sfx in enumerate(scene.get("audio", {}).get("sfxRequests") or []):
                if f"sfx_{scene['id']}_{si}" == key:
                    delay_ms = int((scene["frameStart"] + sfx.get("frameOffset", 0)) / FPS * 1000)
                    vol = sfx.get("volume", 0.5)
        parts.append(f"[{i}:a]adelay={delay_ms}|{delay_ms},volume={vol}[a{idx}]")
        mix_labels.append(f"[a{idx}]")
        idx += 1

    if not mix_labels:
        return ""

    mix_str = "".join(mix_labels)
    parts.append(f"{mix_str}amix=inputs={len(mix_labels)}:duration=longest[aout]")
    return ";".join(parts)
