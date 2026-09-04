from __future__ import annotations


from state import active_generations
from utils.native_path_leases import redact_native_paths

"""Studio Monitor and Inference Cancellation Router.

Extracted from monolithic routes/inference.py to preserve SRP and modularity.
"""

import asyncio
import logging
import time
from typing import Any, Callable, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from auth import get_current_subject
from core.inference.api_monitor import api_monitor
from state.tool_approvals import resolve_tool_decision

logger = logging.getLogger(__name__)

studio_router = APIRouter()
router = studio_router


class ToolConfirmRequest(BaseModel):
    approval_id: str
    decision: str
    session_id: Optional[str] = None


# Helpers container for clean dependency inversion
class _Helpers:
    cancel_by_cancel_id_or_stash: Optional[Callable[[str], int]] = None
    cancel_by_keys: Optional[Callable[[List[str]], int]] = None
    monitor_active_model: Optional[Callable[[], Optional[str]]] = None
    monitor_context_length: Optional[Callable[[], Optional[int]]] = None
    monitor_queue_state: Optional[Callable[[], Optional[Dict[str, Any]]]] = None
    direct_llama_is_busy: Optional[Callable[[], bool]] = None
    llama_admission_capacity: Optional[Callable[[Request, Any], int]] = None
    llama_backend_getter: Optional[Callable[[], Any]] = None



helpers = _Helpers()


def init_monitor_helpers(
    *,
    cancel_by_cancel_id_or_stash: Callable[[str], int],
    cancel_by_keys: Callable[[List[str]], int],
    monitor_active_model: Callable[[], Optional[str]],
    monitor_context_length: Callable[[], Optional[int]],
    monitor_queue_state: Callable[[], Optional[Dict[str, Any]]],
    direct_llama_is_busy: Callable[[], bool],
    llama_admission_capacity: Optional[Callable[[Request, Any], int]] = None,
    llama_backend_getter: Optional[Callable[[], Any]] = None,
) -> None:
    helpers.cancel_by_cancel_id_or_stash = cancel_by_cancel_id_or_stash
    helpers.cancel_by_keys = cancel_by_keys
    helpers.monitor_active_model = monitor_active_model
    helpers.monitor_context_length = monitor_context_length
    helpers.monitor_queue_state = monitor_queue_state
    helpers.direct_llama_is_busy = direct_llama_is_busy
    helpers.llama_admission_capacity = llama_admission_capacity
    helpers.llama_backend_getter = llama_backend_getter



@studio_router.post("/cancel")
async def cancel_inference(request: Request, current_subject: str = Depends(get_current_subject)):
    """Cancel in-flight inference requests.

    Body (JSON, at least one key required):
      cancel_id    - preferred: per-run UUID, matched exclusively.
      session_id   - fallback when cancel_id is absent.
      completion_id - fallback when cancel_id is absent.

    A cancel_id arriving before its stream registers is stashed briefly and
    replayed on registration. Returns {"cancelled": N}.
    """
    try:
        body = await request.json()
        if not isinstance(body, dict):
            body = {}
    except Exception as e:
        logger.debug("Failed to parse cancel request body: %s", e)
        body = {}

    cancel_id = body.get("cancel_id")
    if isinstance(cancel_id, str) and cancel_id:
        fn = helpers.cancel_by_cancel_id_or_stash
        cancelled = fn(cancel_id) if fn else 0
        return {"cancelled": cancelled}

    keys = []
    # `message_id` is the Anthropic passthrough's per-run identifier, so
    # /v1/messages clients can cancel by their native id.
    for k in ("completion_id", "session_id", "message_id"):
        v = body.get(k)
        if isinstance(v, str) and v:
            keys.append(v)

    if not keys:
        return {"cancelled": 0}

    fn_keys = helpers.cancel_by_keys
    n = fn_keys(keys) if fn_keys else 0
    return {"cancelled": n}


@studio_router.post("/tool-confirm")
async def confirm_tool_call(
    request: ToolConfirmRequest, current_subject: str = Depends(get_current_subject)
):
    matched = resolve_tool_decision(
        request.approval_id,
        request.decision,
        session_id = request.session_id,
    )
    if not matched:
        raise HTTPException(status_code = 404, detail = "No pending tool call confirmation")
    return {"resolved": True}


@studio_router.get("/monitor")
async def get_api_monitor(current_subject: str = Depends(get_current_subject)):
    """Return recent OpenAI-compatible API activity for Unsloth."""
    # Off-loop: both helpers reach get_inference_backend(), whose first call waits on
    # hardware detection, and this is polled from first paint.
    fn_model = helpers.monitor_active_model or (lambda: None)
    fn_ctx = helpers.monitor_context_length or (lambda: None)
    fn_q = helpers.monitor_queue_state or (lambda: None)
    fn_busy = helpers.direct_llama_is_busy or (lambda: False)

    active_model, context_length, queue, direct_busy = await asyncio.to_thread(
        lambda: (
            fn_model(),
            fn_ctx(),
            fn_q(),
            fn_busy(),
        )
    )
    active_requests = api_monitor.active_count(subject = current_subject)
    queue_busy = bool(queue) and bool(queue.get("active") or queue.get("queued"))
    if active_requests or queue_busy or direct_busy:
        operating_status = "generating"
    elif active_model:
        operating_status = "ready"
    else:
        operating_status = "idle"
    return {
        "status": operating_status,
        "server_time": time.time(),
        "active_model": active_model,
        "context_length": context_length,
        "active_requests": active_requests,
        "queue": queue,
        "logging_enabled": api_monitor.enabled,
        "entries": api_monitor.snapshot(include_details = False, subject = current_subject),
    }


@studio_router.delete("/monitor")
async def clear_api_monitor(current_subject: str = Depends(get_current_subject)):
    """Drop this caller's recorded API history so a debugging session starts clean."""
    api_monitor.clear(subject = current_subject)
    return {"cleared": True}


@studio_router.get("/monitor/{entry_id}")
async def get_api_monitor_entry(entry_id: str, current_subject: str = Depends(get_current_subject)):
    """Return full prompt/reply details for one OpenAI-compatible API request."""
    entry = api_monitor.get(entry_id, subject = current_subject)
    if entry is None:
        raise HTTPException(status_code = 404, detail = "Monitor entry not found")
    return entry


@studio_router.get("/active-generations")
async def get_active_generations(
    fastapi_request: Request, current_subject: str = Depends(get_current_subject)
):
    """Conversations currently generating, plus how many can decode at once.

    Lets a model swap name the chats it would interrupt, including runs this tab
    cannot see (another tab, or a reload behind a proxy). parallel_slots is the
    slot count actually in use, which the VRAM fit may have cut below the
    requested --parallel; chats beyond it queue rather than fail.
    """
    entries = active_generations.snapshot()
    for _entry in entries:
        if isinstance(_entry.get("model"), str):
            _entry["model"] = redact_native_paths(_entry["model"])
    slots = 1
    try:
        fn_cap = helpers.llama_admission_capacity
        if fn_cap:
            fn_be = helpers.llama_backend_getter or (lambda: None)
            slots = fn_cap(fastapi_request, fn_be())
        else:
            slots = int(getattr(fastapi_request.app.state, "llama_parallel_slots", 1) or 1)
    except Exception:
        slots = int(getattr(fastapi_request.app.state, "llama_parallel_slots", 1) or 1)
    return {
        "active": entries,
        "count": len(entries),
        "thread_ids": active_generations.active_thread_ids(),
        "parallel_slots": max(1, int(slots)),
    }
