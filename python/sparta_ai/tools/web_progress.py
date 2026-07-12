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


async def dispatch_progress(stage: str, tool_call_id: str | None = None, **kwargs: Any) -> None:
    """Emit a progress event via stdout (Electron) only.

    Uses a single channel to avoid duplicate events on the frontend.

    Args:
        stage: Progress stage ('searching', 'visiting', 'reading', 'done').
        tool_call_id: The LangChain tool call ID to scope progress per tool call.
            When provided, the frontend can write searchProgress into the correct
            ToolCall instead of a global message-level array. This fixes the bug
            where multiple searches in one turn would mix their results.
        **kwargs: Additional payload fields (url, title, query, etc.).
    """
    payload: dict[str, Any] = {"stage": stage, **kwargs}
    if tool_call_id:
        payload["tool_call_id"] = tool_call_id
    emit_direct(payload)