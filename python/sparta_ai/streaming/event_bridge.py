import sys
import json
import logging
from typing import Any, AsyncIterator

logger = logging.getLogger("sparta_ai.streaming")


def _extract_namespace(event: dict) -> str:
    """Return the LangGraph namespace (e.g. ['agent', 'subagent_coordinator', 'agent'])."""
    metadata = event.get("metadata", {})
    ns = metadata.get("langgraph_node") or metadata.get("checkpoint_ns") or ""
    if isinstance(ns, list):
        return "/".join(str(p) for p in ns)
    return str(ns)


def _emit(request_id: str, event: str, data: dict | None = None) -> None:
    msg: dict[str, Any] = {"id": request_id, "event": event}
    if data is not None:
        msg["data"] = data
    try:
        sys.stdout.write(json.dumps(msg, ensure_ascii=False) + "\n")
        sys.stdout.flush()
    except (BrokenPipeError, OSError):
        # Parent process closed the pipe; exit cleanly instead of crashing.
        sys.exit(0)


def _is_reasoning_block(block: Any) -> bool:
    """Detect typed content blocks that represent model reasoning/thinking."""
    if not isinstance(block, dict):
        return False
    block_type = block.get("type", "")
    return block_type in ("thinking", "reasoning")


def _is_text_block(block: Any) -> bool:
    if not isinstance(block, dict):
        return False
    return block.get("type", "") == "text"


def _block_text(block: dict) -> str:
    """Return the textual content of a typed block."""
    for key in ("thinking", "reasoning", "text", "content"):
        val = block.get(key)
        if isinstance(val, str):
            return val
    return ""


def _extract_reasoning_content(chunk: Any) -> str:
    """Extract reasoning content from providers that put it outside content blocks
    (e.g. DeepSeek / OpenRouter / Qwen via OpenAI-compatible APIs)."""
    for attr in ("additional_kwargs", "response_metadata"):
        meta = getattr(chunk, attr, None)
        if isinstance(meta, dict):
            for key in ("reasoning_content", "reasoning"):
                val = meta.get(key)
                if isinstance(val, str) and val:
                    return val
    return ""


async def stream_agent_to_electron(
    graph: Any,
    initial_state: dict,
    request_id: str,
) -> None:
    # Mutable state so thinking flag persists across separate astream_events events.
    stream_state = {"thinking_active": False}
    try:
        async for event in graph.astream_events(initial_state, version="v2"):
            await _dispatch_event(request_id, event, stream_state)
    except Exception as e:
        logger.exception("Stream error")
        _emit(request_id, "error", {"code": "stream_error", "message": str(e)})
        _emit(request_id, "stream_end", {"error": str(e)})


async def _dispatch_event(request_id: str, event: dict, stream_state: dict) -> None:
    kind = event.get("event", "")
    data: dict = event.get("data", {})
    name: str = event.get("name", "")
    namespace = _extract_namespace(event)
    base_payload = {"ns": namespace} if namespace else {}

    if kind == "on_chat_model_stream":
        chunk = data.get("chunk")
        if chunk is None:
            return

        # Some OpenAI-compatible providers expose reasoning in metadata rather than content blocks.
        reasoning_content = _extract_reasoning_content(chunk)
        if reasoning_content:
            if not stream_state["thinking_active"]:
                logger.debug("Emitting thinking:started for request %s", request_id)
                _emit(request_id, "thinking:started", {**base_payload})
                stream_state["thinking_active"] = True
            logger.debug("Emitting thinking:token (reasoning_content) for request %s", request_id)
            _emit(request_id, "thinking:token", {**base_payload, "token": reasoning_content})

        content = getattr(chunk, "content", "")
        if isinstance(content, list):
            for block in content:
                if _is_reasoning_block(block):
                    if not stream_state["thinking_active"]:
                        logger.debug("Emitting thinking:started for request %s", request_id)
                        _emit(request_id, "thinking:started", {**base_payload})
                        stream_state["thinking_active"] = True
                    token = _block_text(block)
                    if token:
                        logger.debug("Emitting thinking:token (reasoning block) for request %s", request_id)
                        _emit(request_id, "thinking:token", {**base_payload, "token": token})
                elif _is_text_block(block):
                    text = _block_text(block)
                    if text:
                        _emit(request_id, "stream:token", {**base_payload, "token": text})
                elif isinstance(block, dict) and block.get("type") == "tool_use":
                    # Anthropic tool_use blocks are part of the assistant message,
                    # not streamed tokens; ignore here.
                    continue
        elif isinstance(content, str) and content:
            _emit(request_id, "stream:token", {**base_payload, "token": content})

    elif kind == "on_chat_model_start":
        additional_kwargs = data.get("additional_kwargs", {})
        if additional_kwargs.get("thinking"):
            if not stream_state["thinking_active"]:
                _emit(request_id, "thinking:started", {**base_payload})
                stream_state["thinking_active"] = True

    elif kind == "on_chat_model_end":
        output = data.get("output", {})
        usage_metadata = getattr(output, "usage_metadata", None)
        input_tokens = 0
        output_tokens = 0
        if usage_metadata:
            input_tokens = getattr(usage_metadata, "input_tokens", 0)
            output_tokens = getattr(usage_metadata, "output_tokens", 0)
            _emit(request_id, "usage", {
                **base_payload,
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
            })
        if stream_state["thinking_active"]:
            _emit(request_id, "thinking:completed", {**base_payload, "tokens_used": output_tokens})
            stream_state["thinking_active"] = False

    elif kind == "on_tool_start":
        _emit(request_id, "tool:called", {
            **base_payload,
            "name": name,
            "input": data.get("input", {}),
        })

    elif kind == "on_tool_end":
        _emit(request_id, "tool:result", {
            **base_payload,
            "name": name,
            "output": str(data.get("output", "")),
            "duration_ms": data.get("run_time_ms", 0),
        })

    elif kind == "on_chain_end" and name == "agent":
        if stream_state["thinking_active"]:
            _emit(request_id, "thinking:completed", {**base_payload, "tokens_used": 0})
            stream_state["thinking_active"] = False
        _emit(request_id, "stream:completed", base_payload)


async def stream_agent_to_websocket(
    graph: Any,
    initial_state: dict,
    websocket: Any,
    request_id: str,
    session_id: str = "",
    message_id: str = "",
) -> None:
    """
    Run the LangGraph and emit events via WebSocket.
    Events are sent in the format the renderer expects:
    {"type": "stream:token", "token": "...", "sessionId": "...", "messageId": "..."}
    """
    stream_state = {"thinking_active": False}
    try:
        async for event in graph.astream_events(initial_state, version="v2"):
            await _dispatch_event_ws(websocket, request_id, event, session_id, message_id, stream_state)
    except Exception as e:
        logger.exception("Stream error")
        await _emit_ws_renderer(websocket, "stream:error", {
            "error": str(e),
            "sessionId": session_id,
            "messageId": message_id,
        })


async def _dispatch_event_ws(
    websocket: Any, request_id: str, event: dict,
    session_id: str = "", message_id: str = "",
    stream_state: dict | None = None,
) -> None:
    if stream_state is None:
        stream_state = {"thinking_active": False}

    kind = event.get("event", "")
    data: dict = event.get("data", {})
    name: str = event.get("name", "")
    namespace = _extract_namespace(event)
    base_payload = {"sessionId": session_id, "messageId": message_id}
    if namespace:
        base_payload["ns"] = namespace

    if kind == "on_chat_model_stream":
        chunk = data.get("chunk")
        if chunk is None:
            return

        reasoning_content = _extract_reasoning_content(chunk)
        if reasoning_content:
            if not stream_state["thinking_active"]:
                await _emit_ws_renderer(websocket, "thinking:started", base_payload)
                stream_state["thinking_active"] = True
            await _emit_ws_renderer(websocket, "thinking:token", {
                **base_payload, "token": reasoning_content,
            })

        content = getattr(chunk, "content", "")
        if isinstance(content, list):
            for block in content:
                if _is_reasoning_block(block):
                    if not stream_state["thinking_active"]:
                        await _emit_ws_renderer(websocket, "thinking:started", base_payload)
                        stream_state["thinking_active"] = True
                    token = _block_text(block)
                    if token:
                        await _emit_ws_renderer(websocket, "thinking:token", {
                            **base_payload, "token": token,
                        })
                elif _is_text_block(block):
                    text = _block_text(block)
                    if text:
                        await _emit_ws_renderer(websocket, "stream:token", {
                            **base_payload, "token": text,
                        })
        elif isinstance(content, str) and content:
            await _emit_ws_renderer(websocket, "stream:token", {
                **base_payload, "token": content,
            })

    elif kind == "on_chat_model_start":
        additional_kwargs = data.get("additional_kwargs", {})
        if additional_kwargs.get("thinking"):
            if not stream_state["thinking_active"]:
                await _emit_ws_renderer(websocket, "thinking:started", base_payload)
                stream_state["thinking_active"] = True

    elif kind == "on_chat_model_end":
        output = data.get("output", {})
        usage_metadata = getattr(output, "usage_metadata", None)
        input_tokens = 0
        output_tokens = 0
        if usage_metadata:
            input_tokens = getattr(usage_metadata, "input_tokens", 0)
            output_tokens = getattr(usage_metadata, "output_tokens", 0)
            await _emit_ws_renderer(websocket, "usage", {
                **base_payload,
                "inputTokens": input_tokens,
                "outputTokens": output_tokens,
            })
        if stream_state["thinking_active"]:
            await _emit_ws_renderer(websocket, "thinking:completed", {
                **base_payload, "tokensUsed": output_tokens,
            })
            stream_state["thinking_active"] = False

    elif kind == "on_tool_start":
        await _emit_ws_renderer(websocket, "tool:called", {
            **base_payload,
            "toolCall": {
                "id": "",
                "toolName": name,
                "input": data.get("input", {}),
                "status": "running",
            },
        })

    elif kind == "on_tool_end":
        await _emit_ws_renderer(websocket, "tool:result", {
            **base_payload,
            "toolCallId": "",
            "output": str(data.get("output", "")),
            "durationMs": data.get("run_time_ms", 0),
        })

    elif kind == "on_chain_end" and name == "agent":
        if stream_state["thinking_active"]:
            await _emit_ws_renderer(websocket, "thinking:completed", {
                **base_payload, "tokensUsed": 0,
            })
            stream_state["thinking_active"] = False
        await _emit_ws_renderer(websocket, "stream:completed", base_payload)


async def _emit_ws_renderer(websocket: Any, event_type: str, data: dict | None = None) -> None:
    """Send event in renderer format: {type: str, ...fields}"""
    msg: dict[str, Any] = {"type": event_type}
    if data is not None:
        msg.update(data)
    await websocket.send_text(json.dumps(msg, ensure_ascii=False))
