"""
Epidemic Sound client wrapper.
Placeholder for A3 — real MCP calls come in Brief B.
"""
from typing import Dict, Any

ES_MCP_URL = "https://www.epidemicsound.com/a/mcp-service/mcp"


class EpidemicSoundClient:
    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        }

    def search_music(self, query: str, **filters) -> Dict[str, Any]:
        raise NotImplementedError("Implemented in Brief B")

    def search_sound_effects(self, search_term: str, **filters) -> Dict[str, Any]:
        raise NotImplementedError("Implemented in Brief B")

    def download_music(self, recording_id: str, format: str = "MP3") -> str:
        raise NotImplementedError("Implemented in Brief B")

    def health_check(self) -> bool:
        return bool(self.api_key)
