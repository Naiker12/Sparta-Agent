"""Bridge LangGraph astream_events to Electron stdout and WebSocket clients.

This module keeps the public API (`stream_agent_to_electron`,
`stream_agent_to_websocket`) and delegates event handling to the
handlers/ package via a dispatch table.  The unified `_dispatch_event_core`
handles both transports via pluggable emit callbacks.
"""
import asyncio
import json
import logging
import sys
from typing import Any, Callable

from sparta_ai.streaming.event_dispatcher import _extract_namespace
from sparta_ai.streaming.handlers import DISPATCH_TABLE
from sparta_ai.streaming.stream_state import _new_stream_state, _reset_stream_state
from sparta_ai.streaming.ws_adapter import _ws_adapt
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
    "workspace:connected",
})


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

    # Subgraph events are ignored (research_agent, code_agent, memory_agent).
    if kind == "on_chat_model_stream" and namespace and namespace.startswith(_SUBGRAPH_NAMESPACE_PREFIXES):
        return False

    handler = DISPATCH_TABLE.get(kind)
    if handler:
        return await handler(emit_fn, emit_control_fn, event, data, name, stream_state, request_id, base_payload)
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
    config = {"configurable": {"thread_id": thread_id or request_id}, "recursion_limit": 100}
    try:
        async for event in graph.astream_events(initial_state, config, version="v2"):
            abort = await _dispatch_event(request_id, event, stream_state)
            if abort:
                return None
    except Exception as e:
        logger.exception("Stream error")
        from sparta_ai.errors.user_messages import to_user_message
        _emit(request_id, "error", {"code": "stream_error", "message": to_user_message(str(e))})
        _emit(request_id, "stream_end", {"error": to_user_message(str(e))})
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

    config = {"configurable": {"thread_id": thread_id or session_id or request_id}, "recursion_limit": 100}
    try:
        async for event in graph.astream_events(initial_state, config, version="v2"):
            await _dispatch_event_core(_ws_emit, _ws_emit, event, stream_state, request_id)
    except Exception as e:
        logger.exception("Stream error")
        from sparta_ai.errors.user_messages import to_user_message
        adapted = _ws_adapt("stream:error", {
            "error": to_user_message(str(e)),
            "sessionId": session_id,
            "messageId": message_id,
        })
        await _emit_ws_renderer(websocket, "stream:error", adapted)
