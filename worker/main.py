"""
Vocito Studio Worker
Polls Supabase for pending video runs and processes them.
"""
import os
import time
import logging
from datetime import datetime, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading
import json

from supabase import create_client, Client
from services.supabase_queue import SupabaseQueue

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
logger = logging.getLogger(__name__)

SUPABASE_URL = os.environ["SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_KEY"]
POLL_INTERVAL_SECONDS = int(os.environ.get("POLL_INTERVAL_SECONDS", "5"))
PORT = int(os.environ.get("PORT", "8080"))


class HealthHandler(BaseHTTPRequestHandler):
    """Simple health check HTTP server for Railway."""

    def do_GET(self):
        if self.path == "/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(
                json.dumps({"status": "ok", "service": "vocito-studio-worker"}).encode()
            )
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # Suppress default logging


def start_health_server():
    server = HTTPServer(("0.0.0.0", PORT), HealthHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    logger.info(f"Health server running on port {PORT}")


def process_job(job, queue):
    """
    Process a single video run job.
    Placeholder — real logic comes in Brief B.
    """
    run_id = job["id"]

    try:
        queue.update_status(run_id, "planning", progress=10, step="Initializing")
        time.sleep(2)

        queue.update_status(run_id, "downloading", progress=30, step="Placeholder download")
        time.sleep(2)

        queue.update_status(run_id, "generating_vo", progress=50, step="Placeholder VO gen")
        time.sleep(2)

        queue.update_status(run_id, "rendering", progress=70, step="Placeholder render")
        time.sleep(2)

        queue.update_status(run_id, "uploading", progress=90, step="Placeholder upload")
        time.sleep(2)

        queue.update_status(
            run_id,
            "completed",
            progress=100,
            step="Done",
            extra_fields={
                "output_url": "https://example.com/placeholder.mp4",
                "duration_seconds": 33.0,
                "completed_at": datetime.now(timezone.utc).isoformat(),
            },
        )
        logger.info(f"Job {run_id} completed (placeholder)")

    except Exception as e:
        logger.error(f"Job {run_id} failed: {e}", exc_info=True)
        queue.update_status(run_id, "failed", error_message=str(e))


def main():
    logger.info("Vocito Studio Worker starting...")

    # Start health check server
    start_health_server()

    supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
    queue = SupabaseQueue(supabase)

    logger.info("All clients initialized. Starting poll loop.")

    while True:
        try:
            job = queue.fetch_next_pending()

            if job:
                logger.info(f"Processing job {job['id']}")
                process_job(job, queue)
            else:
                time.sleep(POLL_INTERVAL_SECONDS)
        except KeyboardInterrupt:
            logger.info("Shutting down...")
            break
        except Exception as e:
            logger.error(f"Poll loop error: {e}", exc_info=True)
            time.sleep(POLL_INTERVAL_SECONDS)


if __name__ == "__main__":
    main()
