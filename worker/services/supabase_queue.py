"""
Supabase as job queue.
Fetches pending jobs, updates status.
"""
from datetime import datetime, timezone
from typing import Optional, Dict, Any

from supabase import Client


class SupabaseQueue:
    def __init__(self, supabase: Client):
        self.supabase = supabase

    def fetch_next_pending(self) -> Optional[Dict[str, Any]]:
        """
        Fetch oldest pending run and atomically claim it.
        Returns None if no pending jobs.
        """
        response = (
            self.supabase.table("studio_video_runs")
            .select("*")
            .eq("status", "pending")
            .order("created_at", desc=False)
            .limit(1)
            .execute()
        )

        if not response.data:
            return None

        job = response.data[0]

        # Atomically claim: update only if still pending
        update_response = (
            self.supabase.table("studio_video_runs")
            .update(
                {
                    "status": "planning",
                    "started_at": datetime.now(timezone.utc).isoformat(),
                    "progress_percent": 5,
                }
            )
            .eq("id", job["id"])
            .eq("status", "pending")
            .execute()
        )

        if not update_response.data:
            return None

        return update_response.data[0]

    def update_status(
        self,
        run_id: str,
        status: str,
        progress: Optional[int] = None,
        step: Optional[str] = None,
        error_message: Optional[str] = None,
        extra_fields: Optional[Dict[str, Any]] = None,
    ):
        """Update run status and optional fields."""
        update_data: Dict[str, Any] = {"status": status}

        if progress is not None:
            update_data["progress_percent"] = progress
        if step:
            update_data["current_step"] = step
        if error_message:
            update_data["error_message"] = error_message
        if extra_fields:
            update_data.update(extra_fields)

        self.supabase.table("studio_video_runs").update(update_data).eq(
            "id", run_id
        ).execute()
