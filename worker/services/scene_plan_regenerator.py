"""
Calls Claude to selectively modify scene plan based on feedback.
Runs in a thread to avoid blocking the asyncio event loop.
"""
import os
import json
import logging
import asyncio
from functools import partial

import httpx

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

SYSTEM_PROMPT_LEGACY = """You are a precision video plan editor for Vocito Studio.

You receive a current scene plan + feedback + categories to modify.
Return a NEW complete scene plan that:
- Modifies ONLY fields belonging to selected categories
- Preserves ALL other fields exactly as they were
- Addresses the specific feedback

CRITICAL RULES:
1. NEVER change frame timings (frameStart, frameEnd, totalFrames, durationSeconds)
2. NEVER change scene IDs, scene order, or the 8-scene structure
3. For "text": update both voText AND the matching part of fullScript
4. For "vo": only modify voEmotion, speed, voiceId — NOT text content
5. For "visuals": modify blob, copy styling/animation, uiElements
6. For "music": modify searchQuery, mood, mixLevels
7. For "sfx": modify sfxRequests

Return the COMPLETE adjusted scene plan as valid JSON. No markdown wrapping."""

SYSTEM_PROMPT_UNIVERSAL = """You are a creative video plan editor for Vocito Studio with FULL creative freedom.

You receive a current scene plan + feedback + categories to modify.
Return a NEW complete scene plan that addresses the feedback.

YOU CAN:
- Change scene count (add, remove, reorder scenes)
- Change scene durations and frame timings
- Change componentTypes (blob_only, blob_copy, blob_copy_ui, customer_quote, cta_button, wordmark, fullscreen_text)
- Rewrite all text, VO, copy, and animations
- Change the emotional arc and pacing

RULES:
1. frameStart of scene N must equal frameEnd of scene N-1 (no gaps)
2. The LAST scene MUST be componentType "wordmark" with copy.text containing "VOCITO"
3. Update meta.totalFrames and meta.totalDurationSeconds to match new structure
4. Update audio.voiceover.fullScript to match all scene voText combined
5. For "text": update voText, copy.text, and fullScript
6. For "vo": modify voEmotion, speed, voiceId, and voText if needed
7. For "visuals": modify blob, copy, componentType, uiElements freely
8. For "music": modify searchQuery, mood, mixLevels
9. For "sfx": modify sfxRequests
10. Keep meta.template as "universal"

Return the COMPLETE adjusted scene plan as valid JSON. No markdown wrapping."""


def _call_claude_sync(user_msg: str, system_prompt: str) -> str:
    """Synchronous HTTP call to Claude API — runs in thread pool."""
    resp = httpx.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": ANTHROPIC_API_KEY,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": "claude-sonnet-4-5",
            "max_tokens": 8000,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_msg}],
        },
        timeout=120.0,
    )
    resp.raise_for_status()
    return resp.json()["content"][0]["text"].strip()


async def regenerate_scene_plan(current_plan: dict, feedback: dict) -> dict:
    categories = feedback.get("categories", [])
    global_fb = feedback.get("global_feedback", "")
    per_scene = feedback.get("per_scene_feedback", {})

    # Select system prompt based on template type
    template_id = current_plan.get("meta", {}).get("template", "")
    is_universal = template_id in ("universal", "")
    system_prompt = SYSTEM_PROMPT_UNIVERSAL if is_universal else SYSTEM_PROMPT_LEGACY

    user_msg = f"""CURRENT SCENE PLAN:
{json.dumps(current_plan, indent=2)}

CATEGORIES TO MODIFY: {', '.join(categories)}

GLOBAL FEEDBACK:
{global_fb or '(none)'}

PER-SCENE FEEDBACK:
{json.dumps(per_scene, indent=2) if per_scene else '(none)'}

Return the complete adjusted scene plan as JSON."""

    logger.info(f"[regen] Calling Claude (threaded) for categories: {categories} (template: {template_id})")

    # Run sync HTTP call in thread pool to avoid blocking event loop
    loop = asyncio.get_event_loop()
    raw = await loop.run_in_executor(None, partial(_call_claude_sync, user_msg, system_prompt))

    logger.info(f"[regen] Claude responded ({len(raw)} chars)")

    # Strip markdown fences
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    new_plan = json.loads(raw)

    # For legacy templates: validate frame timings unchanged
    if not is_universal:
        for old_s, new_s in zip(current_plan["scenes"], new_plan["scenes"]):
            if old_s["frameStart"] != new_s["frameStart"] or old_s["frameEnd"] != new_s["frameEnd"]:
                raise RuntimeError(f"Frame timing changed for {old_s['id']}")
    else:
        # For universal: validate frame continuity (no gaps)
        for i in range(1, len(new_plan.get("scenes", []))):
            prev_end = new_plan["scenes"][i - 1].get("frameEnd", 0)
            curr_start = new_plan["scenes"][i].get("frameStart", 0)
            if prev_end != curr_start:
                logger.warning(f"[regen] Frame gap at scene {i}: {prev_end} → {curr_start}, auto-fixing")
                new_plan["scenes"][i]["frameStart"] = prev_end

    logger.info("[regen] Scene plan regenerated successfully")
    return new_plan
