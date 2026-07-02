"""Bridge LangGraph astream_events to Electron stdout and WebSocket clients.

This module keeps the public API (`stream_agent_to_electron`,
`stream_agent_to_websocket`) and delegates event parsing/normalization to
`event_dispatcher.py` and `skill_detector.py`.
"""
import json
import logging
import sys
from typing import Any

from sparta_ai.streaming.event_dispatcher import (
    _block_text,
    _extract_namespace,
    _extract_reasoning_content,
    _is_reasoning_block,
    _is_text_block,
)
from sparta_ai.streaming.skill_detector import build_skill_payload, detect_skill
from sparta_ai.streaming.think_scrubber import StreamingThinkScrubber
from sparta_ai.streaming.repetition_guard import RepetitionGuard
from sparta_ai.providers.retry_policy import retry_on_empty, EmptyResponseError

logger = logging.getLogger("sparta_ai.streaming")


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


async def _detect_and_emit_skill(
    request_id: str,
    thinking_text: str,
    stream_state: dict,
    base_payload: dict,
) -> None:
    """Detect if the LLM is activating a skill and emit skill:activated."""
    detected = detect_skill(thinking_text, stream_state.get("active_skill_ids", []), stream_state)
    if detected:
        logger.info("Skill activated: %s", detected.get("name", detected["id"]))
        _emit(request_id, "skill:activated", build_skill_payload(detected, base_payload))


async def _run_single_stream(
    graph: Any,
    initial_state: dict,
    request_id: str,
    thread_id: str,
    stream_state: dict,
) -> dict | None:
    """Run a single streaming pass through the graph.

    Returns the final stream_state dict on success, or None if the stream was
    aborted explicitly (not via empty response).
    """
    config = {"configurable": {"thread_id": thread_id or request_id}}
    try:
        async for event in graph.astream_events(initial_state, config, version="v2"):
            abort = await _dispatch_event(request_id, event, stream_state)
            if abort:
                return None
    except Exception as e:
        logger.exception("Stream error")
        _emit(request_id, "error", {"code": "stream_error", "message": str(e)})
        _emit(request_id, "stream_end", {"error": str(e)})
        return None
    return stream_state


async def stream_agent_to_electron(
    graph: Any,
    initial_state: dict,
    request_id: str,
    thread_id: str = "",
    max_empty_retries: int = 1,
) -> None:
    # Mutable state so thinking flag persists across separate astream_events events.
    stream_state = {
        "thinking_active": False,
        "last_detected_skill": None,
        "active_skill_ids": initial_state.get("active_skills", []),
        "visible_chars": 0,
        "reasoning_chars": 0,
        "_empty_retries": 0,
    }

    async def _try_stream() -> None:
        result = await _run_single_stream(graph, initial_state, request_id, thread_id, stream_state)
        if result is None:
            return
        if result.get("visible_chars", 0) == 0 and result.get("_empty_retries", 0) < max_empty_retries:
            stream_state["_empty_retries"] = result["_empty_retries"] + 1
            logger.warning(
                "Empty response (retry %d/%d) for request %s",
                stream_state["_empty_retries"], max_empty_retries, request_id,
            )
            _emit(
                request_id,
                "error",
                {
                    "code": "empty_response_retry",
                    "message": f"El modelo no devolvió respuesta. Reintentando ({stream_state['_empty_retries']}/{max_empty_retries})...",
                },
            )
            # Reset state for retry
            stream_state["visible_chars"] = 0
            stream_state["thinking_active"] = False
            stream_state["_rep_guard"] = RepetitionGuard()
            await _try_stream()

    await _try_stream()


async def _dispatch_event(request_id: str, event: dict, stream_state: dict) -> bool:
    """Dispatch a single LangGraph event.

    Returns True if the stream should be aborted (degeneration detected),
    False to continue streaming normally.
    """
    kind = event.get("event", "")
    data: dict = event.get("data", {})
    name: str = event.get("name", "")
    namespace = _extract_namespace(event)
    base_payload = {"ns": namespace} if namespace else {}

    if kind == "on_chat_model_stream":
        chunk = data.get("chunk")
        if chunk is None:
            return False

        # Some OpenAI-compatible providers expose reasoning in metadata rather than content blocks.
        reasoning_content = _extract_reasoning_content(chunk)
        reasoning_from_metadata = bool(reasoning_content)
        if reasoning_content:
            if not stream_state["thinking_active"]:
                logger.debug("Emitting thinking:started for request %s", request_id)
                _emit(request_id, "thinking:started", {**base_payload})
                stream_state["thinking_active"] = True
            stream_state["reasoning_tokens"] = stream_state.get("reasoning_tokens", 0) + len(reasoning_content.split())
            stream_state["reasoning_chars"] = stream_state.get("reasoning_chars", 0) + len(reasoning_content)
            logger.debug("Emitting thinking:token (reasoning_content) for request %s", request_id)
            _emit(request_id, "thinking:token", {**base_payload, "token": reasoning_content})

            # Detect skill activation in thinking text
            await _detect_and_emit_skill(request_id, reasoning_content, stream_state, base_payload)

            # If reasoning came from metadata, the same text often appears duplicated in the
            # content string on the same chunk. Skip processing content to avoid emitting it twice.
            return False

        content = getattr(chunk, "content", "")
        if isinstance(content, list):
            for block in content:
                if _is_reasoning_block(block):
                    if reasoning_from_metadata:
                        continue
                    if not stream_state["thinking_active"]:
                        logger.debug("Emitting thinking:started for request %s", request_id)
                        _emit(request_id, "thinking:started", {**base_payload})
                        stream_state["thinking_active"] = True
                    token = _block_text(block)
                    if token:
                        stream_state["reasoning_tokens"] = stream_state.get("reasoning_tokens", 0) + len(token.split())
                        stream_state["reasoning_chars"] = stream_state.get("reasoning_chars", 0) + len(token)
                        logger.debug(
                            "Emitting thinking:token (reasoning block) for request %s", request_id
                        )
                        _emit(request_id, "thinking:token", {**base_payload, "token": token})

                        # Detect skill activation in thinking text
                        await _detect_and_emit_skill(request_id, token, stream_state, base_payload)
                elif _is_text_block(block):
                    text = _block_text(block)
                    if text:
                        rep_guard = stream_state.setdefault("_rep_guard", RepetitionGuard())
                        if rep_guard.feed(text):
                            logger.warning("Repetition detected in text block, aborting")
                            _emit(request_id, "stream:degenerate", {**base_payload})
                            return True
                        stream_state["visible_chars"] = stream_state.get("visible_chars", 0) + len(text)
                        _emit(request_id, "stream:token", {**base_payload, "token": text})
                elif isinstance(block, dict) and block.get("type") == "tool_use":
                    # Anthropic tool_use blocks are part of the assistant message,
                    # not streamed tokens; ignore here.
                    continue
        elif isinstance(content, str) and content:
            scrubber = stream_state.setdefault("_scrubber", StreamingThinkScrubber())
            visible, reasoning = scrubber.feed(content)

            if reasoning and not reasoning_from_metadata:
                if not stream_state["thinking_active"]:
                    logger.debug("Emitting thinking:started for request %s", request_id)
                    _emit(request_id, "thinking:started", {**base_payload})
                    stream_state["thinking_active"] = True
                stream_state["reasoning_tokens"] = stream_state.get("reasoning_tokens", 0) + len(reasoning.split())
                stream_state["reasoning_chars"] = stream_state.get("reasoning_chars", 0) + len(reasoning)
                logger.debug(
                    "Emitting thinking:token (inline think tag) for request %s", request_id
                )
                _emit(request_id, "thinking:token", {**base_payload, "token": reasoning})

                # Detect skill activation in thinking text
                await _detect_and_emit_skill(request_id, reasoning, stream_state, base_payload)

            if visible:
                rep_guard = stream_state.setdefault("_rep_guard", RepetitionGuard())
                if rep_guard.feed(visible):
                    logger.warning("Repetition detected in visible text, aborting")
                    _emit(request_id, "stream:degenerate", {**base_payload})
                    return True
                if stream_state["thinking_active"] and not reasoning:
                    _emit(
                        request_id,
                        "thinking:completed",
                        {**base_payload, "tokens_used": stream_state.get("reasoning_tokens", 0)},
                    )
                    stream_state["thinking_active"] = False
                stream_state["visible_chars"] = stream_state.get("visible_chars", 0) + len(visible)
                _emit(request_id, "stream:token", {**base_payload, "token": visible})

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
            _emit(
                request_id,
                "usage",
                {
                    **base_payload,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                },
            )
        if stream_state["thinking_active"]:
            _emit(request_id, "thinking:completed", {**base_payload, "tokens_used": output_tokens})
            stream_state["thinking_active"] = False
        # Soltar cualquier tag partido retenido por el scrubber.
        scrubber = stream_state.get("_scrubber")
        if scrubber:
            leftover = scrubber.flush()
            if leftover:
                stream_state["visible_chars"] = stream_state.get("visible_chars", 0) + len(leftover)
                _emit(request_id, "stream:token", {**base_payload, "token": leftover})

    elif kind == "on_tool_start":
        tool_call_id = event.get("run_id", str(id(event)))
        tool_input = data.get("input", {})
        _emit(
            request_id,
            "tool:called",
            {
                **base_payload,
                "name": name,
                "input": tool_input,
                "tool_call_id": tool_call_id,
            },
        )
        # Emit terminal command immediately so it reaches the PTY without waiting for tool
        # completion.
        if name == "terminal_execute_tool":
            cmd = tool_input.get("command", "") if isinstance(tool_input, dict) else str(tool_input)
            _emit(request_id, "terminal:agent_command", {"command": cmd})

    elif kind == "on_tool_end":
        tool_call_id = event.get("run_id", "unknown")
        _emit(
            request_id,
            "tool:result",
            {
                **base_payload,
                "name": name,
                "output": str(data.get("output", "")),
                "duration_ms": data.get("run_time_ms", 0),
                "tool_call_id": tool_call_id,
            },
        )

    elif kind == "on_tool_error":
        tool_call_id = event.get("run_id", "unknown")
        _emit(
            request_id,
            "tool:error",
            {
                **base_payload,
                "name": name,
                "error": str(data.get("error", "Tool execution failed")),
                "tool_call_id": tool_call_id,
            },
        )

    elif kind == "on_custom_event":
        event_name = data.get("name", "")
        event_data = data.get("data", {})
        if event_name == "tool_progress":
            _emit(request_id, "search:progress", {**base_payload, **event_data})

    elif kind == "on_chain_end" and name == "agent":
        if stream_state["thinking_active"]:
            _emit(request_id, "thinking:completed", {**base_payload, "tokens_used": 0})
            stream_state["thinking_active"] = False
        if stream_state.get("visible_chars", 0) == 0:
            _emit(
                request_id,
                "error",
                {
                    "code": "empty_response",
                    "message": "El modelo no devolvió contenido visible.",
                },
            )
            return False
        _emit(request_id, "stream:completed", base_payload)
        return False


async def _detect_and_emit_skill_ws(
    websocket: Any,
    thinking_text: str,
    stream_state: dict,
    base_payload: dict,
) -> None:
    """Detect skill activation during WS streaming and emit skill:activated."""
    detected = detect_skill(thinking_text, stream_state.get("active_skill_ids", []), stream_state)
    if detected:
        logger.info("Skill activated (WS): %s", detected.get("name", detected["id"]))
        await _emit_ws_renderer(websocket, "skill:activated", build_skill_payload(detected, base_payload))


async def stream_agent_to_websocket(
    graph: Any,
    initial_state: dict,
    websocket: Any,
    request_id: str,
    session_id: str = "",
    message_id: str = "",
    thread_id: str = "",
) -> None:
    """
    Run the LangGraph and emit events via WebSocket.
    Events are sent in the format the renderer expects:
    {"type": "stream:token", "token": "...", "sessionId": "...", "messageId": "..."}
    """
    stream_state = {
        "thinking_active": False,
        "last_detected_skill": None,
        "active_skill_ids": initial_state.get("active_skills", []),
        "visible_chars": 0,
        "reasoning_chars": 0,
    }
    config = {"configurable": {"thread_id": thread_id or session_id or request_id}}
    try:
        async for event in graph.astream_events(initial_state, config, version="v2"):
            await _dispatch_event_ws(
                websocket, request_id, event, session_id, message_id, stream_state
            )
    except Exception as e:
        logger.exception("Stream error")
        await _emit_ws_renderer(
            websocket,
            "stream:error",
            {
                "error": str(e),
                "sessionId": session_id,
                "messageId": message_id,
            },
        )


async def _dispatch_event_ws(
    websocket: Any,
    request_id: str,
    event: dict,
    session_id: str = "",
    message_id: str = "",
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
        reasoning_from_metadata = bool(reasoning_content)
        if reasoning_content:
            if not stream_state["thinking_active"]:
                await _emit_ws_renderer(websocket, "thinking:started", base_payload)
                stream_state["thinking_active"] = True
            stream_state["reasoning_tokens"] = stream_state.get("reasoning_tokens", 0) + len(reasoning_content.split())
            stream_state["reasoning_chars"] = stream_state.get("reasoning_chars", 0) + len(reasoning_content)
            await _emit_ws_renderer(
                websocket,
                "thinking:token",
                {
                    **base_payload,
                    "token": reasoning_content,
                },
            )

            # Detect skill activation
            await _detect_and_emit_skill_ws(
                websocket, reasoning_content, stream_state, base_payload
            )

            # Avoid duplicated reasoning that appears in content string on the same chunk.
            return

        content = getattr(chunk, "content", "")
        if isinstance(content, list):
            for block in content:
                if _is_reasoning_block(block):
                    if reasoning_from_metadata:
                        continue
                    if not stream_state["thinking_active"]:
                        await _emit_ws_renderer(websocket, "thinking:started", base_payload)
                        stream_state["thinking_active"] = True
                    token = _block_text(block)
                    if token:
                        stream_state["reasoning_tokens"] = stream_state.get("reasoning_tokens", 0) + len(token.split())
                        stream_state["reasoning_chars"] = stream_state.get("reasoning_chars", 0) + len(token)
                        await _emit_ws_renderer(
                            websocket,
                            "thinking:token",
                            {
                                **base_payload,
                                "token": token,
                            },
                        )

                        # Detect skill activation
                        await _detect_and_emit_skill_ws(
                            websocket, token, stream_state, base_payload
                        )
                elif _is_text_block(block):
                    text = _block_text(block)
                    if text:
                        stream_state["visible_chars"] = stream_state.get("visible_chars", 0) + len(text)
                        await _emit_ws_renderer(
                            websocket,
                            "stream:token",
                            {
                                **base_payload,
                                "token": text,
                            },
                        )
        elif isinstance(content, str) and content:
            scrubber = stream_state.setdefault("_scrubber", StreamingThinkScrubber())
            visible, reasoning = scrubber.feed(content)

            if reasoning and not reasoning_from_metadata:
                if not stream_state["thinking_active"]:
                    await _emit_ws_renderer(websocket, "thinking:started", base_payload)
                    stream_state["thinking_active"] = True
                stream_state["reasoning_tokens"] = stream_state.get("reasoning_tokens", 0) + len(reasoning.split())
                stream_state["reasoning_chars"] = stream_state.get("reasoning_chars", 0) + len(reasoning)
                await _emit_ws_renderer(
                    websocket,
                    "thinking:token",
                    {
                        **base_payload,
                        "token": reasoning,
                    },
                )

                # Detect skill activation
                await _detect_and_emit_skill_ws(websocket, reasoning, stream_state, base_payload)

            if visible:
                if stream_state["thinking_active"] and not reasoning:
                    await _emit_ws_renderer(
                        websocket,
                        "thinking:completed",
                        {
                            **base_payload,
                            "tokensUsed": stream_state.get("reasoning_tokens", 0),
                        },
                    )
                    stream_state["thinking_active"] = False
                stream_state["visible_chars"] = stream_state.get("visible_chars", 0) + len(visible)
                await _emit_ws_renderer(
                    websocket,
                    "stream:token",
                    {
                        **base_payload,
                        "token": visible,
                    },
                )

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
            await _emit_ws_renderer(
                websocket,
                "usage",
                {
                    **base_payload,
                    "inputTokens": input_tokens,
                    "outputTokens": output_tokens,
                },
            )
        if stream_state["thinking_active"]:
            await _emit_ws_renderer(
                websocket,
                "thinking:completed",
                {
                    **base_payload,
                    "tokensUsed": output_tokens,
                },
            )
            stream_state["thinking_active"] = False
        # Soltar cualquier tag partido retenido por el scrubber.
        scrubber = stream_state.get("_scrubber")
        if scrubber:
            leftover = scrubber.flush()
            if leftover:
                stream_state["visible_chars"] = stream_state.get("visible_chars", 0) + len(leftover)
                await _emit_ws_renderer(
                    websocket,
                    "stream:token",
                    {
                        **base_payload,
                        "token": leftover,
                    },
                )

    elif kind == "on_tool_start":
        tool_call_id = event.get("run_id", str(id(event)))
        tool_input = data.get("input", {})
        await _emit_ws_renderer(
            websocket,
            "tool:called",
            {
                **base_payload,
                "toolCall": {
                    "id": tool_call_id,
                    "toolName": name,
                    "input": tool_input,
                    "status": "running",
                },
            },
        )
        if name == "terminal_execute_tool":
            cmd = tool_input.get("command", "") if isinstance(tool_input, dict) else str(tool_input)
            await _emit_ws_renderer(websocket, "terminal:agent_command", {"command": cmd})

    elif kind == "on_tool_end":
        tool_call_id = event.get("run_id", "unknown")
        await _emit_ws_renderer(
            websocket,
            "tool:result",
            {
                **base_payload,
                "toolCallId": tool_call_id,
                "output": str(data.get("output", "")),
                "durationMs": data.get("run_time_ms", 0),
            },
        )

    elif kind == "on_tool_error":
        tool_call_id = event.get("run_id", "unknown")
        await _emit_ws_renderer(
            websocket,
            "tool:error",
            {
                **base_payload,
                "toolCallId": tool_call_id,
                "error": str(data.get("error", "Tool execution failed")),
            },
        )

    elif kind == "on_custom_event":
        event_name = data.get("name", "")
        event_data = data.get("data", {})
        if event_name == "tool_progress":
            await _emit_ws_renderer(
                websocket,
                "search:progress",
                {
                    **base_payload,
                    **event_data,
                },
            )

    elif kind == "on_chain_end" and name == "agent":
        if stream_state["thinking_active"]:
            await _emit_ws_renderer(
                websocket,
                "thinking:completed",
                {
                    **base_payload,
                    "tokensUsed": 0,
                },
            )
            stream_state["thinking_active"] = False
        if stream_state.get("visible_chars", 0) == 0:
            await _emit_ws_renderer(
                websocket,
                "stream:error",
                {
                    **base_payload,
                    "error": "El modelo no devolvió contenido visible.",
                },
            )
            return
        await _emit_ws_renderer(websocket, "stream:completed", base_payload)


async def _emit_ws_renderer(websocket: Any, event_type: str, data: dict | None = None) -> None:
    """Send event in renderer format: {type: str, ...fields}"""
    msg: dict[str, Any] = {"type": event_type}
    if data is not None:
        msg.update(data)
    await websocket.send_text(json.dumps(msg, ensure_ascii=False))
