"""
Fish Audio TTS client wrapper.
"""
import requests
from typing import Optional

FISH_AUDIO_API_URL = "https://api.fish.audio/v1/tts"


class FishAudioClient:
    def __init__(self, api_key: str, default_voice_id: Optional[str] = None):
        self.api_key = api_key
        self.default_voice_id = default_voice_id or "fb8e07966f284b8bb3f486ec87f5b029"

    def generate_vo(
        self,
        text: str,
        voice_id: Optional[str] = None,
        speed: float = 0.95,
        output_path: Optional[str] = None,
    ) -> bytes:
        """Generate VO, return MP3 bytes."""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "model": "s2-pro",
        }

        payload = {
            "text": text,
            "reference_id": voice_id or self.default_voice_id,
            "temperature": 0.7,
            "top_p": 0.7,
            "prosody": {
                "speed": speed,
                "volume": 0,
                "normalize_loudness": True,
            },
            "format": "mp3",
            "sample_rate": 44100,
            "mp3_bitrate": 192,
        }

        response = requests.post(
            FISH_AUDIO_API_URL, json=payload, headers=headers, timeout=60
        )
        response.raise_for_status()

        audio_bytes = response.content

        if output_path:
            with open(output_path, "wb") as f:
                f.write(audio_bytes)

        return audio_bytes
