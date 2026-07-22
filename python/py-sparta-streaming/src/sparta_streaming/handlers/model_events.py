"""Handlers for on_chat_model_start and on_chat_model_end events."""
from typing import Any, Callable

from sparta_streaming.emitters import reasoning_events, usage_events


async def handle_model_start(
    emit_fn: Callable[[str, dict], Any],
    emit_control_fn: Callable[[str, dict], Any],
    event: dict,
    data: dict,
    name: str,
    stream_state: dict,
    request_id: str,
    base_payload: dict,
) -> bool:
    additional_kwargs = data.get("additional_kwargs", {})
    if additional_kwargs.get("thinking"):
        if not stream_state["thinking_active"]:
            emit_control_fn(*reasoning_events.thinking_started(base_payload))
            stream_state["thinking_active"] = True
    return False


async def handle_model_end(
    emit_fn: Callable[[str, dict], Any],
    emit_control_fn: Callable[[str, dict], Any],
    event: dict,
    data: dict,
    name: str,
    stream_state: dict,
    request_id: str,
    base_payload: dict,
) -> bool:
    output = data.get("output", {})
    usage_metadata = getattr(output, "usage_metadata", None)
    input_tokens = 0
    output_tokens = 0
    if usage_metadata:
        input_tokens = getattr(usage_metadata, "input_tokens", 0)
        output_tokens = getattr(usage_metadata, "output_tokens", 0)
        emit_control_fn(*usage_events.usage(base_payload, input_tokens, output_tokens))
    if stream_state["thinking_active"]:
        emit_control_fn(*reasoning_events.thinking_completed(base_payload, output_tokens))
        stream_state["thinking_active"] = False
    scrubber = stream_state.get("_scrubber")
    if scrubber:
        leftover = scrubber.flush()
        if leftover:
            stream_state["visible_chars"] = stream_state.get("visible_chars", 0) + len(leftover)
            emit_fn("stream:token", {**base_payload, "token": leftover})
    return False
