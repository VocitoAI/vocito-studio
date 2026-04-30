"""
VoiceRouter: chooses VO provider based on language.
- EN → Fish Audio (better emotion control via inline tags)
- NL/DE → ElevenLabs v2 multilingual
- Favorites override: if user has liked voices for a language,
  those are used instead of the defaults.
"""
import os
import re
import hashlib
import logging
import random
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

FISH_AUDIO_API_KEY = os.environ.get("FISH_AUDIO_API_KEY", "")
ELEVENLABS_API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")

VOICE_IDS = {
    "fish_audio": {
        "en": os.environ.get("FISH_AUDIO_VOICE_ID_EN", "fb8e07966f284b8bb3f486ec87f5b029"),
    },
    "elevenlabs": {
        "en": os.environ.get("ELEVENLABS_VOICE_ID_EN", "ShB6BQqbEXZxWO5511Qq"),
        "nl": os.environ.get("ELEVENLABS_VOICE_ID_NL", "jfwdd64Nlhnj6vcFqRHZ"),
        "de": os.environ.get("ELEVENLABS_VOICE_ID_DE", "rAmra0SCIYOxYmRNDSm3"),
    },
}


def _get_favorite_voice(supabase, language: str) -> Optional[tuple[str, str]]:
    """Check studio_voice_favorites for a liked voice matching the language.
    Returns (provider, voice_id) or None."""
    if supabase is None:
        return None
    try:
        # First try exact language match
        result = supabase.table("studio_voice_favorites").select(
            "provider, voice_id"
        ).eq("language", language).execute()

        if result.data:
            pick = random.choice(result.data)
            logger.info(f"[vo] Using favorite voice {pick['voice_id']} ({pick['provider']}) for {language}")
            return (pick["provider"], pick["voice_id"])

        # No language-specific favorite — try any favorite for the right provider
        provider = "fish_audio" if language == "en" else "elevenlabs"
        result = supabase.table("studio_voice_favorites").select(
            "provider, voice_id"
        ).eq("provider", provider).execute()

        if result.data:
            pick = random.choice(result.data)
            logger.info(f"[vo] Using provider-matched favorite {pick['voice_id']} for {language}")
            return (pick["provider"], pick["voice_id"])
    except Exception as e:
        logger.warning(f"[vo] Failed to query favorites: {e}")

    return None


def select_provider(language: str, supabase=None) -> tuple[str, str]:
    # Check favorites first
    fav = _get_favorite_voice(supabase, language)
    if fav:
        return fav

    # Fallback: EN → Fish Audio, NL/DE → ElevenLabs
    if language == "en":
        return ("fish_audio", VOICE_IDS["fish_audio"]["en"])
    if language in VOICE_IDS["elevenlabs"]:
        return ("elevenlabs", VOICE_IDS["elevenlabs"][language])
    return ("elevenlabs", VOICE_IDS["elevenlabs"]["en"])


async def generate_vo(
    text: str,
    language: str,
    speed: float = 0.88,
    voice_id_override: Optional[str] = None,
) -> tuple[bytes, dict]:
    provider, voice_id = select_provider(language)
    if voice_id_override:
        voice_id = voice_id_override

    logger.info(f"[vo] Generating with {provider} voice {voice_id} for {language}")

    if provider == "fish_audio":
        audio_bytes = await _generate_fish_audio(text, voice_id, speed)
    else:
        audio_bytes = await _generate_elevenlabs(text, voice_id, language)

    metadata = {
        "provider": provider,
        "voice_id": voice_id,
        "language": language,
        "speed": speed,
        "text_length": len(text),
        "audio_size_bytes": len(audio_bytes),
    }
    return audio_bytes, metadata


async def _generate_fish_audio(text: str, voice_id: str, speed: float) -> bytes:
    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            "https://api.fish.audio/v1/tts",
            headers={
                "Authorization": f"Bearer {FISH_AUDIO_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "text": text,
                "reference_id": voice_id,
                "format": "mp3",
                "mp3_bitrate": 128,
                "normalize": True,
                "latency": "balanced",
                "speed": speed,
            },
        )
        response.raise_for_status()
        return response.content


EMOTION_VOICE_SETTINGS = {
    "thoughtful": {"stability": 0.55, "similarity_boost": 0.75, "style": 0.30},
    "firm":       {"stability": 0.65, "similarity_boost": 0.80, "style": 0.50},
    "warm":       {"stability": 0.45, "similarity_boost": 0.85, "style": 0.40},
    "reassuring": {"stability": 0.55, "similarity_boost": 0.85, "style": 0.35},
    "declarative":{"stability": 0.70, "similarity_boost": 0.80, "style": 0.60},
    "soft":       {"stability": 0.40, "similarity_boost": 0.85, "style": 0.20},
    "urgent":     {"stability": 0.50, "similarity_boost": 0.75, "style": 0.55},
    "bold":       {"stability": 0.65, "similarity_boost": 0.80, "style": 0.65},
    "playful":    {"stability": 0.40, "similarity_boost": 0.75, "style": 0.50},
}
DEFAULT_VOICE_SETTINGS = {"stability": 0.5, "similarity_boost": 0.75, "style": 0.4}


async def _generate_elevenlabs(text: str, voice_id: str, language: str) -> bytes:
    cleaned_text = _strip_emotion_tags(text)

    # Detect dominant emotion from tags in original text
    emotion = _detect_dominant_emotion(text)
    settings = EMOTION_VOICE_SETTINGS.get(emotion, DEFAULT_VOICE_SETTINGS)
    logger.info(f"[vo] ElevenLabs emotion: {emotion} -> {settings}")

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(
            f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}",
            headers={
                "xi-api-key": ELEVENLABS_API_KEY,
                "Content-Type": "application/json",
            },
            json={
                "text": cleaned_text,
                "model_id": "eleven_multilingual_v2",
                "voice_settings": {
                    **settings,
                    "use_speaker_boost": True,
                },
            },
        )
        response.raise_for_status()
        return response.content


def _strip_emotion_tags(text: str) -> str:
    cleaned = re.sub(r"\[[^\]]+\]", "", text)
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    return cleaned


def _detect_dominant_emotion(text: str) -> str:
    """Find most common emotion tag in the text."""
    emotions = re.findall(r"\[(thoughtful|firm|warm|reassuring|declarative|soft|urgent|bold|playful)\]", text)
    if not emotions:
        return "thoughtful"
    # Return most frequent
    from collections import Counter
    return Counter(emotions).most_common(1)[0][0]


def hash_vo_request(text: str, language: str, voice_id: str, speed: float) -> str:
    payload = f"{text}|{language}|{voice_id}|{speed}"
    return hashlib.sha256(payload.encode()).hexdigest()[:16]
