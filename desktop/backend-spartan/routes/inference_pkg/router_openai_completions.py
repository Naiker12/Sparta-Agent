"""OpenAI-compatible Completions & Embeddings Router (/v1/completions, /v1/embeddings).

Extracted from monolithic routes/inference.py to preserve SRP and clean architecture.
"""
from __future__ import annotations

import asyncio
import json
import logging
import sys
import threading
import time
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from auth import get_current_subject
from core.inference.api_monitor import api_monitor
from core.inference.llama_cpp import LlamaCppBackend

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_inference_module():
    return sys.modules.get("routes.inference")


def _get_inf_attr(name: str, fallback=None):
    mod = _get_inference_module()
    if mod and hasattr(mod, name):
        return getattr(mod, name)
    return fallback


def get_llama_cpp_backend():
    fn = _get_inf_attr("get_llama_cpp_backend")
    if fn:
        return fn()
    return LlamaCppBackend()


def _friendly_error(e):
    fn = _get_inf_attr("_friendly_error")
    return fn(e) if fn else str(e)


def _TrackedCancel(*args, **kwargs):
    cls = _get_inf_attr("_TrackedCancel")
    if cls:
        return cls(*args, **kwargs)
    from contextlib import nullcontext
    return nullcontext()


def _send_stream_with_preheader_cancel(*args, **kwargs):
    fn = _get_inf_attr("_send_stream_with_preheader_cancel")
    if fn:
        return fn(*args, **kwargs)
    raise RuntimeError("_send_stream_with_preheader_cancel not available")


def _aclose_stream_resources(*args, **kwargs):
    fn = _get_inf_attr("_aclose_stream_resources")
    if fn:
        return fn(*args, **kwargs)


def _aiter_llama_stream_items(*args, **kwargs):
    fn = _get_inf_attr("_aiter_llama_stream_items")
    if fn:
        return fn(*args, **kwargs)


def _auto_switch_from_request_body(*args, **kwargs):
    fn = _get_inf_attr("_auto_switch_from_request_body")
    if fn:
        return fn(*args, **kwargs)


def _automatic_model_load_may_run():
    fn = _get_inf_attr("_automatic_model_load_may_run")
    return fn() if fn else False


def _await_cancel_or_disconnect_then_close_client(*args, **kwargs):
    fn = _get_inf_attr("_await_cancel_or_disconnect_then_close_client")
    if fn:
        return fn(*args, **kwargs)


def _await_disconnect_then_close(*args, **kwargs):
    fn = _get_inf_attr("_await_disconnect_then_close")
    if fn:
        return fn(*args, **kwargs)


def _cancelable_nonstreaming_client(*args, **kwargs):
    fn = _get_inf_attr("_cancelable_nonstreaming_client")
    if fn:
        return fn(*args, **kwargs)
    return httpx.AsyncClient()


def _cmpl_stream_event_out(*args, **kwargs):
    fn = _get_inf_attr("_cmpl_stream_event_out")
    if fn:
        return fn(*args, **kwargs)


def _direct_llama_request_finished(*args, **kwargs):
    fn = _get_inf_attr("_direct_llama_request_finished")
    if fn:
        return fn(*args, **kwargs)


def _direct_llama_request_started(*args, **kwargs):
    fn = _get_inf_attr("_direct_llama_request_started")
    if fn:
        return fn(*args, **kwargs)


def _effective_openai_max_tokens_from_values(*args, **kwargs):
    fn = _get_inf_attr("_effective_openai_max_tokens_from_values")
    if fn:
        return fn(*args, **kwargs)
    return 4096


def _fill_recommended_sampling_completions(*args, **kwargs):
    fn = _get_inf_attr("_fill_recommended_sampling_completions")
    if fn:
        return fn(*args, **kwargs)


def _llama_non_streaming_generation_timeout():
    fn = _get_inf_attr("_llama_non_streaming_generation_timeout")
    return fn() if fn else httpx.Timeout(60.0)


def _llama_public_model_id(llama_backend, fallback: Optional[str] = None) -> Optional[str]:
    fn = _get_inf_attr("_llama_public_model_id")
    return fn(llama_backend, fallback) if fn else fallback


def _llama_streaming_generation_timeout():
    fn = _get_inf_attr("_llama_streaming_generation_timeout")
    return fn() if fn else httpx.Timeout(60.0)


def _monitor_context_length():
    fn = _get_inf_attr("_monitor_context_length")
    return fn() if fn else None


def _monitor_openai_chunk(*args, **kwargs):
    fn = _get_inf_attr("_monitor_openai_chunk")
    if fn:
        return fn(*args, **kwargs)


def _monitor_openai_sse_event(*args, **kwargs):
    fn = _get_inf_attr("_monitor_openai_sse_event")
    if fn:
        return fn(*args, **kwargs)


def _no_model_loaded_error(*args, **kwargs):
    fn = _get_inf_attr("_no_model_loaded_error")
    if fn:
        return fn(*args, **kwargs)
    return HTTPException(status_code=503, detail="No model loaded")


def _openai_passthrough_error(*args, **kwargs):
    fn = _get_inf_attr("_openai_passthrough_error")
    if fn:
        return fn(*args, **kwargs)
    return HTTPException(status_code=500, detail="OpenAI passthrough error")


def _openai_stream_error_chunk(*args, **kwargs):
    fn = _get_inf_attr("_openai_stream_error_chunk")
    if fn:
        return fn(*args, **kwargs)
    return {}


def _openai_stream_error_sse_bytes(*args, **kwargs):
    fn = _get_inf_attr("_openai_stream_error_sse_bytes")
    if fn:
        return fn(*args, **kwargs)
    return b""


def _request_used_api_key(request: Any) -> bool:
    fn = _get_inf_attr("_request_used_api_key")
    return fn(request) if fn else False


def _rewrite_cmpl_id(*args, **kwargs):
    fn = _get_inf_attr("_rewrite_cmpl_id")
    if fn:
        return fn(*args, **kwargs)
    return args[0] if args else b""


def _sse_streaming_response(content, *, unstarted_cleanup = None):
    fn = _get_inf_attr("_sse_streaming_response")
    if fn:
        return fn(content, unstarted_cleanup=unstarted_cleanup)
    from fastapi.responses import StreamingResponse
    return StreamingResponse(content, media_type="text/event-stream")


def _stop_local_disconnect_cancel_watcher(*args, **kwargs):
    fn = _get_inf_attr("_stop_local_disconnect_cancel_watcher")
    if fn:
        return fn(*args, **kwargs)


_DEFAULT_FIRST_TOKEN_TIMEOUT_S = 60.0
_DEFAULT_MAX_TOKENS_FLOOR = 1

# =====================================================================
# OpenAI-Compatible Completions Proxy  (/completions → /v1/completions)
# =====================================================================


def _flatten_monitor_prompt(value) -> str:
    """Flatten an OpenAI prompt/input field (str or list) into the single
    string the api_monitor prompt preview expects."""
    if isinstance(value, list):
        return "\n".join(str(part) for part in value)
    return str(value)


def _completions_prompt_present(body: dict) -> bool:
    """Whether a completions body carries a usable ``prompt`` (non-empty)."""
    prompt = body.get("prompt")
    if isinstance(prompt, str):
        return prompt != ""
    if isinstance(prompt, (list, tuple)):
        return len(prompt) > 0
    return prompt is not None


@router.post("/completions")
async def openai_completions(request: Request, current_subject: str = Depends(get_current_subject)):
    """
    OpenAI-compatible text completions endpoint (non-chat).

    Proxies to the running llama-server's ``/v1/completions``. Only available
    when a GGUF model is loaded.
    """
    llama_backend = get_llama_cpp_backend()

    # Reject a request with no prompt before any automatic load so an invalid
    # request never swaps or reloads the resident model (as chat/embeddings already
    # validate before switching). Gate on every automatic-load trigger.
    if _automatic_model_load_may_run():
        try:
            _pre = await request.json()
        except (json.JSONDecodeError, ValueError):
            _pre = None
        if isinstance(_pre, dict):
            _pre_prompt = _pre.get("prompt")
            if _pre_prompt is not None and not isinstance(_pre_prompt, (str, list, tuple)):
                # An object/number prompt is a deterministic client error (only a
                # string or array is valid); reject it before the switch so a bad
                # shape can't load a GGUF only to be rejected by llama-server after.
                raise HTTPException(status_code = 400, detail = "'prompt' must be a string or array.")
            if not _completions_prompt_present(_pre):
                raise HTTPException(status_code = 400, detail = "'prompt' is required for completions.")

    # Opt-in: load the requested local GGUF before the loaded-state check.
    body = await _auto_switch_from_request_body(request, current_subject)
    if not llama_backend.is_loaded:
        _status, _detail = await _no_model_loaded_error(
            "No GGUF model loaded. Load a GGUF model first.",
            _raw_body_model(body),
            request,
            status = 503,
        )
        raise HTTPException(status_code = _status, detail = _detail)
    if not isinstance(body, dict):
        # Re-read to re-raise a malformed-body error (post-503, pre-feature behavior);
        # a valid non-dict body such as a list is a clean 400 rather than a 500.
        body = await request.json()
        if not isinstance(body, dict):
            raise HTTPException(status_code = 400, detail = "Request body must be a JSON object")

    _resolved_max_tokens = _effective_openai_max_tokens_from_values(body.get("max_tokens"))
    body["max_tokens"] = (
        _resolved_max_tokens
        if _resolved_max_tokens is not None
        else (llama_backend.context_length or _DEFAULT_MAX_TOKENS_FLOOR)
    )
    # Apply per-model recommended sampling and any operator UNSLOTH_SAMPLING_* pin to the raw
    # body so /v1/completions honors the same pins as /v1/chat/completions; it is otherwise a
    # verbatim proxy that would keep llama-server's defaults for every omitted sampling field.
    _fill_recommended_sampling_completions(body, getattr(llama_backend, "model_identifier", None))
    target_url = f"{llama_backend.base_url}/v1/completions"
    is_stream = body.get("stream", False)
    prompt_text = _flatten_monitor_prompt(body.get("prompt", ""))
    monitor_model = str(body.get("model") or _llama_public_model_id(llama_backend) or "default")
    monitor_id = api_monitor.start(
        endpoint = request.url.path,
        via_api_key = _request_used_api_key(request),
        method = request.method,
        model = monitor_model,
        prompt = prompt_text,
        context_length = llama_backend.context_length,
        subject = current_subject,
    )

    if is_stream:

        async def _stream():
            # Manual httpx client/response lifecycle AND explicit iterator
            # close — see _anthropic_passthrough_stream for the full rationale.
            # Saving the iterator and closing it in the finally block avoids the
            # Python 3.13 + httpcore 1.0.x "Exception ignored in:
            # <async_generator>" / anyio cancel-scope trace.
            #
            # Buffer the relay into whole SSE events (split on the blank-line
            # separator) so _cmpl_stream_event_out can rewrite the cmpl- id and
            # honor stream_options.include_usage per event, while keeping SSE
            # framing and token bytes intact.
            _include_usage = bool((body.get("stream_options") or {}).get("include_usage"))
            client = httpx.AsyncClient(
                timeout = _llama_streaming_generation_timeout(),
                trust_env = False,
            )
            resp = None
            bytes_iter = None
            disconnect_event = threading.Event()
            disconnect_watcher = None
            # This proxy relays straight from llama-server, so the swap gate has to see it: without an
            # entry a non-forced /unload counts zero generations and tears the server down mid-response.
            # Sharing disconnect_event lets a forced swap stop the relay through the check it already
            # polls. Entered inside the body generator, so a response whose body never starts leaves
            # nothing behind (see _responses_stream). No thread_id: public API surface, not a chat.
            _tracker = _TrackedCancel(disconnect_event, model = monitor_model, kind = "completions")
            _tracker.__enter__()
            # Must stay the last statement before the try that decrements it: a raise in
            # between leaks a permanent +1, and there is no reset hook.
            _direct_llama_request_started()
            try:
                req = client.build_request(
                    "POST", target_url, json = body, headers = {"Connection": "close"}
                )
                first_token_deadline = time.monotonic() + _DEFAULT_FIRST_TOKEN_TIMEOUT_S
                # Same event the relay loop polls, so a forced swap ends the request during prefill
                # instead of only once headers arrive.
                resp = await _send_stream_with_preheader_cancel(
                    client, req, disconnect_event, request = request
                )
                if resp is None:
                    api_monitor.finish(monitor_id, "cancelled")
                    return
                if resp.status_code != 200:
                    err_bytes = await resp.aread()
                    err_text = err_bytes.decode("utf-8", errors = "replace")
                    api_monitor.fail(monitor_id, err_text[:500])
                    raise RuntimeError(f"llama-server returned {resp.status_code}: {err_text}")
                disconnect_watcher = asyncio.create_task(
                    _await_disconnect_then_close(request, resp, disconnect_event)
                )
                bytes_iter = resp.aiter_bytes()
                buffer = b""
                async for chunk in _aiter_llama_stream_items(
                    bytes_iter,
                    cancel_event = disconnect_event,
                    request = request,
                    first_token_deadline = first_token_deadline,
                    response = resp,
                ):
                    buffer += chunk
                    while b"\n\n" in buffer:
                        event, buffer = buffer.split(b"\n\n", 1)
                        _monitor_openai_sse_event(
                            monitor_id,
                            event,
                            llama_backend.context_length,
                        )
                        out = _cmpl_stream_event_out(event, _include_usage)
                        if out is not None:
                            yield out + b"\n\n"
                if not disconnect_event.is_set() and buffer:
                    _monitor_openai_sse_event(
                        monitor_id,
                        buffer,
                        llama_backend.context_length,
                    )
                    out = _cmpl_stream_event_out(buffer, _include_usage)
                    if out is not None:
                        # Re-add the SSE separator the split consumed, so a final
                        # event arriving without a trailing blank line is still
                        # terminated for the client's parser.
                        yield out + b"\n\n"
                if disconnect_event.is_set():
                    api_monitor.finish(monitor_id, "cancelled")
                    return
                api_monitor.finish(monitor_id)
            except (httpx.RemoteProtocolError, httpx.ReadError, httpx.CloseError) as e:
                if not disconnect_event.is_set():
                    logger.error("openai_completions stream error: %s", e)
                    api_monitor.fail(monitor_id, _friendly_error(e))
                    error_chunk = _openai_stream_error_chunk(e)
                    yield _openai_stream_error_sse_bytes(error_chunk)
                    return
                api_monitor.finish(monitor_id, "cancelled")
                return
            except asyncio.CancelledError:
                disconnect_event.set()
                api_monitor.finish(monitor_id, "cancelled")
                raise
            except Exception as e:
                if disconnect_event.is_set():
                    api_monitor.finish(monitor_id, "cancelled")
                    return
                logger.error("openai_completions stream error: %s", e)
                api_monitor.fail(monitor_id, _friendly_error(e))
                error_chunk = _openai_stream_error_chunk(e)
                yield _openai_stream_error_sse_bytes(error_chunk)
                return
            finally:
                # Nested so a close-time failure still unregisters; a phantom entry 409s swaps.
                try:
                    await _aclose_stream_resources(
                        watchers = (disconnect_watcher,),
                        iterator = bytes_iter,
                        resp = resp,
                        client = client,
                    )
                finally:
                    _direct_llama_request_finished()
                    _tracker.__exit__(None, None, None)

        return _sse_streaming_response(_stream())
    else:
        # ``stream`` defaults to false, so this common shape registers with the swap gate like the
        # streaming branch: unregistered, a non-forced /unload counts zero generations and kills
        # llama-server mid-request, and force_cancel_active has no event. Unpooled client so a
        # cancel-close hits this call only.
        _cancel_event = threading.Event()
        _client = _cancelable_nonstreaming_client()
        _tracker = _TrackedCancel(_cancel_event, model = monitor_model, kind = "completions")
        _tracker.__enter__()
        _cancel_watcher = asyncio.create_task(
            _await_cancel_or_disconnect_then_close_client(
                cancel_event = _cancel_event,
                request = request,
                client = _client,
            )
        )
        _direct_llama_request_started()
        try:
            try:
                resp = await _client.post(
                    target_url,
                    json = body,
                    timeout = _llama_non_streaming_generation_timeout(),
                )
            except httpx.RequestError:
                # The watcher closed the client out from under the request: report the cancel, not a transport failure.
                if _cancel_event.is_set():
                    raise asyncio.CancelledError()
                raise
            if _cancel_event.is_set():
                raise asyncio.CancelledError()
        except asyncio.CancelledError:
            api_monitor.finish(monitor_id, "cancelled")
            raise
        except Exception as e:
            api_monitor.fail(monitor_id, _friendly_error(e))
            raise
        finally:
            # Nested so a close-time failure still unregisters; a phantom entry 409s swaps.
            try:
                await _stop_local_disconnect_cancel_watcher(_cancel_watcher)
                try:
                    await _client.aclose()
                except Exception:
                    pass
            finally:
                _direct_llama_request_finished()
                _tracker.__exit__(None, None, None)

        if resp.status_code != 200:
            api_monitor.fail(monitor_id, resp.text[:500])
            raise _openai_passthrough_error(resp.status_code, resp.text)
        try:
            _monitor_openai_chunk(monitor_id, resp.json(), llama_backend.context_length)
        except Exception:
            pass
        api_monitor.finish(monitor_id)

        return Response(
            content = _rewrite_cmpl_id(resp.content),
            status_code = resp.status_code,
            media_type = "application/json",
        )


# =====================================================================
# OpenAI-Compatible Embeddings Proxy  (/embeddings → /v1/embeddings)
# =====================================================================


def _embeddings_input_present(body: dict) -> bool:
    """Whether an embeddings body carries a usable ``input`` (non-empty)."""
    inp = body.get("input")
    if isinstance(inp, str):
        return inp != ""
    if isinstance(inp, (list, tuple)):
        return len(inp) > 0
    return inp is not None


@router.post("/embeddings")
async def openai_embeddings(request: Request, current_subject: str = Depends(get_current_subject)):
    """
    OpenAI-compatible embeddings endpoint.

    Proxies to the running llama-server's ``/v1/embeddings``. Only available
    when a GGUF model is loaded.
    Note: the loaded model must support pooling, else llama-server returns an
    error (expected).
    """
    llama_backend = get_llama_cpp_backend()
    # Reject a request with no input before any automatic load so an invalid
    # request never swaps or reloads the resident model (as chat/responses/messages
    # already validate before switching). Gate on every automatic-load trigger,
    # not just auto-switch, since a standalone idle TTL can also reload here.
    if _automatic_model_load_may_run():
        try:
            _pre = await request.json()
        except (json.JSONDecodeError, ValueError):
            _pre = None
        if isinstance(_pre, dict):
            _pre_input = _pre.get("input")
            if _pre_input is not None and not isinstance(_pre_input, (str, list, tuple)):
                # An object/number input is a deterministic client error (only a
                # string or array is valid); reject it before the switch so a bad
                # shape can't load a GGUF only to be rejected by llama-server after.
                raise HTTPException(status_code = 400, detail = "'input' must be a string or array.")
            if not _embeddings_input_present(_pre):
                raise HTTPException(status_code = 400, detail = "'input' is required for embeddings.")
    # Auto-switch applies here too; the target launches embedding-enabled only if it pools.
    body = await _auto_switch_from_request_body(request, current_subject)
    if not llama_backend.is_loaded:
        _status, _detail = await _no_model_loaded_error(
            "No GGUF model loaded. Load a GGUF model first.",
            _raw_body_model(body),
            request,
            status = 503,
        )
        raise HTTPException(status_code = _status, detail = _detail)
    if not isinstance(body, dict):
        # Re-read to re-raise a malformed-body error (post-503, pre-feature behavior);
        # a valid non-dict body such as a list is a clean 400 rather than a 500.
        body = await request.json()
        if not isinstance(body, dict):
            raise HTTPException(status_code = 400, detail = "Request body must be a JSON object")

    target_url = f"{llama_backend.base_url}/v1/embeddings"
    prompt_text = _flatten_monitor_prompt(body.get("input", ""))
    monitor_id = None
    if not getattr(request.state, "skip_api_monitor", False):
        monitor_id = api_monitor.start(
            endpoint = request.url.path,
            via_api_key = _request_used_api_key(request),
            method = request.method,
            model = str(body.get("model") or _llama_public_model_id(llama_backend) or "default"),
            prompt = prompt_text,
            context_length = llama_backend.context_length,
            subject = current_subject,
        )

    # Same gate registration as the completions proxy: unregistered, a non-forced /unload counts
    # zero generations and kills llama-server mid-embedding. Unpooled client so a cancel-close
    # hits this call only.
    _cancel_event = threading.Event()
    _client = _cancelable_nonstreaming_client()
    _tracker = _TrackedCancel(
        _cancel_event,
        model = str(body.get("model") or _llama_public_model_id(llama_backend) or "default"),
        kind = "embeddings",
    )
    _tracker.__enter__()
    _cancel_watcher = asyncio.create_task(
        _await_cancel_or_disconnect_then_close_client(
            cancel_event = _cancel_event,
            request = request,
            client = _client,
        )
    )
    _direct_llama_request_started()
    try:
        try:
            resp = await _client.post(
                target_url,
                json = body,
                timeout = _DEFAULT_FIRST_TOKEN_TIMEOUT_S,
            )
        except httpx.RequestError:
            # The watcher closed the client out from under the request: report the cancel, not a transport failure.
            if _cancel_event.is_set():
                raise asyncio.CancelledError()
            raise
        if _cancel_event.is_set():
            raise asyncio.CancelledError()
    except asyncio.CancelledError:
        api_monitor.finish(monitor_id, "cancelled")
        raise
    except Exception as exc:
        api_monitor.fail(monitor_id, _friendly_error(exc))
        raise
    finally:
        # Nested so a close-time failure still unregisters; a phantom entry 409s swaps.
        try:
            await _stop_local_disconnect_cancel_watcher(_cancel_watcher)
            try:
                await _client.aclose()
            except Exception:
                pass
        finally:
            _direct_llama_request_finished()
            _tracker.__exit__(None, None, None)
    if resp.status_code != 200:
        api_monitor.fail(monitor_id, resp.text[:500])
    else:
        try:
            _monitor_openai_chunk(monitor_id, resp.json(), _monitor_context_length())
        except Exception:
            pass
        api_monitor.finish(monitor_id)
    return Response(
        content = resp.content,
        status_code = resp.status_code,
        media_type = "application/json",
    )

