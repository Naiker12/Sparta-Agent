import json
import logging
import os
import sys
from typing import Any

logger = logging.getLogger("sparta_ai.tools.web_progress")

_IS_ELECTRON = "SPARTA_ELECTRON" in os.environ


def emit_direct(data: dict) -> None:
    """Write search progress directly to stdout (Electron sidecar)."""
    if not _IS_ELECTRON:
        return
    msg = json.dumps({"event": "search:progress", "data": data}, ensure_ascii=False)
    sys.stdout.write(msg + "\n")
    sys.stdout.flush()


async def dispatch_progress(stage: str, **kwargs: Any) -> None:
    """Emit a progress event via stdout (Electron) only.

    Uses a single channel to avoid duplicate events on the frontend.
    """
    payload = {"stage": stage, **kwargs}
    emit_direct(payload)
