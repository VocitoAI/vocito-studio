"""
Calls Claude to selectively modify scene plan based on feedback categories.
"""
import os
import json
import logging

import httpx

logger = logging.getLogger(__name__)

ANTHROPIC_API_KEY = os.environ.get("ANTHROPIC_API_KEY", "")

SYSTEM_PROMPT = """You are a precision video plan editor for Vocito Studio.

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


async def regenerate_scene_plan(current_plan: dict, feedback: dict) -> dict:
    categories = feedback.get("categories", [])
    global_fb = feedback.get("global_feedback", "")
    per_scene = feedback.get("per_scene_feedback", {})

    user_msg = f"""CURRENT SCENE PLAN:
{json.dumps(current_plan, indent=2)}

CATEGORIES TO MODIFY: {', '.join(categories)}

GLOBAL FEEDBACK:
{global_fb or '(none)'}

PER-SCENE FEEDBACK:
{json.dumps(per_scene, indent=2) if per_scene else '(none)'}

Return the complete adjusted scene plan as JSON."""

    logger.info(f"[regen] Calling Claude for categories: {categories}")

    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
            },
            json={
                "model": "claude-sonnet-4-5",
                "max_tokens": 8000,
                "system": SYSTEM_PROMPT,
                "messages": [{"role": "user", "content": user_msg}],
            },
        )
        resp.raise_for_status()

    data = resp.json()
    raw = data["content"][0]["text"].strip()

    # Strip markdown fences
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    new_plan = json.loads(raw)

    # Validate frame timings unchanged
    for old_s, new_s in zip(current_plan["scenes"], new_plan["scenes"]):
        if old_s["frameStart"] != new_s["frameStart"] or old_s["frameEnd"] != new_s["frameEnd"]:
            raise RuntimeError(f"Frame timing changed for {old_s['id']} — rejected")

    logger.info("[regen] Scene plan regenerated successfully")
    return new_plan
