"""Bridge LangGraph astream_events to Electron stdout and WebSocket clients.

This module keeps the public API (`stream_agent_to_electron`,
`stream_agent_to_websocket`) and delegates event payload construction to
the emitters/ package.  The unified `_dispatch_event_core` handles both
transports via pluggable emit callbacks, eliminating the previous
Electron / WebSocket duplication.
"""
import asyncio
import json
import logging
import sys
import uuid
from typing import Any, Callable

from sparta_ai.streaming.emitters import (
    reasoning_events,
    tool_events,
    search_events,
    usage_events,
)
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

# ── WebSocket camelCase mapping ──────────────────────────────────────
_WS_CAMEL_MAP: dict[str, str] = {
    "tokens_used": "tokensUsed",
    "tool_call_id": "toolCallId",
    "duration_ms": "durationMs",
    "input_tokens": "inputTokens",
    "output_tokens": "outputTokens",
}


# ═══════════════════════════════════════════════════════════════════════
#  Transport emitters
# ═══════════════════════════════════════════════════════════════════════

def _emit(request_id: str, event: str, data: dict | None = None, stream_state: dict | None = None) -> None:
    """Write a JSON event line to stdout (consumed by Electron IPC)."""
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
        sys.exit(0)


async def _emit_ws_renderer(websocket: Any, event_type: str, data: dict | None = None) -> None:
    """Send a JSON event to a WebSocket client."""
    msg: dict[str, Any] = {"type": event_type}
    if data is not None:
        msg.update(data)
    await websocket.send_text(json.dumps(msg, ensure_ascii=False))


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


# ═══════════════════════════════════════════════════════════════════════
#  Shared helpers
# ═══════════════════════════════════════════════════════════════════════

def _new_stream_state(initial_state: dict) -> dict:
    return {
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


def _reset_stream_state(stream_state: dict) -> None:
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


def _detect_and_emit_skill(
    emit_control_fn: Callable[[str, dict], Any],
    thinking_text: str,
    stream_state: dict,
    base_payload: dict,
) -> None:
    detected = detect_skill(thinking_text, stream_state.get("active_skill_ids", []), stream_state)
    if detected:
        logger.info("Skill activated: %s", detected.get("name", detected["id"]))
        emit_control_fn("skill:activated", build_skill_payload(detected, base_payload))


def _extract_tool_output_str(data: dict) -> str:
    raw_output = data.get("output", "")
    if hasattr(raw_output, "content"):
        return str(raw_output.content) if raw_output.content is not None else ""
    return str(raw_output)


# ═══════════════════════════════════════════════════════════════════════
#  Unified dispatch — single code path for both transports
# ═══════════════════════════════════════════════════════════════════════

async def _dispatch_event(
    request_id: str,
    event: dict,
    stream_state: dict,
) -> bool:
    """Electron stdout dispatch wrapper."""
    emit = lambda e, d: _emit(request_id, e, d, stream_state)
    return await _dispatch_event_core(emit, emit, event, stream_state, request_id)


async def _dispatch_event_core(
    emit_fn: Callable[[str, dict], Any],
    emit_control_fn: Callable[[str, dict], Any],
    event: dict,
    stream_state: dict,
    request_id: str = "",
) -> bool:
    """Shared LangGraph event dispatch logic for both Electron and WebSocket.

    Returns True if the stream should be aborted.
    """
    kind = event.get("event", "")
    data: dict = event.get("data", {})
    name: str = event.get("name", "")
    namespace = _extract_namespace(event)
    base_payload = {"ns": namespace} if namespace else {}

    # ── on_chat_model_stream — reasoning + text tokens ──────────────
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
                emit_control_fn(*reasoning_events.thinking_started(base_payload))
                stream_state["thinking_active"] = True
            stream_state["reasoning_tokens"] = stream_state.get("reasoning_tokens", 0) + len(reasoning_content.split())
            stream_state["reasoning_chars"] = stream_state.get("reasoning_chars", 0) + len(reasoning_content)
            logger.debug("Emitting thinking:token (reasoning_content) for request %s", request_id)
            emit_fn(*reasoning_events.thinking_token(base_payload, reasoning_content))

            _detect_and_emit_skill(emit_control_fn, reasoning_content, stream_state, base_payload)

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
                        emit_control_fn(*reasoning_events.thinking_started(base_payload))
                        stream_state["thinking_active"] = True
                    token = _block_text(block)
                    if token:
                        stream_state["reasoning_tokens"] = stream_state.get("reasoning_tokens", 0) + len(token.split())
                        stream_state["reasoning_chars"] = stream_state.get("reasoning_chars", 0) + len(token)
                        logger.debug("Emitting thinking:token (reasoning block) for request %s", request_id)
                        emit_fn(*reasoning_events.thinking_token(base_payload, token))
                        _detect_and_emit_skill(emit_control_fn, token, stream_state, base_payload)
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
                    emit_control_fn(*reasoning_events.thinking_started(base_payload))
                    stream_state["thinking_active"] = True
                stream_state["reasoning_tokens"] = stream_state.get("reasoning_tokens", 0) + len(reasoning.split())
                stream_state["reasoning_chars"] = stream_state.get("reasoning_chars", 0) + len(reasoning)
                logger.debug("Emitting thinking:token (inline think tag) for request %s", request_id)
                emit_fn(*reasoning_events.thinking_token(base_payload, reasoning))
                _detect_and_emit_skill(emit_control_fn, reasoning, stream_state, base_payload)

            if visible:
                rep_guard = stream_state.setdefault("_rep_guard", RepetitionGuard())
                if rep_guard.feed(visible):
                    logger.warning("Repetition detected in visible text, aborting")
                    emit_control_fn("stream:degenerate", {**base_payload})
                    return True
                if stream_state["thinking_active"] and not reasoning:
                    emit_control_fn(*reasoning_events.thinking_completed(base_payload, stream_state.get("reasoning_tokens", 0)))
                    stream_state["thinking_active"] = False
                stream_state["visible_chars"] = stream_state.get("visible_chars", 0) + len(visible)
                stream_state["_emitted_text"] = stream_state.get("_emitted_text", "") + visible
                emit_fn("stream:token", {**base_payload, "token": visible})

    # ── on_chat_model_start — thinking flag from provider metadata ───
    elif kind == "on_chat_model_start":
        additional_kwargs = data.get("additional_kwargs", {})
        if additional_kwargs.get("thinking"):
            if not stream_state["thinking_active"]:
                emit_control_fn(*reasoning_events.thinking_started(base_payload))
                stream_state["thinking_active"] = True

    # ── on_chat_model_end — usage + thinking completion ─────────────
    elif kind == "on_chat_model_end":
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

    # ── on_tool_start ───────────────────────────────────────────────
    elif kind == "on_tool_start":
        tool_call_id = event.get("run_id", str(id(event)))
        tool_input = data.get("input", {})
        emit_control_fn(*tool_events.tool_called(base_payload, name, tool_input, tool_call_id))

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

    # ── on_tool_end ─────────────────────────────────────────────────
    elif kind == "on_tool_end":
        tool_call_id = event.get("run_id", "unknown")
        output_str = _extract_tool_output_str(data)
        emit_control_fn(*tool_events.tool_result(base_payload, name, output_str, data.get("run_time_ms", 0), tool_call_id))

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

    # ── on_tool_error ───────────────────────────────────────────────
    elif kind == "on_tool_error":
        tool_call_id = event.get("run_id", "unknown")
        emit_control_fn(*tool_events.tool_error(
            base_payload, name, str(data.get("error", "Tool execution failed")), tool_call_id,
        ))

    # ── on_chain_start — status messages ────────────────────────────
    elif kind == "on_chain_start":
        _STATUS_MAP = {
            "planner": "Analizando la tarea y generando plan…",
            "agent": "Razonando sobre el siguiente paso…",
            "tools": "Ejecutando herramientas…",
            "subagent_coordinator": "Delegando tarea al especialista…",
        }
        status_text = _STATUS_MAP.get(name)
        if status_text:
            emit_control_fn(*reasoning_events.thinking_status(base_payload, status_text))

    # ── on_custom_event — search progress, thinking status ──────────
    elif kind == "on_custom_event":
        if name == "tool_progress":
            emit_control_fn(*search_events.search_progress(base_payload, data))
        elif name == "thinking:status":
            text = data.get("text") if isinstance(data, dict) else None
            if text:
                emit_control_fn(*reasoning_events.thinking_status(base_payload, text))

    # ── on_chain_end — plan events + stream completion ──────────────
    elif kind == "on_chain_end" and name in ("agent", "tools", "subagent_coordinator"):
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

    return False


# ═══════════════════════════════════════════════════════════════════════
#  Public API — Electron stdout
# ═══════════════════════════════════════════════════════════════════════

async def _run_single_stream(
    graph: Any,
    initial_state: dict,
    request_id: str,
    thread_id: str,
    stream_state: dict,
) -> dict | None:
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
    if model and is_free_tier_model(model):
        max_empty_retries = max(max_empty_retries, 2)
        logger.info("Free-tier model detected (%s) — retries=%d", model, max_empty_retries)

    stream_state = _new_stream_state(initial_state)

    async def _run_with_retry() -> dict | None:
        last_result = None
        for attempt in range(max_empty_retries + 1):
            if attempt > 0:
                wait = 2.0 * attempt
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
                _reset_stream_state(stream_state)

            last_result = await _run_single_stream(graph, initial_state, request_id, thread_id, stream_state)
            if last_result is None:
                return None
            if last_result.get("visible_chars", 0) > 0:
                return last_result

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


# ═══════════════════════════════════════════════════════════════════════
#  Public API — WebSocket
# ═══════════════════════════════════════════════════════════════════════

async def stream_agent_to_websocket(
    graph: Any,
    initial_state: dict,
    websocket: Any,
    request_id: str,
    session_id: str = "",
    message_id: str = "",
    thread_id: str = "",
) -> None:
    stream_state = _new_stream_state(initial_state)

    def _ws_emit(event_type: str, data: dict | None = None) -> None:
        """Sync emit wrapper — schedules the async WS send."""
        adapted = _ws_adapt(event_type, data) if data is not None else None
        asyncio.ensure_future(_emit_ws_renderer(websocket, event_type, adapted))

    config = {"configurable": {"thread_id": thread_id or session_id or request_id}}
    try:
        async for event in graph.astream_events(initial_state, config, version="v2"):
            await _dispatch_event_core(_ws_emit, _ws_emit, event, stream_state, request_id)
    except Exception as e:
        logger.exception("Stream error")
        adapted = _ws_adapt("stream:error", {
            "error": str(e),
            "sessionId": session_id,
            "messageId": message_id,
        })
        await _emit_ws_renderer(websocket, "stream:error", adapted)
