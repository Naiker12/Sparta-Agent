"""Handlers for on_chain_start and on_chain_end events."""
import logging
from typing import Any, Callable

from sparta_ai.streaming.emitters import reasoning_events

logger = logging.getLogger("sparta_ai.streaming")

_STATUS_MAP = {
    "planner": "Analizando la tarea y generando plan…",
    "agent": "Razonando sobre el siguiente paso…",
    "tools": "Ejecutando herramientas…",
    "subagent_coordinator": "Delegando tarea al especialista…",
}


async def handle_chain_start(
    emit_fn: Callable[[str, dict], Any],
    emit_control_fn: Callable[[str, dict], Any],
    event: dict,
    data: dict,
    name: str,
    stream_state: dict,
    request_id: str,
    base_payload: dict,
) -> bool:
    status_text = _STATUS_MAP.get(name)
    if status_text:
        emit_control_fn(*reasoning_events.thinking_status(base_payload, status_text))
    return False


async def handle_chain_end(
    emit_fn: Callable[[str, dict], Any],
    emit_control_fn: Callable[[str, dict], Any],
    event: dict,
    data: dict,
    name: str,
    stream_state: dict,
    request_id: str,
    base_payload: dict,
) -> bool:
    if name not in ("agent", "tools", "subagent_coordinator"):
        return False

    output = data.get("output", {})
    if isinstance(output, dict):
        plan = output.get("plan", [])
        if plan:
            if not stream_state.get("_plan_seen"):
                stream_state["_plan_seen"] = True
                emit_control_fn("plan:created", {
                    **base_payload,
                    "plan": plan,
                    "current_step": output.get("current_step", 0),
                    "plan_complete": output.get("plan_complete", False),
                })
            elif name in ("tools", "subagent_coordinator"):
                emit_control_fn("plan:step", {
                    **base_payload,
                    "plan": plan,
                    "current_step": output.get("current_step", 0),
                    "plan_complete": output.get("plan_complete", False),
                })

    if name != "agent":
        return False
    if stream_state.get("_stream_completed"):
        return False

    output = data.get("output", {})
    output_messages = output.get("messages", []) if isinstance(output, dict) else []
    last_output_msg = output_messages[-1] if output_messages else None
    has_pending_tool_calls = bool(getattr(last_output_msg, "tool_calls", None))
    if has_pending_tool_calls:
        logger.debug(
            "on_chain_end/agent: pending tool calls detected, skipping completion for request %s",
            request_id,
        )
        return False

    if stream_state["thinking_active"]:
        emit_control_fn(*reasoning_events.thinking_completed(base_payload, 0))
        stream_state["thinking_active"] = False
    if stream_state.get("visible_chars", 0) == 0:
        emit_control_fn(
            "error",
            {"code": "empty_response", "message": "El modelo no devolvió contenido visible."},
        )
        stream_state["_stream_completed"] = True
        return False
    completed_payload = {**base_payload}
    suggestions = output.get("suggestions") if isinstance(output, dict) else None
    if suggestions:
        completed_payload["suggestions"] = suggestions
    emit_control_fn("stream:completed", completed_payload)
    stream_state["_stream_completed"] = True
    return False
