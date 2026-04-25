"""
VoiceRouter: chooses VO provider based on language.
- EN → Fish Audio (better emotion control via inline tags)
- NL/DE → ElevenLabs v2 multilingual
"""
import os
import re
import hashlib
import logging
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


def select_provider(language: str) -> tuple[str, str]:
    if language == "en":
        return ("fish_audio", VOICE_IDS["fish_audio"]["en"])
    elif language in ("nl", "de"):
        return ("elevenlabs", VOICE_IDS["elevenlabs"][language])
    else:
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


async def _generate_elevenlabs(text: str, voice_id: str, language: str) -> bytes:
    cleaned_text = _strip_emotion_tags(text)

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
                    "stability": 0.5,
                    "similarity_boost": 0.75,
                    "style": 0.4,
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


def hash_vo_request(text: str, language: str, voice_id: str, speed: float) -> str:
    payload = f"{text}|{language}|{voice_id}|{speed}"
    return hashlib.sha256(payload.encode()).hexdigest()[:16]
