"""Handlers for on_tool_start, on_tool_end, and on_tool_error events."""
import logging
import uuid
from typing import Any, Callable

from sparta_ai.streaming.emitters import tool_events, reasoning_events
from sparta_ai.streaming.repetition_guard import RepetitionGuard
from sparta_ai.streaming.handlers.chat_model_stream import _extract_tool_output_str

logger = logging.getLogger("sparta_ai.streaming")


async def handle_tool_start(
    emit_fn: Callable[[str, dict], Any],
    emit_control_fn: Callable[[str, dict], Any],
    event: dict,
    data: dict,
    name: str,
    stream_state: dict,
    request_id: str,
    base_payload: dict,
) -> bool:
    tool_call_id = event.get("run_id", str(id(event)))
    tool_input = data.get("input", {})
    emit_control_fn(*tool_events.tool_called(base_payload, name, tool_input, tool_call_id))

    stream_state.setdefault("_rep_guard", RepetitionGuard()).reset_boundary()

    if name == "read_file_tool":
        file_path = tool_input.get("path", "") if isinstance(tool_input, dict) else ""
        if file_path:
            filename = file_path.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
            emit_control_fn(*reasoning_events.thinking_status(base_payload, f"Leyendo {filename}…"))
    elif name == "read_files_tool":
        file_paths = tool_input.get("paths", []) if isinstance(tool_input, dict) else []
        if file_paths:
            count = len(file_paths)
            emit_control_fn(*reasoning_events.thinking_status(base_payload, f"Leyendo {count} archivos…"))

    if name in ("write_file_tool", "patch_file_tool", "delete_file_tool"):
        file_path = tool_input.get("path", "") if isinstance(tool_input, dict) else ""
        if file_path:
            stream_state["_pending_file_path"] = file_path
    if name == "terminal_execute_tool":
        cmd = tool_input.get("command", "") if isinstance(tool_input, dict) else str(tool_input)
        stream_state["_pending_terminal_command"] = cmd
    elif name == "terminal_execute_background_tool":
        cmd = tool_input.get("command", "") if isinstance(tool_input, dict) else str(tool_input)
        label = tool_input.get("label") if isinstance(tool_input, dict) else None
        proc_id = f"bg-{uuid.uuid4().hex[:8]}"
        stream_state["_pending_terminal_proc"] = {"proc_id": proc_id, "command": cmd, "label": label}

    return False


async def handle_tool_end(
    emit_fn: Callable[[str, dict], Any],
    emit_control_fn: Callable[[str, dict], Any],
    event: dict,
    data: dict,
    name: str,
    stream_state: dict,
    request_id: str,
    base_payload: dict,
) -> bool:
    tool_call_id = event.get("run_id", "unknown")
    output_str = _extract_tool_output_str(data)
    emit_control_fn(*tool_events.tool_result(base_payload, name, output_str, data.get("run_time_ms", 0), tool_call_id))

    stream_state.setdefault("_rep_guard", RepetitionGuard()).reset_boundary()

    if name in ("write_file_tool", "patch_file_tool", "delete_file_tool"):
        file_path = stream_state.get("_pending_file_path", "")
        if file_path:
            emit_control_fn("file:changed", {"path": file_path})
            stream_state["_pending_file_path"] = ""

    if name == "terminal_execute_tool":
        cmd = stream_state.get("_pending_terminal_command", "")
        if cmd and "rechazado" not in output_str and "bloqueado" not in output_str:
            emit_control_fn("terminal:agent_command", {"command": cmd})
        stream_state["_pending_terminal_command"] = ""

    if name == "terminal_execute_background_tool":
        proc_info = stream_state.get("_pending_terminal_proc", {})
        if proc_info and "rechazado" not in output_str and "bloqueado" not in output_str:
            emit_control_fn("terminal:agent_spawn", proc_info)
        stream_state["_pending_terminal_proc"] = {}

    return False


async def handle_tool_error(
    emit_fn: Callable[[str, dict], Any],
    emit_control_fn: Callable[[str, dict], Any],
    event: dict,
    data: dict,
    name: str,
    stream_state: dict,
    request_id: str,
    base_payload: dict,
) -> bool:
    tool_call_id = event.get("run_id", "unknown")
    from sparta_ai.errors.user_messages import to_user_message
    raw_error = str(data.get("error", "Tool execution failed"))
    emit_control_fn(*tool_events.tool_error(
        base_payload, name, to_user_message(raw_error), tool_call_id,
    ))
    return False
