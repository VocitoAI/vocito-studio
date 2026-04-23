"""
Remotion rendering wrapper.
Placeholder — real renders come in Brief B.
"""
import subprocess
import json
from typing import Dict, Any


class RemotionRenderer:
    def __init__(self, project_path: str):
        self.project_path = project_path

    def render(
        self,
        composition_id: str,
        output_path: str,
        props: Dict[str, Any],
    ) -> str:
        """Run remotion render via subprocess. Returns output path."""
        props_json = json.dumps(props)

        cmd = [
            "npx",
            "remotion",
            "render",
            composition_id,
            output_path,
            f"--props={props_json}",
        ]

        result = subprocess.run(
            cmd,
            cwd=self.project_path,
            capture_output=True,
            text=True,
            timeout=600,
        )

        if result.returncode != 0:
            raise RuntimeError(f"Remotion render failed: {result.stderr}")

        return output_path
