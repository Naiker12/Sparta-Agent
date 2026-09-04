"""Anthropic-compatible Messages API (/v1/messages).

Extracted from monolithic routes/inference.py to preserve SRP and clean architecture.
Supports Anthropic tool calling, streaming SSE, count_tokens and passthrough pipelines.
"""
from __future__ import annotations

import asyncio
import base64
import io
import json
import logging
import sys
import threading
import time
import uuid
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Union

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from PIL import Image

from auth import get_current_subject
from core.inference.anthropic_compat import (
    AnthropicPassthroughEmitter,
    AnthropicStreamEmitter,
    anthropic_messages_to_openai,
    anthropic_schema_client_tool_kind,
    anthropic_tool_choice_to_openai,
    anthropic_tool_use_id,
    anthropic_tools_to_openai,
    build_anthropic_sse_event,
    openai_finish_to_anthropic_stop,
)
from core.inference.api_monitor import api_monitor
from core.inference.llama_admission import (
    LlamaAdmissionCancelled,
    LlamaAdmissionQueueFull,
    LlamaAdmissionTimeout,
)
from core.inference.passthrough_healing import (
    heal_gate,
    heal_openai_message_events,
    nudge_messages,
    nudge_enabled,
    nudge_should_retry,
    response_has_promotable_calls,
)
from state import active_generations
from models.inference import (
    AnthropicMessagesRequest,
    AnthropicMessagesResponse,
    AnthropicResponseTextBlock,
    AnthropicResponseToolUseBlock,
    AnthropicUsage,
    ChatCountTokensRequest,
)
from utils.api_errors import anthropic_error_body, openai_error_body

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_inference_module():
    return sys.modules.get("routes.inference")


def _get_inf_attr(name: str, fallback=None):
    mod = _get_inference_module()
    if mod and hasattr(mod, name):
        return getattr(mod, name)
    return fallback

def _request_has_image(payload):
    fn = _get_inf_attr("_request_has_image")
    return bool(fn(payload)) if fn else False

def _takes_tool_passthrough(payload, llama_backend):
    fn = _get_inf_attr("_takes_tool_passthrough")
    return bool(fn(payload, llama_backend)) if fn else False

def _passthrough_client_tools(payload):
    fn = _get_inf_attr("_passthrough_client_tools")
    return fn(payload) if fn else []

def _explicit_studio_tool_loop_requested(payload):
    fn = _get_inf_attr("_explicit_studio_tool_loop_requested")
    return bool(fn(payload)) if fn else False

def _display_tool_name_gate(name):
    fn = _get_inf_attr("_display_tool_name_gate")
    return fn(name) if fn else name

def _llama_status_checkpoint_id():
    fn = _get_inf_attr("_llama_status_checkpoint_id")
    return fn() if fn else None

def _anthropic_request_has_image(payload):
    fn = _get_inf_attr("_anthropic_request_has_image")
    return bool(fn(payload)) if fn else False

def _automatic_model_load_may_run():
    fn = _get_inf_attr("_automatic_model_load_may_run")
    return bool(fn()) if fn else False

def _monitor_prompt_from_messages(messages):
    fn = _get_inf_attr("_monitor_prompt_from_messages")
    return fn(messages) if fn else ""

def _monitor_anthropic_response(*args, **kwargs):
    fn = _get_inf_attr("_monitor_anthropic_response")
    if fn:
        return fn(*args, **kwargs)

def _monitor_perf_callback(*args, **kwargs):
    fn = _get_inf_attr("_monitor_perf_callback")
    if fn:
        return fn(*args, **kwargs)

async def _await_disconnect_then_cancel(*args, **kwargs):
    fn = _get_inf_attr("_await_disconnect_then_cancel")
    if fn:
        return await fn(*args, **kwargs)

async def _stop_local_disconnect_cancel_watcher(*args, **kwargs):
    fn = _get_inf_attr("_stop_local_disconnect_cancel_watcher")
    if fn:
        return await fn(*args, **kwargs)

async def _drain_pending_next_task(*args, **kwargs):
    fn = _get_inf_attr("_drain_pending_next_task")
    if fn:
        return await fn(*args, **kwargs)

async def _await_cancel_then_close(*args, **kwargs):
    fn = _get_inf_attr("_await_cancel_then_close")
    if fn:
        return await fn(*args, **kwargs)

async def _await_disconnect_then_close(*args, **kwargs):
    fn = _get_inf_attr("_await_disconnect_then_close")
    if fn:
        return await fn(*args, **kwargs)

def _cancelable_nonstreaming_client():
    fn = _get_inf_attr("_cancelable_nonstreaming_client")
    if fn:
        return fn()
    import httpx
    return httpx.AsyncClient(limits=httpx.Limits(max_connections=1, max_keepalive_connections=0), trust_env=False)

async def _await_cancel_or_disconnect_then_close_client(*args, **kwargs):
    fn = _get_inf_attr("_await_cancel_or_disconnect_then_close_client")
    if fn:
        return await fn(*args, **kwargs)



def get_llama_cpp_backend():
    fn = _get_inf_attr("get_llama_cpp_backend")
    if fn:
        return fn()
    from core.inference.llama_cpp import LlamaCppBackend
    return LlamaCppBackend()


def _friendly_error(e):
    fn = _get_inf_attr("_friendly_error")
    return fn(e) if fn else str(e)


def _friendly_upstream_error(text: str) -> str:
    fn = _get_inf_attr("_friendly_upstream_error")
    return fn(text) if fn else text


class _TrackedCancelProxy:
    def __call__(self, *args, **kwargs):
        cls = _get_inf_attr("_TrackedCancel")
        if cls:
            return cls(*args, **kwargs)
        from contextlib import nullcontext
        return nullcontext()

    def for_payload(self, *args, **kwargs):
        cls = _get_inf_attr("_TrackedCancel")
        if cls and hasattr(cls, "for_payload"):
            return cls.for_payload(*args, **kwargs)
        from contextlib import nullcontext
        return nullcontext()

_TrackedCancel = _TrackedCancelProxy()


def _send_stream_with_preheader_cancel(*args, **kwargs):
    fn = _get_inf_attr("_send_stream_with_preheader_cancel")
    if fn:
        return fn(*args, **kwargs)
    raise RuntimeError("_send_stream_with_preheader_cancel not available")


def _aclose_stream_resources(*args, **kwargs):
    fn = _get_inf_attr("_aclose_stream_resources")
    if fn:
        return fn(*args, **kwargs)


def _close_openai_admitted_stream_iterator(*args, **kwargs):
    fn = _get_inf_attr("_close_openai_admitted_stream_iterator")
    if fn:
        return fn(*args, **kwargs)


def _openai_llama_admission_reserve(*args, **kwargs):
    fn = _get_inf_attr("_openai_llama_admission_reserve")
    if fn:
        return fn(*args, **kwargs)
    return None


def _openai_admission_wait_stream_chunks(*args, **kwargs):
    fn = _get_inf_attr("_openai_admission_wait_stream_chunks")
    if fn:
        return fn(*args, **kwargs)
    raise RuntimeError("_openai_admission_wait_stream_chunks not available")


def _anthropic_admission_http_exception(*args, **kwargs):
    fn = _get_inf_attr("_anthropic_admission_http_exception")
    if fn:
        return fn(*args, **kwargs)
    return HTTPException(status_code=503, detail="Anthropic admission queue full")


def _release_admission(*args, **kwargs):
    fn = _get_inf_attr("_release_admission")
    if fn:
        return fn(*args, **kwargs)


def _release_unstarted_anthropic_stream(*args, **kwargs):
    fn = _get_inf_attr("_release_unstarted_anthropic_stream")
    if fn:
        return fn(*args, **kwargs)


def _tracked_cancel_unstarted_cleanup(*args, **kwargs):
    fn = _get_inf_attr("_tracked_cancel_unstarted_cleanup")
    if fn:
        return fn(*args, **kwargs)


def _aiter_llama_stream_items(*args, **kwargs):
    fn = _get_inf_attr("_aiter_llama_stream_items")
    if fn:
        return fn(*args, **kwargs)


def _classify_llama_generation_error(exc: Exception) -> Optional[bool]:
    fn = _get_inf_attr("_classify_llama_generation_error")
    return fn(exc) if fn else False


def _maybe_auto_switch_model(*args, **kwargs):
    fn = _get_inf_attr("_maybe_auto_switch_model")
    if fn:
        return fn(*args, **kwargs)


def _switch_model_for_payload(*args, **kwargs):
    fn = _get_inf_attr("_switch_model_for_payload")
    if fn:
        return fn(*args, **kwargs)


def _llama_public_model_id(llama_backend, fallback: Optional[str] = None) -> Optional[str]:
    fn = _get_inf_attr("_llama_public_model_id")
    return fn(llama_backend, fallback) if fn else fallback


def _llama_streaming_generation_timeout():
    fn = _get_inf_attr("_llama_streaming_generation_timeout")
    return fn() if fn else httpx.Timeout(60.0)


def _llama_non_streaming_generation_timeout():
    fn = _get_inf_attr("_llama_non_streaming_generation_timeout")
    return fn() if fn else httpx.Timeout(60.0)


def _llama_admission_log(*args, **kwargs):
    fn = _get_inf_attr("_llama_admission_log")
    if fn:
        fn(*args, **kwargs)


def _request_used_api_key(request: Any) -> bool:
    fn = _get_inf_attr("_request_used_api_key")
    return fn(request) if fn else False


def _no_model_loaded_error(*args, **kwargs):
    fn = _get_inf_attr("_no_model_loaded_error")
    if fn:
        return fn(*args, **kwargs)
    return HTTPException(status_code=503, detail="No model loaded")


def _no_model_loaded_detail():
    fn = _get_inf_attr("_no_model_loaded_detail")
    return fn() if fn else "No model loaded"


def _monitor_context_length():
    fn = _get_inf_attr("_monitor_context_length")
    return fn() if fn else None


def _model_json_response(*args, **kwargs):
    fn = _get_inf_attr("_model_json_response")
    if fn:
        return fn(*args, **kwargs)
    return JSONResponse(content={})


def _drop_parallel_tool_call_deltas(chunk) -> bool:
    fn = _get_inf_attr("_drop_parallel_tool_call_deltas")
    return fn(chunk) if fn else False


def _normalize_stop_sequences(raw):
    fn = _get_inf_attr("_normalize_stop_sequences")
    return fn(raw) if fn else (raw if isinstance(raw, list) else ([raw] if raw else None))


def _anthropic_stream_error_event(exc, *, force: bool = False):
    fn = _get_inf_attr("_anthropic_stream_error_event")
    if fn:
        return fn(exc, force=force)
    return f"event: error\ndata: {json.dumps({'error': {'message': str(exc)}})}\n\n"


def _sse_streaming_response(content, *, unstarted_cleanup = None):
    fn = _get_inf_attr("_sse_streaming_response")
    if fn:
        return fn(content, unstarted_cleanup=unstarted_cleanup)
    from fastapi.responses import StreamingResponse
    return StreamingResponse(content, media_type="text/event-stream")


def _extract_content_parts(messages: list):
    fn = _get_inf_attr("_extract_content_parts")
    if fn:
        return fn(messages)
    return "", [], []


def _drop_empty_assistant_sentinels(messages: list[dict]) -> list[dict]:
    fn = _get_inf_attr("_drop_empty_assistant_sentinels")
    return fn(messages) if fn else messages


def _coalesce_consecutive_user_turns(messages: list[dict]) -> list[dict]:
    fn = _get_inf_attr("_coalesce_consecutive_user_turns")
    return fn(messages) if fn else messages


def _strip_provider_synthetic_tool_history(messages: list[dict]) -> list[dict]:
    fn = _get_inf_attr("_strip_provider_synthetic_tool_history")
    return fn(messages) if fn else messages


def _effective_enable_tools(payload):
    fn = _get_inf_attr("_effective_enable_tools")
    return fn(payload) if fn else True


def _select_request_tools(payload, *, current_subject=None):
    fn = _get_inf_attr("_select_request_tools")
    return fn(payload, current_subject=current_subject) if fn else ([], None, False)


def _build_tool_action_nudge(*args, **kwargs):
    fn = _get_inf_attr("_build_tool_action_nudge")
    return fn(*args, **kwargs) if fn else None


def _apply_rag_nudge(*args, **kwargs):
    fn = _get_inf_attr("_apply_rag_nudge")
    if fn:
        return fn(*args, **kwargs)


def _wait_for_openai_admission_non_streaming(*args, **kwargs):
    fn = _get_inf_attr("_wait_for_openai_admission_non_streaming")
    if fn:
        return fn(*args, **kwargs)


def _strip_tool_xml_for_display(text: str) -> str:
    fn = _get_inf_attr("_strip_tool_xml_for_display")
    return fn(text) if fn else text


# Constants
_DEFAULT_FIRST_TOKEN_TIMEOUT_S = 60.0
_DEFAULT_MAX_TOKENS_FLOOR = 1
_LOCAL_TOOL_STREAM_STALL_KEEPALIVE_S = 15.0
_OPENAI_PASSTHROUGH_SSE_KEEPALIVE = b": keepalive\n\n"

# =====================================================================
# Anthropic-Compatible Messages API  (/messages → /v1/messages)
# =====================================================================


_STUDIO_ANTHROPIC_TOOL_ALIASES = {
    "web_search": "web_search",
    "web_search_20250305": "web_search",
    "web_fetch": "web_search",
    "web_fetch_20250910": "web_search",
    "web_fetch_20260209": "web_search",
    "python": "python",
    "terminal": "terminal",
}
# Server tools that never need a confirmation prompt (read-only / non code-
# executing; mirrors the unconditional-safe names in is_potentially_unsafe_tool_call).
# Any other selected tool (terminal, python, render_html) can require the gate
# this channel has no way to present, so an omitted permission_mode ("ask") only
# asks then. render_html is excluded because a networked canvas prompts in auto,
# and this channel invokes the loop without confirm; auto/ask reject, off/full run.
_ANTHROPIC_UNPROMPTED_SAFE_TOOLS = frozenset({"web_search", "search_knowledge_base"})


def _anthropic_selects_server_tools(
    payload, requested_studio_tools: set[str], has_client_tool: bool
) -> bool:
    """Whether THIS request asked Unsloth to run its own tools on the Messages channel.

    A process-wide ``--enable-tools`` is a default for ordinary chat, not a selection: reading
    it as one made the permission gate reject every plain request on a default server, and
    routing on it entered the local tool loop with terminal/python and nothing to confirm
    them. So only an explicit ask counts -- ``enable_tools``/``mcp_enabled``, or an Anthropic
    server-tool type in ``tools`` -- while ``--disable-tools`` and an explicit
    ``enable_tools: false`` still veto both, and a client-tool catalog is never stolen.
    """
    if has_client_tool or _effective_enable_tools(payload) is False:
        return False
    # enable_tools only, not the OpenAI path's mcp_enabled: this model is extra="allow", so
    # that key does arrive, but nothing here loads MCP schemas. Treating it as intent would
    # answer an MCP-only request with ALL_TOOLS' built-ins, or reject it for holding terminal.
    return payload.enable_tools is True or bool(requested_studio_tools)


def _anthropic_requested_studio_tools(tools: Optional[list]) -> set[str]:
    requested: set[str] = set()
    for tool in tools or []:
        td = tool if isinstance(tool, dict) else tool.model_dump()
        if td.get("input_schema") is not None or anthropic_schema_client_tool_kind(td) is not None:
            continue
        # Anthropic dispatches server tools by `type`, not bare `name`; matching
        # name too would let a malformed client tool like `{"name": "python"}`
        # silently flip into server-execution mode.
        type_ = td.get("type")
        if isinstance(type_, str) and type_ in _STUDIO_ANTHROPIC_TOOL_ALIASES:
            requested.add(_STUDIO_ANTHROPIC_TOOL_ALIASES[type_])
    return requested


def _select_anthropic_server_tools(
    all_tools: list[dict], requested_studio_tools: set[str], enabled_tools: Optional[list[str]]
) -> list[dict]:
    """Select Unsloth tools requested through Anthropic tools and extensions."""
    if not requested_studio_tools and enabled_tools is None:
        return all_tools

    selected_names = set(requested_studio_tools)
    if enabled_tools is not None:
        selected_names.update(enabled_tools)

    return [tool for tool in all_tools if tool["function"]["name"] in selected_names]


def _image_bytes_to_png_b64(raw: bytes) -> str:
    """Decode raw image bytes and re-encode to a base64-ascii PNG string.

    llama-server's stb_image only handles a few formats (JPEG/PNG/BMP/...); re-
    encoding to PNG keeps JPEG/WebP/... inputs loadable. Raises on undecodable
    input; callers wrap the call in ``try`` -> HTTPException(400)."""
    from PIL import Image

    img = Image.open(io.BytesIO(raw)).convert("RGB")
    buf = io.BytesIO()
    img.save(buf, format = "PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def _normalize_anthropic_openai_images(openai_messages: list[dict], is_vision: bool) -> bool:
    """Enforce the vision guard on translated Anthropic messages and normalize
    any base64-data-URL ``image_url`` parts to PNG.

    llama-server's stb_image only handles a few formats (JPEG/PNG/BMP/…);
    Anthropic clients commonly send JPEG or WebP, and Claude Code sends WebP.
    Re-encoding everything to PNG mirrors `_openai_messages_for_passthrough` /
    the GGUF branch of `/v1/chat/completions` so the two endpoints agree.

    Mutates ``openai_messages`` in place. Returns ``True`` when any image part
    was seen (so the caller can skip a second scan). Raises HTTPException(400)
    when images are present but the active model isn't a vision model, or when
    an image cannot be decoded.
    """
    has_image = False
    for msg in openai_messages:
        content = msg.get("content")
        if not isinstance(content, list):
            continue
        for part in content:
            if part.get("type") != "image_url":
                continue

            has_image = True
            if not is_vision:
                raise HTTPException(
                    status_code = 400,
                    detail = "Image provided but current GGUF model does not support vision.",
                )

            url = (part.get("image_url") or {}).get("url", "")
            if not url.startswith("data:"):
                # Remote URLs are forwarded as-is; llama-server will
                # fetch (or fail) per its own support matrix.
                continue

            try:
                _, b64data = url.split(",", 1)
                raw = base64.b64decode(b64data)
                png_b64 = _image_bytes_to_png_b64(raw)
            except Exception:
                raise HTTPException(
                    status_code = 400,
                    detail = "Failed to process image.",
                )
            part["image_url"] = {"url": f"data:image/png;base64,{png_b64}"}

    return has_image


def _validate_anthropic_client_tools(tools) -> None:
    # Reject malformed client tools before any model load, so an invalid request
    # never evicts the loaded model. AnthropicTool relaxed name/input_schema to
    # Optional for server tools, so the converter silently drops incomplete
    # entries; surface them as 400 here. Recognized Anthropic-schema client
    # tools use type/name without input_schema; other type declarations are
    # server tools (unrecognized server tools remain no-ops).
    for tool in tools or []:
        td = tool if isinstance(tool, dict) else tool.model_dump()
        name, type_, schema = td.get("name"), td.get("type"), td.get("input_schema")
        schema_client_kind = anthropic_schema_client_tool_kind(td)
        if schema is None and not isinstance(type_, str):
            raise HTTPException(
                status_code = 400,
                detail = f"Tool {name!r} is missing required field 'input_schema'.",
            )
        if (schema is not None or schema_client_kind is not None) and (
            not isinstance(name, str) or not name
        ):
            raise HTTPException(
                status_code = 400,
                detail = "Client tool is missing required field 'name'.",
            )


def _append_to_codex_instructions(messages: list[dict], addition: str) -> list[dict]:
    """Append text to the leading system message, or prepend one.

    Not _append_to_system_message: that one also accepts a `developer` turn, but
    _responses_input folds only `system` turns into the Responses instructions
    and drops every other role bar user/assistant/tool, so text parked on a
    developer message never reaches the model. `developer` is an accepted
    ChatMessage role, so a request can carry one and no system turn at all.
    """
    if not addition:
        return messages
    copied = [dict(msg) for msg in messages]
    for msg in copied:
        if msg.get("role") != "system":
            continue
        content = msg.get("content", "")
        if isinstance(content, str):
            msg["content"] = content.rstrip() + "\n\n" + addition
            return copied
    return [{"role": "system", "content": addition}, *copied]


def _append_to_system_message(messages: list[dict], addition: str) -> list[dict]:
    """Append text to the leading system/developer message, or prepend one."""
    if not addition:
        return messages
    copied = [dict(msg) for msg in messages]
    for msg in copied:
        if msg.get("role") not in ("system", "developer"):
            continue
        content = msg.get("content", "")
        if isinstance(content, str):
            msg["content"] = content.rstrip() + "\n\n" + addition
            return copied
    return [{"role": "system", "content": addition}, *copied]


@router.post("/chat/count_tokens")
async def chat_count_tokens(
    payload: ChatCountTokensRequest, current_subject: str = Depends(get_current_subject)
):
    """Count prompt tokens for OpenAI-form chat messages using the loaded tokenizer.

    Unlike the /v1 count endpoints this never auto-switches: ``model`` is informational. The
    caller is a background recount with no abort signal, so switching could drag the backend back
    to the model loaded when the count started, a reload the client's guards cannot undo."""
    # Admitted only while nothing generates, and stood down at the next checkpoint if that changes:
    # admission is not atomic with the work, and true mutual exclusion would put a lock in front of
    # generation startup, which is the cost this avoids. Refusing here also covers the second tab or
    # the script against /api that the client-side gate cannot. Deliberately coarse: _TrackedCancel
    # registers external-provider runs too, so those decline a count they could have served;
    # narrowing it means trusting a kind/model field to decide whether to work next to a decode, and
    # being wrong there costs inference time while over-refusing only costs a redraw.
    if active_generations.count() > 0:
        raise HTTPException(
            status_code = 503,
            detail = "Cannot count tokens while a generation is in progress.",
        )

    # /apply-template swaps each image for a short media marker, so refuse rather than undercount.
    if _request_has_image(payload):
        raise HTTPException(
            status_code = 503,
            detail = "Cannot count tokens for messages containing images.",
        )
    # Same for audio: the completion injects the recording, this cannot.
    if getattr(payload, "audio_base64", None):
        raise HTTPException(
            status_code = 503,
            detail = "Cannot count tokens for messages containing audio.",
        )
    # And video, whose frames llama-server samples at completion time.
    if getattr(payload, "video_base64", None):
        raise HTTPException(
            status_code = 503,
            detail = "Cannot count tokens for messages containing video.",
        )

    llama_backend = get_llama_cpp_backend()
    if not llama_backend.is_loaded:
        raise HTTPException(
            status_code = 503,
            detail = _no_model_loaded_detail("No GGUF model loaded. Load a GGUF model first."),
        )

    # Same sanitization the GGUF chat path runs before generation. Route FIRST: the passthrough
    # does not merge adjacent user turns, so coalescing here would price a prompt it never sends
    # (two user turns split by an empty assistant sentinel, after a stopped response).
    _takes_passthrough = _takes_tool_passthrough(payload, llama_backend)
    openai_messages = _strip_provider_synthetic_tool_history(
        _drop_empty_assistant_sentinels([m.model_dump(exclude_none = True) for m in payload.messages])
    )
    if not _takes_passthrough:
        openai_messages = _coalesce_consecutive_user_turns(openai_messages)
    _system_prompt, _, _ = _extract_content_parts(payload.messages)
    openai_messages = _set_or_prepend_system_message(openai_messages, _system_prompt)

    # A PENDING turn (unanswered user message or tool result) is the one shape the tool loop
    # answers from exactly these messages, splicing in whatever build_rag_autoinject retrieves --
    # thousands of tokens this never sees, so the bar would claim room the generation lacks. Any
    # other shape ends on an assistant turn, where retrieval has no user message to run against.
    if (
        payload.rag_scope
        and openai_messages
        and openai_messages[-1].get("role") in ("user", "tool")
    ):
        raise HTTPException(
            status_code = 503,
            detail = "Cannot count tokens for a pending turn that would retrieve documents.",
        )

    # The passthrough is the only route that puts the caller's own catalog on the wire; every other
    # renders from the selection below, so a catalog surviving here would price schemas never sent.
    openai_tools = _passthrough_client_tools(payload) if _takes_passthrough else None
    # The CLI hard-override still applies: _effective_enable_tools resolves it into _tools_on.
    _client_disabled_tool_calls = getattr(payload, "tool_choice", None) == "none" and not (
        _explicit_studio_tool_loop_requested(payload) and llama_backend.supports_tools
    )
    # Schemas and the nudge are a large share of the prompt: price the completion's own selection.
    _tools_on = False if _client_disabled_tool_calls else _effective_enable_tools(payload)
    # Same rule the completion path resolves, so the two agree on whether MCP schemas are in the
    # prompt at all. MCP alone turns tools on there, hence the widened branch below.
    from state.tool_policy import get_tool_policy as _get_tool_policy_ct

    _mcp_on = (
        not _client_disabled_tool_calls
        and bool(getattr(payload, "mcp_enabled", False))
        and _get_tool_policy_ct() is not False
    )
    # Never discovery on a count: get_enabled_mcp_tools spawns stdio servers, writes cache and
    # cool-off state, and blocks a probe timeout on a server that is down. _mcp_allowed stays
    # False because it is the flag that reaches the network; schemas come from the cache that
    # path fills instead, and an incomplete view is declined rather than undercounted.
    _mcp_allowed = False
    _mcp_tools: list[dict] = []
    if _mcp_on and not _takes_passthrough and llama_backend.supports_tools:
        from core.inference.tools import cached_mcp_tools
        _mcp_tools, _mcp_complete = cached_mcp_tools()
        if not _mcp_complete:
            raise HTTPException(
                status_code = 503,
                detail = "Cannot count tokens until enabled MCP tools have been discovered.",
            )
    if not _takes_passthrough and (_tools_on or _mcp_on) and llama_backend.supports_tools:
        tools_to_use = await _select_request_tools(
            payload, tools_on = _tools_on, mcp_allowed = _mcp_allowed
        )
        # Appended in the position _select_request_tools would have used, so the order matches.
        tools_to_use = tools_to_use + _mcp_tools
        if tools_to_use:
            openai_tools = tools_to_use
            openai_messages = _append_to_system_message(
                openai_messages,
                _apply_rag_nudge(
                    _build_tool_action_nudge(
                        tools = tools_to_use,
                        model_name = _llama_public_model_id(llama_backend, payload.model),
                        full_access = bool(payload.bypass_permissions),
                    ),
                    tools_to_use,
                    rag_scope = payload.rag_scope,
                ),
            )

            # The GGUF tool path strips leaked markup from replayed history before rendering,
            # so without the same strip the count prices text it removes.
            _count_auto_heal = (
                payload.auto_heal_tool_calls if payload.auto_heal_tool_calls is not None else True
            )
            _count_history_gate = _display_tool_name_gate(tools_to_use)
            openai_messages = [dict(msg) for msg in openai_messages]
            for _msg in openai_messages:
                if _msg.get("role") == "assistant" and isinstance(_msg.get("content"), str):
                    _msg["content"] = _strip_tool_xml_for_display(
                        _msg["content"],
                        auto_heal_tool_calls = _count_auto_heal,
                        enabled_tool_names = _count_history_gate,
                    ).strip()

    # Nothing survived the resolution above, so the template would render its generation marker
    # alone and the total would describe a conversation nobody has started (#8882). Decided here
    # because only this side knows whether `--enable-tools` put schemas in an otherwise bare prompt,
    # and the passthrough's own catalog renders with no message to carry it.
    if not openai_messages and not openai_tools:
        raise HTTPException(
            status_code = 503,
            detail = "Cannot count tokens for an empty prompt.",
        )

    # llama-server falls back to the load-time --chat-template-kwargs per key a request omits,
    # so omitting these prices the template in whatever mode the model was LOADED in.
    _template_kwargs = llama_backend._request_reasoning_kwargs(
        payload.enable_thinking,
        payload.reasoning_effort,
        payload.preserve_thinking,
    )

    # Whose tokenizer this is, in the shape /api/inference/status publishes: another tab's load
    # moves it while the caller's own checkpoint guard sees no change, so report and let it drop.
    _tokenizer_model = _llama_status_checkpoint_id(llama_backend)

    # Re-checked immediately before the only work that reaches llama-server, because everything
    # between here and the entry check awaits, so a run can have started in the gap.
    if active_generations.count() > 0:
        raise HTTPException(
            status_code = 503,
            detail = "Cannot count tokens while a generation is in progress.",
        )

    from core.inference.llama_cpp import CountAborted

    try:
        count = await asyncio.to_thread(
            llama_backend.count_chat_tokens,
            openai_messages,
            None,
            openai_tools,
            strict = True,
            chat_template_kwargs = _template_kwargs,
            # Polled between /apply-template and /tokenize: admission and the work are separate
            # steps, so a run starting in between is caught here and the second round trip is not.
            should_abort = lambda: active_generations.count() > 0,
        )
    except CountAborted:
        raise HTTPException(
            status_code = 503,
            detail = "Cannot count tokens while a generation is in progress.",
        )
    except Exception:
        raise HTTPException(
            status_code = 503,
            detail = "Unable to count tokens with the loaded model tokenizer.",
        )
    # A load landing mid-count leaves the total attributable to neither model.
    if _llama_status_checkpoint_id(llama_backend) != _tokenizer_model:
        raise HTTPException(
            status_code = 503,
            detail = "The loaded model changed while counting tokens.",
        )
    return JSONResponse(content = {"input_tokens": int(count), "model": _tokenizer_model})


@router.post("/messages/count_tokens")
async def anthropic_count_tokens(
    payload: AnthropicMessagesRequest,
    request: Request,
    current_subject: str = Depends(get_current_subject),
):
    """Anthropic-compatible token-counting endpoint (POST /v1/messages/count_tokens).

    Translates the Anthropic request to OpenAI form (the same translation the
    /messages handler uses), counts prompt tokens with the loaded GGUF model's
    tokenizer, and returns ``{"input_tokens": int}`` only. Unlike /messages,
    max_tokens is NOT required here.
    """
    # Reject malformed tools before the switch, like /messages, so an invalid
    # count request can't evict the loaded model.
    _validate_anthropic_client_tools(payload.tools)
    # Count with the requested model's tokenizer, like the sibling /messages.
    # Carry the vision guard too: an image count naming a text-only GGUF must not
    # evict a loaded vision model for a swap that can't serve the request.
    await _maybe_auto_switch_model(
        _switch_model_for_payload(payload),
        request,
        current_subject,
        require_vision = _anthropic_request_has_image(payload),
    )

    llama_backend = get_llama_cpp_backend()
    if not llama_backend.is_loaded:
        _status, _detail = await _no_model_loaded_error(
            "No GGUF model loaded. Load a GGUF model first.",
            _switch_model_for_payload(payload),
            request,
            status = 503,
        )
        raise HTTPException(status_code = _status, detail = _detail)

    # Same Anthropic → OpenAI translation as anthropic_messages: system is
    # folded into the messages list, so pass system=None to the counter.
    openai_messages = anthropic_messages_to_openai(
        [m.model_dump() for m in payload.messages],
        payload.system,
    )
    # Apply the same sanitization /messages does before generation, so the count
    # matches the prompt the real request would build (otherwise empty-assistant
    # sentinels / synthetic tool history inflate the count or hit the fallback).
    # Coalesce adjacent user turns left behind by dropping an empty / null assistant
    # turn, so a strict GGUF chat template does not 400 on non-alternating roles
    # (mirrors the GGUF chat path); a no-op for already-alternating histories.
    openai_messages = _coalesce_consecutive_user_turns(
        _strip_provider_synthetic_tool_history(_drop_empty_assistant_sentinels(openai_messages))
    )
    openai_tools = anthropic_tools_to_openai(payload.tools or []) or None

    try:
        count = await asyncio.to_thread(
            llama_backend.count_chat_tokens,
            openai_messages,
            None,
            openai_tools,
            strict = True,
        )
    except Exception:
        raise HTTPException(
            status_code = 503,
            detail = "Unable to count tokens with the loaded model tokenizer.",
        )
    return JSONResponse(content = {"input_tokens": int(count)})


def _set_or_prepend_system_message(
    messages: Optional[list[dict]], system_prompt: str
) -> list[dict]:
    """Return messages with a single leading system prompt, preserving multimodal parts."""
    safe_messages = messages or []
    if not system_prompt:
        return safe_messages

    # Drop existing system/developer turns so the backend never sees duplicate
    # or conflicting system instructions, then prepend the resolved prompt.
    others = [dict(msg) for msg in safe_messages if msg.get("role") not in ("system", "developer")]
    return [{"role": "system", "content": system_prompt}, *others]


@router.post("/messages")
async def anthropic_messages(
    payload: AnthropicMessagesRequest,
    request: Request,
    current_subject: str = Depends(get_current_subject),
):
    """
    Anthropic-compatible Messages API endpoint.

    Translates Anthropic message format to internal OpenAI format, runs through
    the existing agentic tool loop when tools are provided, and returns
    responses in Anthropic Messages API format (streaming SSE or non-streaming
    JSON).
    """
    llama_backend = get_llama_cpp_backend()

    # Default-off parity: with no automatic load possible and nothing loaded, 503
    # before any request-shape check, exactly as the pre-feature endpoint did. When
    # an automatic load can run (auto-switch or a standalone idle TTL), fall through
    # so validation runs before the reload hook gets a chance to restore the model.
    # Plain detail, not _no_model_loaded_error: that helper leaves this case unchanged.
    if not llama_backend.is_loaded and not _automatic_model_load_may_run():
        raise HTTPException(
            status_code = 503,
            detail = _no_model_loaded_detail("No GGUF model loaded. Load a GGUF model first."),
        )

    # max_tokens is a required field on the Anthropic Messages API; real Anthropic
    # returns a 400 invalid_request_error when it is omitted. Validate before
    # auto-switch so a rejected request never triggers a model load.
    if payload.max_tokens is None:
        raise HTTPException(
            status_code = 400,
            detail = anthropic_error_body(
                "max_tokens: field required",
                status = 400,
                err_type = "invalid_request_error",
            ),
        )

    # Reject malformed client tools before any model load (see helper), so an
    # invalid request never evicts the loaded model.
    _validate_anthropic_client_tools(payload.tools)

    # Mixing Anthropic server tools with custom client tools is unsupported (the
    # server-tool loop can't relay client functions back to the caller). Reject
    # before the switch too -- it depends only on the payload -- so an invalid
    # request never evicts the loaded model. Reused below for tool routing.
    requested_studio_tools = _anthropic_requested_studio_tools(payload.tools)
    _has_client_tool = any(
        (t if isinstance(t, dict) else t.model_dump()).get("input_schema") is not None
        or anthropic_schema_client_tool_kind(t) is not None
        for t in payload.tools or []
    )
    _explicit_server_tools = bool(requested_studio_tools) or (
        payload.enable_tools is True and _effective_enable_tools(payload) is not False
    )
    if _explicit_server_tools and _has_client_tool:
        raise HTTPException(
            status_code = 400,
            detail = (
                "Mixing Anthropic server tools (e.g. web_search_20250305) "
                "with custom client tools in a single request is not "
                "supported. Send them in separate requests."
            ),
        )

    # Reject an unsupported confirm-gated permission mode for Unsloth's own
    # ("server") Anthropic tools before the switch, mirroring the malformed- and
    # mixed-tool checks above. ask always wants a per-call pause this passthrough
    # cannot offer, so it 400s whenever server tools are selected. auto only needs
    # the gate for an unsafe call, so (like the omitted default) it runs for a
    # safe-only selection (web_search/RAG) and 400s when a gate-needing tool is
    # selected (local terminal/python, or render_html whose networked canvas
    # prompts and cannot be gated on this channel). Rejecting must happen before the
    # switch so an invalid request never evicts the resident model; it is
    # determined from the requested tools alone (backend tool support is only known
    # post-switch); an image request can never take the server-tool path, so it is
    # excluded as in the server_tools gate below. off/full and an explicit
    # confirm_tool_calls=False opt-out always pass.
    # A process-wide ``--enable-tools`` policy is only a default for ordinary
    # chat. It must not steal an explicit Anthropic client-tool catalog (Claude
    # Code's Write/Edit/Bash tools) and turn it into Unsloth's local tool loop.
    # An explicit per-request server-tool ask was rejected as mixed mode above.
    _selects_server_tools = _anthropic_selects_server_tools(
        payload, requested_studio_tools, _has_client_tool
    )
    _server_tools_requested_pre = _selects_server_tools and not _anthropic_request_has_image(
        payload
    )
    if _server_tools_requested_pre:
        from core.inference.tools import ALL_TOOLS as _ALL_TOOLS_PRE

        _selected_pre = _select_anthropic_server_tools(
            _ALL_TOOLS_PRE, requested_studio_tools, payload.enabled_tools
        )
        _perm_mode_pre = getattr(payload, "permission_mode", None)
        _confirm_opt_out_pre = getattr(payload, "confirm_tool_calls", None) is False
        _gated_tool_selected_pre = any(
            tool["function"]["name"] not in _ANTHROPIC_UNPROMPTED_SAFE_TOOLS
            for tool in _selected_pre
        )
        # An explicit confirm_tool_calls=False opts out of the gate entirely (it
        # wins over the mode, mirroring _permission_mode_confirm and the GGUF path),
        # so it never rejects -- not even under ask.
        if not _confirm_opt_out_pre and (
            _perm_mode_pre == "ask"
            or (_perm_mode_pre in ("auto", None) and _gated_tool_selected_pre)
        ):
            raise HTTPException(
                status_code = 400,
                detail = anthropic_error_body(
                    "permission_mode 'ask' has no confirmation channel for Anthropic "
                    "Messages server tools, and 'auto' (or the omitted default) cannot "
                    "gate a local 'terminal'/'python' tool here; set 'off' or 'full'.",
                    status = 400,
                    err_type = "invalid_request_error",
                ),
            )

    # require_vision rejects a swap to a text-only target before it runs, so an
    # image request can't evict the resident vision model only to hit the vision
    # guard (_normalize_anthropic_openai_images) below after the load.
    await _maybe_auto_switch_model(
        _switch_model_for_payload(payload),
        request,
        current_subject,
        require_vision = _anthropic_request_has_image(payload),
    )
    if not llama_backend.is_loaded:
        _status, _detail = await _no_model_loaded_error(
            "No GGUF model loaded. Load a GGUF model first.",
            _switch_model_for_payload(payload),
            request,
            status = 503,
        )
        raise HTTPException(status_code = _status, detail = _detail)

    # Advertised repo id after an auto-switch load, else a clean public id, never
    # the local .gguf path (and a legacy raw path in payload.model is sanitized).
    model_name = _llama_public_model_id(llama_backend, payload.model)
    message_id = f"msg_{uuid.uuid4().hex[:24]}"

    # ── Translate Anthropic → OpenAI ──────────────────────────
    openai_messages = anthropic_messages_to_openai(
        [m.model_dump() for m in payload.messages],
        payload.system,
    )
    # Strip synthetic provider-side builtin tool history (web_search,
    # web_fetch, code_execution, image_generation cards tagged with
    # _server_tool or extra_content.google.native_part) before handing off to
    # local llama-server. The local /v1/chat/completions and GGUF passthrough
    # builders apply the same strip; without it an Anthropic /v1/messages caller
    # replaying a prior provider-side tool_use forwards fake builtin tool
    # history to a backend with no matching function declarations.
    # Coalesce adjacent user turns left behind by dropping an empty / null assistant
    # turn, so a strict GGUF chat template does not 400 on non-alternating roles
    # (mirrors the GGUF chat path); a no-op for already-alternating histories.
    openai_messages = _coalesce_consecutive_user_turns(
        _strip_provider_synthetic_tool_history(_drop_empty_assistant_sentinels(openai_messages))
    )

    # Enforce vision guard + re-encode embedded images to PNG so the Anthropic
    # endpoint matches /v1/chat/completions.
    if _anthropic_request_has_image(payload):
        _has_image = await asyncio.to_thread(
            _normalize_anthropic_openai_images,
            openai_messages,
            llama_backend.is_vision,
        )
    else:
        _has_image = _normalize_anthropic_openai_images(
            openai_messages,
            llama_backend.is_vision,
        )

    # Fill omitted sampling fields with the per-model recommendation (or an operator
    # UNSLOTH_SAMPLING_* pin); an explicit client value wins unless the operator pinned it.
    # Anthropic sampling fields are Optional, so None already marks "client omitted".
    from utils.inference.inference_config import resolve_effective_sampling

    _anthropic_sampling = resolve_effective_sampling(
        getattr(llama_backend, "model_identifier", None) or model_name,
        {
            "temperature": payload.temperature,
            "top_p": payload.top_p,
            "top_k": payload.top_k,
            "min_p": payload.min_p,
            "repetition_penalty": payload.repetition_penalty,
            "presence_penalty": payload.presence_penalty,
        },
    )
    temperature = _anthropic_sampling["temperature"]
    top_p = _anthropic_sampling["top_p"]
    top_k = _anthropic_sampling["top_k"]
    min_p = _anthropic_sampling["min_p"]
    repetition_penalty = _anthropic_sampling["repetition_penalty"]
    presence_penalty = _anthropic_sampling["presence_penalty"]
    stop = payload.stop_sequences or None

    # Translate Anthropic tool_choice to OpenAI format for llama-server. Falls
    # back to "auto" when unset or unrecognized (prior hardcoded behavior).
    openai_tool_choice = anthropic_tool_choice_to_openai(payload.tool_choice)
    if openai_tool_choice is None:
        openai_tool_choice = "auto"

    cancel_event = threading.Event()

    # ── Tool routing ──────────────────────────────────────────
    # Three paths:
    # 1. enable_tools=true → server-side execution of built-in tools (Unsloth shorthand)
    # 2. tools=[...] only  → client-side pass-through (standard Anthropic behavior)
    # 3. neither           → plain chat
    # The server-side agentic loop doesn't support multimodal input -- matches
    # the `not image_b64` gate in /v1/chat/completions. requested_studio_tools and
    # the mixed-mode rejection were computed before the switch above.
    openai_client_tools = [
        tool
        for tool in anthropic_tools_to_openai(payload.tools or [])
        if tool.get("function", {}).get("name") not in requested_studio_tools
    ]

    # An Anthropic server-tool declaration implies server-tool mode, but only
    # when tools aren't explicitly disabled (CLI --disable-tools or per-request
    # enable_tools=false). Explicit False always wins. Same predicate as the
    # permission gate above: deciding "did this request select server tools"
    # twice is what let the gate reject requests the router then served.
    server_tools = _selects_server_tools and llama_backend.supports_tools and not _has_image
    client_tools = (
        not server_tools
        and len(openai_client_tools) > 0
        and getattr(llama_backend, "supports_tool_passthrough", llama_backend.supports_tools)
    )

    # Anthropic tool_choice.disable_parallel_tool_use caps the response to a
    # single tool_use block. Computed here so BOTH the client-tool passthrough
    # and the server-tool path honor it.
    _disable_parallel = bool(
        isinstance(payload.tool_choice, dict)
        and payload.tool_choice.get("disable_parallel_tool_use")
    )

    monitor_id = None
    monitor_context_length = _monitor_context_length()
    request_state = getattr(request, "state", None)
    if not getattr(request_state, "skip_api_monitor", False):
        request_url = getattr(request, "url", None)
        monitor_id = api_monitor.start(
            endpoint = getattr(request_url, "path", "/v1/messages"),
            method = getattr(request, "method", "POST"),
            via_api_key = _request_used_api_key(request),
            model = model_name,
            prompt = _monitor_prompt_from_messages(openai_messages),
            context_length = monitor_context_length,
            subject = current_subject,
        )

    async def _monitored_anthropic(coro):
        try:
            response = await coro
        except asyncio.CancelledError:
            cancel_event.set()
            api_monitor.finish(monitor_id, "cancelled")
            raise
        except Exception as exc:
            api_monitor.fail(monitor_id, _friendly_error(exc))
            raise
        return _monitor_anthropic_response(
            response,
            monitor_id,
            monitor_context_length,
            cancel_event,
        )

    async def _tracked_anthropic_non_streaming(coro):
        """Register a non-streaming /v1/messages run with the swap gate.

        `stream` defaults to false, so this is the route's common shape, and all
        three helpers hold llama-server for the whole await. /unload runs no idle
        drain, so unregistered a swap tore the server down mid-request; only the
        streaming siblings registered. No cancel keys, unlike the streaming
        tool/plain siblings: the gate reaches a run through the registry, and
        keys would add a cancel surface to a public API.
        """
        _tracker = _TrackedCancel(cancel_event, model = model_name, kind = "messages")
        _tracker.__enter__()
        try:
            return await _monitored_anthropic(coro)
        finally:
            # _monitored_anthropic's bookkeeping can throw; a leaked entry 409s later swaps.
            _tracker.__exit__(None, None, None)

    # ── Admission control ─────────────────────────────────────
    # Bound concurrent llama-server generations to the backend's serving slots via a
    # FIFO queue keyed by base_url (shared with /v1/chat/completions, same slots).
    # Excess requests queue; a streaming waiter gets SSE keep-alives, the queue 429s
    # once full. Mirrors the OpenAI passthrough admission wiring. Streaming takes the
    # slot when the response is built and drops it when the body finishes or is
    # abandoned; the non-stream path holds it across the single awaited generation.
    _anthropic_admission_mode = "anthropic_stream" if payload.stream else "anthropic_nonstream"

    async def _admitted_anthropic_stream(
        orig_body,
        reservation,
        admission_config,
        stream_lease,
        prior_cleanup = None,
    ):
        lease = stream_lease
        stream_cancelled = False
        body_started = False
        wait_started_at = None
        try:
            if lease is None:
                wait_started_at = time.monotonic()
                _llama_admission_log(
                    "queued",
                    reservation,
                    request = request,
                    mode = _anthropic_admission_mode,
                )
                async for wait_item in _openai_admission_wait_stream_chunks(
                    reservation,
                    admission_config,
                    request = request,
                    cancel_event = cancel_event,
                ):
                    if isinstance(wait_item, str):
                        yield wait_item
                        continue
                    lease = wait_item
                    break
                _llama_admission_log(
                    "granted-after-wait",
                    reservation,
                    request = request,
                    mode = _anthropic_admission_mode,
                    wait_started_at = wait_started_at,
                )
            if lease is None:
                return
            body_started = True
            async for chunk in orig_body:
                yield chunk
        except asyncio.CancelledError:
            # Must reach the monitored generator as CancelledError, not aclose's
            # GeneratorExit, or its handler never finalizes the monitor entry.
            stream_cancelled = True
            raise
        except LlamaAdmissionTimeout as exc:
            api_monitor.fail(monitor_id, str(exc))
            _llama_admission_log(
                "timeout",
                reservation,
                request = request,
                mode = _anthropic_admission_mode,
                wait_started_at = wait_started_at,
                level = "warning",
            )
            yield build_anthropic_sse_event(
                "error",
                anthropic_error_body(str(exc), status = 503),
            )
        except LlamaAdmissionCancelled:
            _llama_admission_log(
                "cancelled-before-upstream",
                reservation,
                request = request,
                mode = _anthropic_admission_mode,
                wait_started_at = wait_started_at,
            )
            return
        finally:
            # Closing can raise (a raw body re-raises CancelledError after
            # teardown), and a slot lost that way never comes back: with no queue
            # timeout the pool just shrinks and later callers wait forever. Keep
            # the release in its own finally, as the /responses wiring does.
            try:
                if body_started:
                    await _close_openai_admitted_stream_iterator(
                        orig_body,
                        cancelled = stream_cancelled,
                    )
                else:
                    # Gave up while queued: the monitored body never ran, so nothing
                    # downstream finalizes the entry or exits the response's tracker.
                    api_monitor.finish(monitor_id, "cancelled")
                    await _release_unstarted_anthropic_stream(orig_body, prior_cleanup)
            finally:
                if lease is not None:
                    lease.release()
                else:
                    reservation.cancel()

    async def _admitted_anthropic(coro):
        try:
            reservation, admission_config = _openai_llama_admission_reserve(
                request = request, llama_backend = llama_backend
            )
        except LlamaAdmissionQueueFull as exc:
            coro.close()
            api_monitor.fail(monitor_id, str(exc))
            _llama_admission_log(
                "queue-full",
                snapshot = getattr(exc, "snapshot", None),
                request = request,
                mode = _anthropic_admission_mode,
                level = "warning",
            )
            raise _anthropic_admission_http_exception(exc, status_code = 429)
        except BaseException:
            # Reserving never awaited the generation, so close it rather than
            # leave an un-awaited coroutine behind.
            coro.close()
            raise

        if payload.stream:
            stream_lease = reservation.lease_nowait()
            # Set up the stream (token count + tracker enter) and surface a pre-response
            # cancel now, exactly as the un-admitted path did; the upstream generation is
            # deferred to body iteration, so the slot is only held while tokens flow.
            try:
                # Token counting calls llama-server, so a dead backend raises here
                # with the slot already taken. cancel() covers both cases: it
                # releases the lease if one was granted, else drops the waiter.
                monitored = await _monitored_anthropic(coro)
            except BaseException:
                reservation.cancel()
                raise
            orig_body = getattr(monitored, "body_iterator", None)
            if orig_body is None:
                reservation.cancel()
                return monitored

            # Replacing body_iterator would strand the response's own pre-start
            # hook (the passthrough uses one to exit its cancel tracker), so chain
            # to it instead of clobbering it.
            prior_cleanup = getattr(monitored, "_unstarted_cleanup", None)

            async def _unstarted_cleanup() -> None:
                # The body never ran, so nothing else closes out the monitor entry.
                api_monitor.finish(monitor_id, "cancelled")
                try:
                    await _release_unstarted_anthropic_stream(orig_body, prior_cleanup)
                finally:
                    # A BaseException here is swallowed upstream, so releasing
                    # outside the finally would shrink the pool silently.
                    reservation.cancel()

            monitored.body_iterator = _admitted_anthropic_stream(
                orig_body, reservation, admission_config, stream_lease, prior_cleanup
            )
            monitored._unstarted_cleanup = _unstarted_cleanup
            return monitored

        lease = None
        try:
            lease = await _wait_for_openai_admission_non_streaming(
                reservation,
                admission_config,
                request = request,
                cancel_event = cancel_event,
            )
            # Registered only once admitted: a queued request is not holding
            # llama-server, so it has no business blocking a swap.
            monitored = await _tracked_anthropic_non_streaming(coro)
            return monitored
        except LlamaAdmissionTimeout as exc:
            coro.close()
            api_monitor.fail(monitor_id, str(exc))
            raise _anthropic_admission_http_exception(exc, status_code = 503)
        except LlamaAdmissionCancelled as exc:
            coro.close()
            api_monitor.finish(monitor_id, "cancelled")
            raise _anthropic_admission_http_exception(exc, status_code = 499)
        except BaseException:
            # Cancelled while queued (shutdown, outer task cancel): the generation
            # coroutine was never awaited, so close it rather than leak it.
            if lease is None:
                coro.close()
                api_monitor.finish(monitor_id, "cancelled")
            raise
        finally:
            if lease is not None:
                lease.release()
            else:
                reservation.cancel()

    # ── Client-side pass-through path ─────────────────────────
    if client_tools:
        openai_tools = openai_client_tools

        if payload.stream:
            return await _admitted_anthropic(
                _anthropic_passthrough_stream(
                    request,
                    cancel_event,
                    llama_backend,
                    openai_messages,
                    openai_tools,
                    temperature,
                    top_p,
                    top_k,
                    payload.max_tokens,
                    message_id,
                    model_name,
                    stop = stop,
                    min_p = min_p,
                    repetition_penalty = repetition_penalty,
                    presence_penalty = presence_penalty,
                    tool_choice = openai_tool_choice,
                    session_id = payload.session_id,
                    cancel_id = payload.cancel_id,
                    disable_parallel_tool_use = _disable_parallel,
                    auto_heal_tool_calls = payload.auto_heal_tool_calls,
                )
            )
        return await _admitted_anthropic(
            _anthropic_passthrough_non_streaming(
                llama_backend,
                openai_messages,
                openai_tools,
                temperature,
                top_p,
                top_k,
                payload.max_tokens,
                message_id,
                model_name,
                stop = stop,
                min_p = min_p,
                repetition_penalty = repetition_penalty,
                presence_penalty = presence_penalty,
                tool_choice = openai_tool_choice,
                disable_parallel_tool_use = _disable_parallel,
                auto_heal_tool_calls = payload.auto_heal_tool_calls,
                nudge_tool_calls = payload.nudge_tool_calls,
                request = request,
                cancel_event = cancel_event,
            )
        )

    if server_tools:
        # Bypass Permissions suppresses confirm, so both flags together is fine.
        if bool(getattr(payload, "confirm_tool_calls", False)) and not bool(
            getattr(payload, "bypass_permissions", False)
        ):
            api_monitor.fail(
                monitor_id,
                "confirm_tool_calls is not supported for Anthropic Messages server tools.",
            )
            raise HTTPException(
                status_code = 400,
                detail = anthropic_error_body(
                    "confirm_tool_calls is not supported for Anthropic Messages server tools.",
                    status = 400,
                    err_type = "invalid_request_error",
                ),
            )
        from core.inference.tools import ALL_TOOLS, apply_full_access_tool_descriptions

        # ask/auto (and an omitted mode selecting a gate-needing terminal/python
        # tool) were already rejected before the auto-switch above, so an invalid
        # confirm-gated request never evicts the resident model; the selection
        # here just picks the tools for the actual server-tool loop.
        openai_tools = _select_anthropic_server_tools(
            ALL_TOOLS,
            requested_studio_tools,
            payload.enabled_tools,
        )
        # Mirrors _select_request_tools: this path builds its own selection, so
        # the Full access swap has to be repeated rather than inherited.
        _full_access = bool(getattr(payload, "bypass_permissions", False))
        if _full_access:
            openai_tools = apply_full_access_tool_descriptions(openai_tools)

        # Build tool-use system prompt nudge (same logic as /chat/completions)
        _nudge = _build_tool_action_nudge(
            tools = openai_tools,
            model_name = model_name,
            full_access = _full_access,
        )

        if _nudge:
            # Inject into system prompt
            if openai_messages and openai_messages[0].get("role") == "system":
                openai_messages[0]["content"] = (
                    openai_messages[0]["content"].rstrip() + "\n\n" + _nudge
                )
            else:
                openai_messages.insert(0, {"role": "system", "content": _nudge})

        # Strip stale tool-call XML via the protected display helper (think rehearsal and [TOOL_CALLS]
        # prose survive), gated on enabled tool names so documented inactive examples are kept.
        _anthropic_history_gate = _display_tool_name_gate(openai_tools)
        for _msg in openai_messages:
            if _msg.get("role") == "assistant" and isinstance(_msg.get("content"), str):
                _msg["content"] = _strip_tool_xml_for_display(
                    _msg["content"],
                    auto_heal_tool_calls = True,
                    enabled_tool_names = _anthropic_history_gate,
                ).strip()

        def _run_tool_gen():
            return llama_backend.generate_chat_completion_with_tools(
                messages = openai_messages,
                tools = openai_tools,
                temperature = temperature,
                top_p = top_p,
                top_k = top_k,
                min_p = min_p,
                repetition_penalty = repetition_penalty,
                presence_penalty = presence_penalty,
                max_tokens = payload.max_tokens,
                stop = stop,
                cancel_event = cancel_event,
                max_tool_iterations = 25,
                auto_heal_tool_calls = True,
                nudge_tool_calls = payload.nudge_tool_calls,
                tool_call_timeout = 300,
                session_id = payload.session_id,
                thread_id = payload.thread_id,
                # Anthropic passthrough has no rag_scope field (RAG is local-only).
                rag_scope = getattr(payload, "rag_scope", None),
                disable_parallel_tool_use = _disable_parallel,
                bypass_permissions = bool(payload.bypass_permissions),
                permission_mode = getattr(payload, "permission_mode", None),
                promote_reasoning_only = False,
                perf_callback = _monitor_perf_callback(
                    monitor_id,
                    llama_backend.context_length,
                ),
            )

        if payload.stream:
            return await _admitted_anthropic(
                _anthropic_tool_stream(
                    request,
                    cancel_event,
                    _run_tool_gen,
                    message_id,
                    model_name,
                    llama_backend = llama_backend,
                    openai_messages = openai_messages,
                    openai_tools = openai_tools,
                    disable_parallel_tool_use = _disable_parallel,
                )
            )
        return await _admitted_anthropic(
            _anthropic_tool_non_streaming(
                _run_tool_gen,
                message_id,
                model_name,
                disable_parallel_tool_use = _disable_parallel,
                openai_tools = openai_tools,
            )
        )

    # ── No-tool path ──────────────────────────────────────────
    def _run_plain_gen():
        return llama_backend.generate_chat_completion(
            messages = openai_messages,
            temperature = temperature,
            top_p = top_p,
            top_k = top_k,
            min_p = min_p,
            repetition_penalty = repetition_penalty,
            presence_penalty = presence_penalty,
            max_tokens = payload.max_tokens,
            stop = stop,
            cancel_event = cancel_event,
            promote_reasoning_only = False,
            perf_callback = _monitor_perf_callback(
                monitor_id,
                llama_backend.context_length,
            ),
        )

    if payload.stream:
        return await _admitted_anthropic(
            _anthropic_plain_stream(
                request,
                cancel_event,
                _run_plain_gen,
                message_id,
                model_name,
                llama_backend = llama_backend,
                openai_messages = openai_messages,
            )
        )
    return await _admitted_anthropic(
        _anthropic_plain_non_streaming(
            _run_plain_gen,
            message_id,
            model_name,
        )
    )


async def _anthropic_tool_stream(
    request,
    cancel_event,
    run_gen,
    message_id,
    model_name,
    llama_backend = None,
    openai_messages = None,
    openai_tools = None,
    disable_parallel_tool_use = False,
):
    """Streaming response for the tool-calling path."""
    _sentinel = object()

    # Gate the display strip on the declared tools: an inactive NAME[ARGS]{...} in a final
    # answer is prose and must survive in the delivered text.
    _display_names = _display_tool_name_gate(openai_tools)

    # Prompt-token count for message_start.usage.input_tokens. count_chat_tokens
    # makes blocking HTTP calls to llama-server, so run it off the event loop.
    # Pass the tools so tool-schema tokens are counted (the generator renders
    # them too), matching the non-stream / count_tokens / passthrough paths.
    input_tokens = 0
    if llama_backend is not None and openai_messages is not None:
        input_tokens = await asyncio.to_thread(
            llama_backend.count_chat_tokens, openai_messages, None, openai_tools
        )

    async def _stream():
        # The server-tool loop decodes on llama-server for its whole body, so without an entry a
        # non-forced /unload saw zero generations and tore the server down mid-response. Entered
        # inside the body generator so a response whose body never starts leaves nothing behind.
        # No thread_id: public API surface.
        _tracker = _TrackedCancel(cancel_event, model = model_name, kind = "messages")
        _tracker.__enter__()
        try:
            emitter = AnthropicStreamEmitter()
            for line in emitter.start(message_id, model_name, input_tokens = input_tokens):
                yield line

            captured_finish_reason = None
            # Response ends on a pending tool_use block rather than final text; a server tool
            # that keeps generating flips this back to False.
            ends_on_tool_use = False
            tool_blocks_emitted = 0
            drop_until_tool_end = False
            # Last drop-branch keepalive, seeded to stream start so a chatty tool busy past the
            # stall window still gets one though its events are dropped.
            _last_drop_keepalive = time.monotonic()

            gen = run_gen()
            _next_task = None
            # Watcher to cancel on disconnect: the in-loop poll fires only between events,
            # so a mid-prefill disconnect would hold the decode slot.
            disconnect_watcher = asyncio.create_task(
                _await_disconnect_then_cancel(request, cancel_event)
            )
            try:
                while True:
                    if cancel_event.is_set() or await request.is_disconnected():
                        cancel_event.set()
                        return
                    # Stall keepalive (see GGUF tool stream): silent backend segments must not
                    # leave the SSE stream idle past proxy timeouts.
                    _next_task = asyncio.create_task(asyncio.to_thread(next, gen, _sentinel))
                    while True:
                        _done_tasks, _ = await asyncio.wait(
                            {_next_task},
                            timeout = _LOCAL_TOOL_STREAM_STALL_KEEPALIVE_S,
                        )
                        if _done_tasks:
                            break
                        yield _OPENAI_PASSTHROUGH_SSE_KEEPALIVE
                    event = _next_task.result()
                    # Done; drop the reference so the finally-block drain no-ops.
                    _next_task = None
                    if event is _sentinel:
                        break
                    etype = event.get("type")
                    if etype == "heartbeat":
                        # Tool-wrapper heartbeat -> SSE keepalive, checked BEFORE the drop skip:
                        # a dropped tool still runs and suppresses the stall keepalive.
                        yield _OPENAI_PASSTHROUGH_SSE_KEEPALIVE
                        continue
                    if etype in ("tool_output", "tool_args"):
                        # No Anthropic Messages equivalent (the full call/result follow in tool_use /
                        # tool_result), so drop them. They suppress the stall keepalive, so emit a
                        # rate-limited one instead of going silent past the ~100s proxy cap.
                        _now = time.monotonic()
                        if _now - _last_drop_keepalive >= _LOCAL_TOOL_STREAM_STALL_KEEPALIVE_S:
                            _last_drop_keepalive = _now
                            yield _OPENAI_PASSTHROUGH_SSE_KEEPALIVE
                        continue
                    if drop_until_tool_end:
                        # disable_parallel_tool_use: skip every event until (and
                        # including) this dropped tool call's tool_end.
                        if etype == "tool_end":
                            drop_until_tool_end = False
                        continue
                    if etype == "metadata":
                        _fr = event.get("finish_reason")
                        if _fr is not None:
                            captured_finish_reason = _fr
                    # Strip leaked tool-call XML first, so a purely-tool-XML content event doesn't
                    # count as text. The protected helper keeps <think> rehearsal and balanced
                    # [TOOL_CALLS] trailing prose, which a raw sub corrupts.
                    if etype == "content":
                        event = dict(event)
                        event["text"] = _strip_tool_xml_for_display(
                            event["text"],
                            auto_heal_tool_calls = True,
                            enabled_tool_names = _display_names,
                        )
                    # disable_parallel_tool_use: keep only the first tool_use block, dropping
                    # later tool_start/tool_end pairs (by state, not id: ids may be empty).
                    if etype == "tool_start":
                        if disable_parallel_tool_use and tool_blocks_emitted >= 1:
                            drop_until_tool_end = True
                            continue
                        ends_on_tool_use = True
                    elif etype == "tool_end":
                        tool_blocks_emitted += 1
                        # Unsloth ran the tool server-side, so the response no longer ends on a pending
                        # client action; otherwise stop_reason "tool_use" tells the client to run it again.
                        ends_on_tool_use = False
                    elif etype == "content" and event.get("text"):
                        ends_on_tool_use = False
                    for line in emitter.feed(event):
                        yield line
            except Exception as e:
                logger.error("anthropic_messages stream error: %s", e)
                # force = True so an unclassified mid-stream failure emits an SSE error instead
                # of a message_stop that masks a truncated turn as a clean finish.
                _error_event = _anthropic_stream_error_event(e, force = True)
                if _error_event is not None:
                    yield _error_event
                    return
            finally:
                await _stop_local_disconnect_cancel_watcher(disconnect_watcher)
                # Drain a still-running next(gen) worker first, so a mid-prefill disconnect releases
                # its resources; closing first races into 'already executing'.
                await _drain_pending_next_task(_next_task, cancel_event)
                if gen is not None:
                    try:
                        await asyncio.to_thread(gen.close)
                    except (RuntimeError, ValueError):
                        pass

            stop_reason = openai_finish_to_anthropic_stop(
                captured_finish_reason, had_tool_calls = ends_on_tool_use
            )
            for line in emitter.finish(stop_reason = stop_reason, stop_sequence = None):
                yield line
        finally:
            _tracker.__exit__(None, None, None)

    return _sse_streaming_response(_stream())


async def _anthropic_plain_stream(
    request,
    cancel_event,
    run_gen,
    message_id,
    model_name,
    llama_backend = None,
    openai_messages = None,
):
    """Streaming response for the no-tool path."""
    _sentinel = object()

    # Prompt-token count for message_start.usage.input_tokens. count_chat_tokens
    # makes blocking HTTP calls to llama-server, so run it off the event loop.
    input_tokens = 0
    if llama_backend is not None and openai_messages is not None:
        input_tokens = await asyncio.to_thread(llama_backend.count_chat_tokens, openai_messages)

    async def _stream():
        # Registered like the tool stream above: this default /v1/messages path decodes on
        # llama-server, so without an entry a non-forced /unload tore it down mid-response.
        _tracker = _TrackedCancel(cancel_event, model = model_name, kind = "messages")
        _tracker.__enter__()
        try:
            emitter = AnthropicStreamEmitter()
            for line in emitter.start(message_id, model_name, input_tokens = input_tokens):
                yield line

            captured_finish_reason = None

            gen = run_gen()
            _next_task = None
            # Watcher to cancel on disconnect: the in-loop poll fires only between chunks,
            # so a mid-prefill disconnect would hold the decode slot.
            disconnect_watcher = asyncio.create_task(
                _await_disconnect_then_cancel(request, cancel_event)
            )
            try:
                while True:
                    if cancel_event.is_set() or await request.is_disconnected():
                        cancel_event.set()
                        return
                    # Stall keepalive each window while next(gen) runs in a worker.
                    _next_task = asyncio.create_task(asyncio.to_thread(next, gen, _sentinel))
                    while True:
                        _done_tasks, _ = await asyncio.wait(
                            {_next_task},
                            timeout = _LOCAL_TOOL_STREAM_STALL_KEEPALIVE_S,
                        )
                        if _done_tasks:
                            break
                        yield _OPENAI_PASSTHROUGH_SSE_KEEPALIVE
                    cumulative = _next_task.result()
                    # Done; drop the reference so the finally-block drain no-ops.
                    _next_task = None
                    if cumulative is _sentinel:
                        break
                    if isinstance(cumulative, dict):
                        if cumulative.get("type") == "metadata":
                            _fr = cumulative.get("finish_reason")
                            if _fr is not None:
                                captured_finish_reason = _fr
                            for line in emitter.feed(cumulative):
                                yield line
                        continue
                    # Plain generator yields cumulative text strings
                    for line in emitter.feed({"type": "content", "text": cumulative}):
                        yield line
            except Exception as e:
                logger.error("anthropic_messages stream error: %s", e)
                # force = True so an unclassified mid-stream failure emits an SSE error instead
                # of a message_stop that masks a truncated turn as a clean finish.
                _error_event = _anthropic_stream_error_event(e, force = True)
                if _error_event is not None:
                    yield _error_event
                    return
            finally:
                await _stop_local_disconnect_cancel_watcher(disconnect_watcher)
                # Drain a still-running next(gen) worker first, so a mid-prefill disconnect releases
                # its resources; closing first races into 'already executing'.
                await _drain_pending_next_task(_next_task, cancel_event)
                if gen is not None:
                    try:
                        await asyncio.to_thread(gen.close)
                    except (RuntimeError, ValueError):
                        pass

            stop_reason = openai_finish_to_anthropic_stop(
                captured_finish_reason, had_tool_calls = False
            )
            for line in emitter.finish(stop_reason = stop_reason, stop_sequence = None):
                yield line
        finally:
            _tracker.__exit__(None, None, None)

    return _sse_streaming_response(_stream())


def _anthropic_map_generation_error(e: Exception) -> HTTPException:
    """Map an upstream 4xx / context-overflow generation error to a clean
    Anthropic 400 invalid_request_error. Genuine 5xx errors stay 500."""
    if _classify_llama_generation_error(e) is not None:
        return HTTPException(
            status_code = 400,
            detail = anthropic_error_body(
                _friendly_error(e),
                status = 400,
                err_type = "invalid_request_error",
            ),
        )
    return HTTPException(status_code = 500, detail = _friendly_error(e))


def _collect_anthropic_events(run_gen) -> list:
    """Drain the generator into a list, mapping an upstream 4xx / context
    overflow to a clean Anthropic 400 instead of leaking a 500."""
    try:
        return list(run_gen())
    except HTTPException:
        raise
    except Exception as e:
        raise _anthropic_map_generation_error(e)


def _anthropic_message_json_response(
    message_id, model_name, content_blocks, stop_reason, usage
) -> Response:
    """Assemble the terminal Anthropic non-streaming JSON response shared by the
    tool / plain / passthrough paths."""
    return _model_json_response(
        AnthropicMessagesResponse(
            id = message_id,
            model = model_name,
            content = content_blocks,
            stop_reason = stop_reason,
            usage = AnthropicUsage(
                input_tokens = usage.get("prompt_tokens", 0),
                output_tokens = usage.get("completion_tokens", 0),
            ),
        )
    )


async def _anthropic_tool_non_streaming(
    run_gen,
    message_id,
    model_name,
    disable_parallel_tool_use = False,
    openai_tools = None,
):
    """Non-streaming response for the tool-calling path.

    Builds ``content_blocks`` in generation order (text → tool_use → text →
    tool_use → ...), mirroring the streaming emitter. Deltas within one
    synthesis turn merge into the trailing text block; tool_use blocks interrupt
    the text sequence and open a new text block on the next content event.

    ``prev_text`` is reset on ``tool_end`` because
    ``generate_chat_completion_with_tools`` yields cumulative content *per
    turn* -- the first content event of turn N+1 must diff against an empty
    baseline, not turn N's final length.
    """
    content_blocks: list = []
    tool_blocks_by_id: dict[str, AnthropicResponseToolUseBlock] = {}
    usage = {}
    prev_text = ""
    captured_finish_reason = None
    # Gate the display strip on the declared tools: an inactive NAME[ARGS]{...} in a final
    # answer is prose and must survive in the delivered text.
    _display_names = _display_tool_name_gate(openai_tools)
    # Pending client tool_use; cleared by tool_end (server execution) or
    # trailing text. See the stop_reason mapping below.
    ends_on_tool_use = False

    events = _collect_anthropic_events(run_gen)

    for event in events:
        etype = event.get("type", "")
        if etype == "content":
            # Strip leaked tool XML (protected helper keeps think rehearsal and trailing prose).
            clean = _strip_tool_xml_for_display(
                event["text"], auto_heal_tool_calls = True, enabled_tool_names = _display_names
            )
            new = clean[len(prev_text) :]
            prev_text = clean
            if new:
                ends_on_tool_use = False
                if content_blocks and isinstance(content_blocks[-1], AnthropicResponseTextBlock):
                    content_blocks[-1].text += new
                else:
                    content_blocks.append(AnthropicResponseTextBlock(text = new))
        elif etype == "tool_start":
            tool_call_id = event["tool_call_id"]
            arguments = event.get("arguments", {})
            existing_tool_block = tool_blocks_by_id.get(tool_call_id) if tool_call_id else None
            if existing_tool_block is not None:
                if arguments or not existing_tool_block.input:
                    existing_tool_block.input = arguments
                if event.get("tool_name") and not existing_tool_block.name:
                    existing_tool_block.name = event["tool_name"]
            else:
                tool_block = AnthropicResponseToolUseBlock(
                    id = anthropic_tool_use_id(tool_call_id),
                    name = event["tool_name"],
                    input = arguments,
                )
                if tool_call_id:
                    tool_blocks_by_id[tool_call_id] = tool_block
                content_blocks.append(tool_block)
            ends_on_tool_use = True
        elif etype == "tool_end":
            prev_text = ""
            # Server-executed: no longer pending a client action (see above).
            ends_on_tool_use = False
        elif etype == "metadata":
            usage = event.get("usage", {})
            _fr = event.get("finish_reason")
            if _fr is not None:
                captured_finish_reason = _fr

    # disable_parallel_tool_use: cap the response to at most one tool_use
    # block. Keep the first tool_use and drop any later ones.
    if disable_parallel_tool_use:
        _seen_tool_use = False
        _capped: list = []
        for block in content_blocks:
            if isinstance(block, AnthropicResponseToolUseBlock):
                if _seen_tool_use:
                    continue
                _seen_tool_use = True
            _capped.append(block)
        content_blocks = _capped

    # stop_reason "tool_use" only when the response still ends on a pending
    # tool_use (client must act). `ends_on_tool_use` is tracked through the
    # event stream above: it is True only if the last tool_start had no
    # following tool_end (server execution) or trailing text.
    stop_reason = openai_finish_to_anthropic_stop(
        captured_finish_reason, had_tool_calls = ends_on_tool_use
    )

    return _anthropic_message_json_response(
        message_id, model_name, content_blocks, stop_reason, usage
    )


async def _anthropic_plain_non_streaming(run_gen, message_id, model_name):
    """Non-streaming response for the no-tool path."""
    text_parts = []
    usage = {}
    prev_text = ""
    captured_finish_reason = None

    events = _collect_anthropic_events(run_gen)

    for cumulative in events:
        if isinstance(cumulative, dict):
            if cumulative.get("type") == "metadata":
                usage = cumulative.get("usage", {})
                _fr = cumulative.get("finish_reason")
                if _fr is not None:
                    captured_finish_reason = _fr
            continue
        new = cumulative[len(prev_text) :]
        prev_text = cumulative
        if new:
            text_parts.append(new)

    full_text = "".join(text_parts)
    content_blocks = []
    if full_text:
        content_blocks.append(AnthropicResponseTextBlock(text = full_text))

    stop_reason = openai_finish_to_anthropic_stop(captured_finish_reason, had_tool_calls = False)

    return _anthropic_message_json_response(
        message_id, model_name, content_blocks, stop_reason, usage
    )


# =====================================================================
# Client-side tool pass-through (Anthropic-native tools field)
# =====================================================================


_JSON_SCHEMA_MAP_KEYWORDS = frozenset(
    {
        "$defs",
        "definitions",
        "dependentSchemas",
        "patternProperties",
        "properties",
    }
)
_JSON_SCHEMA_SINGLE_KEYWORDS = frozenset(
    {
        "additionalProperties",
        "contains",
        "contentSchema",
        "else",
        "if",
        "items",
        "not",
        "propertyNames",
        "then",
        "unevaluatedItems",
        "unevaluatedProperties",
    }
)
_JSON_SCHEMA_LIST_KEYWORDS = frozenset({"allOf", "anyOf", "oneOf", "prefixItems"})
_LLAMA_GRAMMAR_MAX_REPETITION = 2000
_JSON_SCHEMA_REPETITION_KEYWORDS = frozenset({"maxItems", "maxLength", "minItems", "minLength"})


def _llama_compatible_tool_schema(schema):
    """Return a llama.cpp-compatible copy of one JSON Schema node.

    JSON Schema ``pattern`` expressions match anywhere in a string, so an
    unanchored pattern is valid and cannot be made compatible by merely adding
    ``^`` and ``$`` without changing its meaning. llama.cpp's grammar converter
    currently rejects those patterns outright. Its grammar parser likewise
    rejects repetition bounds above 2000. Omit only those unsupported
    constraints from the local-backend copy; the agent retains and validates
    its original schema, while every compatible constraint still reaches
    llama.cpp.
    """
    if not isinstance(schema, dict):
        return schema

    compatible = dict(schema)
    pattern = compatible.get("pattern")
    if isinstance(pattern, str) and not (pattern.startswith("^") and pattern.endswith("$")):
        compatible.pop("pattern")
    # llama-grammar.cpp refuses repetition bounds above its sane-default
    # threshold. Dropping the local-backend constraint preserves every value
    # the client schema accepts; capping it would incorrectly reject otherwise
    # valid tool arguments.
    for keyword in _JSON_SCHEMA_REPETITION_KEYWORDS:
        bound = compatible.get(keyword)
        if (
            isinstance(bound, int)
            and not isinstance(bound, bool)
            and bound > _LLAMA_GRAMMAR_MAX_REPETITION
        ):
            compatible.pop(keyword)

    for keyword in _JSON_SCHEMA_MAP_KEYWORDS:
        children = compatible.get(keyword)
        if isinstance(children, dict):
            compatible[keyword] = {
                key: _llama_compatible_tool_schema(value) for key, value in children.items()
            }

    for keyword in _JSON_SCHEMA_SINGLE_KEYWORDS:
        child = compatible.get(keyword)
        if isinstance(child, dict):
            compatible[keyword] = _llama_compatible_tool_schema(child)

    for keyword in _JSON_SCHEMA_LIST_KEYWORDS:
        children = compatible.get(keyword)
        if isinstance(children, list):
            compatible[keyword] = [_llama_compatible_tool_schema(value) for value in children]

    return compatible


def _llama_compatible_tools(openai_tools):
    if not isinstance(openai_tools, list):
        return openai_tools

    compatible_tools = []
    for tool in openai_tools:
        if not isinstance(tool, dict):
            compatible_tools.append(tool)
            continue
        function = tool.get("function")
        parameters = function.get("parameters") if isinstance(function, dict) else None
        if not isinstance(parameters, dict):
            compatible_tools.append(tool)
            continue
        compatible_tools.append(
            {
                **tool,
                "function": {
                    **function,
                    "parameters": _llama_compatible_tool_schema(parameters),
                },
            }
        )
    return compatible_tools


def _build_passthrough_payload(
    openai_messages,
    openai_tools,
    temperature,
    top_p,
    top_k,
    max_tokens,
    stream,
    stop = None,
    min_p = None,
    repetition_penalty = None,
    presence_penalty = None,
    tool_choice = "auto",
    response_format = None,
    chat_template_kwargs = None,
    backend_ctx = None,
    seed = None,
    stream_options = None,
    markup = None,
):
    from core.inference.chat_template_helpers import (
        neutralize_control_markup_in_messages,
        neutralize_tool_descriptions,
        reconciled_tool_choice,
    )

    # The one place to break markup: llama-server applies the template itself, and both
    # /v1/messages bodies come from here, never the OpenAI builder below (#7066).
    # *markup* is the loaded model's profile, so passthrough leaves another family's
    # marker alone exactly as generate_chat_completion does (#7066).
    _pt_markup = markup
    body = {
        "messages": neutralize_control_markup_in_messages(openai_messages, None, _pt_markup),
        "temperature": temperature,
        "top_p": top_p,
        "top_k": top_k,
        "stream": stream,
    }
    # Tested after the rewrite: an all-injected catalog drops to empty, and
    # "tools": [] would still advertise tool use.
    safe_tools = neutralize_tool_descriptions(openai_tools, None, _pt_markup)
    if safe_tools:
        body["tools"] = _llama_compatible_tools(safe_tools)
        # A mixed catalog keeps safe_tools non-empty while dropping the one tool the client
        # forced; forwarding that choice would name an unadvertised function and hand
        # llama-server back the raw markup. Fall back to "auto" to stay consistent (#7066).
        tool_choice = reconciled_tool_choice(tool_choice, openai_tools, safe_tools)
        if tool_choice is not None:
            body["tool_choice"] = tool_choice
    if seed is not None:
        body["seed"] = seed
    if stream and stream_options is not None:
        body["stream_options"] = stream_options
    body["max_tokens"] = (
        max_tokens if max_tokens is not None else (backend_ctx or _DEFAULT_MAX_TOKENS_FLOOR)
    )
    # Normalize stop the same way the non-passthrough path does (the passthrough
    # was previously the one path that forwarded an empty stop string verbatim).
    _stop = _normalize_stop_sequences(stop)
    if _stop:
        body["stop"] = _stop
    if min_p is not None:
        body["min_p"] = min_p
    if repetition_penalty is not None:
        # llama-server's field is "repeat_penalty", not "repetition_penalty".
        body["repeat_penalty"] = repetition_penalty
    if presence_penalty is not None:
        body["presence_penalty"] = presence_penalty
    if response_format is not None:
        # llama-server applies a GBNF grammar derived from the JSON schema when
        # response_format is present. The field is documented flat at the
        # request root (tools/server/README.md), which is also what the OpenAI
        # SDK produces by spreading extra_body into the body top.
        body["response_format"] = response_format
    if chat_template_kwargs is not None:
        # Propagate reasoning / template overrides (e.g. enable_thinking) so
        # llama-server renders the Jinja template in the caller's mode instead
        # of the model's load-time default.
        body["chat_template_kwargs"] = chat_template_kwargs
    return body


def _nudge_retry_messages(
    body,
    data,
    allowed_tools,
    markup = None,
):
    """The nudge retry's message list, re-neutralized like the enable-tools loop.

    The appended suffix is not sanitized text: the assistant turn replays the model's own
    failed output, and the user turn interpolates ``allowed_tools``, which ``heal_gate``
    derives from the RAW catalog on the /v1/messages path -- so a name dropped from
    ``tools`` for carrying markup would come straight back as prose the template renders
    as structure (#7066). Wrapping the whole concatenation rather than just the suffix is
    free: the rewrite is idempotent and returns unchanged messages as-is, so the already
    neutralized prefix stays byte-identical and llama-server still reuses the slot's KV
    cache, the entire point of appending instead of rebuilding."""
    from core.inference.chat_template_helpers import neutralize_control_markup_in_messages

    # Same profile the body was built with: sweeping the retry with the curated patterns
    # would rewrite a prefix the first attempt preserved, so the prefix would no longer be
    # byte-identical and the slot's KV cache would miss (#7066).
    return neutralize_control_markup_in_messages(
        [*body.get("messages", []), *nudge_messages(data, allowed_tools)], None, markup
    )


def _is_lost_upstream_connection(exc) -> bool:
    """True only for errors that mean the connection died, not that it was slow.

    ``httpx.RequestError`` also covers ``TimeoutException`` (ConnectTimeout,
    ReadTimeout, WriteTimeout, PoolTimeout), and a long generation on a HEALTHY
    llama-server surfaces as ``ReadTimeout``. ``_respawn_if_dead`` reports a live
    process healthy, so a respawn retry on a timeout resubmits the same prompt to
    a server that is still decoding the first copy: double the wall clock and two
    slots burnt. ``NetworkError`` (Connect/Read/Write/CloseError) plus
    ``RemoteProtocolError`` (a FIN before the response line) are the dead-server
    set, and they are exactly what ``_open_chat_stream_with_respawn_retry`` retries
    on. RemoteProtocolError is a sibling of NetworkError, not a subclass, so both
    have to be named.
    """
    return isinstance(exc, (httpx.NetworkError, httpx.RemoteProtocolError))


async def _passthrough_retry_url(llama_backend, exc):
    """Fresh upstream URL after respawning a dead llama-server, else None.

    A crashed server relaunches on a NEW ephemeral port, so a passthrough still
    holding the old base_url keeps failing until the next load. Mirrors the
    respawn-and-retry in generate_chat_completion. None when an MTP+tensor crash
    already scheduled its own recovery, or when nothing needed respawning.

    Shared by both passthrough surfaces: /v1/messages and /v1/chat/completions post
    to the same upstream route, and a crash strands whichever one is in use.
    """
    recover = getattr(llama_backend, "_maybe_recover_from_mtp_crash", None)
    if recover is not None and recover(exc):
        return None
    # Only the first caller gets True above; the rest must not respawn the same
    # MTP config underneath the fallback that is already reloading without it.
    if getattr(llama_backend, "_mtp_runtime_fallback_in_progress", False):
        return None
    respawn = getattr(llama_backend, "_respawn_if_dead", None)
    if respawn is None or not await asyncio.to_thread(respawn):
        return None
    logger.warning("llama-server was unreachable; respawned it and retrying the passthrough")
    return f"{llama_backend.base_url}/v1/chat/completions"


async def _anthropic_passthrough_stream(
    request,
    cancel_event,
    llama_backend,
    openai_messages,
    openai_tools,
    temperature,
    top_p,
    top_k,
    max_tokens,
    message_id,
    model_name,
    stop = None,
    min_p = None,
    repetition_penalty = None,
    presence_penalty = None,
    tool_choice = "auto",
    session_id = None,
    cancel_id = None,
    disable_parallel_tool_use = False,
    auto_heal_tool_calls = None,
):
    """Streaming client-side pass-through: forward tools to llama-server and
    translate its stream to Anthropic SSE without executing anything."""
    target_url = f"{llama_backend.base_url}/v1/chat/completions"
    body = _build_passthrough_payload(
        openai_messages,
        openai_tools,
        temperature,
        top_p,
        top_k,
        max_tokens,
        True,
        stop = stop,
        min_p = min_p,
        repetition_penalty = repetition_penalty,
        presence_penalty = presence_penalty,
        tool_choice = tool_choice,
        backend_ctx = llama_backend.context_length,
        stream_options = {"include_usage": True},
        markup = getattr(llama_backend, "markup_profile", None),
    )

    # Prompt-token count for message_start.usage.input_tokens. count_chat_tokens
    # makes blocking HTTP calls to llama-server, so run it off the event loop.
    # Pass the tools through so tool-schema tokens are counted (otherwise the
    # streaming input_tokens undercounts vs the non-stream / count_tokens paths).
    input_tokens = await asyncio.to_thread(
        llama_backend.count_chat_tokens, openai_messages, None, openai_tools
    )

    # cancel_id mirrors the OpenAI passthrough so a per-run cancel POST
    # works without the caller having to know the local message_id.
    # No thread_id: public API surface, but still registered so a reload cannot yank
    # llama-server out from under it. Built here, entered below inside _stream().
    _tracker = _TrackedCancel(
        cancel_event,
        cancel_id,
        session_id,
        message_id,
        model = model_name,
        kind = "messages",
    )

    async def _stream():
        # Entered inside the body, not eagerly: aclose() runs no body on a generator
        # that never started, so a client that drops first would leave the run
        # registered until restart, 409-ing every swap. Ahead of the first yield, so
        # the opening lines are covered as well.
        _tracker.__enter__()
        emitter = AnthropicPassthroughEmitter()
        # Promote text-form tool calls (declared client tools only) into tool_use blocks;
        # verbatim when healing is off or no tools. tool_choice is already OpenAI-shaped.
        # Sanitized catalog, not the caller's: a tool dropped for unsafe markup never reached
        # the prompt, so promoting it would hand the client an unadvertised tool_use (#7066).
        from core.inference.chat_template_helpers import neutralize_tool_descriptions

        _healing_tools = neutralize_tool_descriptions(
            openai_tools, None, getattr(llama_backend, "markup_profile", None)
        )
        # The reconciled choice the body carries, not the caller's: a dropped forced tool
        # was already sent as "auto", and gating on the stale name would intersect the safe
        # names with a removed one and disable healing outright. "none" survives
        # reconciliation, so it still forbids promotion (#7066).
        _allowed_tools = heal_gate(auto_heal_tool_calls, _healing_tools, body.get("tool_choice"))
        if _allowed_tools:
            emitter.enable_healing(
                _allowed_tools,
                _healing_tools,
                disable_parallel_tool_use = disable_parallel_tool_use,
            )
        # These yields sit outside the teardown try below, so a disconnect while
        # the opening lines are being sent would strand the tracker. __exit__ is
        # idempotent, so the normal path still exits once, down there.
        try:
            for line in emitter.start(message_id, model_name, input_tokens = input_tokens):
                yield line
        except BaseException:
            _tracker.__exit__(None, None, None)
            raise

        # Manage the httpx client, response, AND the aiter_lines() async
        # generator MANUALLY -- no `async with`, no anonymous iterator.
        #
        # On Python 3.13 + httpcore 1.0.x, `async for raw_line in
        # resp.aiter_lines():` creates an anonymous async generator. When the
        # loop exits via `break` (or the generator is orphaned by a mid-stream
        # client disconnect), `async for` does NOT auto-close the iterator like
        # a sync `for` would. The iterator stays reachable only from the current
        # coroutine frame; once `_stream()` returns, the frame is GC'd and the
        # iterator becomes unreachable. The asyncgen finalizer then runs aclose()
        # on a LATER GC pass in a DIFFERENT asyncio task, where httpcore's
        # `HTTP11ConnectionByteStream.aclose()` enters `anyio.CancelScope.__exit__`
        # with a mismatched task and prints `RuntimeError: Attempted to exit
        # cancel scope in a different task` / `RuntimeError: async generator
        # ignored GeneratorExit` as "Exception ignored in:" unraisable warnings.
        #
        # Fix: save `resp.aiter_lines()` as `lines_iter`, and in finally
        # explicitly `await lines_iter.aclose()` BEFORE `resp.aclose()` /
        # `client.aclose()`. This closes the iterator in our own task's event
        # loop, cleaning up the httpcore byte-stream before the asyncgen
        # finalizer has anything orphaned to finalize. Each aclose is wrapped in
        # `try: ... except Exception: pass` so nested anyio cleanup noise can't
        # bubble out.
        client = httpx.AsyncClient(
            timeout = _llama_streaming_generation_timeout(),
            limits = httpx.Limits(max_keepalive_connections = 0),
            trust_env = False,
        )
        resp = None
        lines_iter = None
        cancel_watcher = None
        disconnect_watcher = None
        try:
            url = target_url
            try:
                req = client.build_request("POST", url, json = body, headers = {"Connection": "close"})
                first_token_deadline = time.monotonic() + _DEFAULT_FIRST_TOKEN_TIMEOUT_S
                resp = await _send_stream_with_preheader_cancel(
                    client, req, cancel_event, request = request
                )
            except httpx.ConnectError as exc:
                # Nothing has streamed yet, so a respawned server can be retried once
                # on its new port without duplicating output.
                url = await _passthrough_retry_url(llama_backend, exc)
                if url is None:
                    raise
                req = client.build_request("POST", url, json = body, headers = {"Connection": "close"})
                first_token_deadline = time.monotonic() + _DEFAULT_FIRST_TOKEN_TIMEOUT_S
                resp = await _send_stream_with_preheader_cancel(
                    client, req, cancel_event, request = request
                )
            if resp is None:
                return

            # Upstream client error (e.g. over-context 400) arrives before any
            # SSE. The 200 stream headers are already flushed, so surface it as
            # an in-band Anthropic ``error`` event instead of silently finishing
            # with an empty end_turn message.
            if resp.status_code != 200:
                _err_bytes = await resp.aread()
                _err_text = _err_bytes.decode("utf-8", "replace")[:500]
                logger.error(
                    "anthropic passthrough upstream error: status=%s body=%s",
                    resp.status_code,
                    _err_text,
                )
                yield build_anthropic_sse_event(
                    "error",
                    anthropic_error_body(
                        _friendly_upstream_error(_err_text),
                        status = resp.status_code,
                    ),
                )
                return

            # Watchers unblock aiter_lines() during prefill, before in-loop
            # cancel/disconnect checks can run.
            cancel_watcher = asyncio.create_task(_await_cancel_then_close(cancel_event, resp))
            disconnect_watcher = asyncio.create_task(
                _await_disconnect_then_close(request, resp, cancel_event)
            )
            lines_iter = resp.aiter_lines()
            async for raw_line in _aiter_llama_stream_items(
                lines_iter,
                cancel_event = cancel_event,
                request = request,
                first_token_deadline = first_token_deadline,
                response = resp,
            ):
                if not raw_line or not raw_line.startswith("data: "):
                    continue
                data_str = raw_line[6:]
                if data_str.strip() == "[DONE]":
                    break
                try:
                    chunk = json.loads(data_str)
                except json.JSONDecodeError:
                    continue
                if disable_parallel_tool_use:
                    _drop_parallel_tool_call_deltas(chunk)
                for line in emitter.feed_chunk(chunk):
                    yield line
        except Exception as e:
            if not cancel_event.is_set():
                logger.error("anthropic_messages passthrough stream error: %s", e)
                get_llama_cpp_backend()._maybe_recover_from_mtp_crash(e)
                event = _anthropic_stream_error_event(
                    e,
                    force = True,
                )
                if event is not None:
                    yield event
                return
        finally:
            # Same shape as the OpenAI passthrough: the tracker exits after the closes,
            # and the bounded teardown awaits cannot hold it indefinitely.
            try:
                await _aclose_stream_resources(
                    watchers = (cancel_watcher, disconnect_watcher),
                    iterator = lines_iter,
                    resp = resp,
                    client = client,
                )
            finally:
                _release_admission(tracker = _tracker)

        for line in emitter.finish():
            yield line

    # The tracker is entered eagerly above, but _stream()'s finally is what exits
    # it. Closing an async generator that never started is a no-op, so hand the
    # response a cleanup hook or a pre-start give-up leaks the registry entry.
    return _sse_streaming_response(
        _stream(),
        unstarted_cleanup = _tracked_cancel_unstarted_cleanup(_tracker),
    )


async def _anthropic_passthrough_non_streaming(
    llama_backend,
    openai_messages,
    openai_tools,
    temperature,
    top_p,
    top_k,
    max_tokens,
    message_id,
    model_name,
    stop = None,
    min_p = None,
    repetition_penalty = None,
    presence_penalty = None,
    tool_choice = "auto",
    disable_parallel_tool_use = False,
    auto_heal_tool_calls = None,
    nudge_tool_calls = None,
    request: Optional[Request] = None,
    cancel_event = None,
):
    """Non-streaming client-side pass-through.

    Both POSTs run on a per-request client so a Stop or a forced swap can close
    it and interrupt them. The pooled ``nonstreaming_client()`` cannot be closed
    without disturbing unrelated calls, which left this path registered with the
    swap gate but deaf to the event it registered.
    """
    target_url = f"{llama_backend.base_url}/v1/chat/completions"
    body = _build_passthrough_payload(
        openai_messages,
        openai_tools,
        temperature,
        top_p,
        top_k,
        max_tokens,
        False,
        stop = stop,
        min_p = min_p,
        repetition_penalty = repetition_penalty,
        presence_penalty = presence_penalty,
        tool_choice = tool_choice,
        backend_ctx = llama_backend.context_length,
        markup = getattr(llama_backend, "markup_profile", None),
    )

    _client = _cancelable_nonstreaming_client()
    _cancel_watcher = asyncio.create_task(
        _await_cancel_or_disconnect_then_close_client(
            cancel_event = cancel_event,
            request = request,
            client = _client,
        )
    )

    async def _post(payload_body):
        nonlocal target_url
        try:
            return await _client.post(
                target_url,
                json = payload_body,
                timeout = _llama_non_streaming_generation_timeout(),
            )
        except httpx.RequestError as exc:
            # The watcher closes the client to break a blocked POST, so a transport error
            # with the event set is the cancel, not a failure.
            if cancel_event is not None and cancel_event.is_set():
                raise asyncio.CancelledError()
            # Nothing was returned yet, so retry once against the respawned server's
            # new port; the nudge retry below then reuses the same fresh URL.
            retry_url = (
                await _passthrough_retry_url(llama_backend, exc)
                if isinstance(exc, httpx.ConnectError)
                else None
            )
            if retry_url is None:
                raise
            target_url = retry_url
            return await _client.post(
                target_url,
                json = payload_body,
                timeout = _llama_non_streaming_generation_timeout(),
            )

    try:
        resp = await _post(body)

        if resp.status_code != 200:
            raise HTTPException(
                status_code = resp.status_code,
                detail = _friendly_upstream_error(resp.text[:500]),
            )

        data = resp.json()
        # tool_choice is already OpenAI-shaped. Sanitized as in the streaming path: with
        # nudging on, the retry would otherwise name a tool dropped from the prompt (#7066).
        from core.inference.chat_template_helpers import neutralize_tool_descriptions

        _healing_tools = neutralize_tool_descriptions(
            openai_tools, None, getattr(llama_backend, "markup_profile", None)
        )
        # The reconciled choice the body carries, not the caller's: a dropped forced tool
        # was already sent as "auto", and gating on the stale name would intersect the safe
        # names with a removed one and disable healing outright. "none" survives
        # reconciliation, so it still forbids promotion (#7066).
        _allowed_tools = heal_gate(auto_heal_tool_calls, _healing_tools, body.get("tool_choice"))

        # Opt-in single-retry nudge (mirrors the OpenAI passthrough): the tool call came out
        # unusable; re-ask with the prompt prefix intact so the KV cache is reused.
        if (
            _allowed_tools
            and nudge_enabled(nudge_tool_calls)
            and nudge_should_retry(data, _allowed_tools, _healing_tools)
        ):
            retry_body = {
                **body,
                "messages": _nudge_retry_messages(
                    body, data, _allowed_tools, getattr(llama_backend, "markup_profile", None)
                ),
            }
            try:
                retry_resp = await _post(retry_body)
                if retry_resp.status_code == 200:
                    retry_data = retry_resp.json()
                    if response_has_promotable_calls(retry_data, _allowed_tools, openai_tools):
                        data = retry_data
            except (httpx.RequestError, ValueError) as exc:
                logger.warning("tool-call nudge retry failed; keeping original: %s", exc)

        choice = (data.get("choices") or [{}])[0]
        message = choice.get("message") or {}
        finish_reason = choice.get("finish_reason")

        healing_active = bool(_allowed_tools)
        healed_events = (
            heal_openai_message_events(message, _allowed_tools, openai_tools)
            if healing_active
            else None
        )

        content_blocks = []
        tool_calls = []
        if healed_events:
            emitted_tool_uses = 0
            for kind, value in healed_events:
                if kind == "text":
                    text = str(value).strip()
                    if text:
                        content_blocks.append(AnthropicResponseTextBlock(text = text))
                    continue
                if disable_parallel_tool_use and emitted_tool_uses >= 1:
                    continue
                fn = value.get("function") or {}
                try:
                    args = json.loads(fn.get("arguments", "{}"))
                except json.JSONDecodeError:
                    args = {}
                tool_calls.append(value)
                emitted_tool_uses += 1
                content_blocks.append(
                    AnthropicResponseToolUseBlock(
                        id = anthropic_tool_use_id(value.get("id")),
                        name = fn.get("name", ""),
                        input = args,
                    )
                )
        else:
            text = message.get("content") or ""
            if text:
                # Keep unpromoted bytes when healing is active; legacy stripping is only for opted-out
                # or no-client-tool requests. The protected helper preserves <think> rehearsal and
                # balanced [TOOL_CALLS] prose, gated on the declared tools so an inactive
                # NAME[ARGS]{...} example is kept.
                if not healing_active:
                    text = _strip_tool_xml_for_display(
                        text,
                        auto_heal_tool_calls = True,
                        enabled_tool_names = _display_tool_name_gate(openai_tools),
                    )
                text = text.strip()
                if text:
                    content_blocks.append(AnthropicResponseTextBlock(text = text))

            tool_calls = message.get("tool_calls") or []
            if disable_parallel_tool_use and len(tool_calls) > 1:
                tool_calls = tool_calls[:1]
            for tc in tool_calls:
                fn = tc.get("function") or {}
                try:
                    args = json.loads(fn.get("arguments", "{}"))
                except json.JSONDecodeError:
                    args = {}
                content_blocks.append(
                    AnthropicResponseToolUseBlock(
                        id = anthropic_tool_use_id(tc.get("id")),
                        name = fn.get("name", ""),
                        input = args,
                    )
                )

        stop_reason = openai_finish_to_anthropic_stop(
            finish_reason, had_tool_calls = bool(tool_calls)
        )

        usage = data.get("usage") or {}
        return _anthropic_message_json_response(
            message_id, model_name, content_blocks, stop_reason, usage
        )
    finally:
        await _stop_local_disconnect_cancel_watcher(_cancel_watcher)
        try:
            await _client.aclose()
        except Exception:
            pass


