"""External Cloud Provider Proxy & Message Conversion.

Extracted from monolithic routes/inference.py to preserve SRP and clean architecture.
Supports external models via Anthropic, OpenAI, Gemini, DeepSeek, Codex, etc.
"""
from __future__ import annotations

import asyncio
import json
import logging
import sys
import threading
import time
from typing import Any, Dict, List, Optional, Set, Tuple
from urllib.parse import urlparse as _urlparse

from fastapi import HTTPException, Request
from fastapi.responses import StreamingResponse

from core.inference.api_monitor import api_monitor
from core.inference.external_provider import ExternalProviderClient
from core.inference.external_tool_transport import OAICompatTransport
from core.inference.providers import provider_model_runs_local_tools
from core.inference.studio_tool_loop import (
    ToolLoopPolicy,
    ToolLoopRun,
    stream_with_studio_tools,
)
from models.inference import ChatCompletionRequest
from storage import providers_db
from utils.api_errors import openai_error_body

logger = logging.getLogger(__name__)


def _get_inference_module():
    return sys.modules.get("routes.inference")


def _get_inf_attr(name: str, fallback=None):
    mod = _get_inference_module()
    if mod and hasattr(mod, name):
        return getattr(mod, name)
    return fallback


# Dynamic delegators to inference engine state
def _friendly_error(e):
    fn = _get_inf_attr("_friendly_error")
    return fn(e) if fn else str(e)


def _TrackedCancel(*args, **kwargs):
    cls = _get_inf_attr("_TrackedCancel")
    if cls:
        return cls(*args, **kwargs)
    from contextlib import nullcontext
    return nullcontext()


def _request_has_api_key(request: Any) -> bool:
    fn = _get_inf_attr("_request_has_api_key")
    return fn(request) if fn else False


def _request_used_api_key(request: Any) -> bool:
    fn = _get_inf_attr("_request_used_api_key")
    return fn(request) if fn else False


def _request_is_saved_credential_workflow(request: Any) -> bool:
    fn = _get_inf_attr("_request_is_saved_credential_workflow")
    return fn(request) if fn else False


def _monitor_prompt_from_messages(messages: list) -> str:
    fn = _get_inf_attr("_monitor_prompt_from_messages")
    return fn(messages) if fn else ""


def _monitor_openai_chunk(monitor_id: str, chunk: dict, *, first_token_time: Optional[float] = None) -> None:
    fn = _get_inf_attr("_monitor_openai_chunk")
    if fn:
        fn(monitor_id, chunk, first_token_time=first_token_time)


def _monitor_openai_sse_line(monitor_id: str, line: str, *, first_token_time: Optional[float] = None) -> None:
    fn = _get_inf_attr("_monitor_openai_sse_line")
    if fn:
        fn(monitor_id, line, first_token_time=first_token_time)


def _extract_response_format(payload):
    fn = _get_inf_attr("_extract_response_format")
    return fn(payload) if fn else None


def _effective_max_tokens(payload):
    fn = _get_inf_attr("_effective_max_tokens")
    return fn(payload) if fn else 4096


def _effective_enable_tools(payload):
    fn = _get_inf_attr("_effective_enable_tools")
    return fn(payload) if fn else True


def _select_request_tools(payload, *, current_subject=None):
    fn = _get_inf_attr("_select_request_tools")
    return fn(payload, current_subject=current_subject) if fn else ([], None, False)


def _continue_final_message(payload) -> bool:
    fn = _get_inf_attr("_continue_final_message")
    return fn(payload) if fn else False


def _build_tool_action_nudge(*args, **kwargs):
    fn = _get_inf_attr("_build_tool_action_nudge")
    return fn(*args, **kwargs) if fn else None


def _codex_full_access_nudge(*args, **kwargs):
    fn = _get_inf_attr("_codex_full_access_nudge")
    return fn(*args, **kwargs) if fn else None


def _wants_stream_usage(payload) -> bool:
    fn = _get_inf_attr("_wants_stream_usage")
    return fn(payload) if fn else False


def _is_openai_usage_only_sse(line: str) -> bool:
    fn = _get_inf_attr("_is_openai_usage_only_sse")
    return fn(line) if fn else False


def _is_openai_sse_done(line: str) -> bool:
    fn = _get_inf_attr("_is_openai_sse_done")
    return fn(line) if fn else (line.strip() == "data: [DONE]")


def _openai_responses_part(item: dict) -> Optional[dict]:
    fn = _get_inf_attr("_openai_responses_part")
    return fn(item) if fn else None


def _append_to_codex_instructions(*args, **kwargs):
    fn = _get_inf_attr("_append_to_codex_instructions")
    return fn(*args, **kwargs) if fn else None


def _append_to_system_message(*args, **kwargs):
    fn = _get_inf_attr("_append_to_system_message")
    return fn(*args, **kwargs) if fn else None


def _is_marked_server_builtin_tool_call(*args, **kwargs):
    fn = _get_inf_attr("_is_marked_server_builtin_tool_call")
    return fn(*args, **kwargs) if fn else False


def _filter_tool_calls(*args, **kwargs):
    fn = _get_inf_attr("_filter_tool_calls")
    return fn(*args, **kwargs) if fn else args[0] if args else []


def _get_provider_info(provider_type: str):
    fn = _get_inf_attr("_get_provider_info")
    return fn(provider_type) if fn else None


def _get_codex_provider_info():
    fn = _get_inf_attr("_get_codex_provider_info")
    return fn() if fn else None


def _refresh_codex_access(*args, **kwargs):
    fn = _get_inf_attr("_refresh_codex_access")
    return fn(*args, **kwargs) if fn else None


def _prune_pending(*args, **kwargs):
    fn = _get_inf_attr("_prune_pending")
    if fn:
        fn(*args, **kwargs)


@property
def _SERVER_BUILTIN_TOOL_NAMES():
    return _get_inf_attr("_SERVER_BUILTIN_TOOL_NAMES", frozenset())


# Accessors for cancel registry
def _get_cancel_lock():
    return _get_inf_attr("_CANCEL_LOCK", threading.Lock())


def _get_cancel_registry():
    return _get_inf_attr("_CANCEL_REGISTRY", {})


def _get_pending_cancels():
    return _get_inf_attr("_PENDING_CANCELS", {})

_INPUT_DOCUMENT_PROVIDERS = frozenset({"anthropic", "openai"})


def _build_external_messages(
    messages: list,
    supports_vision: bool,
    provider_type: Optional[str] = None,
    base_url: Optional[str] = None,
) -> list[dict]:
    """
    Convert ChatMessage list to OpenAI-compatible dicts for external providers.

    Behaviour per content-part type:
    - `text`: always preserved.
    - `image_url`: preserved on vision providers; stripped on non-vision.
    - `input_document`: preserved ONLY when the provider's stream helper has
      explicit translation logic (Anthropic + OpenAI today, see
      ``_INPUT_DOCUMENT_PROVIDERS``). Stripped for every other provider so the
      unknown type doesn't reach generic /chat/completions and 400.
    - `reasoning`: OpenAI-only Responses reasoning item paired with a prior
      tool output. Forwarded ONLY when provider_type=="openai" so follow-up
      image edits can replay the required reasoning item.
    - `image_generation_call`: OpenAI-only Responses image reference. Forwarded
      ONLY when provider_type=="openai" so follow-up image edits can reference
      prior generated images.
    - `compaction`: Anthropic-only synthetic part (round-trips server-side
      compaction state). Forwarded ONLY when provider_type=="anthropic";
      stripped elsewhere so the unknown part doesn't reach generic
      /chat/completions and 400 (DeepSeek, Mistral, Gemini, Kimi, OpenRouter).
    """
    document_provider = provider_type in _INPUT_DOCUMENT_PROVIDERS
    anthropic = provider_type == "anthropic"
    openai = provider_type == "openai"
    # `extra_content` carries the assistant's text-part `thoughtSignature`
    # round-trip on Gemini's native streamGenerateContent endpoint. Custom
    # Gemini OpenAI-compat gateways (LiteLLM etc.) route through
    # /chat/completions where the field is unknown and can be rejected -- gate
    # strictly on the Google-hosted Gemini base.
    _native_gemini = False
    if provider_type == "gemini" and base_url:
        try:
            from urllib.parse import urlparse as _urlparse
            _host = (_urlparse(base_url).hostname or "").lower()
            _native_gemini = _host == "generativelanguage.googleapis.com"
        except Exception:
            _native_gemini = False
    emit_extra_content = _native_gemini or provider_type == "openai_codex"

    _SERVER_BUILTIN_TOOL_NAMES = frozenset(
        {"web_search", "web_fetch", "code_execution", "image_generation"}
    )

    def _is_marked_server_builtin_tool_call(tc: Any) -> bool:
        """Return True iff `tc` is a synthetic provider-side tool card with a
        canonical builtin name and either:
          - the `args._server_tool` marker stamped by the backend, or
          - a Gemini `args.google.native_part` payload (durable replay signal
            for code_execution / image_generation that predates the marker).
        Such cards must not be forwarded to non-native providers: they aren't
        real user functions, so the receiving API rejects the orphan tool
        history. Real user functions with these names normally have neither
        signal.
        """
        if not isinstance(tc, dict):
            return False
        fn = tc.get("function")
        if not isinstance(fn, dict):
            return False
        name = (fn.get("name") or "").lower()
        if name not in _SERVER_BUILTIN_TOOL_NAMES:
            return False
        raw_args = fn.get("arguments") or ""
        try:
            args = json.loads(raw_args) if isinstance(raw_args, str) else raw_args
        except Exception:
            return False
        if not isinstance(args, dict):
            return False
        if args.get("_server_tool") is True:
            return True
        google = args.get("google")
        return isinstance(google, dict) and isinstance(google.get("native_part"), dict)

    # When we drop a server-side builtin tool_call, the matching `role="tool"`
    # follow-up must also be dropped -- else the provider gets an orphan
    # tool_call_id with no matching assistant call, which OpenAI Responses and
    # Anthropic both reject.
    dropped_server_builtin_tool_call_ids: set[str] = set()

    def _filter_tool_calls(tool_calls: Any) -> Optional[list]:
        """Sanitize assistant `tool_calls` for non-native-Gemini providers.

        Two concerns:
          1. `tool_calls[i].extra_content` carries Gemini-only thoughtSignature
             metadata; strip it for providers that can't parse the unknown key.
          2. Marked server-side builtin cards (`_server_tool: true` on a
             canonical builtin name, or a Gemini `native_part` payload) are
             Unsloth-internal tool cards from a prior native Gemini turn;
             forwarding them to OpenAI / Anthropic / custom OAI-compat gateways
             sends an orphan `tool_calls` entry (no matching tool declaration,
             often no matching `role="tool"` reply) that can be rejected. We
             record the dropped call_ids so the matching role=tool message is
             skipped below.
        Native Gemini keeps both untouched so the translator can replay them
        via `native_part`.
        """
        if not tool_calls:
            return None
        if not isinstance(tool_calls, list):
            return tool_calls
        if emit_extra_content:
            return tool_calls
        cleaned: list = []
        for _tc in tool_calls:
            if _is_marked_server_builtin_tool_call(_tc):
                _tc_id = _tc.get("id") if isinstance(_tc, dict) else None
                if isinstance(_tc_id, str) and _tc_id:
                    dropped_server_builtin_tool_call_ids.add(_tc_id)
                continue
            if not isinstance(_tc, dict):
                cleaned.append(_tc)
                continue
            if "extra_content" not in _tc:
                cleaned.append(_tc)
                continue
            _stripped = {k: v for k, v in _tc.items() if k != "extra_content"}
            cleaned.append(_stripped)
        return cleaned

    def _openai_responses_part(item: Any) -> Optional[dict[str, Any]]:
        """Rebuild a forwarded OpenAI Responses assistant part (`reasoning` or
        `image_generation_call`); returns None for any other part type."""
        if item.type == "reasoning":
            reasoning: dict[str, Any] = {
                "type": "reasoning",
                "id": item.id,
                "summary": item.summary,
            }
            if item.status:
                reasoning["status"] = item.status
            return reasoning
        if item.type == "image_generation_call":
            image_ref: dict[str, Any] = {"type": "image_generation_call", "id": item.id}
            if getattr(item, "response_id", None):
                image_ref["response_id"] = item.response_id
            return image_ref
        return None

    result = []
    for msg in messages:
        # Drop role=tool messages whose matching server-builtin tool_call was
        # filtered above. An orphan tool_result with no matching tool_call is
        # rejected by OpenAI Responses and Anthropic.
        if (
            msg.role == "tool"
            and isinstance(msg.tool_call_id, str)
            and msg.tool_call_id in dropped_server_builtin_tool_call_ids
        ):
            continue
        if isinstance(msg.content, str):
            # Drop bare assistant messages with no content AND no tool_calls
            # (some providers reject empty assistant turns). Preserve assistant
            # turns whose only payload is tool_calls so multi-turn
            # function-call loops round-trip.
            if msg.role == "assistant" and not msg.content.strip() and not msg.tool_calls:
                continue
            out: dict[str, Any] = {"role": msg.role, "content": msg.content}
            if msg.role == "assistant" and msg.tool_calls:
                _tcs = _filter_tool_calls(msg.tool_calls)
                if _tcs:
                    out["tool_calls"] = _tcs
                elif not msg.content.strip():
                    # Every tool_call was a dropped synthetic provider card;
                    # the turn would be an empty
                    # `{"role":"assistant","content":""}` that some providers
                    # reject. Skip it entirely.
                    continue
            if msg.role == "tool":
                if msg.tool_call_id:
                    out["tool_call_id"] = msg.tool_call_id
                if msg.name:
                    out["name"] = msg.name
            if emit_extra_content and msg.role == "assistant" and msg.extra_content:
                out["extra_content"] = msg.extra_content
            result.append(out)
            continue
        # Assistant messages with content=None but populated tool_calls are
        # valid (post-tool-call turn). Forward them so the provider helper can
        # rebuild the functionCall part.
        if msg.content is None and msg.role == "assistant" and msg.tool_calls:
            _filtered_tcs = _filter_tool_calls(msg.tool_calls)
            if not _filtered_tcs:
                # Every tool_call was provider-side synthetic and dropped;
                # skip the whole message to avoid an empty assistant turn.
                continue
            _assistant_only: dict[str, Any] = {
                "role": "assistant",
                "content": "",
                "tool_calls": _filtered_tcs,
            }
            if emit_extra_content and msg.extra_content:
                _assistant_only["extra_content"] = msg.extra_content
            result.append(_assistant_only)
            continue
        if isinstance(msg.content, list):
            if supports_vision:
                parts = []
                for part in msg.content:
                    if part.type == "text":
                        parts.append({"type": "text", "text": part.text})
                    elif part.type == "image_url":
                        parts.append(
                            {
                                "type": "image_url",
                                "image_url": {"url": part.image_url.url},
                            }
                        )
                    elif (
                        openai
                        and msg.role == "assistant"
                        and (_rp := _openai_responses_part(part)) is not None
                    ):
                        # ExternalProviderClient maps image_generation_call onto a
                        # top-level Responses input item after the current user
                        # prompt, or onto `previous_response_id` when response_id
                        # is available from the prior turn.
                        parts.append(_rp)
                    elif part.type == "input_document" and document_provider:
                        # ExternalProviderClient maps this onto Anthropic's
                        # `document` or OpenAI Responses' `input_file` block;
                        # every other provider would 400 on the unknown part.
                        doc: dict[str, Any] = {"type": "input_document"}
                        if part.file_data:
                            doc["file_data"] = part.file_data
                        if part.file_url:
                            doc["file_url"] = part.file_url
                        if part.filename:
                            doc["filename"] = part.filename
                        if part.media_type:
                            doc["media_type"] = part.media_type
                        parts.append(doc)
                    elif part.type == "compaction" and anthropic:
                        # Anthropic stream helper forwards this as a native
                        # `compaction` block; every other provider would 400 on
                        # the unknown part, so gate by provider_type.
                        parts.append({"type": "compaction", "content": part.content})
                entry: dict[str, Any] = {"role": msg.role, "content": parts}
                if msg.role == "assistant" and msg.tool_calls:
                    _tcs = _filter_tool_calls(msg.tool_calls)
                    if _tcs:
                        entry["tool_calls"] = _tcs
                    elif not parts:
                        # All tool_calls were synthetic and dropped, and no
                        # content parts survived. Skip rather than forward an
                        # empty assistant turn that downstream providers reject.
                        continue
                elif msg.role == "assistant" and not parts:
                    continue
                if msg.role == "tool":
                    if msg.tool_call_id:
                        entry["tool_call_id"] = msg.tool_call_id
                    if msg.name:
                        entry["name"] = msg.name
                if emit_extra_content and msg.role == "assistant" and msg.extra_content:
                    entry["extra_content"] = msg.extra_content
                result.append(entry)
            else:
                # Non-vision provider: strip images / documents, keep text,
                # optionally keep compaction (Anthropic only --
                # compaction-capable Anthropic models all report
                # supports_vision=True today, but gate here for safety).
                preserved = []
                for p in msg.content:
                    if p.type == "text":
                        preserved.append({"type": "text", "text": p.text})
                    elif (
                        openai
                        and msg.role == "assistant"
                        and (_rp := _openai_responses_part(p)) is not None
                    ):
                        preserved.append(_rp)
                    elif p.type == "compaction" and anthropic:
                        preserved.append({"type": "compaction", "content": p.content})
                if msg.role == "assistant" and not preserved:
                    continue
                if len(preserved) == 1 and preserved[0]["type"] == "text":
                    # Single text part collapses to a string for providers that
                    # don't accept content arrays.
                    entry = {"role": msg.role, "content": preserved[0]["text"]}
                else:
                    entry = {"role": msg.role, "content": preserved}
                if msg.role == "assistant" and msg.tool_calls:
                    _tcs = _filter_tool_calls(msg.tool_calls)
                    if _tcs:
                        entry["tool_calls"] = _tcs
                    else:
                        # All tool_calls were synthetic and dropped; skip if no
                        # content survived either.
                        _entry_content = entry.get("content")
                        _has_text = (
                            isinstance(_entry_content, str) and _entry_content.strip()
                        ) or (isinstance(_entry_content, list) and len(_entry_content) > 0)
                        if not _has_text:
                            continue
                if msg.role == "tool":
                    if msg.tool_call_id:
                        entry["tool_call_id"] = msg.tool_call_id
                    if msg.name:
                        entry["name"] = msg.name
                if emit_extra_content and msg.role == "assistant" and msg.extra_content:
                    entry["extra_content"] = msg.extra_content
                result.append(entry)
    return result


async def _proxy_to_external_provider(
    payload: ChatCompletionRequest,
    request: Request,
    current_subject: Optional[str] = None,
) -> StreamingResponse:
    """
    Proxy a chat completion request to an external LLM provider.

    Resolves provider config (DB or registry), decrypts the API key, and
    streams the response back in OpenAI SSE format.
    """
    # Resolve provider type and base URL
    provider_type = payload.provider_type
    base_url = payload.provider_base_url

    if payload.provider_id and not payload.encrypted_api_key:
        config = providers_db.get_provider(payload.provider_id)
        if config is None:
            raise HTTPException(
                status_code = 404,
                detail = f"Provider config not found: {payload.provider_id}",
            )
        if not config["is_enabled"]:
            raise HTTPException(
                status_code = 400,
                detail = f"Provider '{config['display_name']}' is disabled.",
            )
        # A saved credential is scoped to this saved provider. Never pair it with
        # request-controlled routing metadata.
        provider_type = config["provider_type"]
        base_url = config["base_url"]

    if not provider_type:
        raise HTTPException(
            status_code = 400,
            detail = "Either provider_id or provider_type is required for external provider routing.",
        )

    # Studio's tools run on this host, so any provider whose wire format can
    # carry a tool schema out and a result back can use them. The capability is
    # declared per provider type in the registry, not hardcoded here.
    #
    # Streaming is part of the condition, not an afterthought: the loop is an SSE
    # protocol (tool_start / tool_end and the approval handshake all ride the
    # stream), so a non-streaming request still cannot honour confirm_tool_calls
    # and must still be refused below rather than silently proxied without it.
    studio_tool_loop = (
        # Model-aware: Gemini's image models drop the function catalog inside the
        # native translator, so entering the loop for them would advertise tools
        # the model is never shown and finish as if none were selected.
        provider_model_runs_local_tools(provider_type, payload.external_model or payload.model)
        and payload.stream is True
        and _explicit_studio_tool_loop_requested(payload)
        # A selection of purely hosted names is the provider's tool envelope, not
        # a request for this loop. Checked here rather than inside the loop so the
        # whole path (catalog selection, nudge, confirm gate) is skipped and the
        # request proxies through byte-for-byte as it did before the loop existed.
        and not _selects_only_provider_hosted_tools(payload, provider_type)
    )
    codex_studio_tool_loop = studio_tool_loop and provider_type == "openai_codex"
    # Studio's UI asks for the gate by permission_mode, not by confirm_tool_calls,
    # so reading the raw flag admits the exact request the local routes reject: a
    # non-streaming permission_mode="ask" with the flag omitted proxies through
    # with its tools live and no confirmation the caller explicitly asked for.
    # Derive it the way the local guard does, and only for the non-streaming case
    # it covers: a streaming request that merely fell out of the loop (a
    # hosted-only selection, or a provider that runs no local tools) keeps
    # answering an ask/auto mode as it always has, and is still refused on an
    # explicit flag.
    _external_confirm_gate = bool(payload.confirm_tool_calls) or (
        not payload.stream and _confirm_gate_needs_stream(payload)
    )
    if (
        _external_confirm_gate
        and not payload.bypass_permissions
        and not studio_tool_loop
        and (
            payload.enable_tools is True
            or bool(payload.enabled_tools)
            or bool(payload.tools)
            or bool(payload.openai_code_exec_container_id)
            or bool(payload.anthropic_code_exec_container_id)
        )
    ):
        raise HTTPException(
            status_code = 400,
            detail = openai_error_body(
                "confirm_tool_calls is only supported for local streaming tools.",
                status = 400,
                code = "invalid_request_error",
                param = "confirm_tool_calls",
            ),
        )
    # Fall back to registry default base URL. The registry lookup is checked on
    # its own: a caller-supplied base_url used to make an unknown provider_type
    # pass straight through to the proxy.
    if get_provider_info(provider_type) is None:
        raise HTTPException(
            status_code = 400,
            detail = f"Unknown provider type: {provider_type}",
        )
    if not base_url:
        base_url = get_base_url(provider_type)
    if not base_url:
        raise HTTPException(
            status_code = 400,
            detail = f"Base URL is required for provider type: {provider_type}",
        )
    # Validate the proxy destination before the API key is decrypted, so a
    # refused target never sees a credential.
    try:
        base_url = validate_provider_base_url(base_url)
    except ValueError as exc:
        raise HTTPException(status_code = 400, detail = str(exc)) from None

    if provider_type == "openai_codex":
        from core.inference.openai_codex_auth import (
            OPENAI_CODEX_API_BASE,
            CodexAuthError,
            resolve_access,
        )
        from core.inference.openai_codex_client import (
            OpenAICodexClient,
            CodexTransportError,
            CodexQuotaError,
            CodexReauthorizationError,
        )

        # Through the same helper the saved-credential exception uses, not a bare
        # auth_storage probe: a raising probe used to escape as a 500, and a 500
        # is not a decision -- the same failure on the branch below withholds the
        # credential instead. The workflow scope is the same question too, since
        # this branch spends a saved ChatGPT subscription.
        if _request_has_api_key(request) and not _request_is_saved_credential_workflow(request):
            raise HTTPException(
                status_code = 403,
                detail = "ChatGPT subscriptions are available only to Studio UI and internal workflows.",
            )
        if not payload.provider_id or payload.encrypted_api_key:
            raise HTTPException(
                status_code = 400, detail = "A saved ChatGPT subscription connection is required."
            )
        if base_url != OPENAI_CODEX_API_BASE:
            raise HTTPException(status_code = 400, detail = "ChatGPT subscription routing is fixed.")
        if payload.stream is not True:
            raise HTTPException(
                status_code = 400, detail = "ChatGPT subscription chat requires stream=true."
            )
        model = payload.external_model or payload.model
        from core.inference.providers import get_provider_info as _get_codex_provider_info

        info = _get_codex_provider_info("openai_codex") or {}
        if model not in info.get("default_models", []):
            raise HTTPException(status_code = 400, detail = "Choose a curated Codex model.")

        model_supports_vision = bool(
            info.get("model_capabilities", {}).get(model, {}).get("vision")
        )
        if not model_supports_vision:
            for message in payload.messages:
                if isinstance(message.content, list) and any(
                    part.type == "image_url" for part in message.content
                ):
                    raise HTTPException(
                        status_code = 400,
                        detail = f"{model} does not accept image input.",
                    )
        try:
            access_token, account_id = await resolve_access(payload.provider_id)
        except CodexAuthError as exc:
            raise HTTPException(status_code = 401, detail = str(exc)) from exc
        chat_messages = _build_external_messages(
            payload.messages,
            model_supports_vision,
            provider_type = provider_type,
            base_url = base_url,
        )
        tool_payloads = [
            tool.model_dump(exclude_none = True) if hasattr(tool, "model_dump") else tool
            for tool in (payload.tools or [])
        ]

        studio_tool_payloads: list[dict] = []
        if _explicit_studio_tool_loop_requested(payload):
            studio_tool_payloads = await _select_request_tools(
                payload,
                tools_on = _effective_enable_tools(payload) is True,
                mcp_allowed = bool(payload.mcp_enabled),
            )
            # The Studio loop owns its schemas. Do not also expose a caller-supplied
            # catalog: Codex would return calls that this server is not authorized to run.
            tool_payloads = studio_tool_payloads
            # This path runs python/terminal locally too (disable_sandbox =
            # bypass_permissions), so it has the same false-isolation problem.
            # Only the Full access sentence is added: the path has never carried
            # the general tool nudge, and widening it would change every
            # non-Full-access Codex run as a side effect.
            if payload.bypass_permissions:
                _codex_full_access_nudge = _build_tool_action_nudge(
                    tools = studio_tool_payloads,
                    model_name = model,
                    full_access = True,
                    full_access_only = True,
                )
                chat_messages = _append_to_codex_instructions(
                    chat_messages, _codex_full_access_nudge
                )
        cancel_event = threading.Event()
        cancel_keys = tuple(key for key in (payload.cancel_id, payload.session_id) if key)

        async def _codex_stream():
            current_access_token = access_token

            async def _refresh_codex_access() -> tuple[str, str]:
                nonlocal current_access_token
                current_access_token, refreshed_account_id = await resolve_access(
                    payload.provider_id,
                    force_refresh = True,
                    expected_access_token = current_access_token,
                )
                return current_access_token, refreshed_account_id

            from core.inference.openai_codex_tool_loop import (
                CodexRunContext,
                CodexToolPolicy,
                stream_codex_with_studio_tools,
            )

            run = CodexRunContext(
                provider_id = payload.provider_id,
                thread_id = payload.thread_id,
                session_id = payload.session_id,
                messages = chat_messages,
                model = model,
                reasoning_effort = payload.reasoning_effort,
                response_format = _extract_response_format(payload),
                tool_choice = payload.tool_choice,
                continue_final_message = _continue_final_message(payload),
            )
            policy = (
                CodexToolPolicy(
                    tools = studio_tool_payloads,
                    max_calls = (
                        payload.max_tool_calls_per_message
                        if payload.max_tool_calls_per_message is not None
                        else 25
                    ),
                    timeout = payload.tool_call_timeout or 300,
                    permission_mode = payload.permission_mode or "auto",
                    confirm_calls = _permission_mode_confirm(payload),
                    bypass_permissions = bool(payload.bypass_permissions),
                    rag_scope = payload.rag_scope,
                )
                if studio_tool_payloads
                else None
            )
            should_cancel = False
            with _get_cancel_lock():
                now = time.monotonic()
                _prune_pending(now)
                for key in cancel_keys:
                    _CANCEL_REGISTRY.setdefault(key, set()).add(cancel_event)
                if payload.cancel_id and _get_pending_cancels().pop(payload.cancel_id, None) is not None:
                    should_cancel = True
            if should_cancel:
                cancel_event.set()

            async def _watch_disconnect() -> None:
                while not cancel_event.is_set():
                    if await request.is_disconnected():
                        cancel_event.set()
                        return
                    await asyncio.sleep(0.1)

            disconnect_task = asyncio.create_task(_watch_disconnect())

            client = OpenAICodexClient(
                access_token,
                account_id,
                refresh_access = _refresh_codex_access,
            )
            try:
                # Closing the upstream response from the client's watcher makes
                # cancellation immediate even while no SSE line is arriving.
                generator = (
                    stream_codex_with_studio_tools(
                        client,
                        run = run,
                        policy = policy,
                        cancel_event = cancel_event,
                    )
                    if policy
                    else client.stream(
                        provider_id = run.provider_id,
                        thread_id = run.thread_id,
                        messages = run.messages,
                        model = run.model,
                        max_tokens = _effective_max_tokens(payload),
                        reasoning_effort = run.reasoning_effort,
                        response_format = run.response_format,
                        tools = tool_payloads,
                        tool_choice = payload.tool_choice,
                        cancel_event = cancel_event,
                    )
                )
                async for line in generator:
                    if cancel_event.is_set() or await request.is_disconnected():
                        await generator.aclose()
                        break
                    yield f"{line}\n\n"
                yield "data: [DONE]\n\n"
            except asyncio.CancelledError:
                raise
            except CodexReauthorizationError as exc:
                from core.inference.openai_codex_auth import (
                    mark_reauthorization_required,
                    provider_oauth_write_guard,
                )

                async with provider_oauth_write_guard(payload.provider_id):
                    mark_reauthorization_required(
                        payload.provider_id,
                        expected_access_token = exc.metadata.get("access_token"),
                    )
                yield (
                    "data: "
                    + json.dumps({"error": {"message": str(exc), "type": "authentication_error"}})
                    + "\n\n"
                )
                yield "data: [DONE]\n\n"
            except CodexQuotaError as exc:
                yield (
                    "data: "
                    + json.dumps(
                        {
                            "error": {
                                "message": str(exc),
                                "type": "rate_limit_error",
                                "metadata": exc.metadata,
                            }
                        }
                    )
                    + "\n\n"
                )
                yield "data: [DONE]\n\n"

            except CodexTransportError as exc:
                logger.warning(
                    "openai_codex.stream_failed",
                    error_type = type(exc).__name__,
                    status = exc.status,
                    error = str(exc),
                )
                yield (
                    "data: "
                    + json.dumps({"error": {"message": str(exc), "type": "upstream_error"}})
                    + "\n\n"
                )
                yield "data: [DONE]\n\n"

            except Exception as exc:
                logger.warning(
                    "openai_codex.stream_failed",
                    error_type = type(exc).__name__,
                    status = getattr(exc, "status", None),
                    error = str(exc),
                )
                yield (
                    "data: "
                    + json.dumps(
                        {"error": {"message": _friendly_error(exc), "type": "server_error"}}
                    )
                    + "\n\n"
                )
                yield "data: [DONE]\n\n"
            finally:
                await client.close()
                disconnect_task.cancel()
                await asyncio.gather(disconnect_task, return_exceptions = True)

                with _get_cancel_lock():
                    for key in cancel_keys:
                        bucket = _CANCEL_REGISTRY.get(key)
                        if bucket:
                            bucket.discard(cancel_event)
                            if not bucket:
                                _get_cancel_registry().pop(key, None)

        return StreamingResponse(
            _codex_stream(),
            media_type = "text/event-stream",
            headers = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
        )

    api_key = resolve_provider_api_key_or_400(
        payload.provider_id,
        payload.encrypted_api_key,
        # A durable Deep Research hop authenticates with an internal workflow key,
        # which is still an API key, so the plain check would drop the saved
        # provider id and fail before the provider is ever contacted. The run's
        # connection was already validated as an enabled saved one by
        # research_runs._sanitize_config, and the key is verified against storage.
        # Scoped to that one workflow rather than to "internal", because the other
        # internal key Studio mints is held by a user-authored recipe subprocess.
        allow_saved_key = (
            not _request_has_api_key(request) or _request_is_saved_credential_workflow(request)
        ),
    )

    model = payload.external_model or payload.model
    if model == "default":
        raise HTTPException(
            status_code = 400,
            detail = "external_model is required when using an external provider.",
        )

    # Build messages, preserving multimodal content for vision providers
    from core.inference.providers import get_provider_info as _get_provider_info

    _pinfo = _get_provider_info(provider_type) or {}
    _supports_vision = _pinfo.get("supports_vision", False)
    chat_messages = _build_external_messages(
        payload.messages,
        _supports_vision,
        provider_type = provider_type,
        base_url = base_url,
    )
    monitor_id = None
    if not getattr(request.state, "skip_api_monitor", False):
        monitor_id = api_monitor.start(
            endpoint = request.url.path,
            via_api_key = _request_used_api_key(request),
            method = request.method,
            model = model,
            prompt = _monitor_prompt_from_messages(payload.messages),
            context_length = None,
            subject = current_subject,
        )

    client = ExternalProviderClient(
        provider_type = provider_type,
        base_url = base_url,
        api_key = api_key,
    )

    # `top_k` defaults to 20 in ChatCompletionRequest because the local path
    # expects an int, but the external-provider path treats "field omitted from
    # JSON" as "use provider default" so callers sending only model/messages
    # don't silently get different sampling than before this PR. Pydantic's
    # `model_fields_set` tracks explicit-vs-default per request.
    _top_k_explicit = payload.top_k if "top_k" in payload.model_fields_set else None

    # Studio-owned tool loop for every non-Codex provider that declares the
    # capability. The catalog comes from the same selector the local and Codex
    # paths use, so an omitted enabled_tools means "all allowed built-ins" and an
    # explicit empty list stays empty.
    external_studio_tools: list[dict] = []
    if studio_tool_loop:
        external_studio_tools = await _select_request_tools(
            payload,
            tools_on = _effective_enable_tools(payload) is True,
            mcp_allowed = bool(payload.mcp_enabled),
        )
    run_studio_tool_loop = bool(external_studio_tools)
    if run_studio_tool_loop and payload.bypass_permissions:
        # Full access disables the sandbox at execution time, so the schemas must
        # say so too rather than describing a sandbox the model will not get.
        _external_nudge = _build_tool_action_nudge(
            tools = external_studio_tools,
            model_name = model,
            full_access = True,
            full_access_only = True,
        )
        if _external_nudge:
            chat_messages = _append_to_system_message(chat_messages, _external_nudge)

    cancel_event = threading.Event()
    cancel_keys = tuple(key for key in (payload.cancel_id, payload.session_id) if key)

    async def _watch_disconnect() -> None:
        # A tool loop can sit for minutes inside execute_tool with no SSE line
        # arriving, so poll rather than waiting for the next yield to notice.
        while not cancel_event.is_set():
            if await request.is_disconnected():
                cancel_event.set()
                return
            await asyncio.sleep(0.1)

    async def _stream():
        _provider_kwargs = dict(
            temperature = payload.temperature,
            top_p = payload.top_p,
            # Honor max_completion_tokens when max_tokens is absent, so a
            # provider-routed request capped only by the newer field still gets
            # a limit instead of falling back to the provider default.
            max_tokens = _effective_max_tokens(payload),
            presence_penalty = payload.presence_penalty,
            top_k = _top_k_explicit,
            enable_thinking = payload.enable_thinking,
            reasoning_effort = payload.reasoning_effort,
            enable_prompt_caching = payload.enable_prompt_caching,
            openai_code_exec_container_id = payload.openai_code_exec_container_id,
            anthropic_code_exec_container_id = payload.anthropic_code_exec_container_id,
            prompt_cache_ttl = payload.prompt_cache_ttl,
            compaction_threshold = payload.compaction_threshold,
            fast_mode = payload.fast_mode,
            response_format = _extract_response_format(payload),
        )
        if run_studio_tool_loop:
            # The Studio loop owns the tool surface for this turn. The caller's
            # own catalog is dropped for the same reason the Codex path drops it
            # (the model would return calls this server is not authorized to
            # run), and the hosted names Studio runs itself are withheld so the
            # provider's builtins do not double up on the local web_search.
            # Hosted-only tools still ride along: Images and Fetch have their own
            # toggles and no local stand-in, so dropping them would turn a lit
            # pill into a tool the model never sees.
            loop_hosted_tools = hosted_only_tools(provider_type, payload.enabled_tools)
            gen = stream_with_studio_tools(
                OAICompatTransport(
                    client,
                    model = model,
                    continue_final_message = _continue_final_message(payload),
                    enabled_tools = loop_hosted_tools or None,
                    stream = True,
                    **_provider_kwargs,
                ),
                run = ToolLoopRun(
                    messages = chat_messages,
                    session_id = payload.session_id,
                    thread_id = payload.thread_id,
                    # The loop withholds the provider's own usage-only chunks and
                    # sends one summed chunk instead, so this is the only model id
                    # the client sees for the whole answer. Omitted, it falls back
                    # to the literal "external" and the usage is attributed to
                    # nothing: no cost lookup, no per-model accounting.
                    model = model,
                    tool_choice = payload.tool_choice,
                    continue_final_message = _continue_final_message(payload),
                ),
                policy = ToolLoopPolicy(
                    tools = external_studio_tools,
                    max_calls = (
                        payload.max_tool_calls_per_message
                        if payload.max_tool_calls_per_message is not None
                        else 25
                    ),
                    timeout = payload.tool_call_timeout or 300,
                    permission_mode = payload.permission_mode or "auto",
                    confirm_calls = _permission_mode_confirm(payload),
                    bypass_permissions = bool(payload.bypass_permissions),
                    rag_scope = payload.rag_scope,
                    auto_heal = payload.auto_heal_tool_calls,
                ),
                cancel_event = cancel_event,
            )
        else:
            gen = client.stream_chat_completion(
                messages = chat_messages,
                model = model,
                enabled_tools = payload.enabled_tools,
                tools = payload.tools,
                tool_choice = payload.tool_choice,
                continue_final_message = _continue_final_message(payload),
                stream = payload.stream,
                **_provider_kwargs,
            )
        disconnect_task = asyncio.create_task(_watch_disconnect()) if run_studio_tool_loop else None
        try:
            sent_done = False
            stream_failed = False
            async for line in gen:
                monitor_event = _monitor_openai_sse_line(monitor_id, line)
                if monitor_event is None:
                    try:
                        # Only stamp a real delta stream: a stream:false response is one
                        # full line, so end-to-end latency, not TTFT.
                        _monitor_openai_chunk(
                            monitor_id, json.loads(line), streaming = bool(payload.stream)
                        )
                    except Exception:
                        pass
                if monitor_event == "error":
                    stream_failed = True
                # The monitor has read it by now. Providers are asked for usage on the
                # stream regardless of what the caller wanted, so honour OpenAI's contract
                # on the way out: a client that did not opt in never sees the standalone
                # choices: [] chunk. Same rule _cmpl_stream_event_out applies locally.
                if not _wants_stream_usage(payload) and _is_openai_usage_only_sse(line):
                    continue
                yield f"{line}\n\n"
                # Parsed from the line itself, not from monitor_event: with the
                # monitor disabled the helper returns None for every line, and
                # trusting it would append a second [DONE] after the provider's.
                if _is_openai_sse_done(line):
                    sent_done = True
            if not sent_done:
                if not stream_failed:
                    api_monitor.finish(monitor_id)
                yield "data: [DONE]\n\n"
        except asyncio.CancelledError:
            api_monitor.finish(monitor_id, "cancelled")
            raise
        except Exception as exc:
            logger.error("external_provider.stream_error", error = str(exc))
            api_monitor.fail(monitor_id, _friendly_error(exc))
            # Surface the failure: a bare EOF (e.g. after a read timeout) is treated
            # by the chat client as success, saving a partial answer with no error.
            yield (
                "data: "
                + json.dumps({"error": {"message": _friendly_error(exc), "type": "server_error"}})
                + "\n\n"
            )
            yield "data: [DONE]\n\n"
        finally:
            cancel_event.set()
            if disconnect_task is not None:
                # Joined, not just cancelled. A bare cancel() leaves the task's
                # result unretrieved, so asyncio logs "Task exception was never
                # retrieved" when it is collected, and the poll can still be
                # mid-await on request.is_disconnected() while the response is
                # torn down. Same pairing as the Codex branch and the local
                # watchers.
                disconnect_task.cancel()
                await asyncio.gather(disconnect_task, return_exceptions = True)
            try:
                await gen.aclose()
            except RuntimeError:
                pass  # suppress httpcore asyncgen cleanup error (Python 3.13 + httpcore 1.0.x)
            await client.close()

    def _tracked_stream():
        # Only the tool loop is registered: it can run for minutes and a /load
        # needs to know it would interrupt a chat. The plain proxy stays
        # untracked, as it was before.
        if not run_studio_tool_loop:
            return _stream()

        async def _wrapped():
            with _TrackedCancel.for_payload(cancel_event, payload, *cancel_keys):
                async for chunk in _stream():
                    yield chunk

        return _wrapped()

    return StreamingResponse(
        _tracked_stream(),
        media_type = "text/event-stream",
        headers = {
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
