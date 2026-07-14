"""WebSocket camelCase payload adapter."""
from typing import Any

_WS_CAMEL_MAP: dict[str, str] = {
    "tokens_used": "tokensUsed",
    "tool_call_id": "toolCallId",
    "duration_ms": "durationMs",
    "input_tokens": "inputTokens",
    "output_tokens": "outputTokens",
}


def _ws_adapt(event_type: str, data: dict) -> dict:
    """Convert snake_case payload to camelCase for WebSocket clients.

    The Electron IPC layer (chat.ipc.ts) handles this conversion for the
    stdout path; for WebSocket we do it here.
    """
    if event_type == "tool:called" and "name" in data:
        adapted = {k: v for k, v in data.items() if k not in ("name", "input", "tool_call_id")}
        adapted["toolCall"] = {
            "id": data.get("tool_call_id", ""),
            "toolName": data.get("name", ""),
            "input": data.get("input", {}),
            "status": "running",
        }
        return adapted
    return {_WS_CAMEL_MAP.get(k, k): v for k, v in data.items()}
