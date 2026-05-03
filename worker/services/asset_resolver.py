"""
Asset resolver: search ES for music + SFX, download, upload to Supabase Storage.
"""
import hashlib
import logging
from datetime import datetime, timezone
from typing import Optional

from supabase import Client
from services.epidemic_sound import EpidemicSoundClient
import os

logger = logging.getLogger(__name__)

STORAGE_BUCKET = "studio-assets"


class AssetResolver:
    def __init__(self, supabase: Client):
        self.supabase = supabase
        self.es = EpidemicSoundClient(os.environ.get("EPIDEMIC_SOUND_API_KEY", ""))

    async def resolve(self, prompt_id: str):
        """Main entry: resolve all assets for an approved plan."""
        logger.info(f"[resolver] Starting asset resolution for {prompt_id}")

        try:
            # Fetch plan
            resp = (
                self.supabase.table("studio_prompts")
                .select("id, scene_plan, language")
                .eq("id", prompt_id)
                .single()
                .execute()
            )
            plan = resp.data
            if not plan or not plan.get("scene_plan"):
                logger.error(f"[resolver] No scene_plan for {prompt_id}")
                self._update_status(prompt_id, "failed", "No scene_plan found")
                return

            scene_plan = plan["scene_plan"]
            success_count = 0
            failure_count = 0

            # 1. Resolve main music track
            # Add template-specific music search modifier
            template_id = scene_plan.get("meta", {}).get("template") or scene_plan.get("meta", {}).get("videoType", "launch_v1")
            music_modifier = {
                "launch_v1": "",
                "marketing_niche": "hopeful warm",
                "testimonial": "warm intimate slow",
                "ad_short": "urgent driving energetic",
            }.get(template_id, "")

            music_query = scene_plan["audio"]["music"]["searchQuery"]
            if music_modifier:
                music_query = f"{music_query} {music_modifier}"
            music_mood = scene_plan["audio"]["music"].get("mood")
            music_bpm_min = scene_plan["audio"]["music"].get("bpmMin")
            music_bpm_max = scene_plan["audio"]["music"].get("bpmMax")
            music_volume = scene_plan["audio"]["mixLevels"]["musicBase"]

            if await self._resolve_single(
                prompt_id=prompt_id,
                asset_type="music",
                query=music_query,
                usage_context="music_main",
                scene_id=None,
                frame_offset=None,
                volume=music_volume,
                mood=music_mood,
                bpm_min=music_bpm_min,
                bpm_max=music_bpm_max,
            ):
                success_count += 1
            else:
                failure_count += 1
                logger.warning(f"[resolver] Music failed: '{music_query}'")

            # 2. Resolve SFX per scene
            for scene in scene_plan["scenes"]:
                sfx_requests = scene.get("audio", {}).get("sfxRequests") or []
                for idx, sfx in enumerate(sfx_requests):
                    context = f"sfx_{scene['id']}_{idx}"
                    if await self._resolve_single(
                        prompt_id=prompt_id,
                        asset_type="sfx",
                        query=sfx["searchTerm"],
                        usage_context=context,
                        scene_id=scene["id"],
                        frame_offset=sfx.get("frameOffset"),
                        volume=sfx.get("volume"),
                    ):
                        success_count += 1
                    else:
                        failure_count += 1
                        logger.warning(f"[resolver] SFX failed: '{sfx['searchTerm']}' for {scene['id']}")

            # Update final status
            if failure_count == 0:
                status = "ready"
            elif success_count > 0:
                status = "partial"
            else:
                status = "failed"

            self._update_status(
                prompt_id,
                status,
                f"{failure_count} assets failed" if failure_count > 0 else None,
            )
            logger.info(
                f"[resolver] Completed {prompt_id}: {success_count} ok, {failure_count} failed -> {status}"
            )

        except Exception as e:
            logger.exception(f"[resolver] Fatal error for {prompt_id}")
            self._update_status(prompt_id, "failed", str(e)[:500])

    async def _resolve_single(
        self,
        prompt_id: str,
        asset_type: str,
        query: str,
        usage_context: str,
        scene_id: Optional[str],
        frame_offset: Optional[int],
        volume: Optional[float],
        mood: Optional[str] = None,
        bpm_min: Optional[int] = None,
        bpm_max: Optional[int] = None,
    ) -> bool:
        """Resolve one asset: favorites → cache → search → download → store → link."""
        query_normalized = query.strip().lower()

        # Check favorites first — if a favorited track matches, prefer it
        try:
            fav_type = "music_track" if asset_type == "music" else "sfx"
            fav_resp = (
                self.supabase.table("studio_asset_favorites")
                .select("external_id, provider, name, metadata")
                .eq("asset_type", fav_type)
                .order("usage_count", desc=True)
                .limit(5)
                .execute()
            )
            if fav_resp.data:
                # Try to find a cached asset matching any favorite
                for fav in fav_resp.data:
                    if not fav.get("external_id"):
                        continue
                    fav_asset = (
                        self.supabase.table("studio_assets")
                        .select("id")
                        .eq("external_id", fav["external_id"])
                        .eq("asset_type", asset_type)
                        .eq("download_status", "ready")
                        .limit(1)
                        .execute()
                    )
                    if fav_asset.data:
                        logger.info(f"[resolver] FAVORITE HIT: '{fav['name']}' for {asset_type}")
                        self._link_asset(prompt_id, fav_asset.data[0]["id"], usage_context, scene_id, frame_offset, volume)
                        # Increment favorite usage
                        self.supabase.table("studio_asset_favorites").update(
                            {"usage_count": (fav.get("usage_count") or 0) + 1, "last_used_at": datetime.now(timezone.utc).isoformat()}
                        ).eq("external_id", fav["external_id"]).eq("asset_type", fav_type).execute()
                        return True
        except Exception as e:
            logger.warning(f"[resolver] Favorites check failed: {e}")

        # Check cache
        cache = (
            self.supabase.table("studio_assets")
            .select("id, used_in_runs")
            .eq("asset_type", asset_type)
            .eq("download_status", "ready")
            .ilike("title", f"%{query_normalized}%")
            .limit(1)
            .execute()
        )

        if cache.data:
            cached = cache.data[0]
            logger.info(f"[resolver] CACHE HIT for '{query}' -> {cached['id']}")
            self._link_asset(prompt_id, cached["id"], usage_context, scene_id, frame_offset, volume)
            self.supabase.table("studio_assets").update(
                {"last_used_at": datetime.now(timezone.utc).isoformat(), "used_in_runs": (cached.get("used_in_runs") or 0) + 1}
            ).eq("id", cached["id"]).execute()
            return True

        # Search Epidemic Sound
        logger.info(f"[resolver] Searching ES for '{query}' ({asset_type})")

        if asset_type == "music":
            results = await self.es.search_music(query, mood=mood, bpm_min=bpm_min, bpm_max=bpm_max)
        else:
            results = await self.es.search_sfx(query)

        # Fallback: if no results, try individual keywords (skip adjectives)
        if not results and " " in query:
            skip_words = {
                "subtle", "soft", "warm", "brief", "short", "long", "low",
                "high", "gentle", "quiet", "loud", "small", "big", "slow",
                "fast", "light", "heavy", "deep", "bright", "dark",
            }
            words = [w for w in query.split() if w.lower() not in skip_words]
            # Try pairs, then individual nouns
            attempts = []
            if len(words) >= 2:
                attempts.append(" ".join(words[:2]))
            attempts.extend(words)

            for fallback_query in attempts:
                logger.info(f"[resolver] Fallback search: '{fallback_query}'")
                if asset_type == "music":
                    results = await self.es.search_music(fallback_query)
                else:
                    results = await self.es.search_sfx(fallback_query)
                if results:
                    break

        if not results:
            logger.warning(f"[resolver] No results for '{query}' (even with fallback)")
            return False

        chosen = results[0]
        es_id = str(chosen.get("id", chosen.get("trackId", "")))

        # Check if this ES asset already downloaded (different search term)
        existing = (
            self.supabase.table("studio_assets")
            .select("id")
            .eq("external_id", es_id)
            .eq("source", "epidemic_sound")
            .eq("asset_type", asset_type)
            .eq("download_status", "ready")
            .limit(1)
            .execute()
        )

        if existing.data:
            logger.info(f"[resolver] ES asset {es_id} already cached")
            self._link_asset(prompt_id, existing.data[0]["id"], usage_context, scene_id, frame_offset, volume)
            return True

        # Download via CDN URL from search results
        download_url = chosen.get("download_url")
        if not download_url:
            logger.error(f"[resolver] No download URL for {es_id}")
            return False

        logger.info(f"[resolver] Downloading ES {asset_type} {es_id}: {chosen.get('title', 'untitled')}")
        audio_bytes = await self.es.download_audio(download_url)

        if not audio_bytes:
            logger.error(f"[resolver] Download failed for {es_id}")
            return False

        # Upload to Supabase Storage
        file_hash = hashlib.sha256(audio_bytes).hexdigest()[:16]
        storage_path = f"{asset_type}/{file_hash}.mp3"

        try:
            self.supabase.storage.from_(STORAGE_BUCKET).upload(
                storage_path,
                audio_bytes,
                file_options={"content-type": "audio/mpeg", "upsert": "true"},
            )
        except Exception as e:
            logger.error(f"[resolver] Storage upload failed: {e}")
            return False

        # Create or update asset row (upsert on source+external_id)
        asset_row = (
            self.supabase.table("studio_assets")
            .upsert(
                {
                    "source": "epidemic_sound",
                    "external_id": es_id,
                    "asset_type": asset_type,
                    "title": chosen.get("title"),
                    "duration_ms": int(chosen.get("duration", chosen.get("duration_seconds", 0)) * 1000),
                    "bpm": chosen.get("bpm"),
                    "mood": chosen.get("mood") or mood,
                    "tags": chosen.get("genres", []),
                    "supabase_storage_path": storage_path,
                    "download_status": "ready",
                    "used_in_runs": 1,
                },
                on_conflict="source,external_id",
            )
            .execute()
        )

        if not asset_row.data:
            logger.error("[resolver] Failed to insert studio_assets row")
            return False

        asset_id = asset_row.data[0]["id"]
        self._link_asset(prompt_id, asset_id, usage_context, scene_id, frame_offset, volume)

        logger.info(f"[resolver] Stored asset {asset_id} ({storage_path})")
        return True

    def _link_asset(
        self,
        prompt_id: str,
        asset_id: str,
        usage_context: str,
        scene_id: Optional[str],
        frame_offset: Optional[int],
        volume: Optional[float],
    ):
        """Insert junction row."""
        try:
            self.supabase.table("studio_prompt_assets").upsert(
                {
                    "prompt_id": prompt_id,
                    "asset_id": asset_id,
                    "usage_context": usage_context,
                    "scene_id": scene_id,
                    "frame_offset": frame_offset,
                    "volume": volume,
                },
                on_conflict="prompt_id,usage_context",
            ).execute()
        except Exception as e:
            logger.warning(f"[resolver] Link failed: {e}")

    def _update_status(self, prompt_id: str, status: str, error: Optional[str] = None):
        """Update prompt assets_status."""
        update: dict = {
            "assets_status": status,
            "assets_completed_at": datetime.now(timezone.utc).isoformat(),
        }
        if error:
            update["assets_error"] = error
        self.supabase.table("studio_prompts").update(update).eq("id", prompt_id).execute()
