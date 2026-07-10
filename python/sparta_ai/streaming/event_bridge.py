"""Bridge LangGraph astream_events to Electron stdout and WebSocket clients.

This module keeps the public API (`stream_agent_to_electron`,
`stream_agent_to_websocket`) and delegates event parsing/normalization to
`event_dispatcher.py` and `skill_detector.py`.
"""
import json
import logging
import sys
import uuid
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
from sparta_ai.providers.free_tier_guard import is_free_tier_model

logger = logging.getLogger("sparta_ai.streaming")

_SUBGRAPH_NAMESPACE_PREFIXES = ("research_agent/", "code_agent/", "memory_agent/")

_FLUSH_BATCH_SIZE = 8
_flush_counter = 0

_TOKEN_EVENTS = frozenset({"stream:token", "thinking:token"})

_CONTROL_EVENTS = frozenset({
    "stream:completed", "stream:aborted", "stream:error", "stream:degenerate",
    "stream:end",
    "thinking:started", "thinking:completed", "thinking:status",
    "tool:called", "tool:result", "tool:error",
    "terminal:agent_command", "terminal:agent_spawn",
    "terminal:agent_output", "terminal:agent_exit",
    "usage", "skill:activated", "search:progress",
    "plan:created", "plan:step",
    "file:changed",
})


def _emit(request_id: str, event: str, data: dict | None = None, stream_state: dict | None = None) -> None:
    global _flush_counter
    msg: dict[str, Any] = {"id": request_id, "event": event}
    if data is not None:
        if stream_state is not None and event in _TOKEN_EVENTS:
            stream_state["_chunk_seq"] = stream_state.get("_chunk_seq", 0) + 1
            data["chunkSeq"] = stream_state["_chunk_seq"]
        msg["data"] = data
    try:
        sys.stdout.write(json.dumps(msg, ensure_ascii=False) + "\n")
        should_flush = event in _CONTROL_EVENTS
        if not should_flush and event in _TOKEN_EVENTS:
            _flush_counter += 1
            if _flush_counter >= _FLUSH_BATCH_SIZE:
                should_flush = True
                _flush_counter = 0
        else:
            _flush_counter = 0
        if should_flush:
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
    model: str = "",
) -> None:
    # Free-tier models need more retries and longer backoff
    if model and is_free_tier_model(model):
        max_empty_retries = max(max_empty_retries, 2)
        logger.info("Free-tier model detected (%s) — retries=%d", model, max_empty_retries)
    # Mutable state so thinking flag persists across separate astream_events events.
    stream_state = {
        "thinking_active": False,
        "last_detected_skill": None,
        "active_skill_ids": initial_state.get("active_skills", []),
        "visible_chars": 0,
        "reasoning_chars": 0,
        "_empty_retries": 0,
        "_reasoning_extracted": False,
        "_stream_completed": False,
        "_emitted_text": "",
        "_skip_mode": False,
        "_skip_pending": "",
        "_pending_file_path": "",
        "_pending_terminal_command": "",
        "_pending_terminal_proc": {},
    }

    async def _run_with_retry() -> dict | None:
        """Run stream with retry_on_empty for proper backoff between attempts."""
        last_result = None
        for attempt in range(max_empty_retries + 1):
            if attempt > 0:
                wait = 2.0 * attempt  # 2s, 4s, 6s...
                logger.info("Retrying empty response in %.1fs (attempt %d/%d)", wait, attempt, max_empty_retries)
                _emit(
                    request_id,
                    "stream:notice",
                    {
                        "code": "empty_response_retry",
                        "message": f"El modelo no devolvió respuesta. Reintentando ({attempt}/{max_empty_retries})...",
                    },
                )
                await asyncio.sleep(wait)
                # Reset mutable state for a clean retry
                stream_state["visible_chars"] = 0
                stream_state["reasoning_chars"] = 0
                stream_state["thinking_active"] = False
                stream_state["_reasoning_extracted"] = False
                stream_state["_emitted_text"] = ""
                stream_state["_skip_mode"] = False
                stream_state["_skip_pending"] = ""
                stream_state["_pending_file_path"] = ""
                stream_state["_pending_terminal_command"] = ""
                stream_state["_pending_terminal_proc"] = {}
                stream_state["last_detected_skill"] = None
                stream_state["_rep_guard"] = RepetitionGuard()
                stream_state["_scrubber"] = StreamingThinkScrubber()
                stream_state["_chunk_seq"] = 0
                stream_state["reasoning_tokens"] = 0
                stream_state["_plan_seen"] = False

            last_result = await _run_single_stream(graph, initial_state, request_id, thread_id, stream_state)
            if last_result is None:
                return None
            if last_result.get("visible_chars", 0) > 0:
                return last_result

        # All retries exhausted — surface final empty result
        logger.error("Empty response after %d retries for request %s", max_empty_retries, request_id)
        _emit(
            request_id,
            "error",
            {
                "code": "empty_response",
                "message": (
                    "El modelo no devolvió contenido visible. "
                    "Causas comunes: (1) el modelo no existe para este proveedor, "
                    "(2) la API key es inválida o no tiene acceso al modelo, "
                    "(3) el proveedor seleccionado no corresponde al modelo "
                    "(por ejemplo, un modelo de NVIDIA configurado como Google). "
                    "Verificá la configuración en Configuración > Modelos."
                ),
            },
        )
        _emit(request_id, "stream_end", {"error": "empty_response"})
        stream_state["_stream_completed"] = True
        return last_result

    await _run_with_retry()


async def _dispatch_event(request_id: str, event: dict, stream_state: dict) -> bool:
    """Dispatch a single LangGraph event to stdout (Electron mode).

    Returns True if the stream should be aborted (degeneration detected),
    False to continue streaming normally.
    """
    return await _dispatch_event_core(
        emit_fn=lambda e, d: _emit(request_id, e, d, stream_state),
        emit_control_fn=lambda e, d: _emit(request_id, e, d, stream_state),
        event=event,
        stream_state=stream_state,
        request_id=request_id,
    )


async def _dispatch_event_core(
    emit_fn: Any,
    emit_control_fn: Any,
    event: dict,
    stream_state: dict,
    request_id: str = "",
) -> bool:
    """Shared LangGraph event dispatch logic for both Electron and WebSocket.

    Args:
        emit_fn: Called for token events (stream:token, thinking:token).
        emit_control_fn: Called for control events (start, end, tool, etc.).
        event: The LangGraph astream_events event dict.
        stream_state: Mutable dict shared across events.

    Returns True if the stream should be aborted.
    """
    kind = event.get("event", "")
    data: dict = event.get("data", {})
    name: str = event.get("name", "")
    namespace = _extract_namespace(event)
    base_payload = {"ns": namespace} if namespace else {}

    if kind == "on_chat_model_stream" and namespace and namespace.startswith(_SUBGRAPH_NAMESPACE_PREFIXES):
        return False

    if kind == "on_chat_model_stream":
        chunk = data.get("chunk")
        if chunk is None:
            return False

        reasoning_content = _extract_reasoning_content(chunk)
        reasoning_from_metadata = bool(reasoning_content)

        if reasoning_content:
            if not stream_state["thinking_active"]:
                logger.debug("Emitting thinking:started for request %s", request_id)
                emit_control_fn("thinking:started", {**base_payload})
                stream_state["thinking_active"] = True
            stream_state["reasoning_tokens"] = stream_state.get("reasoning_tokens", 0) + len(reasoning_content.split())
            stream_state["reasoning_chars"] = stream_state.get("reasoning_chars", 0) + len(reasoning_content)
            logger.debug("Emitting thinking:token (reasoning_content) for request %s", request_id)
            emit_fn("thinking:token", {**base_payload, "token": reasoning_content})

            await _detect_and_emit_skill(request_id, reasoning_content, stream_state, base_payload)

            content = getattr(chunk, "content", "")
            if isinstance(content, str) and content:
                scrubber = stream_state.setdefault("_scrubber", StreamingThinkScrubber())
                scrubber.feed(content)

            return False

        content = getattr(chunk, "content", "")
        if isinstance(content, list):
            for block in content:
                if _is_reasoning_block(block):
                    if reasoning_from_metadata:
                        continue
                    if not stream_state["thinking_active"]:
                        logger.debug("Emitting thinking:started for request %s", request_id)
                        emit_control_fn("thinking:started", {**base_payload})
                        stream_state["thinking_active"] = True
                    token = _block_text(block)
                    if token:
                        stream_state["reasoning_tokens"] = stream_state.get("reasoning_tokens", 0) + len(token.split())
                        stream_state["reasoning_chars"] = stream_state.get("reasoning_chars", 0) + len(token)
                        logger.debug("Emitting thinking:token (reasoning block) for request %s", request_id)
                        emit_fn("thinking:token", {**base_payload, "token": token})
                        await _detect_and_emit_skill(request_id, token, stream_state, base_payload)
                elif _is_text_block(block):
                    text = _block_text(block)
                    if text:
                        rep_guard = stream_state.setdefault("_rep_guard", RepetitionGuard())
                        if rep_guard.feed(text):
                            logger.warning("Repetition detected in text block, aborting")
                            emit_control_fn("stream:degenerate", {**base_payload})
                            return True
                        stream_state["visible_chars"] = stream_state.get("visible_chars", 0) + len(text)
                        emit_fn("stream:token", {**base_payload, "token": text})
                elif isinstance(block, dict) and block.get("type") == "tool_use":
                    continue
        elif isinstance(content, str) and content:
            scrubber = stream_state.setdefault("_scrubber", StreamingThinkScrubber())
            visible, reasoning = scrubber.feed(content)

            emitted = stream_state.get("_emitted_text", "")
            if visible and emitted:
                pending = stream_state.get("_skip_pending", "")
                if stream_state.get("_skip_mode"):
                    pending += visible
                    if emitted.startswith(pending):
                        stream_state["_skip_pending"] = pending
                        return False
                    else:
                        overlap_start = len(emitted[:len(pending)])
                        new_text = pending[overlap_start:]
                        stream_state["_skip_mode"] = False
                        stream_state["_skip_pending"] = ""
                        if new_text:
                            rep_guard = stream_state.setdefault("_rep_guard", RepetitionGuard())
                            if rep_guard.feed(new_text):
                                return True
                            stream_state["visible_chars"] = stream_state.get("visible_chars", 0) + len(new_text)
                            stream_state["_emitted_text"] = emitted + new_text
                            emit_fn("stream:token", {**base_payload, "token": new_text})
                        return False
                else:
                    test_text = (pending + visible)[:80]
                    if len(test_text) >= 10 and emitted.startswith(test_text) and len(emitted) > len(test_text) * 2:
                        stream_state["_skip_mode"] = True
                        stream_state["_skip_pending"] = test_text
                        return False
            elif visible:
                stream_state["_emitted_text"] = emitted + visible

            if reasoning and not reasoning_from_metadata:
                if not stream_state["thinking_active"]:
                    logger.debug("Emitting thinking:started for request %s", request_id)
                    emit_control_fn("thinking:started", {**base_payload})
                    stream_state["thinking_active"] = True
                stream_state["reasoning_tokens"] = stream_state.get("reasoning_tokens", 0) + len(reasoning.split())
                stream_state["reasoning_chars"] = stream_state.get("reasoning_chars", 0) + len(reasoning)
                logger.debug("Emitting thinking:token (inline think tag) for request %s", request_id)
                emit_fn("thinking:token", {**base_payload, "token": reasoning})
                await _detect_and_emit_skill(request_id, reasoning, stream_state, base_payload)

            if visible:
                rep_guard = stream_state.setdefault("_rep_guard", RepetitionGuard())
                if rep_guard.feed(visible):
                    logger.warning("Repetition detected in visible text, aborting")
                    emit_control_fn("stream:degenerate", {**base_payload})
                    return True
                if stream_state["thinking_active"] and not reasoning:
                    emit_control_fn(
                        "thinking:completed",
                        {**base_payload, "tokens_used": stream_state.get("reasoning_tokens", 0)},
                    )
                    stream_state["thinking_active"] = False
                stream_state["visible_chars"] = stream_state.get("visible_chars", 0) + len(visible)
                stream_state["_emitted_text"] = stream_state.get("_emitted_text", "") + visible
                emit_fn("stream:token", {**base_payload, "token": visible})

    elif kind == "on_chat_model_start":
        additional_kwargs = data.get("additional_kwargs", {})
        if additional_kwargs.get("thinking"):
            if not stream_state["thinking_active"]:
                emit_control_fn("thinking:started", {**base_payload})
                stream_state["thinking_active"] = True

    elif kind == "on_chat_model_end":
        output = data.get("output", {})
        usage_metadata = getattr(output, "usage_metadata", None)
        input_tokens = 0
        output_tokens = 0
        if usage_metadata:
            input_tokens = getattr(usage_metadata, "input_tokens", 0)
            output_tokens = getattr(usage_metadata, "output_tokens", 0)
            emit_control_fn(
                "usage",
                {**base_payload, "input_tokens": input_tokens, "output_tokens": output_tokens},
            )
        if stream_state["thinking_active"]:
            emit_control_fn("thinking:completed", {**base_payload, "tokens_used": output_tokens})
            stream_state["thinking_active"] = False
        scrubber = stream_state.get("_scrubber")
        if scrubber:
            leftover = scrubber.flush()
            if leftover:
                stream_state["visible_chars"] = stream_state.get("visible_chars", 0) + len(leftover)
                emit_fn("stream:token", {**base_payload, "token": leftover})

    elif kind == "on_tool_start":
        tool_call_id = event.get("run_id", str(id(event)))
        tool_input = data.get("input", {})
        emit_control_fn(
            "tool:called",
            {**base_payload, "name": name, "input": tool_input, "tool_call_id": tool_call_id},
        )
        # Capture file path from write/patch/delete tools for file:changed event
        if name in ("write_file_tool", "patch_file_tool", "delete_file_tool"):
            file_path = tool_input.get("path", "") if isinstance(tool_input, dict) else ""
            if file_path:
                stream_state["_pending_file_path"] = file_path
        if name == "terminal_execute_tool":
            cmd = tool_input.get("command", "") if isinstance(tool_input, dict) else str(tool_input)
            # Store in state instead of emitting now — emission happens in on_tool_end
            # AFTER the permission gate has run inside the tool function.
            stream_state["_pending_terminal_command"] = cmd
        elif name == "terminal_execute_background_tool":
            cmd = tool_input.get("command", "") if isinstance(tool_input, dict) else str(tool_input)
            label = tool_input.get("label") if isinstance(tool_input, dict) else None
            proc_id = f"bg-{uuid.uuid4().hex[:8]}"
            stream_state["_pending_terminal_proc"] = {"proc_id": proc_id, "command": cmd, "label": label}

    elif kind == "on_tool_end":
        tool_call_id = event.get("run_id", "unknown")
        raw_output = data.get("output", "")
        if hasattr(raw_output, 'content'):
            output_str = str(raw_output.content) if raw_output.content is not None else ""
        else:
            output_str = str(raw_output)
        emit_control_fn(
            "tool:result",
            {**base_payload, "name": name, "output": output_str, "duration_ms": data.get("run_time_ms", 0), "tool_call_id": tool_call_id},
        )
        # Emit file:changed when agent modifies a file so open editor tabs can refresh
        if name in ("write_file_tool", "patch_file_tool", "delete_file_tool"):
            file_path = stream_state.get("_pending_file_path", "")
            if file_path:
                emit_control_fn("file:changed", {"path": file_path})
                stream_state["_pending_file_path"] = ""

        # Emit terminal events ONLY after permission gate has run (tool completed)
        # The tool output contains "rechazado" if the user denied permission.
        output_str = str(data.get("output", ""))
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

    elif kind == "on_tool_error":
        tool_call_id = event.get("run_id", "unknown")
        emit_control_fn(
            "tool:error",
            {**base_payload, "name": name, "error": str(data.get("error", "Tool execution failed")), "tool_call_id": tool_call_id},
        )

    elif kind == "on_chain_start" and name == "planner":
        emit_control_fn(
            "thinking:status",
            {**base_payload, "text": "Analizando la tarea y generando plan…"},
        )

    elif kind == "on_chain_start" and name == "agent":
        emit_control_fn(
            "thinking:status",
            {**base_payload, "text": "Razonando sobre el siguiente paso…"},
        )

    elif kind == "on_chain_start" and name == "tools":
        emit_control_fn(
            "thinking:status",
            {**base_payload, "text": "Ejecutando herramientas…"},
        )

    elif kind == "on_chain_start" and name == "subagent_coordinator":
        emit_control_fn(
            "thinking:status",
            {**base_payload, "text": "Delegando tarea al especialista…"},
        )

    elif kind == "on_custom_event":
        if name == "tool_progress":
            emit_control_fn("search:progress", {**base_payload, **data})
        elif name == "thinking:status":
            text = data.get("text") if isinstance(data, dict) else None
            if text:
                emit_control_fn("thinking:status", {**base_payload, "text": text})

    elif kind == "on_chain_end" and name in ("agent", "tools", "subagent_coordinator"):
        output = data.get("output", {})
        if isinstance(output, dict):
            plan = output.get("plan", [])
            if plan:
                # First time a plan appears → created; subsequent → step
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
            return None
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
            emit_control_fn("thinking:completed", {**base_payload, "tokens_used": 0})
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
        "_reasoning_extracted": False,
        "_stream_completed": False,
        "_emitted_text": "",
        "_skip_mode": False,
        "_skip_pending": "",
        "_pending_file_path": "",
        "_pending_terminal_command": "",
        "_pending_terminal_proc": {},
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

    if kind == "on_chat_model_stream" and namespace and namespace.startswith(_SUBGRAPH_NAMESPACE_PREFIXES):
        return

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

            # Feed content to scrubber to synchronize block state, discarding output
            content = getattr(chunk, "content", "")
            if isinstance(content, str) and content:
                scrubber = stream_state.setdefault("_scrubber", StreamingThinkScrubber())
                scrubber.feed(content)

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
                rep_guard = stream_state.setdefault("_rep_guard", RepetitionGuard())
                if rep_guard.feed(visible):
                    logger.warning("Repetition detected in visible text (WS), aborting")
                    await _emit_ws_renderer(websocket, "stream:degenerate", {**base_payload})
                    return
                if stream_state["thinking_active"] and not reasoning:
                    await _emit_ws_renderer(
                        websocket,
                        "thinking:completed",
                        {**base_payload, "tokensUsed": stream_state.get("reasoning_tokens", 0)},
                    )
                    stream_state["thinking_active"] = False
                stream_state["visible_chars"] = stream_state.get("visible_chars", 0) + len(visible)
                stream_state["_emitted_text"] = stream_state.get("_emitted_text", "") + visible
                await _emit_ws_renderer(
                    websocket,
                    "stream:token",
                    {**base_payload, "token": visible},
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
            stream_state["_pending_terminal_command"] = cmd
        elif name == "terminal_execute_background_tool":
            cmd = tool_input.get("command", "") if isinstance(tool_input, dict) else str(tool_input)
            label = tool_input.get("label") if isinstance(tool_input, dict) else None
            proc_id = f"bg-{uuid.uuid4().hex[:8]}"
            stream_state["_pending_terminal_proc"] = {"proc_id": proc_id, "command": cmd, "label": label}

    elif kind == "on_tool_end":
        tool_call_id = event.get("run_id", "unknown")
        raw_output = data.get("output", "")
        if hasattr(raw_output, 'content'):
            output_str = str(raw_output.content) if raw_output.content is not None else ""
        else:
            output_str = str(raw_output)
        # Emit terminal events AFTER permission gate (in tool result), not before
        if name == "terminal_execute_tool":
            cmd = stream_state.get("_pending_terminal_command", "")
            if cmd and "rechazado" not in output_str and "bloqueado" not in output_str:
                await _emit_ws_renderer(websocket, "terminal:agent_command", {"command": cmd})
            stream_state["_pending_terminal_command"] = ""
        if name == "terminal_execute_background_tool":
            proc_info = stream_state.get("_pending_terminal_proc", {})
            if proc_info and "rechazado" not in output_str and "bloqueado" not in output_str:
                await _emit_ws_renderer(websocket, "terminal:agent_spawn", proc_info)
            stream_state["_pending_terminal_proc"] = {}

        await _emit_ws_renderer(
            websocket,
            "tool:result",
            {
                **base_payload,
                "toolCallId": tool_call_id,
                "output": output_str,
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
        if name == "tool_progress":
            await _emit_ws_renderer(
                websocket,
                "search:progress",
                {
                    **base_payload,
                    **data,
                },
            )
        elif name == "thinking:status":
            text = data.get("text") if isinstance(data, dict) else None
            if text:
                await _emit_ws_renderer(
                    websocket,
                    "thinking:status",
                    {
                        **base_payload,
                        "text": text,
                    },
                )

    elif kind == "on_chain_end" and name == "agent":
        if stream_state.get("_stream_completed"):
            return

        # If the agent node's output message contains tool_calls, the graph is
        # going to continue to the "tools" node — this is NOT the final turn.
        # Emitting an error or stream:completed here would cut the response short
        # before the LLM has a chance to reply after seeing the tool results.
        output = data.get("output", {})
        output_messages = output.get("messages", []) if isinstance(output, dict) else []
        last_output_msg = output_messages[-1] if output_messages else None
        has_pending_tool_calls = bool(getattr(last_output_msg, "tool_calls", None))
        if has_pending_tool_calls:
            logger.debug(
                "on_chain_end/agent (WS): pending tool calls detected, skipping completion for request %s",
                request_id,
            )
            return

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
            stream_state["_stream_completed"] = True
            return
        completed_payload = {**base_payload}
        suggestions = output.get("suggestions") if isinstance(output, dict) else None
        if suggestions:
            completed_payload["suggestions"] = suggestions
        await _emit_ws_renderer(websocket, "stream:completed", completed_payload)
        stream_state["_stream_completed"] = True


async def _emit_ws_renderer(websocket: Any, event_type: str, data: dict | None = None) -> None:
    """Send event in renderer format: {type: str, ...fields}"""
    msg: dict[str, Any] = {"type": event_type}
    if data is not None:
        msg.update(data)
    await websocket.send_text(json.dumps(msg, ensure_ascii=False))
