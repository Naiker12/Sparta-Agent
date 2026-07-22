"""Handler for on_custom_event — search progress, thinking status, subagent lifecycle."""
from typing import Any, Callable

from sparta_streaming.emitters import search_events, reasoning_events


async def handle_custom_event(
    emit_fn: Callable[[str, dict], Any],
    emit_control_fn: Callable[[str, dict], Any],
    event: dict,
    data: dict,
    name: str,
    stream_state: dict,
    request_id: str,
    base_payload: dict,
) -> bool:
    if name == "tool_progress":
        emit_control_fn(*search_events.search_progress(base_payload, data))
    elif name == "thinking:status":
        text = data.get("text") if isinstance(data, dict) else None
        if text:
            emit_control_fn(*reasoning_events.thinking_status(base_payload, text))
    elif name in ("subagent:started", "subagent:thinking", "subagent:completed"):
        from sparta_streaming.emitters import subagent_events
        if isinstance(data, dict):
            sub_name = data.get("subagentName", "")
            if name == "subagent:started":
                emit_control_fn(*subagent_events.subagent_started(base_payload, sub_name, data.get("taskSummary", "")))
            elif name == "subagent:thinking":
                emit_control_fn(*subagent_events.subagent_thinking(base_payload, sub_name, data.get("statusText", "")))
            elif name == "subagent:completed":
                emit_control_fn(*subagent_events.subagent_completed(base_payload, sub_name, data.get("durationMs", 0), data.get("success", False)))
    return False
