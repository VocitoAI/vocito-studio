"""
Epidemic Sound web API client.
Uses the epidemicsound.com/json/search endpoints with Bearer auth.
Downloads use CDN lqMp3Url from search results (no auth required).
"""
import logging
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

ES_SEARCH_TRACKS = "https://www.epidemicsound.com/json/search/tracks/"
ES_SEARCH_SFX = "https://www.epidemicsound.com/json/search/sfx/"


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
        """Search music tracks. Returns list of normalized track dicts."""
        params: dict = {"term": query, "limit": limit}

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                ES_SEARCH_TRACKS,
                params=params,
                headers=self.headers,
                follow_redirects=True,
            )

            if resp.status_code == 401:
                logger.error("[ES] API key expired or invalid (401)")
                return []
            if resp.status_code != 200:
                logger.error(f"[ES] Search music failed: {resp.status_code}")
                return []

            data = resp.json()
            tracks_dict = data.get("entities", {}).get("tracks", {})
            hits = data.get("meta", {}).get("hits", [])

            results = []
            for hit in hits[:limit]:
                track_id = str(hit.get("trackId", ""))
                track = tracks_dict.get(track_id, {})
                if not track:
                    continue

                mp3_url = track.get("stems", {}).get("full", {}).get("lqMp3Url")
                if not mp3_url:
                    continue

                results.append({
                    "id": track_id,
                    "title": track.get("title", ""),
                    "artist": ", ".join(
                        a.get("name", "")
                        for a in track.get("creatives", {}).get("mainArtists", [])
                    ),
                    "duration_seconds": track.get("length", 0),
                    "bpm": track.get("bpm"),
                    "mood": ", ".join(
                        m.get("displayTag", "") for m in track.get("moods", [])
                    ),
                    "genres": [
                        g.get("displayTag", "") for g in track.get("genres", [])
                    ],
                    "has_vocals": track.get("hasVocals", False),
                    "energy": track.get("energyLevel", ""),
                    "download_url": mp3_url,
                })

            logger.info(f"[ES] Music search '{query}': {len(results)} results")
            return results

    async def search_sfx(
        self,
        query: str,
        limit: int = 5,
    ) -> list[dict]:
        """Search sound effects. Returns list of normalized SFX dicts."""
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.get(
                ES_SEARCH_SFX,
                params={"term": query, "limit": limit},
                headers=self.headers,
                follow_redirects=True,
            )

            if resp.status_code != 200:
                logger.error(f"[ES] Search SFX failed: {resp.status_code}")
                return []

            data = resp.json()
            # SFX endpoint returns entities under "tracks" (same as music)
            sfx_dict = data.get("entities", {}).get("tracks", data.get("entities", {}).get("sfx", {}))
            hits = data.get("meta", {}).get("hits", [])

            results = []
            for hit in hits[:limit]:
                sfx_id = str(hit.get("trackId", hit.get("sfxId", "")))
                sfx = sfx_dict.get(sfx_id, {})
                if not sfx:
                    continue

                mp3_url = sfx.get("stems", {}).get("full", {}).get("lqMp3Url")
                if not mp3_url:
                    continue

                results.append({
                    "id": sfx_id,
                    "title": sfx.get("title", ""),
                    "duration_seconds": sfx.get("length", 0),
                    "download_url": mp3_url,
                })

            logger.info(f"[ES] SFX search '{query}': {len(results)} results")
            return results

    async def download_audio(self, url: str) -> Optional[bytes]:
        """Download audio from CDN URL."""
        async with httpx.AsyncClient(timeout=60.0) as client:
            resp = await client.get(url, follow_redirects=True)
            if resp.status_code != 200:
                logger.error(f"[ES] Download failed: {resp.status_code} for {url[:80]}")
                return None
            return resp.content
