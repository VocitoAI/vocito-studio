"""
Epidemic Sound REST API client.
Uses partner-content-api for search + download.
"""
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

# ES Partner Content API
ES_BASE = "https://partner-content-api.epidemicsound.com/v0"


class EpidemicSoundClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Accept": "application/json",
        }

    async def search_music(
        self,
        query: str,
        mood: Optional[str] = None,
        bpm_min: Optional[int] = None,
        bpm_max: Optional[int] = None,
        limit: int = 5,
    ) -> list[dict]:
        """Search music tracks."""
        params: dict = {"term": query, "limit": limit}
        if mood:
            params["mood"] = mood
        if bpm_min:
            params["bpm_min"] = bpm_min
        if bpm_max:
            params["bpm_max"] = bpm_max

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{ES_BASE}/tracks/search",
                params=params,
                headers=self.headers,
            )

            if resp.status_code == 401:
                logger.error("[ES] API key expired or invalid (401)")
                return []
            if resp.status_code == 429:
                logger.warning("[ES] Rate limited (429)")
                return []
            if resp.status_code != 200:
                logger.error(f"[ES] Search music failed: {resp.status_code} {resp.text[:200]}")
                return []

            data = resp.json()
            return data.get("tracks", data.get("results", []))

    async def search_sfx(
        self,
        query: str,
        limit: int = 5,
    ) -> list[dict]:
        """Search sound effects."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{ES_BASE}/sound-effects/search",
                params={"term": query, "limit": limit},
                headers=self.headers,
            )

            if resp.status_code != 200:
                logger.error(f"[ES] Search SFX failed: {resp.status_code} {resp.text[:200]}")
                return []

            data = resp.json()
            return data.get("sound_effects", data.get("results", []))

    async def download_track(self, track_id: str) -> Optional[bytes]:
        """Download a music track. Returns audio bytes or None."""
        async with httpx.AsyncClient(timeout=60.0) as client:
            # Get download URL
            resp = await client.get(
                f"{ES_BASE}/tracks/{track_id}/download",
                headers=self.headers,
                params={"format": "mp3", "quality": "high"},
            )

            if resp.status_code != 200:
                logger.error(f"[ES] Download URL failed for track {track_id}: {resp.status_code}")
                return None

            download_url = resp.json().get("download_url") or resp.json().get("url")
            if not download_url:
                # Some ES API versions return the audio directly
                if resp.headers.get("content-type", "").startswith("audio/"):
                    return resp.content
                logger.error(f"[ES] No download URL in response for track {track_id}")
                return None

            # Download the file
            audio_resp = await client.get(download_url, timeout=120.0)
            audio_resp.raise_for_status()
            return audio_resp.content

    async def download_sfx(self, sfx_id: str) -> Optional[bytes]:
        """Download a sound effect. Returns audio bytes or None."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                f"{ES_BASE}/sound-effects/{sfx_id}/download",
                headers=self.headers,
                params={"format": "mp3"},
            )

            if resp.status_code != 200:
                logger.error(f"[ES] Download SFX failed for {sfx_id}: {resp.status_code}")
                return None

            download_url = resp.json().get("download_url") or resp.json().get("url")
            if not download_url:
                if resp.headers.get("content-type", "").startswith("audio/"):
                    return resp.content
                return None

            audio_resp = await client.get(download_url, timeout=60.0)
            audio_resp.raise_for_status()
            return audio_resp.content
