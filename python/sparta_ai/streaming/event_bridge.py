import sys
import json
import logging
from typing import Any, AsyncIterator

logger = logging.getLogger("sparta_ai.streaming")


async def stream_agent_to_electron(
    graph: Any,
    initial_state: dict,
    request_id: str,
) -> None:
    try:
        async for event in graph.astream_events(initial_state, version="v2"):
            await _dispatch_event(request_id, event)
    except Exception as e:
        logger.exception("Stream error")
        _emit(request_id, "error", {"code": "stream_error", "message": str(e)})
        _emit(request_id, "stream_end", {"error": str(e)})


async def _dispatch_event(request_id: str, event: dict) -> None:
    kind = event.get("event", "")
    data: dict = event.get("data", {})
    name: str = event.get("name", "")
    thinking_active = False

    if kind == "on_chat_model_stream":
        chunk = data.get("chunk")
        if chunk is None:
            return

        content = getattr(chunk, "content", "")
        if isinstance(content, list):
            for block in content:
                block_type = block.get("type", "")
                if block_type == "thinking":
                    if not thinking_active:
                        _emit(request_id, "thinking:started", {"session_id": "", "message_id": ""})
                        thinking_active = True
                    _emit(request_id, "thinking:token", {"token": block.get("thinking", "")})
                elif block_type == "text":
                    text = block.get("text", "")
                    if text:
                        _emit(request_id, "stream:token", {"token": text})
        elif isinstance(content, str) and content:
            _emit(request_id, "stream:token", {"token": content})

    elif kind == "on_chat_model_start":
        additional_kwargs = data.get("additional_kwargs", {})
        if additional_kwargs.get("thinking"):
            _emit(request_id, "thinking:started", {"session_id": "", "message_id": ""})
            thinking_active = True

    elif kind == "on_chat_model_end":
        output = data.get("output", {})
        usage_metadata = getattr(output, "usage_metadata", None)
        input_tokens = 0
        output_tokens = 0
        if usage_metadata:
            input_tokens = getattr(usage_metadata, "input_tokens", 0)
            output_tokens = getattr(usage_metadata, "output_tokens", 0)
            _emit(request_id, "usage", {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
            })
        # Close thinking if still active
        if thinking_active:
            _emit(request_id, "thinking:completed", {"tokens_used": output_tokens, "session_id": "", "message_id": ""})
            thinking_active = False

    elif kind == "on_tool_start":
        _emit(request_id, "tool:called", {
            "name": name,
            "input": data.get("input", {}),
        })

    elif kind == "on_tool_end":
        _emit(request_id, "tool:result", {
            "name": name,
            "output": str(data.get("output", "")),
            "duration_ms": data.get("run_time_ms", 0),
        })

    elif kind == "on_chain_end" and name == "agent":
        # Safety net: close thinking if still active at agent turn end
        if thinking_active:
            _emit(request_id, "thinking:completed", {"tokens_used": 0, "session_id": "", "message_id": ""})
            thinking_active = False
        _emit(request_id, "stream:completed", {})


def _emit(request_id: str, event: str, data: dict | None = None) -> None:
    msg: dict[str, Any] = {"id": request_id, "event": event}
    if data is not None:
        msg["data"] = data
    sys.stdout.write(json.dumps(msg, ensure_ascii=False) + "\n")
    sys.stdout.flush()
