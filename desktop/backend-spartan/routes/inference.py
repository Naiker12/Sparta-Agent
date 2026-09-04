
"""
Inference API routes for model loading and text generation.
"""

import math
import os
import sys
import time
import uuid
from pathlib import Path
import hashlib as _hashlib
import hmac as _hmac
import secrets as _secrets
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    Request,
    UploadFile,
    status,
)
from fastapi.encoders import jsonable_encoder
from fastapi.responses import StreamingResponse, JSONResponse, PlainTextResponse, Response
from starlette.requests import ClientDisconnect
from typing import Any, Callable, Collection, List, NamedTuple, Optional, TYPE_CHECKING, Union
import json
import httpx
from loggers import get_logger
import asyncio
import contextvars
import threading
import weakref
from concurrent.futures import ThreadPoolExecutor
from contextlib import ExitStack, contextmanager
from dataclasses import fields as dataclass_fields, replace


import re as _re
from urllib.parse import quote as _urlquote

# Model size extraction (shared with core/inference/llama_cpp.py)
from utils.models import extract_model_size_b as _extract_model_size_b

from utils.api_errors import openai_error_body, anthropic_error_body, error_body_for_path
from utils.upload_limits import STT_AUDIO_B64_MAX_CHARS, STT_AUDIO_RAW_MAX_BYTES
from hub.dependencies import get_hf_token
from core.inference.audio_errors import (
    AudioBackendUnsupportedError,
    AudioGenerationCancelledError,
)
from core.inference.orchestrator import (
    AUDIO_GENERATION_MAX_TOKENS,
    GenStreamError,
    GenStreamErrorRaised,
)
from core.inference.llama_admission import (
    LlamaAdmissionCancelled,
    LlamaAdmissionConfig,
    LlamaAdmissionLease,
    LlamaAdmissionQueueFull,
    LlamaAdmissionReservation,
    LlamaAdmissionTimeout,
    get_llama_admission_queue,
    llama_admission_config_from_env,
    peek_llama_admission_snapshot,
)
from core.inference.tool_stream_exec import TOOL_APPROVAL_FLUSH_DELAY_S


def _positive_int_or_none(value: Any) -> Optional[int]:
    if isinstance(value, bool):
        return None
    try:
        value_int = int(value)
    except (TypeError, ValueError):
        return None
    return value_int if value_int > 0 else None


def _nonnegative_int_or_none(value: Any) -> Optional[int]:
    if isinstance(value, bool):
        return None
    try:
        value_int = int(value)
    except (TypeError, ValueError):
        return None
    return value_int if value_int >= 0 else None


_MLX_MPI_DISTRIBUTED_ENV_PAIRS = (
    ("OMPI_COMM_WORLD_RANK", "OMPI_COMM_WORLD_SIZE"),
    ("PMI_RANK", "PMI_SIZE"),
    ("PMIX_RANK", "PMIX_SIZE"),
    ("MPI_RANK", "MPI_WORLD_SIZE"),
    ("MV2_COMM_WORLD_RANK", "MV2_COMM_WORLD_SIZE"),
)


def _mlx_distributed_launch_detected() -> bool:
    if _nonnegative_int_or_none(os.environ.get("MLX_RANK")) is not None:
        world_size = _positive_int_or_none(os.environ.get("MLX_WORLD_SIZE"))
        if world_size is not None and world_size > 1:
            return True
        return bool(
            os.environ.get("MLX_HOSTFILE")
            or os.environ.get("MLX_IBV_DEVICES")
            or os.environ.get("MLX_JACCL_COORDINATOR")
            or (os.environ.get("NCCL_HOST_IP") and os.environ.get("NCCL_PORT"))
        )
    return any(
        _nonnegative_int_or_none(os.environ.get(rank_env)) is not None
        and (_positive_int_or_none(os.environ.get(size_env)) or 0) > 1
        for rank_env, size_env in _MLX_MPI_DISTRIBUTED_ENV_PAIRS
    )


def _install_httpcore_asyncgen_silencer() -> None:
    """Silence benign httpx/httpcore asyncgen GC noise on Python 3.13.

    When Unsloth proxies a llama-server stream via httpx, the innermost
    ``HTTP11ConnectionByteStream.__aiter__`` async generator is finalised by
    the asyncgen GC hook on a task different from the one that opened it. Its
    ``aclose`` calls ``anyio.Lock.acquire`` → ``cancel_shielded_checkpoint``,
    entering a ``CancelScope`` on the finaliser task; Python 3.13 flags the
    cross-task exit as ``"Attempted to exit cancel scope in a different task"``
    and prints ``"async generator ignored GeneratorExit"`` as an unraisable
    warning.

    Known httpx + httpcore + anyio interaction (MCP SDK python-sdk#831, agno
    #3556, chainlit #2361, langchain-mcp-adapters #254). Benign: the 200
    response is already delivered. The streaming pass-throughs
    (``/v1/chat/completions``, ``/v1/messages``, ``/v1/responses``,
    ``/v1/completions``) manage their httpx lifecycle in one task with explicit
    ``aclose()``; we don't hold a reference to the errant generator and can't
    close it ourselves.

    Install one process-wide unraisable hook that swallows only this
    interaction -- identified by (RuntimeError mentioning cancel scope /
    GeneratorExit) + (object repr referencing HTTP11ConnectionByteStream) --
    and defers to the default hook otherwise. Idempotent.
    """
    prior_hook = sys.unraisablehook
    if getattr(prior_hook, "_unsloth_httpcore_silencer", False):
        return

    def _hook(unraisable):
        exc_value = getattr(unraisable, "exc_value", None)
        obj = getattr(unraisable, "object", None)
        obj_repr = repr(obj) if obj is not None else ""
        if (
            isinstance(exc_value, RuntimeError)
            and "HTTP11ConnectionByteStream" in obj_repr
            and (
                "cancel scope" in str(exc_value)
                or "GeneratorExit" in str(exc_value)
                or "no running event loop" in str(exc_value)
            )
        ):
            return
        prior_hook(unraisable)

    _hook._unsloth_httpcore_silencer = True  # type: ignore[attr-defined]
    sys.unraisablehook = _hook


_install_httpcore_asyncgen_silencer()


# Status polls can start a cold subprocess probe or wait on a release lookup.  Keep
# that bounded work out of the default executor, which drives local token streaming.
_STATUS_PROBE_EXECUTOR = ThreadPoolExecutor(max_workers = 2, thread_name_prefix = "inference-status")

# Stop has to preempt exactly when the box is busy, so it gets its own workers for the same reason
# the probes above do. Every /images/generate sits in the default executor for the whole run (it
# blocks on the backend's serial _generate_lock), so concurrent generations can occupy that pool
# and leave a cancel queued until the run it was meant to stop has already finished. Off the
# default executor rather than on the event loop: cancelling a native sd.cpp run kills a process
# tree, which is not a short call.
_CANCEL_EXECUTOR = ThreadPoolExecutor(max_workers = 2, thread_name_prefix = "inference-cancel")


def _loaded_chat_template() -> Optional[str]:
    """Chat template of the currently loaded GGUF model, if any."""
    try:
        return get_llama_cpp_backend().chat_template
    except Exception:
        return None


def _template_raise_message(error_text: str, chat_template: Optional[str]) -> Optional[str]:
    """A chat-template raise_exception message to surface, but only when it appears
    verbatim in chat_template (simple substring check), so we never leak arbitrary
    llama-server text. Anchors on llama.cpp's "Jinja Exception:" prefix."""
    if not chat_template:
        return None
    marker = "Jinja Exception:"
    idx = error_text.find(marker)
    if idx == -1:
        return None
    candidate = error_text[idx + len(marker) :]
    # llama-server appends JSON after the message; cut at the first boundary.
    for stop in ('"', "\n"):
        cut = candidate.find(stop)
        if cut != -1:
            candidate = candidate[:cut]
    candidate = candidate.strip()
    return candidate if candidate and candidate in chat_template else None


_LOST_CONNECTION_MSG = (
    "Lost connection to the model server. It may have crashed -- try reloading the model."
)


def _friendly_error(exc: Exception) -> str:
    """Extract a user-friendly message from known llama-server errors."""
    if isinstance(exc, httpx.ReadTimeout):
        if "stopped producing tokens" in str(exc).lower():
            return (
                "The model stopped producing tokens before the response "
                "completed. Try stopping and retrying, or reduce max tokens."
            )
        return (
            "The model is still processing the prompt but did not produce a "
            "first token within 20 minutes. Try reducing context length, "
            "using more GPU offload, or loading a smaller model."
        )
    if isinstance(exc, httpx.TimeoutException):
        return "Timed out communicating with the model server. Try again shortly."
    # httpx transport failures from the async pass-through helpers. Any
    # RequestError subclass (ConnectError, ReadError, RemoteProtocolError,
    # WriteError, PoolTimeout, ...) means the llama-server subprocess is
    # unreachable -- crashed or still coming up.
    if isinstance(exc, httpx.RequestError):
        return _LOST_CONNECTION_MSG
    msg = str(exc)
    m = _re.search(
        r"request \((\d+) tokens?\) exceeds the available context size \((\d+) tokens?\)",
        msg,
    )
    if m:
        return (
            f"Message too long: {m.group(1)} tokens exceeds the {m.group(2)}-token "
            f"context window. Try increasing the Context Length in Model settings, "
            f"or shorten the conversation."
        )
    if "Lost connection to llama-server" in msg:
        return _LOST_CONNECTION_MSG
    template_msg = _template_raise_message(msg, _loaded_chat_template())
    if template_msg:
        return f"An internal error occurred: {template_msg}"
    return "An internal error occurred"


def _friendly_gen_stream_error(value) -> str:
    """Return a client-safe message for typed local generation errors."""
    text = str(value)
    if getattr(value, "public", False):
        return text
    return safe_error_detail(RuntimeError(text), fallback = "An internal error occurred.")


def _friendly_upstream_error(text: str) -> str:
    """Rewrite a raw llama-server error body into an actionable message where we can.

    The main case is a tool-calling grammar that llama-server can't compile ("failed to
    parse grammar" / "failed to initialize samplers"). This surfaces to coding agents as
    a hard 400 on every tool-bearing turn. It is a llama-server limitation with some
    model/quant + tool-schema combinations, and recent llama.cpp builds handle the common
    coding-agent tools, so point the user at updating Unsloth rather than the raw body.
    """
    lowered = text.lower()
    if "failed to parse grammar" in lowered or "failed to initialize samplers" in lowered:
        return (
            "The model couldn't compile a tool-calling grammar for this request. This is a "
            "llama-server limitation with some model/quant and tool-schema combinations. "
            "Update Unsloth (it installs the latest llama.cpp, which handles the common "
            "coding-agent tools) or try a different GGUF model."
        )
    return f"llama-server error: {text}"


def _clamp_finish_reason(value) -> str:
    """Coerce an upstream finish_reason into OpenAI's known chat values.

    Unknown values (including ``None``) become ``"stop"`` so local upstream
    quirks do not leak into the public API shape.
    """
    return (
        value
        if value
        in (
            "stop",
            "length",
            "tool_calls",
            "content_filter",
            "function_call",
        )
        else "stop"
    )


def _continue_final_message(payload) -> bool:
    """Whether this request resumes the trailing assistant turn.

    Nothing resumable (no assistant turn, or one holding tool calls) degrades to an
    ordinary new turn rather than erroring.
    """
    if not getattr(payload, "continue_final_message", None):
        return False
    messages = getattr(payload, "messages", None) or []
    if not messages:
        return False
    last = messages[-1]
    role = last.get("role") if isinstance(last, dict) else getattr(last, "role", None)
    if role != "assistant":
        return False
    tool_calls = (
        last.get("tool_calls") if isinstance(last, dict) else getattr(last, "tool_calls", None)
    )
    if tool_calls:
        return False
    content = last.get("content") if isinstance(last, dict) else getattr(last, "content", None)
    if isinstance(content, str):
        return bool(content)
    if isinstance(content, list):
        # No resume point inside an image or tool-result part.
        texts = []
        for part in content:
            part_type = part.get("type") if isinstance(part, dict) else getattr(part, "type", None)
            if part_type != "text":
                return False
            texts.append(
                part.get("text") if isinstance(part, dict) else getattr(part, "text", None)
            )
        return any(texts)
    return False


def _reject_audio_output_continuation(payload) -> None:
    """Audio output re-speaks the newest user text, so there is no partial to resume
    from; refuse rather than return a fresh clip labelled as a continuation."""
    if _continue_final_message(payload):
        raise HTTPException(
            status_code = 400,
            detail = "continue_final_message is not supported with audio output.",
        )


def _normalize_stop_sequences(raw):
    """Coerce an OpenAI/Anthropic ``stop`` value into the list-of-non-empty-strings
    shape llama-server expects, or ``None`` when absent. A bare string becomes a
    single-element list; empty strings are dropped (an empty stop sequence would
    terminate generation immediately at position 0)."""
    if isinstance(raw, str):
        return [raw] if raw else None
    if isinstance(raw, list):
        return [s for s in raw if isinstance(s, str) and s] or None
    return None


def _effective_max_tokens(payload):
    """Resolve the generation cap, preferring OpenAI's replacement field.

    ``max_tokens`` is deprecated in favor of ``max_completion_tokens``; honor
    either for compatibility, but let the replacement field win when both are
    supplied.
    """
    return (
        payload.max_completion_tokens
        if payload.max_completion_tokens is not None
        else payload.max_tokens
    )


# Below this there is no room for speech worth returning, so an over-context prompt is a
# client error rather than a one-token generation.
_MIN_SPEECH_OUTPUT_TOKENS = 64

# The backends do not generate from the raw text: each wraps it in codec delimiters
# (llama_cpp.py:_TTS_PROMPTS, and the model-specific prompts the Transformers generators
# build), so the real prompt is longer than what the estimate below sees. Budgeting the
# whole remainder left zero headroom and those few tokens pushed prompt + max_new_tokens
# back over the context. Generous rather than exact, since the wrapper is chosen deeper
# than this and 32 tokens off a 2048 context is not worth threading it up here.
_TTS_PROMPT_FORMAT_RESERVE = 32


def _tts_max_new_tokens(payload, prompt: Optional[str] = None) -> int:
    """Bound TTS work consistently across llama.cpp and subprocess backends.

    ``prompt`` shares the loaded context with the output, so a Max tokens slider near the
    ceiling plus a long prompt overflowed the context the page loaded with. Capped here so
    both the Studio and OpenAI routes inherit it.
    """
    budget = min(
        AUDIO_GENERATION_MAX_TOKENS,
        max(1, int(_effective_max_tokens(payload) or 2048)),
    )
    if prompt:
        context_length = _monitor_context_length()
        if context_length:
            budget = min(
                budget,
                context_length - _prompt_token_estimate(prompt) - _TTS_PROMPT_FORMAT_RESERVE,
            )
    # A caller that reached generation with no budget left gets one token and a useless
    # clip; the routes reject that case up front instead.
    return max(1, budget)


def _raise_if_prompt_leaves_no_speech_budget(text: str) -> None:
    """400 when the prompt alone consumes the loaded context.

    Shared by both TTS routes: the budget helper floors at one token so generation always
    has something to ask for, which on its own would send an over-context prompt into the
    backend to fail there or return a clip too short to hold codec tokens.
    """
    context_length = _monitor_context_length()
    if not context_length:
        return
    remaining = context_length - _prompt_token_estimate(text) - _TTS_PROMPT_FORMAT_RESERVE
    if remaining < _MIN_SPEECH_OUTPUT_TOKENS:
        raise HTTPException(
            status_code = 400,
            detail = (
                f"Input is too long for the loaded model's {context_length}-token context. "
                "Shorten it, or load the model with a larger context."
            ),
        )


def _prompt_token_estimate(prompt: str) -> int:
    """Tokens the prompt will occupy, from the loaded tokenizer where one is reachable.

    The len//3 fallback under-counts CJK and emoji badly, which is exactly the input that
    then overflows the context, so ask the tokenizer first and only guess when it is absent.
    """
    try:
        backend = _peek_inference_backend()
        if backend is not None and backend.active_model_name:
            models = getattr(backend, "models", {}) or {}
            info = models.get(backend.active_model_name, {}) if isinstance(models, dict) else {}
            tokenizer = info.get("tokenizer") if isinstance(info, dict) else None
            if tokenizer is not None and hasattr(tokenizer, "encode"):
                count = len(tokenizer.encode(prompt))
                if count > 0:
                    return count
    except Exception:  # noqa: BLE001 - an estimate must never fail the request
        pass
    # llama-server holds its own tokenizer, so estimate by character class instead of a
    # flat ratio. Everything outside ASCII counts as a token: the earlier cut at U+2E7F
    # only caught CJK and emoji, so Arabic, Cyrillic, Hebrew and the Indic scripts were
    # billed at the Latin third-of-a-token rate and a long prompt in any of them passed
    # the guard, then overflowed the context during generation. Over-counting accented
    # Latin is the safe direction for a budget: it shortens the clip rather than failing.
    dense = sum(1 for ch in prompt if ord(ch) > 0x7F)
    return max(1, dense + (len(prompt) - dense) // 3)


_OPENAI_COMPAT_STREAM_STALL_TIMEOUT_ENV = "UNSLOTH_OPENAI_COMPAT_STREAM_STALL_TIMEOUT"


def _positive_float_env(env_name: str, default):
    """Parse a positive float from an env var. A parseable non-positive value
    returns ``None`` (0 disables the guarded feature); only unparseable or unset
    values fall back to ``default``."""
    raw_value = os.environ.get(env_name)
    if raw_value is None or not raw_value.strip():
        return default
    try:
        value = float(raw_value.strip())
    except ValueError:
        return default
    return value if value > 0 else None


def _effective_openai_max_tokens_from_values(max_tokens, max_completion_tokens = None):
    """Resolve the OpenAI-compatible generation cap from raw request values.

    Prefers ``max_completion_tokens`` over the deprecated ``max_tokens``, and
    returns ``None`` when both are omitted so callers keep their context-window
    default (OpenAI treats an omitted cap as bounded only by the context
    window). Explicit client caps pass through unchanged.
    """

    def _validate_explicit(value, param: str):
        if value is None:
            return None
        if isinstance(value, bool) or not isinstance(value, int):
            raise HTTPException(
                status_code = 400,
                detail = openai_error_body(
                    f"'{param}' must be an integer.",
                    status = 400,
                    code = "invalid_type",
                    param = param,
                ),
            )
        # The legacy completions spec declares ``minimum: 0`` for max_tokens,
        # so 0 is a valid (if degenerate) cap and only negatives are rejected.
        # The chat fields never reach here with 0 (pydantic enforces ge=1).
        if value < 0:
            raise HTTPException(
                status_code = 400,
                detail = openai_error_body(
                    f"'{param}' must be at least 0.",
                    status = 400,
                    code = "invalid_value",
                    param = param,
                ),
            )
        return value

    max_tokens = _validate_explicit(max_tokens, "max_tokens")
    max_completion_tokens = _validate_explicit(max_completion_tokens, "max_completion_tokens")
    return max_completion_tokens if max_completion_tokens is not None else max_tokens


def _effective_openai_max_tokens(payload):
    return _effective_openai_max_tokens_from_values(
        getattr(payload, "max_tokens", None),
        getattr(payload, "max_completion_tokens", None),
    )


def _wants_multiple_choices(payload) -> bool:
    return (payload.n or 1) > 1


def _has_openai_tool_history(messages) -> bool:
    for message in messages or []:
        if isinstance(message, dict):
            if message.get("role") == "tool" or message.get("tool_calls"):
                return True
            continue
        if getattr(message, "role", None) == "tool" or getattr(message, "tool_calls", None):
            return True
    return False


def _raise_unsupported_openai_parameter(param: str, message: str) -> None:
    raise HTTPException(
        status_code = 400,
        detail = openai_error_body(
            message,
            status = 400,
            code = "unsupported_parameter",
            param = param,
        ),
    )


def _raise_unsupported_n(path_label: str) -> None:
    _raise_unsupported_openai_parameter("n", f"n > 1 is not supported for {path_label}.")


def _sse_streaming_response(content, *, unstarted_cleanup = None) -> StreamingResponse:
    """A ``text/event-stream`` response with the standard SSE headers used by
    every streaming path here: no client/proxy caching, no proxy buffering, and
    a one-shot connection. Two callers build their response inline instead: the
    external-provider proxy omits ``Connection: close``, and the OpenAI
    passthrough returns an empty ``keep-alive`` stream when the request is
    cancelled before the upstream response starts.

    Built on ``_SameTaskStreamingResponse`` (not Starlette's stock
    ``StreamingResponse``) so the SSE generator runs in the request task. The
    legacy AnyIO task-group wrapper trips "Attempted to exit a cancel scope in a
    different task" on Python 3.13 + httpx, which surfaced as a mid-stream
    ``response.failed``. The streaming paths that take their response inline use
    ``_SameTaskStreamingResponse`` directly for the same reason."""
    return _SameTaskStreamingResponse(
        content,
        media_type = "text/event-stream",
        headers = {
            "Cache-Control": "no-cache",
            "Connection": "close",
            "X-Accel-Buffering": "no",
        },
        unstarted_cleanup = unstarted_cleanup,
    )


def _openai_stream_error_chunk(exc) -> dict:
    """Build an in-band OpenAI error chunk for a mid-stream failure. Once the
    stream's 200 headers are flushed the status can't change, so the error must
    ride in the SSE body. An upstream context-window overflow is mapped to
    code=context_length_exceeded so client compaction/trim loops can detect it
    (a code-less error hides it)."""
    _cls = _classify_llama_generation_error(exc)
    if _cls:
        return openai_error_body(
            _friendly_error(exc),
            status = 400,
            code = "context_length_exceeded",
        )
    if _cls is False:
        return openai_error_body(_friendly_error(exc), status = 400)
    return openai_error_body(_friendly_error(exc), status = 500)


def _openai_stream_error_sse(error: dict) -> str:
    return f"data: {json.dumps(error)}\n\ndata: [DONE]\n\n"


def _openai_stream_error_sse_bytes(error: dict) -> bytes:
    return _openai_stream_error_sse(error).encode("utf-8")


def _openai_passthrough_error(status_code, text) -> "HTTPException":
    """HTTPException for a non-200 upstream response on the OpenAI passthrough
    (tools / response_format). An over-context upstream error is mapped to a 400
    with code="context_length_exceeded" so these paths deliver the same signal as
    the non-passthrough path; a tool-grammar compile failure gets the same actionable
    guidance as the Anthropic passthrough; any other upstream error stays verbatim."""
    if _classify_llama_generation_error(Exception(text)):
        return HTTPException(
            status_code = 400,
            detail = openai_error_body(
                _friendly_error(Exception(text)),
                status = 400,
                code = "context_length_exceeded",
                param = "messages",
            ),
        )
    return HTTPException(
        status_code = status_code,
        detail = _friendly_upstream_error(text[:500]),
    )


_OVERFLOW_TRUNCATE_MAX_RETRIES = 3
# Truncated-prompt share of the real window; the rest is generation headroom
# so a near-full prompt cannot cut a tool call mid-JSON at the wall.
_OVERFLOW_PROMPT_TARGET_FRACTION = 0.75


def _overflow_truncation_requested(payload) -> bool:
    """True when the request (or the UNSLOTH_CONTEXT_OVERFLOW server default,
    for clients that cannot send custom fields) opted into truncation."""
    requested = getattr(payload, "context_overflow", None)
    if requested is not None:
        return requested == "truncate_middle"
    return os.environ.get("UNSLOTH_CONTEXT_OVERFLOW", "").strip().lower() == "truncate_middle"


def _parse_overflow_counts(err_text: str):
    """(n_prompt_tokens, n_ctx) from an exceed_context_size_error body, or
    None. Tolerates \\" around keys (body may be a re-wrapped JSON string)."""
    m_prompt = _re.search(r'n_prompt_tokens\\?"?\s*:\s*(\d+)', err_text)
    m_ctx = _re.search(r'n_ctx\\?"?\s*:\s*(\d+)', err_text)
    if m_prompt and m_ctx:
        return int(m_prompt.group(1)), int(m_ctx.group(1))
    return None


def _estimate_message_tokens(msg: dict) -> int:
    try:
        return max(1, len(json.dumps(msg, ensure_ascii = False)) // 4)
    except Exception:
        return 1


def _estimate_messages_tokens(messages: list) -> int:
    """Conservatively estimate a complete message list.

    Templates disagree about when historical ``reasoning_content`` renders,
    and arbitrary GGUFs can carry custom templates. Counting the serialized
    field avoids a retry that still exceeds context. The overflow recovery path
    clips large reasoning traces before it evicts conversation turns.
    """
    return sum(_estimate_message_tokens(msg) for msg in messages)


def _truncate_middle_messages(messages: list, keep_ratio: float):
    """Drop whole turn-groups from the middle of an OpenAI message list.

    Always kept: leading system message(s), the first group (task anchor),
    and the trailing groups. A group is a user message, or an assistant
    message plus its following tool results, so surviving tool_calls stay
    paired with their results as chat templates require.
    Returns (new_messages, dropped_message_count).
    """
    if not messages or keep_ratio >= 1.0:
        return messages, 0

    head: list = []
    idx = 0
    while idx < len(messages) and messages[idx].get("role") in ("system", "developer"):
        head.append(messages[idx])
        idx += 1

    groups: list[list] = []
    for msg in messages[idx:]:
        role = msg.get("role")
        if role == "tool" and groups:
            groups[-1].append(msg)
        elif role == "tool":
            groups.append([msg])  # orphan tool result; treat as its own group
        else:
            groups.append([msg])

    # Anchor group plus the last 3 groups stay.
    protected_tail = min(3, max(1, len(groups) - 1))
    if len(groups) <= 1 + protected_tail:
        return messages, 0

    estimates = {id(msg): _estimate_message_tokens(msg) for msg in messages}
    total_est = sum(estimates[id(msg)] for msg in messages)
    target_est = int(total_est * keep_ratio)

    anchor = groups[0]
    middle = groups[1:-protected_tail]
    tail = groups[-protected_tail:]

    current_est = total_est
    dropped = 0
    # Drop oldest-first until the estimate fits the target. A cursor over ``middle``, not
    # ``pop(0)`` on a copy: popping the front of a list shifts every remaining element.
    first_kept = 0
    while first_kept < len(middle) and current_est > target_est:
        victim = middle[first_kept]
        first_kept += 1
        dropped += len(victim)
        current_est -= sum(estimates[id(msg)] for msg in victim)

    if dropped == 0:
        return messages, 0

    new_messages = head + anchor
    for grp in middle[first_kept:]:
        new_messages.extend(grp)
    for grp in tail:
        new_messages.extend(grp)
    return new_messages, dropped


_CLIP_MARKER = "\n[... truncated by context_overflow=truncate_middle ...]\n"
# Generous head+tail first; cut harder if the estimate still misses the target.
_CLIP_KEEP_CHARS = (1500, 400)


def _clip_reasoning_contents(messages: list, keep: int = _CLIP_KEEP_CHARS[-1]) -> int:
    """Clip oversized assistant reasoning before sizing an overflow retry.

    Reasoning can live in the protected anchor or tail where group eviction
    cannot reach it. It is also the least useful history to preserve after the
    server has already reported an overflow, so shrink it before dropping whole
    conversation turns.
    """
    clipped = 0
    for msg in messages:
        if msg.get("role") != "assistant":
            continue
        reasoning = msg.get("reasoning_content")
        if not isinstance(reasoning, str) or len(reasoning) <= 2 * keep + len(_CLIP_MARKER):
            continue
        msg["reasoning_content"] = reasoning[:keep] + _CLIP_MARKER + reasoning[-keep:]
        clipped += 1
    return clipped


def _clip_long_contents(messages: list, target_est: int) -> int:
    """Clip oversized string contents middle-out until ``target_est`` is met.

    Tool results first, then earlier user turns, the final message last.
    Message count and roles never change, so tool pairing holds even when
    group-dropping could not free enough. Returns messages clipped.
    """

    def _candidates():
        tools = [m for m in messages if m.get("role") == "tool"]
        users = [m for m in messages[:-1] if m.get("role") == "user"]
        last = [messages[-1]] if messages else []
        return tools + users + last

    clipped = 0
    for keep in _CLIP_KEEP_CHARS:
        for msg in _candidates():
            if _estimate_messages_tokens(messages) <= target_est:
                return clipped
            content = msg.get("content")
            if not isinstance(content, str) or len(content) <= 2 * keep + len(_CLIP_MARKER):
                continue
            msg["content"] = content[:keep] + _CLIP_MARKER + content[-keep:]
            clipped += 1
    return clipped


def _apply_overflow_truncation(body: dict, err_text: str) -> bool:
    """Shrink a passthrough body after an upstream context overflow: drop
    middle turn-groups, clip still-oversized contents, clamp ``max_tokens``
    to the generation headroom. Returns False when nothing could shrink."""
    counts = _parse_overflow_counts(err_text)
    messages = body.get("messages") or []
    pre_clip_est = _estimate_messages_tokens(messages)
    clipped = _clip_reasoning_contents(messages)
    total_est = _estimate_messages_tokens(messages)
    if counts:
        n_prompt, n_ctx = counts
        prompt_target = _OVERFLOW_PROMPT_TARGET_FRACTION * n_ctx
        if clipped:
            # The server counted the body before the retry-only clip. Rescale
            # using this estimator's pre/post ratio so the removed trace is not
            # charged again by middle eviction.
            n_prompt = n_prompt * total_est / max(1, pre_clip_est)
        if clipped and n_prompt <= prompt_target:
            keep_ratio = 1.0
        else:
            keep_ratio = min(0.95, prompt_target / max(1.0, n_prompt))
    else:
        n_ctx = None
        keep_ratio = 0.6  # no counts in the error; cut conservatively
    # Scale the server-token target into char-estimate units.
    target_est = int(total_est * keep_ratio)

    new_messages, dropped = _truncate_middle_messages(messages, keep_ratio)
    if dropped:
        body["messages"] = new_messages
    if _estimate_messages_tokens(body.get("messages") or []) > target_est:
        clipped += _clip_long_contents(body.get("messages") or [], target_est)
    if not dropped and not clipped:
        return False
    if n_ctx:
        headroom = max(1024, int(n_ctx * (1.0 - _OVERFLOW_PROMPT_TARGET_FRACTION)))
        cur_max = body.get("max_tokens")
        body["max_tokens"] = min(cur_max, headroom) if cur_max else headroom
    logger.warning(
        "context_overflow=truncate_middle: dropped %d middle messages, clipped "
        "%d contents (keep_ratio %.2f); retrying within the real window",
        dropped,
        clipped,
        keep_ratio,
    )
    return True


def _anthropic_stream_error_event(exc, *, force: bool = False):
    """Return an Anthropic in-band stream error event when one is useful."""
    _cls = _classify_llama_generation_error(exc)
    if _cls is None and not force:
        return None
    status = 400 if _cls is not None else 500
    return build_anthropic_sse_event(
        "error",
        anthropic_error_body(_friendly_error(exc), status = status),
    )


def _drop_parallel_tool_call_deltas(chunk) -> bool:
    """In-place: drop tool_call deltas whose index >= 1 from a parsed OpenAI
    streaming chunk so only the first tool call survives (parallel_tool_calls=false
    / disable_parallel_tool_use, best-effort). Returns True if anything changed."""
    if not isinstance(chunk, dict):
        return False
    changed = False
    for ch in chunk.get("choices") or []:
        delta = ch.get("delta") or {}
        tcs = delta.get("tool_calls")
        if isinstance(tcs, list):
            kept = [tc for tc in tcs if isinstance(tc, dict) and (tc.get("index") or 0) == 0]
            if len(kept) != len(tcs):
                delta["tool_calls"] = kept
                changed = True
    return changed


def _add_empty_content_to_reasoning_deltas(chunk: dict) -> bool:
    """Make reasoning-only deltas palatable to strict OpenAI adapters.

    Some clients built on OpenAI-compatible streams ignore or reject chunks whose
    delta only contains non-standard ``reasoning_content``. Preserve that field,
    but add an empty standard ``content`` member so the chunk is still a valid
    text-delta shape and downstream parsers keep the stream alive.
    """
    changed = False
    choices = chunk.get("choices")
    if not isinstance(choices, list):
        return False
    for choice in choices:
        if not isinstance(choice, dict):
            continue
        delta = choice.get("delta")
        if not isinstance(delta, dict):
            continue
        if "reasoning_content" in delta and "content" not in delta:
            delta["content"] = ""
            changed = True
    return changed


def _normalize_openai_passthrough_sse_line(
    raw_line: str, *, cap_parallel_tool_calls: bool = False
) -> str:
    """Normalize one passthrough OpenAI SSE ``data:`` line before relaying.

    The function is intentionally narrow: it leaves comments, blank events,
    ``[DONE]``, and unparseable upstream bytes untouched; parsed chunks are
    re-serialized only when a compatibility mutation is actually required.
    """
    if not raw_line.startswith("data:"):
        return raw_line
    # Both mutations key off JSON object keys, so a line without either quoted
    # key can never change; skip the parse on the per-token common case.
    if '"reasoning_content"' not in raw_line and not (
        cap_parallel_tool_calls and '"tool_calls"' in raw_line
    ):
        return raw_line
    payload = raw_line[len("data:") :].lstrip()
    if payload.strip() in ("", "[DONE]"):
        return raw_line
    try:
        obj = json.loads(payload)
    except Exception:
        return raw_line
    if not isinstance(obj, dict):
        return raw_line
    changed = _add_empty_content_to_reasoning_deltas(obj)
    if cap_parallel_tool_calls and _drop_parallel_tool_call_deltas(obj):
        changed = True
    if not changed:
        return raw_line
    return "data: " + json.dumps(obj, separators = (",", ":"), ensure_ascii = False)


def _prompt_tokens_details(upstream):
    """Surface llama-server's real ``cached_tokens`` (KV-cache prompt hits) while
    keeping the full OpenAI ``prompt_tokens_details`` shape. Defaults to zero when
    the upstream usage doesn't carry it, so the field is always present."""
    out = {"cached_tokens": 0, "audio_tokens": 0}
    if isinstance(upstream, dict):
        out.update({k: v for k, v in upstream.items() if v is not None})
    return out


def _wants_stream_usage(payload) -> bool:
    return bool((payload.stream_options or {}).get("include_usage"))


def _is_openai_usage_only_sse(line: str) -> bool:
    """Whether *line* is a standalone ``choices: []`` usage chunk.

    Only that shape: a content chunk carrying inline usage still has to reach the client.
    """
    if not isinstance(line, str) or not line.startswith("data:"):
        return False
    # This runs on every relayed line, so keep the parse off the common path: a usage
    # chunk always spells the key literally, and content deltas carry no usage at all.
    if '"usage"' not in line:
        return False
    body = line[len("data:") :].strip()
    if not body or body == "[DONE]":
        return False
    try:
        obj = json.loads(body)
    except Exception:
        return False
    return (
        isinstance(obj, dict)
        and obj.get("usage") is not None
        and isinstance(obj.get("choices"), list)
        and not obj["choices"]
    )


_OPENAI_PASSTHROUGH_TERMINAL_GRACE_S = 2.0
_SSE_DONE_LINE = "data: [DONE]"
_SSE_DONE_CHUNK = "data: [DONE]\n\n"


def _openai_passthrough_sse_line_terminal_state(raw_line: str) -> Optional[str]:
    """Classify OpenAI-compatible chat stream terminal markers.

    Some llama-server builds can emit the logical final chunk (``finish_reason``)
    and optional usage chunk, then keep the HTTP stream open without sending the
    OpenAI ``data: [DONE]`` sentinel. Classifying those chunks lets Unsloth close
    the client stream promptly while preserving an optional trailing usage chunk.
    """
    if not raw_line.startswith("data:"):
        return None
    data_str = raw_line[5:].lstrip()
    if data_str == "[DONE]":
        return "done"
    try:
        data = json.loads(data_str)
    except json.JSONDecodeError:
        return None
    return _openai_passthrough_terminal_state_from_data(data)


def _openai_passthrough_terminal_state_from_data(data) -> Optional[str]:
    """Dict-level core of ``_openai_passthrough_sse_line_terminal_state`` for
    callers that already parsed the chunk (avoids a re-parse per relayed line)."""
    if not isinstance(data, dict):
        return None
    if _monitor_openai_error_message(data):
        return "error"
    choices = data.get("choices")
    if isinstance(choices, list):
        if not choices and isinstance(data.get("usage"), dict):
            return "usage"
        for choice in choices:
            if isinstance(choice, dict) and choice.get("finish_reason") is not None:
                return "finish"
    elif isinstance(data.get("usage"), dict):
        return "usage"
    return None


def _openai_stream_usage_chunk(
    payload, completion_id, created, model_name, stream_usage, stream_timings
):
    """Build the final OpenAI-standard usage chunk (choices=[], usage populated)
    for a chat stream. Returns the SSE ``data:`` line, or None when the client
    did not opt in via ``stream_options.include_usage`` (or no usage exists)."""
    if not _wants_stream_usage(payload):
        return None
    if not (stream_usage or stream_timings):
        return None
    _usage = stream_usage or {}
    _prompt_tokens = _usage.get("prompt_tokens") or 0
    _completion_tokens = _usage.get("completion_tokens") or 0
    _total_tokens = _usage.get("total_tokens") or (_prompt_tokens + _completion_tokens)
    usage_chunk = ChatCompletionChunk(
        id = completion_id,
        created = created,
        model = model_name,
        choices = [],
        usage = CompletionUsage(
            prompt_tokens = _prompt_tokens,
            completion_tokens = _completion_tokens,
            total_tokens = _total_tokens,
            prompt_tokens_details = _prompt_tokens_details(_usage.get("prompt_tokens_details")),
        ),
        timings = stream_timings,
    )
    return f"data: {usage_chunk.model_dump_json(exclude_none = True)}\n\n"


def _chat_chunk_sse(completion_id, created, model_name, *, delta, finish_reason) -> str:
    """One ``ChatCompletionChunk`` as an SSE ``data:`` line. The role / content /
    final chunks every in-process streamer emits differ only in their ``delta``
    and ``finish_reason``."""
    chunk = ChatCompletionChunk(
        id = completion_id,
        created = created,
        model = model_name,
        choices = [ChunkChoice(delta = delta, finish_reason = finish_reason)],
    )
    return f"data: {chunk.model_dump_json(exclude_none = True)}\n\n"


def _chat_role_chunk(completion_id, created, model_name) -> str:
    """Opening assistant-role chunk for a chat stream."""
    return _chat_chunk_sse(
        completion_id,
        created,
        model_name,
        delta = ChoiceDelta(role = "assistant"),
        finish_reason = None,
    )


def _chat_content_chunk(completion_id, created, model_name, text) -> str:
    """A content-delta chunk carrying ``text``."""
    return _chat_chunk_sse(
        completion_id,
        created,
        model_name,
        delta = ChoiceDelta(content = text),
        finish_reason = None,
    )


def _chat_reasoning_chunk(completion_id, created, model_name, text) -> str:
    """Like ``_chat_content_chunk`` but on ``reasoning_content`` (renders the UI thinking block).

    Carries ``content: ""`` alongside, like the GGUF and passthrough paths, so
    strict OpenAI adapters don't drop the reasoning-only delta.
    """
    return _chat_chunk_sse(
        completion_id,
        created,
        model_name,
        delta = ChoiceDelta(content = "", reasoning_content = text),
        finish_reason = None,
    )


def _chat_final_chunk(completion_id, created, model_name, finish_reason) -> str:
    """Terminal stop chunk (empty delta) carrying the finish reason."""
    return _chat_chunk_sse(
        completion_id,
        created,
        model_name,
        delta = ChoiceDelta(),
        finish_reason = finish_reason,
    )


def _stats_finish_reason(stats, default: str = "stop") -> str:
    """``"length"`` when the backend reports the turn ran out of token budget.

    Only the in-process backends fill ``truncated``. llama-server and MLX report their
    own finish reason and never set it, so they keep ``default``, as does a backend
    shipping no stats at all.
    """
    if isinstance(stats, dict) and stats.get("truncated"):
        return "length"
    return default


def _chat_tool_calls_chunk(completion_id, created, model_name, tool_calls) -> str:
    """Delta chunk carrying OpenAI tool-call deltas (sibling of ``_chat_content_chunk``)."""
    return _chat_chunk_sse(
        completion_id,
        created,
        model_name,
        delta = ChoiceDelta(tool_calls = tool_calls),
        finish_reason = None,
    )


def _sf_heal_events_to_sse(
    events,
    completion_id,
    created,
    model_name,
    state,
    parallel_tool_calls,
    monitor_id = None,
):
    """Serialize ``StreamToolCallHealer`` events into chat SSE lines.

    ``state["idx"]`` tracks the call index across ``feed``/``finalize``;
    ``parallel_tool_calls is False`` caps promotion to one call (GGUF parity).
    The monitor is fed from the same events the client receives, never the
    healed-away markup."""
    lines = []
    for kind, value in events:
        if kind == "text":
            if value:
                lines.append(_chat_content_chunk(completion_id, created, model_name, value))
                api_monitor.append_reply(monitor_id, value)
            continue
        if parallel_tool_calls is False and state["idx"] >= 1:
            continue
        lines.append(
            _chat_tool_calls_chunk(
                completion_id,
                created,
                model_name,
                [
                    {
                        "index": state["idx"],
                        "id": value["id"],
                        "type": "function",
                        "function": value["function"],
                    }
                ],
            )
        )
        _fn = value.get("function") or {}
        api_monitor.append_reply(
            monitor_id,
            ("[tool_calls] " if state["idx"] == 0 else "; ")
            + f"{_fn.get('name', '')}({_fn.get('arguments', '')})",
        )
        state["idx"] += 1
    return lines


def _rewrite_cmpl_id(raw: bytes) -> bytes:
    """Rewrite llama-server's chat-style ``chatcmpl-`` ids to the ``cmpl-``
    prefix OpenAI's legacy /v1/completions use. Anchored on the ``"id":`` key
    (both spacing variants) so the rest of the body stays byte-exact."""
    return raw.replace(b'"id":"chatcmpl-', b'"id":"cmpl-').replace(
        b'"id": "chatcmpl-', b'"id": "cmpl-'
    )


def _cmpl_stream_event_out(event: bytes, include_usage: bool) -> Optional[bytes]:
    """Process one legacy /v1/completions SSE event (text between blank-line
    separators).

    Always rewrites the ``chatcmpl-`` -> ``cmpl-`` id prefix. When the client
    did NOT request ``stream_options.include_usage``, also removes the usage
    statistics so the stream matches OpenAI's contract.

    Shape note: on /v1/completions, llama-server attaches ``usage`` to the
    FINAL content chunk (the ``finish_reason`` chunk, which has a populated
    ``choices`` array) -- unlike the chat stream, which emits a standalone
    ``choices: []`` usage chunk. Both shapes are handled: a standalone
    usage-only chunk is dropped; an inline ``usage`` field is stripped from a
    content chunk while keeping ``choices``/``finish_reason`` intact.

    Returns the event bytes to emit, or ``None`` to drop the event. Only a
    usage-bearing event is re-serialized; every other event keeps exact bytes.
    """
    if include_usage:
        return _rewrite_cmpl_id(event)
    lines = event.split(b"\n")
    changed = False
    for i, ln in enumerate(lines):
        if not ln.startswith(b"data:"):
            continue
        payload = ln[len(b"data:") :].strip()
        if not payload or payload == b"[DONE]":
            continue
        try:
            obj = json.loads(payload)
        except Exception:
            continue
        if not isinstance(obj, dict) or obj.get("usage") is None:
            continue
        # Standalone usage-only chunk (chat-style) -> drop the whole event.
        if obj.get("choices") == []:
            return None
        # Usage on a content/finish chunk (completions-style) -> strip it.
        obj.pop("usage", None)
        lines[i] = b"data: " + json.dumps(obj, separators = (",", ":")).encode("utf-8")
        changed = True
    return _rewrite_cmpl_id(b"\n".join(lines) if changed else event)


def _classify_llama_generation_error(exc: Exception) -> Optional[bool]:
    """Classify an error raised while consuming the GGUF generator.

    Returns True for a context-window overflow, False for any other upstream
    4xx (a client error), or None when it should stay a 500. Distinguishes a
    real client error from a genuine crash by the explicit "llama-server
    returned 4xx" marker, not a bare "tokens"/"exceed" substring.
    """
    msg = str(exc)
    msg_l = msg.lower()
    if "n_ctx" in msg_l or (
        "context" in msg_l and any(t in msg_l for t in ("exceed", "length", "window", "too long"))
    ):
        return True
    if _re.search(r"llama-server returned (4\d\d)", msg):
        return False
    return None


# Add backend directory to path
backend_path = Path(__file__).parent.parent.parent
if str(backend_path) not in sys.path:
    sys.path.insert(0, str(backend_path))

try:
    from core.inference import get_inference_backend
    from core.inference.llama_cpp import (
        GgufLoadIntent,
        LlamaCppBackend,
        _DEFAULT_FIRST_TOKEN_TIMEOUT_S,
        _DEFAULT_MAX_TOKENS_FLOOR,
        _DEFAULT_STREAM_STALL_TIMEOUT_S,
        _emitted_n_batch,
        _extra_args_draft_device_pin,
        _extra_args_n_ubatch,
        _hf_offline_if_unreachable,
        _hf_offline_if_unreachable_for,
        _kv_bytes_per_elem,
        _kv_unified_from_args,
        _metal_device_is_paravirtual,
        _planned_main_cache_types,
        _swa_full_from_args_or_env,
        detect_reasoning_flags,
        paravirtual_normalized_request,
    )
    from core.inference.llama_server_args import (
        _effective_tensor_parallel,
        drop_managed_flags,
        extra_args_disable_mmproj,
        parse_gpu_layers_override,
        parse_split_mode_override,
        resolve_tensor_parallel,
        strip_shadowing_flags,
        validate_extra_args,
    )
    from core.inference.tensor_fallback import load_with_tensor_fallback
    from utils.models import ModelConfig
    from utils.paths import is_local_path
    from utils.inference import load_inference_config
    from utils.models.model_config import (
        _local_gguf_companion_search_root,
        colocated_split_shards,
        detect_dflash_file,
        detect_dspark_file,
        detect_mtp_file,
        load_model_defaults,
    )
    from utils.native_path_leases import (
        NativePathLeaseError,
        display_label_for_native_path,
        is_registered_native_path_label,
        native_gguf_companion_parent_allowed,
        redact_native_paths,
        verify_native_path_lease,
    )
except ImportError:
    parent_backend = backend_path.parent / "backend"
    if str(parent_backend) not in sys.path:
        sys.path.insert(0, str(parent_backend))
    from core.inference import get_inference_backend
    from core.inference.llama_cpp import (
        GgufLoadIntent,
        LlamaCppBackend,
        _DEFAULT_FIRST_TOKEN_TIMEOUT_S,
        _DEFAULT_MAX_TOKENS_FLOOR,
        _DEFAULT_STREAM_STALL_TIMEOUT_S,
        _emitted_n_batch,
        _extra_args_draft_device_pin,
        _extra_args_n_ubatch,
        _hf_offline_if_unreachable,
        _hf_offline_if_unreachable_for,
        _kv_bytes_per_elem,
        _kv_unified_from_args,
        _metal_device_is_paravirtual,
        _planned_main_cache_types,
        _swa_full_from_args_or_env,
        detect_reasoning_flags,
        paravirtual_normalized_request,
    )
    from core.inference.llama_server_args import (
        _effective_tensor_parallel,
        drop_managed_flags,
        extra_args_disable_mmproj,
        parse_gpu_layers_override,
        parse_split_mode_override,
        resolve_tensor_parallel,
        strip_shadowing_flags,
        validate_extra_args,
    )
    from core.inference.tensor_fallback import load_with_tensor_fallback
    from utils.models import ModelConfig
    from utils.paths import is_local_path
    from utils.inference import load_inference_config
    from utils.models.model_config import (
        _local_gguf_companion_search_root,
        colocated_split_shards,
        detect_dflash_file,
        detect_dspark_file,
        detect_mtp_file,
        load_model_defaults,
    )
    from utils.native_path_leases import (
        NativePathLeaseError,
        display_label_for_native_path,
        is_registered_native_path_label,
        native_gguf_companion_parent_allowed,
        redact_native_paths,
        verify_native_path_lease,
    )


def _llama_non_streaming_generation_timeout() -> httpx.Timeout:
    return httpx.Timeout(_DEFAULT_FIRST_TOKEN_TIMEOUT_S)


def _llama_streaming_generation_timeout() -> httpx.Timeout:
    return httpx.Timeout(_DEFAULT_FIRST_TOKEN_TIMEOUT_S)


def _set_stream_response_read_timeout(
    response: httpx.Response, read_timeout_s: Optional[float] = _DEFAULT_STREAM_STALL_TIMEOUT_S
) -> None:
    # ``read_timeout_s = None`` clears httpx's read timeout (wait indefinitely),
    # used when the stall guard is disabled so a stale first-token deadline
    # can't keep timing out post-first-chunk gaps.
    try:
        timeout_ext = response.request.extensions.get("timeout")
        if isinstance(timeout_ext, dict):
            timeout_ext["read"] = read_timeout_s
    except Exception:
        pass


_STREAM_DISCONNECT_POLL_TIMEOUT_S = 0.25
_OPENAI_PASSTHROUGH_PREHEADER_STATUS_WINDOW_S = 0.1
_OPENAI_PASSTHROUGH_PENDING_RESPONSE_KEEPALIVE_S = 5.0
_OPENAI_PASSTHROUGH_SSE_KEEPALIVE = ": keep-alive\n\n"
# Lets a client tell "queued" from "backend silent"; SSE comments, so readers ignore both.
_OPENAI_ADMISSION_SSE_WAIT = ": admission-wait\n\n"
# Paired with the above: the slot is ours, so a suspended client clock starts now.
_OPENAI_ADMISSION_SSE_DONE = ": admission-done\n\n"
_OPENAI_LLAMA_ADMISSION_POLL_S = 0.25
# Cap on waiting for a cancelled teardown task. Request.is_disconnected() can swallow
# cancel() (#7617), so teardown abandons the task rather than hold the response, and
# the process-wide slot, open forever.
_TEARDOWN_TASK_STOP_TIMEOUT_S = 5.0
# Idle window before a local tool-loop stream emits an SSE keepalive comment
# (e.g. prompt prefill between tool iterations). A second layer atop the
# tool_stream_exec heartbeats, keeping proxies (Cloudflare drops idle at ~100s).
_LOCAL_TOOL_STREAM_STALL_KEEPALIVE_S = 15.0


def _openai_llama_admission_capacity(request: Optional[Request], llama_backend = None) -> int:
    """Serving slots available for one local llama-server backend.

    The loaded backend is the source of truth because it may have reduced
    ``--parallel`` at load time to keep the model on GPU. The app state is a
    launch-intent fallback for tests and for the short window before a backend
    reports its committed runtime slots.
    """
    slots = _positive_int_or_none(getattr(llama_backend, "effective_parallel_slots", None))
    if slots is not None:
        return slots
    try:
        slots = getattr(request.app.state, "llama_parallel_slots", None)
    except Exception:
        slots = None
    return _positive_int_or_none(slots) or 1


def _openai_llama_admission_reserve(
    *, request: Optional[Request], llama_backend
) -> tuple[LlamaAdmissionReservation, LlamaAdmissionConfig]:
    config = llama_admission_config_from_env()
    capacity = _openai_llama_admission_capacity(request, llama_backend)
    key = str(getattr(llama_backend, "base_url", "llama-server"))
    reservation = get_llama_admission_queue(key).reserve(
        capacity = capacity,
        config = config,
    )
    return reservation, config


def _openai_admission_request_path(request: Optional[Request]) -> Optional[str]:
    try:
        return str(request.url.path) if request is not None else None
    except Exception:
        return None


def _llama_admission_log(
    event: str,
    reservation: Optional[LlamaAdmissionReservation] = None,
    *,
    snapshot = None,
    request: Optional[Request],
    mode: str,
    wait_started_at: Optional[float] = None,
    completion_id: Optional[str] = None,
    level: str = "debug",
) -> None:
    if snapshot is None and reservation is not None:
        snapshot = reservation.snapshot_now()
    wait_ms = None
    if wait_started_at is not None:
        wait_ms = int(max(0.0, time.monotonic() - wait_started_at) * 1000)
    log = getattr(logger, level, logger.debug)
    log(
        "llama admission %s: mode=%s path=%s completion_id=%s "
        "pool=%s/%s free=%s queued=%s wait_ms=%s",
        event,
        mode,
        _openai_admission_request_path(request),
        completion_id,
        getattr(snapshot, "active", None),
        getattr(snapshot, "capacity", None),
        getattr(snapshot, "free", None),
        getattr(snapshot, "queued", None),
        wait_ms,
    )


def _openai_admission_error_body(exc: Exception, *, status_code: int) -> dict:
    snapshot = getattr(exc, "snapshot", None)
    message = str(exc)
    if snapshot is not None:
        message = (
            f"{message} "
            f"(active={snapshot.active}, queued={snapshot.queued}, capacity={snapshot.capacity})"
        )
    return openai_error_body(message, status = status_code)


def _openai_admission_http_exception(exc: Exception, *, status_code: int) -> HTTPException:
    return HTTPException(
        status_code = status_code,
        detail = _openai_admission_error_body(exc, status_code = status_code),
    )


def _anthropic_admission_http_exception(exc: Exception, *, status_code: int) -> HTTPException:
    """Anthropic-shaped error for an admission reject/timeout/cancel (429/503/499)."""
    snapshot = getattr(exc, "snapshot", None)
    message = str(exc)
    if snapshot is not None:
        message = (
            f"{message} "
            f"(active={snapshot.active}, queued={snapshot.queued}, capacity={snapshot.capacity})"
        )
    # Types come from ANTHROPIC_TYPE_BY_STATUS (429 -> rate_limit_error, which is
    # what Anthropic SDKs back off on); overloaded_error is reserved for 529.
    return HTTPException(
        status_code = status_code,
        detail = anthropic_error_body(message, status = status_code),
    )


def _openai_admission_timeout_error(
    reservation: LlamaAdmissionReservation,
) -> LlamaAdmissionTimeout:
    return LlamaAdmissionTimeout(
        "Timed out waiting for an available local llama-server generation slot",
        snapshot = reservation.snapshot_now(),
    )


def _openai_admission_cancelled_error(
    reservation: LlamaAdmissionReservation,
) -> LlamaAdmissionCancelled:
    return LlamaAdmissionCancelled(
        "Client disconnected before an upstream llama-server generation slot was available",
        snapshot = reservation.snapshot_now(),
    )


async def _raise_if_openai_admission_cancelled(
    reservation: LlamaAdmissionReservation, *, request: Optional[Request], cancel_event
) -> None:
    if reservation.is_cancelled:
        raise _openai_admission_cancelled_error(reservation)
    if await _preheader_cancelled(cancel_event, request):
        reservation.cancel()
        raise _openai_admission_cancelled_error(reservation)


async def _wait_for_openai_admission_non_streaming(
    reservation: LlamaAdmissionReservation,
    config: LlamaAdmissionConfig,
    *,
    request: Optional[Request],
    cancel_event,
) -> LlamaAdmissionLease:
    lease = reservation.lease_nowait()
    if lease is not None:
        try:
            await _raise_if_openai_admission_cancelled(
                reservation,
                request = request,
                cancel_event = cancel_event,
            )
        except asyncio.CancelledError:
            lease.release()
            raise
        except LlamaAdmissionCancelled:
            lease.release()
            raise
        return lease
    await _raise_if_openai_admission_cancelled(
        reservation,
        request = request,
        cancel_event = cancel_event,
    )
    deadline = None if config.queue_timeout_s is None else time.monotonic() + config.queue_timeout_s
    try:
        while True:
            await _raise_if_openai_admission_cancelled(
                reservation,
                request = request,
                cancel_event = cancel_event,
            )
            lease = reservation.lease_nowait()
            if lease is not None:
                try:
                    await _raise_if_openai_admission_cancelled(
                        reservation,
                        request = request,
                        cancel_event = cancel_event,
                    )
                except asyncio.CancelledError:
                    lease.release()
                    raise
                except LlamaAdmissionCancelled:
                    lease.release()
                    raise
                return lease
            wait_s = _OPENAI_LLAMA_ADMISSION_POLL_S
            if deadline is not None:
                remaining_s = deadline - time.monotonic()
                if remaining_s <= 0:
                    reservation.cancel()
                    raise _openai_admission_timeout_error(reservation)
                wait_s = min(wait_s, max(remaining_s, 0.001))
            try:
                lease = await reservation.wait(wait_s)
            except asyncio.TimeoutError:
                continue
            if lease is not None:
                return lease
            await _raise_if_openai_admission_cancelled(
                reservation,
                request = request,
                cancel_event = cancel_event,
            )
    except asyncio.CancelledError:
        reservation.cancel()
        raise


async def _openai_admission_wait_stream_chunks(
    reservation: LlamaAdmissionReservation,
    config: LlamaAdmissionConfig,
    *,
    request: Optional[Request],
    cancel_event,
):
    lease = reservation.lease_nowait()
    if lease is not None:
        yield lease
        return

    await _raise_if_openai_admission_cancelled(
        reservation,
        request = request,
        cancel_event = cancel_event,
    )
    deadline = None if config.queue_timeout_s is None else time.monotonic() + config.queue_timeout_s
    keepalive_interval_s = max(0.001, config.keepalive_interval_s)
    # At once, not after a full interval: a caller must not wait one out to learn it queued.
    yield _OPENAI_ADMISSION_SSE_WAIT
    next_keepalive_at = time.monotonic() + keepalive_interval_s
    try:
        while True:
            await _raise_if_openai_admission_cancelled(
                reservation,
                request = request,
                cancel_event = cancel_event,
            )
            lease = reservation.lease_nowait()
            if lease is not None:
                yield _OPENAI_ADMISSION_SSE_DONE
                yield lease
                return

            now = time.monotonic()
            wait_s = min(_OPENAI_LLAMA_ADMISSION_POLL_S, max(next_keepalive_at - now, 0.001))
            if deadline is not None:
                remaining_s = deadline - now
                if remaining_s <= 0:
                    reservation.cancel()
                    raise _openai_admission_timeout_error(reservation)
                wait_s = min(wait_s, max(remaining_s, 0.001))
            try:
                lease = await reservation.wait(wait_s)
            except asyncio.TimeoutError:
                lease = None
            if lease is not None:
                yield _OPENAI_ADMISSION_SSE_DONE
                yield lease
                return
            await _raise_if_openai_admission_cancelled(
                reservation,
                request = request,
                cancel_event = cancel_event,
            )
            now = time.monotonic()
            if now >= next_keepalive_at:
                next_keepalive_at = now + keepalive_interval_s
                yield _OPENAI_ADMISSION_SSE_WAIT
    except asyncio.CancelledError:
        reservation.cancel()
        raise


async def _close_openai_admitted_stream_iterator(iterator, *, cancelled: bool) -> None:
    if iterator is None:
        return
    if cancelled:
        athrow = getattr(iterator, "athrow", None)
        if athrow is not None:
            try:
                await athrow(asyncio.CancelledError())
            except (asyncio.CancelledError, StopAsyncIteration, RuntimeError):
                return
    aclose = getattr(iterator, "aclose", None)
    if aclose is not None:
        await aclose()


def _openai_compat_stream_stall_timeout():
    """Max silent gap after an OpenAI passthrough stream has produced data.

    If the socket goes silent after valid SSE data, this bounds how long the
    client is kept open. Defaults to the backend-wide stall timeout so this
    path stalls out like every sibling stream; set the env var to tighten it
    for local serving, or to 0 to disable the guard.
    """
    return _positive_float_env(
        _OPENAI_COMPAT_STREAM_STALL_TIMEOUT_ENV,
        _DEFAULT_STREAM_STALL_TIMEOUT_S,
    )


def _openai_passthrough_upstream_headers(*, llama_backend = None) -> dict:
    headers = {}
    auth_headers = getattr(llama_backend, "_auth_headers", None)
    if isinstance(auth_headers, dict):
        headers.update(auth_headers)
    headers["Connection"] = "close"
    return headers


class _CompatSameTaskTimeout:
    """Same-task timeout fallback for Python versions before asyncio.timeout."""

    def __init__(self, timeout_s: float):
        self.timeout_s = timeout_s
        self._task = None
        self._handle = None
        self._timed_out = False
        self._cancelling = 0

    async def __aenter__(self):
        self._task = asyncio.current_task()
        if self._task is None:
            return self
        if hasattr(self._task, "cancelling"):
            self._cancelling = self._task.cancelling()
        loop = asyncio.get_running_loop()
        self._handle = loop.call_later(max(self.timeout_s, 0), self._cancel_task)
        return self

    async def __aexit__(self, exc_type, exc, tb):
        if self._handle is not None:
            self._handle.cancel()
        if exc_type is not None and issubclass(exc_type, asyncio.CancelledError):
            if self._timed_out:
                if self._task is not None and hasattr(self._task, "uncancel"):
                    if self._task.uncancel() > self._cancelling:
                        return None
                raise asyncio.TimeoutError from exc
        return None

    def _cancel_task(self) -> None:
        self._timed_out = True
        if self._task is not None:
            self._task.cancel()


def _same_task_timeout(timeout_s: float):
    timeout_ctx = getattr(asyncio, "timeout", None)
    if timeout_ctx is not None:
        return timeout_ctx(timeout_s)
    return _CompatSameTaskTimeout(timeout_s)


class _SameTaskStreamingResponse(StreamingResponse):
    """StreamingResponse without Starlette's legacy AnyIO task-group wrapper."""

    def __init__(
        self,
        *args,
        unstarted_cleanup = None,
        **kwargs,
    ) -> None:
        super().__init__(*args, **kwargs)
        # Released when the client disconnects before the body iterator starts:
        # its try/finally never runs, so a stream that opens resources before the
        # first yield (the passthrough's upstream httpx stream) passes this.
        self._unstarted_cleanup = unstarted_cleanup

    async def __call__(self, scope, receive, send) -> None:
        # send() emits a body message only after the first chunk, so no body
        # message means the generator never entered its try/finally.
        body_started = False

        async def _tracking_send(message) -> None:
            nonlocal body_started
            if message.get("type") == "http.response.body":
                body_started = True
            await send(message)

        try:
            await self.stream_response(_tracking_send)
        except OSError:  # client disconnected mid-send
            if body_started:
                # Generator is suspended in its try/finally: throw CancelledError
                # (not aclose's GeneratorExit) so its handler finishes the
                # api_monitor entry. Fall back to aclose() without athrow.
                athrow = getattr(self.body_iterator, "athrow", None)
                if athrow is not None:
                    try:
                        await athrow(asyncio.CancelledError())
                    except (asyncio.CancelledError, StopAsyncIteration, RuntimeError):
                        pass
                else:
                    aclose = getattr(self.body_iterator, "aclose", None)
                    if aclose is not None:
                        await aclose()
            else:
                # Generator never started; aclose()/athrow() are no-ops on it, so
                # release eager resources via the hook. getattr guards a response
                # built through __new__ without __init__ (tests, pickling).
                aclose = getattr(self.body_iterator, "aclose", None)
                if aclose is not None:
                    await aclose()
                cleanup = getattr(self, "_unstarted_cleanup", None)
                if cleanup is not None:
                    try:
                        await cleanup()
                    except Exception:
                        pass
            raise ClientDisconnect()
        if self.background is not None:
            await self.background()


async def _release_unstarted_anthropic_stream(iterator, prior_cleanup) -> None:
    """Close a stream whose body never started, running the response's own
    pre-start hook. aclose() on an unstarted async generator is a no-op, so its
    finally never runs and anything the builder acquired eagerly (the passthrough
    cancel tracker) would leak without the hook."""
    aclose = getattr(iterator, "aclose", None)
    if aclose is not None:
        try:
            await aclose()
        except Exception:
            pass
    if prior_cleanup is not None:
        try:
            await prior_cleanup()
        except Exception:
            pass


def _tracked_cancel_unstarted_cleanup(tracker):
    """unstarted_cleanup that exits ``tracker`` on a pre-start disconnect, when
    the generator's finally (which normally exits it) never runs."""

    async def _cleanup() -> None:
        tracker.__exit__(None, None, None)

    return _cleanup


# Cloudflare quick tunnels (--secure) drop a request whose origin has sent no body
# bytes for ~100s, and a 600 GB GGUF load runs 100-330s. Measured on a real quick
# tunnel: headers at t=0 with no body still 524s, one space every 20s survives. So
# a slow call commits a 200 and pads until its payload is ready; leading whitespace
# is legal JSON, so clients parse the body as-is.
_TUNNEL_KEEPALIVE_AFTER_S = 15.0
_TUNNEL_KEEPALIVE_EVERY_S = 20.0

# Underscored so it cannot collide with a real field or the OpenAI ``error`` envelope.
_DEFERRED_ERROR_KEY = "_deferred_error"


def _deferred_error_body(status_code: int, detail) -> bytes:
    body = {_DEFERRED_ERROR_KEY: {"status_code": status_code, "detail": detail}}
    return json.dumps(body).encode()


async def _tunnel_safe_json(coro, *, label: str):
    """Await ``coro``, padding the response body if it outruns the tunnel timer.

    A call finishing within ``_TUNNEL_KEEPALIVE_AFTER_S`` keeps the current
    contract exactly, HTTPException status code included; every early failure
    (validation, unknown identifier, download-manager and sidecar 409s) raises in
    that window. Only a slower call switches to a padded stream, and it must
    report a late failure in the body because the status line is already gone.

    A client disconnect does not cancel the work: the model stays resident, as
    it does today.
    """
    task = asyncio.ensure_future(coro)
    # A client that disconnects mid-pad leaves nobody to await the task, and an
    # unretrieved exception logs "Task exception was never retrieved". Retrieving
    # it here does not consume it: result() below still raises.
    task.add_done_callback(lambda t: t.cancelled() or t.exception())
    done, _ = await asyncio.wait({task}, timeout = _TUNNEL_KEEPALIVE_AFTER_S)
    if done:
        return task.result()  # re-raises exactly as an un-wrapped await would

    logger.info(
        f"{label} exceeded {_TUNNEL_KEEPALIVE_AFTER_S:.0f}s; "
        "padding the response so a proxy cannot time it out"
    )

    async def _body():
        while True:
            finished, _ = await asyncio.wait({task}, timeout = _TUNNEL_KEEPALIVE_EVERY_S)
            if not finished:
                yield b" "
                continue
            try:
                payload = task.result()
            except HTTPException as exc:
                logger.info(f"{label} failed with {exc.status_code} after the response committed")
                yield _deferred_error_body(exc.status_code, exc.detail)
            except Exception as exc:
                logger.exception(f"{label} failed after the response was committed")
                yield _deferred_error_body(500, f"{type(exc).__name__}: {exc}")
            else:
                yield json.dumps(jsonable_encoder(payload)).encode()
            return

    return _SameTaskStreamingResponse(
        _body(),
        media_type = "application/json",
        headers = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


async def _aclose_stream_resources(
    *,
    watchers = (),
    iterator = None,
    resp = None,
    client = None,
) -> None:
    """Tear down an httpx streaming generator's resources in the required order:
    cancel + bounded-wait each watcher task, then aclose() the byte/line iterator,
    the response, and the client. Each step swallows its own exceptions so teardown
    always completes; a close-time CancelledError is re-raised only after every
    step has run. See _anthropic_passthrough_stream for the ordering rationale."""
    # Bounded: a watcher parked in Request.is_disconnected() can swallow cancel(), so an
    # unbounded await holds the response open. Stopped together, so N watchers cost one
    # bound before the closes, which are what stop llama-server decoding. #7617
    live = [w for w in watchers if w is not None]
    if live:
        # Cancel before the first await, else a cancel here stops the gather before it
        # steps its children, leaving watchers never cancelled.
        for watcher in live:
            watcher.cancel()
        try:
            await asyncio.gather(
                *(_stop_local_disconnect_cancel_watcher(w) for w in live),
                return_exceptions = True,
            )
        except (asyncio.CancelledError, Exception):
            pass
    close_cancelled = False
    if iterator is not None:
        try:
            await iterator.aclose()
        except asyncio.CancelledError:
            close_cancelled = True
        except Exception:
            pass
    if resp is not None:
        try:
            await resp.aclose()
        except asyncio.CancelledError:
            close_cancelled = True
        except Exception:
            pass
    if client is not None:
        try:
            await client.aclose()
        except asyncio.CancelledError:
            close_cancelled = True
        except Exception:
            pass
    if close_cancelled:
        raise asyncio.CancelledError()


# The loop holds only weak refs to tasks, so a bare ensure_future() close can be collected
# before it runs. Strong ref until done.
_LATE_CLOSE_TASKS: set = set()


async def _aclose_quietly(obj) -> None:
    try:
        await obj.aclose()
    except Exception:
        pass


def _discard_task_outcome(task: asyncio.Task) -> None:
    """Drain an abandoned teardown task, closing a late response rather than dropping it.

    Closing the per-request client does not close a response the send produces on a
    connection opened after that close. Never raises: this is a done callback. #7617
    """
    try:
        if task.cancelled():
            return
        if task.exception() is not None:
            return
        result = task.result()
    except Exception:
        return
    if result is not None and hasattr(result, "aclose") and not getattr(result, "is_closed", False):
        try:
            closing = asyncio.ensure_future(_aclose_quietly(result))
        except RuntimeError:
            return
        _LATE_CLOSE_TASKS.add(closing)
        closing.add_done_callback(_LATE_CLOSE_TASKS.discard)


def _release_admission(admission_lease = None, tracker = None) -> None:
    """Give back the process-wide llama-server slot and the cancel-registry entry.

    Must run after the upstream response is closed: on disconnect llama-server keeps
    decoding until ``resp`` is closed, so releasing first admits a second request past
    --parallel. Safe behind the closes only because every teardown await is bounded. #7617
    """
    try:
        if admission_lease is not None:
            admission_lease.release()
    finally:
        if tracker is not None:
            tracker.__exit__(None, None, None)


async def _preheader_cancelled(cancel_event = None, request: Optional[Request] = None) -> bool:
    if cancel_event is not None and cancel_event.is_set():
        return True
    if request is not None and await request.is_disconnected():
        if cancel_event is not None:
            cancel_event.set()
        return True
    return False


async def _wait_preheader_cancel(cancel_event = None, request: Optional[Request] = None) -> None:
    while not await _preheader_cancelled(cancel_event, request):
        await asyncio.sleep(0.05)


async def _send_stream_with_preheader_cancel(
    client: httpx.AsyncClient,
    req: httpx.Request,
    cancel_event = None,
    request: Optional[Request] = None,
    mark_cancel_on_cancel: bool = True,
) -> Optional[httpx.Response]:
    if cancel_event is None and request is None:
        return await client.send(req, stream = True)
    if await _preheader_cancelled(cancel_event, request):
        return None

    send_task = asyncio.create_task(client.send(req, stream = True))
    cancel_task = asyncio.create_task(_wait_preheader_cancel(cancel_event, request))

    async def _stop_send_task() -> None:
        try:
            await client.aclose()
        except Exception:
            pass
        # Bounded: the client is already closed, so an abandoned send owns nothing and
        # the callback drains its result. #7617
        send_task.cancel()
        done, _pending = await asyncio.wait({send_task}, timeout = _TEARDOWN_TASK_STOP_TIMEOUT_S)
        if not done:
            send_task.add_done_callback(_discard_task_outcome)
            return
        try:
            # The aclose() above does not close a response the send produced during it.
            sent = send_task.result()
            if sent is not None:
                await _aclose_quietly(sent)
        except (asyncio.CancelledError, Exception):
            pass

    try:
        done, _pending = await asyncio.wait(
            {send_task, cancel_task},
            return_when = asyncio.FIRST_COMPLETED,
        )
        if send_task in done:
            return await send_task

        await _stop_send_task()
        return None
    except asyncio.CancelledError:
        if mark_cancel_on_cancel and cancel_event is not None:
            cancel_event.set()
        await _stop_send_task()
        raise
    finally:
        # Bounded: cancel_task polls Request.is_disconnected(), which can swallow cancel(),
        # and this finally also runs on the success path, before the first byte. #7617
        try:
            await _stop_local_disconnect_cancel_watcher(cancel_task)
        except (asyncio.CancelledError, Exception):
            pass


async def _aiter_llama_stream_items(
    async_iter,
    *,
    cancel_event = None,
    request: Optional[Request] = None,
    first_token_deadline: Optional[float] = None,
    response: Optional[httpx.Response] = None,
    post_first_item_read_timeout_s: Optional[
        Union[float, Callable[[], Optional[float]]]
    ] = _DEFAULT_STREAM_STALL_TIMEOUT_S,
):
    if first_token_deadline is None:
        first_token_deadline = time.monotonic() + _DEFAULT_FIRST_TOKEN_TIMEOUT_S
    last_item_at: Optional[float] = None

    def _post_first_timeout_s() -> Optional[float]:
        if callable(post_first_item_read_timeout_s):
            return post_first_item_read_timeout_s()
        return post_first_item_read_timeout_s

    while True:
        if cancel_event is not None and cancel_event.is_set():
            return
        if request is not None and await request.is_disconnected():
            if cancel_event is not None:
                cancel_event.set()
            return
        waiting_first_item = last_item_at is None
        try:
            if waiting_first_item:
                remaining_s = first_token_deadline - time.monotonic()
                if remaining_s <= 0:
                    raise httpx.ReadTimeout("The model did not produce a first token in time.")
                if response is not None:
                    _set_stream_response_read_timeout(response, remaining_s)
                # Keep httpx/httpcore's AnyIO cancel scope in this task.
                # asyncio.wait_for would drive __anext__ in a child task.
                async with _same_task_timeout(remaining_s):
                    item = await async_iter.__anext__()
            else:
                timeout_s = _post_first_timeout_s()
                if (
                    request is not None
                    and response is not None
                    and timeout_s is not None
                    and last_item_at is not None
                ):
                    stall_remaining_s = timeout_s - (time.monotonic() - last_item_at)
                    if stall_remaining_s <= 0:
                        raise httpx.ReadTimeout("The model stopped producing tokens mid-response.")
                    _set_stream_response_read_timeout(response, stall_remaining_s)
                item = await async_iter.__anext__()
        except asyncio.TimeoutError as exc:
            if waiting_first_item:
                raise httpx.ReadTimeout("The model did not produce a first token in time.") from exc
            raise
        except StopAsyncIteration:
            return
        except httpx.ReadTimeout:
            now = time.monotonic()
            if last_item_at is None:
                if now >= first_token_deadline:
                    raise
                continue
            timeout_s = _post_first_timeout_s()
            if request is not None and timeout_s is not None and now - last_item_at < timeout_s:
                continue
            raise httpx.ReadTimeout("The model stopped producing tokens mid-response.")
        if last_item_at is None and response is not None:
            # The first-token read deadline no longer applies once a chunk has
            # arrived: switch to the stall timeout, or clear the read timeout
            # entirely when the stall guard is disabled (callable returns None)
            # so a long gap can't trip the stale first-token deadline.
            _set_stream_response_read_timeout(response, _post_first_timeout_s())
        last_item_at = time.monotonic()
        yield item


from models.inference import (
    _InferenceRuntimeFields,
    LoadRequest,
    UnloadRequest,
    TranscribeRequest,
    SttLoadRequest,
    GenerateRequest,
    DiffusionLoadRequest,
    DiffusionGenerateRequest,
    DiffusionGenerateResponse,
    DiffusionGenerateProgressResponse,
    DiffusionStatusResponse,
    DiffusionDownloadPlanResponse,
    DiffusionInferenceInfoResponse,
    DiffusionLoadProgressResponse,
    GalleryFlagsPatch,
    GalleryImage,
    GalleryListResponse,
    ImageGenerationRequest,
    ImageGenerationData,
    ImageGenerationResponse,
    AudioSpeechRequest,
    AudioGalleryItem,
    AudioGalleryListResponse,
    LoadResponse,
    LoadProgressResponse,
    UnloadResponse,
    InferenceStatusResponse,
    LlamaFlagCatalogResponse,
    ChatCompletionRequest,
    ChatCountTokensRequest,
    ChatCompletionChunk,
    ChatCompletion,
    ToolConfirmRequest,
    ChatMessage,
    ChunkChoice,
    ChoiceDelta,
    CompletionChoice,
    CompletionMessage,
    CompletionUsage,
    ValidateModelRequest,
    ValidateModelResponse,
    TransformersUpgradeInfo,
    TransformersUpgradeCheckRequest,
    TransformersUpgradeCheckResponse,
    InstallLatestTransformersRequest,
    InstallLatestTransformersResponse,
    TextContentPart,
    ImageContentPart,
    ImageUrl,
    ResponsesRequest,
    ResponsesInputTextPart,
    ResponsesInputImagePart,
    ResponsesOutputTextPart,
    ResponsesUnknownInputItem,
    ResponsesFunctionCallInputItem,
    ResponsesFunctionCallOutputInputItem,
    ResponsesOutputTextContent,
    ResponsesOutputMessage,
    ResponsesOutputReasoning,
    ResponsesOutputReasoningContent,
    ResponsesOutputFunctionCall,
    ResponsesUsage,
    ResponsesResponse,
    AnthropicMessagesRequest,
    AnthropicMessagesResponse,
    AnthropicResponseTextBlock,
    AnthropicResponseToolUseBlock,
    AnthropicUsage,
    CreateOpenAIContainerBody,
    DeleteOpenAIContainerBody,
    ListOpenAIContainersResponse,
    OpenAIContainerRequest,
    OpenAIContainerSummary,
)
from core.inference.anthropic_compat import (
    anthropic_messages_to_openai,
    anthropic_schema_client_tool_kind,
    anthropic_tools_to_openai,
    anthropic_tool_choice_to_openai,
    openai_finish_to_anthropic_stop,
    anthropic_tool_use_id,
    build_anthropic_sse_event,
    AnthropicStreamEmitter,
    AnthropicPassthroughEmitter,
)
from auth import storage as auth_storage
from auth.authentication import API_KEY_PREFIX, get_current_subject
from state import active_generations


def _request_api_key_token(request: Any) -> Optional[str]:
    """Return any sk-unsloth bearer used for authentication, including workflow keys."""
    try:
        header = request.headers.get("authorization")
    except Exception:
        return None
    if not isinstance(header, str):
        return None
    scheme, _, token = header.partition(" ")
    if scheme.lower() != "bearer" or not token.startswith(API_KEY_PREFIX):
        return None
    return token


def _request_has_api_key(request: Any) -> bool:
    """Whether the request used any API key rather than an interactive session JWT."""
    return _request_api_key_token(request) is not None


def _request_is_internal_workflow(request: Any) -> bool:
    """True only for Studio's own workflow keys (Deep Research, data recipes).

    Checked against the stored internal-key hashes, never a prefix, so a caller
    cannot mint one by sending an sk-unsloth-looking bearer. Fails closed when the
    probe raises, so a storage error withholds saved credentials rather than
    handing them out.
    """
    token = _request_api_key_token(request)
    if token is None:
        return False
    try:
        return bool(auth_storage.is_internal_api_key(token))
    except Exception:
        logger.debug("external_provider.internal_key_probe_failed", exc_info = True)
        return False


def _request_is_saved_credential_workflow(request: Any) -> bool:
    """True only for the one workflow key allowed to spend a saved provider credential.

    "Internal" is not the licence: Studio mints internal keys for data recipes
    too, and ``routes/data_recipe/jobs.py`` writes that key straight into the
    recipe's own provider block so a user-authored recipe subprocess holds it.
    Granting every internal key the saved-connection exception would therefore
    hand that subprocess a confused deputy: name any saved provider_id, omit the
    key, and bill arbitrary requests to the user's cloud account. Only the
    durable Deep Research hop needs the exception, and only because its run
    outlives the session that created it, so it carries a key instead of a JWT
    and ``research_runs._sanitize_config`` already pinned it to one enabled saved
    connection.

    Layered on the internal check rather than replacing it, and fails closed on a
    storage error, so an unreadable key store withholds the credential.
    """
    if not _request_is_internal_workflow(request):
        return False
    token = _request_api_key_token(request)
    if token is None:
        return False
    try:
        name = auth_storage.internal_api_key_name(token)
    except Exception:
        logger.debug("external_provider.workflow_key_name_probe_failed", exc_info = True)
        return False
    return name == auth_storage.DEEP_RESEARCH_WORKFLOW_KEY_NAME


def _request_used_api_key(request: Any) -> bool:
    """True when this request authenticated with a third party's sk-unsloth key.

    Studio's own chat hits these same endpoints with a session JWT, so this is
    what separates "someone is using Unsloth as an API server" from "someone is
    using Unsloth". Internal workflow keys (Deep Research, data recipes) are Studio
    itself and are excluded, or every research step would pop the API monitor open.
    """
    # Total by construction: this only decides a monitor label and must never fail a
    # load. Saved-secret authorization uses _request_has_api_key instead, narrowed by
    # _request_is_internal_workflow where a Studio workflow needs its own connection.
    token = _request_api_key_token(request)
    if token is None:
        return False
    try:
        return not auth_storage.is_internal_api_key(token)
    except Exception:
        logger.debug("api_monitor.internal_key_probe_failed", exc_info = True)
        return True


from state.tool_approvals import resolve_tool_decision

from core.inference.model_ids import display_model_name, model_id_matches, public_model_id
from core.inference.api_monitor import api_monitor
from core.inference.llama_http import nonstreaming_client
from core.inference.tool_call_parser import (
    _strip_function_xml_calls,
    _strip_gemma_wrapperless_calls,
    _strip_glm_calls,
    _strip_mistral_closed_calls,
)
from core.inference.tool_call_parser import TOOL_XML_SIGNALS as _PARSER_TOOL_SIGNALS
from core.inference.passthrough_healing import (
    StreamToolCallHealer,
    heal_gate,
    heal_openai_message,
    heal_openai_message_events,
    nudge_enabled,
    nudge_messages,
    nudge_should_retry,
    response_has_promotable_calls,
)
from core.inference.providers import (
    HOSTED_TOOL_NAMES,
    get_base_url,
    get_provider_info,
    hosted_only_tools,
    LOCAL_STANDINS_FOR_HOSTED_TOOLS,
    provider_hosted_tools,
    provider_model_runs_local_tools,
    provider_runs_local_tools,
    validate_provider_base_url,
)
from core.inference.external_provider import ExternalProviderClient
from core.inference.external_tool_transport import OAICompatTransport
from core.inference.studio_tool_loop import (
    ToolLoopPolicy,
    ToolLoopRun,
    stream_with_studio_tools,
)
from core.inference.chat_templates import resolve_effective_chat_template_override
from routes.provider_credentials import resolve_provider_api_key_or_400
from storage import providers_db
from utils.utils import is_hf_authentication_error, safe_error_detail, log_and_http_error

import io
import base64
from datetime import date as _date, datetime as _datetime

if TYPE_CHECKING:
    import numpy as np

router = APIRouter()
# Unsloth-only router (not mounted on /v1 OpenAI-compat).
studio_router = APIRouter()


# Packaged desktop runs at tauri://localhost (macOS/Linux) or http://tauri.localhost
# (Windows WebView2); the web build is same-origin ('self'). The `tauri dev` shell,
# however, serves the frontend from the Vite dev origin (http://localhost:5173),
# so the packaged allowlist alone leaves the preview blocked in dev with an
# "ancestor violates frame-ancestors" error. This shell exposes no server resource
# (it only renders postMessage'd HTML in a no-same-origin sandbox), so also allowing
# any localhost/127.0.0.1 dev origin to frame it is safe and unblocks the dev shell.

# =====================================================================
# Studio Artifact Preview Frame (Modularized in routes.inference_pkg)
# =====================================================================
from routes.inference_pkg.router_artifacts import (
    studio_router as _artifacts_studio_router,
    _ARTIFACT_PREVIEW_FRAME_ANCESTORS,
    _ARTIFACT_PREVIEW_FRAME_STRICT_CSP,
    _ARTIFACT_PREVIEW_FRAME_NETWORK_CSP,
    _ARTIFACT_PREVIEW_FRAME_HTML,
    _authenticate_header_or_query,
    artifact_preview_frame,
)

for r in _artifacts_studio_router.routes:
    studio_router.routes.append(r)


# Whitespace/escape-tolerant bare-JSON tool-template detector (matches pretty-printed and
# JSON-escaped ``{"name":`` plus the ``"function"`` alias), mirroring the parser's tolerance.
_BARE_JSON_NAME_MARKER_RE = _re.compile(r'\{\s*\\?"(?:name|function)\\?"\s*:')


def _detect_safetensors_features(
    backend,
    chat_template: Optional[str],
    tools = None,
) -> dict:
    """Classify reasoning/tool capabilities via the GGUF classifier so flags
    match across backends. gpt-oss is overridden: Harmony routes reasoning and
    tools through tokenizer channels, not template markup."""
    model_id = getattr(backend, "active_model_name", None)
    feature_template = chat_template
    try:
        from core.inference.chat_template_helpers import _selected_template_strings_from_value
        selected_templates = _selected_template_strings_from_value(chat_template, tools)
        if selected_templates:
            feature_template = selected_templates[0]
    except Exception:
        logger.debug("safetensors_named_template_selection_failed", exc_info = True)
    flags = detect_reasoning_flags(
        feature_template,
        model_identifier = model_id,
        log_source = "safetensors",
    )
    if not flags.get("supports_reasoning"):
        try:
            from core.inference.chat_template_helpers import (
                detect_reasoning_channel_markers_from_template,
            )

            templates = [chat_template]
            models = getattr(backend, "models", None)
            model_info = (
                models.get(model_id, {})
                if isinstance(models, dict) and model_id is not None
                else {}
            )
            if isinstance(model_info, dict):
                templates.extend(
                    (
                        model_info.get("native_chat_template"),
                        (model_info.get("chat_template_info") or {}).get("template"),
                    )
                )
            if any(
                detect_reasoning_channel_markers_from_template(template, tools = tools) is not None
                for template in templates
            ):
                flags["supports_reasoning"] = True
                flags["reasoning_always_on"] = True
                logger.info("safetensors: model always reasons (native channel markers)")
        except Exception:
            logger.debug("safetensors_native_reasoning_marker_check_failed", exc_info = True)
    # Markers any supported parser recognises (template advertises tools but
    # uses none -> drop the pill). Reuse the parser's own signal list so this
    # gate never drifts (a hand-maintained copy lost the DeepSeek variants);
    # ``<arg_key>`` is GLM's unique signal, absent from the shared set. The
    # bare-JSON ``{"name":`` form is matched below with the whitespace/escape-
    # tolerant ``_BARE_JSON_NAME_MARKER_RE`` so pretty-printed or escaped
    # templates are not mis-classified as tool-less.
    _PARSER_MARKERS = (
        *_PARSER_TOOL_SIGNALS,
        "<arg_key>",
    )
    if (
        flags.get("supports_tools")
        and isinstance(feature_template, str)
        and not any(m in feature_template for m in _PARSER_MARKERS)
        and not _BARE_JSON_NAME_MARKER_RE.search(feature_template)
    ):
        logger.info(
            "safetensors: template advertises tools but uses an "
            "emission format the loop cannot parse; suppressing "
            "supports_tools"
        )
        flags["supports_tools"] = False

    # gpt-oss: keep reasoning on, drop tools (Harmony channel, not the
    # <tool_call> XML this loop parses).
    try:
        if hasattr(backend, "_is_gpt_oss_model") and backend._is_gpt_oss_model():
            flags["supports_reasoning"] = True
            flags["reasoning_style"] = "reasoning_effort"
            flags["supports_tools"] = False
    except Exception:
        logger.debug("gpt_oss_check_failed", exc_info = True)
    return flags


def _generation_prompt_opens_think(template: Optional[str]) -> bool:
    """True when rendering the template's generation prompt ends INSIDE an unclosed ``<think>``.

    Distinguishes templates that PREFILL an open ``<think>`` in the assistant generation
    prompt (DeepSeek-R1, QwQ, Qwen3-Thinking) -- where the model emits only the closing
    ``</think>`` and the extractor must start in reasoning mode -- from templates that merely
    render PAST assistant ``<think>...</think>`` history while leaving the generation prompt
    open with no ``<think>`` (e.g. Kimi-K2-Thinking), where the model self-emits its own block
    and the extractor must start in normal mode. Renders a single-user-message probe with the
    same sandbox transformers uses; on any failure returns True, preserving the historical
    always-on prefill for templates that cannot be rendered here.
    """
    if not template:
        return False
    try:
        from jinja2.sandbox import ImmutableSandboxedEnvironment

        def _raise_exception(message: str):
            raise RuntimeError(message)

        env = ImmutableSandboxedEnvironment(
            trim_blocks = True,
            lstrip_blocks = True,
            extensions = ["jinja2.ext.loopcontrols"],
        )
        env.filters["tojson"] = lambda value, **kwargs: json.dumps(value, ensure_ascii = False)
        env.globals["raise_exception"] = _raise_exception
        rendered = env.from_string(template).render(
            messages = [{"role": "user", "content": "hi"}],
            add_generation_prompt = True,
            bos_token = "",
            eos_token = "",
        )
    except Exception:
        return True
    # ``<think>`` is not a substring of ``</think>`` (the ``/`` breaks it), so the last open
    # tag sitting after the last close tag means the prompt ends inside an open block.
    return rendered.rfind("<think>") > rendered.rfind("</think>")


def _sf_reasoning_prefill_mode(
    features: dict,
    enable_thinking: Optional[bool],
    template: Optional[str] = None,
    reasoning_effort: Optional[str] = None,
) -> bool:
    """Whether a safetensors/MLX generation begins INSIDE an unclosed ``<think>``.

    ``enable_thinking`` templates (Qwen3/GLM) prefill an open ``<think>`` so the model
    emits only the closing ``</think>``, and the extractor must start in reasoning mode.
    Gated on the STANDARD ``<think>``/``</think>`` markers: bespoke channels (gemma's
    ``<|think|>``) never emit ``</think>`` and would swallow the answer, so they and
    gpt-oss and thinking-disabled requests return False. ``enable_thinking`` None
    defaults thinking ON, so a plain request still prefills.
    """
    if features.get("reasoning_style") not in ("enable_thinking", "enable_thinking_effort"):
        return False
    tpl = template or ""
    if "</think>" not in tpl and "<think>" not in tpl:
        return False
    if features.get("reasoning_always_on"):
        # enable_thinking_effort + always-on: the effort mechanism (not the prompt shape) keeps
        # thinking on, so always-on wins over reasoning_effort and we prefill.
        if features.get("reasoning_style") == "enable_thinking_effort":
            return True
        # ``reasoning_always_on`` fires on paired ``<think>...</think>`` anywhere in the
        # template, including markup that only renders PAST assistant history (Kimi-K2-Thinking)
        # while the generation prompt opens none. Prefill only when the generation prompt opens
        # one, else the extractor captures a normal answer as reasoning_content and returns blank.
        return _generation_prompt_opens_think(tpl)
    if not features.get("supports_reasoning"):
        return False
    if enable_thinking is False:
        return False
    # Thinking-off arrives as reasoning_effort "none" on enable_thinking_effort models; honor it
    # so we don't prefill and capture the answer. Plain enable_thinking models ignore effort.
    if features.get("reasoning_style") == "enable_thinking_effort" and reasoning_effort == "none":
        return False
    return True


def _effective_enable_tools(payload) -> Optional[bool]:
    """Resolve `payload.enable_tools` against the process-level tool policy.

    Returns the policy value when set (CLI hard-override from `unsloth run`),
    else the per-request value, else the launcher's default (tools on) for a
    request that never mentions tools. An explicit `enable_tools: false` is the
    caller asking for no tools, so it wins over that default -- only the
    `--enable-tools` override outranks it.
    """
    from state.tool_policy import get_tool_policy, get_tool_policy_default

    policy = get_tool_policy()
    if policy is not None:
        return policy
    if payload.enable_tools is None:
        return get_tool_policy_default()
    return payload.enable_tools


def _tools_on_by_launcher_default_only(payload) -> bool:
    """True when tools are on ONLY because of the launcher's tools-on default:
    no CLI override is installed and the request itself asked for nothing."""
    from state.tool_policy import get_tool_policy
    return (
        get_tool_policy() is None
        and payload.enable_tools is None
        and not getattr(payload, "mcp_enabled", False)
    )


def _request_states_tool_intent(payload) -> bool:
    """True when a request states its own tool intent through the standard
    OpenAI fields: a `tool_choice: "none"` withdrawal, its own tool catalog,
    tool-result history to continue, or a `response_format` contract the tool
    loop would break. Such a request did not omit the question, so the launcher
    default must not answer it.

    Mirrors what `_takes_tool_passthrough` already withholds from the policy on
    the GGUF router, including its `bool(payload.tools)` reading of the catalog:
    an empty `tools: []` reads the same as an omitted one on both paths."""
    if getattr(payload, "tool_choice", None) == "none":
        return True
    if payload.tools:
        return True
    if _extract_response_format(payload) is not None:
        return True
    return any(m.role == "tool" or m.tool_calls for m in payload.messages)


def _explicit_studio_tool_loop_requested(payload) -> bool:
    """True when the request itself asks Unsloth to execute local tools.

    Process-wide CLI policy can default Unsloth's tool loop on for ordinary chat,
    but it must not steal OpenAI-compatible client tools or response_format
    requests from the llama-server passthrough path. A policy of ``False``
    (--disable-tools) vetoes even an explicit ``enable_tools: true`` ask.
    """
    from state.tool_policy import get_tool_policy

    policy = get_tool_policy()
    return policy is not False and (payload.enable_tools is True or bool(payload.mcp_enabled))


def _selects_only_provider_hosted_tools(payload, provider_type: str | None) -> bool:
    """True when the request's tool selection is nothing but the provider's own
    hosted builtins, so the provider must execute them as it always has.

    ``enable_tools: true`` plus ``enabled_tools: ["web_search", ...]`` is the
    documented way to ask a provider for its hosted tools, and it is what every
    bundle shipped before Studio's loop reached external providers. Read only by
    name, the same bytes now also describe a local-loop request, and taking the
    loop would swap the provider's search for Studio's and silently drop the
    hosted-only names (code_execution, image_generation, web_fetch) that Studio
    has no implementation of.

    Anything that names a Studio-only tool (python, terminal,
    search_knowledge_base) or asks for MCP is unambiguous and keeps the loop, and
    so does every self-hosted provider, which declares no hosted tools at all.
    """
    if getattr(payload, "mcp_enabled", False):
        return False
    enabled = getattr(payload, "enabled_tools", None)
    # None means "every local tool"; an empty list selects nothing and never
    # reaches the loop anyway. Neither is a hosted-tool request.
    if not enabled or not isinstance(enabled, list):
        return False
    if not provider_hosted_tools(provider_type):
        return False
    # Matched against the whole hosted vocabulary rather than this provider's own
    # slice: the pre-PR bundle sent one list of hosted names per turn, and a name
    # the provider does not implement was simply ignored by it. Studio has no
    # local implementation of those names either, so reading such a request as
    # "local" would drop them just the same, only after also replacing the
    # provider's search with ours.
    if not all(isinstance(name, str) and name in HOSTED_TOOL_NAMES for name in enabled):
        return False
    # run_tools_locally only decides the ambiguous names, the ones Studio can
    # also run itself. A selection with no SELECTED local stand-in stays hosted
    # whatever the flag says: honouring it would enter the loop, find an empty
    # catalog, fall back to the same passthrough, and skip the confirmation
    # rejection on the way.
    if getattr(payload, "run_tools_locally", None) is True:
        # Intersected with the selection, as hosted_only_tools does: code_execution
        # maps to python/terminal, but naming it alone selects neither.
        selected = {name for name in enabled if isinstance(name, str)}
        return not any(
            LOCAL_STANDINS_FOR_HOSTED_TOOLS.get(name, frozenset()) & selected for name in selected
        )
    return True


def _takes_tool_passthrough(payload, llama_backend) -> bool:
    """True when a GGUF request is forwarded to llama-server verbatim.

    The passthrough sends the caller's own tools, no built-in schema and no nudge, so the counter
    must decide this BEFORE applying the process tool policy: `unsloth run --enable-tools` sets
    that policy without asking for the tool loop, so its catalog would price a prompt never sent.
    """
    supports_tools = getattr(llama_backend, "supports_tools", False)
    if supports_tools and _explicit_studio_tool_loop_requested(payload):
        return False
    # Read defensively: a count request carries no tool_choice, and absent withdraws nothing.
    has_client_contract = (
        bool(payload.tools) and getattr(payload, "tool_choice", None) != "none"
    ) or _has_openai_tool_history(payload.messages)
    supports_passthrough = getattr(llama_backend, "supports_tool_passthrough", supports_tools)
    if supports_passthrough and has_client_contract:
        return True
    return _extract_response_format(payload) is not None


def _passthrough_client_tools(payload):
    """The caller's own tool catalog exactly as the passthrough puts it on the wire.

    ``tool_choice: "none"`` withdraws it, unless tool history needs those schemas to replay.
    /apply-template renders any ``tools`` regardless of tool_choice, so the counter shares the rule.
    """
    if getattr(payload, "tool_choice", None) == "none" and not _has_openai_tool_history(
        payload.messages
    ):
        return None
    return payload.tools or None


def _permission_mode_confirm(payload) -> bool:
    """Effective confirm-gate intent for Unsloth's own local tool loop.

    An explicit confirm_tool_calls (True or False) wins; explicit ask/auto always
    engage the gate (a non-streaming one is then rejected, since it cannot prompt);
    off/full never prompt. An unset mode stays lenient here even though the loop
    defaults it to "auto": a non-streaming request keeps the legacy
    run-without-gate behavior instead of 400ing, so non-streaming clients and
    health checks keep working. Used at the pre-switch guard and the per-backend
    tool paths so a forced tool loop (CLI --enable-tools) still gates streaming.
    """
    if payload.confirm_tool_calls is not None:
        return bool(payload.confirm_tool_calls)
    mode = getattr(payload, "permission_mode", None)
    if mode in ("ask", "auto"):
        return True
    if mode in ("off", "full"):
        return False
    return bool(getattr(payload, "stream", False))


def _confirm_gate_needs_stream(payload) -> bool:
    """Whether Unsloth's local tool-loop confirm gate still requires stream=true.

    The gate can only prompt while streaming, so a non-streaming request that will
    prompt must 400 up front. auto ("Approve for me") only prompts for a call the
    classifier flags, so an auto request whose confirm is derived from the mode
    (not an explicit confirm_tool_calls=true) and whose selectable tools are all
    always-safe (web_search / RAG) never prompts and needs no stream. ask,
    an explicit confirm flag, MCP tools, and an unrestricted or unsafe selection
    still require streaming.
    """
    if not _permission_mode_confirm(payload):
        return False
    if getattr(payload, "permission_mode", None) != "auto":
        return True
    if payload.confirm_tool_calls is True:
        return True
    if getattr(payload, "mcp_enabled", False):
        return True
    enabled = getattr(payload, "enabled_tools", None)
    if enabled is None:
        return True  # omitted enabled_tools resolves to ALL tools (incl. terminal/python)
    if not enabled:
        # An explicit empty selection runs no built-in tool (_select_request_tools
        # skips the loop), so there is nothing to prompt and no stream is needed.
        return False
    from core.inference.tools import is_always_safe_tool

    # web_search prompts once the model supplies a ``url`` (it fetches that page), and the
    # gate can only prompt while streaming. Without this a non-streaming auto request is
    # admitted, then blocks in wait_tool_decision on an approval the client never reads.
    return not all(is_always_safe_tool(t) and t != "web_search" for t in enabled)


# Cancel registry. Proxies (e.g. Colab) can swallow client fetch aborts so
# is_disconnected() never fires. POST /inference/cancel looks up in-flight
# cancel_events here by cancel_id (per-run) or session_id / completion_id
# (fallbacks).
_CANCEL_REGISTRY: dict[str, set[threading.Event]] = {}
_CANCEL_LOCK = threading.Lock()

# Cancel POSTs arriving before registration are stashed; the next matching
# __enter__ replays set() within the TTL.
_PENDING_CANCELS: dict[str, float] = {}
_PENDING_CANCEL_TTL_S = 30.0


def _prune_pending(now: float) -> None:
    for k in [k for k, ts in _PENDING_CANCELS.items() if now - ts > _PENDING_CANCEL_TTL_S]:
        _PENDING_CANCELS.pop(k, None)


class _TrackedCancel:
    """Register cancel_event in _CANCEL_REGISTRY for the block's duration.

    Also records the run in state.active_generations so /load and /unload can
    see which chats a reload would interrupt. Both registries share this event,
    so either one cancels down the same per-request path.
    """

    def __init__(
        self,
        event: threading.Event,
        *keys,
        thread_id = None,
        model = None,
        kind = "chat",
    ):
        self.event = event
        self.keys = tuple(k for k in keys if k)
        # kind reaches the swap prompt: embeddings and raw completions have no conversation, so
        # naming them chats would offer to stop something the user never started from a thread.
        self._active = active_generations.ActiveGeneration(
            event, thread_id = thread_id, model = model, kind = kind
        )

    @classmethod
    def for_payload(cls, event: threading.Event, payload, *keys):
        """Track the run against the conversation its request names."""
        return cls(
            event,
            *keys,
            thread_id = getattr(payload, "thread_id", None),
            model = getattr(payload, "model", None),
        )

    def __enter__(self):
        # Register + consume-pending in one critical section to close the
        # TOCTOU race against a concurrent cancel POST.
        should_cancel = False
        with _CANCEL_LOCK:
            for k in self.keys:
                _CANCEL_REGISTRY.setdefault(k, set()).add(self.event)
            now = time.monotonic()
            _prune_pending(now)
            for k in self.keys:
                if k and _PENDING_CANCELS.pop(k, None) is not None:
                    should_cancel = True
        self._active.__enter__()
        if should_cancel:
            self.event.set()
        return self.event

    def __exit__(self, *exc):
        with _CANCEL_LOCK:
            for k in self.keys:
                bucket = _CANCEL_REGISTRY.get(k)
                if bucket is None:
                    continue
                bucket.discard(self.event)
                if not bucket:
                    _CANCEL_REGISTRY.pop(k, None)
        self._active.__exit__(*exc)
        return False


def _cancel_by_keys(keys) -> int:
    """Set cancel_event for matching registry entries; no stash.
    session_id/completion_id are shared across runs on the same thread, so
    stashing them would ghost-cancel the user's next request. Only cancel_id
    is per-run unique (see _cancel_by_cancel_id_or_stash)."""
    if not keys:
        return 0
    events: set[threading.Event] = set()
    with _CANCEL_LOCK:
        _prune_pending(time.monotonic())
        for k in keys:
            bucket = _CANCEL_REGISTRY.get(k)
            if bucket:
                events.update(bucket)
    for ev in events:
        ev.set()
    return len(events)


def _cancel_by_cancel_id_or_stash(cancel_id: str) -> int:
    """Atomic lookup-or-stash; pairs with _TrackedCancel.__enter__ to
    close the TOCTOU race."""
    now = time.monotonic()
    events: set[threading.Event] = set()
    with _CANCEL_LOCK:
        _prune_pending(now)
        bucket = _CANCEL_REGISTRY.get(cancel_id)
        if bucket:
            events.update(bucket)
        else:
            _PENDING_CANCELS[cancel_id] = now
    for ev in events:
        ev.set()
    return len(events)


async def _await_cancel_then_close(cancel_event, resp) -> None:
    """Watch a threading.Event from asyncio and close ``resp`` when it fires.

    Used by passthrough streamers so a /cancel POST can interrupt while the
    async iterator is blocked on llama-server prefill. Without it the in-loop
    ``cancel_event.is_set()`` check is unreachable until the first SSE chunk
    arrives -- exactly the proxy/Colab case the cancel POST exists for.

    Polls a threading.Event since the cancel registry is keyed by
    threading.Event (so the sync /cancel handler can call .set()). The 50ms
    cadence adds at most that latency to a prefill cancel; the common
    streaming-cancel path still sees the event on the iterator's next chunk.
    """
    try:
        while not cancel_event.is_set():
            await asyncio.sleep(0.05)
        try:
            await resp.aclose()
        except Exception:
            pass
    except asyncio.CancelledError:
        return


async def _await_disconnect_then_close(request, resp, cancel_event) -> None:
    """Close ``resp`` on client disconnect; sets ``cancel_event`` first so
    the streamer's RemoteProtocolError handler treats it as cancellation.
    Catches aborts the in-loop /cancel check misses during prefill. #5692.
    """
    try:
        while not await request.is_disconnected():
            await asyncio.sleep(0.1)
        cancel_event.set()
        try:
            await resp.aclose()
        except Exception as e:
            logger.debug("Failed to close response on disconnect: %s", e)
    except asyncio.CancelledError:
        return


async def _await_disconnect_then_cancel(request, cancel_event) -> None:
    """Set ``cancel_event`` when a same-task local stream disconnects."""
    try:
        while not await request.is_disconnected():
            await asyncio.sleep(0.1)
        cancel_event.set()
    except asyncio.CancelledError:
        return


async def _await_stt_disconnect_then_cancel(request, sidecar, cancel_event) -> None:
    """Cancel this sidecar request, including a model load still starting."""
    try:
        while not await request.is_disconnected():
            await asyncio.sleep(0.1)
        await asyncio.to_thread(sidecar.cancel_transcription, cancel_event)
    except asyncio.CancelledError:
        return


def _cancelable_nonstreaming_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(
        limits = httpx.Limits(max_connections = 1, max_keepalive_connections = 0),
        trust_env = False,
    )


async def _await_cancel_or_disconnect_then_close_client(
    *, cancel_event, request: Optional[Request], client: httpx.AsyncClient
) -> None:
    """Close a dedicated non-streaming upstream client on cancel/disconnect.

    The shared ``nonstreaming_client()`` is pooled, so cancelable generation calls
    use a per-request client. Closing it interrupts a blocked llama-server
    request without affecting unrelated pooled non-streaming calls.
    """
    try:
        while True:
            if cancel_event is not None and cancel_event.is_set():
                break
            if request is not None and await request.is_disconnected():
                if cancel_event is not None:
                    cancel_event.set()
                break
            await asyncio.sleep(0.1)
        try:
            await client.aclose()
        except Exception:
            pass
    except asyncio.CancelledError:
        return


async def _stop_local_disconnect_cancel_watcher(
    watcher, timeout_s: float = _TEARDOWN_TASK_STOP_TIMEOUT_S
) -> None:
    # Bounded: this runs in the stream's finally, so awaiting the watcher outright would let a
    # wedged poll loop hold the response open forever. asyncio.wait neither cancels nor re-raises,
    # and an abandoned watcher owns no resources.
    watcher.cancel()
    done, _pending = await asyncio.wait({watcher}, timeout = timeout_s)
    if not done:
        # _wait_preheader_cancel has no exception handler, so a raise after we stop
        # waiting would surface as "Task exception was never retrieved".
        watcher.add_done_callback(_discard_task_outcome)
        return
    try:
        watcher.result()
    except (asyncio.CancelledError, Exception):
        pass


async def _drain_pending_next_task(task, cancel_event) -> None:
    """Wait for a pending ``asyncio.to_thread(next, gen, ...)`` task to finish
    before its generator is closed.

    On disconnect a ``next(gen)`` call may still run in a worker thread;
    cancelling the awaiting task does NOT stop it, and ``gen.close()`` mid-
    ``next(gen)`` raises ``ValueError: generator already executing``, leaking the
    generator's cleanup. So re-set the cancel flag (the generator polls it) and
    shield the task until the worker returns. No-op when there is no pending task.
    """
    if task is None:
        return
    if cancel_event is not None:
        cancel_event.set()
    while not task.done():
        try:
            await asyncio.shield(task)
        except asyncio.CancelledError:
            if cancel_event is not None:
                cancel_event.set()
            continue
        except Exception:
            break
    if task.done():
        try:
            task.exception()
        except (asyncio.CancelledError, Exception):
            pass


# Centralized local/server tool nudge. Keep render_html guidance gated to turns
# where the canvas tool is actually present in the tool schema; otherwise
# small local models can hallucinate a missing tool call instead of following
# the fenced-HTML fallback prompt.
_TOOL_BASE_NUDGE = (
    "Tools are available when they materially improve the answer. Use an enabled "
    "tool for current facts, calculations, code execution, or canvases when it "
    "materially helps; otherwise answer normally and follow the user's requested "
    "format."
)
_TOOL_WEB_COMPACT_TIP = "When using web_search, do not repeat the same search query."
_TOOL_WEB_EXPANDED_TIP = (
    "When using web_search and a result URL is relevant, fetch its full content "
    "by calling web_search with the url parameter. Do not repeat the same search "
    "query. If a search returns no useful results, try rephrasing or fetching a "
    "result URL directly."
)
_TOOL_CODE_TIP = (
    "Use code execution for math, calculations, data processing, or to parse "
    "and analyze information from tool results."
)
# Full access only, and only alongside python/terminal. The schemas alone do not
# undo the model's prior: asked "can you see the files on my laptop" it answers
# "no, I am sandboxed" from training data rather than reading its own tool list,
# so the environment is stated outright and the guess sent to a tool call.
# Fixed order so the sentence reads the same whichever way the caller listed them.
_LOCAL_CODE_TOOLS = ("python", "terminal", "edit_file")


def _full_access_tip(code_tools: list[str]) -> str:
    """The Full access sentence, naming only the code tools actually selected.

    enabled_tools=["python"] leaves terminal out of the request's schemas, so
    naming it here would advertise a tool the loop would refuse to run.
    """
    if len(code_tools) == 1:
        subject = f"The {code_tools[0]} tool runs"
    else:
        # Three names now, so only the last pair takes the "and".
        subject = "The " + ", ".join(code_tools[:-1]) + f" and {code_tools[-1]} tools run"
    return (
        subject + " where Unsloth Studio is running, with the code sandbox and the "
        "approval prompts disabled, so you can inspect and change whatever that "
        "process can reach. That is not necessarily the device the user is viewing "
        "this on, and it may be a remote host or a container that mounts only some "
        "of its host's paths. When asked what you can see or do, check with a tool "
        "call rather than assuming you are isolated from it, and report what the "
        "call actually returned rather than what a whole machine would hold."
    )


_TOOL_ARTIFACT_TIP = (
    "For HTML, CSS, or JavaScript canvas requests, call render_html once when "
    "it is available with one complete self-contained HTML document in the code "
    "argument. After render_html succeeds, do not call it again in the same "
    "response unless the user asks for changes. Future user requests for new "
    "canvases may call render_html once."
)


def _get_current_datetime_string() -> str:
    """Return a formatted string representing the current local date, time, weekday, and timezone."""
    now = _datetime.now().astimezone()
    weekday_name = now.strftime("%A")
    tz_name = now.tzname() or ""
    offset = now.strftime("%z")
    formatted_offset = f"UTC{offset[:3]}:{offset[3:]}" if offset else ""
    return f"The current local date and time is {now.strftime('%Y-%m-%d %H:%M:%S')} ({weekday_name}, {tz_name} {formatted_offset})."


def _build_tool_action_nudge(
    *,
    tools: list[dict],
    model_name: str,
    full_access: bool = False,
    full_access_only: bool = False,
) -> str:
    """``full_access_only`` returns the Full access sentence alone, for a caller
    that wants to state the environment without also introducing the general
    tool guidance (and the date) to a path that has never carried it."""
    tool_names = {
        (tool.get("function") or {}).get("name")
        for tool in tools
        if isinstance(tool, dict) and isinstance(tool.get("function"), dict)
    }
    has_web = "web_search" in tool_names
    code_tools = [name for name in _LOCAL_CODE_TOOLS if name in tool_names]
    has_code = bool(code_tools)
    has_artifact = "render_html" in tool_names
    datetime_str = _get_current_datetime_string()
    if not (has_web or has_code or has_artifact):
        return datetime_str
    if full_access_only:
        return _full_access_tip(code_tools) if (full_access and has_code) else ""

    model_size_b = _extract_model_size_b(model_name)
    compact_web_tip = model_size_b is not None and model_size_b < 9
    tool_tip_parts: list[str] = []
    if has_web:
        tool_tip_parts.append(_TOOL_WEB_COMPACT_TIP if compact_web_tip else _TOOL_WEB_EXPANDED_TIP)
    if has_code:
        tool_tip_parts.append(_TOOL_CODE_TIP)
        if full_access:
            tool_tip_parts.append(_full_access_tip(code_tools))
    if has_artifact:
        tool_tip_parts.append(_TOOL_ARTIFACT_TIP)
    return (
        f"{datetime_str} "
        + _TOOL_BASE_NUDGE
        + " "
        + " ".join(tool_tip_parts)
    )


# Nudge appended when the RAG knowledge-base tool is active: ground answers in
# the attached documents instead of model memory.
_RAG_GROUNDING_NUDGE = (
    "The user has attached documents to this conversation. Relevant "
    "passages are retrieved and provided to you automatically; base "
    "your answer on them and cite them. You can also call "
    "search_knowledge_base to look for more. Do not answer from "
    "memory when the attached documents are relevant."
)


async def _select_request_tools(
    payload: ChatCompletionRequest, *, tools_on: bool, mcp_allowed: bool
) -> list[dict]:
    """Resolve the tool list for a chat request: built-ins filtered by the
    caller's opt-in (empty when MCP-only), the RAG tool dropped without a
    retrieval scope, then enabled MCP tools appended. An empty result means the
    caller should skip the tool loop, so a model-emitted built-in call can't
    piggy-back on the empty allow-list.

    Under Full access the python/terminal schemas are swapped for the ones that
    describe the unsandboxed run, since that is what the loop actually does
    (disable_sandbox = bypass_permissions)."""
    from core.inference.tools import (
        ALL_TOOLS,
        apply_full_access_tool_descriptions,
        get_enabled_mcp_tools,
    )

    if not tools_on:
        # MCP-only request: skip built-ins, leave room for MCP tools.
        tools = []
    elif payload.enabled_tools is not None:
        tools = [t for t in ALL_TOOLS if t["function"]["name"] in payload.enabled_tools]
    else:
        # Copy so the shared module-global tool list can't be mutated by callers.
        tools = list(ALL_TOOLS)
    # Drop the RAG tool without a scope: nothing to search over.
    if not payload.rag_scope:
        tools = [t for t in tools if t["function"]["name"] != "search_knowledge_base"]
    # Built-ins only, so this runs before the MCP append: an MCP tool's
    # description is the server's to write, and Full access says nothing about
    # how that server runs.
    if payload.bypass_permissions:
        tools = apply_full_access_tool_descriptions(tools)
    if mcp_allowed:
        tools = tools + await get_enabled_mcp_tools()
    return tools


def _apply_rag_nudge(nudge: str, tools: list[dict], *, rag_scope) -> str:
    """Append the RAG grounding nudge to ``nudge`` when the knowledge-base tool
    is active (search_knowledge_base present and a retrieval scope is set). The
    date is prefixed when the tool nudge is empty (RAG-only tool set). Returns
    ``nudge`` unchanged when RAG isn't active."""
    tool_names = {(t.get("function") or {}).get("name") for t in (tools or [])}
    if "search_knowledge_base" not in tool_names or not rag_scope:
        return nudge
    if not nudge:
        date_line = _get_current_datetime_string()
        return date_line + " " + _RAG_GROUNDING_NUDGE
    return nudge + " " + _RAG_GROUNDING_NUDGE


# Strip leaked tool-call markup: every shared-parser format plus the leak shapes
# llama_cpp.py's speculative buffer splits across the visible/DRAIN boundary:
#   1. well-formed `<tool_call>...</tool_call>` / `<function=...>...</function>`
#   2. orphan opening to EOF (close was DRAINED)
#   3. bare orphan close (open was DRAINED)
#   4. tail-only `</parameter>` (outer close truncated by EOS); anchored to
#      `\Z` so mid-text `<parameter>` in user code samples survives.
#   5. Mistral `[TOOL_CALLS]name{json}` / rehearsal `name[ARGS]{json}`: the balanced
#      scan removes the whole call (a non-greedy regex would truncate nested JSON).
# DeepSeek/GLM/Kimi envelopes are covered by the parser's own arms/scans, so a signal
# we parse is never left un-stripped; the DeepSeek opener alternation is the parser's own.
from core.inference.tool_call_parser import _DEEPSEEK_OPEN_RE_SRC as _DS_OPEN_SRC

_TOOL_XML_RE = _re.compile(
    # Arm order/notes: the closed ``<function=...>`` arm runs first and extends
    # to the call's REAL close so a literal ``</function>`` in a value does not
    # leak the tail; the combined arm still catches ``<tool_call>`` and orphan
    # tails. The python_tag arm bounds only on REAL Llama control sentinels
    # (stopping at any ``<|`` truncated on literal ``<|x|>`` tokens in values).
    # The last arms cover DeepSeek envelopes (all opener variants), Kimi section
    # blocks, and bare Kimi calls. Name class ``[\w.\-]`` mirrors the parser.
    # Those three arms carry a call-shaped lookahead (matching the parser's
    # ``_TOOL_ALL_PATS``): a prose answer that merely mentions a marker
    # (``See <|tool_call_begin|> in the docs``) is only stripped when a real
    # call actually follows the marker, or the marker is a bare fragment at EOF.
    r'<function(?:=[\w.\-]+|\s+name="[\w.\-]+")>(?:(?!<function(?:=[\w.\-]+|\s+name="[\w.\-]+")>).)*</function>'
    r'|<(?:tool_call|function(?:=[\w.\-]+|\s+name="[\w.\-]+"))>.*?(?:</(?:tool_call|function)>|\Z)'
    r"|<\|tool_call>.*?(?:<tool_call\|>|\Z)"
    r"|</(?:tool_call|function)>"
    r"|<tool_call\|>"
    r"|<\|python_tag\|>(?:[^<]|<(?!\|(?:eot_id|eom_id|python_tag|start_header_id|end_header_id|begin_of_text|finetune_right_pad_id)\|))*"
    r"|\[/TOOL_CALLS\]"
    # Truncated canonical array (closing ``]`` lost to EOS): the balanced scan cannot remove
    # it, so strip its tail here.
    r"|\[TOOL_CALLS\]\s*\[.*\Z"
    # Named / v11 forms and bare rehearsal; arms aligned with the parser regexes.
    r"|\[TOOL_CALLS\]\s*[\w-]+(?:\[CALL_ID\][\w-]+)?(?:\[ARGS\])?\s*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|.*?\Z)"
    # Rehearsal: balanced/truncated body or bare marker at EOS only (prose ``foo[ARGS]``
    # survives); NAME captured as ``reh`` for the inactive-name display gate.
    r"|(?<!\[CALL_ID\])\b(?P<reh>[\w-]+)\[ARGS\]\s*(?:\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}|\{.*\Z|\Z)"
    # DeepSeek envelopes (all opener variants), Kimi section blocks, and bare Kimi calls;
    # each arm carries a call-shaped lookahead so prose merely mentioning a marker survives.
    r"|"
    + _DS_OPEN_SRC
    + r"(?=\s*(?:<｜tool▁call▁begin｜>|function)|\s*$).*?(?:<｜tool▁calls▁end｜>|\Z)"
    r"|<\|tool_calls_section_begin\|>(?=\s*<\|tool_call_begin\|>|\s*$).*?(?:<\|tool_calls_section_end\|>|\Z)"
    r"|<\|tool_call_begin\|>(?=\s*[A-Za-z_][\w.\-]*:\d|\s*$).*?(?:<\|tool_call_end\|>|\Z)"
    # ``</param>`` is the attribute-form alias of ``</parameter>`` (the parser accepts
    # both); strip a tail-only orphan close of either spelling.
    r"|</(?:parameter|param)>\s*\Z",
    _re.DOTALL,
)

# Closed-only variant for segments before the last think block: the ``\Z``-anchored arms
# would treat a segment boundary as EOS and strip prose ``foo[ARGS]``.
_TOOL_XML_CLOSED_RE = _re.compile(
    r"<(?:tool_call|function=[\w-]+)>.*?</(?:tool_call|function)>"
    r"|<\|tool_call>.*?<tool_call\|>"
    r"|</(?:tool_call|function)>"
    r"|<tool_call\|>"
    r"|\[/TOOL_CALLS\]",
    _re.DOTALL,
)


def _gemma_strip_gate(tools) -> set:
    """Enabled tool NAMES gating the wrapper-less Gemma strip (mirrors the
    parser/loop gate: only an enabled ``call:foo{...}`` is a call). With NO tools
    enabled this returns an EMPTY set, not ``None``: every ``call:NAME{...}`` is
    then prose, and ``None`` would strip-all and delete a legitimate answer."""
    names = {
        (t.get("function") or {}).get("name")
        for t in (tools or [])
        if isinstance(t, dict) and isinstance(t.get("function"), dict)
    }
    names.discard(None)
    return names


def _display_tool_name_gate(active_tools):
    """Active tool NAMES for gating the rehearsal display strip, or None when no tools
    are enabled. ``None`` keeps the legacy strip-all behavior, mirroring the loop gate:
    a bare ``NAME[ARGS]`` is a call only when NAME is active; without a tool list every
    identifier stays ambiguous, so strip."""
    names = {
        (t.get("function") or {}).get("name")
        for t in (active_tools or [])
        if isinstance(t, dict) and isinstance(t.get("function"), dict)
    }
    names.discard(None)
    return names or None


def _strip_tool_xml_for_display(
    text: str,
    *,
    auto_heal_tool_calls: bool,
    enabled_tool_names: Optional[set] = None,
) -> str:
    """Apply route-level XML leak cleanup only when Auto-Heal is enabled.

    Mirrors the parser-side segment scan: balanced strips first (Mistral, gated Gemma
    wrapper-less, GLM real-close, guarded function-XML close at each call's REAL terminator
    so literal markup inside a value is data), then the ``_TOOL_XML_RE`` arms cover the
    DeepSeek / Kimi / orphan forms. ``<think>`` blocks are preserved verbatim and the
    ``\\Z``-anchored tail arms run only on the last segment (prose ``foo[ARGS]`` before a
    block survives). ``enabled_tool_names`` (when not None) gates the ambiguous bare-rehearsal
    ``NAME[ARGS]{...}`` and wrapper-less Gemma ``call:NAME{...}`` strips on the active tool
    list; an inactive NAME is prose and is kept. The ``[TOOL_CALLS]`` control-token arms strip
    unconditionally regardless of NAME."""
    if not auto_heal_tool_calls:
        return text
    from core.tool_healing import _strip_bracket_tag_calls, strip_outside_think

    def _keep_inactive_rehearsal(m) -> str:
        # Only the bare-rehearsal arm captures ``reh``; with a tool list an inactive
        # NAME[ARGS]{...} is prose -- keep it.
        if enabled_tool_names is not None:
            name = m.groupdict().get("reh")
            if name is not None and name not in enabled_tool_names:
                return m.group(0)
        return ""

    def _strip_segment(seg: str, is_last: bool) -> str:
        # Scan strips close at each call's REAL terminator (a literal ``</function>`` or a
        # nested marker quoted inside a value cannot truncate the strip); the regex arms below
        # cover the attribute form and the DeepSeek / Kimi / orphan families.
        seg = _strip_mistral_closed_calls(seg)
        seg = _strip_bracket_tag_calls(seg, enabled_tool_names = enabled_tool_names)
        if is_last:
            seg = _strip_gemma_wrapperless_calls(seg, enabled_tool_names)
        seg = _strip_glm_calls(seg, final = is_last)
        seg = _strip_function_xml_calls(seg, final = is_last)
        if is_last:
            return _TOOL_XML_RE.sub(_keep_inactive_rehearsal, seg)
        return _TOOL_XML_CLOSED_RE.sub("", seg)

    return strip_outside_think(text, _strip_segment)


def _strip_tool_xml(text: str, enabled_tool_names: Optional[set] = None) -> str:
    # Mistral balanced-brace pre-strip (kept explicit so the regression guards see it), then
    # the shared think-aware display strip -- the one raw _TOOL_XML_RE.sub lives inside
    # _strip_tool_xml_for_display, so every route cleanup site shares it. ``enabled_tool_names``
    # gates the Gemma wrapper-less strip; ``None`` strips every closed call.
    text = _strip_mistral_closed_calls(text)
    return _strip_tool_xml_for_display(
        text, auto_heal_tool_calls = True, enabled_tool_names = enabled_tool_names
    )


logger = get_logger(__name__)


def _monitor_content_text(content) -> str:
    if content is None:
        return ""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for part in content:
            if isinstance(part, dict):
                ptype = part.get("type")
                if ptype in ("text", "input_text", "output_text"):
                    text = part.get("text")
                    if isinstance(text, str):
                        parts.append(text)
                elif ptype in ("image_url", "input_image", "image"):
                    parts.append("[image]")
                else:
                    parts.append(f"[{ptype or 'content'}]")
            else:
                ptype = getattr(part, "type", None)
                text = getattr(part, "text", None)
                if isinstance(text, str):
                    parts.append(text)
                elif ptype in ("image_url", "input_image", "image"):
                    parts.append("[image]")
                elif ptype:
                    parts.append(f"[{ptype}]")
        return "\n".join(parts)
    return str(content)


def _monitor_prompt_from_messages(messages) -> str:
    lines: list[str] = []
    for msg in messages or []:
        role = msg.get("role") if isinstance(msg, dict) else getattr(msg, "role", "")
        content = msg.get("content") if isinstance(msg, dict) else getattr(msg, "content", "")
        tool_calls = (
            msg.get("tool_calls") if isinstance(msg, dict) else getattr(msg, "tool_calls", None)
        )
        text = _monitor_content_text(content)
        if tool_calls and not text:
            text = "[tool calls]"
        if text:
            lines.append(f"{role or 'message'}: {text}")
    return "\n\n".join(lines)


# A wrapper route (Responses) suppresses the inner chat handler's monitor row, dropping the
# engine timings computed inside it: ChatCompletion has no timings field, so they cannot be read
# back off the serialized body. The wrapper leaves a dict here for the inner call to fill. A dict
# because a context is copied into tasks and threads: writes do not flow back up, mutations do.
_monitor_perf_sink: contextvars.ContextVar[Optional[dict]] = contextvars.ContextVar(
    "unsloth_monitor_perf_sink",
    default = None,
)


def _monitor_usage(
    monitor_id: Optional[str],
    usage: Optional[dict],
    context_length = None,
    *,
    timings: Optional[dict] = None,
    stop_reason: Optional[str] = None,
):
    # Only a suppressed row relays: a call with its own row must not clobber the wrapper's.
    if not monitor_id and isinstance(timings, dict) and timings:
        sink = _monitor_perf_sink.get()
        if sink is not None:
            sink["timings"] = timings
            outer_monitor_id = sink.get("monitor_id")
            if outer_monitor_id:
                _monitor_usage(
                    outer_monitor_id,
                    None,
                    sink.get("context_length"),
                    timings = timings,
                )
    # isinstance, not truthiness: a non-dict usage would raise on .get() into the
    # streaming generator and abort the user's response.
    if isinstance(usage, dict) and usage:
        api_monitor.set_usage(
            monitor_id,
            prompt_tokens = usage.get("prompt_tokens") or usage.get("input_tokens"),
            completion_tokens = usage.get("completion_tokens") or usage.get("output_tokens"),
            total_tokens = usage.get("total_tokens"),
            context_length = context_length,
        )
    tok_per_sec = prompt_tok_per_sec = prompt_ms = decode_ms = None
    if isinstance(timings, dict):
        tok_per_sec = timings.get("predicted_per_second")
        prompt_tok_per_sec = timings.get("prompt_per_second")
        prompt_ms = timings.get("prompt_ms")
        # The span the tile rates on: total tokens over total time, not a mean of per-request rates.
        decode_ms = timings.get("predicted_ms")
    if (
        tok_per_sec is not None
        or prompt_tok_per_sec is not None
        or prompt_ms is not None
        or decode_ms is not None
        or stop_reason is not None
    ):
        api_monitor.set_perf(
            monitor_id,
            tok_per_sec = tok_per_sec,
            prompt_tok_per_sec = prompt_tok_per_sec,
            prompt_ms = prompt_ms,
            decode_ms = decode_ms,
            stop_reason = stop_reason,
        )


def _monitor_perf_callback(monitor_id: Optional[str], context_length):
    """Build a timing sink only when a monitor row or wrapper sink can consume it."""
    if not monitor_id and _monitor_perf_sink.get() is None:
        return None

    def _callback(timings: dict) -> None:
        _monitor_usage(
            monitor_id,
            None,
            context_length,
            timings = timings,
        )

    return _callback


def _monitor_call_text(name: Any, arguments: Any = None) -> str:
    call_name = str(name or "tool")
    if arguments is None or arguments == "":
        return f"Tool call: {call_name}"
    if not isinstance(arguments, str):
        args_text = json.dumps(arguments, default = str)
    else:
        args_text = arguments
    if len(args_text) > 500:
        args_text = args_text[:497] + "..."
    return f"Tool call: {call_name}({args_text})"


def _monitor_tool_calls_text(tool_calls: Any) -> str:
    if not isinstance(tool_calls, list):
        return ""
    parts: list[str] = []
    for tool_call in tool_calls:
        if not isinstance(tool_call, dict):
            continue
        fn = tool_call.get("function") or {}
        if not isinstance(fn, dict):
            fn = {}
        name = fn.get("name") or tool_call.get("name") or "tool"
        args = fn.get("arguments")
        if args is None:
            args = tool_call.get("arguments")
        parts.append(_monitor_call_text(name, args))
    return "\n".join(parts)


def _monitor_openai_chunk(
    monitor_id: Optional[str],
    data: dict,
    context_length = None,
    streaming: bool = False,
):
    if not monitor_id:
        return
    # Defensive: ignore malformed shapes so the helper never raises into the
    # streaming generator and aborts the user's response.
    choices = data.get("choices")
    if isinstance(choices, list):
        # The row covers every choice, so one reason only describes the request when they
        # all agree. An n > 1 stream reports each choice in its own chunk, so the monitor
        # accumulates them across the request rather than judging a chunk in isolation.
        for choice in choices:
            if isinstance(choice, dict) and choice.get("finish_reason"):
                api_monitor.note_stop_reason(monitor_id, str(choice["finish_reason"]))
    timings = data.get("timings")
    _monitor_usage(
        monitor_id,
        data.get("usage"),
        context_length,
        timings = timings if isinstance(timings, dict) else None,
    )
    if not isinstance(choices, list) or not choices:
        return
    if isinstance(data, dict) and data.get("_toolEvent"):
        # Tool cards ride the chunk beside choices with an empty delta; already seen.
        # Not decoded output though: a tool run (or a human confirming one) between the
        # card and the first token would otherwise be counted as decoding time.
        api_monitor.mark_first_token(monitor_id, decoded = False)
    reply_parts: list[tuple[int, str]] = []
    for idx, choice in enumerate(choices):
        if not isinstance(choice, dict):
            continue
        delta = choice.get("delta") or {}
        message = choice.get("message") or {}
        if isinstance(delta, dict) and delta.get("reasoning_content"):
            api_monitor.mark_first_token(monitor_id)

        content = delta.get("content") if isinstance(delta, dict) else None
        if content:
            api_monitor.append_reply(monitor_id, content)
            continue
        if isinstance(delta, dict):
            tool_text = _monitor_tool_calls_text(delta.get("tool_calls"))
            if tool_text:
                api_monitor.append_reply(monitor_id, tool_text)
                continue
        if isinstance(choice.get("text"), str):
            reply_parts.append((idx, choice["text"]))
        elif isinstance(message, dict):
            text = message.get("content")
            if isinstance(text, str):
                reply_parts.append((idx, text))
            else:
                tool_text = _monitor_tool_calls_text(message.get("tool_calls"))
                if tool_text:
                    reply_parts.append((idx, tool_text))
    if not reply_parts:
        return
    if len(choices) == 1:
        api_monitor.append_reply(monitor_id, reply_parts[0][1], stamp_first_token = streaming)
        return
    api_monitor.append_reply(
        monitor_id,
        "\n\n".join(f"Choice {idx + 1}:\n{text}" for idx, text in reply_parts),
        stamp_first_token = streaming,
    )


def _monitor_openai_error_message(data: dict) -> Optional[str]:
    error = data.get("error")
    if isinstance(error, dict):
        message = error.get("message")
        if isinstance(message, str) and message:
            return message
        return json.dumps(error)
    if isinstance(error, str) and error:
        return error
    return None


def _is_openai_sse_done(raw_line: str) -> bool:
    """Whether the line is the terminal `data: [DONE]` frame.

    Deliberately independent of the monitor: framing the client sees must not
    change just because recording is off.
    """
    # SSE spec allows `data:value` and `data: value`; accept both.
    if not raw_line.startswith("data:"):
        return False
    return raw_line[5:].lstrip() == "[DONE]"


def _monitor_openai_sse_line(
    monitor_id: Optional[str],
    raw_line: str,
    context_length = None,
) -> Optional[str]:
    if not monitor_id:
        return None
    if not raw_line.startswith("data:"):
        return None
    data_str = raw_line[5:].lstrip()
    if data_str == "[DONE]":
        api_monitor.finish(monitor_id)
        return "done"
    try:
        data = json.loads(data_str)
    except json.JSONDecodeError:
        return None
    if isinstance(data, dict):
        error_message = _monitor_openai_error_message(data)
        if error_message:
            api_monitor.fail(monitor_id, error_message)
            return "error"
        _monitor_openai_chunk(monitor_id, data, context_length, streaming = True)
    return None


def _monitor_openai_sse_event(
    monitor_id: Optional[str],
    event: bytes,
    context_length = None,
) -> None:
    for line in event.decode("utf-8", errors = "ignore").splitlines():
        _monitor_openai_sse_line(monitor_id, line.strip(), context_length)


def _monitor_anthropic_usage(
    monitor_id: Optional[str],
    usage: Optional[dict],
    context_length = None,
) -> None:
    if not usage:
        return
    _monitor_usage(
        monitor_id,
        {
            "prompt_tokens": usage.get("input_tokens") or usage.get("prompt_tokens"),
            "completion_tokens": usage.get("output_tokens") or usage.get("completion_tokens"),
            "total_tokens": usage.get("total_tokens"),
        },
        context_length,
    )


_ANTHROPIC_MONITOR_TOOL_BLOCKS: dict[str, dict[int, bool]] = {}


def _monitor_anthropic_index(data: dict) -> int:
    try:
        return int(data.get("index") or 0)
    except (TypeError, ValueError):
        return 0


def _monitor_anthropic_payload(
    monitor_id: Optional[str],
    data: dict,
    context_length = None,
) -> Optional[str]:
    if not monitor_id or not isinstance(data, dict):
        return None
    event_type = data.get("type")
    if event_type == "message_start":
        message = data.get("message") or {}
        if isinstance(message, dict):
            _monitor_anthropic_usage(monitor_id, message.get("usage"), context_length)
        return None
    if event_type == "content_block_start":
        content_block = data.get("content_block") or {}
        if isinstance(content_block, dict) and content_block.get("type") == "tool_use":
            index = _monitor_anthropic_index(data)
            _ANTHROPIC_MONITOR_TOOL_BLOCKS.setdefault(monitor_id, {})[index] = False
            api_monitor.append_reply(monitor_id, _monitor_call_text(content_block.get("name")))
        return None
    if event_type == "content_block_delta":
        delta = data.get("delta") or {}
        text = delta.get("text") if isinstance(delta, dict) else None
        if isinstance(delta, dict) and delta.get("type") == "thinking_delta":
            api_monitor.mark_first_token(monitor_id)
        if isinstance(text, str) and text:
            api_monitor.append_reply(monitor_id, text)
        elif isinstance(delta, dict) and delta.get("type") == "input_json_delta":
            index = _monitor_anthropic_index(data)
            tool_blocks = _ANTHROPIC_MONITOR_TOOL_BLOCKS.get(monitor_id) or {}
            if index in tool_blocks:
                if not tool_blocks[index]:
                    api_monitor.append_reply(monitor_id, "\nInput: ")
                    tool_blocks[index] = True
                partial_json = delta.get("partial_json")
                if isinstance(partial_json, str) and partial_json:
                    api_monitor.append_reply(monitor_id, partial_json)
        return None
    if event_type == "content_block_stop":
        index = _monitor_anthropic_index(data)
        tool_blocks = _ANTHROPIC_MONITOR_TOOL_BLOCKS.get(monitor_id)
        if tool_blocks is not None:
            tool_blocks.pop(index, None)
            if not tool_blocks:
                _ANTHROPIC_MONITOR_TOOL_BLOCKS.pop(monitor_id, None)
        return None
    if event_type == "message_delta":
        delta = data.get("delta")
        if isinstance(delta, dict) and delta.get("stop_reason"):
            api_monitor.set_perf(monitor_id, stop_reason = str(delta["stop_reason"]))
        _monitor_anthropic_usage(monitor_id, data.get("usage"), context_length)
        return None
    if event_type == "error":
        error = data.get("error") or {}
        if isinstance(error, dict):
            message = error.get("message") or json.dumps(error, default = str)
        else:
            message = str(error)
        api_monitor.fail(monitor_id, message)
        return "error"
    return None


def _monitor_anthropic_sse_line(
    monitor_id: Optional[str],
    raw_line: str,
    context_length = None,
) -> Optional[str]:
    if not monitor_id or not raw_line.startswith("data:"):
        return None
    data_str = raw_line[5:].lstrip()
    try:
        data = json.loads(data_str)
    except json.JSONDecodeError:
        return None
    return _monitor_anthropic_payload(monitor_id, data, context_length)


def _monitor_anthropic_content_blocks(content: Any) -> str:
    if not isinstance(content, list):
        return ""
    parts: list[str] = []
    for block in content:
        if not isinstance(block, dict):
            continue
        if block.get("type") == "text" and isinstance(block.get("text"), str):
            parts.append(block["text"])
        elif block.get("type") == "tool_use":
            parts.append(_monitor_call_text(block.get("name"), block.get("input")))
    return "".join(parts)


def _monitor_anthropic_json_response(
    response,
    monitor_id: Optional[str],
    context_length = None,
) -> None:
    if not monitor_id:
        return
    body = getattr(response, "body", b"")
    try:
        data = json.loads(body.decode("utf-8") if isinstance(body, bytes) else body)
    except Exception:
        api_monitor.finish(monitor_id)
        return
    if not isinstance(data, dict):
        api_monitor.finish(monitor_id)
        return
    text = _monitor_anthropic_content_blocks(data.get("content"))
    if text:
        api_monitor.set_reply(monitor_id, text)
    if data.get("stop_reason"):
        api_monitor.set_perf(monitor_id, stop_reason = str(data["stop_reason"]))
    _monitor_anthropic_usage(monitor_id, data.get("usage"), context_length)
    api_monitor.finish(monitor_id)


def _monitor_anthropic_response(
    response,
    monitor_id,
    context_length = None,
    cancel_event = None,
):
    if not monitor_id:
        return response
    body_iterator = getattr(response, "body_iterator", None)
    if body_iterator is None:
        _monitor_anthropic_json_response(response, monitor_id, context_length)
        return response

    async def _monitored_body():
        terminal = False
        try:
            async for chunk in body_iterator:
                text = (
                    chunk.decode("utf-8", errors = "ignore")
                    if isinstance(chunk, (bytes, bytearray))
                    else str(chunk)
                )
                for line in text.splitlines():
                    if (
                        _monitor_anthropic_sse_line(
                            monitor_id,
                            line.strip(),
                            context_length,
                        )
                        == "error"
                    ):
                        terminal = True
                yield chunk
            if not terminal:
                api_monitor.finish(
                    monitor_id,
                    "cancelled"
                    if cancel_event is not None and cancel_event.is_set()
                    else "completed",
                )
        except asyncio.CancelledError:
            if cancel_event is not None:
                cancel_event.set()
            api_monitor.finish(monitor_id, "cancelled")
            raise
        except Exception as exc:
            api_monitor.fail(monitor_id, _friendly_error(exc))
            raise
        finally:
            _ANTHROPIC_MONITOR_TOOL_BLOCKS.pop(monitor_id, None)

    response.body_iterator = _monitored_body()
    return response


def _standard_models_still_held() -> list[str]:
    """Unsloth models the registry still holds, whoever is active.

    A GGUF load unloads only the ACTIVE Unsloth model, so a Transformers model
    cached behind it keeps its weights while llama.cpp answers. Reported so the
    memory is visible, and releasable, rather than stranded.
    """
    backend = _peek_inference_backend()
    models = getattr(backend, "models", None) if backend is not None else None
    return [name for name in models if isinstance(name, str)] if isinstance(models, dict) else []


def _peek_inference_backend() -> Any:
    """The orchestrator if one already exists, else None. Never constructs one.

    Constructing reaches get_default_models() -> get_device(), so during the warm a caller
    that only describes what is loaded would block uvicorn on the torch import to answer
    "nothing". A patched module getter still wins: that is this module's injection seam.
    """
    from core.inference import orchestrator as _orch

    if get_inference_backend is not _orch.get_inference_backend:
        return get_inference_backend()
    return _orch.peek_inference_backend()


def _monitor_context_length() -> Optional[int]:
    llama_backend = get_llama_cpp_backend()
    if getattr(llama_backend, "is_loaded", False):
        context_length = _positive_int_or_none(getattr(llama_backend, "context_length", None))
        if context_length is not None:
            return context_length
    # Peek, not the constructing getter: called inline from the OpenAI, Responses and
    # Anthropic monitor paths, and no orchestrator already means nothing is loaded.
    backend = _peek_inference_backend()
    if backend is None or not backend.active_model_name:
        return None
    models = getattr(backend, "models", {}) or {}
    model_info = models.get(backend.active_model_name, {}) if isinstance(models, dict) else {}
    context_length = _positive_int_or_none(model_info.get("context_length"))
    if context_length is not None:
        return context_length
    for candidate in (
        getattr(backend, "context_length", None),
        getattr(backend, "max_seq_length", None),
    ):
        context_length = _positive_int_or_none(candidate)
        if context_length is not None:
            return context_length
    return None


def _lifecycle_model_label(model: Optional[str], variant: Optional[str] = None) -> str:
    """A path-free ``repo`` / ``repo:QUANT`` label for a monitor lifecycle row."""
    clean = public_model_id(model) or model or "model"
    return f"{clean}:{variant}" if variant and ":" not in clean else clean


def _close_load_event(
    entry_id: Optional[str], model: Optional[str], variant: Optional[str]
) -> None:
    """Close a monitor load row, relabelled with the id the load resolved: the row
    opened on the request's model_path, which may be an HF snapshot dir."""
    api_monitor.relabel(entry_id, _lifecycle_model_label(model, variant))
    api_monitor.finish(entry_id)


# Direct calls skip admission but still occupy a slot: /completions, /embeddings,
# GGUF TTS and RAG vision (captioning/OCR) all reach llama-server without a lease.
_direct_llama_inflight = 0
_direct_llama_inflight_lock = threading.Lock()


def _direct_llama_request_started() -> None:
    global _direct_llama_inflight
    with _direct_llama_inflight_lock:
        _direct_llama_inflight += 1


def _direct_llama_request_finished() -> None:
    global _direct_llama_inflight
    with _direct_llama_inflight_lock:
        _direct_llama_inflight = max(0, _direct_llama_inflight - 1)


@contextmanager
def _direct_llama_request(counted: bool = True):
    """Hold the direct-call count for the duration of the block.

    The increment is the last statement before the try that decrements it, so no
    caller can leak a permanent +1 by placing the pair itself. ``counted`` False is
    a no-op, for callers that pick their backend at runtime.
    """
    if not counted:
        yield
        return
    _direct_llama_request_started()
    try:
        yield
    finally:
        _direct_llama_request_finished()


def _direct_llama_is_busy() -> bool:
    """Whether a direct llama call (RAG caption/OCR) holds the server right now.

    Tracked separately from the admission snapshot, so it still answers when admission
    control is off and :func:`_monitor_queue_state` reports nothing at all.
    """
    with _direct_llama_inflight_lock:
        return _direct_llama_inflight > 0


def _monitor_queue_state() -> Optional[dict]:
    """Live slot/queue occupancy of the loaded llama-server, for the API monitor."""
    # Disabled admission takes no leases and stays at capacity 1, so a multi-slot
    # server would be misreported.
    if not llama_admission_config_from_env().enabled:
        return None
    llama_backend = get_llama_cpp_backend()
    if not getattr(llama_backend, "is_loaded", False) or getattr(
        llama_backend, "is_diffusion", False
    ):
        return None
    direct = _direct_llama_inflight
    snapshot = peek_llama_admission_snapshot(
        str(getattr(llama_backend, "base_url", "llama-server"))
    )
    if snapshot is not None:
        busy = snapshot.active + direct
        active = min(snapshot.capacity, busy)
        return {
            "capacity": snapshot.capacity,
            "active": active,
            # Direct calls hold no lease, so overflow is waiting inside llama-server:
            # queued, not clamped away into a readout that looks idle.
            "queued": snapshot.queued + max(0, busy - snapshot.capacity),
            # From the snapshot, not capacity - active: it already holds slots back for
            # approved resumes, so recomputing would show free next to queued.
            "free": max(0, snapshot.free - direct),
        }
    capacity = _positive_int_or_none(getattr(llama_backend, "effective_parallel_slots", None)) or 1
    active = min(capacity, direct)
    return {
        "capacity": capacity,
        "active": active,
        "queued": max(0, direct - capacity),
        "free": capacity - active,
    }


def _monitor_active_model() -> Optional[str]:
    """The loaded model as a client-facing id, quant included when known.

    Cleaned like /v1/models: rendered in the settings UI and served over the public
    --secure tunnel, so it must never be the on-disk load path.
    """
    llama_backend = get_llama_cpp_backend()
    if getattr(llama_backend, "is_loaded", False):
        model_id = _llama_public_model_id(llama_backend)
        variant = getattr(llama_backend, "hf_variant", None)
        if model_id and variant and ":" not in model_id:
            return f"{model_id}:{variant}"
        return model_id
    # Peek: the monitor overlay is on by default and polls this read-only, so building
    # the singleton to answer "nothing loaded" would import torch on a warm-disabled host.
    backend = _peek_inference_backend()
    if backend is None:
        return None
    return public_model_id(backend.active_model_name) or backend.active_model_name


def _validate_native_gguf_companion(
    companion_path: str | None,
    gguf_path: str | None,
    label: str,
    *,
    allowed_subdirs: Collection[str] = (),
    mtp_search_root: str | Path | None = None,
) -> None:
    """Reject a companion GGUF (mmproj / MTP drafter) that a native-lease load
    would otherwise hand to llama-server: must be a regular file (no symlink
    escaping the leased directory) in a permitted location."""
    if not companion_path or not gguf_path:
        return
    import stat as _stat_module

    companion = Path(companion_path)
    gguf = Path(gguf_path)
    try:
        companion_lstat = os.lstat(companion)
    except OSError as exc:
        raise HTTPException(
            status_code = 400,
            detail = f"Native {label} is no longer accessible.",
        ) from exc
    if _stat_module.S_ISLNK(companion_lstat.st_mode) or not _stat_module.S_ISREG(
        companion_lstat.st_mode
    ):
        raise HTTPException(
            status_code = 400,
            detail = f"Native {label} must be a regular file.",
        )
    try:
        if not native_gguf_companion_parent_allowed(
            companion,
            gguf,
            allowed_subdirs = allowed_subdirs,
            mtp_search_root = mtp_search_root,
        ):
            location = (
                "beside the selected GGUF or in its companion directory"
                if allowed_subdirs
                else "next to the selected GGUF"
            )
            raise HTTPException(
                status_code = 400,
                detail = f"Native {label} must live {location}.",
            )
    except OSError as exc:
        raise HTTPException(
            status_code = 400,
            detail = f"Native {label} is no longer accessible.",
        ) from exc


def _loaded_is_local_model(
    llama_backend: LlamaCppBackend, native_grant_backed: bool, model_id: str | None
) -> bool:
    """Provenance of the running model, preferring what the load recorded.

    Falls back to the filesystem for a server started before the flag existed.
    """
    if native_grant_backed:
        return True
    stored = getattr(llama_backend, "_is_local_model", None)
    if stored is not None:
        return bool(stored)
    return bool(model_id and is_local_path(model_id))


# Per-drafter-kind display label and the companion subdirectory a native load
# may reach into. Keyed by the kinds llama_cpp._drafter_path_kind reports.
_DRAFTER_NATIVE_RULES = {
    "mtp": ("MTP drafter", "mtp"),
    "dspark": ("DSpark drafter", "dspark"),
    # No companion subdirectory: dflash/ is a family name a user picks for real
    # weights, so detect_dflash_file only ever offers a root-level sidecar and
    # nothing outside the model's own directory is in bounds.
    "dflash": ("DFlash drafter", None),
}


def _validate_native_mtp_drafter(
    companion_path: str | None,
    gguf_path: str | None,
    *,
    kind: str = "mtp",
    mtp_search_root: str | Path | None = None,
) -> None:
    """Validate a drafter for a native load, every shard of it.

    llama-server opens the sibling shards of a split drafter implicitly, so
    checking only the launch path would let a later shard be a symlink out of
    the permitted directory without ever facing the native rules.

    ``kind`` selects the label and which companion subdirectory is in bounds;
    the kinds must not share one, or an MTP load would accept a sidecar out of
    ``dspark/`` and launch it as --model-draft.
    """
    if not companion_path or not gguf_path:
        return
    label, subdir = _DRAFTER_NATIVE_RULES[kind]
    shards, _ = colocated_split_shards(Path(companion_path))
    for shard in shards or [Path(companion_path)]:
        _validate_native_gguf_companion(
            str(shard),
            gguf_path,
            label,
            allowed_subdirs = (subdir,) if subdir else (),
            mtp_search_root = mtp_search_root,
        )


def _native_gguf_companion_usable(
    companion_path: str | None,
    gguf_path: str | None,
    *,
    kind: str = "mtp",
    mtp_search_root: str | Path | None = None,
    log_rejection: bool = False,
) -> bool:
    """Whether a native load would accept this drafter, as a predicate for
    reload dedup. Same rules, so the two cannot disagree."""
    try:
        _validate_native_mtp_drafter(
            companion_path, gguf_path, kind = kind, mtp_search_root = mtp_search_root
        )
    except HTTPException as exc:
        if log_rejection:
            logger.warning(
                "Dropping %s for native load: %s",
                _DRAFTER_NATIVE_RULES[kind][0],
                exc.detail,
            )
        return False
    return True


def _should_strip_split_mode(request: LoadRequest, backend_extra: Optional[list[str]]) -> bool:
    """Whether an inherited --split-mode (and its coupled --tensor-split) should
    be stripped on reload.

    The binary Tensor Parallelism toggle can't carry --split-mode's row/none/
    layer modes, so only strip when the toggle overrides it: tensor being turned
    on, or the inherited mode is tensor (toggle turning it off). Non-tensor modes
    survive. A manual per-GPU ratio is handled by _should_strip_tensor_split,
    which strips only --tensor-split so the inherited mode is kept. Shared by the
    inheritance strip and the already-loaded stale check so they agree on what
    reload would do.
    """
    fields_set = getattr(request, "model_fields_set", set())
    return "tensor_parallel" in fields_set and (
        request.tensor_parallel or resolve_tensor_parallel(backend_extra, False)
    )


def _should_strip_tensor_split(request: LoadRequest) -> bool:
    """Whether an inherited --tensor-split alone should be stripped on reload.

    Manual explicit offload (gpu_layers >= 0) owns the per-GPU split: with a ratio
    it emits its own --tensor-split (an inherited one, appended last, would
    override it), and with the ratio cleared it wants llama.cpp's default
    free-VRAM split. Either way an inherited --tensor-split must go, else the
    cleared case silently keeps the stale ratio while status reports None.
    Unlike _should_strip_split_mode this leaves --split-mode untouched, so a
    user's row/none/layer mode survives a Studio split-ratio edit. When the
    Tensor Parallelism toggle IS overriding the mode, _should_strip_split_mode
    (called alongside this at every site) strips --split-mode anyway.
    """
    return (
        getattr(request, "gpu_memory_mode", "auto") == "manual"
        and getattr(request, "gpu_layers", -1) >= 0
    )


def _carry_preserved_tensor_intent(
    *, preserved: bool, same_model: bool, explicit_drop: bool
) -> bool:
    """Carry a preserved multi-GPU layer fallback forward only for a reload of the
    SAME loaded model that doesn't explicitly drop tensor intent, so a fitting model
    isn't collapsed to one GPU on a ctx-only change -- but an unrelated model switch
    (without /unload) or an explicit tensor-off doesn't inherit it (#6659)."""
    return preserved and same_model and not explicit_drop


def _is_explicit_tensor_drop(request: LoadRequest) -> bool:
    """True only when the request explicitly selects a non-tensor --split-mode (e.g.
    layer/row/none), a deliberate departure from a preserved tensor->layer fallback.

    A bare tensor_parallel field is NOT a drop: the Unsloth UI always sends it and echoes
    the /load response's resolved value back, so after a fallback every reload carries
    tensor_parallel=false even though the user never changed it -- treating that as a drop
    would collapse the preserved multi-GPU placement on the next ctx/settings reload. An
    empty clear is not a drop either (a fallback always stores --split-mode layer, never a
    tensor split mode, so a clear never wipes tensor intent), nor is an unrelated extra
    (--top-k) or inherit (None). tensor_parallel=true / --split-mode tensor re-engage
    tensor. Shared by the already-loaded dedup and the load carry-forward (#6659)."""
    override = parse_split_mode_override(request.llama_extra_args)
    return override is not None and override.strip().lower() != "tensor"


def _llama_runtime_fields(llama_backend: LlamaCppBackend) -> dict:
    """Runtime state shared by load, dedupe, and status; duplicates echo active settings."""
    fields = {
        name: getattr(llama_backend, name, getattr(llama_backend, f"_{name}", None))
        for name in _InferenceRuntimeFields.model_fields
        if hasattr(llama_backend, name) or hasattr(llama_backend, f"_{name}")
    }
    fields.update(
        # Not MLX, so the MLX runtime fields report as absent.
        is_mlx = False,
        mlx_kv_bits = None,
        mlx_kv_bits_requested = None,
        mlx_kv_quant_eligibility = None,
        mlx_kv_quant_reason = None,
        mlx_kv_quant_note = None,
        chat_template_override_reason = None,
        # Older/custom backend doubles predate this additive runtime field.
        preserve_thinking_default = bool(getattr(llama_backend, "preserve_thinking_default", False)),
        speculative_type = llama_backend.requested_spec_mode,
        requested_parallel_slots = (
            None if llama_backend.is_diffusion else llama_backend.requested_parallel_slots
        ),
        parallel_slots = (
            None if llama_backend.is_diffusion else llama_backend.effective_parallel_slots
        ),
        # What the load was INVOKED with, not the rewritten launch list: that is the
        # list a client would have to resend to reproduce this server, and the one
        # the rollback path needs. Empty reports as None, so "passed none" and
        # "never set" read alike to a client that only ever resends a non-empty list.
        # getattr, unlike the rest of this block: the drift check below is what turns
        # a backend missing a runtime field into one clear error naming all of them,
        # and reading the attribute here would pre-empt it with a bare AttributeError.
        # An explicit [] is NOT None here. A rollback resends this field only when it
        # has one, and omitting it is what makes /load inherit, so a model that was
        # running with no extras would come back carrying the arguments of the load
        # that just failed. None stays for "nothing was ever set", which is the only
        # case where inheriting is the right answer.
        requested_llama_extra_args = (
            None
            if llama_backend.is_diffusion
            else (
                None
                if getattr(llama_backend, "requested_extra_args", None) is None
                else list(llama_backend.requested_extra_args)
            )
        ),
    )
    unresolved = (
        set(_InferenceRuntimeFields.model_fields) - fields.keys() - {"requires_trust_remote_code"}
    )
    if unresolved:
        raise AttributeError(
            f"GGUF backend is missing runtime response fields: {sorted(unresolved)}"
        )
    return fields


def _gguf_load_response(
    llama_backend: LlamaCppBackend,
    status: str,
    model: str,
    *,
    display_name: Optional[str] = None,
    is_local_model: bool,
    inference_identifier: Optional[str] = None,
) -> LoadResponse:
    return LoadResponse(
        status = status,
        model = model,
        # Not the bare identifier: the already-resident path leaves display_name unset,
        # and a cached repo loads from its snapshot dir, so clients label it by path.
        display_name = display_name or display_model_name(model) or model,
        is_lora = False,
        is_gguf = True,
        is_local_model = is_local_model,
        inference = load_inference_config(
            inference_identifier or llama_backend.model_identifier or model
        ),
        **_llama_runtime_fields(llama_backend),
    )


def _gguf_request_intent(
    source: GgufLoadIntent,
    request: LoadRequest,
    *,
    chat_template_override: Optional[str],
    extra_args: Optional[list[str]],
    gpu_ids: Optional[list[int]],
    n_parallel: int,
    **changes,
) -> GgufLoadIntent:
    # ``dataclass_fields``, not ``vars``: same names, but no reliance on ``__dict__``.
    settings = {
        name: getattr(request, name)
        for name in (f.name for f in dataclass_fields(source))
        if hasattr(request, name) and (name != "hf_token" or source.hf_repo)
    }
    settings.update(
        n_ctx = request.max_seq_length,
        chat_template_override = chat_template_override,
        extra_args = extra_args,
        gpu_ids = gpu_ids,
        n_parallel = n_parallel,
    )
    settings.update(changes)
    return replace(source, **settings)


def _drafter_for_path(
    gguf_path: Optional[str],
    native_grant_backed: bool,
    *,
    kind: str = "mtp",
    log_native_fallback: bool = False,
) -> Optional[str]:
    """The drafter of ``kind`` that pairs with a local GGUF, or None.

    A native-grant-backed load filters candidates through the native rules in
    preference order, so a root drafter it must reject still falls through to
    the in-bounds subdirectory copy instead of reading as no drafter at all.
    """
    if not gguf_path:
        return None
    detect = {"dspark": detect_dspark_file, "dflash": detect_dflash_file}.get(kind, detect_mtp_file)
    root = _local_gguf_companion_search_root(gguf_path, gguf_path)
    rejected = False
    accept = None
    if native_grant_backed:

        def accept(candidate):
            nonlocal rejected
            usable = _native_gguf_companion_usable(
                candidate,
                gguf_path,
                kind = kind,
                mtp_search_root = root,
                log_rejection = log_native_fallback,
            )
            rejected |= not usable
            return usable

    detected = detect(gguf_path, search_root = root, accept = accept)
    if log_native_fallback and rejected and detected:
        logger.info(
            "Using %s subdirectory drafter for native load: %s",
            _DRAFTER_NATIVE_RULES[kind][0],
            detected,
        )
    return detected


def _native_drafter_accept(candidate: str, gguf_path: str, kind: str, search_root: str) -> bool:
    """The native lease rule, in the shape ModelConfig.from_identifier takes.

    Discovery inside from_identifier runs before this route ever sees a path, and
    the DFlash scan opens a candidate's header to confirm the architecture. A
    native grant covers one directory, so handing the boundary down is what keeps
    a sidecar symlinked out of the lease from being read at all -- rejecting it
    afterwards, which _resolve_gguf_load_intent still does, cannot undo a read.
    Same predicate the rescan uses, so the two passes cannot disagree about what
    is in bounds.
    """
    return _native_gguf_companion_usable(
        candidate,
        gguf_path,
        kind = kind,
        mtp_search_root = search_root,
        log_rejection = True,
    )


def _mtp_draft_for_path(
    gguf_path: Optional[str],
    native_grant_backed: bool,
    *,
    log_native_fallback: bool = False,
) -> Optional[str]:
    return _drafter_for_path(
        gguf_path, native_grant_backed, log_native_fallback = log_native_fallback
    )


def _dspark_draft_for_path(
    gguf_path: Optional[str],
    native_grant_backed: bool,
    *,
    log_native_fallback: bool = False,
) -> Optional[str]:
    return _drafter_for_path(
        gguf_path,
        native_grant_backed,
        kind = "dspark",
        log_native_fallback = log_native_fallback,
    )


def _dflash_draft_for_path(
    gguf_path: Optional[str],
    native_grant_backed: bool,
    *,
    log_native_fallback: bool = False,
) -> Optional[str]:
    return _drafter_for_path(
        gguf_path,
        native_grant_backed,
        kind = "dflash",
        log_native_fallback = log_native_fallback,
    )


def _active_gguf_intent(
    request: LoadRequest,
    llama_backend: LlamaCppBackend,
    *,
    model_identifier: str,
    chat_template_override: Optional[str],
    n_parallel: int,
    native_grant_backed: bool,
) -> GgufLoadIntent:
    backend_extra = list(llama_backend.extra_args or ())
    request_fields_set = getattr(request, "model_fields_set", set())
    inherits_extras = request.llama_extra_args is None
    if inherits_extras:
        effective_extra = strip_shadowing_flags(
            backend_extra,
            strip_split_mode = _should_strip_split_mode(request, backend_extra),
            strip_tensor_split = _should_strip_tensor_split(request),
            strip_offload = request.gpu_memory_mode == "manual",
        )
        # mirror _resolve_inherited_extra_args, or a stale inherited -b / -ub reads as equal
        batch_stripped_extra = strip_shadowing_flags(
            effective_extra,
            strip_context = False,
            strip_cache = False,
            strip_spec = False,
            strip_template = False,
            strip_split_mode = False,
            strip_batch = "n_batch" in request_fields_set,
            strip_ubatch = "n_ubatch" in request_fields_set,
        )
        # a strip that changed the list is an override, so the dedupe compares the stripped one
        batch_overrides_inherit = batch_stripped_extra != effective_extra
        effective_extra = batch_stripped_extra
    else:
        effective_extra = request.llama_extra_args
        batch_overrides_inherit = False
    source = llama_backend.last_load_intent or GgufLoadIntent(
        model_identifier = model_identifier,
        gguf_path = None if llama_backend.hf_repo else llama_backend.gguf_path,
        hf_repo = llama_backend.hf_repo,
        hf_variant = llama_backend.hf_variant,
    )
    return _gguf_request_intent(
        source,
        request,
        model_identifier = model_identifier,
        # A repo or directory variant has not been resolved to a file yet. Do
        # not inherit the resident file or source matching would compare that
        # file with itself and ignore a requested quant switch.
        gguf_path = source.gguf_path if model_identifier.lower().endswith(".gguf") else None,
        hf_variant = request.gguf_variant or source.hf_variant,
        chat_template_override = chat_template_override,
        extra_args = effective_extra,
        gpu_ids = request.gpu_ids,
        n_parallel = n_parallel,
        preserve_multi_gpu_on_layer = (
            llama_backend.layer_preserves_tensor_intent and not _is_explicit_tensor_drop(request)
        ),
        mtp_draft_path = _mtp_draft_for_path(llama_backend.gguf_path, native_grant_backed),
        dspark_draft_path = _dspark_draft_for_path(llama_backend.gguf_path, native_grant_backed),
        dflash_draft_path = _dflash_draft_for_path(llama_backend.gguf_path, native_grant_backed),
        compare_mtp_draft = True,
        extra_args_inherited = inherits_extras and not batch_overrides_inherit,
    )


def _resolve_model_identifier_for_request(
    request: LoadRequest | ValidateModelRequest, *, operation: str
) -> tuple[str, str, bool]:
    if not request.native_path_lease:
        return request.model_path, request.model_path, False
    try:
        grant = verify_native_path_lease(
            request.native_path_lease,
            operation = operation,
            expected_kind = "model",
            expected_path_type = "file",
            allowed_suffixes = (".gguf",),
        )
    except NativePathLeaseError as exc:
        # Curated, client-correctable lease error (expired / wrong type / re-select);
        # keep the actionable message, just redact paths.
        logger.warning("inference.native_path_lease_failed: %s", exc)
        raise HTTPException(
            status_code = 400,
            detail = redact_native_paths(str(exc)),
        ) from exc
    display_label = grant.display_label or Path(request.model_path).name or "Native model"
    return str(grant.canonical_path), display_label, True


# GGUF inference backend (llama-server)
_llama_cpp_backend = LlamaCppBackend()


def get_llama_cpp_backend() -> LlamaCppBackend:
    return _llama_cpp_backend


# Serializes opt-in auto-switch loads so two requests can't race a swap. One
# lock per running loop, since a module-level asyncio.Lock binds to a single
# loop and breaks multi-loop runners (e.g. pytest's per-test loops on pre-3.10).
_auto_switch_locks: "weakref.WeakKeyDictionary" = weakref.WeakKeyDictionary()
_auto_switch_locks_guard = threading.Lock()


def _auto_switch_lock() -> asyncio.Lock:
    loop = asyncio.get_running_loop()
    # WeakKeyDictionary mutation isn't thread-safe; guard get-or-create so two
    # loops on different threads can't race it.
    with _auto_switch_locks_guard:
        lock = _auto_switch_locks.get(loop)
        if lock is None:
            lock = _auto_switch_locks[loop] = asyncio.Lock()
        return lock


# Process-wide gate so a swap on another event loop in this process can't race
# this one for the single model slot: the asyncio lock above is per loop, but the
# backend slot and _load_model_impl are process-wide. threading.Lock so it serializes
# across loops/threads; released from the loop thread (Lock allows cross-thread release).
_auto_switch_process_lock = threading.Lock()


async def _acquire_swap_gate() -> None:
    # Non-blocking first for the common single-loop case; otherwise poll off a
    # short sleep rather than awaiting to_thread(acquire). A cancelled to_thread
    # (client disconnect mid-wait) leaves its worker thread still acquiring, so the
    # gate gets taken but the finally that releases it never runs -- deadlocking
    # later swaps. Polling keeps the wait off this loop AND cancellation-safe: a
    # cancel lands during the sleep, when the gate is not held.
    while not _auto_switch_process_lock.acquire(blocking = False):
        await asyncio.sleep(0.02)


# Counts auto-switch requests queued to load each (target, variant). They are not
# generating, so the drain wait below excludes them from the active inference count.
_auto_switch_waiters: dict[tuple[str, str], int] = {}
_auto_switch_waiters_guard = threading.Lock()


def _switch_key(override_id: str, variant: Optional[str]) -> tuple[str, str]:
    return (override_id.lower(), (variant or "").lower())


def _note_switch_waiter(key: tuple[str, str], delta: int) -> None:
    with _auto_switch_waiters_guard:
        n = _auto_switch_waiters.get(key, 0) + delta
        if n > 0:
            _auto_switch_waiters[key] = n
        else:
            _auto_switch_waiters.pop(key, None)


def _switch_waiter_count() -> int:
    with _auto_switch_waiters_guard:
        return sum(max(0, count) for count in _auto_switch_waiters.values())


async def _wait_for_model_switch_idle(
    *,
    current_request_counted: bool,
    cancel_pending: bool = False,
    timeout_s: Optional[float] = None,
) -> None:
    """Wait until a model replacement cannot interrupt active inference.

    The caller holds ``inference_lifecycle_gate``, which prevents new inference
    from starting while existing requests drain. Auto-switch requests that have
    resolved their targets are scheduler waiters, not active generations, so
    exclude them to avoid a queue deadlock.

    ``cancel_pending`` is set by a forced swap that has NOT cancelled yet: the
    registered generations are the ones it is about to stop, so waiting on them
    would wait out exactly what the force exists to end. Excluding them lets the
    drain finish ahead of the cancel, which keeps every check that can still
    reject the swap in front of the destructive step. Recomputed each poll (not
    snapshotted) so a generation that ends on its own stops being discounted and
    the remaining, non-cancellable requests are still waited out.

    ``timeout_s`` bounds the wait and returns rather than raising. Only the
    post-cancel drains pass it: what they wait on may never observe its cancel
    (TTS on the subprocess backend has no observer), and they hold the lifecycle
    gate, so an unbounded wait pins every load and unload behind one
    uninterruptible generation. Expiring there just proceeds, which is what they
    do anyway once drained. Pre-cancel drains stay unbounded -- the swap can
    still be refused, so they must not shorten the protection they provide.
    """
    from core.inference.llama_keepwarm import other_inference_request_count

    deadline = None if timeout_s is None else time.monotonic() + timeout_s
    while True:
        queued_switches = _switch_waiter_count()
        if current_request_counted and queued_switches > 0:
            queued_switches -= 1
        active_others = other_inference_request_count(
            current_request_counted = current_request_counted,
            include_pending = False,
        )
        if cancel_pending:
            active_others -= min(active_others, active_generations.count())
        if active_others <= queued_switches:
            return
        if deadline is not None and time.monotonic() >= deadline:
            logger.warning(
                "model_switch_drain_timed_out",
                extra = {
                    "event": "inference.switch_drain_timeout",
                    "remaining": active_others - queued_switches,
                },
            )
            return
        await asyncio.sleep(0.02)


def _llama_public_model_id(llama_backend, fallback: Optional[str] = None) -> Optional[str]:
    """The id to report for the loaded GGUF in API responses: the advertised repo
    id from an auto-switch load, else the cleaned public id, never the on-disk
    .gguf path (see core.inference.model_ids.public_model_id)."""
    return (
        getattr(llama_backend, "_openai_advertised_id", None)
        or public_model_id(getattr(llama_backend, "model_identifier", None))
        or public_model_id(fallback)
        or fallback
    )


def _llama_status_model_ids(llama_backend) -> "tuple[Optional[str], Optional[str]]":
    """The ``(active_model, model_identifier)`` pair ``/api/inference/status`` publishes
    for a loaded GGUF. A native-lease load reports only the display label, never the
    leased on-disk path."""
    model_id = getattr(llama_backend, "model_identifier", None)
    native_grant_backed = getattr(llama_backend, "_native_grant_backed", False)
    display_model_id = getattr(
        llama_backend, "_native_display_label", None
    ) or display_label_for_native_path(model_id)
    if (
        native_grant_backed
        and model_id
        and display_model_id == model_id
        and os.path.isabs(model_id)
    ):
        display_model_id = os.path.basename(model_id)
    elif not native_grant_backed and display_model_id == model_id:
        # No label registered, so report the clean public id, not the snapshot's sha.
        display_model_id = _llama_public_model_id(llama_backend) or display_model_id
    return display_model_id, (None if native_grant_backed else model_id)


def _llama_status_checkpoint_id(llama_backend) -> Optional[str]:
    """The exact string a Studio client holds as ``params.checkpoint`` for the loaded
    GGUF: ``status.model_identifier ?? status.active_model``. Built from the same pair the
    status handler returns so the two cannot drift."""
    display_model_id, model_identifier = _llama_status_model_ids(llama_backend)
    return display_model_id if model_identifier is None else model_identifier


_DISABLE_OPENAI_AUTO_SWITCH_SCOPE_KEY = "_unsloth_disable_openai_auto_switch"
# Sentinel a raw-body endpoint passes when the request omits ``model``: it must
# only restore an idle-freed model, never run the resolver (so a downloaded GGUF
# literally named "default" can't be swapped to). The NUL keeps it off any index.
_RELOAD_ONLY_MODEL = "\x00reload-only"
# One cold scan is worth paying to avoid answering a named model with another,
# bounded so a pathological install cannot hang the request behind it.
_COLD_INDEX_WAIT_S = 10.0


def _switch_model_for_payload(payload) -> str:
    # A pydantic request fills an omitted ``model`` with "default"; only an
    # explicitly set model may switch, else reload-only so a GGUF named "default"
    # is never matched (mirrors the raw-body sentinel path).
    return payload.model if "model" in payload.model_fields_set else _RELOAD_ONLY_MODEL


def _target_is_vision(
    load_path: str,
    gguf_variant: Optional[str] = None,
    need_image: bool = True,
) -> bool:
    # A local GGUF's vision capability is its companion mmproj, a filesystem check
    # (no model load). Matches the loaded backend's is_vision, so rejecting a swap
    # here can't differ from the post-load guard, hence the quant. An audio request
    # needs that projector too but not a vision tower, so it asks with need_image
    # False. Thread the ambient HF token so the probe keeps the capability-probe
    # invariant (the resolver only yields local paths, where the token is unused,
    # but the rule requires it regardless).
    from utils.models.model_config import is_vision_model
    try:
        # Deliberately unguarded: the resolver only yields local paths, so this returns
        # from the mmproj filesystem branch without touching the hub. A reachability
        # probe here would add seconds per request and prevent nothing.
        return bool(
            is_vision_model(
                load_path,
                hf_token = os.environ.get("HF_TOKEN"),
                gguf_variant = gguf_variant,
                require_image = need_image,
            )
        )
    except Exception as exc:
        # Detection failure: don't block the swap, let the load decide.
        logger.debug("auto-switch: vision probe failed for %s: %s", load_path, exc)
        return True


def _messages_have_image(messages) -> bool:
    return any(
        isinstance(m.content, list) and any(isinstance(p, ImageContentPart) for p in m.content)
        for m in messages
    )


def _request_has_image(payload) -> bool:
    if getattr(payload, "image_base64", None):
        return True
    return _messages_have_image(payload.messages)


def _anthropic_request_has_image(payload) -> bool:
    # Mirror anthropic_messages_to_openai: an Anthropic image block carries
    # ``type == "image"`` (typed AnthropicImageBlock or a raw dict).
    for msg in getattr(payload, "messages", None) or []:
        content = getattr(msg, "content", None)
        if not isinstance(content, list):
            continue
        for block in content:
            bt = block.get("type") if isinstance(block, dict) else getattr(block, "type", None)
            if bt == "image":
                return True
    return False


def disable_openai_auto_switch_for_request(scope) -> None:
    """Opt a request out of OpenAI auto-switch. The public preview route uses this:
    it always serves its pinned checkpoint, so a caller-supplied model must never
    swap the loaded model."""
    if isinstance(scope, dict):
        scope[_DISABLE_OPENAI_AUTO_SWITCH_SCOPE_KEY] = True


def _automatic_model_load_may_run() -> bool:
    """True when a request can trigger an automatic load: either resolver-based
    auto-switch is on, or a standalone idle TTL can reload an idle-freed model. The
    validate-before-switch guards key off this so an invalid request never loads.

    Reads the configured setting, not the effective TTL: Model Memory residency
    zeroes the latter, and a model the idle loop freed BEFORE residency was
    enabled still has to be reloadable. Residency stops unloads, not reloads.
    """
    from utils.openai_auto_switch_settings import (
        get_openai_auto_switch_enabled,
        idle_unload_is_configured,
    )
    return get_openai_auto_switch_enabled() or idle_unload_is_configured()


def _no_model_loaded_detail(base: str) -> str:
    """Append a pointer to the opt-in auto-switch toggle to a "no model loaded"
    error, but only when it's off. Auto-switch (default off) cold-loads a
    requested downloaded GGUF, so an off toggle is the usual reason a request
    naming a listed model still 400/503s; surface the fix. With it on the name
    simply didn't resolve to a local GGUF, so the hint would mislead and is omitted."""
    from utils.openai_auto_switch_settings import get_openai_auto_switch_enabled

    if get_openai_auto_switch_enabled():
        return base
    return base + (
        " Or enable Model auto-switch (Settings > API) to load a requested model automatically."
    )


# Cap on ids listed by a "not downloaded" error, so it stays readable in a terminal.
_MAX_LISTED_AVAILABLE_MODELS = 8


def _raw_body_model(body) -> Optional[str]:
    """The ``model`` a raw-body endpoint was given, else None (same value
    :func:`_auto_switch_from_request_body` fed the switch hook)."""
    return body.get("model") if isinstance(body, dict) else None


async def _available_model_ids() -> list[str]:
    """Sorted ids a /v1 request may name, from the catalog ``GET /v1/models``
    serves, so an error and the listing can't disagree."""
    return sorted(
        mid
        for mid in (m.get("id") for m in await _openai_catalog_objects())
        if isinstance(mid, str) and mid
    )


def _format_available_models(ids: list[str]) -> str:
    if not ids:
        return ""
    shown = ", ".join(ids[:_MAX_LISTED_AVAILABLE_MODELS])
    extra = len(ids) - _MAX_LISTED_AVAILABLE_MODELS
    return f"{shown} and {extra} more" if extra > 0 else shown


async def _unavailable_model_message(requested_model: str) -> str:
    """Why a named model can't serve this request, and what can.

    Auto-switch only loads downloaded GGUFs, so a request naming a real model
    usually fails because it is not on this machine, which /inference/load cannot
    fix; say what is actually wrong.
    """
    from core.inference.local_model_resolver import (
        MISS_VARIANT_NOT_FOUND,
        describe_local_miss,
    )

    reason, variants = await asyncio.to_thread(describe_local_miss, requested_model)
    if reason == MISS_VARIANT_NOT_FOUND:
        # Repo downloaded, only the quant missing: sibling quants beat the catalog.
        base_id, _, wanted = requested_model.strip().rpartition(":")
        return (
            f"The model '{base_id}' is downloaded, but the quant '{wanted}' is not. "
            f"Available quants: {', '.join(variants)}."
        )
    available = _format_available_models(await _available_model_ids())
    if not available:
        return (
            f"The model '{requested_model}' is not downloaded on this server, and no "
            "models are downloaded yet. Download one in Unsloth Studio."
        )
    return (
        f"The model '{requested_model}' is not downloaded on this server. "
        f"Available models: {available}. Download more in Unsloth Studio, "
        "or list them with GET /v1/models."
    )


async def _no_model_loaded_error(
    base: str, requested_model: Optional[str], fastapi_request: Optional[Request], *, status: int
):
    """``(status, detail)`` for the /v1 sites that fail because nothing is loaded.

    Changes only the case the generic text gets wrong (auto-switch on, a model
    named, that name resolving to nothing local, so the switch silently did
    nothing) into a 404 model_not_found. Everything else keeps ``status`` and the
    :func:`_no_model_loaded_detail` text verbatim.
    """
    from utils.openai_auto_switch_settings import get_openai_auto_switch_enabled
    from core.inference.local_model_resolver import resolve_local_gguf

    named = (
        requested_model
        if isinstance(requested_model, str)
        and requested_model.strip()
        and requested_model != _RELOAD_ONLY_MODEL
        else None
    )
    if named is None or not get_openai_auto_switch_enabled():
        return status, _no_model_loaded_detail(base)
    try:
        if await asyncio.to_thread(_loaded_satisfies, named):
            # Resident but on a backend this endpoint can't use, so "not downloaded" is false.
            return status, _no_model_loaded_detail(base)
        if await asyncio.to_thread(resolve_local_gguf, named) is not None:
            # Resolvable but unloaded: the switch failed, which the generic text covers.
            return status, _no_model_loaded_detail(base)
        message = await _unavailable_model_message(named)
    except Exception as exc:
        # The diagnosis is a nicety; never let it turn a 4xx into a 500.
        logger.debug("no-model-loaded diagnosis failed for %r: %s", named, exc)
        return status, _no_model_loaded_detail(base)
    path = getattr(getattr(fastapi_request, "url", None), "path", None)
    if not isinstance(path, str):
        # No request in hand: let the global /v1/* handler pick the envelope.
        return 404, message
    return 404, error_body_for_path(
        path,
        message,
        status = 404,
        code = "model_not_found",
        param = "model",
    )


def _auto_download_hf_token(fastapi_request: Optional[Request]) -> Optional[str]:
    """The token to fetch with: only one the caller sent themselves.

    Never the server's ambient token, and never the OpenAI bearer key. The repo is
    named by whoever holds an API key, so borrowing the owner's Hub identity would
    let that key pull the owner's private repos and publish them in /v1/models.
    """
    from hub.dependencies import HUB_HF_TOKEN_HEADER, HUB_HF_TOKEN_MAX_LENGTH

    headers = getattr(fastapi_request, "headers", None)
    if headers is None:
        return None
    supplied = (headers.get(HUB_HF_TOKEN_HEADER) or "").strip()
    if supplied and len(supplied) <= HUB_HF_TOKEN_MAX_LENGTH:
        return supplied
    return None


async def _maybe_auto_download_model(
    requested_model: str,
    fastapi_request: Optional[Request],
    *,
    require_vision: bool = False,
    current_subject: Optional[str] = None,
) -> None:
    """Opt-in: start fetching a named GGUF this server doesn't have.

    Raises to stop the request while the model is downloading or cannot be fetched.
    Off by default, and never fires on a name not shaped like a Hub repo, so an
    unknown id like "gpt-4" still falls through to the resident model.
    """
    from utils.openai_auto_switch_settings import get_openai_auto_download_enabled
    from core.inference.openai_auto_download import is_downloadable_ref, maybe_auto_download

    if not requested_model or not get_openai_auto_download_enabled():
        return
    if not is_downloadable_ref(requested_model):
        return
    # An Ollama-style tag (":latest") names no quant, so the resolver misses a servable model.
    if await asyncio.to_thread(_loaded_satisfies, requested_model):
        return
    try:
        refusal = await maybe_auto_download(
            requested_model,
            hf_token = _auto_download_hf_token(fastapi_request),
            require_vision = require_vision,
            subject = current_subject,
            # These endpoints also serve Studio's chat on a JWT, so only mark real API traffic.
            via_api_key = _request_used_api_key(fastapi_request),
        )
    except Exception as exc:
        # Never turn a servable request into a 500 over the download attempt.
        logger.warning("auto-download failed for %r: %s", requested_model, exc)
        return
    if refusal is None:
        return
    path = getattr(getattr(fastapi_request, "url", None), "path", None)
    detail = (
        error_body_for_path(
            path,
            refusal.message,
            status = refusal.status,
            code = refusal.code,
            param = "model",
        )
        if isinstance(path, str)
        else refusal.message
    )
    _record_refused_request(fastapi_request, requested_model, refusal, current_subject)
    raise HTTPException(
        status_code = refusal.status,
        detail = detail,
        headers = ({"Retry-After": str(refusal.retry_after)} if refusal.retry_after else None),
    )


def _record_refused_request(
    fastapi_request: Optional[Request],
    requested_model: str,
    refusal: Any,
    current_subject: Optional[str],
) -> None:
    """Log the refused call itself, not just the download it is waiting on.

    The refusal replaces the request, so the handler's own ``api_monitor.start``
    never runs. Only the caller that dispatched a download gets a row from
    ``record_lifecycle``; anyone refused while it runs left no trace at all, and a
    download some other caller started carries their attribution, so an API-key
    client waiting on it never opened the overlay and read as Studio's own traffic.
    """
    state = getattr(fastapi_request, "state", None)
    if getattr(state, "skip_api_monitor", False):
        return
    path = getattr(getattr(fastapi_request, "url", None), "path", None)
    entry_id = api_monitor.start(
        endpoint = path if isinstance(path, str) else "/v1",
        method = str(getattr(fastapi_request, "method", "") or "POST"),
        model = requested_model,
        prompt = "",
        subject = current_subject,
        via_api_key = _request_used_api_key(fastapi_request),
    )
    api_monitor.fail(entry_id, refusal.message)


def _resident_id_is_namespaced() -> bool:
    """Whether what is serving has an ``org/name`` id to compare a request against.

    A model loaded from a plain directory is advertised under a bare name, so a
    namespaced request cannot be told apart from it. Refusing one there would 404
    the weights that are in fact serving, so treat it as undecidable instead.
    """
    llama_backend = get_llama_cpp_backend()
    if getattr(llama_backend, "is_loaded", False):
        candidates = (
            getattr(llama_backend, "model_identifier", None),
            getattr(llama_backend, "_openai_advertised_id", None),
            _llama_public_model_id(llama_backend),
        )
    else:
        candidates = (getattr(get_inference_backend(), "active_model_name", None),)
    return any("/" in (public_model_id(c) or "") for c in candidates if c)


def _loaded_satisfies(requested: str) -> bool:
    """Whether what is serving right now actually answers to *requested*.

    A bare ``org/model`` is satisfied by any loaded quant of that repo; an explicit
    ``:QUANT`` must match the loaded one.
    """
    from core.inference.openai_auto_download import looks_like_quant, split_model_ref

    base, variant = split_model_ref(requested)
    llama_backend = get_llama_cpp_backend()
    if getattr(llama_backend, "is_loaded", False):
        candidates = [
            candidate
            for candidate in (
                getattr(llama_backend, "model_identifier", None),
                getattr(llama_backend, "_openai_advertised_id", None),
                _llama_public_model_id(llama_backend),
            )
            if candidate
        ]
        if not _matches_any(base, candidates):
            return False
        if not looks_like_quant(variant):
            # An Ollama-style tag (":latest", ":8b") names no file, so the repo is enough.
            return True
        return (getattr(llama_backend, "hf_variant", None) or "").lower() == variant.lower()
    active = getattr(get_inference_backend(), "active_model_name", None)
    if not active:
        return False
    # Only llama.cpp carries a quant identity, so this backend can only match on the repo.
    if looks_like_quant(variant):
        return False
    return _matches_any(base, [active, public_model_id(active)])


def _loaded_identity_satisfies(requested: str) -> bool:
    """Whether an explicit resident identity answers to *requested*.

    Unlike :func:`_loaded_satisfies`, this excludes a public id derived from a
    filesystem path, so a request naming that alias still passes through the
    resolver and the serving backend records it for responses and ``/v1/models``.
    A request naming the load path itself is held back until that recording has
    happened, for the same reason.
    """
    from core.inference.openai_auto_download import split_model_ref

    base, _ = split_model_ref(requested)
    llama_backend = get_llama_cpp_backend()
    if getattr(llama_backend, "is_loaded", False):
        identifier = getattr(llama_backend, "model_identifier", None)
        advertised = getattr(llama_backend, "_openai_advertised_id", None)
        # A manual load of a local path advertises nothing, so only the path could match
        # and answering from it would skip the recording: /v1/models and every response
        # would report the filename. One request pays the resolver, the rest match the
        # alias it recorded and land here.
        if advertised is None and identifier and _looks_like_local_path(identifier):
            return False
        return _matches_any(base, (identifier, advertised)) and _loaded_satisfies(requested)
    active = getattr(get_inference_backend(), "active_model_name", None)
    return bool(active and _matches_any(base, [active]) and _loaded_satisfies(requested))


def _raise_still_indexing(requested_model: str, fastapi_request) -> None:
    """Refuse a name we cannot yet place, rather than answer it with another model."""
    path = getattr(getattr(fastapi_request, "url", None), "path", None)
    message = (
        f"This server is still indexing its local models, so it cannot confirm "
        f"'{requested_model}' yet. Retry shortly."
    )
    raise HTTPException(
        status_code = 503,
        detail = (
            error_body_for_path(path, message, status = 503, code = "model_indexing")
            if isinstance(path, str)
            else message
        ),
        headers = {"Retry-After": "5"},
    )


def _matches_any(requested: str, candidates) -> bool:
    """Whether *requested* names any of *candidates*.

    A repo alias is case-insensitive, a filesystem path is not: lowercasing both
    made /srv/models/foo.gguf and /srv/models/Foo.gguf the same weights.
    """
    lowered = requested.strip().lower()
    for candidate in candidates:
        if not candidate:
            continue
        if _looks_like_local_path(requested) or _looks_like_local_path(candidate):
            if _norm_path(requested) == _norm_path(candidate):
                return True
            continue
        if lowered == str(candidate).strip().lower():
            return True
    return False


def _looks_like_local_path(value: str) -> bool:
    """A filesystem path rather than a repo id, so case matters."""
    text = str(value)
    return text.startswith("/") or text.startswith("~") or ":\\" in text or "\\" in text


def _norm_path(value: str) -> str:
    """Compare-ready path. normcase, not lower: on a case-sensitive filesystem
    /srv/models/Foo and /srv/models/foo are different models."""
    import os

    # normcase after, not before: on Windows it folds case *and* rewrites "/" to a
    # backslash, leaving the descendant checks below comparing against a path with none.
    return os.path.normcase(str(value)).replace("\\", "/").rstrip("/")


def _resident_quant_is(variant: Optional[str]) -> bool:
    """Whether the loaded GGUF is that exact quant."""
    resident = getattr(get_llama_cpp_backend(), "hf_variant", None) or ""
    return bool(variant) and resident.lower() == variant.strip().lower()


def _resolves_to_resident(load_path: Optional[str], *, llama_only: bool = False) -> bool:
    """Whether a resolved on-disk path is what is already loaded.

    ``llama_only`` drops the Transformers backend: only llama.cpp carries a quant
    identity, so a Transformers model active from a directory that also holds GGUF
    exports would otherwise answer a request for one of those quants.
    """
    if not load_path:
        return False
    target = _norm_path(load_path)
    llama_backend = get_llama_cpp_backend()
    for candidate in (
        getattr(llama_backend, "gguf_path", None)
        if getattr(llama_backend, "is_loaded", False)
        else None,
        getattr(llama_backend, "model_identifier", None)
        if getattr(llama_backend, "is_loaded", False)
        else None,
        None if llama_only else getattr(get_inference_backend(), "active_model_name", None),
    ):
        if not candidate:
            continue
        current = _norm_path(candidate)
        if current == target:
            return True
        if current.startswith(f"{target}/"):
            # A model directory holding the weights loaded from it. Nested entries
            # (/models/A alongside /models/A/sub/B) matched too, so a request for A was
            # answered with B. The innermost indexed model owns the file; with none
            # indexed there is no nesting to tell apart, so keep matching.
            owner = _innermost_indexed_owner(current)
            if owner is None or owner == target:
                return True
            continue
        if target.startswith(f"{current}/"):
            return True
    return False


def _innermost_indexed_owner(path: str) -> Optional[str]:
    """Longest catalog-listed model path containing *path*, or None if none does."""
    best = None
    for info in _CATALOG_CACHE["models"] or ():
        listed = getattr(info, "path", None)
        if not listed:
            continue
        normalized = _norm_path(listed)
        if path == normalized or path.startswith(f"{normalized}/"):
            if best is None or len(normalized) > len(best):
                best = normalized
    return best


async def _reject_unservable_model(
    requested_model: Optional[str], fastapi_request: Optional[Request]
) -> None:
    """Refuse rather than answer a named model with a different one.

    Only for a reference this server can tell was meant for it: an explicit GGUF
    quant, or a model that is actually here. A namespace decides nothing either way
    (``vendor/model`` is how LiteLLM and OpenRouter name every provider, and a
    standalone GGUF is advertised without one), so a slashless id that resolves
    locally is still a concrete reference. Only runs while something is serving:
    with nothing loaded, :func:`_no_model_loaded_error` already says the right thing.
    """
    from core.inference.openai_auto_download import (
        looks_like_gguf_hub_repo_id,
        looks_like_quant,
        split_model_ref,
    )

    if (
        not isinstance(requested_model, str)
        or not requested_model.strip()
        or requested_model == _RELOAD_ONLY_MODEL
    ):
        return
    base, variant = split_model_ref(requested_model)
    quantified = looks_like_quant(variant)
    gguf_hub_repo = looks_like_gguf_hub_repo_id(base)
    from core.inference.local_model_resolver import (
        index_is_built,
        recently_downloaded,
        resolve_local_gguf,
        warm_index_soon,
    )
    from utils.openai_auto_switch_settings import get_openai_auto_switch_enabled

    still_indexing = False
    try:
        if await asyncio.to_thread(_loaded_satisfies, requested_model):
            return
        if not (
            get_llama_cpp_backend().is_loaded
            or getattr(await asyncio.to_thread(get_inference_backend), "active_model_name", None)
        ):
            return
        # Refresh in the background and read the index as-is: scanning here would stall the
        # request, and a cold index only costs evidence (the gate below fails safe without it).
        if index_is_built():
            warm_index_soon()
            resolved = resolve_local_gguf(requested_model, allow_scan = False)
        else:
            # Nothing cached to reason from yet, and falling through would answer a
            # named model with the resident one. Pay the scan once, off the loop and
            # bounded, rather than read "not scanned yet" as "not here".
            try:
                resolved = await asyncio.wait_for(
                    asyncio.to_thread(resolve_local_gguf, requested_model),
                    _COLD_INDEX_WAIT_S,
                )
            except (TimeoutError, asyncio.TimeoutError):
                # Still scanning, so nothing is known about this name: say "not yet"
                # rather than guess and put the resident model behind it.
                warm_index_soon()
                still_indexing = True
                resolved = None
        # A manual load stores the on-disk path the resolver advertises under an alias,
        # so match on the path too. Quants of one repo share a directory, so the path
        # alone cannot tell them apart: without the variant check an explicit :Q8_0
        # would be answered by a resident Q4_K_M.
        # Off-loop: reads the Transformers singleton, and the llama.cpp short-circuits above
        # skip the offloaded reads, so on a restart this built the singleton on the loop.
        if (
            resolved is not None
            and await asyncio.to_thread(_resolves_to_resident, resolved[0], llama_only = quantified)
            and (not quantified or _resident_quant_is(variant))
        ):
            return
        downloaded = resolved is not None
        # /v1/models may have advertised this id off its own scan while the index is cold.
        advertised = _advertised_local_path(base)
        if (
            advertised is not None
            and await asyncio.to_thread(_resolves_to_resident, advertised, llama_only = quantified)
            and (not quantified or _resident_quant_is(variant))
        ):
            return
        # The exact ref may miss on the quant alone, so ask about the repo too.
        here = (
            downloaded
            or advertised is not None
            # Just landed, so no scan has indexed it yet and neither of the above sees it.
            or recently_downloaded(base)
            or (variant is not None and resolve_local_gguf(base, allow_scan = False) is not None)
        )
        switchable = downloaded and get_openai_auto_switch_enabled()
    except HTTPException:
        # A refusal decided above is the answer, not a failure to decide: without this
        # the handler below logs it and falls through to the resident model.
        raise
    except Exception as exc:
        # Can't verify: an explicit quant still proves intent, so refuse; let anything else by.
        # A catalog-shaped id is not enough here. This path cannot tell "not downloaded" from
        # "the scan broke", so refusing one would 404 models that are downloaded and servable.
        logger.debug("unservable-model check failed for %r: %s", requested_model, exc)
        if not quantified:
            return
        downloaded = here = switchable = False
    if still_indexing:
        _raise_still_indexing(requested_model, fastapi_request)
    if gguf_hub_repo and not (quantified or here):
        # Decisive only against a resident carrying a hub-style id of its own; a
        # directory-loaded model advertises a bare name that no namespaced request
        # can be told apart from. Checked here, not with the other shape tests, so
        # a foreign label never pays for it.
        gguf_hub_repo = await asyncio.to_thread(_resident_id_is_namespaced)
    if not (quantified or here or gguf_hub_repo):
        return
    if switchable:
        # On disk and switching allowed, so the swap failed: the resident model is wrong weights.
        status_code, code = 503, "model_switch_failed"
        message = (
            f"The model '{requested_model}' is downloaded, but this server could not "
            "switch to it. Retry shortly, or load it in Unsloth Studio."
        )
    elif downloaded:
        status_code, code = 404, "model_not_found"
        message = (
            f"The model '{requested_model}' is downloaded but not loaded, and "
            "'Switch model by request' is off, so this server can only serve the "
            "loaded model. Turn it on in Unsloth Studio under Settings > API."
        )
    else:
        status_code, code = 404, "model_not_found"
        try:
            message = await _unavailable_model_message(requested_model)
        except Exception as exc:
            # Only the wording is uncertain; the mismatch is already established.
            logger.debug("unavailable-model diagnosis failed for %r: %s", requested_model, exc)
            message = f"The model '{requested_model}' is not the model this server is serving."
    path = getattr(getattr(fastapi_request, "url", None), "path", None)
    raise HTTPException(
        status_code = status_code,
        detail = (
            error_body_for_path(path, message, status = status_code, code = code, param = "model")
            if isinstance(path, str)
            else message
        ),
        headers = {"Retry-After": "5"} if status_code == 503 else None,
    )


async def _maybe_auto_switch_model(
    requested_model: Optional[str],
    fastapi_request: Request,
    current_subject: str,
    *,
    require_vision: bool = False,
    require_image: bool = True,
    modality_label: str = "image or audio",
) -> None:
    """Load a downloaded local GGUF named by an OpenAI request when auto-switch is on.

    No-op unless enabled and ``requested_model`` resolves to a downloaded local
    model different from the loaded one. Unknown names fall through (drop-in
    compat); a miss only reaches the network when auto-download is also on, and
    even then only for ``namespace/name`` ids. ``require_vision`` rejects a swap
    to a text-only target before it runs, so an image request can't evict the
    resident vision model only to 400 afterwards; ``require_image`` is what makes
    that rejection modality-aware, since an audio request needs the projector but
    not a vision tower. ``modality_label`` names the inputs actually attached, so
    the rejection does not report a modality the request never carried.
    """
    from utils.openai_auto_switch_settings import (
        get_openai_auto_switch_enabled,
        get_model_override,
        idle_unload_is_configured,
        model_override_load_kwargs,
    )
    from core.inference.local_model_resolver import (
        resolve_local_gguf,
        resolve_trusted_cached_local_gguf,
        warm_index_soon,
    )
    from core.inference.llama_keepwarm import (
        get_last_unloaded_model,
        inference_lifecycle_gate,
    )

    # Treat a non-string model (e.g. {"model": 123} on a raw-body endpoint) as
    # absent so it falls through instead of raising in the membership checks below.
    if not isinstance(requested_model, str) or not requested_model:
        return
    # The public preview route opts out so a caller cannot switch away from the
    # pinned preview checkpoint it just loaded.
    scope = getattr(fastapi_request, "scope", None)
    if isinstance(scope, dict) and scope.get(_DISABLE_OPENAI_AUTO_SWITCH_SCOPE_KEY):
        return
    auto_switch_on = get_openai_auto_switch_enabled()
    # The reload-stash path also runs when idle-unload is active on its own (a
    # standalone UNSLOTH_MODEL_IDLE_TTL with auto-switch off), so a model the idle
    # loop freed is restored on the next request. The resolver-based switch still
    # requires the auto-switch toggle.
    # Configured, not effective: residency zeroes the TTL, and the stash still
    # has to be restorable after it is turned on.
    if not auto_switch_on and not idle_unload_is_configured():
        # No switching to do, but a named model must still not be answered by another.
        await _reject_unservable_model(requested_model, fastapi_request)
        return

    # The common Studio path names the model that is already serving. Resolve that
    # from resident state before consulting the filesystem index: rebuilding a stale
    # multi-root index here used to hold the request for seconds before streaming.
    if auto_switch_on and await asyncio.to_thread(_loaded_identity_satisfies, requested_model):
        warm_index_soon()
        return

    async def _resolve_and_switch() -> None:
        # Off the loop: a cold-cache rebuild walks several model dirs + HF caches.
        # With auto-switch off (or an omitted-model reload-only request), skip the
        # resolve so only the reload-stash path runs and no name is ever matched.
        reload_only = requested_model == _RELOAD_ONLY_MODEL
        resolved = None
        if auto_switch_on and not reload_only:
            # Fresh hits and entries retained across an additions-only download are
            # safe to use immediately. An expired/config-invalidated hit, a cold
            # cache, and every miss must refresh before an unrelated resident model
            # can answer or an entry from a removed scan root can trigger a switch.
            resolved = resolve_trusted_cached_local_gguf(requested_model)
            if resolved is not None:
                warm_index_soon()
            else:
                resolved = await asyncio.to_thread(resolve_local_gguf, requested_model)
        if resolved is None:
            # Not on disk. Opt-in: fetch in the background and ask the caller to retry.
            if auto_switch_on and not reload_only:
                await _maybe_auto_download_model(
                    requested_model,
                    fastapi_request,
                    require_vision = require_vision,
                    current_subject = current_subject,
                )
            # Idle-unload may have freed the model; reload exactly what it freed
            # (path + quant + advertised id) so an alias/unknown name stays servable
            # and keeps the override keyed by the advertised id, not the load path.
            last = get_last_unloaded_model()
            # A non-GGUF (Unsloth/Transformers) model loaded after the idle-unload
            # leaves the GGUF slot empty but is the live model, so don't resurrect
            # the stale GGUF over it (that load would tear the active model down).
            if (
                not last
                or get_llama_cpp_backend().is_loaded
                or getattr(
                    await asyncio.to_thread(get_inference_backend), "active_model_name", None
                )
            ):
                return
            if len(last) == 3:
                target_id, variant, override_id = last
            else:  # pre-3-tuple stash: fall back to the path as the override key
                target_id, variant = last
                override_id = target_id
        else:
            # load_path is a concrete local path (never the bare repo id), so /load
            # takes the local branch and cannot trigger a download. override_id is the
            # advertised repo id, the launch-override key and the public model id.
            target_id, variant, override_id = resolved
        backend = get_llama_cpp_backend()
        # A bare model id (no :VARIANT) is satisfied by any loaded quant of that
        # repo, so it never reloads a different local quant that already serves it.
        from core.inference.openai_auto_download import looks_like_quant, split_model_ref

        # A tag that names no quant (":latest", ":8b") means the repo, as
        # _loaded_satisfies and the resolver read it. Treating it as a quant tears down
        # a serving Q8 to load the preferred Q4 for a request either satisfies.
        _, _requested_variant = split_model_ref(requested_model)
        bare = not looks_like_quant(_requested_variant)

        def _already_serving() -> bool:
            # Match against both the concrete load path and the advertised repo id,
            # so a model loaded manually by repo id (identifier = repo id) and one
            # loaded by auto-switch (identifier = path, advertised = repo id) both
            # count as already serving rather than triggering a needless reswap.
            if not backend.is_loaded or not backend.model_identifier:
                return False
            loaded_keys = {backend.model_identifier.lower()}
            advertised = getattr(backend, "_openai_advertised_id", None)
            if advertised:
                loaded_keys.add(advertised.lower())
            if loaded_keys.isdisjoint({target_id.lower(), override_id.lower()}):
                return False
            if bare:
                return True
            if variant:
                loaded_variant = (getattr(backend, "hf_variant", None) or "").lower()
                return loaded_variant == variant.lower()
            return True

        def _record_serving_alias() -> None:
            # When an advertised alias already resolves to the loaded model (e.g. a
            # model loaded by local path, requested by its repo/LM Studio id), record
            # the alias as the public id so /v1/models and responses report it (and
            # mark it loaded) instead of the path-derived basename. Resolver branch
            # only: the reload-stash override_id can be the bare path, not a repo id.
            # Lock-free is safe here: an in-flight request blocks any concurrent swap
            # (single-slot busy guard), so the loaded model can't change under this.
            if resolved is None or not override_id:
                return
            b = get_llama_cpp_backend()
            if getattr(b, "_openai_advertised_id", None) != override_id:
                b._openai_advertised_id = override_id

        if _already_serving():
            _record_serving_alias()
            return
        # An image/audio request naming a different text-only GGUF would load it
        # here and only 400 below, evicting the working model. Reject before the
        # swap. Only the resolver branch (an explicit new target); the reload-stash
        # path just restores the model the request was already using. Both vision and
        # audio input come from a companion mmproj (a filesystem probe) -- run it off
        # the loop, like the resolver above.
        if (
            require_vision
            and resolved is not None
            and not await asyncio.to_thread(_target_is_vision, target_id, variant, require_image)
        ):
            raise HTTPException(
                status_code = 400,
                detail = openai_error_body(
                    f"The requested model does not support the {modality_label} input in this request.",
                    status = 400,
                    code = "invalid_value",
                    param = "model",
                ),
            )
        key = _switch_key(override_id, variant)
        _note_switch_waiter(key, 1)
        waiter_noted = True
        try:
            async with _auto_switch_lock():
                # The asyncio lock is per loop; add a process-wide gate so a swap on
                # another loop in this process can't race the single slot.
                await _acquire_swap_gate()
                try:
                    # Hold the keep-warm gate across the swap so no new inference can
                    # start on the model while it is being torn down and replaced.
                    async with inference_lifecycle_gate():
                        if _already_serving():
                            _record_serving_alias()
                            return
                        # Apply the saved launch config so an API swap loads as the picker
                        # would. Order: variant-qualified keys before bare ids, and the
                        # load path before the advertised id, since the settings UI keys
                        # local rows by that path while override_id is a derived alias, so
                        # reading the alias first let an older entry shadow a fresh save. A
                        # cached repo has no path entry and resolves on the second try; an
                        # early build keyed a loose .gguf by its filename label, so
                        # "<path>:LABEL" is read too, after the bare path used today.
                        from utils.openai_auto_switch_settings import (
                            resolve_override_for_load,
                        )

                        # The candidate order above, kept in one place so the panel
                        # showing a user what a load will apply reads the same row.
                        _override_key, override = resolve_override_for_load(
                            target_id, override_id, variant
                        )
                        load_kwargs = {"model_path": target_id, "gguf_variant": variant}
                        load_kwargs.update(
                            model_override_load_kwargs(
                                override,
                                # Set for every GGUF the resolver returns; the reload
                                # stash carries the quant it froze.
                                is_gguf = bool(variant) or target_id.lower().endswith(".gguf"),
                            )
                        )
                        saved_gpu_ids = load_kwargs.get("gpu_ids")
                        if saved_gpu_ids and not await _override_gpu_ids_still_resolve(
                            saved_gpu_ids
                        ):
                            # Stale pin (GPU removed, another host): drop the one dead
                            # field rather than 400 the whole load.
                            load_kwargs.pop("gpu_ids", None)
                            logger.warning(
                                "Dropping saved gpu_ids %s for %s: not available here.",
                                saved_gpu_ids,
                                override_id,
                            )
                        # Reuse the load impl so its dedup, tensor fallback, and threading
                        # apply. Call the impl directly: we already hold the lifecycle gate
                        # the /load route would otherwise take, so the route would deadlock.
                        try:
                            await _load_model_impl(
                                LoadRequest(**load_kwargs),
                                fastapi_request,
                                current_subject,
                                current_request_counted = True,
                            )
                        except HTTPException as exc:
                            # The pre-flight check cannot mirror every loader gpu_ids rule,
                            # and a stale pin must never block a request, so retry without it.
                            if not (
                                exc.status_code == 400
                                and load_kwargs.get("gpu_ids")
                                and "gpu" in str(exc.detail).lower()
                            ):
                                raise
                            logger.warning(
                                "Retrying %s without saved gpu_ids %s: %s",
                                override_id,
                                load_kwargs.get("gpu_ids"),
                                exc.detail,
                            )
                            load_kwargs.pop("gpu_ids", None)
                            await _load_model_impl(
                                LoadRequest(**load_kwargs),
                                fastapi_request,
                                current_subject,
                                current_request_counted = True,
                            )
                        # Advertise the repo id (not the concrete load path) as the loaded
                        # model's public id and override key for /v1/models and idle stash.
                        get_llama_cpp_backend()._openai_advertised_id = override_id
                        # API provenance: idle auto-unload may free this one even when
                        # scoped to API loads.
                        get_llama_cpp_backend()._loaded_by_user_action = False
                finally:
                    # Deregister before releasing the gate: otherwise a swap on another
                    # loop counts this finished request as queued and unloads its model.
                    _note_switch_waiter(key, -1)
                    waiter_noted = False
                    _auto_switch_process_lock.release()
        finally:
            if waiter_noted:
                _note_switch_waiter(key, -1)

    await _resolve_and_switch()
    # The switch may have missed, so refuse rather than answer as whatever is resident.
    await _reject_unservable_model(requested_model, fastapi_request)


async def _auto_switch_from_request_body(request: Request, current_subject: str):
    """Run auto-switch from a raw-body endpoint's ``model`` without changing its
    pre-feature status codes: a malformed/non-dict body yields no model (so an
    unloaded backend still 503s, not 500), and the caller re-reads to surface the
    original parse error after the loaded-state check. Returns the parsed body, or
    None if it could not be parsed."""
    try:
        body = await request.json()
    except (json.JSONDecodeError, ValueError):
        return None
    if isinstance(body, dict):
        # A raw-body client may omit ``model`` and rely on the loaded backend. Pass
        # a reload-only sentinel so the idle-stash reload still runs (an idle-freed
        # model is restored) without the resolver ever matching a real name.
        model = body.get("model") or _RELOAD_ONLY_MODEL
    else:
        model = None
    await _maybe_auto_switch_model(model, request, current_subject)
    return body


def _effective_load_in_4bit(config: ModelConfig, requested: bool) -> bool:
    """Effective quantization the loader will use: a LoRA adapter can flip 4-bit to
    16-bit via adapter_config.json, so the guard sizes this, not the raw request."""
    load_in_4bit = requested
    if not getattr(config, "is_lora", False) or not getattr(config, "path", None):
        return load_in_4bit
    adapter_cfg_path = Path(config.path) / "adapter_config.json"
    if not adapter_cfg_path.exists():
        return load_in_4bit
    try:
        with open(adapter_cfg_path, encoding = "utf-8-sig") as f:
            adapter_cfg = json.load(f)
        if not isinstance(adapter_cfg, dict):  # malformed -> keep requested
            return load_in_4bit
    except Exception as e:
        logger.warning(f"Could not read adapter_config.json: {e}")
        return load_in_4bit
    training_method = adapter_cfg.get("unsloth_training_method")
    if training_method == "lora":
        return False
    if training_method == "qlora":
        return True
    if not training_method and config.base_model and "-bnb-4bit" not in config.base_model.lower():
        return False
    return load_in_4bit


def _remote_gguf_companion_bytes(
    repo: str,
    *,
    hf_token: Optional[str],
    include_mmproj: bool,
    include_mtp: bool = True,
    include_dspark: bool = False,
    include_dflash: bool = False,
    dspark_first: bool = False,
    weight_bytes: int = 0,
) -> int:
    """Bytes of companion GGUFs the requested launch keeps resident. 0 on error.

    ``dspark_first`` says this is an Auto load, which is the only caller that can
    ask for several drafter kinds at once, so the loader's promotion order gets
    to say which single one is charged: DSpark, else DFlash, else the MTP
    drafter. The loader replaces mtp_draft_path with whichever kind wins the
    promotion, so at most one drafter is ever launched; a sidecar that is fetched
    and then not opened costs disk, not VRAM, and this guard sizes VRAM. Off, the
    caller has already narrowed the request to one kind and the sum is that kind.
    """
    try:
        from core.inference.llama_cpp import (
            _gguf_extra_shards,
            _is_dspark_drafter_path,
            _is_root_dflash_drafter_path,
        )
        from huggingface_hub import model_info
        from utils.models.drafters import dflash_budget_bytes, split_listing_is_complete
        from utils.models.model_config import dspark_preference_key

        info = model_info(repo, token = hf_token, files_metadata = True)
        total = 0
        mtp_bytes = 0
        dspark_candidates: list[tuple[str, int]] = []
        dflash_sizes: dict[str, int] = {}
        for sibling in info.siblings or []:
            name = sibling.rfilename or ""
            base = Path(name).name.lower()
            if not base.endswith(".gguf"):
                continue
            size = getattr(sibling, "size", 0) or 0
            # Root-level mtp- only: -hf auto-fetches the repo-root drafter, not
            # the MTP/ subdir copies (which now share the mtp- prefix too).
            is_root_mtp = "/" not in name and base.startswith("mtp-")
            if include_mtp and is_root_mtp:
                mtp_bytes += size
            elif include_mmproj and "mmproj" in base:
                total += size
            if include_dspark and _is_dspark_drafter_path(name):
                dspark_candidates.append((name, size))
            # Root level only, exactly as _download_dflash's picker is: a nested
            # dflash-*.gguf is an ordinary weight there and never a candidate, so
            # counting it here would price a file the load cannot fetch.
            if include_dflash and _is_root_dflash_drafter_path(name):
                dflash_sizes[name] = size
        # The download's preference order, by whole shard SET: llama-server maps every
        # shard, so pricing the picked one halved a two-shard sidecar and let the guard
        # admit a load that evicts the training run. Incomplete sets are dropped, not
        # priced, since the fetch refuses them.
        _dspark_sizes = dict(dspark_candidates)
        dspark_families = [
            (
                name,
                size
                + sum(_dspark_sizes.get(s, 0) for s in _gguf_extra_shards(_dspark_sizes, name)),
            )
            for name, size in dspark_candidates
            if split_listing_is_complete(_dspark_sizes, name)
        ]
        dspark_bytes = (
            min(dspark_families, key = lambda c: dspark_preference_key(c[0]))[1]
            if dspark_families
            else 0
        )
        # Bounded rather than picked: see dflash_budget_bytes for why the max
        # over whole shard sets is the answer a listing can give. Bounded by the
        # target too, so the guard stops charging for the oversized candidates the
        # fetch itself now refuses.
        dflash_bytes = dflash_budget_bytes(dflash_sizes, _gguf_extra_shards, weight_bytes)
        if not dspark_first:
            return total + mtp_bytes + dspark_bytes + dflash_bytes
        if dspark_families:
            # DSpark takes first refusal in the Auto promotion, so a listed
            # sidecar settles the load: the DFlash fetch stands down and
            # mtp_draft_path is replaced by the DSpark one. Charging the other
            # two is not the safe over-estimate it is for a repo whose listing
            # has not answered yet, it is a 409 for a load that fits. Only a
            # COMPLETE set settles it, since the fetch falls through to DFlash on
            # one it has to reject, and that one can be the larger of the two.
            return total + dspark_bytes
        if dflash_sizes:
            # DFlash is the other Auto promotion and replaces mtp_draft_path the
            # same way, so the two are never resident together. Which of them it
            # is stays genuinely unknown here: every DFlash candidate can still be
            # turned away on its header, and the load then keeps the MTP drafter
            # it has already fetched. The larger of the two covers both outcomes.
            return total + max(dflash_bytes, mtp_bytes)
        return total + mtp_bytes
    except Exception as e:
        logger.warning(f"Could not size GGUF companions for {repo}: {e}")
        return 0


# What an unreadable remote drafter costs the guard. Sized to the largest drafter
# class Studio knows of (a DSpark sidecar is about 11 GB) rather than a typical one,
# since --spec-draft-hf names any repo and over-estimating is this guard's direction.
# Only reached when the listing cannot be read, where llama-server may still open the
# repo from the local HF cache and make every one of those bytes resident.
_REMOTE_DRAFTER_RESERVE_BYTES = 12 * 1024**3


def _split_hf_draft_spec(spec: str) -> tuple[Optional[str], str]:
    """``<user>/<model>[:quant]`` -> (repo id, lowercased narrowing hint).

    llama.cpp's common_download_split_repo_tag splits the value on ':', keeps the
    tail as the quant tag and then requires the head to be exactly
    ``<user>/<model>``, so that is the shape a listing can be asked for. A
    trailing ``/<file>.gguf`` is not that shape and llama.cpp rejects it, but it
    is a common way to write the flag, and reading the repo out of it prices a
    real download instead of falling straight to the flat reserve. Repo None when
    nothing repo-shaped is left, which the caller charges as the reserve.
    """
    repo, sep, tag = (spec or "").strip().partition(":")
    parts = [p for p in repo.split("/") if p]
    hint = tag.strip().lower() if sep else ""
    if len(parts) > 2 and parts[-1].lower().endswith(".gguf"):
        hint = parts[-1].lower()
        parts = parts[:2]
    if len(parts) != 2:
        return None, ""
    return "/".join(parts), hint


def _remote_drafter_repo_bytes(spec: str, *, hf_token: Optional[str]) -> int:
    """Bytes to charge for a drafter named as an HF repo (--spec-draft-hf/-hfd).

    llama-server downloads that repo and loads the drafter out of it exactly as
    it does the target model, so it is resident VRAM, but there is no local file
    to stat before the load and the target repository's own listing says nothing
    about it. Bounded rather than picked, for the reason dflash_budget_bytes
    documents and with its arithmetic: which file the fetch lands on is not
    knowable from a listing, so the largest WHOLE shard set is the answer a
    listing can give, and a split set is charged as the set because llama-server
    maps every shard.

    Any failure -- no network, gated repo, malformed id, a repo listing no GGUF
    -- falls back to the flat reserve. This guard protects a running training
    job, so an unreadable listing must not become a silent charge of zero for a
    drafter the launch is certainly going to bring in.
    """
    repo, hint = _split_hf_draft_spec(spec)
    if not repo:
        return _REMOTE_DRAFTER_RESERVE_BYTES
    try:
        from core.inference.llama_cpp import _gguf_extra_shards
        from huggingface_hub import model_info
        from utils.models.drafters import dflash_budget_bytes, split_listing_is_complete

        info = model_info(repo, token = hf_token, files_metadata = True)
        sizes: dict[str, int] = {}
        for sibling in info.siblings or []:
            name = sibling.rfilename or ""
            if not Path(name).name.lower().endswith(".gguf"):
                continue
            sizes[name] = getattr(sibling, "size", 0) or 0
        if hint:
            # llama.cpp's own narrowing: bounding over the rest of the repo would
            # charge an F16 for a Q4 drafter. A tag matching nothing has told us
            # nothing (repos label quants inconsistently), so every candidate returns.
            # Matched on the full relative name, or the quant-subdirectory layout
            # (Q4_K_M/model.gguf) restores every quant and charges the F16.
            matched = {n: s for n, s in sizes.items() if hint in n.lower()}
            sizes = matched or sizes
        # require_full_sizes: a partially sized family would be charged its known
        # shards, and the cache measurement then the reserve both beat a partial sum.
        bounded = dflash_budget_bytes(sizes, _gguf_extra_shards, require_full_sizes = True)
        if bounded:
            return bounded
        # Zero from a listing that named GGUFs means one of two things. Every family
        # is an incomplete split, so the fetch can load none of them and zero is right.
        # Otherwise a family does load and the listing did not say how big, which is
        # the cache-then-reserve case below, not a free load.
        if sizes and not any(split_listing_is_complete(sizes, name) for name in sizes):
            return 0
    except Exception as e:
        logger.warning(f"Could not size remote drafter repo {spec}: {e}")
    # An unreadable listing is usually a repo already in the local HF cache, which is
    # what lets llama-server open it with the Hub down. Measure it: --spec-draft-hf
    # takes any repo, so a 30 GB GGUF is a legal value and the flat reserve undercounts.
    cached = _cached_repo_gguf_bytes(repo, hint)
    if cached:
        return cached
    # Neither listable nor cached: llama-server would download it over the Hub that
    # just refused us, so the reserve is a cushion, not a bound on resident bytes.
    return _REMOTE_DRAFTER_RESERVE_BYTES


def _cached_repo_gguf_bytes(repo: str, hint: str = "") -> int:
    """Largest whole GGUF shard set already on disk for ``repo``, else 0.

    Same bound as the listing path, taken from the local Hugging Face cache, so a
    drafter llama-server can open offline is charged at its real size rather than
    a class-based guess. ``hint`` narrows exactly as it does there: a repo holding
    several quants would otherwise be charged its F16 for a :Q4_K_M request.
    """
    try:
        from huggingface_hub import scan_cache_dir

        from core.inference.llama_cpp import _gguf_extra_shards
        from utils.models.drafters import dflash_budget_bytes

        # The cache Studio is pointed at now, not the one huggingface_hub resolved at
        # import: a moved cache is where the drafter that will load actually is.
        try:
            from utils.hf_cache_settings import active_hf_hub_cache
            _cache_dir: Optional[str] = active_hf_hub_cache()
        except Exception:
            _cache_dir = None

        sizes: dict[str, int] = {}
        for cached_repo in scan_cache_dir(cache_dir = _cache_dir).repos:
            if (cached_repo.repo_id or "").lower() != repo.lower():
                continue
            # One revision, not every snapshot on disk: llama-server resolves the ref
            # it was asked for, so merging stale ones charges a quant replaced months
            # ago and 409s a load that fits. Prefer the ref, else the newest.
            revisions = list(cached_repo.revisions)
            chosen = next(
                (
                    r
                    for r in revisions
                    if "main" in {str(x) for x in (getattr(r, "refs", None) or ())}
                ),
                None,
            ) or max(revisions, key = lambda r: getattr(r, "last_modified", 0) or 0, default = None)
            for f in getattr(chosen, "files", ()) or ():
                name = str(f.file_name)
                if name.lower().endswith(".gguf"):
                    sizes[name] = max(sizes.get(name, 0), int(f.size_on_disk or 0))
        if hint:
            sizes = {n: b for n, b in sizes.items() if hint in n.lower()} or sizes
        return dflash_budget_bytes(sizes, _gguf_extra_shards)
    except Exception as e:
        logger.warning(f"Could not measure the cached drafter repo {repo}: {e}")
        return 0


# Upper bound on any current tokenizer, used to rebuild the compute buffer when a
# truncated header drops the token array. Above Llama 4 / Gemma 3 (256k), the widest shipping.
_ASSUMED_MAX_VOCAB = 262144


def _estimate_gguf_kv_gb(
    gguf_path: str,
    max_seq_length: int,
    llama_extra_args: Optional[list[str]] = None,
    n_parallel: int = 1,
    cache_type_kv: Optional[str] = None,
    tensor_parallel: bool = False,
    n_batch: Optional[int] = None,
    n_ubatch: Optional[int] = None,
    n_devices: int = 1,
    is_diffusion: bool = False,
) -> float:
    """KV-cache plus compute-buffer VRAM (GB) at the larger of max_seq_length and
    any `--ctx-size`/`-c` override, over n_parallel slots at the effective
    micro-batch, using the effective cache settings and managed launcher
    defaults. Compute buffers scale with the split the loader budgets: tensor
    mode reserves them on every device, a multi-GPU layer split replicates the
    context-linear term; ``is_diffusion`` skips them, since the diffusion
    runner ignores the llama-server batch flags. 0 if metadata is unreadable."""
    try:
        from core.inference.llama_server_args import parse_ctx_override

        probe = LlamaCppBackend()
        probe._read_gguf_metadata(gguf_path)
        if not probe._can_estimate_kv():
            return 0.0
        try:
            ctx_override = parse_ctx_override(llama_extra_args) or 0
        except Exception:
            ctx_override = 0  # malformed extras are rejected upstream; fall back
        ctx = max(max_seq_length or 0, ctx_override) or (probe._context_length or 0)
        if ctx <= 0:
            return 0.0
        slots = max(1, n_parallel or 1)
        planned_cache_types = _planned_main_cache_types(
            cache_type_kv,
            llama_extra_args,
        )
        if tensor_parallel and any(
            cache_type not in LlamaCppBackend._TENSOR_PARALLEL_KV_TYPES
            for cache_type in planned_cache_types
        ):
            # Tensor mode strips quantized axes, but a layer fallback restores
            # the original settings. Size for the larger successful outcome.
            tensor_cache_types = _planned_main_cache_types(None, None)
            cache_type_for_budget = max(
                (*planned_cache_types, *tensor_cache_types, "f16"),
                key = _kv_bytes_per_elem,
            )
        else:
            cache_type_for_budget = max(
                planned_cache_types,
                key = _kv_bytes_per_elem,
            )
        # the loader raises --batch-size to max(slots, 2) before launch, and llama.cpp
        # caps the micro-batch against it, so budget from the emitted value. Diffusion
        # takes neither flag, and SWA metadata prices the KV against the micro-batch,
        # so consuming them here would charge a diffusion load for a batch it never
        # runs. Gated like the remote branch already is.
        effective_ubatch = (
            None
            if is_diffusion
            else _extra_args_n_ubatch(
                llama_extra_args,
                n_ctx = ctx,
                n_batch = _emitted_n_batch(n_batch, slots),
                n_ubatch = n_ubatch,
            )
        )
        # --embedding makes llama-server cap n_batch to n_ubatch. The loader
        # therefore reduces slots to the same value before fitting; admission
        # must price the process that will launch, not the original request.
        if (
            getattr(probe, "is_embedding_gguf", False)
            and effective_ubatch is not None
            and effective_ubatch < slots
        ):
            slots = max(1, effective_ubatch)
            effective_ubatch = _extra_args_n_ubatch(
                llama_extra_args,
                n_ctx = ctx,
                n_batch = _emitted_n_batch(n_batch, slots),
                n_ubatch = n_ubatch,
            )
        managed_kv_unified = bool(
            slots > 1
            and LlamaCppBackend.probe_server_capabilities().get("supports_kv_unified", False)
        )
        kv = probe._estimate_kv_cache_bytes(
            ctx,
            cache_type_for_budget,
            n_parallel = slots,
            swa_full = _swa_full_from_args_or_env(llama_extra_args),
            kv_unified = _kv_unified_from_args(
                llama_extra_args,
                default = managed_kv_unified,
            ),
            n_ubatch = effective_ubatch,
            flash_attn = False,
        )
        # the load reserves ubatch-scaled compute buffers, so they count against training too
        if is_diffusion:
            return kv / (1024**3)
        devices = max(1, int(n_devices))

        def _flat_buffer(per_device_tensor: bool) -> int:
            """Flat compute buffer, rebuilt when the header is short of a vocab size.

            _estimate_compute_buffer_bytes returns 0 when vocab_size or embedding_length is
            missing. Only the first is reachable: _vocab_size is set solely from the
            tokenizer.ggml.tokens array length, which a truncated header drops while keeping
            the dims. So rebuild from the real formula with a vocab ceiling rather than
            substituting the loader's flat reserve. The loader can afford that reserve
            because over-reserving there just shrinks the context; here it denies the load.
            """
            flat = probe._estimate_compute_buffer_bytes(
                n_ubatch = effective_ubatch,
                n_parallel = slots,
                per_device_tensor = per_device_tensor,
            )
            if flat > 0:
                return flat
            # getattr: a bare backend double carries neither dims nor constants.
            n_embd = getattr(probe, "_embedding_length", None) or 0
            if n_embd <= 0:
                return 0  # nothing to rebuild from; the total is floored below instead
            ub = max(1, int(effective_ubatch or probe._DEFAULT_N_UBATCH))
            act_scratch = 4 * n_embd * ub * 4
            out_buffer = _ASSUMED_MAX_VOCAB * ub * 4
            output_slots = (
                slots if getattr(probe, "is_embedding_gguf", False) else max(0, slots - 1)
            )
            raw = (
                2 * act_scratch + out_buffer * slots
                if per_device_tensor
                else act_scratch + out_buffer * output_slots
            )
            return int(raw * probe._COMPUTE_BUFFER_SAFETY)

        if tensor_parallel:
            # mirrors _plan_tensor_parallel: per-device buffer and ctx growth on every device
            compute = devices * (
                _flat_buffer(True)
                + probe._compute_buffer_ctx_bytes(ctx, effective_ubatch, cache_type_for_budget)
            )
        else:
            # mirrors the layer fit: flat buffer once, then per extra device, ctx growth per
            # device. layer_split follows the loader's own condition: extras that disable
            # pipeline parallelism (-ot, -ncmoe, --no-kv-offload) leave one KQ-mask copy.
            from core.inference.llama_cpp import _pipeline_parallel_disabled_by_args
            pipeline_parallel_off = _pipeline_parallel_disabled_by_args(
                llama_extra_args, n_layers = getattr(probe, "_n_layers", None)
            )
            compute = (
                _flat_buffer(False)
                + (devices - 1) * probe._PIPELINE_PER_DEVICE_OVERHEAD_MIB * 1024 * 1024
                + devices
                * probe._compute_buffer_ctx_bytes(
                    ctx,
                    effective_ubatch,
                    cache_type_for_budget,
                    layer_split = devices > 1 and not pipeline_parallel_off,
                )
            )
        if compute <= 0:
            # No embedding_length, so both compute terms are blind while the launch still
            # reserves buffers. Floor at the loader's flat reserve, charged once: it is an
            # invented number, and scaling an invention per device has no basis.
            compute = int(getattr(probe, "_TENSOR_PARALLEL_BUFFER_RESERVE_MIB", 0)) * 1024**2
        return (kv + compute) / (1024**3)
    except Exception as e:
        logger.warning(f"Could not size GGUF KV cache for training guard: {e}")
        return 0.0


def _remote_gguf_compute_reserve_gb(
    llama_extra_args: Optional[list[str]] = None,
    max_seq_length: int = 0,
    n_parallel: int = 1,
    n_batch: Optional[int] = None,
    n_ubatch: Optional[int] = None,
    n_devices: int = 1,
    tensor_parallel: bool = False,
    is_diffusion: bool = False,
) -> float:
    """Compute buffers a remote GGUF will reserve, in GB.

    Split out of _estimate_gguf_required_gb so a caller that is pricing something
    else, a drafter for instance, can hold it at zero the way it already holds
    _estimate_gguf_kv_gb at zero. The arithmetic is unchanged.
    """
    # remote dims are unreadable; only the kq mask, linear in ubatch x ctx, can be sized here
    from core.inference.llama_server_args import parse_ctx_override

    try:
        ctx_override = parse_ctx_override(llama_extra_args) or 0
    except Exception:
        ctx_override = 0
    ctx = max(max_seq_length or 0, ctx_override)
    effective_ubatch = (
        None
        if is_diffusion
        else _extra_args_n_ubatch(
            llama_extra_args,
            n_ctx = ctx if ctx > 0 else None,
            # same floor raise the loader applies at launch
            n_batch = _emitted_n_batch(n_batch, n_parallel),
            n_ubatch = n_ubatch,
        )
    )
    if effective_ubatch is None and not is_diffusion:
        effective_ubatch = LlamaCppBackend._DEFAULT_N_UBATCH
    if effective_ubatch:
        # auto context: assume the native one fits at least a full micro-batch
        budget_ctx = ctx if ctx > 0 else effective_ubatch
        devices = max(1, int(n_devices))
        # A multi-device layer split materialises the KQ mask _CTX_COMPUTE_SPLIT_MULT
        # times, the same step _compute_buffer_ctx_bytes applies locally; charging
        # the single-copy rate under-reserved 4x. Tensor mode is already correct
        # (measured at the single-device rate, replicated per device). n_layers is
        # None here: the header is unread, so -ngl cannot be resolved, but -ot /
        # -ncmoe / --no-kv-offload / -sm none still register. Without this gate the
        # same model 409s while remote and loads once cached.
        from core.inference.llama_cpp import _pipeline_parallel_disabled_by_args

        split_mult = (
            LlamaCppBackend._CTX_COMPUTE_SPLIT_MULT
            if devices > 1
            and not tensor_parallel
            and not _pipeline_parallel_disabled_by_args(llama_extra_args, n_layers = None)
            else 1
        )
        mask_bytes = (
            budget_ctx
            * effective_ubatch
            * 2
            * LlamaCppBackend._CTX_COMPUTE_F16_MASK_SAFETY
            * devices
            * split_mult
        )
        # The mask is only the context-linear half. The flat half needs the dims,
        # which are unreadable remotely, but its dominant term needs just a vocab
        # ceiling: llama.cpp reserves n_vocab * ubatch * 4 per slot past the first
        # (every slot under tensor mode), so n_batch = n_ubatch = 32768 on two
        # slots is ~32 GiB the mask does not cover. Omitting it let the guard admit
        # an uncached load that then OOMs the training job it exists to protect.
        # The activation scratch needs embedding_length and stays uncharged: it is
        # the small half, and over-reserving here denies the load outright.
        # Scaled per device only in tensor mode, mirroring the local branch: a
        # layer split folds the flat buffer in once (_flat_buffer(False)), and
        # only tensor mode replicates it on every card.
        # The remote header is unknown, so reserve as if it enables embeddings.
        _out_slots = max(1, n_parallel)
        out_buffer_bytes = (
            _ASSUMED_MAX_VOCAB
            * effective_ubatch
            * 4
            * _out_slots
            * (devices if tensor_parallel else 1)
            * LlamaCppBackend._COMPUTE_BUFFER_SAFETY
        )
        return (mask_bytes + out_buffer_bytes) / (1024**3)
    return 0.0


def _estimate_gguf_required_gb(
    config: ModelConfig,
    hf_token: Optional[str] = None,
    max_seq_length: int = 0,
    llama_extra_args: Optional[list[str]] = None,
    speculative_type: Optional[str] = None,
    n_parallel: int = 1,
    cache_type_kv: Optional[str] = None,
    tensor_parallel: bool = False,
    n_batch: Optional[int] = None,
    n_ubatch: Optional[int] = None,
    n_devices: int = 1,
    is_diffusion: bool = False,
) -> Optional[float]:
    """Approximate GGUF VRAM (GB): quantized weights + companions, plus the KV
    cache for local files (unreadable pre-download for remote). None when nothing
    resolves so the caller default-denies."""
    try:
        from core.inference.llama_cpp import (
            _canonicalize_spec_mode,
            _extra_args_draft_offloaded_to_cpu,
            _extra_args_mtp_draft_path,
            _extra_args_mtp_draft_source,
            _extra_args_requests_dflash,
            _extra_args_requests_dspark,
            _extra_args_set_spec_type,
        )

        _spec_mode = _canonicalize_spec_mode(speculative_type) or "auto"
        _extra_args_own_spec = _extra_args_set_spec_type(llama_extra_args)
        # Extras owning --spec-type end _build_speculative_flags before any mode
        # branch. On its own that keeps the conservative charge, since a drafter can
        # still arrive by a route this cannot see.
        _extras_own_draft_path = _extra_args_mtp_draft_path(llama_extra_args, env = {})
        # An extras draft path wins whether or not they own --spec-type: the launch
        # appends the caller's flags after Studio's, so last-wins leaves exactly one
        # --model-draft resident. It is charged as _extras_bytes below, so charging
        # the repository's sidecar too is a double count that 409s a load that fits.
        _extras_own_drafter = bool(_extras_own_draft_path)
        # -ngld 0 / --spec-draft-device cpu applies to whichever separate drafter
        # launches, Studio's included, so none of them belongs in a VRAM budget. An
        # embedded head ignores draft-only flags and is inside the weights anyway.
        _draft_pinned_to_cpu = _extra_args_draft_offloaded_to_cpu(llama_extra_args, env = os.environ)
        _forced_dspark = bool(
            (_spec_mode == "dspark" or _extra_args_requests_dspark(llama_extra_args, env = {}))
            and not _extras_own_drafter
            and not _draft_pinned_to_cpu
        )
        # Auto loads the sidecar whenever the model has one, so size it there too
        # or the guard admits a load 11 GB larger than it estimated.
        _auto_dspark = _spec_mode == "auto" and not _extras_own_drafter and not _draft_pinned_to_cpu
        _dspark_capable = True
        if _forced_dspark or _auto_dspark:
            # Gate on the same answer the loader uses: _download_dspark skips the
            # sidecar on a binary without usable draft-dspark, so charging its
            # ~11 GB here would refuse a load that never opens it. Probed for Auto
            # too, not just an explicit request: a remote config has no
            # gguf_dspark_file until the listing, so keying the probe on that would
            # leave the remote Auto charge ungated. An unreadable probe keeps the
            # sidecar counted, since this guard protects a running training job and
            # default-denies.
            try:
                _dspark_capable = bool(
                    LlamaCppBackend.probe_server_capabilities().get("supports_dspark")
                )
            except Exception:
                pass
        dspark_requested = bool(
            _dspark_capable
            and (_forced_dspark or (_auto_dspark and getattr(config, "gguf_dspark_file", None)))
        )
        # DFlash: same shape as DSpark above, and Auto sizes it for the same
        # reason. The sidecar is ~1.5 GiB rather than ~11 GB, but a guard that
        # protects a running training job still has to charge for it.
        _forced_dflash = bool(
            (
                _extra_args_requests_dflash(llama_extra_args, env = {})
                or (_spec_mode == "dflash" and not _extra_args_own_spec)
            )
            and not _extras_own_drafter
            and not _draft_pinned_to_cpu
        )
        # Two independent ways Auto never reaches DFlash: extras owning --spec-type
        # return before any mode branch, and extras naming their own drafter are the
        # drafter the loader uses instead of a discovered sidecar.
        _auto_dflash = (
            _spec_mode == "auto"
            and not _extra_args_own_spec
            and not _extras_own_drafter
            and not _draft_pinned_to_cpu
        )
        _dflash_capable = True
        if _forced_dflash or _auto_dflash:
            try:
                _dflash_capable = bool(
                    LlamaCppBackend.probe_server_capabilities().get("supports_dflash")
                )
            except Exception:
                pass
        # DSpark keeps first refusal under Auto, mirroring the loader.
        dflash_requested = bool(
            _dflash_capable
            and not dspark_requested
            and (_forced_dflash or (_auto_dflash and getattr(config, "gguf_dflash_file", None)))
        )
        # Forced DSpark on a binary that cannot run it falls back to --spec-default,
        # which loads no drafter at all, so charging the MTP one would refuse a load
        # that fits. Auto is different: it falls through to the MTP branch, and keeps
        # its charge.
        _charge_no_drafter = (
            _draft_pinned_to_cpu
            or _extras_own_drafter
            or (_forced_dspark and not _dspark_capable)
            or (_forced_dflash and not _dflash_capable)
        )

        def _same_file_key(p: str) -> str:
            # Identity by resolved path, so a symlinked or differently spelled
            # copy of one file is still one file.
            try:
                return os.path.realpath(p)
            except OSError:
                return str(p)

        total_bytes = 0
        # Only the files already charged above, so the extras drafter below can
        # tell "another sidecar" from "the one discovery already found".
        _sized_keys: set[str] = set()
        main = getattr(config, "gguf_file", None)
        if main and Path(main).is_file():
            total_bytes += LlamaCppBackend._get_gguf_size_bytes(str(main))
            _sized_keys.add(_same_file_key(str(main)))
        # Only the drafter the launch will load: the modes are exclusive, and a
        # 10 GB DSpark sidecar merely sitting on disk must not inflate the guard
        # for a load that never opens it.
        _sized_attrs = ["gguf_mmproj_file"]
        if not _charge_no_drafter:
            if dspark_requested:
                _sized_attrs.append("gguf_dspark_file")
            elif dflash_requested:
                # Only when extras own --spec-type: _build_speculative_flags then
                # returns before discovery's sidecar is emitted, so llama-server opens
                # theirs alone. Without it Studio emits its own too and which lands is
                # unknown, so both stay charged.
                _manual_draft = (
                    _extra_args_mtp_draft_path(llama_extra_args, env = {})
                    if _extra_args_own_spec
                    else None
                )
                _configured = getattr(config, "gguf_dflash_file", None)
                if not (
                    _manual_draft
                    and _configured
                    and _same_file_key(str(_manual_draft)) != _same_file_key(str(_configured))
                ):
                    _sized_attrs.append("gguf_dflash_file")
            else:
                _sized_attrs.append("gguf_mtp_file")

        for attr in _sized_attrs:
            f = getattr(config, attr, None)
            if f and Path(f).is_file():
                # Split-aware, like the main weight above: discovery hands back shard 1,
                # so stat() alone would size a split drafter at one shard and let the
                # guard admit a load that evicts the training run it protects.
                total_bytes += LlamaCppBackend._get_gguf_size_bytes(str(f))
                _sized_keys.add(_same_file_key(str(f)))

        # A caller that owns speculation through llama_extra_args names the
        # drafter with --model-draft. load_model hands that path to llama-server,
        # so it has to be charged, but it is charged exactly once: the same file
        # is often the local sidecar discovery already put in gguf_dflash_file /
        # gguf_dspark_file / gguf_mtp_file, and adding it twice billed a 1.5 GiB
        # drafter as 3 GiB and refused loads that fit. When the drafter really is
        # outside the model directory nothing above named it and the charge lands
        # here. It is a companion either way, never evidence of a local main
        # weight, so it does not decide which branch below produces the estimate:
        # a remote repo with a local --model-draft still has to price its weights
        # through the listing, and returning the drafter alone under-estimated a
        # load by the whole target model.
        # A remote one (--spec-draft-hf / -hfd names a repo, never a file) is charged
        # from its OWN listing: the target's companion scan never sees it, so a target
        # shipping no sidecar left a multi-GB drafter billed nowhere.
        _extras_bytes = 0
        # The value AND which flag carried it. Draft flags are last-wins, so a repo
        # id followed by a path leaves a path as the drafter, and pricing that path
        # as a repository would charge a reserve for something that never loads.
        _extras_draft, _extras_draft_is_remote = _extra_args_mtp_draft_source(
            llama_extra_args, env = {}
        )
        # A host-memory drafter competes for RAM, not for the training job's VRAM.
        # Charging it is not a safe over-estimate, it is the wrong resource, and it
        # 409s a load that takes no VRAM for the drafter at all.
        if _extra_args_draft_offloaded_to_cpu(llama_extra_args, env = os.environ):
            _extras_bytes = 0
        elif _extras_draft and Path(_extras_draft).is_file():
            if _same_file_key(str(_extras_draft)) not in _sized_keys:
                _extras_bytes = LlamaCppBackend._get_gguf_size_bytes(str(_extras_draft))
        elif _extras_draft and _extras_draft_is_remote:
            _extras_bytes = _remote_drafter_repo_bytes(str(_extras_draft), hf_token = hf_token)
        # else: a local --model-draft that is not on disk, so no drafter loads and
        # none is charged. A repository reserve there 409s a load over a typo.

        if total_bytes > 0:
            return (total_bytes + _extras_bytes) / (1024**3) + _estimate_gguf_kv_gb(
                main,
                max_seq_length,
                llama_extra_args,
                n_parallel,
                cache_type_kv,
                tensor_parallel,
                n_batch,
                n_ubatch,
                n_devices,
                is_diffusion,
            )

        repo = getattr(config, "gguf_hf_repo", None)
        variant = getattr(config, "gguf_variant", None)
        if repo and variant:
            from utils.models.model_config import list_gguf_variants

            variants, has_vision = list_gguf_variants(repo, hf_token = hf_token)
            selected = next((v for v in variants if v.quant.lower() == variant.lower()), None)
            main_bytes = selected.size_bytes if selected is not None else None
            if main_bytes is None:
                return None
            companions = _remote_gguf_companion_bytes(
                repo,
                hf_token = hf_token,
                include_mmproj = bool(has_vision),
                # Remote, so which sidecar the repo ships is unknown until the
                # listing. Under Auto size both: a repo has one kind or the other,
                # the absent one contributes 0, and over-estimating is the safe
                # direction for a guard that protects a running training job.
                include_mtp = (
                    not _charge_no_drafter
                    and (_auto_dspark or not (dspark_requested or dflash_requested))
                ),
                include_dspark = (_dspark_capable and (_auto_dspark or dspark_requested)),
                include_dflash = (_dflash_capable and (_auto_dflash or dflash_requested)),
                # What the DFlash bound measures candidates against, so the guard stops
                # charging for weights the fetch refuses as too big to be a drafter.
                weight_bytes = int(main_bytes or 0),
                # ... except where the listing settles it. Auto launches exactly
                # one drafter, in a fixed order, so once the listing says which
                # kinds the repo has, charging the losers is not caution, it is a
                # refusal for bytes that never become resident.
                dspark_first = _auto_dspark,
            )
            # Plus the caller's own --model-draft / --spec-draft-hf, if they named
            # one: this repo's listing cannot see it, local or remote, and it is
            # resident next to these weights.
            total_gb = (main_bytes + companions + _extras_bytes) / (1024**3)
            total_gb += _remote_gguf_compute_reserve_gb(
                llama_extra_args = llama_extra_args,
                max_seq_length = max_seq_length,
                n_parallel = n_parallel,
                n_batch = n_batch,
                n_ubatch = n_ubatch,
                n_devices = n_devices,
                tensor_parallel = tensor_parallel,
                is_diffusion = is_diffusion,
            )
            return total_gb
        return None
    except Exception as e:
        logger.warning(f"Could not size GGUF model for training guard: {e}")
        return None


def _guard_device_count(
    requested_gpu_ids: Optional[list[int]],
    vulkan_gpu_memory: Optional[list[tuple[int, int, int]]] = None,
    *,
    tensor_parallel: bool = False,
) -> int:
    """Devices the launch would spread its compute buffers over.

    Tensor mode replicates them on every usable device, so it takes the pool: a pin,
    else ggml's Vulkan probe (_effective_gpu_count sees CUDA only), else CUDA. A layer
    split lands on the fewest GPUs that hold the model, so a pin is charged for what it
    names and automatic placement for one. That last one is an approximation, not an
    identity: _select_gpus returns [1] only when the model FITS on one card and
    accumulates otherwise, so a model too big for one is under-charged by the same margin
    that charging the whole candidate pool would over-charge one that fits. Resolving it
    needs the free-VRAM map, which only arrives downstream in
    can_load_chat_during_training; one device is the side that does not 409 a load that
    launches on one.
    """
    if not tensor_parallel:
        return max(1, len(requested_gpu_ids or ()))
    if not requested_gpu_ids and vulkan_gpu_memory:
        return max(1, len(vulkan_gpu_memory))
    return max(1, LlamaCppBackend._effective_gpu_count(requested_gpu_ids))


def _gguf_layer_count(config: ModelConfig) -> Optional[int]:
    """Total block count from a local GGUF header, or None (remote / unreadable)."""
    try:
        main = getattr(config, "gguf_file", None)
        if not (main and Path(main).is_file()):
            repo = getattr(config, "gguf_hf_repo", None)
            variant = getattr(config, "gguf_variant", None)
            if repo and variant:
                from hub.utils.gguf import resolve_local_gguf_path
                main = resolve_local_gguf_path(repo, variant)
        if main and Path(main).is_file():
            probe = LlamaCppBackend()
            probe._read_gguf_metadata(str(main))
            return getattr(probe, "_n_layers", None) or None
    except Exception as e:
        logger.debug("Could not read GGUF layer count for training guard: %s", e)
    return None


def _local_gguf_main_path(config: ModelConfig) -> Optional[str]:
    """The main GGUF on this disk for a config, or None while it is not downloaded.

    The header answers questions the load would otherwise only answer by failing
    (diffusion, embedding), but only once the file is here: a repo that has not been
    fetched yet has nothing to read, and the callers all fall back to what they did
    before rather than reaching for the network on a request path.
    """
    main = getattr(config, "gguf_file", None)
    if main and Path(main).is_file():
        return str(main)
    repo = getattr(config, "gguf_hf_repo", None)
    variant = getattr(config, "gguf_variant", None)
    if repo and variant:
        from hub.utils.gguf import resolve_local_gguf_path
        main = resolve_local_gguf_path(repo, variant)
        if main and Path(main).is_file():
            return str(main)
    return None


def _is_embedding_gguf(config: ModelConfig) -> bool:
    """Whether this GGUF's pooling type makes llama-server launch with --embedding.

    False whenever the header cannot be read, which keeps every caller doing what it
    did before the check existed: this only ever relaxes a refusal, and relaxing one
    on a guess is how a load reaches the abort the refusal exists to prevent.
    """
    try:
        main = _local_gguf_main_path(config)
        if not main:
            return False
        probe = LlamaCppBackend()
        probe._read_gguf_metadata(main)
        return bool(probe.is_embedding_gguf)
    except Exception as exc:
        logger.debug("Could not identify embedding GGUF for the batch floor: %s", exc)
        return False


def _embedding_clamped_slots(
    config: ModelConfig,
    slots: int,
    *,
    extra_args: Optional[list[str]],
    n_batch: Optional[int],
    n_ubatch: Optional[int],
    n_ctx: Optional[int],
) -> int:
    """Slots an embedding GGUF really serves, after the micro-batch clamp on load.

    --embedding makes llama-server cap the batch at the micro-batch, and it aborts
    when that is below the slot count, so load_model reduces the slots to it before
    launching. The batch floor has to be judged against the reduced count or this
    refuses a command the launcher would run: four slots with "-ub 2" and a
    pass-through "--batch-size 2" launches at two slots, where two is the floor.

    Only ever returns a count at or below the one asked for, and returns that one
    unchanged for anything but a positively classified embedding GGUF.
    """
    if slots <= 1:
        return max(1, slots)
    if not _is_embedding_gguf(config):
        return slots
    from core.inference.llama_cpp import _emitted_n_batch, _extra_args_n_ubatch

    effective_ubatch = _extra_args_n_ubatch(
        extra_args,
        n_ctx = n_ctx if n_ctx and n_ctx > 0 else None,
        n_batch = _emitted_n_batch(n_batch, slots),
        n_ubatch = n_ubatch,
    )
    if effective_ubatch is None or effective_ubatch >= slots:
        return slots
    # max(): a degenerate "-b 0" resolves to 0, and --parallel 0 is rejected at arg
    # parse, which is the same floor load_model applies.
    return max(1, effective_ubatch)  # allow-slot-clamp: mirrors the load_model clamp


async def _batch_floor_survives_embedding_clamp(
    config: ModelConfig,
    extra_args: Optional[list[str]],
    requested_slots: int,
    request,
    *,
    diffusion_kind: Optional[bool] = None,
) -> bool:
    """Whether a batch the floor just refused is legal once the clamps are applied.

    Both routes check the floor against the slots the launch serves, and for an
    embedding GGUF that is smaller again than the kv-unified count: llama-server
    caps the batch at the micro-batch under --embedding and aborts when that is
    below the slots, so load_model reduces them first. Asked only after a refusal,
    so the header read is paid on the way to a 400 rather than on every load.
    """
    from core.inference.llama_server_args import check_batch_floor

    # Off the event loop: the classification reads the GGUF header from disk, and
    # both routes reach this from an async handler serving download progress polls.
    slots = await asyncio.to_thread(
        _embedding_clamped_slots,
        config,
        _effective_parallel_slots(requested_slots, diffusion_kind = diffusion_kind),
        extra_args = extra_args,
        n_batch = getattr(request, "n_batch", None),
        n_ubatch = getattr(request, "n_ubatch", None),
        n_ctx = getattr(request, "max_seq_length", None),
    )
    try:
        check_batch_floor(extra_args, slots)
    except ValueError:
        return False
    return True


def _classify_diffusion_gguf(config: ModelConfig) -> Optional[bool]:
    """Classify a GGUF as diffusion, normal, or unknown before loading."""
    identity = " ".join(
        str(getattr(config, attr, "") or "") for attr in ("identifier", "gguf_hf_repo", "gguf_file")
    ).lower()
    # Only use the specific DiffusionGemma family name as a header fallback.
    name_says_diffusion = "diffusiongemma" in _re.sub(r"[^a-z0-9]+", "", identity)

    try:
        main = _local_gguf_main_path(config)
        if main:
            probe = LlamaCppBackend()
            probe._read_gguf_metadata(main)
            if probe.is_diffusion:
                return True
            if getattr(probe, "_architecture", None):
                return False
    except Exception as e:
        logger.debug("Could not identify diffusion GGUF for training guard: %s", e)
    return True if name_says_diffusion else None


async def _override_gpu_ids_still_resolve(gpu_ids: List[int]) -> bool:
    """Whether a per-model GPU pin is usable on this machine right now.

    normalize_model_override cannot know the device list, so it stores whatever
    was valid where the config was written. This is the load-time reconciliation
    for the device-availability rules, which are the ones that go stale.

    Deliberately not exhaustive: model-dependent rules (a Vulkan diffusion GGUF
    refuses gpu_ids outright) need a ModelConfig this has no reason to build.
    The caller's retry-without-the-pin covers those, and covers rules added
    later, so a check missing here costs one extra attempt, not the load.
    """
    try:
        from utils.hardware import DeviceType, get_device
        from utils.hardware.hardware import resolve_requested_gpu_ids

        # One hop for the whole device-dependent block: resolve_requested_gpu_ids() reaches
        # get_device() itself, so both wait on the detection lock during the warm.
        def _device_and_resolution() -> tuple[object, bool, list]:
            is_vulkan = LlamaCppBackend._is_vulkan_backend()
            return (
                get_device(),
                is_vulkan,
                resolve_requested_gpu_ids(gpu_ids, is_vulkan = is_vulkan),
            )

        device, is_vulkan, resolved = await asyncio.to_thread(_device_and_resolution)
        if device == DeviceType.XPU and not is_vulkan:
            # Rejected outright on XPU.
            return False
        if is_vulkan and resolved:
            # Vulkan ordinals are their own index space, so presence needs the ggml probe.
            binary = LlamaCppBackend._find_llama_server_binary()
            if binary:
                probed = {
                    gpu[0]
                    for gpu in await asyncio.to_thread(LlamaCppBackend._get_gpu_memory, binary)
                }
                if not {int(gpu_id) for gpu_id in resolved}.issubset(probed):
                    return False
        return True
    except Exception:
        return False


def _reject_draft_device_with_gpu_ids(
    gpu_ids: Optional[List[int]],
    extra_args: Optional[list[str]],
    *,
    gpu_ids_are_vulkan_ordinals: bool,
) -> None:
    """Reject a physical drafter pin beside Vulkan-ordinal main placement."""
    if not gpu_ids or not gpu_ids_are_vulkan_ordinals:
        return
    draft_device = _extra_args_draft_device_pin(extra_args)
    if draft_device is not None:
        raise HTTPException(
            status_code = 400,
            detail = (
                f"A draft-model device override ('{draft_device}') cannot be combined "
                "with explicit gpu_ids: it would place the speculative drafter outside "
                "the pinned GPUs the training guard budgeted. Remove the draft-device "
                "flag to follow gpu_ids, or set it to none."
            ),
        )


_DIFFUSION_KIND_UNSET = object()


async def _resolve_gguf_gpu_ids_for_request(
    config: ModelConfig,
    gpu_ids: Optional[List[int]],
    *,
    diffusion_kind: Optional[bool] | object = _DIFFUSION_KIND_UNSET,
) -> tuple[Optional[List[int]], bool]:
    """Validate GGUF GPU IDs and report whether they are Vulkan ordinals."""
    if not gpu_ids:
        return None, False

    from utils.hardware import DeviceType, get_device
    from utils.hardware.hardware import resolve_requested_gpu_ids

    llama_backend = get_llama_cpp_backend()
    is_vulkan_build = await asyncio.to_thread(llama_backend.is_vulkan_build)
    if diffusion_kind is _DIFFUSION_KIND_UNSET:
        diffusion_kind = _classify_diffusion_gguf(config)
    confirmed_diffusion = diffusion_kind is True
    definitively_non_diffusion = diffusion_kind is False
    # Off-loop: get_device() waits on the detection lock, i.e. the cold torch import.
    device = await asyncio.to_thread(get_device)
    lacks_gpu_lib = getattr(llama_backend, "_backend_lacks_gpu_lib", None)

    # ROCm is deliberately DeviceType.CUDA internally because it uses
    # torch.cuda.*. Only the API label changes to "rocm", so this accepts both
    # CUDA and ROCm physical IDs while rejecting device namespaces the
    # diffusion runner cannot apply.
    diffusion_physical_ids_supported = device == DeviceType.CUDA
    if confirmed_diffusion and not diffusion_physical_ids_supported:
        raise HTTPException(
            status_code = 400,
            detail = (
                "GPU selection (gpu_ids) for DiffusionGemma requires CUDA or ROCm. "
                "Omit gpu_ids on this host."
            ),
        )

    if confirmed_diffusion and is_vulkan_build:
        raise HTTPException(
            status_code = 400,
            detail = (
                "GPU selection (gpu_ids) is not supported for a DiffusionGemma "
                "GGUF on a Vulkan llama.cpp build: the picker uses Vulkan ordinals, "
                "which have no defined mapping to CUDA physical indices. Omit gpu_ids "
                "to use the default device."
            ),
        )

    ids_are_vulkan_ordinals = is_vulkan_build

    if device == DeviceType.XPU and not ids_are_vulkan_ordinals:
        raise HTTPException(
            status_code = 400,
            detail = (
                "GPU selection (gpu_ids) is not supported on Intel XPU. "
                "Omit gpu_ids to use all devices."
            ),
        )

    if (
        device == DeviceType.CUDA
        and not ids_are_vulkan_ordinals
        and definitively_non_diffusion
        and callable(lacks_gpu_lib)
        and await asyncio.to_thread(lacks_gpu_lib)
    ):
        raise HTTPException(
            status_code = 400,
            detail = (
                f"Requested gpu_ids {list(gpu_ids)} but the llama.cpp build has "
                "no GPU backend (CPU-only build); it would ignore the pin and run "
                "on CPU. Omit gpu_ids to run on CPU."
            ),
        )

    try:
        resolved = resolve_requested_gpu_ids(
            gpu_ids,
            is_vulkan = ids_are_vulkan_ordinals,
        )
    except ValueError as exc:
        raise HTTPException(status_code = 400, detail = str(exc)) from exc

    if ids_are_vulkan_ordinals and resolved:
        binary = LlamaCppBackend._find_llama_server_binary()
        if binary:
            probed = {
                gpu[0] for gpu in await asyncio.to_thread(LlamaCppBackend._get_gpu_memory, binary)
            }
            wanted = {int(gpu_id) for gpu_id in resolved}
            if not wanted.issubset(probed):
                raise HTTPException(
                    status_code = 400,
                    detail = (
                        f"Requested Vulkan GPU ordinal(s) {sorted(wanted)} not "
                        f"present. Available Vulkan devices: {sorted(probed)}."
                    ),
                )

    return resolved, ids_are_vulkan_ordinals


class _LoadPlacement(NamedTuple):
    requested_gpu_ids: Optional[List[int]]
    resolved_gpu_ids: Optional[List[int]]
    gpu_ids_are_vulkan_ordinals: bool
    diffusion_kind: Optional[bool]


def _spec_fallback_binary_changed(llama_backend) -> Optional[bool]:
    """``spec_binary_fallback_can_retry``, for the status poll.

    Only the two binary stand-downs can be repaired by an identical reload, so a client
    that reloads for any ``binary_*`` reason prompts to stop running chats for a load
    that would dedupe. Answered only for those reasons: this is polled from first paint,
    and neither the binary lookup nor the capability probe has business running on every
    poll of a healthy runtime.

    The whole predicate, not just its revision half. ``binary_no_mtp`` also asks whether
    the replacement advertises what the drafter kind needs, and a replacement that still
    lacks it never repairs: the live process keeps its launch revision, so a half answer
    would prompt on every later re-pick and never stop. The probe caches on the binary's
    revision, and this route already relies on that elsewhere.
    """
    if getattr(llama_backend, "spec_fallback_reason", None) not in (
        "binary_no_mtp",
        "binary_outdated",
    ):
        return None
    try:
        return bool(llama_backend.spec_binary_fallback_can_retry())
    except Exception:
        return None


def _spec_probe_retry_pending(llama_backend) -> Optional[bool]:
    """Whether the capability probe has started answering since a degraded launch.

    Mirrors the ``_capability_probe_inconclusive`` arm of ``_runtime_matches_intent``,
    which rejects an identical load once the probe turns conclusive so the degraded
    runtime is re-derived. No speculative mode gates it, and it records the conclusive
    probe and clears, so it is one reload rather than a loop. Probing is cheap here:
    ``probe_server_capabilities`` caches on the binary's revision and this route already
    calls it.
    """
    if not getattr(llama_backend, "_capability_probe_inconclusive", False):
        return False
    if getattr(llama_backend, "_is_diffusion", False):
        return False
    try:
        return not llama_backend.probe_server_capabilities().get("mtp_probe_inconclusive")
    except Exception:
        return None


def _diffusion_split_supported(llama_backend) -> Optional[bool]:
    """Whether a diffusion launch right now would honour --ngl.

    Only meaningful for a resident diffusion runner. ``_runtime_matches_intent`` rejects
    an otherwise identical request once this turns true and the live gpu_layers differs
    from the requested NGL, so the split an older shim dropped can finally be applied.
    A client comparing only the retained request would skip that load.
    """
    if not getattr(llama_backend, "_is_diffusion", False):
        return None
    try:
        return bool(llama_backend.diffusion_split_supported())
    except Exception:
        return None


def _audio_probe_pending(llama_backend) -> bool:
    """Whether the post-launch audio probe still has to be retried.

    ``_reuse_loaded_gguf`` refuses the route's own already-loaded answer while this is
    true, so ``load_model`` reaches its fast path and re-probes there. A client that
    skips /load skips the retry with it, and nothing else re-probes, so the model's
    audio capabilities would stay undetected for as long as the server runs.
    """
    return not getattr(llama_backend, "_audio_probed", True)


def _gpu_placement_paravirtual() -> Optional[bool]:
    """Whether every GGUF request on this host is rewritten to the CPU pin.

    ``paravirtual_normalized_request`` maps any placement to manual / zero layers / no
    split / no MoE on a virtualised Metal device, and ``adopt_load_intent_if_matched``
    applies it before comparing, so placement cannot distinguish two requests here at
    all. A client comparing the raw values sees its Auto pick against a manual status and
    reloads on every re-pick. The detector is lru_cached, so this costs one probe per
    process and nothing after.
    """
    try:
        from core.inference.llama_cpp import _metal_device_is_paravirtual
        return bool(_metal_device_is_paravirtual())
    except Exception:
        return None


def _arch_gate_dropped_tensor_parallel(llama_backend) -> Optional[bool]:
    """Whether the GPU architecture gate normalized a tensor-parallel request away.

    ``_runtime_matches_intent`` accepts the same true request against the resulting
    layer-mode runtime, since that runtime IS the request as the gate rewrote it. Status
    reports the mode that launched, so a client comparing it raw prompts to stop running
    chats on every re-pick of a model whose split was gated off.
    """
    try:
        return bool(llama_backend._arch_gate_dropped_tensor_parallel)
    except Exception:
        return None


def _spec_dspark_sidecar_absent(llama_backend) -> Optional[bool]:
    """Whether the DSpark drafter is missing permanently rather than transiently.

    The ``drafter_not_found`` arm of ``_runtime_matches_intent`` reloads so the next
    Apply retries the fetch, but excludes an absent DSpark sidecar: that is the permanent
    state of every repo but one, and retrying it would relaunch an identical server
    forever. A client reading only the reason cannot tell the two apart and prompts to
    stop running chats for a load that dedupes.
    """
    try:
        return bool(llama_backend._dspark_sidecar_absent)
    except Exception:
        return None


def _spec_dflash_retry_pending(llama_backend) -> Optional[bool]:
    """Whether a DFlash sidecar fetch failed in a way the next identical load retries.

    Under Auto a failed fetch records no ``spec_fallback_reason``, so a client reading
    only that adopts a runtime the backend would have rebuilt. Set only for retryable
    failures: a repo publishing no sidecar is ``_dflash_sidecar_absent``'s business.
    Applies to the Auto and DFlash modes, as the arm does.
    """
    try:
        return bool(llama_backend._dflash_retry_needed)
    except Exception:
        return None


class _NoParallelRequest:
    """A stand-in for a load that named no slot count, for reading the default."""

    n_parallel = None


def _resolve_parallel_slots(request, fastapi_request: Optional[Request]) -> int:
    if request.n_parallel is not None:
        return request.n_parallel
    state = getattr(getattr(fastapi_request, "app", None), "state", None)
    return getattr(state, "llama_parallel_slots", 1)


def _effective_parallel_slots(n_parallel: int, *, diffusion_kind: Optional[bool] = None) -> int:
    """Slots the launch will actually serve, after the clamps load_model applies.

    A build without --kv-unified splits the context window per slot, so load_model
    falls back to one; the diffusion runner receives no --parallel at all. Anything
    sized or refused against the asked-for count instead of this one is judging a
    command that will not launch: the batch floor in particular would refuse
    "--batch-size 2" against a four-slot default on a build that serves one.
    """
    if n_parallel <= 1:
        return max(1, n_parallel)
    if diffusion_kind is True:
        return 1  # allow-slot-clamp: diffusion never receives --parallel
    try:
        caps = LlamaCppBackend.probe_server_capabilities()
        if caps.get("found") and not caps.get("supports_kv_unified"):
            return 1  # allow-slot-clamp: mirrors the load_model clamp
    except Exception as exc:
        # Unreadable capabilities are not a reason to refuse anything: keep the ask,
        # which is what every other caller of the probe here does.
        logger.warning("Could not probe llama-server slots: %s", exc)
    return n_parallel


async def _prepare_load_placement(
    config: ModelConfig,
    request: LoadRequest | ValidateModelRequest,
    extra_args: Optional[list[str]],
) -> _LoadPlacement:
    requested = request.gpu_ids or None
    if not config.is_gguf:
        return _LoadPlacement(requested, None, False, False)
    diffusion_kind = _classify_diffusion_gguf(config)
    resolved, is_vulkan = await _resolve_gguf_gpu_ids_for_request(
        config, requested, diffusion_kind = diffusion_kind
    )
    _reject_draft_device_with_gpu_ids(resolved, extra_args, gpu_ids_are_vulkan_ordinals = is_vulkan)
    return _LoadPlacement(requested, resolved, is_vulkan, diffusion_kind)


def _inherited_batch_flags_stripped(request) -> bool:
    """Whether inheriting the resident extras drops a -b / -ub a set field supersedes.

    _active_gguf_intent computes this inline (``batch_overrides_inherit``). Without it here
    ``extra_args_inherited`` stays True, so _runtime_matches_intent compares the launched
    extras (still carrying the stale flag) instead of the stripped override, and an Apply
    that only raises the batch size reports ``already_loaded``.
    """
    if getattr(request, "llama_extra_args", None) is not None:
        return False
    fields_set = getattr(request, "model_fields_set", set())
    strip_batch = "n_batch" in fields_set
    strip_ubatch = "n_ubatch" in fields_set
    if not (strip_batch or strip_ubatch):
        return False
    stored = list(getattr(get_llama_cpp_backend(), "extra_args", None) or ())
    if not stored:
        return False
    return (
        strip_shadowing_flags(
            stored,
            strip_context = False,
            strip_cache = False,
            strip_spec = False,
            strip_template = False,
            strip_split_mode = False,
            strip_batch = strip_batch,
            strip_ubatch = strip_ubatch,
        )
        != stored
    )


def _resolve_gguf_load_intent(
    config: ModelConfig,
    request: LoadRequest,
    *,
    native_grant_backed: bool,
    chat_template_override: Optional[str],
    extra_args: Optional[list[str]],
    placement: _LoadPlacement,
    n_parallel: int,
) -> GgufLoadIntent:
    """Resolve source, companions, settings, and placement into one load value."""
    if config.gguf_hf_repo:
        source = GgufLoadIntent(
            model_identifier = config.identifier,
            hf_repo = config.gguf_hf_repo,
            hf_variant = config.gguf_variant,
            hf_token = request.hf_token,
            verified_gguf = getattr(config, "gguf_verified", None),
        )
    else:
        if native_grant_backed:
            if config.gguf_mmproj_file:
                _validate_native_gguf_companion(
                    config.gguf_mmproj_file, config.gguf_file, "vision companion"
                )
            if config.gguf_mtp_file:
                config.gguf_mtp_file = _mtp_draft_for_path(
                    config.gguf_file,
                    True,
                    log_native_fallback = True,
                )
            if config.gguf_dspark_file:
                config.gguf_dspark_file = _dspark_draft_for_path(
                    config.gguf_file,
                    True,
                    log_native_fallback = True,
                )
            if config.gguf_dflash_file:
                config.gguf_dflash_file = _dflash_draft_for_path(
                    config.gguf_file,
                    True,
                    log_native_fallback = True,
                )
        source = GgufLoadIntent(
            model_identifier = config.identifier,
            gguf_path = config.gguf_file,
            mmproj_path = config.gguf_mmproj_file,
            mtp_draft_path = config.gguf_mtp_file,
            dspark_draft_path = config.gguf_dspark_file,
            dflash_draft_path = config.gguf_dflash_file,
            hf_variant = config.gguf_variant,
        )

    return _gguf_request_intent(
        source,
        request,
        chat_template_override = chat_template_override,
        extra_args = extra_args,
        gpu_ids = placement.resolved_gpu_ids,
        n_parallel = n_parallel,
        is_vision = config.is_vision,
        gpu_ids_are_vulkan_ordinals = placement.gpu_ids_are_vulkan_ordinals,
        extra_args_inherited = (
            getattr(request, "llama_extra_args", None) is None
            # a strip that changed the list is an override, so the dedupe compares it
            and not _inherited_batch_flags_stripped(request)
        ),
    )


def _guard_chat_load_against_training(
    config: ModelConfig,
    request: LoadRequest | ValidateModelRequest,
    *,
    load_in_4bit: bool,
    placement: _LoadPlacement,
    llama_extra_args: Optional[list[str]] = None,
    n_parallel: int = 1,
) -> None:
    """Protect active training from automatically placed chat-model loads.

    No-op when training is inactive or unknown. `load_in_4bit` must be the
    effective quantization (see _effective_load_in_4bit). Manual chat-GGUF
    placement is an explicit override: Auto layers delegate fitting to
    llama.cpp's ``--fit`` and pinned layers are owned by the user, so neither is
    estimated here. Diffusion is still guarded because its runner uses one GPU, except
    for an explicit zero-layer split, which places no layers at all; an unclassified
    GGUF is guarded as potentially diffusion until its local header proves otherwise.
    Other loads raise HTTP 409 when they would not fit beside training.
    """
    from core.training import get_training_backend

    requested_gpu_ids = placement.requested_gpu_ids
    gpu_ids_are_vulkan_ordinals = placement.gpu_ids_are_vulkan_ordinals
    diffusion_kind = placement.diffusion_kind
    try:
        llm_active = get_training_backend().is_training_active()
    except Exception as e:
        # Independent probes: an unreadable LLM backend must still fall through to the diffusion check, which reads a different service.
        logger.warning("Could not check training state for chat-load guard: %s", e)
        llm_active = False

    if not llm_active:
        # An SDXL LoRA trainer runs in its own subprocess and cannot be cheaply fit-checked, so refuse the chat load while one is active.
        if _diffusion_training_active():
            raise HTTPException(
                status_code = 409,
                detail = (
                    "Can't load this model while diffusion (Images) training is running: "
                    "its GPU memory use can't be verified against the trainer, so the load "
                    "was refused to protect the run. Try again after training finishes."
                ),
            )
        return

    # This guard is only needed while a training job is actually resident.  Keep
    # its optional VRAM-policy dependency off the normal inference-validation
    # path, otherwise a missing policy module rejects perfectly valid local
    # GGUF models even when no training is running.
    from routes.training_vram import can_load_chat_during_training

    from core.inference.llama_cpp import _diffusion_manual_ngl, _scale_diffusion_required_gb

    is_gguf = bool(getattr(config, "is_gguf", False))
    # load_model pins a GGUF to CPU on a virtualised Metal device, so guard what will run:
    # sized as the raw Auto request, a CPU-only load is refused over VRAM it never takes.
    _guard_gpu_memory_mode = request.gpu_memory_mode
    _guard_gpu_layers = request.gpu_layers
    _guard_tensor_parallel = request.tensor_parallel
    _pv_guard_forced_cpu = is_gguf and _metal_device_is_paravirtual()
    if _pv_guard_forced_cpu:
        _pv = paravirtual_normalized_request(
            gpu_memory_mode = request.gpu_memory_mode,
            gpu_layers = request.gpu_layers,
            tensor_parallel = request.tensor_parallel,
            tensor_split = None,
            n_cpu_moe = 0,
            extra_args = llama_extra_args,
            log_dropped = False,
        )
        _guard_gpu_memory_mode = _pv.gpu_memory_mode
        _guard_gpu_layers = _pv.gpu_layers
        _guard_tensor_parallel = _pv.tensor_parallel
        llama_extra_args = _pv.extra_args
    # The pin leaves nothing on the GPU (--device none, no mmproj offload, drafter on CPU),
    # so there is nothing to budget whatever the GGUF turns out to be. Ahead of the checks
    # below, which only exempt a CONFIRMED diffusion GGUF and would size an unclassified
    # remote one as GPU-resident and 409 a load that never touches VRAM.
    if _pv_guard_forced_cpu:
        return
    if is_gguf and _guard_gpu_memory_mode == "manual" and (diffusion_kind is False):
        return
    # A zero-layer diffusion split places no model layers on any device, so it cannot compete
    # with training for VRAM. Mirrors the loader, which folds the same condition into its
    # cpu_only (core/inference/llama_cpp.py).
    diffusion_ngl = (
        _diffusion_manual_ngl(_guard_gpu_memory_mode, _guard_gpu_layers) if is_gguf else None
    )
    if diffusion_ngl is not None and diffusion_kind is not False:
        # The loader drops the split when the shim has no --ngl and launches GPU-resident.
        # Guard what will run, not what was asked, or a zero-layer request skips the VRAM
        # check while the child takes a whole GPU.
        try:
            if not get_llama_cpp_backend().diffusion_split_supported():
                diffusion_ngl = None
        except Exception as e:
            logger.warning("Could not probe diffusion shim for chat-load guard: %s", e)
            diffusion_ngl = None
    # `is True`, not `is not False`: only a CONFIRMED diffusion GGUF places nothing at ngl 0.
    # On a possibly-ordinary GGUF a device pin, tensor mode, mmproj or a GPU drafter keeps it
    # resident (see LlamaCppBackend._zero_offload_keeps_gpu_visible).
    if is_gguf and diffusion_kind is True and diffusion_ngl == 0:
        return

    diffusion_gpu = None
    if is_gguf and diffusion_kind is not False and not gpu_ids_are_vulkan_ordinals:
        # Use the same token selection as the runner: an explicit pick wins,
        # followed by DG_GPU, the first parent-visible token, then GPU 0. Suppressed
        # for a Vulkan-ordinal pin so single-device CUDA budgeting can't override the
        # Vulkan-ordinal path (single_device_gpu wins in can_load_chat_during_training).
        # No force_cpu, deliberately: a CONFIRMED zero-layer split already returned above, so
        # ngl 0 here means an UNCLASSIFIED GGUF -- and an empty token makes
        # can_load_chat_during_training short-circuit to "cpu_only" and always allow the
        # load, on an assumption that only holds for real diffusion. Let the picker choose a
        # device so an ordinary GGUF keeping VRAM at --gpu-layers 0 stays conservatively sized.
        diffusion_gpu = LlamaCppBackend._diffusion_gpu_arg(
            requested_gpu_ids,
            cpu_only = LlamaCppBackend._effective_gpu_count() == 0,
        )

    # Detected once: both the tensor-parallel KV sizing below and the Vulkan
    # free-VRAM view need the same answer. An ordinal pin only exists on a
    # Vulkan build, so it settles the question without probing the binary.
    binary = LlamaCppBackend._find_llama_server_binary() if is_gguf else None
    is_vulkan_backend = bool(
        is_gguf
        and (gpu_ids_are_vulkan_ordinals or (binary and LlamaCppBackend._is_vulkan_backend(binary)))
    )

    # ggml's vulkan pool, probed once: the device count and the free-vram view below both read it
    vulkan_gpu_memory: Optional[list[tuple[int, int, int]]] = None
    if is_vulkan_backend and (
        gpu_ids_are_vulkan_ordinals
        or diffusion_kind is False
        or (diffusion_kind is None and not requested_gpu_ids)
    ):
        vulkan_gpu_memory = LlamaCppBackend._get_gpu_memory(binary)
        if not requested_gpu_ids:
            # automatic placement prefers the discrete cards, like the loader's fit
            vulkan_gpu_memory = LlamaCppBackend._vulkan_auto_gpu_memory(vulkan_gpu_memory)

    guard_tensor_parallel = _effective_tensor_parallel(
        llama_extra_args, _guard_tensor_parallel
    ) and (is_vulkan_backend or LlamaCppBackend._effective_gpu_count(requested_gpu_ids) >= 2)
    guard_n_devices = _guard_device_count(
        requested_gpu_ids, vulkan_gpu_memory, tensor_parallel = guard_tensor_parallel
    )

    # Size with the count that will actually launch, or a load that fits gets a 409.
    # An unclassified GGUF keeps the ask.
    if is_gguf and n_parallel > 1:
        if diffusion_kind is True:
            n_parallel = 1  # allow-slot-clamp: diffusion never receives --parallel
        else:
            try:
                caps = LlamaCppBackend.probe_server_capabilities()
                if caps.get("found") and not caps.get("supports_kv_unified"):
                    n_parallel = 1  # allow-slot-clamp: mirrors the load_model clamp
            except Exception as e:
                logger.warning("Could not probe llama-server slots for chat-load guard: %s", e)

    required_override_gb = (
        _estimate_gguf_required_gb(
            config,
            hf_token = request.hf_token,
            max_seq_length = request.max_seq_length,
            llama_extra_args = llama_extra_args,
            speculative_type = getattr(request, "speculative_type", None),
            n_parallel = n_parallel,
            cache_type_kv = request.cache_type_kv,
            # getattr: older callers hand this guard a bare request double
            n_batch = getattr(request, "n_batch", None),
            n_ubatch = getattr(request, "n_ubatch", None),
            tensor_parallel = guard_tensor_parallel,
            # size the compute buffers for the split the loader would budget
            n_devices = guard_n_devices,
            # a confirmed diffusion runner ignores the batch flags, so no reserve for it
            is_diffusion = diffusion_kind is True,
        )
        if is_gguf
        else None
    )
    # A confirmed-diffusion positive split puts only ngl/n_layers of the weights on the GPU (a
    # split the loader would drop was nulled above). Unknown classification keeps the full
    # estimate: its header was unreadable, so the layer count is too.
    if (
        required_override_gb is not None
        and diffusion_kind is True
        and diffusion_ngl is not None
        and diffusion_ngl > 0
    ):
        required_override_gb = _scale_diffusion_required_gb(
            required_override_gb, diffusion_ngl, _gguf_layer_count(config)
        )

    vulkan_free_vram_gb = None
    if is_gguf:
        if is_vulkan_backend and (gpu_ids_are_vulkan_ordinals or diffusion_kind is False):
            vulkan_free_vram_gb = {
                index: free_mib / 1024.0
                for index, free_mib, _total_mib in (vulkan_gpu_memory or [])
            }
        elif is_vulkan_backend and diffusion_kind is None and requested_gpu_ids:
            # Until the header is available, the model may use either the Vulkan
            # llama-server or the CUDA-only diffusion runner, so an explicit pin
            # cannot be budgeted: neither device namespace can stand in for the
            # other. Automatic placement has no ordinal to mis-map, so it keeps
            # the torch view below rather than refusing every uncached remote
            # GGUF while training runs.
            vulkan_free_vram_gb = {}

    ok, info = can_load_chat_during_training(
        model_name = getattr(config, "identifier", request.model_path),
        hf_token = request.hf_token,
        load_in_4bit = load_in_4bit,
        max_seq_length = request.max_seq_length,
        requested_gpu_ids = requested_gpu_ids,
        is_gguf = is_gguf,
        gpu_ids_are_vulkan_ordinals = gpu_ids_are_vulkan_ordinals,
        vulkan_free_vram_gb = vulkan_free_vram_gb,
        required_override_gb = required_override_gb,
        single_device_gpu = diffusion_gpu,
    )
    if ok:
        return

    usable = info.get("usable_gb")
    needed = info.get("needed_gb")
    if needed is None:
        needed = info.get("required_gb")
    if needed is not None and usable is not None:
        detail = (
            f"Not enough free GPU memory to load this model while training is "
            f"running (needs ~{needed:.0f} GB including safety headroom, "
            f"~{usable:.0f} GB free). Training was left untouched. Use an external "
            f"provider, a smaller or more quantized model, or try again after "
            f"training finishes."
        )
    else:
        detail = (
            "Can't load this model while training is running: its GPU memory use "
            "could not be verified, so the load was refused to protect the "
            "training run. Use an external provider or try again after training "
            "finishes."
        )
    logger.info("Refusing chat-model load during training: %s", info)
    raise HTTPException(status_code = 409, detail = detail)


def _resolve_inherited_extra_args(
    request,
    config: ModelConfig,
    model_identifier: str,
    extra_llama_args: Optional[list[str]],
    effective_chat_template_override: Optional[str] = None,
) -> Optional[list[str]]:
    """Effective pass-through extras for a GGUF request that omitted the field:
    the previous same-model load's extras, shadow-stripped, so a settings-Apply
    reload (which does not round-trip the extras field) keeps them (#5401)."""
    if getattr(request, "llama_extra_args", None) is not None:
        return extra_llama_args
    if not getattr(config, "is_gguf", False):
        return extra_llama_args
    llama_backend = get_llama_cpp_backend()
    stored_args = getattr(llama_backend, "extra_args", None)
    if not stored_args:
        return extra_llama_args
    # Inherit the previous load's extras (the chat-settings Apply path doesn't
    # round-trip them; an explicit [] still clears). Gated on (model_identifier,
    # hf_variant) to refuse cross-model pickup, and shadowing flags are
    # stripped so an inherited override can't win the last-wins CLI
    # parse against a freshly-supplied first-class field.
    source = getattr(llama_backend, "extra_args_source", None)
    # Compare against the resolved variant, not the request field: callers
    # commonly omit gguf_variant for local ``.gguf`` paths and HF auto-pick
    # flows. ``config.gguf_variant`` is the variant load_model was actually
    # invoked with, so both sides of the comparison key off the same string.
    resolved_variant = (config.gguf_variant or "").lower()
    request_variant = (request.gguf_variant or "").lower()
    stored_variant = (source[1] or "").lower() if source else ""
    same_model = bool(source and source[0] and source[0].lower() == model_identifier.lower())
    if request.gguf_variant:
        variant_mismatch = request_variant != stored_variant
    else:
        variant_mismatch = bool(stored_variant and resolved_variant != stored_variant)
    same_source = same_model and not variant_mismatch
    if not same_source:
        logger.info(
            "Not inheriting llama_extra_args: stored args came from %s, loading %s",
            source,
            (model_identifier, resolved_variant),
        )
        # Cross-model: clear explicitly so the backend doesn't
        # inherit via "no opinion" semantics.
        extra_llama_args = []
    else:
        # Strip only the groups whose first-class field was set by the caller, so
        # an inherited --chat-template-file survives an Apply that omits
        # chat_template_override. A bundled family template (e.g. gemma-4) counts as
        # a first-class template even when the request omits chat_template_override,
        # so strip the inherited --chat-template-file then too -- else the stale arg
        # (appended last) shadows the bundled template while Studio reports its caps.
        fields_set = getattr(request, "model_fields_set", set())
        stripped = strip_shadowing_flags(
            stored_args,
            strip_context = "max_seq_length" in fields_set,
            strip_cache = "cache_type_kv" in fields_set,
            strip_spec = ("speculative_type" in fields_set or "spec_draft_n_max" in fields_set),
            strip_template = (
                "chat_template_override" in fields_set
                or effective_chat_template_override is not None
            ),
            strip_split_mode = _should_strip_split_mode(request, stored_args),
            # manual + per-GPU ratio emits its own --tensor-split; drop
            # an inherited one (appended last would override it) while
            # keeping the user's --split-mode row/none/layer choice.
            strip_tensor_split = _should_strip_tensor_split(request),
            # manual emits its own --fit/--gpu-layers, so an inherited offload flag
            # must not last-wins-override it. auto leaves a user's inherited -ngl
            # alone. getattr: a validate request reuses this resolver, no offload fields.
            strip_offload = getattr(request, "gpu_memory_mode", "auto") == "manual",
            # a set field emits its own flag; an inherited -b / -ub would last-wins-override it
            strip_batch = "n_batch" in fields_set,
            strip_ubatch = "n_ubatch" in fields_set,
        )
        # Inherited, not sent: a flag denylisted since it was stored loses only
        # itself. The previous behaviour dropped the whole list, so one name added
        # to the denylist silently took every other flag with it.
        extra_llama_args, _dropped = drop_managed_flags(stripped)
        if _dropped:
            logger.warning(
                "Stored llama_extra_args are no longer allowed; dropped %s",
                ", ".join(_dropped),
            )
        else:
            if extra_llama_args:
                logger.info(
                    "Inheriting llama_extra_args from previous "
                    "load (same model, shadow-stripped): %s",
                    extra_llama_args,
                )
    return extra_llama_args


def _model_json_response(model, status_code: int = 200) -> Response:
    """Serialize a pydantic response once via pydantic-core.

    Equivalent body to ``JSONResponse(content = model.model_dump())`` but
    avoids the dict round-trip plus Starlette's second ``json.dumps``.
    """
    return Response(
        content = model.model_dump_json(),
        media_type = "application/json",
        status_code = status_code,
    )


_NOT_SUPPORTED_HINTS = (
    "No config file found",
    "not yet supported",
    "is not supported",
    "does not support",
)

_NVFP4_INFERENCE_UNSUPPORTED_MESSAGE = (
    "We are working on supporting NVFP4 inference. For now it is not supported"
)


def _diagnosis_text(msg: str) -> str:
    """``msg`` up to the startup-diagnostics block, which is not ours to read.

    A llama-server failure now carries a tail of the child's own stdout and the
    log path. That evidence is quoted verbatim from an untrusted process, so
    matching a phrase inside it says nothing about the model: llama.cpp prints
    lines like "device does not support 16-bit storage" for reasons that have
    nothing to do with the checkpoint, and every phrase below would then rewrite
    the diagnosis to "This model is not supported yet". Match on the part this
    backend wrote. A message without the block is returned unchanged, so every
    other error source behaves exactly as before.
    """
    for marker in ("\n\nllama-server output:", "\n\nFull log: "):
        head, sep, _ = msg.partition(marker)
        if sep:
            msg = head
    return msg


def _is_unsupported_nvfp4_inference_error(msg: str) -> bool:
    """Whether ``msg`` is the verbose MLX per-module metadata error emitted
    while loading an NVFP4 checkpoint."""
    lower_msg = _diagnosis_text(msg).lower()
    return "nvfp4" in lower_msg and "per-module mlx quantization metadata" in lower_msg


def _maybe_unsupported_message(msg: str) -> str:
    """Rewrite a load/validate error into the friendly "not supported yet"
    message when it matches a known unsupported-model signature; otherwise
    return ``msg`` unchanged."""
    hay = _diagnosis_text(msg).lower()
    if any(h.lower() in hay for h in _NOT_SUPPORTED_HINTS):
        return f"This model is not supported yet. Try a different model. (Original error: {msg})"
    return msg


def _raise_if_sidecar_swap_in_progress() -> None:
    from utils.transformers_version import sidecar_swap_in_progress
    if sidecar_swap_in_progress():
        raise HTTPException(
            status_code = 409,
            detail = "A transformers installation is in progress. Retry when it completes.",
        )


def _raise_or_cancel_active_generations(
    *,
    force: bool,
    action: str,
    cancel: bool = True,
) -> int:
    """Gate a model swap on the chats currently generating.

    Every open conversation decodes on the single llama-server this route is
    about to replace, so refuse with 409 and name them. force_cancel_active
    instead stops them through the same events an explicit Stop uses. Returns
    how many were cancelled. The frontend guard is bypassable from a second tab
    or curl; this one is not.

    ``cancel = False`` runs the refusal half only. /load calls it that way once
    up front, so a non-forced swap still fails fast, and again with cancel just
    before teardown: cancelling is destructive and unrecoverable, so it must not
    run ahead of preflight checks that can still reject the load (see
    _load_model_impl).
    """
    if not active_generations.count():
        return 0
    if not force:
        thread_ids = active_generations.active_thread_ids()
        running = active_generations.count()
        raise HTTPException(
            status_code = 409,
            detail = {
                "error": "active_generations",
                "message": (
                    f"{action} would stop {running} chat"
                    f"{'s' if running != 1 else ''} that "
                    f"{'are' if running != 1 else 'is'} still generating. "
                    "Stop them first, or retry with force_cancel_active."
                ),
                "running": running,
                "thread_ids": thread_ids,
            },
        )
    if not cancel:
        # Refusal-only pass: the caller cancels later, once nothing can still reject the load.
        return 0
    cancelled = active_generations.cancel_all()
    if cancelled:
        logger.info(
            "model_swap_cancelled_active_generations",
            extra = {"event": "inference.reload_cancelled_generations", "count": cancelled},
        )
    return cancelled


_POST_CANCEL_DRAIN_TIMEOUT_S = 5.0


async def _cancel_and_drain_for_sidecar_swap(timeout_s: Optional[float] = None) -> None:
    """Clear the way for a confirmed sidecar swap, then stop the chats it interrupts.

    The installer gates on the middleware's in-flight count, not on
    active_generations, so it also sees requests the cancel cannot stop. Drain
    those FIRST, discounting the registered chats (they are what the cancel is
    for, so waiting on them would wait out the point of the force). Only then
    cancel, and let the survivors unwind. Cancelling first meant an unrelated
    counted request -- a /v1/messages/count_tokens, say -- was still there for
    the caller's recheck, which then refused an install that had already stopped
    every chat for nothing.

    Bounded on both halves: the requests being waited on may never observe a
    cancel, and this holds the lifecycle gate and the sidecar reservation inside
    ``asyncio.shield``, so an unbounded wait would wedge the process. Expiring in
    the first half returns without cancelling, so the caller's recheck refuses
    with the chats untouched.
    """
    from core.inference.llama_keepwarm import other_inference_request_count

    budget = _POST_CANCEL_DRAIN_TIMEOUT_S if timeout_s is None else timeout_s

    async def _drain(deadline: float, *, discount_registered: bool) -> bool:
        while True:
            counted = other_inference_request_count(
                current_request_counted = False, include_pending = False
            )
            if discount_registered:
                counted -= min(counted, active_generations.count())
            if counted <= 0:
                return True
            if time.monotonic() >= deadline:
                return False
            await asyncio.sleep(0.02)

    # Weighted, not halved, so the total wait under the gate is unchanged. The first drain only
    # asks whether unrelated inference is in flight; cutting the second short refused installs
    # whose chats had already been stopped for nothing.
    if not await _drain(time.monotonic() + budget / 5, discount_registered = True):
        return
    _raise_or_cancel_active_generations(force = True, action = "Installing a new transformers version")
    await _drain(time.monotonic() + budget * 4 / 5, discount_registered = False)


async def _drain_and_recancel_before_teardown(*, force: bool, action: str) -> None:
    """Wait out inference the registry cannot see, then stop anything new.

    A request that passed the keep-warm middleware but has not reached its
    ``_TrackedCancel`` yet is counted in-flight and absent from the registry, so
    cancelling on the registry alone lets a teardown land on an already-admitted
    request. Drain on the middleware count instead, which covers both the runs
    just cancelled and the ones still in that window, then cancel again for
    anything that registered while waiting.

    Bounded and non-raising: an unload is a deliberate user action, so the worst
    case stays what it is today rather than becoming a refusal.
    """
    await _wait_for_model_switch_idle(
        current_request_counted = False,
        timeout_s = _POST_CANCEL_DRAIN_TIMEOUT_S,
    )
    if force:
        _raise_or_cancel_active_generations(force = True, action = action)


_UNRESOLVED_BACKEND_STATE = object()


def _names_the_resident_model(resident: Optional[str], model_path: str) -> bool:
    """Whether a client's ``model_path`` names ``resident``.

    A cached row can pin a snapshot directory, so the load sends that path while the status the
    client reads back reports the repo id it maps to. Both name the same model, and an unload
    arriving under either has to find it.
    """
    return bool(resident) and model_id_matches(model_path, resident)


def _names_the_loading_model(loading: str, model_path: str) -> bool:
    """Whether a client's ``model_path`` names the load already in flight.

    Cancel sends the id the picker shows, which for a pinned row is not the path the load is
    running as, so a raw compare left Stop loading reporting success on a load still running.
    """
    return (
        model_path == loading
        or model_path.lower() == loading.lower()
        or _names_the_resident_model(loading, model_path)
    )


def _resident_standard_model_name(backend, model_path: str) -> str:
    """The registry name to unload for ``model_path``, or ``model_path`` when nothing matches.

    The backend refuses a name it never loaded, so a pinned load has to be evicted under the
    name it was registered with rather than the id the client shows.
    """
    active = getattr(backend, "active_model_name", None)
    if isinstance(active, str) and _names_the_resident_model(active, model_path):
        return active
    loaded = getattr(backend, "models", None)
    if isinstance(loaded, dict):
        for name in loaded:
            if isinstance(name, str) and _names_the_resident_model(name, model_path):
                return name
    return model_path


def _unload_evicts_standard_backend(backend, model_path: str) -> bool:
    """Whether ``backend.unload_model(model_path)`` will really evict something.

    The standard backend refuses to unload a name it never loaded ("don't unload
    a stale model") and returns success, so /unload for a model another tab has
    already replaced is a no-op. That must not count as a teardown: cancelling
    the running chats for it would end them and leave the resident model up.

    Mirrors the backend's own guard (case-insensitive on the active name, since
    the load path canonicalizes casing). A backend that exposes neither field is
    reported as a real unload, which keeps the previous behaviour.
    """
    active = getattr(backend, "active_model_name", _UNRESOLVED_BACKEND_STATE)
    loaded = getattr(backend, "models", _UNRESOLVED_BACKEND_STATE)
    if active is _UNRESOLVED_BACKEND_STATE and loaded is _UNRESOLVED_BACKEND_STATE:
        return True
    if isinstance(active, str) and active and active.lower() == (model_path or "").lower():
        return True
    if isinstance(active, str) and _names_the_resident_model(active, model_path):
        return True
    if not isinstance(loaded, dict):
        return False
    return model_path in loaded or any(
        isinstance(name, str) and _names_the_resident_model(name, model_path) for name in loaded
    )


def _unload_may_evict(model_path: str) -> bool:
    """Whether POST /unload for ``model_path`` can still tear something down.

    The refusal passes gate on this. A request naming a model another tab has
    already replaced reaches none of the teardown branches and returns the
    documented idempotent no-op (see _unload_evicts_standard_backend), so
    refusing it counts a teardown that cannot happen and leaves a stale tab
    unable to clear its selection. Each disjunct mirrors one teardown branch, so
    True means "some branch may fire", never "this unload succeeds".

    Attribute reads only, no lifecycle gate, so the pre-gate pass still fails
    fast on a swap that would really stop chats. A stale answer is safe in both
    directions: the gated pass re-runs this under the gate, and every branch
    re-runs the refusal at its own point of no return, so a False here can never
    let a teardown through unrefused.
    """
    backend = get_inference_backend()
    loading = getattr(backend, "get_loading_model", lambda: None)()
    if (
        loading is not None
        and hasattr(backend, "cancel_load")
        and _names_the_loading_model(loading, model_path)
    ):
        return True
    llama_backend = get_llama_cpp_backend()
    if llama_backend.is_active and (
        llama_backend.model_identifier == model_path
        or is_registered_native_path_label(llama_backend.model_identifier, model_path)
        or _names_the_resident_model(llama_backend.model_identifier, model_path)
        # Up but not serving is mid-load, evicted whatever model was named.
        or not llama_backend.is_loaded
    ):
        return True
    return _unload_evicts_standard_backend(backend, model_path)



def _mlx_runtime_settings_match(backend, request) -> bool:
    """Whether a loaded model already runs the request's MLX runtime settings.

    Only the MLX backend records these, so a backend that never stored them
    (GGUF, CUDA safetensors) always matches and reuse is unaffected. Both sides
    are normalized, otherwise an out-of-domain value would differ from the
    stored None on every request and reload forever.
    """
    entry = backend.models.get(backend.active_model_name, {}) or {}
    if "mlx_kv_bits_requested" not in entry:
        return True
    from core.inference.mlx_inference import _normalize_mlx_kv_bits

    return entry["mlx_kv_bits_requested"] == _normalize_mlx_kv_bits(request.mlx_kv_bits) and (
        entry.get("chat_template_override_requested") or None
    ) == (request.chat_template_override or None)


class _ScopedLoadAttempt(NamedTuple):
    token: str
    request_id: Optional[str]
    model_path: str
    subject: str
    cancel_event: threading.Event
    cancel_complete: threading.Event


_scoped_load_attempts_lock = threading.Lock()
_scoped_load_attempts: dict[tuple[str, str], _ScopedLoadAttempt] = {}
_scoped_load_cancel_tombstones: dict[tuple[str, str], tuple[str, float]] = {}
_running_load_attempt: Optional[_ScopedLoadAttempt] = None
_SCOPED_LOAD_CANCEL_TOMBSTONE_TTL_S = 60.0
# Bound on waiting for a cancel's teardown to report back. Only the /unload
# handler sets cancel_complete for a running attempt, so a disconnect or a
# shutdown between the cancel and its finally leaves nobody to set it. An
# unbounded wait there parks /load under inference_lifecycle_gate forever, and
# to_thread's executor threads are non-daemon, so it also blocks process exit.
_SCOPED_LOAD_CANCEL_HANDSHAKE_TIMEOUT_S = 15.0
_SCOPED_LOAD_CANCEL_TOMBSTONE_LIMIT_PER_SUBJECT = 256


def _prune_scoped_load_cancel_tombstones(now: float) -> None:
    expired = [
        key for key, (_, expires_at) in _scoped_load_cancel_tombstones.items() if expires_at <= now
    ]
    for key in expired:
        _scoped_load_cancel_tombstones.pop(key, None)


def _begin_load_attempt(request: LoadRequest, current_subject: str) -> _ScopedLoadAttempt:
    attempt = _ScopedLoadAttempt(
        token = uuid.uuid4().hex,
        request_id = request.load_request_id,
        model_path = request.model_path,
        subject = current_subject,
        cancel_event = threading.Event(),
        cancel_complete = threading.Event(),
    )
    if attempt.request_id is None:
        return attempt
    key = (current_subject, attempt.request_id)
    with _scoped_load_attempts_lock:
        now = time.monotonic()
        _prune_scoped_load_cancel_tombstones(now)
        if key in _scoped_load_attempts:
            raise HTTPException(
                status_code = 409,
                detail = "A load with this request ID is already in progress",
            )
        tombstone = _scoped_load_cancel_tombstones.pop(key, None)
        if (
            tombstone is not None
            and tombstone[0].strip().casefold() == attempt.model_path.strip().casefold()
        ):
            attempt.cancel_event.set()
            attempt.cancel_complete.set()
        _scoped_load_attempts[key] = attempt
    return attempt


def _finish_load_attempt(attempt: _ScopedLoadAttempt) -> None:
    if attempt.request_id is None:
        return
    key = (attempt.subject, attempt.request_id)
    with _scoped_load_attempts_lock:
        if _scoped_load_attempts.get(key) is attempt:
            _scoped_load_attempts.pop(key, None)


def _cancel_scoped_load_attempt(
    request: UnloadRequest, current_subject: str
) -> tuple[Optional[_ScopedLoadAttempt], bool]:
    request_id = request.cancel_load_request_id
    if request_id is None:
        return None, False
    key = (current_subject, request_id)
    with _scoped_load_attempts_lock:
        now = time.monotonic()
        _prune_scoped_load_cancel_tombstones(now)
        attempt = _scoped_load_attempts.get(key)
        if attempt is None:
            subject_tombstones = [
                tombstone_key
                for tombstone_key in _scoped_load_cancel_tombstones
                if tombstone_key[0] == current_subject
            ]
            if len(subject_tombstones) >= _SCOPED_LOAD_CANCEL_TOMBSTONE_LIMIT_PER_SUBJECT:
                oldest = min(
                    subject_tombstones,
                    key = lambda item: _scoped_load_cancel_tombstones[item][1],
                )
                _scoped_load_cancel_tombstones.pop(oldest, None)
            _scoped_load_cancel_tombstones[key] = (
                request.model_path,
                now + _SCOPED_LOAD_CANCEL_TOMBSTONE_TTL_S,
            )
            return None, False
        if attempt.model_path.strip().casefold() != request.model_path.strip().casefold():
            return None, False
        attempt.cancel_event.set()
        is_running = _running_load_attempt is attempt
        if not is_running:
            # Queued/completed attempts have no backend teardown handler to signal
            # completion. Let a queued attempt fail immediately once it gets the gate.
            attempt.cancel_complete.set()
        return attempt, is_running


async def _run_tracked_load_model_impl(
    request: LoadRequest,
    fastapi_request: Request,
    current_subject: str,
    *,
    attempt: Optional[_ScopedLoadAttempt] = None,
    current_request_counted: bool = False,
    on_reload_confirmed = None,
):
    global _running_load_attempt

    owned_attempt = attempt is None
    attempt = attempt or _begin_load_attempt(request, current_subject)
    with _scoped_load_attempts_lock:
        _running_load_attempt = attempt
    try:
        if attempt.cancel_event.is_set():
            raise HTTPException(status_code = 409, detail = "Model load cancelled")
        return await _load_model_impl(
            request,
            fastapi_request,
            current_subject,
            current_request_counted = current_request_counted,
            on_reload_confirmed = on_reload_confirmed,
            load_cancel_event = attempt.cancel_event,
        )
    finally:
        if attempt.cancel_event.is_set() and not attempt.cancel_complete.is_set():
            if not await asyncio.to_thread(
                attempt.cancel_complete.wait, _SCOPED_LOAD_CANCEL_HANDSHAKE_TIMEOUT_S
            ):
                logger.warning(
                    "Scoped load cancel did not report back in %.0fs; releasing the load: %s",
                    _SCOPED_LOAD_CANCEL_HANDSHAKE_TIMEOUT_S,
                    request.model_path,
                )
        with _scoped_load_attempts_lock:
            if _running_load_attempt is attempt:
                _running_load_attempt = None
        if owned_attempt:
            _finish_load_attempt(attempt)


async def _load_model_direct(
    request: LoadRequest,
    fastapi_request: Request,
    current_subject: str = Depends(get_current_subject),
):
    return await _tunnel_safe_json(
        load_model_gated(request, fastapi_request, current_subject, user_initiated = True),
        label = "Model load",
    )


async def load_model_gated(
    request: LoadRequest,
    fastapi_request: Request,
    current_subject: str,
    *,
    user_initiated: bool = False,
):
    """Everything ``POST /load`` does except the tunnel-safe padding.

    In-process callers (preview) must await THIS, not the route: the route's slow
    path returns a StreamingResponse nobody in-process drains, so awaiting it would
    return mid-load and hide a late failure in an unread body. This blocks until the
    model is resident and raises the real exception.
    """
    # A sidecar install that has reserved the swap must not lose to a load that
    # then gets unloaded by the pre-swap teardown. Rechecked under the gate: an
    # install can reserve while this request queues on the gate, so the pre-gate
    # check alone is only a fast path.
    from core.inference.llama_keepwarm import inference_lifecycle_gate

    attempt = _begin_load_attempt(request, current_subject)
    try:
        _raise_if_sidecar_swap_in_progress()
        # Hold the lifecycle gate across the load so idle auto-unload can't unload the
        # model mid-load. Auto-switch calls the tracked impl directly since it already
        # holds this gate.
        async with inference_lifecycle_gate():
            _raise_if_sidecar_swap_in_progress()
            # The active-generation gate runs inside _load_model_impl, once it knows this is a real
            # reload, and still under the lifecycle gate so the check stays atomic with the teardown.
            response = await _run_tracked_load_model_impl(
                request,
                fastapi_request,
                current_subject,
                attempt = attempt,
                on_reload_confirmed = lambda *, cancel: _raise_or_cancel_active_generations(
                    force = request.force_cancel_active,
                    action = "Loading a model",
                    cancel = cancel,
                ),
            )
        # Record provenance only once the model is resident, and here rather than
        # inside the impl so the already-loaded fast paths are covered too. Preview
        # keeps the False default: only an explicit UI load pins. Outside the gate:
        # it is a plain attribute write and holding the gate for it would only widen
        # the window that blocks unload.
        get_llama_cpp_backend()._loaded_by_user_action = user_initiated
        return response
    finally:
        _finish_load_attempt(attempt)


async def _load_model_impl(
    request: LoadRequest,
    fastapi_request: Request,
    current_subject: str,
    *,
    current_request_counted: bool = False,
    on_reload_confirmed = None,
    load_cancel_event: Optional[threading.Event] = None,
):
    from core.inference.llama_cpp import LlamaServerNotFoundError

    def _raise_if_scoped_load_cancelled() -> None:
        if load_cancel_event is not None and load_cancel_event.is_set():
            raise HTTPException(status_code = 409, detail = "Model load cancelled")

    # A new load starts here; arm the progress throttle so this load's first
    # sampled step logs even if it reports 100% immediately (cached/small load).
    _reset_load_progress_step()

    # Live "loading" row: discarded if already loaded, relabelled on the real id, closed on exit.
    _load_event = api_monitor.record_lifecycle(
        event = "load",
        model = _lifecycle_model_label(request.model_path, request.gguf_variant),
        running = True,
        # Auto-switch loads run before the request row opens, so a failure leaves only this.
        via_api_key = _request_used_api_key(fastapi_request),
        # The row is shared, so name its owner or the overlay pops open in unrelated tabs.
        subject = current_subject,
    )

    native_grant_backed = False
    model_log_label = request.model_path
    gguf_load_stack = ExitStack()
    try:
        # Validate user pass-through args up front so a managed-flag collision
        # returns 400 before any model work.
        try:
            extra_llama_args = validate_extra_args(request.llama_extra_args)
        except ValueError as exc:
            # Keep the curated validation message (names the flag); just strip paths.
            logger.warning("inference.validate_extra_args_failed: %s", exc)
            raise HTTPException(
                status_code = 400,
                detail = redact_native_paths(str(exc)),
            )
        # Re-narrow []-from-None back to None so the inheritance path below can
        # tell "caller omitted" from "caller explicit []".
        extra_llama_args: Optional[list[str]] = (
            None if request.llama_extra_args is None else extra_llama_args
        )

        # Manual mode owns the offload flags. Preserve an explicit layer count
        # by translating its last-wins value into the first-class field before
        # stripping the raw flags. This keeps CLI pass-through such as
        # ``-ngl 20`` from being silently replaced by the manual default (-1).
        # The inherited path already strips offload flags. Manual + per-GPU
        # ratio owns --tensor-split the same way.
        if request.gpu_memory_mode == "manual" and extra_llama_args:
            _gpu_layers_override = parse_gpu_layers_override(extra_llama_args)
            if _gpu_layers_override is not None:
                request = request.model_copy(update = {"gpu_layers": _gpu_layers_override})
            _stripped_explicit = strip_shadowing_flags(
                extra_llama_args,
                strip_context = False,
                strip_cache = False,
                strip_spec = False,
                strip_template = False,
                strip_split_mode = False,
                strip_tensor_split = _should_strip_tensor_split(request),
                strip_offload = True,
            )
            if _stripped_explicit != extra_llama_args:
                logger.info(
                    "Manual GPU memory owns the offload flags; stripping them "
                    "from explicit llama_extra_args: %s -> %s",
                    extra_llama_args,
                    _stripped_explicit,
                )
                extra_llama_args = _stripped_explicit

        # Keep every downstream consumer on the normalized explicit list. In
        # particular, the already-loaded comparator must not compare the raw
        # request's managed offload flags against the stripped launch state.
        request = request.model_copy(update = {"llama_extra_args": extra_llama_args})

        model_identifier, model_log_label, native_grant_backed = (
            _resolve_model_identifier_for_request(request, operation = "load-model")
        )
        # Version switching is handled by the subprocess-based inference
        # backend -- no ensure_transformers_version() needed here.

        # Resolve the effective chat-template override once, up front: an
        # explicit user override, else a bundled family template (e.g. the
        # gemma-4 override that ships preserve_thinking without re-downloading
        # quants), else None. Used for both the reload-dedup check below and the
        # load_model calls, so the live backend state and the incoming request
        # compare against the same template text.
        effective_chat_template_override = resolve_effective_chat_template_override(
            model_identifier = model_identifier,
            user_override = request.chat_template_override,
        )

        # Reclaim the GPU for chat (evicting a resident Images/Video pipeline) only once the load is known viable; the
        # already-loaded fast paths below re-assert CHAT themselves. Deferred past validation so a doomed load evicts nothing.
        from core.inference.gpu_arbiter import acquire_for, current_owner, release, CHAT

        # ── Already-loaded check: skip reload if the exact model is active ──
        backend = await asyncio.to_thread(get_inference_backend)
        llama_backend = get_llama_cpp_backend()

        # Resolve once so dedupe, admission and launch use the same slot count.
        _n_parallel = _resolve_parallel_slots(request, fastapi_request)

        def _reuse_loaded_gguf(
            intent: GgufLoadIntent, *, display_name: Optional[str] = None
        ) -> Optional[LoadResponse]:
            if not (
                llama_backend.adopt_load_intent_if_matched(intent)
                and getattr(llama_backend, "_audio_probed", True)
            ):
                return None
            api_monitor.discard(_load_event)
            logger.info("Model already loaded (GGUF): %s, skipping reload", model_log_label)
            return _gguf_load_response(
                llama_backend,
                "already_loaded",
                model_log_label if native_grant_backed else llama_backend.model_identifier,
                display_name = model_log_label if native_grant_backed else display_name,
                is_local_model = _loaded_is_local_model(
                    llama_backend, native_grant_backed, llama_backend.model_identifier
                ),
            )

        is_direct_gguf_request = model_identifier.lower().endswith(".gguf")
        if llama_backend.is_loaded and (request.gguf_variant or is_direct_gguf_request):
            reused = _reuse_loaded_gguf(
                _active_gguf_intent(
                    request,
                    llama_backend,
                    model_identifier = model_identifier,
                    chat_template_override = effective_chat_template_override,
                    n_parallel = _n_parallel,
                    native_grant_backed = native_grant_backed,
                )
            )
            if reused is not None:
                # Requested GGUF chat model already resident: assert CHAT ownership (no-op when
                # held) to correct a drifted owner. Unless the resident server is a confirmed
                # zero-VRAM one, which coexists with an image/video pipeline.
                if not llama_backend.holds_no_vram:
                    await asyncio.to_thread(acquire_for, CHAT)
                return reused
        if not (request.gguf_variant or is_direct_gguf_request):
            if (
                backend.active_model_name
                and backend.active_model_name.lower() == model_identifier.lower()
                and _mlx_runtime_settings_match(backend, request)
            ):
                api_monitor.discard(_load_event)  # nothing loaded, no monitor row
                logger.info(f"Model already loaded (Unsloth): {model_log_label}, skipping reload")
                inference_config = load_inference_config(backend.active_model_name)
                _model_info = backend.models.get(backend.active_model_name, {})
                _chat_template = None
                try:
                    _tpl_info = _model_info.get("chat_template_info", {})
                    _chat_template = _tpl_info.get("template")
                except Exception as e:
                    logger.warning(
                        f"Could not retrieve chat template for {backend.active_model_name}: {e}"
                    )
                # Classify via the same path as GGUF.
                _sf_flags = _detect_safetensors_features(backend, _chat_template)
                _sf_supports_reasoning = _sf_flags["supports_reasoning"]
                _sf_reasoning_style = _sf_flags["reasoning_style"]
                # Requested chat model already resident: assert CHAT ownership (no-op when held) to correct a drifted owner.
                await asyncio.to_thread(acquire_for, CHAT)
                return LoadResponse(
                    status = "already_loaded",
                    model = model_log_label if native_grant_backed else backend.active_model_name,
                    display_name = model_log_label
                    if native_grant_backed
                    else backend.active_model_name,
                    is_vision = _model_info.get("is_vision", False),
                    is_lora = _model_info.get("is_lora", False),
                    is_gguf = False,
                    is_local_model = native_grant_backed or is_local_path(backend.active_model_name),
                    is_audio = _model_info.get("is_audio", False),
                    audio_type = _model_info.get("audio_type"),
                    has_audio_input = _model_info.get("has_audio_input", False),
                    is_mlx = bool(_model_info.get("is_mlx", False)),
                    mlx_kv_bits = _model_info.get("mlx_kv_bits"),
                    mlx_kv_bits_requested = _model_info.get("mlx_kv_bits_requested"),
                    mlx_kv_quant_eligibility = _model_info.get("mlx_kv_quant_eligibility"),
                    mlx_kv_quant_reason = _model_info.get("mlx_kv_quant_reason"),
                    mlx_kv_quant_note = _model_info.get("mlx_kv_quant_note"),
                    # Requested, as /status reports it: a null override would read
                    # as "using the default".
                    chat_template_override = _model_info.get("chat_template_override_requested"),
                    chat_template_override_reason = _model_info.get("chat_template_override_reason"),
                    inference = inference_config,
                    requires_trust_remote_code = _resolve_loaded_trust_remote_code(
                        backend.active_model_name, _model_info, inference_config
                    ),
                    supports_reasoning = _sf_supports_reasoning,
                    reasoning_style = _sf_reasoning_style,
                    reasoning_effort_levels = _sf_flags.get("reasoning_effort_levels", []),
                    reasoning_always_on = _sf_flags["reasoning_always_on"],
                    supports_preserve_thinking = _sf_flags["supports_preserve_thinking"],
                    preserve_thinking_default = _sf_flags.get("preserve_thinking_default", False),
                    supports_tools = _sf_flags["supports_tools"],
                    context_length = _positive_int_or_none(_model_info.get("context_length")),
                    chat_template = _chat_template,
                )

        # is_lora auto-detected from adapter_config.json on disk/HF.
        # Probe wrap so offline loads skip 30-60s of soft-failed network checks before
        # the worker starts. Off-loop: the guard can spend seconds on DNS plus a HEAD and
        # its TCP fallback, and this handler is awaited directly by the route, so running
        # it inline would stall every unrelated request. Same shape as /validate.
        def _resolve_config():
            with _hf_offline_if_unreachable_for(model_identifier):
                return ModelConfig.from_identifier(
                    model_id = model_identifier,
                    hf_token = request.hf_token,
                    gguf_variant = request.gguf_variant,
                    # A native grant covers one directory, and this is the first
                    # pass that touches a drafter candidate, so the boundary has
                    # to travel with it rather than being applied afterwards.
                    drafter_accept = _native_drafter_accept if native_grant_backed else None,
                )

        # Guard and call go to the worker together: from_identifier can import transformers
        # to build the detection registry, and the guard's probe is a network round trip.
        config = await asyncio.to_thread(_resolve_config)

        if not config:
            raise HTTPException(
                status_code = 400,
                detail = f"Invalid model identifier: {model_log_label}",
            )

        # Resolve inherited extras once before command-dependent preflights.
        extra_llama_args = _resolve_inherited_extra_args(
            request,
            config,
            model_identifier,
            extra_llama_args,
            effective_chat_template_override,
        )

        # Invalid GPU IDs must fail before the training coexistence guard.
        placement = await _prepare_load_placement(config, request, extra_llama_args)
        if placement.diffusion_kind is True and extra_llama_args:
            # The visual runner builds its own command and appends none of these, so
            # keeping them would record a load as running arguments the process never
            # received, and the panel would then show and remember them. This is the
            # authoritative classification: the caller only had staged metadata, which
            # can be inconclusive for a GGUF it has not finished downloading.
            logger.info(
                "Dropping %d extra llama-server arg(s) for %s: the diffusion runner takes none.",
                len(extra_llama_args),
                model_log_label,
            )
            extra_llama_args = []
        if config.is_gguf and extra_llama_args:
            # After the slot count is known, because the floor depends on it. The
            # editor draws the same line, but a CLI or API caller never sees it, and
            # this is the one class of pass-through value that takes the server down
            # during startup rather than being ignored: a 400 here beats a load that
            # has already unloaded the previous model.
            from core.inference.llama_server_args import check_batch_floor
            try:
                check_batch_floor(
                    extra_llama_args,
                    # The count that will launch, not the one asked for: a build
                    # without --kv-unified serves one slot however many were
                    # requested, and refusing a batch of 2 against it is a 400 on a
                    # command that would have run.
                    _effective_parallel_slots(_n_parallel, diffusion_kind = placement.diffusion_kind),
                )
            except ValueError as exc:
                # An embedding GGUF comes down further still: --embedding caps the
                # batch at the micro-batch, so load_model reduces the slots to it
                # before launching. Read only now, because it costs a header read
                # and it can only ever turn a refusal into an acceptance.
                if not await _batch_floor_survives_embedding_clamp(
                    config,
                    extra_llama_args,
                    _n_parallel,
                    request,
                    diffusion_kind = placement.diffusion_kind,
                ):
                    raise HTTPException(status_code = 400, detail = str(exc)) from exc
        gguf_intent: Optional[GgufLoadIntent] = None
        _tensor_intent_overall = False
        if config.is_gguf:
            gguf_intent = _resolve_gguf_load_intent(
                config,
                request,
                native_grant_backed = native_grant_backed,
                chat_template_override = effective_chat_template_override,
                extra_args = extra_llama_args,
                placement = placement,
                n_parallel = _n_parallel,
            )
            same_loaded_model = llama_backend.matches_load_source(gguf_intent)
            if same_loaded_model and config.gguf_hf_repo and llama_backend.gguf_path:
                gguf_intent = replace(
                    gguf_intent,
                    mtp_draft_path = _mtp_draft_for_path(llama_backend.gguf_path, False),
                    dspark_draft_path = _dspark_draft_for_path(llama_backend.gguf_path, False),
                    dflash_draft_path = _dflash_draft_for_path(llama_backend.gguf_path, False),
                    compare_mtp_draft = True,
                )
            _effective_tensor = _effective_tensor_parallel(
                extra_llama_args, request.tensor_parallel
            )
            _tensor_intent_overall = _effective_tensor or _carry_preserved_tensor_intent(
                preserved = getattr(llama_backend, "layer_preserves_tensor_intent", False),
                same_model = same_loaded_model,
                explicit_drop = _is_explicit_tensor_drop(request),
            )
            gguf_intent = replace(
                gguf_intent,
                preserve_multi_gpu_on_layer = (_tensor_intent_overall and not _effective_tensor),
            )
            reused = _reuse_loaded_gguf(
                gguf_intent,
                display_name = config.display_name,
            )
            if reused is not None:
                return reused

        # Config-resolved dedupe must run first: a duplicate must not refuse/cancel active chats.
        # Refusal is non-destructive; defer forced cancellation past every remaining rejection.
        if on_reload_confirmed is not None:
            on_reload_confirmed(cancel = False)
        cancel_pending = on_reload_confirmed is not None and bool(request.force_cancel_active)

        if not config.is_gguf and _mlx_distributed_launch_detected():
            raise HTTPException(
                status_code = 400,
                detail = (
                    "Unsloth does not support distributed MLX inference under "
                    "mlx.launch. Use `mlx.launch ... unsloth chat` or run Unsloth "
                    "without the distributed launcher."
                ),
            )

        # Effective quantization (LoRA can flip 4-bit -> 16-bit); guard + load reuse it.
        effective_load_in_4bit = _effective_load_in_4bit(config, request.load_in_4bit)
        if effective_load_in_4bit != request.load_in_4bit:
            logger.info(
                f"Resolved load_in_4bit={effective_load_in_4bit} for '{model_log_label}' "
                f"from adapter_config.json / base model (requested {request.load_in_4bit})"
            )
        # Latest-sidecar models load 16-bit (worker refuses bnb 4-bit); size the guard
        # to match. Off-loop: tier resolution reads configs.
        if effective_load_in_4bit and not config.is_gguf:
            from utils.transformers_version import latest_tier_active_for
            if await asyncio.to_thread(
                _offline_guarded,
                (model_identifier, config.identifier, getattr(config, "base_model", None)),
                latest_tier_active_for,
                config.identifier,
                request.hf_token,
            ):
                effective_load_in_4bit = False
                logger.info(
                    f"Latest-transformers sidecar active for '{model_log_label}' - "
                    "sizing and loading in 16-bit (4-bit is disabled for brand-new "
                    "architectures)"
                )

        # Apply the training coexistence policy before the unload step below
        # frees the resident model. Off-loop and guarded: the guard does sync HF work.
        await asyncio.to_thread(
            _offline_guarded,
            (model_identifier, config.identifier, getattr(config, "base_model", None)),
            _guard_chat_load_against_training,
            config,
            request,
            load_in_4bit = effective_load_in_4bit,
            placement = placement,
            llama_extra_args = extra_llama_args,
            n_parallel = _n_parallel,
        )

        # Mark the load and refuse one the download manager already owns BEFORE the eviction below: this 409 leaves nothing
        # loaded. It runs after argument inheritance, since a carried --no-mmproj changes the companion requirement.
        if config.is_gguf and config.gguf_hf_repo:
            from core.inference.llama_cpp import gguf_load_in_flight

            gguf_load_stack.enter_context(gguf_load_in_flight(config.gguf_hf_repo))

            from core.inference.llama_cpp import _hub_download_blocks_gguf_load

            if await asyncio.to_thread(
                _hub_download_blocks_gguf_load,
                config.gguf_hf_repo,
                config.gguf_variant,
                require_mmproj = bool(
                    config.is_vision and not extra_args_disable_mmproj(extra_llama_args)
                ),
                hf_token = request.hf_token,
            ):
                raise HTTPException(
                    status_code = 409,
                    detail = (
                        f"'{model_log_label}' is currently being downloaded "
                        "by the download manager. Wait for the download to "
                        "finish (or cancel it), then load the model."
                    ),
                )

        # Load now known viable: reclaim the GPU for chat, evicting a resident Images/Video pipeline, so a doomed load evicts
        # nothing. The marker is entered UNDER the arbiter lock, since a chat load holds no process until its GGUF lands.
        from core.inference.llama_cpp import chat_load_in_flight, zero_vram_chat_load

        # ...but only when this load will actually use the GPU, exactly as the image and video loaders gate on their device:
        # a manual gpu_layers=0 load runs on CPU, so taking the arbiter would cancel an image/video generation for nothing.
        chat_load_needs_gpu = not (
            config.is_gguf
            and await asyncio.to_thread(
                zero_vram_chat_load,
                request.gpu_memory_mode,
                request.gpu_layers,
                extra_llama_args,
                bool(config.is_vision and not extra_args_disable_mmproj(extra_llama_args)),
                request.speculative_type,
            )
        )
        # Ahead of the arbiter: acquire_for evicts a resident Images/Video pipeline and the
        # confirmation below cancels the running generations, both before load_model's own
        # copy of this check runs. A header-sized read spares them. Fails open into that copy.
        if config.is_gguf and gguf_intent is not None:
            _non_chat = await asyncio.to_thread(
                llama_backend.non_chat_gguf_refusal_for_intent, gguf_intent
            )
            if _non_chat:
                logger.error("Refusing non-chat GGUF before the GPU handoff: %s", _non_chat)
                raise HTTPException(status_code = 400, detail = _non_chat)
            # same reason: the host-RAM guard reads the finished argv, so it answers too late
            _host_offload = await asyncio.to_thread(
                llama_backend.host_offload_refusal_for_intent, gguf_intent
            )
            if _host_offload:
                logger.error("Refusing an oversized GGUF before the GPU handoff: %s", _host_offload)
                raise HTTPException(status_code = 400, detail = _host_offload)

        if chat_load_needs_gpu:
            await asyncio.to_thread(
                acquire_for,
                CHAT,
                lambda: gguf_load_stack.enter_context(chat_load_in_flight()),
            )
        else:
            # The marker still goes up (the download-manager handshake reads it, and it keeps this load cancellable). A stale CHAT claim is dropped AFTER the load.
            gguf_load_stack.enter_context(chat_load_in_flight())

        # ── GGUF path: load via llama-server ──────────────────────
        if config.is_gguf:
            llama_backend = get_llama_cpp_backend()
            unsloth_backend = await asyncio.to_thread(get_inference_backend)

            # Fast path only: a swap can still be reserved during the drain.
            _raise_if_sidecar_swap_in_progress()

            # Drain active generations first (the lifecycle gate blocks new starts); a forced swap
            # excludes the ones it is about to cancel rather than waiting them out.
            await _wait_for_model_switch_idle(
                current_request_counted = current_request_counted,
                cancel_pending = cancel_pending,
            )
            # Decisive recheck, and the last thing that can reject this load, so it runs BEFORE the
            # cancel: rejecting after would stop every chat for nothing.
            _raise_if_sidecar_swap_in_progress()

            # Point of no return for the GGUF path: nothing left can reject this load, so stop the
            # chats the swap interrupts (or refuse, if the caller never opted in).
            _raise_if_scoped_load_cancelled()
            if on_reload_confirmed is not None:
                on_reload_confirmed(cancel = True)

            # Let the cancelled generations unwind before the teardown; no check follows, so this cannot
            # strand a cancelled chat behind a 409. Bounded: TTS observes no cancel event, so an
            # unbounded wait would hold the gate for a whole audio run.
            if cancel_pending:
                await _wait_for_model_switch_idle(
                    current_request_counted = current_request_counted,
                    timeout_s = _POST_CANCEL_DRAIN_TIMEOUT_S,
                )

            # Unload any active Unsloth model only after every hub conflict check.
            if unsloth_backend.active_model_name:
                logger.info(
                    f"Unloading Unsloth model '{unsloth_backend.active_model_name}' before loading GGUF"
                )
                await asyncio.to_thread(
                    unsloth_backend.unload_model, unsloth_backend.active_model_name
                )

            # Every rejection and source check has completed. The immutable
            # intent resolved before teardown is now the only launch input.
            if gguf_intent is None:
                raise RuntimeError("GGUF load intent was not resolved")
            load_intent = gguf_intent

            # Run a single load attempt with the given tensor flag + extras.
            async def _attempt_gguf_load(
                tensor_parallel: bool, attempt_extra_args: Optional[list[str]]
            ) -> bool:
                attempt = replace(
                    load_intent,
                    extra_args = (
                        tuple(attempt_extra_args) if attempt_extra_args is not None else None
                    ),
                    tensor_parallel = tensor_parallel,
                    preserve_multi_gpu_on_layer = bool(
                        _tensor_intent_overall
                        and not _effective_tensor_parallel(attempt_extra_args, tensor_parallel)
                    ),
                )
                return await asyncio.to_thread(
                    llama_backend.load_model,
                    intent = attempt,
                    load_cancel_event = load_cancel_event,
                )

            # Tensor parallelism is arch-gated in llama.cpp and crashes some loads
            # outright (e.g. Gemma 3n aborts with a GGML_ASSERT). The helper auto-
            # falls back to layer split so the checkbox never blocks a model from
            # loading; the response reports the backend's actual tensor_parallel
            # state so the UI toggle reflects the fallback.
            success = await load_with_tensor_fallback(
                _attempt_gguf_load,
                requested_tensor = request.tensor_parallel,
                extra_args = extra_llama_args,
                label = config.identifier,
                cancelled = lambda: (
                    llama_backend.load_cancelled()
                    or bool(load_cancel_event and load_cancel_event.is_set())
                ),
            )

            if not success:
                raise HTTPException(
                    status_code = 500,
                    detail = f"Failed to load GGUF model: {model_log_label if native_grant_backed else config.display_name}",
                )

            # An Images/Video acquire can land in the gap between the acquire above and load_model clearing the cancel event, so
            # its cancellation is lost. Ownership survives that gap, so this load undoes itself. A zero-VRAM load never yields.
            # Recovery may turn an automatic GPU request into a zero-VRAM load.
            if llama_backend.holds_no_vram:
                chat_load_needs_gpu = False
            if chat_load_needs_gpu and current_owner() != CHAT:
                await asyncio.to_thread(llama_backend.unload_model)
                raise HTTPException(
                    status_code = 409,
                    detail = (
                        "An image or video model took the GPU while this model was loading, "
                        "so the load was cancelled. Unload that model, then try again."
                    ),
                )
            if not chat_load_needs_gpu:
                # Drop the stale CHAT claim after any zero-VRAM load.
                await asyncio.to_thread(release, CHAT)

            logger.info(
                f"Loaded GGUF model via llama-server: {model_log_label if native_grant_backed else config.identifier}"
            )
            _close_load_event(
                _load_event,
                model_log_label if native_grant_backed else config.identifier,
                request.gguf_variant or getattr(llama_backend, "hf_variant", None),
            )
            # Clear any idle-unload reload stash now, not only on the next poll.
            from core.inference.llama_keepwarm import note_model_loaded

            await asyncio.to_thread(note_model_loaded, llama_backend)
            # A plain load advertises its own identifier; auto-switch overwrites
            # this with the repo id right after _load_model_impl returns.
            llama_backend._openai_advertised_id = None

            # Audio detection moved into load_model under _serial_load_lock (#5642).
            _gguf_audio = llama_backend._audio_type
            _gguf_is_audio = llama_backend._is_audio
            llama_backend._native_display_label = model_log_label if native_grant_backed else None
            llama_backend._native_grant_backed = bool(native_grant_backed)
            # Provenance is a load-time fact. Re-deriving it per status poll
            # would flip a local model to remote if its directory is deleted
            # or unmounted underneath a still-running server.
            llama_backend._is_local_model = bool(native_grant_backed or config.is_local)
            if _gguf_is_audio:
                logger.info(f"GGUF model detected as audio: audio_type={_gguf_audio}")

            return _gguf_load_response(
                llama_backend,
                "loaded",
                model_log_label if native_grant_backed else config.identifier,
                display_name = model_log_label if native_grant_backed else config.display_name,
                is_local_model = config.is_local,
                inference_identifier = config.identifier,
            )

        # ── Standard path: load via Unsloth/transformers ──────────
        backend = await asyncio.to_thread(get_inference_backend)

        # Same sidecar rejection as GGUF: fast path ahead of the drain, rechecked after.
        _raise_if_sidecar_swap_in_progress()

        llama_backend = get_llama_cpp_backend()
        await _wait_for_model_switch_idle(
            current_request_counted = current_request_counted,
            cancel_pending = cancel_pending,
        )
        _raise_if_sidecar_swap_in_progress()

        # Point of no return for the Unsloth path: cancel only once nothing can still reject the load.
        _raise_if_scoped_load_cancelled()
        if on_reload_confirmed is not None:
            on_reload_confirmed(cancel = True)

        # Let the cancelled generations unwind before the teardown; no check follows. Bounded like GGUF.
        if cancel_pending:
            await _wait_for_model_switch_idle(
                current_request_counted = current_request_counted,
                timeout_s = _POST_CANCEL_DRAIN_TIMEOUT_S,
            )
        # Unload any active GGUF model first, off-loop: a 600 GB teardown measures
        # 160s and on-loop would block _tunnel_safe_json's own padding.
        if llama_backend.is_loaded:
            logger.info("Unloading GGUF model before loading Unsloth model")
            await asyncio.to_thread(llama_backend.unload_model)

        # Shut down any export subprocess to free VRAM
        try:
            from core.export import get_export_backend
            exp_backend = get_export_backend()
            if exp_backend.current_checkpoint:
                logger.info("Shutting down export subprocess to free GPU memory for inference")
                exp_backend._shutdown_subprocess()
                exp_backend.current_checkpoint = None
                exp_backend.is_vision = False
                exp_backend.is_peft = False
        except Exception as e:
            logger.warning("Could not shut down export subprocess: %s", e)

        # Resolved before the guard so both size the same load.
        load_in_4bit = effective_load_in_4bit

        # Load in a thread so the event loop stays free for download progress
        # polling and other requests.
        success = await asyncio.to_thread(
            backend.load_model,
            config = config,
            max_seq_length = request.max_seq_length,
            load_in_4bit = load_in_4bit,
            hf_token = request.hf_token,
            trust_remote_code = request.trust_remote_code,
            approved_remote_code_fingerprint = request.approved_remote_code_fingerprint,
            gpu_ids = placement.requested_gpu_ids,
            subject = current_subject,
            mlx_kv_bits = request.mlx_kv_bits,
            chat_template_override = request.chat_template_override,
            load_cancel_event = load_cancel_event,
        )

        if not success:
            # Check if YAML says this model needs trust_remote_code.
            if not request.trust_remote_code:
                model_defaults = load_model_defaults(config.identifier)
                yaml_trust = model_defaults.get("inference", {}).get("trust_remote_code", False)
                if yaml_trust:
                    raise HTTPException(
                        status_code = 400,
                        detail = (
                            f"Model '{config.display_name}' requires trust_remote_code to be enabled. "
                            f"Please enable 'Trust remote code' in Chat Settings and try again."
                        ),
                    )
            raise HTTPException(
                status_code = 500,
                detail = f"Failed to load model: {model_log_label if native_grant_backed else config.display_name}",
            )

        # Same guard the GGUF branch runs above: an Images/Video acquire can land between this load's cancellation and its publish, so this load undoes itself.
        if current_owner() != CHAT:
            await asyncio.to_thread(backend.unload_model, config.identifier)
            # The worker's base CUDA context outlives the model unload, so kill it too.
            await asyncio.to_thread(backend._shutdown_subprocess, 5.0)
            raise HTTPException(
                status_code = 409,
                detail = (
                    "An image or video model took the GPU while this model was loading, "
                    "so the load was cancelled. Unload that model, then try again."
                ),
            )

        logger.info(
            f"Loaded model: {model_log_label if native_grant_backed else config.identifier}"
        )
        _close_load_event(
            _load_event, model_log_label if native_grant_backed else config.identifier, None
        )
        # Clear any idle-unload reload stash: a manual load supersedes an idle-freed
        # GGUF, so the next /v1 request must not resurrect it. Mirror the GGUF branch
        # above; without this a non-GGUF load leaves a stale stash until the idle
        # poll clears it (and never, while idle-unload is off).
        from core.inference.llama_keepwarm import note_model_loaded

        note_model_loaded()

        # Load inference configuration parameters
        inference_config = load_inference_config(config.identifier)

        # Get chat template from tokenizer
        _chat_template = None
        try:
            _model_info = backend.models.get(config.identifier, {})
            _tpl_info = _model_info.get("chat_template_info", {})
            _chat_template = _tpl_info.get("template")
        except Exception:
            pass

        # Classify reasoning/tool flags via the GGUF sniffer.
        _sf_flags = _detect_safetensors_features(backend, _chat_template)

        # Report validate_model's requirement (raw auto_map OR YAML) plus the value the
        # load used, and persist it, so a later retry/rollback doesn't send
        # trust_remote_code=false for a custom-code model (and status reports it too).
        _requires_rc = _resolve_loaded_trust_remote_code(
            config.identifier,
            None,
            inference_config,
            request.hf_token,
            trust_remote_code_used = bool(getattr(request, "trust_remote_code", False)),
        )
        try:
            backend.models.setdefault(config.identifier, {})["requires_trust_remote_code"] = (
                _requires_rc
            )
        except Exception:
            pass

        return LoadResponse(
            status = "loaded",
            model = model_log_label if native_grant_backed else config.identifier,
            display_name = model_log_label if native_grant_backed else config.display_name,
            is_vision = config.is_vision,
            is_lora = config.is_lora,
            is_gguf = False,
            is_local_model = config.is_local,
            # Post-load classification (mirrored from the worker) wins here.
            is_audio = _model_info.get("is_audio", config.is_audio),
            audio_type = _model_info.get("audio_type", config.audio_type),
            has_audio_input = _model_info.get("has_audio_input", config.has_audio_input),
            is_mlx = bool(_model_info.get("is_mlx", False)),
            mlx_kv_bits = _model_info.get("mlx_kv_bits"),
            mlx_kv_bits_requested = _model_info.get("mlx_kv_bits_requested"),
            mlx_kv_quant_eligibility = _model_info.get("mlx_kv_quant_eligibility"),
            mlx_kv_quant_reason = _model_info.get("mlx_kv_quant_reason"),
            mlx_kv_quant_note = _model_info.get("mlx_kv_quant_note"),
            # Requested, as /status reports it: a null override would read as
            # "using the default".
            chat_template_override = _model_info.get("chat_template_override_requested"),
            chat_template_override_reason = _model_info.get("chat_template_override_reason"),
            inference = inference_config,
            requires_trust_remote_code = _requires_rc,
            supports_reasoning = _sf_flags["supports_reasoning"],
            reasoning_style = _sf_flags["reasoning_style"],
            reasoning_effort_levels = _sf_flags.get("reasoning_effort_levels", []),
            reasoning_always_on = _sf_flags["reasoning_always_on"],
            supports_preserve_thinking = _sf_flags["supports_preserve_thinking"],
            preserve_thinking_default = _sf_flags.get("preserve_thinking_default", False),
            supports_tools = _sf_flags["supports_tools"],
            context_length = _positive_int_or_none(_model_info.get("context_length")),
            chat_template = _chat_template,
        )

    except HTTPException:
        raise
    except ValueError as e:
        redacted_msg = redact_native_paths(str(e))
        if _is_unsupported_nvfp4_inference_error(redacted_msg):
            logger.warning(
                "NVFP4 inference is not supported yet while loading '%s'",
                model_log_label,
            )
            raise HTTPException(
                status_code = 500,
                detail = _NVFP4_INFERENCE_UNSUPPORTED_MESSAGE,
            )
        if native_grant_backed:
            logger.warning(
                "Rejected inference selection for native model %s: %s",
                model_log_label,
                redacted_msg,
            )
            raise HTTPException(status_code = 400, detail = redacted_msg)
        logger.warning("Rejected inference GPU selection: %s", e)
        # User-facing validation (e.g. "Invalid gpu_ids [99]"): redact paths, keep detail.
        raise HTTPException(status_code = 400, detail = redacted_msg)
    except LlamaServerNotFoundError as e:
        # Missing GGUF runtime: 400 with the install message, not a generic 500.
        logger.warning("GGUF runtime missing while loading '%s': %s", model_log_label, e)
        raise HTTPException(status_code = 400, detail = str(e))
    except Exception as e:
        from utils.transformers_version import SidecarSwapInProgress

        if isinstance(e, SidecarSwapInProgress):
            # Lost the spawn-time race to a sidecar install/repair: retryable 409.
            raise HTTPException(status_code = 409, detail = str(e))
        # Friendlier message for models Unsloth cannot load.
        redacted_msg = redact_native_paths(str(e))
        if _is_unsupported_nvfp4_inference_error(redacted_msg):
            logger.warning(
                "NVFP4 inference is not supported yet while loading '%s'",
                model_log_label,
            )
            raise HTTPException(
                status_code = 500,
                detail = _NVFP4_INFERENCE_UNSUPPORTED_MESSAGE,
            )
        if native_grant_backed:
            logger.error(
                "Error loading native model %s: %s",
                model_log_label,
                redacted_msg,
            )
            msg = _maybe_unsupported_message(redacted_msg)
            raise HTTPException(
                status_code = 500,
                detail = f"Failed to load native model {model_log_label}: {msg}",
            )
        logger.error(f"Error loading model: {e}", exc_info = True)
        msg = _maybe_unsupported_message(redacted_msg)
        raise HTTPException(status_code = 500, detail = f"Failed to load model: {msg}")
    finally:
        gguf_load_stack.close()
        # Catch-all: an error or cancelled load would otherwise leave the row "loading".
        api_monitor.fail_open(_load_event, "Load did not complete")


def _any_remote(targets) -> bool:
    """True unless every target is a local path. Falsy entries are skipped (no base to
    read); anything unresolvable counts as remote, since guarding a local read costs one
    memoised verdict while missing a remote one costs the retry backoff."""
    from utils.paths import is_local_path

    for target in (targets,) if isinstance(targets, str) else targets or ():
        if not target:
            continue  # no base is not an unknown base: nothing to read, nothing to guard
        try:
            if not (isinstance(target, str) and is_local_path(target)):
                return True
        except Exception:
            return True  # unresolvable: guard, since missing a remote read costs the backoff
    return False


def _offline_guarded(targets, fn, /, *args, **kwargs):
    """Run one blocking preflight inside the same forced-offline window as config
    resolution. The config is not the only remote read here: the upgrade, trust-remote-code
    and sizing preflights each fetch raw metadata, and would otherwise burn the retry
    backoff the guard exists to skip. The verdict is memoised, so this costs no extra
    probe. Call from a worker thread: the guard is process-global and blocks on a cold
    verdict.

    ``targets`` is what this call actually READS, not the outer request, because a local
    adapter can resolve to a remote base and the base is what gets fetched. Positional-only,
    so a wrapped call's own model_identifier kwarg cannot collide."""
    from contextlib import nullcontext

    # The module-level symbol, not a fresh import: route tests patch
    # routes.inference._hf_offline_if_unreachable to stay deterministic, and a local
    # re-import would bypass the patch and run a real probe.
    ctx = _hf_offline_if_unreachable() if _any_remote(targets) else nullcontext()
    with ctx:
        return fn(*args, **kwargs)


def _requires_trust_remote_code_for_model(
    model_identifier: str, hf_token: Optional[str] = None
) -> bool:
    """Whether loading this model would execute custom repo code, so the consent
    dialog must run first. True if the Unsloth YAML default enables
    ``trust_remote_code`` OR a raw config at any model load root declares an
    ``auto_map``. Reads raw JSON only; never imports model code."""
    from utils.inference import load_inference_config

    try:
        if bool(load_inference_config(model_identifier).get("trust_remote_code", False)):
            return True
    except Exception:
        pass
    try:
        from utils.security.consent import _config_has_auto_map
        from utils.security import load_scan_target, security_load_subdirs

        load_subdirs = security_load_subdirs(model_identifier, hf_token)
        target, load_subdirs = load_scan_target(model_identifier, load_subdirs)
        return (
            _config_has_auto_map(
                target,
                hf_token,
                load_subdirs = load_subdirs,
            )
            is True
        )
    except Exception:
        return False


def _resolve_loaded_trust_remote_code(
    model_id,
    model_info,
    inference_config,
    hf_token = None,
    trust_remote_code_used = False,
) -> bool:
    """TRC requirement to report for an ALREADY-LOADED model, consistent with
    ``validate_model``.

    ``validate_model`` reports ``requires_trust_remote_code`` from
    ``_requires_trust_remote_code_for_model`` (YAML default OR raw ``auto_map``), but
    the load / already-loaded / status responses historically reported only the YAML
    default. That dropped raw-``auto_map`` models: after approving and loading one, the
    response said ``false``, so the frontend stored ``false`` and a later retry/rollback
    sent ``trust_remote_code=false`` and failed.

    Resolution order: a value stored on the model at load time (so a status refresh does
    not re-derive it) -> the trust_remote_code the load actually used -> the YAML default
    -> the raw ``auto_map`` check (reads the loaded model's cached config; no network)."""
    stored = (model_info or {}).get("requires_trust_remote_code")
    if stored is not None:
        return bool(stored)
    if trust_remote_code_used or bool((inference_config or {}).get("trust_remote_code", False)):
        return True
    try:
        return bool(_requires_trust_remote_code_for_model(model_id, hf_token))
    except Exception:
        return False


def _requires_security_review_for_model(
    model_identifier: str, hf_token: Optional[str] = None
) -> bool:
    """Whether Hugging Face's security scan flagged unsafe files for this repo, so
    the consent dialog must open as a hard block before loading. Metadata-only;
    never downloads the flagged files. Fails open (False) on any error."""
    try:
        from utils.security import (
            evaluate_file_security,
            load_scan_target,
            security_load_subdirs,
        )

        # Normalize the `<name>/LLM` alias here as well as inside evaluate_file_security,
        # so the subdirs passed alongside the target are resolved against the same repo.
        load_subdirs = security_load_subdirs(model_identifier, hf_token)
        target, load_subdirs = load_scan_target(model_identifier, load_subdirs)
        return evaluate_file_security(
            target,
            hf_token,
            load_subdirs = load_subdirs,
        ).blocked
    except Exception:
        return False


async def _validate_model_impl(
    request: ValidateModelRequest,
    fastapi_request: Request = None,
    current_subject: str = Depends(get_current_subject),
):
    """
    Lightweight validation endpoint for model identifiers.

    Checks that ModelConfig.from_identifier() can resolve model_path, but does
    NOT load model weights into GPU memory.
    """
    from core.inference.llama_cpp import (
        LlamaServerNotFoundError,
        _hf_offline_if_unreachable_for,
    )

    native_grant_backed = False
    model_log_label = request.model_path
    try:
        model_identifier, model_log_label, native_grant_backed = (
            _resolve_model_identifier_for_request(request, operation = "validate-model")
        )

        # The frontend validates before it loads, so this needs the same guard as
        # /load; otherwise the stall just moves here and /load is never reached.
        # Off-loop twice over: the guard is a network round trip, and the first
        # from_identifier builds the detection registry (transformers, or the warm's lock).
        def _resolve_config():
            with _hf_offline_if_unreachable_for(model_identifier):
                return ModelConfig.from_identifier(
                    model_id = model_identifier,
                    hf_token = request.hf_token,
                    gguf_variant = request.gguf_variant,
                    # A native grant covers one directory, and this is the first
                    # pass that touches a drafter candidate, so the boundary has
                    # to travel with it rather than being applied afterwards.
                    drafter_accept = _native_drafter_accept if native_grant_backed else None,
                )

        config = await asyncio.to_thread(_resolve_config)

        if not config:
            raise HTTPException(
                status_code = 400,
                detail = f"Invalid model identifier: {model_log_label}",
            )

        # The caller's own list when it sent one, or the resolver hands back this
        # fourth argument unchanged and a --ctx-size the load is about to use would
        # be missing from the estimate that approves it.
        effective_extra_args = _resolve_inherited_extra_args(
            request, config, model_identifier, getattr(request, "llama_extra_args", None)
        )

        # The caller's list is judged BEFORE anything rewrites it, exactly as /load
        # judges the explicit list it was sent. Translating first let a list /load
        # refuses pass here: "--gpu-layers=20" was parsed into the first-class field
        # and stripped, so validate_extra_args never saw the attached spelling
        # llama.cpp has no such flag for, and the switch was approved for a load that
        # answers 400. A malformed value ("-ngl bad") raised out of the parser here
        # too, which is a 500 where the same list is a 400 on the load.
        if config.is_gguf and effective_extra_args:
            from core.inference.llama_server_args import validate_extra_args
            try:
                validate_extra_args(effective_extra_args)
            except ValueError as exc:
                raise HTTPException(status_code = 400, detail = str(exc)) from exc

        # Manual mode owns the offload flags, and /load translates an explicit -ngl
        # into the first-class field before it strips them. Doing that there and not
        # here made the two disagree about what will actually run: a diffusion GGUF
        # asked with gpu_layers 0 and "-ngl 20" was approved as a zero-layer load that
        # cannot compete with training for VRAM, and then launched twenty layers on
        # the GPU; the opposite pairing refused a load that only ever runs on the CPU.
        # Same translation, same strip, so the guard below judges the same command.
        # After the validation above, so nothing here parses a token the load refuses.
        if getattr(request, "gpu_memory_mode", None) == "manual" and effective_extra_args:
            from core.inference.llama_server_args import (
                parse_gpu_layers_override,
                strip_shadowing_flags,
            )

            _validate_ngl_override = parse_gpu_layers_override(effective_extra_args)
            if _validate_ngl_override is not None:
                request = request.model_copy(update = {"gpu_layers": _validate_ngl_override})
            effective_extra_args = strip_shadowing_flags(
                effective_extra_args,
                strip_context = False,
                strip_cache = False,
                strip_spec = False,
                strip_template = False,
                strip_split_mode = False,
                strip_tensor_split = _should_strip_tensor_split(request),
                strip_offload = True,
            )

        # Apply the same placement policy as /load before the frontend unloads
        # the current model.
        placement = await _prepare_load_placement(config, request, effective_extra_args)
        if placement.diffusion_kind is True and effective_extra_args:
            # Same drop as /load, and for the same reason: the diffusion runner appends
            # none of these, so an estimate that reads a --ctx-size out of them approves
            # a load against a command that will never carry it. The classification here
            # is the authoritative one, so this can only be decided after placement.
            logger.info(
                "Ignoring %d extra llama-server arg(s) for %s: the diffusion runner takes none.",
                len(effective_extra_args),
                model_log_label,
            )
            effective_extra_args = []
        if config.is_gguf and effective_extra_args:
            # The same two checks /load runs, here because the picker treats a
            # successful validate as permission to unload the model it is replacing.
            # Without them a remembered list that this build no longer accepts (a
            # flag denied since it was saved, a batch below the slot floor) passed
            # the preflight, the running model went away, and /load then answered
            # 400: a failed switch and a rollback instead of a refusal with nothing
            # disturbed.
            # Only the floor here: the list itself was judged above, before the manual
            # translation could rewrite it, and re-validating the STRIPPED list would
            # answer for a command neither route sends.
            from core.inference.llama_server_args import check_batch_floor
            _requested_slots = _resolve_parallel_slots(request, fastapi_request)
            try:
                check_batch_floor(
                    effective_extra_args,
                    _effective_parallel_slots(
                        _requested_slots,
                        diffusion_kind = placement.diffusion_kind,
                    ),
                )
            except ValueError as exc:
                # The same embedding clamp /load allows for, or this preflight
                # refuses a command the load it gates would have launched.
                if not await _batch_floor_survives_embedding_clamp(
                    config,
                    effective_extra_args,
                    _requested_slots,
                    request,
                    diffusion_kind = placement.diffusion_kind,
                ):
                    raise HTTPException(status_code = 400, detail = str(exc)) from exc
        effective_load_in_4bit = _effective_load_in_4bit(config, request.load_in_4bit)

        # Both checks cover the [adapter, base] set (matching the scan route and workers):
        # either repo can ship auto_map code or a poisoned pickle.
        security_targets = [config.identifier]
        try:
            from utils.models.model_config import get_base_model_from_lora_identifier

            # Resolve a LOCAL or REMOTE adapter's base so its code/weights are reviewed too.
            _base = await asyncio.to_thread(
                _offline_guarded,
                model_identifier,
                get_base_model_from_lora_identifier,
                model_identifier,
                request.hf_token,
            )
            if _base:
                security_targets.append(_base)
        except Exception:
            pass
        security_targets = list(dict.fromkeys(security_targets))

        is_gguf = getattr(config, "is_gguf", False)
        # Does a newer transformers ship this model_type? Static overlay first, cached
        # PyPI/main snapshot only for unknown types. Never fails validation; run before
        # the training guard so an installable upgrade sizes as 16-bit.
        transformers_upgrade: Optional[TransformersUpgradeInfo] = None
        if not is_gguf:
            from utils.transformers_latest import check_upgrade_for_model

            # Cover [adapter, base]: the worker activates transformers for the base model.
            for _target in security_targets:
                _upgrade = await asyncio.to_thread(
                    _offline_guarded,
                    _target,
                    check_upgrade_for_model,
                    _target,
                    request.hf_token,
                )
                if _upgrade is not None:
                    transformers_upgrade = TransformersUpgradeInfo(**_upgrade)
                    break

        # Whether the model can load on the CURRENT transformers through its own remote
        # code (auto_map, or the YAML trust default). Computed before the 16-bit flip
        # because a model with this fallback still loads 4-bit without the offered install,
        # exactly as /load does.
        requires_trust_remote_code = False
        if not is_gguf:
            # Reads raw config/tokenizer JSON, so guarded and off-loop like the rest.
            requires_trust_remote_code = await asyncio.to_thread(
                _offline_guarded,
                security_targets,
                lambda: any(
                    _requires_trust_remote_code_for_model(_t, request.hf_token)
                    for _t in security_targets
                ),
            )

        # Mirror /load's latest-sidecar 16-bit flip so the guard sizes it the same way. An
        # ALREADY-ACTIVE latest sidecar always forces 16-bit (the worker will). A merely
        # OFFERED (not yet installed) upgrade forces 16-bit only when the model has NO
        # custom-code fallback: with auto_map it still loads 4-bit on the current
        # transformers (as /load does without a successful install), and the install route
        # refuses while training is active, so sizing 16-bit here would 409 the only viable
        # 4-bit path. /load re-sizes 16-bit after a successful install and re-guards there.
        if effective_load_in_4bit and not is_gguf:
            from utils.transformers_version import latest_tier_active_for
            _install_only_upgrade = (
                transformers_upgrade is not None
                and transformers_upgrade.supported_in_pypi
                and transformers_upgrade.pypi_version
                and not requires_trust_remote_code
            )
            if _install_only_upgrade or await asyncio.to_thread(
                _offline_guarded,
                (model_identifier, config.identifier, getattr(config, "base_model", None)),
                latest_tier_active_for,
                config.identifier,
                request.hf_token,
            ):
                effective_load_in_4bit = False
        # A metadata-only probe reads the GGUF header and allocates no VRAM, so the
        # training guard must not refuse it. Real loads omit include_context_length /
        # include_chat_template, and /load applies the guard again.
        if not (request.include_context_length or request.include_chat_template):
            # Off-loop and guarded: the guard does sync nvidia-smi / HF work.
            await asyncio.to_thread(
                _offline_guarded,
                (model_identifier, config.identifier, getattr(config, "base_model", None)),
                _guard_chat_load_against_training,
                config,
                request,
                load_in_4bit = effective_load_in_4bit,
                placement = placement,
                llama_extra_args = effective_extra_args,
                n_parallel = _resolve_parallel_slots(request, fastapi_request),
            )

        # A selected GGUF loads via llama.cpp: auto_map Python and root pickle weights in a
        # mixed repo are inert for this load, so gating on them is a false positive. Only
        # run the security preflight for non-GGUF loads (requires_trust_remote_code was
        # already resolved above for the sizing flip).
        requires_security_review = False
        if not is_gguf:
            # _fetch_security_status does hf_model_info with 10s and 20s timeouts, so this
            # needs the same window and worker thread as the preflights above.
            requires_security_review = await asyncio.to_thread(
                _offline_guarded,
                security_targets,
                lambda: any(
                    _requires_security_review_for_model(_t, request.hf_token)
                    for _t in security_targets
                ),
            )
        # Native context length, read from the local GGUF header when present.
        # Lets the staged ("Load on selection" off) flow populate the context
        # slider before the GPU load; None until the file is downloaded.
        # Staged header dims (one read): native context, total layer count, and
        # MoE expert-layer count -- let the staged flow size the context, GPU-
        # layers and manual --n-cpu-moe sliders before the load.
        context_length: Optional[int] = None
        layer_count: Optional[int] = None
        moe_layer_count: Optional[int] = None
        chat_template: Optional[str] = None
        # Both header probes read the same local GGUF, so resolve it once.
        if (request.include_context_length or request.include_chat_template) and is_gguf:
            from hub.utils.gguf import resolve_local_gguf_path
            from picker.schemas import MAX_CHAT_TEMPLATE_BYTES
            from utils.models.gguf_metadata import (
                read_gguf_chat_template,
                read_gguf_staged_dims,
            )

            # Best-effort: a header-read failure must never fail validation of an
            # otherwise-valid model (the outer except turns it into a 400).
            try:
                if native_grant_backed:
                    # model_identifier is the resolved canonical .gguf path.
                    local_gguf = model_identifier
                else:
                    # Local folder / exported GGUFs already have their file
                    # resolved on the config (gguf_file is None for HF repos, so
                    # those fall back to the HF-cache lookup).
                    local_gguf = config.gguf_file or resolve_local_gguf_path(
                        model_identifier, request.gguf_variant
                    )
                if local_gguf:
                    if request.include_context_length:
                        # Header walk reads tokenizer arrays (tens of ms); keep it
                        # off the event loop.
                        dims = await asyncio.to_thread(read_gguf_staged_dims, local_gguf)
                        if dims:
                            context_length = dims["context_length"]
                            layer_count = dims["layer_count"]
                            moe_layer_count = dims["moe_layer_count"]
                    if request.include_chat_template:
                        # Read only the leased GGUF's own embedded template (the copy
                        # llama.cpp loads), never a sibling sidecar: the native grant
                        # authorizes just this path, so neighbours would be scope escalation.
                        raw_template = await asyncio.to_thread(read_gguf_chat_template, local_gguf)
                        if (
                            raw_template is not None
                            and len(raw_template.encode("utf-8")) <= MAX_CHAT_TEMPLATE_BYTES
                        ):
                            chat_template = raw_template
            except Exception as e:
                logger.debug("Header probe failed for %s: %s", model_log_label, e)

        return ValidateModelResponse(
            valid = True,
            message = "Model identifier is valid.",
            identifier = model_log_label if native_grant_backed else config.identifier,
            display_name = model_log_label
            if native_grant_backed
            else getattr(config, "display_name", config.identifier),
            is_gguf = is_gguf,
            is_diffusion = is_gguf and placement.diffusion_kind is True,
            # An unavailable header is inconclusive, not proof of an ordinary GGUF.
            diffusion_unknown = is_gguf and placement.diffusion_kind is None,
            is_lora = getattr(config, "is_lora", False),
            is_vision = getattr(config, "is_vision", False),
            requires_trust_remote_code = requires_trust_remote_code,
            requires_security_review = requires_security_review,
            context_length = context_length,
            layer_count = layer_count,
            moe_layer_count = moe_layer_count,
            chat_template = chat_template,
            requires_transformers_upgrade = transformers_upgrade is not None,
            transformers_upgrade = transformers_upgrade,
        )

    except HTTPException:
        raise
    except LlamaServerNotFoundError as e:
        # Missing GGUF runtime: 400 with the install message, not a generic "Invalid model".
        logger.warning("GGUF runtime missing while validating '%s': %s", request.model_path, e)
        raise HTTPException(status_code = 400, detail = str(e))
    except Exception as e:
        redacted_msg = redact_native_paths(str(e))
        if is_hf_authentication_error(e):
            raise HTTPException(
                status_code = 400,
                detail = (
                    "Hugging Face authentication failed. Check or clear the token "
                    "in Settings, and confirm access to this gated repository."
                ),
            )
        if _is_unsupported_nvfp4_inference_error(redacted_msg):
            logger.warning(
                "NVFP4 inference is not supported yet while validating '%s'",
                model_log_label,
            )
            raise HTTPException(
                status_code = 400,
                detail = _NVFP4_INFERENCE_UNSUPPORTED_MESSAGE,
            )
        if native_grant_backed:
            logger.error(
                "Error validating native model %s: %s",
                model_log_label,
                redacted_msg,
            )
            msg = _maybe_unsupported_message(redacted_msg)
            raise HTTPException(
                status_code = 400,
                detail = f"Invalid native model {model_log_label}: {msg}",
            )
        logger.error(
            f"Error validating model identifier '{request.model_path}': {e}",
            exc_info = True,
        )
        # RuntimeError / ValueError carry intentional, actionable messages here
        # (e.g. "llama-server binary not found - cannot load GGUF models. Run
        # setup.sh ..."), so surface them instead of a blank "Invalid model".
        # Path-redact for safety and keep any other exception type generic so an
        # unexpected internal error never leaks its details to the client.
        if isinstance(e, (RuntimeError, ValueError)):
            msg = redacted_msg.strip()
            if msg:
                msg = _maybe_unsupported_message(msg)
                raise HTTPException(
                    status_code = 400,
                    detail = msg,
                )
        raise HTTPException(
            status_code = 400,
            detail = "Invalid model",
        )

# =====================================================================
# Transformers Upgrade Routes (Modularized in routes.inference_pkg)
# =====================================================================
from routes.inference_pkg.router_transformers_upgrade import (
    studio_router as _transformers_upgrade_router,
    _upgrade_check_config_target,
    _install_breaks_exact_resume,
    check_transformers_upgrade_route,
    install_latest_transformers_route,
)

for r in _transformers_upgrade_router.routes:
    studio_router.routes.append(r)

async def _unload_model_direct(request: UnloadRequest, current_subject: str = Depends(get_current_subject)):
    return await _tunnel_safe_json(
        _unload_model_impl(request, current_subject), label = "Model unload"
    )


async def _unload_model_impl(request: UnloadRequest, current_subject: str):
    """
    Unload a model from memory.
    Routes to the correct backend (llama-server for GGUF, Unsloth otherwise).
    """
    # A deliberate unload means "stay unloaded": drop any idle reload stash so the
    # next /v1 request can't resurrect this model. The idle loop unloads via the
    # backend directly (not this route), so clearing here never fights keep-warm.
    from core.inference.llama_keepwarm import inference_lifecycle_gate, note_model_unloaded
    try:
        # Hidden Audio cleanup is cancellation, not a manual eject. Bind it to the
        # exact client load attempt so a delayed request can never stop a newer
        # same-model load or unload a model that has already become resident.
        if request.cancel_load_request_id is not None:
            attempt, is_running = _cancel_scoped_load_attempt(request, current_subject)
            if attempt is None or not is_running:
                return UnloadResponse(status = "unloaded", model = request.model_path)
            try:
                backend = await asyncio.to_thread(get_inference_backend)
                loading = getattr(backend, "get_loading_model", lambda: None)()
                if (
                    loading is not None
                    and hasattr(backend, "cancel_load")
                    and _names_the_loading_model(loading, attempt.model_path)
                    and await asyncio.to_thread(backend.cancel_load, loading)
                ):
                    note_model_unloaded()
                    logger.info("Cancelled scoped in-flight load: %s", request.model_path)
                    return UnloadResponse(status = "unloaded", model = request.model_path)

                llama_backend = get_llama_cpp_backend()
                if (
                    llama_backend.is_active
                    and not llama_backend.is_loaded
                    and (
                        llama_backend.model_identifier == attempt.model_path
                        or is_registered_native_path_label(
                            llama_backend.model_identifier, attempt.model_path
                        )
                        or _names_the_resident_model(
                            llama_backend.model_identifier, attempt.model_path
                        )
                    )
                ):
                    await asyncio.to_thread(llama_backend.unload_model)
                    note_model_unloaded()
                    logger.info("Cancelled scoped in-flight GGUF load: %s", request.model_path)
                return UnloadResponse(status = "unloaded", model = request.model_path)
            finally:
                attempt.cancel_complete.set()

        # "Stop loading" (frontend cancelLoading -> /unload) must abort a still-loading
        # model promptly, and /load holds the lifecycle gate for the whole load. cancel_load only
        # tears the loading subprocess down, so it is safe off-gate -- and ahead of the
        # active-generation refusal below, which it can never need (see there).
        backend = await asyncio.to_thread(get_inference_backend)
        loading = getattr(backend, "get_loading_model", lambda: None)()
        if (
            loading is not None
            and hasattr(backend, "cancel_load")
            and _names_the_loading_model(loading, request.model_path)
        ):
            # Cancel under the name the load runs as, which a pinned row states as a path.
            if await asyncio.to_thread(backend.cancel_load, loading):
                note_model_unloaded()
                logger.info(f"Cancelled in-flight load: {request.model_path}")
                return UnloadResponse(status = "unloaded", model = request.model_path)

        # Same "stop loading" fast path for a still-loading GGUF (spawned, health check not passed).
        # unload_model() sets the cancel_event load_model polls and kills the child without a
        # worker command, so it is safe off-gate like cancel_load; the gated branch below handles
        # the already-loaded case. Gated on the loading model so an unload for a different model
        # cannot cancel this load.
        llama_backend = get_llama_cpp_backend()
        if (
            llama_backend.is_active
            and not llama_backend.is_loaded
            and (
                llama_backend.model_identifier == request.model_path
                or is_registered_native_path_label(
                    llama_backend.model_identifier, request.model_path
                )
                or _names_the_resident_model(llama_backend.model_identifier, request.model_path)
            )
        ):
            await asyncio.to_thread(llama_backend.unload_model)
            note_model_unloaded()
            logger.info(f"Cancelled in-flight GGUF load: {request.model_path}")
            return UnloadResponse(status = "unloaded", model = request.model_path)

        # Same gate as /load: refusal only, so a non-forced unload fails fast before queueing on the
        # lifecycle gate. Skipped when no teardown branch can fire, or a request naming a model
        # another tab already replaced would 409 on chats it cannot interrupt.
        #
        # BEHIND the two "stop loading" fast paths above: both cancel a load that has not replaced
        # anything yet, so neither can interrupt a chat, and refusing them counted a teardown that
        # cannot happen (unretryably -- the frontend's Cancel sends this unload unforced and drops
        # the error). Any other name still falls through here.
        if await asyncio.to_thread(_unload_may_evict, request.model_path):
            _raise_or_cancel_active_generations(
                force = request.force_cancel_active,
                action = "Unloading the model",
                cancel = False,
            )

        # Serialize with /load under the same lifecycle gate: the Unsloth unload now runs
        # off the event loop (asyncio.to_thread), so without this a concurrent /load could
        # swap in a fresh subprocess mid-unload and the unload command would land on the
        # new worker. The gate makes load and unload exclusive.
        async with inference_lifecycle_gate():
            # Rechecked under the gate, like /load: a chat can register while this one queues here (the
            # middleware takes and releases the same gate). Still refusal only, and re-read rather
            # than carried down, since a load may have finished meanwhile.
            if await asyncio.to_thread(_unload_may_evict, request.model_path):
                _raise_or_cancel_active_generations(
                    force = request.force_cancel_active,
                    action = "Unloading the model",
                    cancel = False,
                )
            # Check if the GGUF backend has this model loaded or is loading it.
            llama_backend = get_llama_cpp_backend()
            if llama_backend.is_active and (
                llama_backend.model_identifier == request.model_path
                or is_registered_native_path_label(
                    llama_backend.model_identifier, request.model_path
                )
                or _names_the_resident_model(llama_backend.model_identifier, request.model_path)
                or not llama_backend.is_loaded
            ):
                # Read the identity before teardown clears it, so the row reads repo:QUANT.
                _unloaded = _llama_public_model_id(llama_backend, request.model_path)
                _unloaded_variant = getattr(llama_backend, "hf_variant", None)
                # Point of no return: this really does replace the running server, so stop the
                # chats. A manual unload is a deliberate user action, so it cancels mid-stream
                # requests rather than deferring to them the way the automatic idle loop does.
                _raise_or_cancel_active_generations(
                    force = request.force_cancel_active, action = "Unloading the model"
                )
                # Let what we just cancelled unwind first, like /load: tearing the server down under
                # streams told to stop but not yet finished turned a clean end into a dropped
                # connection. Bounded, since a manual unload is deliberate.
                await _drain_and_recancel_before_teardown(
                    force = request.force_cancel_active, action = "Unloading the model"
                )
                # Off-loop like the in-flight branch above: a 160s teardown on the
                # loop would block this route's own padding.
                await asyncio.to_thread(llama_backend.unload_model)
                note_model_unloaded()
                api_monitor.record_lifecycle(
                    event = "unload",
                    model = _lifecycle_model_label(_unloaded, _unloaded_variant),
                    reason = "manual",
                )
                logger.info(f"Unloaded GGUF model: {request.model_path}")
                return UnloadResponse(status = "unloaded", model = request.model_path)

            # Unload from spartan_agent backend off the event loop: unload takes _gen_lock, which
            # a slow SSE stream paused between tokens still holds, so a sync call would block
            # the loop that drives the stream's next token and the lock release.
            backend = await asyncio.to_thread(get_inference_backend)
            if _unload_evicts_standard_backend(backend, request.model_path):
                # Point of no return for the standard path, same rule as above.
                _raise_or_cancel_active_generations(
                    force = request.force_cancel_active, action = "Unloading the model"
                )
                await _drain_and_recancel_before_teardown(
                    force = request.force_cancel_active, action = "Unloading the model"
                )
            await asyncio.to_thread(
                backend.unload_model, _resident_standard_model_name(backend, request.model_path)
            )
            note_model_unloaded()
            api_monitor.record_lifecycle(
                event = "unload",
                model = _lifecycle_model_label(request.model_path),
                reason = "manual",
            )
            logger.info(f"Unloaded model: {request.model_path}")
            return UnloadResponse(status = "unloaded", model = request.model_path)

    except HTTPException:
        # Typed refusals (the gate's 409) must not be rewritten as a 500 below.
        raise
    except Exception as e:
        logger.error(f"Error unloading model: {e}", exc_info = True)
        raise HTTPException(status_code = 500, detail = "Failed to unload model")



# =====================================================================
# Studio Monitor & Cancellation Routes (Modularized in routes.inference_pkg)
# =====================================================================
from routes.inference_pkg.router_monitor_studio import (
    studio_router as _monitor_studio_router,
    init_monitor_helpers,
    cancel_inference,
    confirm_tool_call,
    get_api_monitor,
    clear_api_monitor,
    get_api_monitor_entry,
    get_active_generations,
)

init_monitor_helpers(
    cancel_by_cancel_id_or_stash = _cancel_by_cancel_id_or_stash,
    cancel_by_keys = _cancel_by_keys,
    monitor_active_model = _monitor_active_model,
    monitor_context_length = _monitor_context_length,
    monitor_queue_state = _monitor_queue_state,
    direct_llama_is_busy = _direct_llama_is_busy,
    llama_admission_capacity = _openai_llama_admission_capacity,
    llama_backend_getter = get_llama_cpp_backend,
)

for r in _monitor_studio_router.routes:
    studio_router.routes.append(r)


def _decode_and_resize_image(backend, encoded: str):
    """Decode one request image and run Pillow resampling off the event loop."""
    from PIL import Image
    from io import BytesIO

    image_data = base64.b64decode(encoded)
    return backend.resize_image(Image.open(BytesIO(image_data)))


@router.post("/generate/stream")
async def generate_stream(
    request: GenerateRequest,
    fastapi_request: Request,
    current_subject: str = Depends(get_current_subject),
):
    """
    Generate a chat response with Server-Sent Events (SSE) streaming.

    For vision models, provide image_base64 (base64-encoded image).
    """
    backend = await asyncio.to_thread(get_inference_backend)

    if not backend.active_model_name:
        raise HTTPException(
            status_code = 400, detail = "No model loaded. Call POST /inference/load first."
        )

    # Decode image if provided (vision models)
    image = None
    if request.image_base64:
        try:
            # Check current model supports vision
            model_info = backend.models.get(backend.active_model_name, {})
            if not model_info.get("is_vision"):
                raise HTTPException(
                    status_code = 400,
                    detail = "Image provided but current model is text-only. Load a vision model.",
                )

            image = await asyncio.to_thread(
                _decode_and_resize_image,
                backend,
                request.image_base64,
            )

        except HTTPException:
            raise
        except Exception as e:
            raise log_and_http_error(
                e,
                400,
                "Failed to decode image",
                event = "inference.decode_image_failed",
                log = logger,
            )

    cancel_event = threading.Event()

    async def stream():
        gen = None
        completed = False
        # Cancel the generation when the client disconnects. The generator only
        # awaits asyncio.to_thread(next, gen, ...), so without a concurrent
        # watcher a disconnect during a long prefill/generation would go
        # unnoticed until the next send and the backend would keep generating.
        disconnect_watcher = asyncio.create_task(
            _await_disconnect_then_cancel(fastapi_request, cancel_event)
        )
        # Registered inside the generator, under the finally that unregisters it, so a response whose
        # body never starts leaves nothing behind. Unregistered, this run passes /unload's 409 gate
        # (which runs no idle drain) and a forced swap has no event to signal. GenerateRequest
        # carries no thread_id: counted, not nameable.
        _tracker = _TrackedCancel(cancel_event, model = backend.active_model_name)
        _tracker.__enter__()
        try:
            gen = backend.generate_chat_response(
                messages = request.messages,
                system_prompt = request.system_prompt,
                image = image,
                temperature = request.temperature,
                top_p = request.top_p,
                top_k = request.top_k,
                min_p = request.min_p,
                max_new_tokens = request.max_new_tokens,
                repetition_penalty = request.repetition_penalty,
                presence_penalty = request.presence_penalty,
                cancel_event = cancel_event,
            )
            _DONE = object()
            while True:
                if cancel_event.is_set():
                    # Watcher set cancel_event between chunks. Reset here: closing
                    # the generator does not signal a subprocess backend, so it would
                    # keep decoding. The finally's reset is guarded, so no double-run.
                    backend.reset_generation_state(cancel_event)
                    break
                chunk = await asyncio.to_thread(next, gen, _DONE)
                if chunk is _DONE:
                    completed = True
                    break
                if isinstance(chunk, GenStreamError):
                    yield f"data: {json.dumps({'error': _friendly_gen_stream_error(chunk)})}\n\n"
                    yield "data: [DONE]\n\n"
                    return
                yield f"data: {json.dumps({'content': chunk})}\n\n"
            if completed:
                yield "data: [DONE]\n\n"

        except asyncio.CancelledError:
            cancel_event.set()
            backend.reset_generation_state(cancel_event)
            raise
        except Exception as e:
            cancel_event.set()
            backend.reset_generation_state(cancel_event)
            logger.error(f"Error during generation: {e}", exc_info = True)
            yield f"data: {json.dumps({'error': _friendly_error(e)})}\n\n"
            yield "data: [DONE]\n\n"
        finally:
            # Nested so a teardown failure still unregisters; a phantom entry 409s swaps.
            try:
                await _stop_local_disconnect_cancel_watcher(disconnect_watcher)
                if not completed and not cancel_event.is_set():
                    cancel_event.set()
                    backend.reset_generation_state(cancel_event)
                if gen is not None:
                    try:
                        await asyncio.to_thread(gen.close)
                    except (RuntimeError, ValueError):
                        pass
            finally:
                _tracker.__exit__(None, None, None)

    return _sse_streaming_response(stream())


def _probe_llama_cpp_status(llama_backend) -> tuple[bool, dict]:
    """Read llama.cpp capabilities and release freshness without raising."""
    try:
        binary = type(llama_backend)._find_llama_server_binary()
        capabilities = type(llama_backend).probe_server_capabilities(binary)
        # Treat a discovered but inconclusive binary as MTP-compatible.
        supports_mtp = bool(
            capabilities.get("supports_mtp", False)
            or (
                capabilities.get("found", False)
                and capabilities.get("mtp_probe_inconclusive", False)
            )
        )
    except Exception:
        binary = None
        supports_mtp = False  # no usable binary: MTP genuinely unavailable
    try:
        from utils.llama_cpp_freshness import check_prebuilt_freshness
        freshness = check_prebuilt_freshness(binary)
    except Exception:
        freshness = {}
    return supports_mtp, freshness


def _parallel_slots_are_clamped() -> bool:
    """Whether this build serves one slot whatever is asked for.

    The published default is already effective, but an explicit Slots value is chosen
    in the editor and never passes through here, so the editor cannot apply the clamp
    without being told it exists: Slots 4 with "--batch-size 2" was refused there while
    the backend, which clamps to one, accepts exactly that command. Asked of the same
    helper the load uses, with a count above one, so the two can never drift.
    """
    return _effective_parallel_slots(2) == 1


async def _effective_default_slots(fastapi_request) -> tuple[int, bool]:
    """The default slot count a load would really serve, without blocking the loop.

    _effective_parallel_slots asks the binary whether it supports --kv-unified, and on
    a cold cache that is `llama-server --help` with a ten second timeout. Called inline
    it stalled every other request on the first open of the panel after an update, and
    on the managed-only answer too, which is the one path that exists to avoid waiting
    for a probe. The settings read stays here: it is a row in SQLite, and a single slot
    needs no probe to know it cannot be clamped below one.
    """
    requested = _resolve_parallel_slots(_NoParallelRequest(), fastapi_request)
    if requested <= 1:
        # One slot cannot be clamped below one, but whether this build clamps is still
        # the editor's question: it sizes an EXPLICIT Slots value the user may raise
        # without ever re-reading this route.
        return requested, await asyncio.to_thread(_parallel_slots_are_clamped)
    effective = await asyncio.to_thread(_effective_parallel_slots, requested)
    return effective, effective == 1


async def _get_llama_flags_impl(
    fastapi_request: Request = None,
    managed_only: bool = False,
    current_subject: str = Depends(get_current_subject),
):
    """Flags the installed llama-server accepts, for the extra-arguments editor.

    Cheap to call: ``probe_server_capabilities`` caches on the binary's revision, so
    only the first call after an install or an update runs the 10s ``--help`` probe.
    A failed probe answers ``probe_ok = false`` with no flags rather than erroring, so
    the editor degrades to "cannot verify" instead of blocking every argument.

    ``managed_only`` skips the probe entirely. The denylist is Unsloth's own and needs
    no binary to read, while the caller that needs it most is the panel sanitizing a
    stored list before it becomes an explicit request: making that wait on a cold
    ``--help`` would leave a legacy flag in the request for as long as the probe runs.
    """
    from core.inference.llama_server_args import (
        WINDOWS_COMMAND_LIMIT,
        WINDOWS_COMMAND_RESERVE,
        max_extra_args_bytes,
        sorted_managed_flags,
    )

    _default_slots, _slots_clamped = await _effective_default_slots(fastapi_request)
    # What this host refuses on size, so an editor draws the same line rather than
    # letting a 25 KiB grammar through to a 400.
    limits = {
        "max_bytes": max_extra_args_bytes(),
        "windows_command_budget": (
            WINDOWS_COMMAND_LIMIT - WINDOWS_COMMAND_RESERVE if sys.platform == "win32" else 0
        ),
        # The slot count a load gets when it names none, read the same way the loader
        # reads it. An editor cannot see this number, and llama-server aborts on a
        # batch below the slots it serves, so without it a pass-through -b 2 looks
        # fine here and takes down a launch that runs four slots.
        # The effective count, after the clamps the launch applies: a build without
        # --kv-unified serves one slot however many are configured, and an editor
        # sizing its batch floor from the raw default would refuse a batch that runs.
        "default_parallel_slots": _default_slots,
        "parallel_slots_clamped": _slots_clamped,
    }

    if managed_only:
        return LlamaFlagCatalogResponse(
            flags = {},
            managed = sorted_managed_flags(),
            # No probe was attempted, so nothing here can say a flag is a typo.
            probe_ok = False,
            **limits,
        )
    try:
        backend = get_llama_cpp_backend()
        # Off the event loop: on a cold cache this runs `llama-server --help` with a
        # 10s timeout, and the startup probes were moved to a thread for exactly that
        # reason (test_startup_llama_probe_non_blocking). Awaiting it inline would
        # stall every other request on the first open of the panel after an update.
        capabilities = await asyncio.to_thread(type(backend).probe_server_capabilities)
        flags = capabilities.get("flags") or {}
        switch_flags = list(capabilities.get("switch_flags") or ())
        # Three ways to be unverifiable, and the editor treats them alike: no binary
        # (found=False), a --help that did not parse (empty catalogue), and a --help
        # that exited nonzero after printing part of itself. The last one is why the
        # probe's own result is read rather than inferred from a non-empty map: a
        # partial catalogue would otherwise be published as the whole truth, and
        # every flag past the failure point called a typo.
        probe_ok = (
            bool(capabilities.get("found"))
            and bool(flags)
            and bool(capabilities.get("help_probe_ok", True))
        )
    except Exception as exc:  # noqa: BLE001 -- an unverifiable flag is not a failed request
        logger.debug(f"llama-server flag catalogue unavailable: {exc}")
        flags = {}
        switch_flags = []
        probe_ok = False
    return LlamaFlagCatalogResponse(
        flags = {str(k): str(v) for k, v in flags.items()},
        managed = sorted_managed_flags(),
        switch_flags = [str(flag) for flag in switch_flags],
        probe_ok = probe_ok,
        **limits,
    )


async def _get_status_impl(current_subject: str = Depends(get_current_subject)):
    """
    Get current inference backend status.
    Reports whichever backend (Unsloth or llama-server) is active.
    """
    try:
        llama_backend = get_llama_cpp_backend()

        # The cold subprocess and GitHub probes must not block the event loop or
        # consume the default executor used by local token streaming.
        _supports_mtp, _freshness = await asyncio.get_running_loop().run_in_executor(
            _STATUS_PROBE_EXECUTOR, _probe_llama_cpp_status, llama_backend
        )
        _stale = bool(_freshness.get("stale"))
        _installed_tag = _freshness.get("installed_tag")
        _latest_tag = _freshness.get("latest_tag")

        # If a GGUF model is loaded via llama-server, report that
        if llama_backend.is_loaded:
            _model_id = llama_backend.model_identifier
            # is_local_model below needs the flag; the helper reports identities, not provenance.
            _native_grant_backed = getattr(llama_backend, "_native_grant_backed", False)
            # Shared with /chat/count_tokens, so a client can tell whose tokenizer counted.
            _display_model_id, _reported_model_identifier = _llama_status_model_ids(llama_backend)
            _inference_cfg = load_inference_config(_model_id) if _model_id else None
            # Don't surface Unsloth's auto-applied bundled family template (e.g. the
            # gemma-4 override) as a user-authored override: the frontend adopts
            # status.chat_template_override as editable state and would otherwise
            # re-send it as an explicit override for a later, unrelated model. Only
            # expose a genuine user override.
            _reported_chat_template_override = llama_backend.chat_template_override
            _auto_chat_template_override = resolve_effective_chat_template_override(
                model_identifier = _model_id,
                user_override = None,
            )
            if (
                _auto_chat_template_override is not None
                and _reported_chat_template_override == _auto_chat_template_override
            ):
                _reported_chat_template_override = None
            # chat_template_override is one of the runtime fields, so it arrives in the
            # dict below as the raw backend value. Overwrite it rather than passing it
            # as a second keyword: two values for one keyword is a TypeError, whatever
            # the values are.
            _runtime_fields = _llama_runtime_fields(llama_backend)
            _runtime_fields["chat_template_override"] = _reported_chat_template_override
            return InferenceStatusResponse(
                active_model = _display_model_id,
                model_identifier = _reported_model_identifier,
                is_gguf = True,
                is_local_model = _loaded_is_local_model(
                    llama_backend, _native_grant_backed, _model_id
                ),
                gguf_variant = llama_backend.hf_variant,
                loading = [],
                # Plus anything the Unsloth registry still holds: the GGUF load
                # only unloaded the ACTIVE one, so a model cached behind it is
                # still in VRAM and was invisible to every client reading this.
                loaded = ([_display_model_id] if _display_model_id else [])
                + [name for name in _standard_models_still_held() if name != _display_model_id],
                inference = _inference_cfg,
                **_runtime_fields,
                requested_context_length = llama_backend.requested_n_ctx,
                llama_cpp_supports_mtp = _supports_mtp,
                spec_fallback_reason = llama_backend.spec_fallback_reason,
                spec_fallback_binary_changed = _spec_fallback_binary_changed(llama_backend),
                spec_probe_retry_pending = _spec_probe_retry_pending(llama_backend),
                spec_dflash_retry_pending = _spec_dflash_retry_pending(llama_backend),
                spec_dspark_sidecar_absent = _spec_dspark_sidecar_absent(llama_backend),
                gpu_placement_paravirtual = _gpu_placement_paravirtual(),
                audio_probe_pending = _audio_probe_pending(llama_backend),
                diffusion_split_supported = _diffusion_split_supported(llama_backend),
                tensor_parallel_dropped_by_arch_gate = _arch_gate_dropped_tensor_parallel(
                    llama_backend
                ),
                spec_drafter_kind = llama_backend.spec_drafter_kind,
                llama_cpp_prebuilt_stale = _stale,
                llama_cpp_installed_tag = _installed_tag,
                llama_cpp_latest_tag = _latest_tag,
            )

        # Otherwise report Unsloth backend status. Peek rather than build: no singleton means
        # nothing is loaded, and the chat UI polls this from first paint.
        backend = _peek_inference_backend()
        if backend is None:
            return InferenceStatusResponse(
                llama_cpp_supports_mtp = _supports_mtp,
                llama_cpp_prebuilt_stale = _stale,
                llama_cpp_installed_tag = _installed_tag,
                llama_cpp_latest_tag = _latest_tag,
            )

        is_vision = False
        is_audio = False
        audio_type = None
        has_audio_input = False
        model_info = {}
        if backend.active_model_name:
            model_info = backend.models.get(backend.active_model_name, {})
            is_vision = model_info.get("is_vision", False)
            is_audio = model_info.get("is_audio", False)
            audio_type = model_info.get("audio_type")
            has_audio_input = model_info.get("has_audio_input", False)
        chat_template_info = model_info.get("chat_template_info", {})
        chat_template = (
            chat_template_info.get("template") if isinstance(chat_template_info, dict) else None
        )

        # Non-GGUF: classify from the loaded template.
        _sf_flags = _detect_safetensors_features(backend, chat_template)
        inference_config = (
            load_inference_config(backend.active_model_name) if backend.active_model_name else None
        )

        return InferenceStatusResponse(
            active_model = backend.active_model_name,
            model_identifier = backend.active_model_name,
            is_vision = is_vision,
            is_gguf = False,
            is_local_model = bool(
                backend.active_model_name and is_local_path(backend.active_model_name)
            ),
            is_audio = is_audio,
            audio_type = audio_type,
            has_audio_input = has_audio_input,
            is_mlx = bool(model_info.get("is_mlx", False)),
            mlx_kv_bits = model_info.get("mlx_kv_bits"),
            mlx_kv_bits_requested = model_info.get("mlx_kv_bits_requested"),
            mlx_kv_quant_eligibility = model_info.get("mlx_kv_quant_eligibility"),
            mlx_kv_quant_reason = model_info.get("mlx_kv_quant_reason"),
            mlx_kv_quant_note = model_info.get("mlx_kv_quant_note"),
            chat_template_override = model_info.get("chat_template_override_requested"),
            chat_template_override_reason = model_info.get("chat_template_override_reason"),
            loading = list(getattr(backend, "loading_models", set())),
            loaded = list(backend.models.keys()),
            inference = inference_config,
            requires_trust_remote_code = _resolve_loaded_trust_remote_code(
                backend.active_model_name, model_info, inference_config
            ),
            supports_reasoning = _sf_flags["supports_reasoning"],
            reasoning_style = _sf_flags["reasoning_style"],
            reasoning_effort_levels = _sf_flags.get("reasoning_effort_levels", []),
            reasoning_always_on = _sf_flags["reasoning_always_on"],
            supports_preserve_thinking = _sf_flags["supports_preserve_thinking"],
            preserve_thinking_default = _sf_flags.get("preserve_thinking_default", False),
            supports_tools = _sf_flags["supports_tools"],
            context_length = _positive_int_or_none(model_info.get("context_length")),
            chat_template = chat_template,
            llama_cpp_supports_mtp = _supports_mtp,
            llama_cpp_prebuilt_stale = _stale,
            llama_cpp_installed_tag = _installed_tag,
            llama_cpp_latest_tag = _latest_tag,
        )

    except Exception as e:
        logger.error(f"Error getting status: {e}", exc_info = True)
        raise HTTPException(status_code = 500, detail = "Failed to get status")


_load_progress_lock = threading.Lock()
_last_load_progress_step = -1


def _log_load_progress_step(fraction, phase):
    """One inference_load_progress line per 10% step, so a model load shows
    progress without a line per poll. Reset per load by _reset_load_progress_step."""
    global _last_load_progress_step
    step = int(max(0.0, min(float(fraction), 1.0)) * 10)
    with _load_progress_lock:
        prev = _last_load_progress_step
        if step == prev:
            return
        _last_load_progress_step = step
        if step < prev:
            return  # load regressed/restarted mid-poll; resync without logging
    logger.info("inference_load_progress", phase = phase or "", percent = step * 10)


def _reset_load_progress_step():
    """Arm the throttle for a new load so its first sampled step always logs,
    even a cached load that already reports fraction=1.0 on the first poll."""
    global _last_load_progress_step
    with _load_progress_lock:
        _last_load_progress_step = -1


async def _get_load_progress_impl(current_subject: str = Depends(get_current_subject)):
    """
    Return the active GGUF load's mmap/upload progress.

    During the warmup window after a GGUF download -- when llama-server pages
    ~tens-to-hundreds of GB of shards into the page cache before pushing layers
    to VRAM -- ``/api/inference/status`` only shows a generic spinner. This
    exposes sampled progress so the UI can render a real bar plus rate/ETA.

    Returns an empty payload (``phase=null, bytes=0``) when no load is in
    flight. The frontend should stop polling once ``phase`` becomes ``ready``.
    """
    try:
        llama_backend = get_llama_cpp_backend()
        progress = llama_backend.load_progress()
        if progress is None:
            return LoadProgressResponse()
        resp = LoadProgressResponse(**progress)
        _log_load_progress_step(resp.fraction, resp.phase)
        return resp
    except Exception as e:
        logger.warning(f"Error sampling load progress: {e}")
        return LoadProgressResponse()


# =====================================================================
# Model Lifecycle & Status (Modularized in routes.inference_pkg)
# =====================================================================
from routes.inference_pkg.router_lifecycle import (
    router as _lifecycle_router,
    load_model,
    validate_model,
    unload_model,
    get_llama_flags,
    get_status,
    get_load_progress,
)

for _r in _lifecycle_router.routes:
    router.routes.append(_r)

# =====================================================================
# Audio (TTS / STT) Generation (Modularized in routes.inference_pkg)
# =====================================================================
from routes.inference_pkg.router_audio import (
    router as _audio_router,
    generate_audio,
    openai_audio_speech,
    openai_audio_transcriptions,
    _generate_tts_wav,
    _persist_tts_clip,
    _wav_duration_seconds,
)

for _r in _audio_router.routes:
    router.routes.append(_r)

# =====================================================================
# Speech-To-Text (STT) Sidecar (Modularized in routes.inference_pkg)
# =====================================================================
from routes.inference_pkg.router_stt_studio import (
    router as _stt_studio_router,
    _stt_engine_for_model,
    _resolve_stt_engine,
    _resolve_serving_stt_engine,
    _prepare_runtime_fallback_checkpoint,
    _stt_download_module,
    _stt_sidecar_for,
    _stt_lifecycle,
    stt_status,
    stt_download,
    stt_download_cancel,
    stt_load,
    stt_validate,
    stt_unload,
    transcribe_audio,
    transcribe_audio_raw,
)

for r in _stt_studio_router.routes:
    studio_router.routes.append(r)

# =====================================================================
# OpenAI-Compatible Chat Completions  (/chat/completions)
# =====================================================================


# =====================================================================
# Multimodal Media & Audio/Video Utilities (Modularized in routes.inference_pkg)
# =====================================================================
from routes.inference_pkg.multimodal_media import (
    STT_AUDIO_B64_MAX_CHARS,
    STT_AUDIO_RAW_MAX_BYTES,
    _decode_audio_base64,
    _sniff_audio_container,
    _mono_f32_to_wav_bytes,
    _resample_mono_linear,
    _fit_transcoded_audio_to_wav_cap,
    _decode_audio_mono,
    _prepare_audio_for_llama,
    _video_b64_rejection,
    _inject_video_part,
    _inject_audio_part,
    _extract_content_parts,
)

# =====================================================================
# External Cloud Provider Proxy (Modularized in routes.inference_pkg)
# =====================================================================
from routes.inference_pkg.router_external_proxy import (
    _INPUT_DOCUMENT_PROVIDERS,
    _build_external_messages,
    _proxy_to_external_provider,
)



# =====================================================================
# OpenAI Shell-Tool Containers (Modularized in routes.inference_pkg)
# =====================================================================
from routes.inference_pkg.router_containers import (
    router as _containers_router,
    _resolve_openai_cloud_client,
    _summarize_container,
    list_openai_containers,
    create_openai_container,
    delete_openai_container,
)

for r in _containers_router.routes:
    router.routes.append(r)

def _fill_recommended_sampling_openai(payload, model_id) -> None:
    """Apply per-model recommended sampling (and any operator UNSLOTH_SAMPLING_* pin) to a
    ChatCompletionRequest in place.

    Only the sampling fields the client did NOT explicitly send (tracked via
    ``model_fields_set``) are overwritten, so a client that sets a field stays byte-identical
    unless an operator pins it. Fields with neither a recommendation nor a pin keep their
    existing (schema-default) value.
    """
    from utils.inference.inference_config import resolve_effective_sampling, SAMPLING_FIELD_NAMES

    explicit = {
        f: (getattr(payload, f) if f in payload.model_fields_set else None)
        for f in SAMPLING_FIELD_NAMES
    }
    effective = resolve_effective_sampling(model_id, explicit)
    for field, value in effective.items():
        setattr(payload, field, value)


# /v1/completions is proxied to llama-server verbatim; its repetition knob is "repeat_penalty",
# and every other sampling field keeps its name (mirrors _build_passthrough_payload).
_COMPLETIONS_SAMPLING_BODY_KEY = {"repetition_penalty": "repeat_penalty"}


def _fill_recommended_sampling_completions(body: dict, model_id) -> None:
    """Apply per-model recommended sampling (and any operator UNSLOTH_SAMPLING_* pin) to a raw
    ``/v1/completions`` body in place, so the legacy (non-chat) endpoint honors the same pins as
    ``/v1/chat/completions``.

    Unlike :func:`_fill_recommended_sampling_openai`, which fills a ChatCompletionRequest whose
    schema already carries per-field defaults, this body is proxied to llama-server as-is. A field
    with no operator pin, client value, or per-model recommendation is therefore left untouched
    (``fill_defaults = False``) so llama-server keeps its own default rather than being forced onto
    this schema's value. llama-server names the repetition knob ``repeat_penalty``, so read and
    write that alias for the client-sent value and any pin.
    """
    from utils.inference.inference_config import resolve_effective_sampling, SAMPLING_FIELD_NAMES

    explicit = {f: body.get(_COMPLETIONS_SAMPLING_BODY_KEY.get(f, f)) for f in SAMPLING_FIELD_NAMES}
    effective = resolve_effective_sampling(model_id, explicit, fill_defaults = False)
    for field, value in effective.items():
        body[_COMPLETIONS_SAMPLING_BODY_KEY.get(field, field)] = value


@router.post("/chat/completions")
async def openai_chat_completions(
    payload: ChatCompletionRequest,
    request: Request,
    current_subject: str = Depends(get_current_subject),
):
    """
    OpenAI-compatible chat completions endpoint.

    Supports multimodal messages: ``content`` may be a plain string or a list
    of content parts (``text`` / ``image_url``).

    Non-streaming (default): returns a single ChatCompletion JSON object.
    Streaming:               returns SSE chunks matching OpenAI's format.

    ``stream`` defaults to ``false`` per OpenAI's spec; clients opt into SSE by
    sending ``stream: true``.

    Routes to the correct backend automatically:
    - GGUF models → llama-server via LlamaCppBackend
    - Other models → Unsloth/transformers via InferenceBackend
    """
    # OpenAI's newer "developer" role is equivalent to "system". Normalize it
    # before provider routing so external providers (which may not accept the
    # "developer" role) get "system" too, matching the local path.
    for _m in payload.messages:
        if _m.role == "developer":
            _m.role = "system"

    if payload.logprobs:
        _raise_unsupported_openai_parameter(
            "logprobs", "logprobs is not supported for chat completions."
        )
    if payload.top_logprobs is not None:
        _raise_unsupported_openai_parameter(
            "top_logprobs", "top_logprobs is not supported for chat completions."
        )

    # ── External provider routing ────────────────────────────────
    # encrypted_api_key is optional -- local providers (llama.cpp / vLLM / Ollama) may run without auth.
    if payload.provider_id or payload.provider_type:
        # External provider: this request won't touch the local GGUF, so drop it
        # from the keep-warm count or its in-flight stream would falsely block a
        # concurrent local model switch from proceeding.
        from core.inference.llama_keepwarm import untrack_current_request

        untrack_current_request(request.scope)
        if _wants_multiple_choices(payload):
            _raise_unsupported_n("external provider chat completions")
        # input_video is llama.cpp's own part type, so the proxy has nowhere to
        # put the clip. Say so rather than answering as if there were no video.
        if payload.video_base64:
            raise HTTPException(
                status_code = 400,
                detail = "Video input is only supported on a local GGUF model with video support.",
            )
        return await _proxy_to_external_provider(payload, request, current_subject)

    # Reject a malformed function tool here: it would otherwise reach
    # llama-server and surface as an opaque 500 "Failed to parse tools".
    if payload.tools:
        for _tool in payload.tools:
            if not isinstance(_tool, dict):
                continue
            # llama-server 500s ("Failed to parse tools: Missing tool type") when
            # a function tool omits "type". Default it to "function" so a
            # well-formed tool isn't rejected over a missing discriminator (and a
            # malformed one still surfaces as a clean 400 below, not a 500).
            if _tool.get("type") is None and isinstance(_tool.get("function"), dict):
                _tool["type"] = "function"
            if _tool.get("type") != "function":
                continue
            _fn = _tool.get("function")
            _name = _fn.get("name") if isinstance(_fn, dict) else None
            if not isinstance(_name, str) or not _name.strip():
                raise HTTPException(
                    status_code = 400,
                    detail = openai_error_body(
                        "Invalid 'tools': each tool must have a 'function' with a 'name'.",
                        status = 400,
                        code = "invalid_value",
                        param = "tools",
                    ),
                )

    # Reject a system-only chat before any automatic load so an invalid request
    # never swaps or reloads the resident model (as /responses and /messages
    # already validate before switching). Gate on every automatic-load trigger,
    # not just auto-switch, since a standalone idle TTL can also reload here.
    # Parse once and reuse below.
    _pre_parsed = None
    _needs_vision = False
    _needs_image = False
    _modality_label = "image or audio"
    if _automatic_model_load_may_run():
        _pre_parsed = _extract_content_parts(payload.messages)
        if not _pre_parsed[1]:
            raise HTTPException(
                status_code = 400, detail = "At least one non-system message is required."
            )
        # Reject confirm-without-stream local tool requests before the switch: the
        # local tool path requires stream=true for the confirm gate, so this shape
        # is invalid and must not evict the resident model first.
        #
        # Enter the local-loop arm exactly when the passthrough router below would
        # run Unsloth's own tool loop. That gate is `_tools_on or _mcp_allowed`
        # (see the use_tools block): _effective_enable_tools (which lets a
        # process-wide --enable-tools policy force the loop on) plus mcp_enabled
        # honoring --disable-tools, and tool_choice="none" disabling it unless the
        # request explicitly asked. enabled_tools never enters loop entry (it only
        # filters which tools run), so it is not a signal here.
        #
        # But a policy-forced loop must not steal client-tool passthrough: when the
        # request did not explicitly ask for the loop (enable_tools/mcp) and carries
        # client tools, the router forwards to the provider branch, so only treat it
        # as the local loop when the request explicitly asked OR there is no client
        # passthrough to defer to.
        from state.tool_policy import get_tool_policy as _get_tool_policy_pre

        _cli_policy_pre = _get_tool_policy_pre()
        _use_tools_intent = _effective_enable_tools(payload) or (
            bool(payload.mcp_enabled) and _cli_policy_pre is not False
        )
        if payload.tool_choice == "none" and not _explicit_studio_tool_loop_requested(payload):
            _use_tools_intent = False
        _client_tool_passthrough = (
            bool(payload.tools)
            or bool(payload.openai_code_exec_container_id)
            or bool(payload.anthropic_code_exec_container_id)
            # A JSON-schema response_format is guided-decoding structured output the
            # router forwards to the llama-server passthrough, not Unsloth's tool
            # loop, so a --enable-tools policy must not 400 it as a local-confirm
            # request under ask/auto.
            or bool(_extract_response_format(payload))
        )
        # permission_mode only implies the confirm gate for that local loop.
        # Client-tool passthrough forwards to the provider branch and the validator
        # intentionally leaves confirm_tool_calls unset there, so only an explicit
        # confirm_tool_calls=True should force the local-confirm rejection for it.
        _studio_local_tool_loop = bool(_use_tools_intent) and (
            _explicit_studio_tool_loop_requested(payload) or not _client_tool_passthrough
        )
        if (
            not payload.bypass_permissions
            and not payload.stream
            and (
                (_confirm_gate_needs_stream(payload) and _studio_local_tool_loop)
                or (payload.confirm_tool_calls is True and _client_tool_passthrough)
            )
        ):
            raise HTTPException(
                status_code = 400,
                detail = openai_error_body(
                    "confirm_tool_calls requires stream=true for local tool execution.",
                    status = 400,
                    code = "invalid_request_error",
                    param = "confirm_tool_calls",
                ),
            )
        # Reject a malformed tool_choice forcing object before the switch: a
        # {"type": "function", "function": {}} with no name would otherwise be
        # forwarded to llama-server and rejected only after the model swapped.
        _tc = payload.tool_choice
        if isinstance(_tc, dict) and _tc.get("type") == "function":
            _tc_fn = _tc.get("function")
            _tc_name = _tc_fn.get("name") if isinstance(_tc_fn, dict) else None
            if not isinstance(_tc_name, str) or not _tc_name.strip():
                raise HTTPException(
                    status_code = 400,
                    detail = openai_error_body(
                        "Invalid 'tool_choice': the forced function must have a 'name'.",
                        status = 400,
                        code = "invalid_value",
                        param = "tool_choice",
                    ),
                )
        # Reject an oversized audio upload before the switch: the size cap is a
        # cheap, target-independent length check, so a too-large payload must not
        # load a GGUF only to 413 afterward (the decode itself stays post-switch to
        # avoid decoding a valid upload twice).
        if payload.audio_base64 and len(payload.audio_base64) > _MAX_AUDIO_B64_CHARS:
            raise HTTPException(status_code = 413, detail = "Audio file is too large (max ~25 MB).")
        # Reject streaming n>1 before the switch: only the non-streaming GGUF path
        # returns multiple choices, so stream=true + n>1 is invalid on every local
        # serving path (the external path already rejected it before its early
        # return). Both fields are known here, so a bad shape must not load model B
        # only to 400. The non-streaming n>1 cases stay post-switch, where the
        # serving path decides whether the shape is supported.
        if payload.stream and _wants_multiple_choices(payload):
            _raise_unsupported_n("streaming chat completions")
        # Audio input rides the same companion-mmproj projector as vision, so a
        # text-only target can't serve it either; guard both before the switch. An
        # audio-only request asks for the projector alone, since an audio model's
        # projector carries no vision tower.
        _needs_image = bool(_pre_parsed[2]) or _request_has_image(payload)
        # Video rides that projector too. Its own /props gate can only run after
        # the load, so this at least keeps a text-only target from evicting a
        # working model to serve a clip it could never take.
        _needs_vision = _needs_image or bool(payload.audio_base64) or bool(payload.video_base64)
        # Name what is actually attached, so the refusal does not report a
        # modality the request never carried.
        _modality_label = (
            " or ".join(
                name
                for name, present in (
                    ("image", _needs_image),
                    ("audio", bool(payload.audio_base64)),
                    ("video", bool(payload.video_base64)),
                )
                if present
            )
            or _modality_label
        )
        # Size is knowable now and the switch is not cheap: refuse an oversized
        # clip before it costs a model load.
        if payload.video_base64:
            _, _video_rejection = _video_b64_rejection(payload.video_base64)
            if _video_rejection is not None:
                raise HTTPException(status_code = _video_rejection[0], detail = _video_rejection[1])

    await _maybe_auto_switch_model(
        _switch_model_for_payload(payload),
        request,
        current_subject,
        require_vision = _needs_vision,
        require_image = _needs_image,
        modality_label = _modality_label,
    )

    llama_backend = get_llama_cpp_backend()
    using_gguf = llama_backend.is_loaded

    # OpenAI-SDK clients send ``chat_template_kwargs`` via ``extra_body``, which
    # the SDK spreads into the request body at the top level. Unsloth's
    # ChatCompletionRequest has ``extra="allow"`` so pydantic stashes them in
    # ``model_extra``, but downstream generators consume the typed
    # ``payload.enable_thinking``. Lift ``enable_thinking`` from the extra-body
    # chat_template_kwargs onto the typed field so clients that only know the
    # OpenAI shape (data_designer recipe runs, etc.) can still control the
    # reasoning preamble.
    _extra = getattr(payload, "model_extra", None)
    if payload.enable_thinking is None and isinstance(_extra, dict):
        _tpl_kw = _extra.get("chat_template_kwargs")
        if isinstance(_tpl_kw, dict) and "enable_thinking" in _tpl_kw:
            payload.enable_thinking = bool(_tpl_kw["enable_thinking"])

    # ── Determine which backend is active ─────────────────────
    # Single-model server: any model name serves the loaded model (drop-in
    # OpenAI compat), so payload.model is only a fallback label here.
    monitor_id = None

    async def _monitored_generate_audio(model_label: str, context_length: Optional[int] = None):
        tts_monitor_id = None
        if not getattr(request.state, "skip_api_monitor", False):
            tts_monitor_id = api_monitor.start(
                endpoint = request.url.path,
                via_api_key = _request_used_api_key(request),
                method = request.method,
                model = model_label,
                prompt = _monitor_prompt_from_messages(payload.messages),
                context_length = context_length,
                subject = current_subject,
            )
        try:
            response = await generate_audio(payload, request)
        except asyncio.CancelledError:
            api_monitor.finish(tts_monitor_id, "cancelled")
            raise
        except Exception as e:
            api_monitor.fail(tts_monitor_id, _friendly_error(e))
            raise
        if isinstance(response, JSONResponse):
            try:
                body = json.loads(response.body.decode())
                choices = body.get("choices") or []
                message = (choices[0].get("message") or {}) if choices else {}
                content = message.get("content")
                if isinstance(content, str):
                    api_monitor.set_reply(tts_monitor_id, content)
            except Exception:
                pass
        api_monitor.finish(tts_monitor_id)
        return response

    if using_gguf:
        # Advertised repo id after an auto-switch load, else a clean public id,
        # never the absolute .gguf path.
        model_name = _llama_public_model_id(llama_backend, payload.model)
        if getattr(llama_backend, "_is_audio", False):
            if _wants_multiple_choices(payload):
                _raise_unsupported_n("GGUF audio chat completions")
            _reject_audio_output_continuation(payload)
            return await _monitored_generate_audio(
                model_name,
                context_length = llama_backend.context_length,
            )
    else:
        backend = await asyncio.to_thread(get_inference_backend)
        if not backend.active_model_name:
            _status, _detail = await _no_model_loaded_error(
                "No model loaded. Call POST /inference/load first.",
                _switch_model_for_payload(payload),
                request,
                status = 400,
            )
            raise HTTPException(status_code = _status, detail = _detail)
        # Clean public id so the response never echoes a local path; the audio
        # branch below receives this sanitized label too.
        model_name = public_model_id(backend.active_model_name) or payload.model
        if _wants_multiple_choices(payload):
            _raise_unsupported_n("non-GGUF chat completions")

        # ── Audio TTS path: auto-route to audio generation ────
        # (Whisper is ASR not TTS -- handled below in audio input path)
        model_info = backend.models.get(backend.active_model_name, {})
        if model_info.get("is_audio") and model_info.get("audio_type") != "whisper":
            _reject_audio_output_continuation(payload)
            return await _monitored_generate_audio(model_name)

        # ── Whisper without audio: return clear error ──
        if model_info.get("audio_type") == "whisper" and not payload.audio_base64:
            raise HTTPException(
                status_code = 400,
                detail = "Whisper models require audio input. Please upload an audio file.",
            )

        if not getattr(request.state, "skip_api_monitor", False):
            monitor_id = api_monitor.start(
                endpoint = request.url.path,
                via_api_key = _request_used_api_key(request),
                method = request.method,
                model = model_name,
                prompt = _monitor_prompt_from_messages(payload.messages),
                context_length = _monitor_context_length(),
                subject = current_subject,
            )

        # ── Audio INPUT path: decode WAV and route to audio input generation ──
        if payload.audio_base64 and model_info.get("has_audio_input"):
            # This route re-listens to the recording and answers afresh, so there is
            # no boundary to resume from; the Studio UI already hides Continue here.
            if _continue_final_message(payload):
                raise HTTPException(
                    status_code = 400,
                    detail = "continue_final_message is not supported with audio input.",
                )
            try:
                audio_array = _decode_audio_base64(payload.audio_base64)
                system_prompt, chat_messages, _ = _extract_content_parts(payload.messages)
            except Exception as e:
                api_monitor.fail(monitor_id, _friendly_error(e))
                raise
            cancel_event = threading.Event()
            completion_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
            created = int(time.time())

            # Apply recommended sampling + operator pins to the omitted fields before generating,
            # so audio-input (non-whisper) generation honors `unsloth run --temperature` and
            # per-model recommendations like chat does. Whisper (ASR) ignores these fields.
            _fill_recommended_sampling_openai(
                payload, getattr(backend, "active_model_name", None) or model_name
            )

            # Request-scoped usage/budget receptacle (filled at gen_done).
            _audio_stats_holder: dict = {}

            def audio_input_generate():
                if model_info.get("audio_type") == "whisper":
                    return backend.generate_whisper_response(
                        audio_array = audio_array,
                        cancel_event = cancel_event,
                        stats_holder = _audio_stats_holder,
                    )
                return backend.generate_audio_input_response(
                    messages = chat_messages,
                    system_prompt = system_prompt,
                    audio_array = audio_array,
                    temperature = payload.temperature,
                    top_p = payload.top_p,
                    top_k = payload.top_k,
                    min_p = payload.min_p,
                    max_new_tokens = _effective_max_tokens(payload) or 2048,
                    repetition_penalty = payload.repetition_penalty,
                    # Compare sends audio_base64 and use_adapter in one body.
                    use_adapter = payload.use_adapter,
                    cancel_event = cancel_event,
                    stats_holder = _audio_stats_holder,
                )

            if payload.stream:
                _cancel_keys = (payload.cancel_id, payload.session_id, completion_id)
                _tracker = _TrackedCancel.for_payload(cancel_event, payload, *_cancel_keys)
                _tracker.__enter__()

                async def audio_input_stream():
                    disconnect_watcher = asyncio.create_task(
                        _await_disconnect_then_cancel(request, cancel_event)
                    )
                    try:
                        yield _chat_role_chunk(completion_id, created, model_name)

                        gen = audio_input_generate()
                        _DONE = object()
                        cancelled = False
                        while True:
                            if cancel_event.is_set():
                                cancelled = True
                                break
                            if await request.is_disconnected():
                                cancel_event.set()
                                api_monitor.finish(monitor_id, "cancelled")
                                return
                            chunk_text = await asyncio.to_thread(next, gen, _DONE)
                            if chunk_text is _DONE:
                                break
                            if isinstance(chunk_text, GenStreamError):
                                _msg = _friendly_gen_stream_error(chunk_text)
                                api_monitor.fail(monitor_id, _msg)
                                yield _openai_stream_error_sse(
                                    {"error": {"message": _msg, "type": "server_error"}}
                                )
                                return
                            if chunk_text:
                                api_monitor.append_reply(monitor_id, chunk_text)
                                yield _chat_content_chunk(
                                    completion_id, created, model_name, chunk_text
                                )

                        _audio_stats = _audio_stats_holder.get("stats")
                        _audio_finish = "stop" if cancelled else _stats_finish_reason(_audio_stats)
                        # The worker fills this in for both backends (MLX adds timings),
                        # so the row has counts and a speed like every other request.
                        if isinstance(_audio_stats, dict):
                            _monitor_usage(
                                monitor_id,
                                _audio_stats.get("usage"),
                                _monitor_context_length(),
                                timings = _audio_stats.get("timings"),
                            )
                        # Before finish(): that is where the reason is settled, and a
                        # later write would escape the clearing a cancelled row gets.
                        api_monitor.set_perf(monitor_id, stop_reason = _audio_finish)
                        api_monitor.finish(monitor_id, "cancelled" if cancelled else "completed")
                        yield _chat_final_chunk(completion_id, created, model_name, _audio_finish)
                        yield "data: [DONE]\n\n"
                    except asyncio.CancelledError:
                        cancel_event.set()
                        api_monitor.finish(monitor_id, "cancelled")
                        raise
                    except Exception as e:
                        logger.error(f"Error during audio input streaming: {e}", exc_info = True)
                        _msg = _friendly_error(e)
                        api_monitor.fail(monitor_id, _msg)
                        yield _openai_stream_error_sse(
                            {"error": {"message": _msg, "type": "server_error"}}
                        )
                    finally:
                        await _stop_local_disconnect_cancel_watcher(disconnect_watcher)
                        _tracker.__exit__(None, None, None)

                return _SameTaskStreamingResponse(
                    audio_input_stream(),
                    unstarted_cleanup = _tracked_cancel_unstarted_cleanup(_tracker),
                    media_type = "text/event-stream",
                    headers = {
                        "Cache-Control": "no-cache",
                        "Connection": "close",
                        "X-Accel-Buffering": "no",
                    },
                )
            else:
                # `stream` defaults to False, so this is the ordinary shape of an audio-input chat and it
                # holds the worker for the whole request. Unregistered, a swap counted zero generations
                # and cancelled it instead of 409ing (/unload runs no idle drain).
                _cancel_keys = (payload.cancel_id, payload.session_id, completion_id)
                _tracker = _TrackedCancel.for_payload(cancel_event, payload, *_cancel_keys)
                _tracker.__enter__()
                try:
                    full_text = ""
                    for chunk_text in audio_input_generate():
                        if isinstance(chunk_text, GenStreamError):
                            _msg = _friendly_gen_stream_error(chunk_text)
                            api_monitor.fail(monitor_id, _msg)
                            raise HTTPException(status_code = 500, detail = _msg)
                        full_text += chunk_text
                except HTTPException:
                    raise
                except Exception as e:
                    api_monitor.fail(monitor_id, _friendly_error(e))
                    raise
                finally:
                    # Nested under the except arms too: api_monitor.fail() can throw, and a leaked entry 409s swaps.
                    _tracker.__exit__(None, None, None)
                api_monitor.set_reply(monitor_id, full_text)
                _audio_json_stats = _audio_stats_holder.get("stats")
                _audio_json_finish = (
                    "stop" if cancel_event.is_set() else _stats_finish_reason(_audio_json_stats)
                )
                if isinstance(_audio_json_stats, dict):
                    _monitor_usage(
                        monitor_id,
                        _audio_json_stats.get("usage"),
                        _monitor_context_length(),
                        timings = _audio_json_stats.get("timings"),
                    )
                api_monitor.set_perf(monitor_id, stop_reason = _audio_json_finish)
                api_monitor.finish(monitor_id)
                response = ChatCompletion(
                    id = completion_id,
                    created = created,
                    model = model_name,
                    choices = [
                        CompletionChoice(
                            message = CompletionMessage(content = full_text),
                            finish_reason = _audio_json_finish,
                        )
                    ],
                )
                return _model_json_response(response)

    if monitor_id is None and not getattr(request.state, "skip_api_monitor", False):
        monitor_id = api_monitor.start(
            endpoint = request.url.path,
            via_api_key = _request_used_api_key(request),
            method = request.method,
            model = model_name,
            prompt = _monitor_prompt_from_messages(payload.messages),
            context_length = _monitor_context_length(),
            subject = current_subject,
        )

    # Finalize the monitor entry on validation rejection before raising.
    def _reject(status_code: int, detail: Any) -> "HTTPException":
        if monitor_id is not None:
            fail_detail = detail if isinstance(detail, str) else json.dumps(detail, default = str)
            api_monitor.fail(monitor_id, fail_detail)
        return HTTPException(status_code = status_code, detail = detail)

    def _reject_unsupported_n(path_label: str) -> "HTTPException":
        return _reject(
            400,
            openai_error_body(
                f"n > 1 is not supported for {path_label}.",
                status = 400,
                code = "unsupported_parameter",
                param = "n",
            ),
        )

    # Injection lives in the GGUF branch below, since input_video is llama.cpp's
    # own part type. Without this a transformers model answers as if the clip
    # were never attached.
    if payload.video_base64 and not using_gguf:
        raise _reject(
            400,
            "Video input is only supported on a local GGUF model with video support.",
        )

    # Apply per-model recommended sampling (and any operator UNSLOTH_SAMPLING_* pin) to the
    # fields the client omitted, so agents and API clients get the model's tuned defaults
    # unless they set the field explicitly. Placed after external-provider routing (which
    # returned above) so only local llama-server / transformers requests are touched, and it
    # covers both the passthrough and non-passthrough branches below since both read payload.*.
    _reco_model_id = (
        getattr(llama_backend, "model_identifier", None)
        if using_gguf
        else getattr(backend, "active_model_name", None)
    ) or model_name
    _fill_recommended_sampling_openai(payload, _reco_model_id)

    # ── Standard OpenAI function-calling pass-through (GGUF only) ────
    # When a client (opencode / Claude Code via OpenAI compat / Cursor /
    # Continue / ...) sends standard OpenAI `tools` without Unsloth's
    # `enable_tools` shorthand, forward the request to llama-server
    # verbatim so structured `tool_calls` flow back to the client. This
    # branch runs BEFORE `_extract_content_parts` because that helper is
    # unaware of `role="tool"` messages and assistant messages that only
    # carry `tool_calls` (content=None) — both of which are valid in
    # multi-turn client-side tool loops.
    effective_max_tokens = _effective_openai_max_tokens(payload)

    normalized_stop = _normalize_stop_sequences(payload.stop)

    _has_tool_messages = _has_openai_tool_history(payload.messages)
    _has_tool_catalog = bool(payload.tools and len(payload.tools) > 0)
    _has_active_tool_catalog = _has_tool_catalog and payload.tool_choice != "none"
    _has_client_tool_contract = _has_active_tool_catalog or _has_tool_messages
    # The Unsloth tool loop needs a tool-capable backend, so a request that asks
    # for it on a backend that can't run it (DiffusionGemma forces supports_tools
    # off) must not steal client tools from the passthrough (#6851).
    _studio_tool_loop_requested = (
        _explicit_studio_tool_loop_requested(payload) and llama_backend.supports_tools
    )
    _client_disabled_tool_calls = payload.tool_choice == "none" and not _studio_tool_loop_requested
    _supports_tool_passthrough = getattr(
        llama_backend, "supports_tool_passthrough", llama_backend.supports_tools
    )
    if (
        using_gguf
        and not _studio_tool_loop_requested
        and _has_client_tool_contract
        and not _supports_tool_passthrough
    ):
        raise _reject(
            400,
            openai_error_body(
                (
                    "Client-supplied tools or tool-call history require a GGUF chat template "
                    "with tool-call support; the current model/template does not advertise tools."
                ),
                status = 400,
                code = "unsupported_parameter",
                param = "tools" if payload.tools else "messages",
            ),
        )
    # Shared with the token counter, so a count can never describe a route the completion does
    # not take. Guided decoding routes here too: the non-passthrough path calls
    # generate_chat_completion, which has no response_format kwarg and would silently drop the
    # schema. No ``supports_tools`` needed -- grammars are independent of it.
    if using_gguf and _takes_tool_passthrough(payload, llama_backend):
        if _wants_multiple_choices(payload):
            raise _reject_unsupported_n("GGUF tool or response_format passthrough")
        if payload.audio_base64:
            # This path forwards the request verbatim, so the transcoded audio
            # never gets injected. (The agentic tool loop below does support
            # audio.)
            raise _reject(
                400,
                "Audio input is not supported together with guided decoding or client-supplied tools yet.",
            )
        if payload.video_base64:
            # Same shape: _build_openai_passthrough_body forwards an explicit
            # field list, so the clip would be dropped and the model would
            # answer without it.
            raise _reject(
                400,
                "Video input is not supported together with guided decoding or client-supplied tools yet.",
            )

        # Preserve the vision guard from the non-passthrough path below:
        # text-only tool-capable GGUFs should return a clear 400 here rather
        # than forwarding the image to llama-server and surfacing an opaque
        # upstream error.
        if not llama_backend.is_vision and (
            payload.image_base64
            or any(
                isinstance(m.content, list)
                and any(isinstance(p, ImageContentPart) for p in m.content)
                for m in payload.messages
            )
        ):
            raise _reject(
                400,
                "Image provided but current GGUF model does not support vision.",
            )

        cancel_event = threading.Event()
        completion_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
        # `stream` defaults to False on ChatCompletionRequest (OpenAI spec
        # parity). Naive curl / .NET / System.Text.Json clients omitting the
        # field used to get SSE here and choke on deserialization (#5047).
        if payload.stream:
            return await _openai_passthrough_stream(
                request,
                cancel_event,
                llama_backend,
                payload,
                model_name,
                completion_id,
                monitor_id = monitor_id,
            )
        _cancel_keys = (payload.cancel_id, payload.session_id, completion_id)
        _tracker = _TrackedCancel.for_payload(cancel_event, payload, *_cancel_keys)
        _tracker.__enter__()
        try:
            return await _openai_passthrough_non_streaming(
                llama_backend,
                payload,
                model_name,
                monitor_id = monitor_id,
                request = request,
                cancel_event = cancel_event,
            )
        finally:
            _tracker.__exit__(None, None, None)

    # ── Parse messages (handles multimodal content parts) ─────
    # Reuse the pre-hook parse when auto-switch did it, else parse now.
    if _pre_parsed is not None:
        system_prompt, chat_messages, extracted_image_b64 = _pre_parsed
    else:
        system_prompt, chat_messages, extracted_image_b64 = _extract_content_parts(payload.messages)

    if not chat_messages:
        raise _reject(400, "At least one non-system message is required.")

    # ── GGUF path: proxy to llama-server /v1/chat/completions ──
    if using_gguf:
        # Forward uploaded audio as an input_audio part. wav/mp3 pass through
        # untouched (llama-server decodes and resamples them via the mmproj
        # audio encoder); other containers are transcoded to WAV here. The part
        # is injected into the message list below so it rides through both the
        # plain and tool-calling paths, exactly like image_url parts.
        audio_b64 = None
        audio_format = "wav"
        if payload.audio_base64:
            if not getattr(llama_backend, "_has_audio_input", False):
                raise _reject(
                    400,
                    "Audio provided but current GGUF model does not support audio input.",
                )
            if len(payload.audio_base64) > _MAX_AUDIO_B64_CHARS:
                raise _reject(413, "Audio file is too large (max ~25 MB).")
            try:
                audio_b64, audio_format = await asyncio.to_thread(
                    _prepare_audio_for_llama, payload.audio_base64
                )
            except Exception as e:
                logger.warning("Audio decode failed: %s", e, exc_info = True)
                raise _reject(400, "Could not decode the provided audio file.")

        # Forwarded whole: llama-server owns the frame sampling, and takes the
        # clip only when /props reports modalities.video.
        video_b64 = None
        if payload.video_base64:
            if not getattr(llama_backend, "_has_video_input", False):
                raise _reject(
                    400,
                    "Video provided but the current GGUF model cannot take video input. "
                    "It needs an mmproj with video support, and ffmpeg/ffprobe installed.",
                )
            video_b64, video_rejection = _video_b64_rejection(payload.video_base64)
            if video_rejection is not None:
                raise _reject(*video_rejection)

        gguf_messages, _ = await _openai_messages_for_gguf_chat_async(
            payload,
            llama_backend.is_vision,
        )
        gguf_messages = _set_or_prepend_system_message(gguf_messages, system_prompt)
        image_b64 = None
        if audio_b64:
            _inject_audio_part(gguf_messages, audio_b64, audio_format)
        if video_b64:
            _inject_video_part(gguf_messages, video_b64)

        cancel_event = threading.Event()

        completion_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
        created = int(time.time())

        def _new_chat_reasoning_extractor():
            return _ResponsesReasoningExtractor(
                parse_think_markers = _responses_should_parse_think_markers(
                    payload,
                    llama_backend,
                )
            )

        _gguf_perf_callback = (
            _monitor_perf_callback(monitor_id, llama_backend.context_length)
            if not _wants_multiple_choices(payload)
            else None
        )

        def _gguf_chat_delta_line(delta: ChoiceDelta, finish_reason = None) -> str:
            if delta.reasoning_content is not None and delta.content is None:
                delta = delta.model_copy(update = {"content": ""})
            chunk = ChatCompletionChunk(
                id = completion_id,
                created = created,
                model = model_name,
                choices = [
                    ChunkChoice(
                        delta = delta,
                        finish_reason = finish_reason,
                    )
                ],
            )
            return f"data: {chunk.model_dump_json(exclude_none = True)}\n\n"

        # ── Tool-calling path (agentic loop) ──────────────────
        # `_effective_enable_tools` lets `unsloth run --enable-tools/--disable-tools`
        # hard-override the per-request value, else falls back to
        # `payload.enable_tools`. `mcp_enabled=true` also opens the tool loop so
        # MCP-only callers needn't flip a second flag, BUT must still honor a
        # CLI `--disable-tools` policy -- checking the raw policy here keeps
        # `mcp_enabled` from re-enabling tools the operator explicitly forbade.
        from state.tool_policy import get_tool_policy as _get_tool_policy_g

        _cli_policy = _get_tool_policy_g()
        _tools_on = False if _client_disabled_tool_calls else _effective_enable_tools(payload)
        _mcp_allowed = (
            not _client_disabled_tool_calls
            and bool(payload.mcp_enabled)
            and _cli_policy is not False
        )
        use_tools = (_tools_on or _mcp_allowed) and llama_backend.supports_tools

        if use_tools:
            tools_to_use = await _select_request_tools(
                payload, tools_on = _tools_on, mcp_allowed = _mcp_allowed
            )
            # Skip the tool loop when no tool survived, so the safetensors
            # loop's "empty = allow all" semantic can't reach built-in tools
            # the caller didn't opt into. Callers who omit enabled_tools still
            # get ALL_TOOLS here, so this only suppresses the loop when
            # discovery + opt-in left it genuinely empty.
            if not tools_to_use:
                use_tools = False

        if use_tools:
            # permission_mode ask/auto require the confirm gate for Unsloth's own
            # tool loop. The request validator self-enables confirm only for
            # request-level tool signals (enable_tools/enabled_tools/mcp_enabled);
            # when a CLI policy (--enable-tools) forces the loop on without those,
            # derive confirm here so the mode still gates the call (and a
            # non-stream ask/auto request is rejected below rather than running
            # unprompted). off/full never prompt, so they are excluded.
            _effective_confirm = _permission_mode_confirm(payload)
            # Bypass Permissions suppresses confirm, so the stream requirement
            # (the gate needs streaming to prompt) no longer applies. auto with an
            # always-safe-only selection never prompts, so it needs no stream even
            # though _effective_confirm stays true for the loop's per-call gate.
            if (
                _confirm_gate_needs_stream(payload)
                and not payload.bypass_permissions
                and not payload.stream
            ):
                raise _reject(
                    400,
                    openai_error_body(
                        "confirm_tool_calls requires stream=true for local tool execution.",
                        status = 400,
                        code = "invalid_request_error",
                        param = "confirm_tool_calls",
                    ),
                )
            if _wants_multiple_choices(payload):
                raise _reject_unsupported_n("GGUF tool chat completions")
            # ── Tool-use system prompt nudge ──────────────────────
            _nudge = _build_tool_action_nudge(
                tools = tools_to_use,
                model_name = model_name,
                full_access = bool(payload.bypass_permissions),
            )

            # Nudge the model to ground in attached documents instead of memory.
            _nudge = _apply_rag_nudge(_nudge, tools_to_use, rag_scope = payload.rag_scope)

            if _nudge:
                # Append nudge to system prompt (preserve user's prompt)
                if system_prompt:
                    system_prompt = system_prompt.rstrip() + "\n\n" + _nudge
                else:
                    system_prompt = _nudge
                gguf_messages = _set_or_prepend_system_message(gguf_messages, system_prompt)

            _gguf_auto_heal_tool_calls = (
                payload.auto_heal_tool_calls if payload.auto_heal_tool_calls is not None else True
            )
            # Active tool names gating the bare-rehearsal strip, matching the loop gate.
            _gguf_display_tool_names = _display_tool_name_gate(tools_to_use)

            # ── Strip stale tool-call XML from conversation history ─
            # The continuation target keeps its exact whitespace: the frontend appends
            # the model's output to the partial it holds, so trimming the tail here would
            # resume from a different boundary.
            _gguf_continue_target = (
                gguf_messages[-1] if _continue_final_message(payload) and gguf_messages else None
            )
            for _msg in gguf_messages:
                if _msg.get("role") == "assistant" and isinstance(_msg.get("content"), str):
                    # Gate on enabled tool names, like the live strip, so a documented inactive
                    # ``foo[ARGS]{...}`` survives in the replayed prompt context.
                    _stripped = _strip_tool_xml_for_display(
                        _msg["content"],
                        auto_heal_tool_calls = _gguf_auto_heal_tool_calls,
                        enabled_tool_names = _gguf_display_tool_names,
                    )
                    _msg["content"] = (
                        _stripped if _msg is _gguf_continue_target else _stripped.strip()
                    )

            def gguf_generate_with_tools():
                return llama_backend.generate_chat_completion_with_tools(
                    messages = gguf_messages,
                    tools = tools_to_use,
                    temperature = payload.temperature,
                    top_p = payload.top_p,
                    top_k = payload.top_k,
                    min_p = payload.min_p,
                    max_tokens = effective_max_tokens,
                    repetition_penalty = payload.repetition_penalty,
                    presence_penalty = payload.presence_penalty,
                    stop = normalized_stop,
                    cancel_event = cancel_event,
                    seed = payload.seed,
                    enable_thinking = payload.enable_thinking,
                    reasoning_effort = payload.reasoning_effort,
                    preserve_thinking = payload.preserve_thinking,
                    continue_final_message = _continue_final_message(payload),
                    auto_heal_tool_calls = _gguf_auto_heal_tool_calls,
                    nudge_tool_calls = payload.nudge_tool_calls,
                    max_tool_iterations = payload.max_tool_calls_per_message
                    if payload.max_tool_calls_per_message is not None
                    else 25,
                    tool_call_timeout = payload.tool_call_timeout
                    if payload.tool_call_timeout is not None
                    else 300,
                    session_id = payload.session_id,
                    thread_id = payload.thread_id,
                    rag_scope = payload.rag_scope,
                    disable_parallel_tool_use = payload.parallel_tool_calls is False,
                    # Bypass Permissions takes precedence over the confirm gate:
                    # never prompt while bypassing.
                    confirm_tool_calls = _effective_confirm and not bool(payload.bypass_permissions),
                    bypass_permissions = bool(payload.bypass_permissions),
                    permission_mode = payload.permission_mode,
                    perf_callback = _gguf_perf_callback,
                )

            _tool_admission_mode = "chat_tool_stream" if payload.stream else "chat_tool_nonstream"
            try:
                reservation, admission_config = _openai_llama_admission_reserve(
                    request = request,
                    llama_backend = llama_backend,
                )
            except LlamaAdmissionQueueFull as exc:
                _llama_admission_log(
                    "queue-full",
                    snapshot = exc.snapshot,
                    request = request,
                    mode = _tool_admission_mode,
                    completion_id = completion_id,
                    level = "warning",
                )
                api_monitor.fail(monitor_id, str(exc))
                raise _openai_admission_http_exception(exc, status_code = 429)

            _tool_sentinel = object()
            # True only once the sync generator returned on its own; see _gguf_decode_finished.
            _tool_decode_finished = False

            _cancel_keys = (payload.cancel_id, payload.session_id, completion_id)
            _tracker = _TrackedCancel.for_payload(cancel_event, payload, *_cancel_keys)
            _tracker.__enter__()

            async def gguf_tool_stream():
                nonlocal _tool_decode_finished
                gen = None
                next_task = None
                stream_completed = False
                # A call parked on the approval prompt is not decoding, so it gives its slot back;
                # otherwise unanswered prompts hold every slot.
                _parked = False

                async def _park_admission(on: bool, *, wait: bool = True):
                    nonlocal _parked
                    if on == _parked:
                        return
                    # This run's own lease, not a fresh lookup: queues are keyed by base_url and a
                    # reload mints a new port, so re-resolving could release someone else's slot.
                    lease = reservation.lease_nowait()
                    if lease is None:
                        return
                    if on:
                        # Refused when the budget is spent: the slot stays here,
                        # so there is nothing to take back afterwards.
                        if not lease.park():
                            return
                    elif wait:
                        # Resuming: park() may have handed our slot to a waiter, so wait for room instead
                        # of putting two holders on one slot.
                        await lease.unpark_async(cancel_event = cancel_event)
                    else:
                        # Tearing down; the lease is released separately.
                        lease.unpark()
                    _parked = on

                disconnect_watcher = asyncio.create_task(
                    _await_disconnect_then_cancel(request, cancel_event)
                )
                try:
                    yield _chat_role_chunk(completion_id, created, model_name)

                    # Iterate the sync generator in a thread so the event loop
                    # stays free for disconnect detection.
                    gen = gguf_generate_with_tools()
                    prev_text = ""
                    reasoning_extractor = _new_chat_reasoning_extractor()
                    _stream_usage = None
                    _stream_timings = None
                    _stream_finish = None
                    approval_flush_pending = False

                    def _flush_reasoning_extractor():
                        final_reasoning, final_visible = reasoning_extractor.finish()
                        chunks = []
                        if final_reasoning:
                            # Held-back markers can make this the FIRST output of all.
                            api_monitor.mark_first_token(monitor_id)
                            chunks.append(
                                _gguf_chat_delta_line(
                                    ChoiceDelta(reasoning_content = final_reasoning)
                                )
                            )
                        if final_visible:
                            api_monitor.append_reply(monitor_id, final_visible)
                            chunks.append(_gguf_chat_delta_line(ChoiceDelta(content = final_visible)))
                        return chunks

                    while True:
                        if cancel_event.is_set():
                            break
                        if await request.is_disconnected():
                            cancel_event.set()
                            api_monitor.finish(monitor_id, "cancelled")
                            return

                        next_task = asyncio.create_task(
                            asyncio.to_thread(next, gen, _tool_sentinel)
                        )
                        try:
                            # Stall-timeout wait: keepalive while the generator stays
                            # silent (e.g. prefill between tool iterations). asyncio.wait
                            # never cancels next_task, matching the finally-drain shield.
                            wait_timeout = (
                                TOOL_APPROVAL_FLUSH_DELAY_S
                                if approval_flush_pending
                                else _LOCAL_TOOL_STREAM_STALL_KEEPALIVE_S
                            )
                            while True:
                                done_tasks, _ = await asyncio.wait(
                                    {next_task},
                                    timeout = wait_timeout,
                                )
                                if done_tasks:
                                    break
                                yield _OPENAI_PASSTHROUGH_SSE_KEEPALIVE
                                approval_flush_pending = False
                                wait_timeout = _LOCAL_TOOL_STREAM_STALL_KEEPALIVE_S
                            event = next_task.result()
                            approval_flush_pending = False
                        finally:
                            if next_task.done():
                                next_task = None
                        if event is _tool_sentinel:
                            _tool_decode_finished = True
                            break

                        # Anything after the gated tool_start means the user answered.
                        if not (
                            event["type"] == "tool_start" and event.get("awaiting_confirmation")
                        ):
                            await _park_admission(False)

                        if event["type"] == "heartbeat":
                            # Tool-wrapper heartbeat while a server-side tool blocks; keeps SSE alive.
                            yield _OPENAI_PASSTHROUGH_SSE_KEEPALIVE
                            continue

                        if event["type"] in ("tool_output", "tool_args"):
                            # Live stdout/stderr or tool-call arguments, forwarded
                            # verbatim for the UI. Final result still arrives in tool_end.
                            yield f"data: {json.dumps(event)}\n\n"
                            continue

                        if event["type"] == "status":
                            # Empty status marks an iteration boundary in the
                            # GGUF tool loop (e.g. after a re-prompt). Reset the
                            # cumulative cursor so the next assistant turn
                            # streams cleanly.
                            if not event["text"]:
                                for chunk in _flush_reasoning_extractor():
                                    yield chunk
                                prev_text = ""
                                reasoning_extractor = _new_chat_reasoning_extractor()
                            # Emit tool status as a custom SSE event (including
                            # empty ones to clear UI badges)
                            status_data = json.dumps(
                                {
                                    "type": "tool_status",
                                    "content": event["text"],
                                }
                            )
                            yield f"data: {status_data}\n\n"
                            continue

                        if event["type"] in ("tool_start", "tool_end"):
                            if event["type"] == "tool_start":
                                # Tool card is client-visible output; stamp the turn here.
                                # Not decoded output: the tool run (or a human confirming
                                # it) before the next turn is not decoding time.
                                api_monitor.mark_first_token(monitor_id, decoded = False)
                                for chunk in _flush_reasoning_extractor():
                                    yield chunk
                                prev_text = ""
                                reasoning_extractor = _new_chat_reasoning_extractor()
                                # Yielded just before the loop blocks on the user.
                                await _park_admission(bool(event.get("awaiting_confirmation")))
                                approval_flush_pending = bool(event.get("awaiting_confirmation"))
                            yield f"data: {json.dumps(event)}\n\n"
                            continue

                        if event["type"] == "metadata":
                            _stream_usage = event.get("usage")
                            _stream_timings = event.get("timings")
                            _stream_finish = event.get("finish_reason")
                            continue

                        if event["type"] == "reasoning_summary":
                            # Forward server-side reasoning timing to the UI.
                            yield f"data: {json.dumps(event)}\n\n"
                            continue

                        # "content" type -- cumulative text. Sanitize the full
                        # cumulative then diff against the last sanitized
                        # snapshot so cross-chunk XML tags are handled correctly.
                        raw_cumulative = event.get("text", "")
                        clean_cumulative = _strip_tool_xml_for_display(
                            raw_cumulative,
                            auto_heal_tool_calls = _gguf_auto_heal_tool_calls,
                            enabled_tool_names = _gguf_display_tool_names,
                        )
                        new_text = clean_cumulative[len(prev_text) :]
                        prev_text = clean_cumulative
                        if not new_text:
                            continue
                        reasoning_delta, visible_delta = reasoning_extractor.feed(new_text)
                        if reasoning_delta:
                            api_monitor.mark_first_token(monitor_id)
                            yield _gguf_chat_delta_line(
                                ChoiceDelta(reasoning_content = reasoning_delta)
                            )
                        if visible_delta:
                            api_monitor.append_reply(monitor_id, visible_delta)
                            yield _gguf_chat_delta_line(ChoiceDelta(content = visible_delta))

                    for chunk in _flush_reasoning_extractor():
                        yield chunk

                    final_chunk = ChatCompletionChunk(
                        id = completion_id,
                        created = created,
                        model = model_name,
                        choices = [
                            ChunkChoice(
                                delta = ChoiceDelta(),
                                finish_reason = _clamp_finish_reason(_stream_finish),
                            )
                        ],
                    )
                    # Emit the terminal chunk carrying finish_reason before the
                    # optional usage chunk and [DONE], so OpenAI-compatible
                    # clients can detect stop/length/tool_calls.
                    yield f"data: {final_chunk.model_dump_json(exclude_none = True)}\n\n"
                    usage_line = _openai_stream_usage_chunk(
                        payload,
                        completion_id,
                        created,
                        model_name,
                        _stream_usage,
                        _stream_timings,
                    )
                    if usage_line is not None:
                        yield usage_line
                    _monitor_usage(
                        monitor_id,
                        _stream_usage,
                        _monitor_context_length(),
                        timings = _stream_timings,
                        stop_reason = _clamp_finish_reason(_stream_finish),
                    )
                    api_monitor.finish(
                        monitor_id, "cancelled" if cancel_event.is_set() else "completed"
                    )
                    stream_completed = True
                    yield "data: [DONE]\n\n"

                except asyncio.CancelledError:
                    cancel_event.set()
                    api_monitor.finish(monitor_id, "cancelled")
                    raise
                except Exception as e:
                    logger.error(f"Error during GGUF tool streaming: {e}", exc_info = True)
                    api_monitor.fail(monitor_id, _friendly_error(e))
                    # Recover if an MTP+tensor crash killed the server mid-stream.
                    get_llama_cpp_backend()._maybe_recover_from_mtp_crash(e)
                    error_chunk = _openai_stream_error_chunk(e)
                    yield _openai_stream_error_sse(error_chunk)
                finally:
                    # A disconnect mid-approval must not leave a slot parked.
                    await _park_admission(False, wait = False)
                    try:
                        if not stream_completed:
                            cancel_event.set()
                        task_to_drain = next_task
                        next_task = None
                        while task_to_drain is not None and not task_to_drain.done():
                            try:
                                await asyncio.shield(task_to_drain)
                            except asyncio.CancelledError:
                                cancel_event.set()
                                continue
                            except Exception:
                                break
                        if task_to_drain is not None and task_to_drain.done():
                            try:
                                task_to_drain.exception()
                            except (asyncio.CancelledError, Exception):
                                pass
                        if gen is not None and not stream_completed:
                            try:
                                await asyncio.to_thread(gen.close)
                            except (RuntimeError, ValueError):
                                pass
                            except Exception:
                                logger.debug(
                                    "Error closing GGUF tool stream generator during cleanup",
                                    exc_info = True,
                                )
                        await _stop_local_disconnect_cancel_watcher(disconnect_watcher)
                    finally:
                        _tracker.__exit__(None, None, None)

            if payload.stream:
                stream_lease = reservation.lease_nowait()
                admission_wait_started_at = None
                if stream_lease is None:
                    admission_wait_started_at = time.monotonic()
                    _llama_admission_log(
                        "queued",
                        reservation,
                        request = request,
                        mode = _tool_admission_mode,
                        completion_id = completion_id,
                        level = "debug",
                    )

                async def admitted_gguf_tool_stream():
                    lease = stream_lease
                    stream_started = False
                    stream_cancelled = False
                    try:
                        if lease is None:
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
                                _llama_admission_log(
                                    "granted-after-wait",
                                    reservation,
                                    request = request,
                                    mode = _tool_admission_mode,
                                    wait_started_at = admission_wait_started_at,
                                    completion_id = completion_id,
                                    level = "debug",
                                )
                                break
                        if lease is None:
                            return
                        await _raise_if_openai_admission_cancelled(
                            reservation,
                            request = request,
                            cancel_event = cancel_event,
                        )
                        iterator = gguf_tool_stream()
                        stream_started = True
                        try:
                            async for chunk in iterator:
                                # Release before the yield; see gguf_stream_chunks.
                                if (
                                    lease is not None
                                    and _tool_decode_finished
                                    and chunk == _SSE_DONE_CHUNK
                                ):
                                    lease.release()
                                yield chunk
                        except asyncio.CancelledError:
                            stream_cancelled = True
                            raise
                        finally:
                            await _close_openai_admitted_stream_iterator(
                                iterator,
                                cancelled = stream_cancelled,
                            )
                    except LlamaAdmissionTimeout as exc:
                        _llama_admission_log(
                            "timeout",
                            reservation,
                            request = request,
                            mode = _tool_admission_mode,
                            wait_started_at = admission_wait_started_at,
                            completion_id = completion_id,
                            level = "warning",
                        )
                        api_monitor.fail(monitor_id, str(exc))
                        yield _openai_stream_error_sse(
                            _openai_admission_error_body(exc, status_code = 503)
                        )
                    except LlamaAdmissionCancelled:
                        _llama_admission_log(
                            "cancelled-before-upstream",
                            reservation,
                            request = request,
                            mode = _tool_admission_mode,
                            wait_started_at = admission_wait_started_at,
                            completion_id = completion_id,
                            level = "debug",
                        )
                        api_monitor.finish(monitor_id, "cancelled")
                        return
                    except asyncio.CancelledError:
                        api_monitor.finish(monitor_id, "cancelled")
                        raise
                    except HTTPException as exc:
                        status_code = getattr(exc, "status_code", 500) or 500
                        detail = exc.detail
                        error = (
                            detail
                            if isinstance(detail, dict) and "error" in detail
                            else openai_error_body(str(detail), status = status_code)
                        )
                        api_monitor.fail(monitor_id, str(detail))
                        yield _openai_stream_error_sse(error)
                    finally:
                        if lease is not None:
                            lease.release()
                        if not stream_started:
                            api_monitor.finish(monitor_id, "cancelled")
                            reservation.cancel()
                            _tracker.__exit__(None, None, None)

                async def _gguf_tool_admission_unstarted_cleanup() -> None:
                    api_monitor.finish(monitor_id, "cancelled")
                    if stream_lease is not None:
                        stream_lease.release()
                    reservation.cancel()
                    _tracker.__exit__(None, None, None)

                return _SameTaskStreamingResponse(
                    admitted_gguf_tool_stream(),
                    unstarted_cleanup = _gguf_tool_admission_unstarted_cleanup,
                    media_type = "text/event-stream",
                    headers = {
                        "Cache-Control": "no-cache",
                        "Connection": "close",
                        "X-Accel-Buffering": "no",
                    },
                )

            # Non-streaming JSON: drain the agentic generator into one
            # ChatCompletion, like the standard GGUF `else` branch. stream:false
            # with tools enabled used to return an SSE body, breaking
            # non-streaming clients; `unsloth studio run --model` forces tools on
            # process-wide, so plain requests reach this path (#6570).
            def _drain_gguf_tool_loop():
                full_text = ""
                usage = None
                finish = None
                timings = None
                gen = gguf_generate_with_tools()
                try:
                    for event in gen:
                        if cancel_event.is_set():
                            break
                        if event.get("type") == "metadata":
                            usage = event.get("usage")
                            finish = event.get("finish_reason")
                            timings = event.get("timings")
                        elif event.get("type") == "content":
                            # Content is cumulative within a turn and resets
                            # between turns, so the last event holds the final
                            # turn's text. As in the safetensors drain, a visible
                            # preamble emitted before a tool call (its own earlier
                            # turn) isn't carried -- only the final turn is.
                            full_text = _strip_tool_xml_for_display(
                                event.get("text", ""),
                                auto_heal_tool_calls = _gguf_auto_heal_tool_calls,
                                enabled_tool_names = _gguf_display_tool_names,
                            )
                    return full_text, usage, finish, timings
                finally:
                    # Close the generator on early break/cancel so the underlying
                    # llama-server stream socket is released, like the SSE path.
                    try:
                        gen.close()
                    except (RuntimeError, ValueError):
                        pass

            drain_task = None

            async def _drain_cancelled_gguf_tool_task():
                if drain_task is None:
                    return
                while not drain_task.done():
                    try:
                        await asyncio.shield(drain_task)
                    except asyncio.CancelledError:
                        cancel_event.set()
                        continue
                    except Exception:
                        break
                if drain_task.done():
                    try:
                        drain_task.exception()
                    except (asyncio.CancelledError, Exception):
                        pass

            admission_lease = None
            admission_wait_started_at = None
            try:
                if reservation.lease_nowait() is None:
                    admission_wait_started_at = time.monotonic()
                    _llama_admission_log(
                        "queued",
                        reservation,
                        request = request,
                        mode = _tool_admission_mode,
                        completion_id = completion_id,
                        level = "debug",
                    )
                admission_lease = await _wait_for_openai_admission_non_streaming(
                    reservation,
                    admission_config,
                    request = request,
                    cancel_event = cancel_event,
                )
                if admission_wait_started_at is not None:
                    _llama_admission_log(
                        "granted-after-wait",
                        reservation,
                        request = request,
                        mode = _tool_admission_mode,
                        wait_started_at = admission_wait_started_at,
                        completion_id = completion_id,
                        level = "debug",
                    )
                await _raise_if_openai_admission_cancelled(
                    reservation,
                    request = request,
                    cancel_event = cancel_event,
                )
                drain_task = asyncio.create_task(asyncio.to_thread(_drain_gguf_tool_loop))
                (
                    full_text,
                    completion_usage,
                    completion_finish,
                    completion_timings,
                ) = await asyncio.shield(drain_task)
                reasoning_text, visible_text = _extract_responses_reasoning(
                    full_text,
                    parse_think_markers = _responses_should_parse_think_markers(
                        payload, llama_backend
                    ),
                )
                message_kwargs = {"content": visible_text}
                if reasoning_text:
                    message_kwargs["reasoning_content"] = reasoning_text
                _usage = completion_usage or {}
                _prompt_tokens = _usage.get("prompt_tokens") or 0
                _completion_tokens = _usage.get("completion_tokens") or 0
                response = ChatCompletion(
                    id = completion_id,
                    created = created,
                    model = model_name,
                    choices = [
                        CompletionChoice(
                            message = CompletionMessage(**message_kwargs),
                            finish_reason = _clamp_finish_reason(completion_finish),
                        )
                    ],
                    usage = CompletionUsage(
                        prompt_tokens = _prompt_tokens,
                        completion_tokens = _completion_tokens,
                        total_tokens = _prompt_tokens + _completion_tokens,
                        prompt_tokens_details = _prompt_tokens_details(
                            _usage.get("prompt_tokens_details")
                        ),
                    ),
                )
                api_monitor.set_reply(monitor_id, visible_text)
                _monitor_usage(
                    monitor_id,
                    {
                        "prompt_tokens": _prompt_tokens,
                        "completion_tokens": _completion_tokens,
                        "total_tokens": _prompt_tokens + _completion_tokens,
                    },
                    _monitor_context_length(),
                    timings = completion_timings,
                    stop_reason = _clamp_finish_reason(completion_finish),
                )
                api_monitor.finish(
                    monitor_id, "cancelled" if cancel_event.is_set() else "completed"
                )
                return _model_json_response(response)
            except asyncio.CancelledError:
                cancel_event.set()
                await _drain_cancelled_gguf_tool_task()
                api_monitor.finish(monitor_id, "cancelled")
                reservation.cancel()
                if admission_lease is not None:
                    admission_lease.release()
                _tracker.__exit__(None, None, None)
                raise
            except LlamaAdmissionTimeout as exc:
                _llama_admission_log(
                    "timeout",
                    reservation,
                    request = request,
                    mode = _tool_admission_mode,
                    wait_started_at = admission_wait_started_at,
                    completion_id = completion_id,
                    level = "warning",
                )
                api_monitor.fail(monitor_id, str(exc))
                if admission_lease is not None:
                    admission_lease.release()
                _tracker.__exit__(None, None, None)
                raise _openai_admission_http_exception(exc, status_code = 503)
            except LlamaAdmissionCancelled as exc:
                _llama_admission_log(
                    "cancelled-before-upstream",
                    reservation,
                    request = request,
                    mode = _tool_admission_mode,
                    wait_started_at = admission_wait_started_at,
                    completion_id = completion_id,
                    level = "debug",
                )
                api_monitor.finish(monitor_id, "cancelled")
                if admission_lease is not None:
                    admission_lease.release()
                _tracker.__exit__(None, None, None)
                raise HTTPException(
                    status_code = 499,
                    detail = _openai_admission_error_body(exc, status_code = 499),
                )
            except Exception as e:
                logger.error(f"Error during GGUF tool completion: {e}", exc_info = True)
                api_monitor.fail(monitor_id, _friendly_error(e))
                # Recover if an MTP+tensor crash killed the server.
                get_llama_cpp_backend()._maybe_recover_from_mtp_crash(e)
                # An over-context prompt makes llama-server return 400; map any
                # upstream 4xx to a 400 client error rather than leaking a 500.
                _cls = _classify_llama_generation_error(e)
                if _cls is not None:
                    raise HTTPException(
                        status_code = 400,
                        detail = openai_error_body(
                            _friendly_error(e),
                            status = 400,
                            code = "context_length_exceeded" if _cls else None,
                            param = "messages",
                        ),
                    )
                raise HTTPException(status_code = 500, detail = safe_error_detail(e))
            finally:
                if admission_lease is not None:
                    admission_lease.release()
                _tracker.__exit__(None, None, None)

        # ── Standard GGUF path (no tools) ─────────────────────

        def gguf_generate(choice_index: int = 0):
            _seed = payload.seed
            if _seed is not None and _seed >= 0 and choice_index:
                _seed += choice_index
            return llama_backend.generate_chat_completion(
                messages = gguf_messages,
                image_b64 = image_b64,
                temperature = payload.temperature,
                top_p = payload.top_p,
                top_k = payload.top_k,
                min_p = payload.min_p,
                max_tokens = effective_max_tokens,
                repetition_penalty = payload.repetition_penalty,
                presence_penalty = payload.presence_penalty,
                stop = normalized_stop,
                cancel_event = cancel_event,
                enable_thinking = payload.enable_thinking,
                reasoning_effort = payload.reasoning_effort,
                preserve_thinking = payload.preserve_thinking,
                continue_final_message = _continue_final_message(payload),
                seed = _seed,
                perf_callback = _gguf_perf_callback,
            )

        _gguf_sentinel = object()
        # True only once the sync generator returned on its own: only then has _open_stream's
        # client exited. A cancel still emits [DONE] without it.
        _gguf_decode_finished = False

        if payload.stream:
            if _wants_multiple_choices(payload):
                raise _reject_unsupported_n("streaming GGUF chat completions")
            _cancel_keys = (payload.cancel_id, payload.session_id, completion_id)
            _tracker = _TrackedCancel.for_payload(cancel_event, payload, *_cancel_keys)
            _tracker.__enter__()
            try:
                reservation, admission_config = _openai_llama_admission_reserve(
                    request = request,
                    llama_backend = llama_backend,
                )
            except LlamaAdmissionQueueFull as exc:
                _tracker.__exit__(None, None, None)
                _llama_admission_log(
                    "queue-full",
                    snapshot = exc.snapshot,
                    request = request,
                    mode = "chat_standard_stream",
                    completion_id = completion_id,
                    level = "warning",
                )
                api_monitor.fail(monitor_id, str(exc))
                raise _openai_admission_http_exception(exc, status_code = 429)

            async def gguf_stream_chunks():
                nonlocal _gguf_decode_finished
                disconnect_watcher = asyncio.create_task(
                    _await_disconnect_then_cancel(request, cancel_event)
                )
                gen = None
                next_task = None
                stream_completed = False
                try:
                    yield _chat_role_chunk(completion_id, created, model_name)

                    # Iterate the sync generator in a thread so the event loop
                    # stays free for disconnect detection.
                    gen = gguf_generate()
                    prev_text = ""
                    reasoning_extractor = _new_chat_reasoning_extractor()
                    _stream_usage = None
                    _stream_timings = None
                    _stream_finish = None
                    while True:
                        if cancel_event.is_set():
                            break
                        if await request.is_disconnected():
                            cancel_event.set()
                            api_monitor.finish(monitor_id, "cancelled")
                            return
                        next_task = asyncio.create_task(
                            asyncio.to_thread(next, gen, _gguf_sentinel)
                        )
                        try:
                            # Stall-timeout wait: keepalive while the generator stays
                            # silent (e.g. no-tool prefill). asyncio.wait never cancels
                            # next_task, matching the finally-drain shield (see GGUF stream).
                            while True:
                                done_tasks, _ = await asyncio.wait(
                                    {next_task},
                                    timeout = _LOCAL_TOOL_STREAM_STALL_KEEPALIVE_S,
                                )
                                if done_tasks:
                                    break
                                yield _OPENAI_PASSTHROUGH_SSE_KEEPALIVE
                            cumulative = next_task.result()
                        finally:
                            if next_task.done():
                                next_task = None
                        if cumulative is _gguf_sentinel:
                            _gguf_decode_finished = True
                            break
                        # Capture server metadata for the final usage chunk
                        if isinstance(cumulative, dict):
                            if cumulative.get("type") == "metadata":
                                _stream_usage = cumulative.get("usage")
                                _stream_timings = cumulative.get("timings")
                                _stream_finish = cumulative.get("finish_reason")
                            elif cumulative.get("type") == "diffusion_frame":
                                # Diffusion frame (per-step canvas): pass through as a raw SSE line on the
                                # tool_status channel. No assistant text, so it never enters the cumulative diff.
                                yield f"data: {json.dumps(cumulative)}\n\n"
                            else:
                                logger.warning(
                                    "gguf_stream_chunks: unexpected dict event: %s",
                                    {k: v for k, v in cumulative.items() if k != "timings"},
                                )
                            continue
                        new_text = cumulative[len(prev_text) :]
                        prev_text = cumulative
                        if not new_text:
                            continue
                        reasoning_delta, visible_delta = reasoning_extractor.feed(new_text)
                        if reasoning_delta:
                            api_monitor.mark_first_token(monitor_id)
                            yield _gguf_chat_delta_line(
                                ChoiceDelta(reasoning_content = reasoning_delta)
                            )
                        if visible_delta:
                            api_monitor.append_reply(monitor_id, visible_delta)
                            yield _gguf_chat_delta_line(ChoiceDelta(content = visible_delta))

                    final_reasoning, final_visible = reasoning_extractor.finish()
                    if final_reasoning:
                        # Held-back markers can make this the FIRST output of all.
                        api_monitor.mark_first_token(monitor_id)
                        yield _gguf_chat_delta_line(ChoiceDelta(reasoning_content = final_reasoning))
                    if final_visible:
                        api_monitor.append_reply(monitor_id, final_visible)
                        yield _gguf_chat_delta_line(ChoiceDelta(content = final_visible))

                    # Final chunk
                    final_chunk = ChatCompletionChunk(
                        id = completion_id,
                        created = created,
                        model = model_name,
                        choices = [
                            ChunkChoice(
                                delta = ChoiceDelta(),
                                finish_reason = _clamp_finish_reason(_stream_finish),
                            )
                        ],
                    )
                    # Emit the terminal chunk carrying finish_reason before the
                    # optional usage chunk and [DONE], so OpenAI-compatible
                    # clients can detect stop/length/tool_calls.
                    yield f"data: {final_chunk.model_dump_json(exclude_none = True)}\n\n"
                    usage_line = _openai_stream_usage_chunk(
                        payload,
                        completion_id,
                        created,
                        model_name,
                        _stream_usage,
                        _stream_timings,
                    )
                    if usage_line is not None:
                        yield usage_line
                    _monitor_usage(
                        monitor_id,
                        _stream_usage,
                        _monitor_context_length(),
                        timings = _stream_timings,
                        stop_reason = _clamp_finish_reason(_stream_finish),
                    )
                    api_monitor.finish(
                        monitor_id, "cancelled" if cancel_event.is_set() else "completed"
                    )
                    stream_completed = True
                    yield "data: [DONE]\n\n"

                except asyncio.CancelledError:
                    cancel_event.set()
                    api_monitor.finish(monitor_id, "cancelled")
                    raise
                except Exception as e:
                    logger.error(f"Error during GGUF streaming: {e}", exc_info = True)
                    api_monitor.fail(monitor_id, _friendly_error(e))
                    error_chunk = _openai_stream_error_chunk(e)
                    yield _openai_stream_error_sse(error_chunk)
                finally:
                    try:
                        if not stream_completed:
                            cancel_event.set()
                        task_to_drain = next_task
                        next_task = None
                        while task_to_drain is not None and not task_to_drain.done():
                            try:
                                await asyncio.shield(task_to_drain)
                            except asyncio.CancelledError:
                                cancel_event.set()
                                continue
                            except Exception:
                                break
                        if task_to_drain is not None and task_to_drain.done():
                            try:
                                task_to_drain.exception()
                            except (asyncio.CancelledError, Exception):
                                pass
                        if gen is not None and not stream_completed:
                            try:
                                await asyncio.to_thread(gen.close)
                            except (RuntimeError, ValueError):
                                pass
                            except Exception:
                                logger.debug(
                                    "Error closing GGUF stream generator during cleanup",
                                    exc_info = True,
                                )
                        await _stop_local_disconnect_cancel_watcher(disconnect_watcher)
                    finally:
                        _tracker.__exit__(None, None, None)

            stream_lease = reservation.lease_nowait()
            admission_wait_started_at = None
            if stream_lease is None:
                admission_wait_started_at = time.monotonic()
                _llama_admission_log(
                    "queued",
                    reservation,
                    request = request,
                    mode = "chat_standard_stream",
                    completion_id = completion_id,
                    level = "debug",
                )

            async def admitted_gguf_stream_chunks():
                lease = stream_lease
                stream_started = False
                stream_cancelled = False
                try:
                    if lease is None:
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
                            _llama_admission_log(
                                "granted-after-wait",
                                reservation,
                                request = request,
                                mode = "chat_standard_stream",
                                wait_started_at = admission_wait_started_at,
                                completion_id = completion_id,
                                level = "debug",
                            )
                            break
                    if lease is None:
                        return
                    await _raise_if_openai_admission_cancelled(
                        reservation,
                        request = request,
                        cancel_event = cancel_event,
                    )
                    iterator = gguf_stream_chunks()
                    stream_started = True
                    try:
                        async for chunk in iterator:
                            # The slot is idle once the sync generator returned and the stream ends
                            # with the plain sentinel. The finally only runs at ASGI teardown, so
                            # waiting for it starves the next request. Release before the yield: a
                            # stalled send() or a consumer that stops pulling parks us there, and
                            # Starlette never aclose()s a body iterator. Release is idempotent, so
                            # the finally stays the backstop. Exact equality, not endswith:
                            # _openai_stream_error_sse ends in the same sentinel before its
                            # cleanup runs, and that stream still owns the slot.
                            if (
                                lease is not None
                                and _gguf_decode_finished
                                and chunk == _SSE_DONE_CHUNK
                            ):
                                lease.release()
                            yield chunk
                    except asyncio.CancelledError:
                        stream_cancelled = True
                        raise
                    finally:
                        await _close_openai_admitted_stream_iterator(
                            iterator,
                            cancelled = stream_cancelled,
                        )
                except LlamaAdmissionTimeout as exc:
                    _llama_admission_log(
                        "timeout",
                        reservation,
                        request = request,
                        mode = "chat_standard_stream",
                        wait_started_at = admission_wait_started_at,
                        completion_id = completion_id,
                        level = "warning",
                    )
                    api_monitor.fail(monitor_id, str(exc))
                    yield _openai_stream_error_sse(
                        _openai_admission_error_body(exc, status_code = 503)
                    )
                except LlamaAdmissionCancelled:
                    _llama_admission_log(
                        "cancelled-before-upstream",
                        reservation,
                        request = request,
                        mode = "chat_standard_stream",
                        wait_started_at = admission_wait_started_at,
                        completion_id = completion_id,
                        level = "debug",
                    )
                    api_monitor.finish(monitor_id, "cancelled")
                    return
                except asyncio.CancelledError:
                    api_monitor.finish(monitor_id, "cancelled")
                    raise
                except HTTPException as exc:
                    status_code = getattr(exc, "status_code", 500) or 500
                    detail = exc.detail
                    error = (
                        detail
                        if isinstance(detail, dict) and "error" in detail
                        else openai_error_body(str(detail), status = status_code)
                    )
                    api_monitor.fail(monitor_id, str(detail))
                    yield _openai_stream_error_sse(error)
                finally:
                    if lease is not None:
                        lease.release()
                    if not stream_started:
                        api_monitor.finish(monitor_id, "cancelled")
                        reservation.cancel()
                        _tracker.__exit__(None, None, None)

            async def _gguf_admission_unstarted_cleanup() -> None:
                api_monitor.finish(monitor_id, "cancelled")
                if stream_lease is not None:
                    stream_lease.release()
                reservation.cancel()
                _tracker.__exit__(None, None, None)

            return _SameTaskStreamingResponse(
                admitted_gguf_stream_chunks(),
                unstarted_cleanup = _gguf_admission_unstarted_cleanup,
                media_type = "text/event-stream",
                headers = {
                    "Cache-Control": "no-cache",
                    "Connection": "close",
                    "X-Accel-Buffering": "no",
                },
            )
        else:
            try:
                reservation, admission_config = _openai_llama_admission_reserve(
                    request = request,
                    llama_backend = llama_backend,
                )
            except LlamaAdmissionQueueFull as exc:
                _llama_admission_log(
                    "queue-full",
                    snapshot = exc.snapshot,
                    request = request,
                    mode = "chat_standard_nonstream",
                    completion_id = completion_id,
                    level = "warning",
                )
                api_monitor.fail(monitor_id, str(exc))
                raise _openai_admission_http_exception(exc, status_code = 429)

            _cancel_keys = (payload.cancel_id, payload.session_id, completion_id)
            _tracker = _TrackedCancel.for_payload(cancel_event, payload, *_cancel_keys)
            _tracker.__enter__()
            admission_lease = None
            admission_wait_started_at = None
            try:
                if reservation.lease_nowait() is None:
                    admission_wait_started_at = time.monotonic()
                    _llama_admission_log(
                        "queued",
                        reservation,
                        request = request,
                        mode = "chat_standard_nonstream",
                        completion_id = completion_id,
                        level = "debug",
                    )
                admission_lease = await _wait_for_openai_admission_non_streaming(
                    reservation,
                    admission_config,
                    request = request,
                    cancel_event = cancel_event,
                )
                if admission_wait_started_at is not None:
                    _llama_admission_log(
                        "granted-after-wait",
                        reservation,
                        request = request,
                        mode = "chat_standard_nonstream",
                        wait_started_at = admission_wait_started_at,
                        completion_id = completion_id,
                        level = "debug",
                    )
                await _raise_if_openai_admission_cancelled(
                    reservation,
                    request = request,
                    cancel_event = cancel_event,
                )
            except asyncio.CancelledError:
                api_monitor.finish(monitor_id, "cancelled")
                reservation.cancel()
                if admission_lease is not None:
                    admission_lease.release()
                _tracker.__exit__(None, None, None)
                raise
            except LlamaAdmissionTimeout as exc:
                _llama_admission_log(
                    "timeout",
                    reservation,
                    request = request,
                    mode = "chat_standard_nonstream",
                    wait_started_at = admission_wait_started_at,
                    completion_id = completion_id,
                    level = "warning",
                )
                api_monitor.fail(monitor_id, str(exc))
                if admission_lease is not None:
                    admission_lease.release()
                _tracker.__exit__(None, None, None)
                raise _openai_admission_http_exception(exc, status_code = 503)
            except LlamaAdmissionCancelled as exc:
                _llama_admission_log(
                    "cancelled-before-upstream",
                    reservation,
                    request = request,
                    mode = "chat_standard_nonstream",
                    wait_started_at = admission_wait_started_at,
                    completion_id = completion_id,
                    level = "debug",
                )
                api_monitor.finish(monitor_id, "cancelled")
                if admission_lease is not None:
                    admission_lease.release()
                _tracker.__exit__(None, None, None)
                raise HTTPException(
                    status_code = 499,
                    detail = _openai_admission_error_body(exc, status_code = 499),
                )

            try:
                # ``n`` requests several independent completions; the single
                # decode slot yields one at a time, so loop sequentially.
                drain_task = None

                async def _drain_cancelled_gguf_task():
                    if drain_task is None:
                        return
                    while not drain_task.done():
                        try:
                            await asyncio.shield(drain_task)
                        except asyncio.CancelledError:
                            cancel_event.set()
                            continue
                        except Exception:
                            break
                    if drain_task.done():
                        try:
                            drain_task.exception()
                        except (asyncio.CancelledError, Exception):
                            pass

                def _drain_gguf_choices():
                    _n = payload.n or 1
                    _choices = []
                    _monitor_replies = []
                    _prompt_tokens = 0
                    _sum_completion = 0
                    _prompt_details = None
                    _last_timings = None
                    _last_finish = None
                    for _idx in range(_n):
                        # Stop spawning the remaining choices once cancelled.
                        if cancel_event.is_set():
                            break
                        full_text = ""
                        completion_usage = None
                        completion_finish = None
                        for token in gguf_generate(_idx):
                            if isinstance(token, dict):
                                if token.get("type") == "metadata":
                                    completion_usage = token.get("usage")
                                    completion_finish = token.get("finish_reason")
                                    _last_timings = token.get("timings")
                                    _last_finish = completion_finish
                                continue
                            full_text = token

                        reasoning_text, visible_text = _extract_responses_reasoning(
                            full_text,
                            parse_think_markers = _responses_should_parse_think_markers(
                                payload,
                                llama_backend,
                            ),
                        )
                        message_kwargs = {"content": visible_text}
                        if reasoning_text:
                            message_kwargs["reasoning_content"] = reasoning_text
                        _choices.append(
                            CompletionChoice(
                                index = _idx,
                                message = CompletionMessage(**message_kwargs),
                                finish_reason = _clamp_finish_reason(completion_finish),
                            )
                        )
                        _monitor_replies.append(visible_text)
                        if completion_usage:
                            # The prompt is shared across all n choices, so count its
                            # tokens ONCE (OpenAI bills only generated tokens for each
                            # extra choice). Only completion_tokens accumulates.
                            _prompt_tokens = completion_usage.get("prompt_tokens") or _prompt_tokens
                            _sum_completion += completion_usage.get("completion_tokens") or 0
                            if _prompt_details is None:
                                _prompt_details = completion_usage.get("prompt_tokens_details")
                    return (
                        _n,
                        _choices,
                        _monitor_replies,
                        _prompt_tokens,
                        _sum_completion,
                        _prompt_details,
                        _last_timings,
                        _last_finish,
                    )

                drain_task = asyncio.create_task(asyncio.to_thread(_drain_gguf_choices))
                (
                    _n,
                    _choices,
                    _monitor_replies,
                    _prompt_tokens,
                    _sum_completion,
                    _prompt_details,
                    _last_timings,
                    _last_finish,
                ) = await asyncio.shield(drain_task)

                response = ChatCompletion(
                    id = completion_id,
                    created = created,
                    model = model_name,
                    choices = _choices,
                    usage = CompletionUsage(
                        prompt_tokens = _prompt_tokens,
                        completion_tokens = _sum_completion,
                        total_tokens = _prompt_tokens + _sum_completion,
                        prompt_tokens_details = _prompt_tokens_details(_prompt_details),
                    ),
                )
                monitor_reply = _monitor_replies[-1] if _monitor_replies else ""
                if _n > 1:
                    monitor_reply = "\n\n".join(
                        f"Choice {_idx + 1}:\n{text}" for _idx, text in enumerate(_monitor_replies)
                    )
                api_monitor.set_reply(monitor_id, monitor_reply)
                _monitor_usage(
                    monitor_id,
                    {
                        "prompt_tokens": _prompt_tokens,
                        "completion_tokens": _sum_completion,
                        "total_tokens": _prompt_tokens + _sum_completion,
                    },
                    _monitor_context_length(),
                    # Omit both for n > 1: totals sum all choices while _last_timings and
                    # _last_finish are only the final one's, so they describe neither.
                    timings = _last_timings if len(_monitor_replies) <= 1 else None,
                    stop_reason = (
                        _clamp_finish_reason(_last_finish)
                        if _last_finish and len(_monitor_replies) <= 1
                        else None
                    ),
                )
                api_monitor.finish(monitor_id)
                return _model_json_response(response)

            except asyncio.CancelledError:
                cancel_event.set()
                await _drain_cancelled_gguf_task()
                api_monitor.finish(monitor_id, "cancelled")
                raise
            except Exception as e:
                logger.error(f"Error during GGUF completion: {e}", exc_info = True)
                api_monitor.fail(monitor_id, _friendly_error(e))
                # Recover if an MTP+tensor crash killed the server.
                get_llama_cpp_backend()._maybe_recover_from_mtp_crash(e)
                # An over-context prompt makes llama-server return 400; map any
                # upstream 4xx to a 400 client error rather than leaking a 500.
                _cls = _classify_llama_generation_error(e)
                if _cls is not None:
                    raise HTTPException(
                        status_code = 400,
                        detail = openai_error_body(
                            _friendly_error(e),
                            status = 400,
                            code = "context_length_exceeded" if _cls else None,
                            param = "messages",
                        ),
                    )
                raise HTTPException(status_code = 500, detail = safe_error_detail(e))
            finally:
                if admission_lease is not None:
                    admission_lease.release()
                _tracker.__exit__(None, None, None)
    # ── Standard Unsloth path ─────────────────────────────────

    # Decode image (from content parts OR legacy field)
    image_b64 = extracted_image_b64 or payload.image_base64
    image = None

    if image_b64:
        try:
            model_info = backend.models.get(backend.active_model_name, {})
            if not model_info.get("is_vision"):
                raise HTTPException(
                    status_code = 400,
                    detail = "Image provided but current model is text-only. Load a vision model.",
                )

            image = await asyncio.to_thread(
                _decode_and_resize_image,
                backend,
                image_b64,
            )

        except HTTPException:
            raise
        except Exception as e:
            raise log_and_http_error(
                e,
                400,
                "Failed to decode image",
                event = "inference.decode_image_failed",
                log = logger,
            )

    # Classify capability flags from the loaded template.
    _sf_model_info = backend.models.get(backend.active_model_name, {})
    _sf_tpl = (_sf_model_info.get("chat_template_info") or {}).get("template")
    # Resolve the tool policy BEFORE the protocol is classified: the template
    # branch chosen here must be the one generation renders. Reading the raw
    # policy and withdrawing it later would classify with the ``tool_use``
    # branch and then generate on the plain one, so a model whose reasoning
    # markers live only in the tool template starts in the wrong reasoning mode.
    from state.tool_policy import get_tool_policy as _get_tool_policy_sf

    _sf_cli_policy = _get_tool_policy_sf()
    _sf_tools_on = _effective_enable_tools(payload)
    # The launcher's tools-on default answers a request that said nothing about
    # tools. A request carrying tool_choice: "none", its own tool catalog,
    # tool-result history, or a response_format contract did say something, so
    # the default must not withdraw that opt-out or take the catalog from the
    # client-tool passthrough below. The GGUF router draws the same line with
    # _client_disabled_tool_calls and _takes_tool_passthrough; an explicit
    # enable_tools/mcp_enabled ask, or a CLI --enable-tools, still claims the
    # request as before.
    if (
        _sf_tools_on
        and _tools_on_by_launcher_default_only(payload)
        and _request_states_tool_intent(payload)
    ):
        _sf_tools_on = False
    _sf_mcp_allowed = bool(payload.mcp_enabled) and _sf_cli_policy is not False

    # Named templates may expose native reasoning only in their ``tool_use``
    # branch. Use a truthy placeholder for Unsloth-managed tools, whose concrete
    # schemas are selected below, and the request schemas for client passthrough.
    _sf_server_tool_intent = bool(_sf_tools_on or _explicit_studio_tool_loop_requested(payload))
    _sf_template_tools = payload.tools if payload.tool_choice != "none" else None
    if not _sf_template_tools and _sf_server_tool_intent:
        _sf_template_tools = ({},)

    def _sf_response_protocol(tools = None):
        features = _detect_safetensors_features(backend, _sf_tpl, tools = tools)
        parse_think = bool(
            features.get("supports_reasoning") or features.get("reasoning_always_on")
        )
        reasoning_prefilled = _sf_reasoning_prefill_mode(
            features,
            payload.enable_thinking,
            _sf_tpl,
            reasoning_effort = payload.reasoning_effort,
        )
        return features, parse_think, reasoning_prefilled

    # GGUF parity: split canonical <think> output into reasoning_content. The
    # selected template branch must match whether this request renders tools.
    _sf_features, _sf_parse_think, _sf_reasoning_prefilled = _sf_response_protocol(
        _sf_template_tools
    )

    # A continued turn renders no generation prompt, so nothing is prefilled and the
    # resumed text is the visible answer. Only the first turn continues; later tool-loop
    # turns render a fresh generation prompt and prefill as usual.
    _sf_continue = _continue_final_message(payload)
    _sf_continued_turn = [_sf_continue]

    def _new_sf_reasoning_extractor():
        prefilled = _sf_reasoning_prefilled
        if _sf_continued_turn[0]:
            _sf_continued_turn[0] = False
            prefilled = False
        return _ResponsesReasoningExtractor(
            parse_think_markers = _sf_parse_think,
            reasoning_prefilled = prefilled,
        )

    cancel_event = threading.Event()
    completion_id = f"chatcmpl-{uuid.uuid4().hex[:12]}"
    created = int(time.time())

    # ── Safetensors tool-calling path ─────────────────────────
    # Mirrors the GGUF agentic loop's event shape. Disabled for vision turns
    # (untested overlap with image render slot) and for gpt-oss (Harmony uses
    # dedicated channels, not <tool_call> XML -- gpt-oss tools still work via
    # the GGUF path).
    _sf_is_gptoss = False
    try:
        _sf_is_gptoss = bool(hasattr(backend, "_is_gpt_oss_model") and backend._is_gpt_oss_model())
    except Exception:
        _sf_is_gptoss = False

    _sf_tool_budget = (
        payload.max_tool_calls_per_message if payload.max_tool_calls_per_message is not None else 25
    )

    # _sf_cli_policy / _sf_tools_on / _sf_mcp_allowed are resolved above, before
    # the response protocol is classified, so both use the same decision.
    _sf_use_tools = (
        (_sf_tools_on or _sf_mcp_allowed)
        and _sf_features.get("supports_tools", False)
        and image is None
        and not _sf_is_gptoss
        and _sf_tool_budget > 0
    )

    if _sf_use_tools:
        _sf_tools_to_use = await _select_request_tools(
            payload, tools_on = _sf_tools_on, mcp_allowed = _sf_mcp_allowed
        )
        # Mirror the GGUF path: refuse to enter the tool loop when nothing
        # survived, so a model-emitted built-in call can't piggy-back on the
        # empty allow-list.
        if not _sf_tools_to_use:
            _sf_use_tools = False

    if _sf_use_tools:
        # permission_mode ask/auto require the confirm gate for Unsloth's own tool
        # loop; when a CLI policy (--enable-tools) forces the loop on without a
        # request-level tool signal, derive confirm here so the mode still gates
        # the call (matching the GGUF path). off/full never prompt.
        _sf_effective_confirm = _permission_mode_confirm(payload)
        # Bypass Permissions suppresses confirm, so the stream requirement
        # (the gate needs streaming to prompt) no longer applies. auto with an
        # always-safe-only selection never prompts, so it needs no stream even
        # though _sf_effective_confirm stays true for the loop's per-call gate.
        if (
            _confirm_gate_needs_stream(payload)
            and not payload.bypass_permissions
            and not payload.stream
        ):
            raise _reject(
                400,
                openai_error_body(
                    "confirm_tool_calls requires stream=true for local tool execution.",
                    status = 400,
                    code = "invalid_request_error",
                    param = "confirm_tool_calls",
                ),
            )
        _sf_nudge = _build_tool_action_nudge(
            tools = _sf_tools_to_use,
            model_name = model_name,
            full_access = bool(payload.bypass_permissions),
        )

        # RAG nudge, mirroring the GGUF path.
        _sf_nudge = _apply_rag_nudge(_sf_nudge, _sf_tools_to_use, rag_scope = payload.rag_scope)

        _sf_system_prompt = system_prompt
        if _sf_nudge:
            if _sf_system_prompt:
                _sf_system_prompt = _sf_system_prompt.rstrip() + "\n\n" + _sf_nudge
            else:
                _sf_system_prompt = _sf_nudge

        _sf_auto_heal_tool_calls = (
            payload.auto_heal_tool_calls if payload.auto_heal_tool_calls is not None else True
        )
        # Active tool names gating the bare-rehearsal strip, matching the loop gate.
        _sf_display_tool_names = _display_tool_name_gate(_sf_tools_to_use)

        # Strip stale tool-call XML from prior assistant turns. The continuation target
        # keeps its exact whitespace (see the GGUF path).
        _sf_continue_target = (
            chat_messages[-1] if _continue_final_message(payload) and chat_messages else None
        )
        _sf_chat_messages = []
        for _msg in chat_messages:
            if _msg.get("role") == "assistant" and isinstance(_msg.get("content"), str):
                _sf_stripped = _strip_tool_xml_for_display(
                    _msg["content"],
                    auto_heal_tool_calls = _sf_auto_heal_tool_calls,
                    enabled_tool_names = _sf_display_tool_names,
                )
                _sf_chat_messages.append(
                    {
                        **_msg,
                        "content": (
                            _sf_stripped if _msg is _sf_continue_target else _sf_stripped.strip()
                        ),
                    }
                )
            else:
                _sf_chat_messages.append(_msg)

        # Request-scoped usage/timings receptacle (filled at gen_done).
        _sf_stats_holder: dict = {}

        def sf_generate_with_tools():
            return backend.generate_chat_completion_with_tools(
                messages = _sf_chat_messages,
                tools = _sf_tools_to_use,
                system_prompt = _sf_system_prompt or "",
                temperature = payload.temperature,
                top_p = payload.top_p,
                top_k = payload.top_k,
                min_p = payload.min_p,
                max_tokens = effective_max_tokens,
                repetition_penalty = payload.repetition_penalty,
                presence_penalty = payload.presence_penalty,
                cancel_event = cancel_event,
                enable_thinking = payload.enable_thinking,
                reasoning_effort = payload.reasoning_effort,
                preserve_thinking = payload.preserve_thinking,
                continue_final_message = _continue_final_message(payload),
                auto_heal_tool_calls = _sf_auto_heal_tool_calls,
                nudge_tool_calls = payload.nudge_tool_calls,
                max_tool_iterations = _sf_tool_budget,
                tool_call_timeout = payload.tool_call_timeout
                if payload.tool_call_timeout is not None
                else 300,
                session_id = payload.session_id,
                thread_id = payload.thread_id,
                rag_scope = payload.rag_scope,
                # Bypass Permissions takes precedence over the confirm gate:
                # never prompt while bypassing.
                confirm_tool_calls = _sf_effective_confirm and not bool(payload.bypass_permissions),
                bypass_permissions = bool(payload.bypass_permissions),
                permission_mode = payload.permission_mode,
                use_adapter = payload.use_adapter,
                stats_holder = _sf_stats_holder,
                reasoning_prefilled = _sf_reasoning_prefilled,
            )

        _sf_tool_sentinel = object()
        _sf_cancel_keys = (payload.cancel_id, payload.session_id, completion_id)
        _sf_tracker = _TrackedCancel.for_payload(cancel_event, payload, *_sf_cancel_keys)
        _sf_tracker.__enter__()

        async def sf_tool_stream():
            gen = None
            _sf_next_task = None
            disconnect_watcher = asyncio.create_task(
                _await_disconnect_then_cancel(request, cancel_event)
            )
            try:
                yield _chat_role_chunk(completion_id, created, model_name)

                gen = sf_generate_with_tools()
                prev_text = ""
                reasoning_extractor = _new_sf_reasoning_extractor()
                approval_flush_pending = False

                def _sf_flush_reasoning():
                    # Drain the extractor at turn/stream end (mirrors GGUF); only visible text hits the monitor.
                    fr, fv = reasoning_extractor.finish()
                    out = []
                    if fr:
                        # Held-back markers can make this the FIRST output of all.
                        api_monitor.mark_first_token(monitor_id)
                        out.append(_chat_reasoning_chunk(completion_id, created, model_name, fr))
                    if fv:
                        api_monitor.append_reply(monitor_id, fv)
                        out.append(_chat_content_chunk(completion_id, created, model_name, fv))
                    return out

                while True:
                    if cancel_event.is_set():
                        backend.reset_generation_state(cancel_event)
                        break
                    if await request.is_disconnected():
                        cancel_event.set()
                        backend.reset_generation_state(cancel_event)
                        api_monitor.finish(monitor_id, "cancelled")
                        return

                    # Stall keepalive (see GGUF tool stream): silent backend segments
                    # must not leave the SSE stream idle past proxy timeouts.
                    _sf_next_task = asyncio.create_task(
                        asyncio.to_thread(next, gen, _sf_tool_sentinel)
                    )
                    wait_timeout = (
                        TOOL_APPROVAL_FLUSH_DELAY_S
                        if approval_flush_pending
                        else _LOCAL_TOOL_STREAM_STALL_KEEPALIVE_S
                    )
                    while True:
                        _sf_done, _ = await asyncio.wait(
                            {_sf_next_task},
                            timeout = wait_timeout,
                        )
                        if _sf_done:
                            break
                        yield _OPENAI_PASSTHROUGH_SSE_KEEPALIVE
                        approval_flush_pending = False
                        wait_timeout = _LOCAL_TOOL_STREAM_STALL_KEEPALIVE_S
                    event = _sf_next_task.result()
                    approval_flush_pending = False
                    # Done; drop the reference so the finally-block drain no-ops.
                    _sf_next_task = None
                    if event is _sf_tool_sentinel:
                        break
                    if isinstance(event, GenStreamError):
                        backend.reset_generation_state(cancel_event)
                        _msg = _friendly_gen_stream_error(event)
                        api_monitor.fail(monitor_id, _msg)
                        yield _openai_stream_error_sse(
                            {"error": {"message": _msg, "type": "server_error"}}
                        )
                        return
                    if not isinstance(event, dict):
                        raise RuntimeError(
                            f"Invalid safetensors tool event: {type(event).__name__}"
                        )

                    if event["type"] == "heartbeat":
                        # Tool-execution wrapper heartbeat -> SSE keepalive.
                        yield _OPENAI_PASSTHROUGH_SSE_KEEPALIVE
                        continue

                    if event["type"] in ("tool_output", "tool_args"):
                        # Live stdout/stderr, or tool-call arguments as the model writes them.
                        yield f"data: {json.dumps(event)}\n\n"
                        continue

                    if event["type"] == "status":
                        if not event["text"]:
                            # Iteration boundary: flush reasoning, then a fresh prefilled extractor for the next turn.
                            for _c in _sf_flush_reasoning():
                                yield _c
                            prev_text = ""
                            reasoning_extractor = _new_sf_reasoning_extractor()
                        status_data = json.dumps(
                            {
                                "type": "tool_status",
                                "content": event["text"],
                            }
                        )
                        yield f"data: {status_data}\n\n"
                        continue

                    if event["type"] in ("tool_start", "tool_end"):
                        if event["type"] == "tool_start":
                            # Same as the GGUF loop: visible output, but not decoded.
                            api_monitor.mark_first_token(monitor_id, decoded = False)
                            # Flush reasoning before tool_start so the thinking block closes ahead of the card.
                            for _c in _sf_flush_reasoning():
                                yield _c
                            prev_text = ""
                            reasoning_extractor = _new_sf_reasoning_extractor()
                            approval_flush_pending = bool(event.get("awaiting_confirmation"))
                        yield f"data: {json.dumps(event)}\n\n"
                        continue

                    # Diff cumulative cleaned text against last snapshot.
                    raw_cumulative = event.get("text", "")
                    clean_cumulative = _strip_tool_xml_for_display(
                        raw_cumulative,
                        auto_heal_tool_calls = _sf_auto_heal_tool_calls,
                        enabled_tool_names = _sf_display_tool_names,
                    )
                    new_text = clean_cumulative[len(prev_text) :]
                    prev_text = clean_cumulative
                    if not new_text:
                        continue
                    # Split reasoning vs visible; only visible reaches the monitor.
                    reasoning_delta, visible_delta = reasoning_extractor.feed(new_text)
                    if reasoning_delta:
                        api_monitor.mark_first_token(monitor_id)
                        yield _chat_reasoning_chunk(
                            completion_id, created, model_name, reasoning_delta
                        )
                    if visible_delta:
                        api_monitor.append_reply(monitor_id, visible_delta)
                        yield _chat_content_chunk(completion_id, created, model_name, visible_delta)

                for _c in _sf_flush_reasoning():
                    yield _c
                # Usage chunk from the last turn, same shape as the
                # GGUF tool loop's metadata. Request-scoped holder, so
                # concurrent streams cannot read each other's stats.
                _stats = _sf_stats_holder.get("stats")
                # The last turn's own budget decides: an earlier turn stopping at the
                # cap does not truncate the answer this one went on to write.
                _sf_finish = "stop" if cancel_event.is_set() else _stats_finish_reason(_stats)
                yield _chat_final_chunk(completion_id, created, model_name, _sf_finish)
                # Reuse the reason already sent to the client. Outside the stats block
                # below: a run whose token count is unknown reports no stats.
                api_monitor.set_perf(monitor_id, stop_reason = _sf_finish)
                if _stats:
                    usage_line = _openai_stream_usage_chunk(
                        payload,
                        completion_id,
                        created,
                        model_name,
                        _stats.get("usage"),
                        _stats.get("timings"),
                    )
                    if usage_line is not None:
                        yield usage_line
                    _monitor_usage(
                        monitor_id,
                        _stats.get("usage"),
                        timings = _stats.get("timings"),
                    )
                api_monitor.finish(
                    monitor_id, "cancelled" if cancel_event.is_set() else "completed"
                )
                yield "data: [DONE]\n\n"

            except asyncio.CancelledError:
                cancel_event.set()
                backend.reset_generation_state(cancel_event)
                api_monitor.finish(monitor_id, "cancelled")
                raise
            except GenStreamErrorRaised as exc:
                backend.reset_generation_state(cancel_event)
                _msg = _friendly_gen_stream_error(exc)
                api_monitor.fail(monitor_id, _msg)
                yield _openai_stream_error_sse({"error": {"message": _msg, "type": "server_error"}})
            except Exception:
                backend.reset_generation_state(cancel_event)
                # Generic wire message; full trace stays in the log (CWE-209:
                # transformers/torch errors may leak paths).
                logger.exception("safetensors tool stream error")
                api_monitor.fail(monitor_id, "An internal error occurred.")
                error_chunk = {
                    "error": {
                        "message": "An internal error occurred.",
                        "type": "server_error",
                    },
                }
                yield _openai_stream_error_sse(error_chunk)
            finally:
                await _stop_local_disconnect_cancel_watcher(disconnect_watcher)
                # Drain a still-running next(gen) worker before closing: closing
                # mid-next(gen) raises ValueError('generator already executing') and
                # skips the generator's cleanup finally. Matches the GGUF tool stream.
                await _drain_pending_next_task(_sf_next_task, cancel_event)
                if gen is not None:
                    try:
                        # Offload the close so the generator's cleanup runs off the event
                        # loop (matches the GGUF SSE path); a disconnect can't stall the loop.
                        await asyncio.to_thread(gen.close)
                    except (RuntimeError, ValueError):
                        pass
                _sf_tracker.__exit__(None, None, None)

        if payload.stream:
            return _SameTaskStreamingResponse(
                sf_tool_stream(),
                unstarted_cleanup = _tracked_cancel_unstarted_cleanup(_sf_tracker),
                media_type = "text/event-stream",
                headers = {
                    "Cache-Control": "no-cache",
                    "Connection": "close",
                    "X-Accel-Buffering": "no",
                },
            )

        # Non-streaming JSON: drain the loop, build one ChatCompletion.
        try:

            def _drain_to_text():
                full_text = ""
                # Only the resumed turn renders no generation prompt; later tool-loop turns
                # prefill <think> again. The kept text is the LAST turn's, so track the
                # boundary and pin the mode of the turn that text came from (the same events
                # reset the streaming path's extractor).
                continued = _sf_continue
                prefilled = _sf_reasoning_prefilled and not continued
                gen = sf_generate_with_tools()
                for event in gen:
                    if cancel_event.is_set():
                        break
                    if isinstance(event, GenStreamError):
                        raise HTTPException(
                            status_code = 500,
                            detail = _friendly_gen_stream_error(event),
                        )
                    if not isinstance(event, dict):
                        raise RuntimeError(
                            f"Invalid safetensors tool event: {type(event).__name__}"
                        )
                    _event_type = event.get("type")
                    if _event_type == "content":
                        full_text = _strip_tool_xml_for_display(
                            event.get("text", ""),
                            auto_heal_tool_calls = _sf_auto_heal_tool_calls,
                            enabled_tool_names = _sf_display_tool_names,
                        )
                        prefilled = _sf_reasoning_prefilled and not continued
                    elif _event_type == "tool_start" or (
                        _event_type == "status" and not event.get("text")
                    ):
                        continued = False
                return full_text, prefilled

            content_text, _sf_drain_prefilled = await asyncio.to_thread(_drain_to_text)
            # Split prefilled <think> out of the visible answer (GGUF parity); the monitor gets visible text only.
            _reasoning_text, _visible_text = _extract_responses_reasoning(
                content_text,
                parse_think_markers = _sf_parse_think,
                reasoning_prefilled = _sf_drain_prefilled,
            )
            api_monitor.set_reply(monitor_id, _visible_text)
            _stats = _sf_stats_holder.get("stats")
            # Reuse the reason this response carries. Outside the stats block below:
            # a run whose token count is unknown reports no stats.
            _sf_json_finish = "stop" if cancel_event.is_set() else _stats_finish_reason(_stats)
            api_monitor.set_perf(monitor_id, stop_reason = _sf_json_finish)
            if _stats:
                _monitor_usage(
                    monitor_id,
                    _stats.get("usage"),
                    timings = _stats.get("timings"),
                )
            api_monitor.finish(monitor_id, "cancelled" if cancel_event.is_set() else "completed")
            _sf_msg_kwargs = {"content": _visible_text}
            if _reasoning_text:
                _sf_msg_kwargs["reasoning_content"] = _reasoning_text
            response = ChatCompletion(
                id = completion_id,
                created = created,
                model = model_name,
                choices = [
                    CompletionChoice(
                        message = CompletionMessage(**_sf_msg_kwargs),
                        finish_reason = _sf_json_finish,
                    )
                ],
            )
            return _model_json_response(response)
        except asyncio.CancelledError:
            cancel_event.set()
            backend.reset_generation_state(cancel_event)
            api_monitor.finish(monitor_id, "cancelled")
            raise
        except GenStreamErrorRaised as exc:
            backend.reset_generation_state(cancel_event)
            _msg = _friendly_gen_stream_error(exc)
            api_monitor.fail(monitor_id, _msg)
            raise HTTPException(status_code = 500, detail = _msg)
        except HTTPException as exc:
            backend.reset_generation_state(cancel_event)
            api_monitor.fail(monitor_id, str(exc.detail))
            raise
        except Exception:
            backend.reset_generation_state(cancel_event)
            # CWE-209: generic detail; full trace in log.
            logger.exception("safetensors tool completion error")
            api_monitor.fail(monitor_id, "An internal error occurred.")
            raise HTTPException(
                status_code = 500,
                detail = "An internal error occurred.",
            )
        finally:
            _sf_tracker.__exit__(None, None, None)

    # Shared generation kwargs
    gen_kwargs = dict(
        messages = chat_messages,
        system_prompt = system_prompt,
        image = image,
        temperature = payload.temperature,
        top_p = payload.top_p,
        top_k = payload.top_k,
        min_p = payload.min_p,
        max_new_tokens = effective_max_tokens or 2048,
        repetition_penalty = payload.repetition_penalty,
        presence_penalty = payload.presence_penalty,
    )
    # Forward reasoning kwargs; the worker/template wrapper peels off any the
    # template doesn't accept.
    if payload.enable_thinking is not None:
        gen_kwargs["enable_thinking"] = payload.enable_thinking
    if payload.reasoning_effort is not None:
        gen_kwargs["reasoning_effort"] = payload.reasoning_effort
    if payload.preserve_thinking is not None:
        gen_kwargs["preserve_thinking"] = payload.preserve_thinking
    if _continue_final_message(payload):
        gen_kwargs["continue_final_message"] = True

    # ── Client-tool passthrough (safetensors + MLX) ──────────────
    # Client tools (or tool-result history) without server-side tools: render
    # tools into the template, generate one turn, heal text-form calls (#6801).
    # supports_tools=False falls through to plain relay (GGUF gate parity).
    _sf_has_tool_msgs = any(m.role == "tool" or m.tool_calls for m in payload.messages)
    # Gate on _sf_use_tools (did the server-side path claim the request?), not
    # raw mcp_enabled: an empty MCP registry must not silently drop client tools.
    _sf_client_tools = (
        # Read the resolved value, not a fresh _effective_enable_tools: the gate
        # above withdraws the launcher default for exactly these requests, and
        # recomputing here would hide that and drop the client catalog.
        not _sf_tools_on
        and not _sf_use_tools
        and image is None
        and not _sf_is_gptoss
        and _sf_features.get("supports_tools", False)
        and ((payload.tools and len(payload.tools) > 0) or _sf_has_tool_msgs)
    )
    # apply_chat_template sanitizes the catalog it renders, so a tool dropped for unsafe
    # markup never reached the prompt. Gating the healer on the caller's list instead would
    # promote a dropped tool with a clean NAME out of text-form output, handing the client a
    # call for a tool the model was never shown (#7066).
    from core.inference.chat_template_helpers import (
        chat_render_target as _sf_chat_render_target,
        markup_for_tokenizer as _sf_markup_for,
        neutralize_tool_descriptions as _sf_neutralize_tools,
        renderable_tool_catalog_for_targets as _sf_renderable_tools,
    )

    _sf_markup = _sf_markup_for(_sf_model_info.get("tokenizer"))

    # A text-only tool request on a vision model renders through a different object on each
    # backend: MLX keeps the PROCESSOR when it has a usable template (_generate_vlm), the
    # transformers path unwraps to the nested tokenizer (_generate_chat_response_inner).
    # Authorizing against one lets the other's render drop a tool the healer still holds, so
    # both are profiled and the catalog is the intersection. The MLX rule is shared with
    # _generate_vlm rather than restated, so the two cannot drift (#7066).
    _sf_processor = _sf_model_info.get("processor")
    _sf_tokenizer = _sf_model_info.get("tokenizer")
    _sf_mlx_target = _sf_chat_render_target(_sf_processor, _sf_tokenizer)
    _sf_hf_target = getattr(_sf_mlx_target, "tokenizer", _sf_mlx_target)
    _sf_chat_targets = (
        (_sf_mlx_target,) if _sf_hf_target is _sf_mlx_target else (_sf_mlx_target, _sf_hf_target)
    )
    _sf_healing_tools = (
        # Safe under EVERY template this turn could select: when the active one drops the
        # schema the render falls back to the native template, whose profile can drop a tool
        # the active profile kept (#7066). In a thread because the first request resolves
        # that native template through AutoTokenizer.from_pretrained, which would otherwise
        # block the event loop for every concurrent request.
        await asyncio.to_thread(
            _sf_renderable_tools,
            payload.tools,
            _sf_chat_targets,
            _sf_model_info,
            active_model_name = backend.active_model_name,
        )
        if _sf_client_tools
        else None
    )
    _sf_heal = (
        heal_gate(payload.auto_heal_tool_calls, _sf_healing_tools, payload.tool_choice)
        if _sf_client_tools
        else None
    )
    if _sf_client_tools:
        # Re-derive from payload.messages so tool_calls / role="tool" history
        # survives templating; fold system/developer into one leading system
        # message (templates reject "developer") and clear prompt to avoid a dup.
        gen_kwargs["messages"] = _set_or_prepend_system_message(
            _structured_tool_history_for_local_template(
                _flatten_content_parts_for_local_template(_openai_messages_for_passthrough(payload))
            ),
            system_prompt,
        )
        gen_kwargs["system_prompt"] = ""
        # tool_choice="none": keep history templating but advertise no tools
        # (heal_gate is off, markup would relay as prose). A forced function
        # narrows templating to that one schema. Both mirror the GGUF path,
        # where llama-server honors tool_choice itself.
        _sf_tc = payload.tool_choice
        _sf_forced = None
        if isinstance(_sf_tc, dict) and isinstance(_sf_tc.get("function"), dict):
            _sf_forced = _sf_tc["function"].get("name")
        if _sf_tc == "none":
            gen_kwargs["tools"] = None
        elif isinstance(_sf_forced, str):
            gen_kwargs["tools"] = [
                t
                for t in payload.tools or []
                if isinstance(t, dict)
                and isinstance(t.get("function"), dict)
                and t["function"].get("name") == _sf_forced
            ] or None
        else:
            gen_kwargs["tools"] = payload.tools

    # The potential tool context above is needed before server/client routing is
    # known. This standard path now has the exact schemas that will be rendered,
    # so resolve reasoning parsing again to keep empty registries, forced-tool
    # misses, and tool_choice="none" on the marker-free template branch.
    _, _sf_parse_think, _sf_reasoning_prefilled = _sf_response_protocol(gen_kwargs.get("tools"))

    # Request-scoped usage/timings receptacle (filled at gen_done).
    stats_holder: dict = {}

    if payload.use_adapter is not None:

        def generate(messages_override = None):
            kw = (
                gen_kwargs
                if messages_override is None
                else {**gen_kwargs, "messages": messages_override}
            )
            return backend.generate_with_adapter_control(
                use_adapter = payload.use_adapter,
                cancel_event = cancel_event,
                stats_holder = stats_holder,
                **kw,
            )
    else:

        def generate(messages_override = None):
            kw = (
                gen_kwargs
                if messages_override is None
                else {**gen_kwargs, "messages": messages_override}
            )
            return backend.generate_chat_response(
                cancel_event = cancel_event,
                stats_holder = stats_holder,
                **kw,
            )

    # ── Streaming response ────────────────────────────────────────
    if payload.stream:
        _cancel_keys = (payload.cancel_id, payload.session_id, completion_id)
        _tracker = _TrackedCancel.for_payload(cancel_event, payload, *_cancel_keys)
        _tracker.__enter__()

        async def stream_chunks():
            gen = None
            _next_task = None
            disconnect_watcher = asyncio.create_task(
                _await_disconnect_then_cancel(request, cancel_event)
            )
            try:
                yield _chat_role_chunk(completion_id, created, model_name)

                # Client-tool passthrough: heal text-form calls on the fly
                # (None => relay verbatim).
                healer = StreamToolCallHealer(_sf_heal, _sf_healing_tools) if _sf_heal else None
                heal_state = {"idx": 0}

                prev_text = ""
                # Split prefilled <think> into reasoning_content deltas (GGUF parity); single turn, serves MLX.
                reasoning_extractor = _new_sf_reasoning_extractor()
                # Run the sync generator in a worker thread so it can't block the event
                # loop. Critical for compare mode: a second request's blocking _gen_lock
                # acquisition would otherwise freeze the loop and stall both streams.
                _DONE = object()  # sentinel for generator exhaustion
                gen = generate()
                while True:
                    if cancel_event.is_set():
                        backend.reset_generation_state(cancel_event)
                        break
                    # Stall keepalive (see safetensors tool stream) each window while
                    # next(gen) runs in a worker. next(gen, _DONE) returns _DONE rather
                    # than raising StopIteration (which can't cross asyncio futures).
                    _next_task = asyncio.create_task(asyncio.to_thread(next, gen, _DONE))
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
                    if cumulative is _DONE:
                        break
                    if isinstance(cumulative, GenStreamError):
                        backend.reset_generation_state(cancel_event)
                        _msg = _friendly_gen_stream_error(cumulative)
                        api_monitor.fail(monitor_id, _msg)
                        yield _openai_stream_error_sse(
                            {"error": {"message": _msg, "type": "server_error"}}
                        )
                        return
                    if await request.is_disconnected():
                        cancel_event.set()
                        backend.reset_generation_state(cancel_event)
                        api_monitor.finish(monitor_id, "cancelled")
                        return
                    new_text = cumulative[len(prev_text) :]
                    prev_text = cumulative
                    if not new_text:
                        continue
                    # Split prefilled <think> reasoning first (GGUF/MLX parity),
                    # then route only the visible text through the client-tool
                    # healer so tool markup inside a reasoning block is not promoted.
                    reasoning_delta, visible_delta = reasoning_extractor.feed(new_text)
                    if reasoning_delta:
                        api_monitor.mark_first_token(monitor_id)
                        yield _chat_reasoning_chunk(
                            completion_id, created, model_name, reasoning_delta
                        )
                    if visible_delta:
                        if healer is None:
                            # Monitor mirrors the verbatim relay; with healing on,
                            # _sf_heal_events_to_sse records the healed events instead.
                            api_monitor.append_reply(monitor_id, visible_delta)
                            yield _chat_content_chunk(
                                completion_id, created, model_name, visible_delta
                            )
                        else:
                            for line in _sf_heal_events_to_sse(
                                healer.feed(visible_delta),
                                completion_id,
                                created,
                                model_name,
                                heal_state,
                                payload.parallel_tool_calls,
                                monitor_id,
                            ):
                                yield line

                final_reasoning, final_visible = reasoning_extractor.finish()
                if final_reasoning:
                    # Held-back markers can make this the FIRST output of all.
                    api_monitor.mark_first_token(monitor_id)
                    yield _chat_reasoning_chunk(completion_id, created, model_name, final_reasoning)
                if final_visible:
                    if healer is None:
                        api_monitor.append_reply(monitor_id, final_visible)
                        yield _chat_content_chunk(completion_id, created, model_name, final_visible)
                    else:
                        for line in _sf_heal_events_to_sse(
                            healer.feed(final_visible),
                            completion_id,
                            created,
                            model_name,
                            heal_state,
                            payload.parallel_tool_calls,
                            monitor_id,
                        ):
                            yield line

                # A cancelled stream must not promote buffered-but-incomplete
                # markup: finalize()'s allow_incomplete heal would execute a tool
                # the user just cancelled. Disconnect returns earlier; "Stop" only
                # sets cancel_event, so guard on it here too.
                _cancelled = cancel_event.is_set()
                if healer is not None and not _cancelled:
                    for line in _sf_heal_events_to_sse(
                        healer.finalize(),
                        completion_id,
                        created,
                        model_name,
                        heal_state,
                        payload.parallel_tool_calls,
                        monitor_id,
                    ):
                        yield line

                # Usage chunk (choices=[], usage set), same shape as the
                # GGUF path so the speed popover works for MLX too.
                # Request-scoped holder, so concurrent streams cannot
                # read each other's stats.
                _stats = stats_holder.get("stats")
                # A healed tool call wins: the turn ended on a call, not at the cap. A
                # cancelled one stopped on request, so it is never "length".
                _finish = (
                    "tool_calls"
                    if (healer is not None and not _cancelled and healer.healed)
                    else ("stop" if _cancelled else _stats_finish_reason(_stats))
                )
                yield _chat_final_chunk(completion_id, created, model_name, _finish)
                # Reuse the reason already sent to the client. Outside the stats block
                # below: a run whose token count is unknown reports no stats.
                api_monitor.set_perf(monitor_id, stop_reason = _finish)
                if _stats:
                    usage_line = _openai_stream_usage_chunk(
                        payload,
                        completion_id,
                        created,
                        model_name,
                        _stats.get("usage"),
                        _stats.get("timings"),
                    )
                    if usage_line is not None:
                        yield usage_line
                    _monitor_usage(
                        monitor_id,
                        _stats.get("usage"),
                        timings = _stats.get("timings"),
                    )
                api_monitor.finish(
                    monitor_id, "cancelled" if cancel_event.is_set() else "completed"
                )
                yield "data: [DONE]\n\n"

            except asyncio.CancelledError:
                cancel_event.set()
                backend.reset_generation_state(cancel_event)
                api_monitor.finish(monitor_id, "cancelled")
                raise
            except GenStreamErrorRaised as exc:
                # Adapter-controlled (compare-mode) backend failure. Honor the
                # public flag so operational errors surface their real message.
                backend.reset_generation_state(cancel_event)
                _msg = _friendly_gen_stream_error(exc)
                api_monitor.fail(monitor_id, _msg)
                yield _openai_stream_error_sse({"error": {"message": _msg, "type": "server_error"}})
            except Exception as e:
                backend.reset_generation_state(cancel_event)
                logger.error(f"Error during OpenAI streaming: {e}", exc_info = True)
                _msg = _friendly_error(e)
                api_monitor.fail(monitor_id, _msg)
                error_chunk = {
                    "error": {
                        "message": _msg,
                        "type": "server_error",
                    },
                }
                yield _openai_stream_error_sse(error_chunk)
            finally:
                await _stop_local_disconnect_cancel_watcher(disconnect_watcher)
                # Drain a still-running next(gen) worker before closing: closing
                # mid-next(gen) raises ValueError('generator already executing') and
                # skips the generator's cleanup finally. Matches the safetensors stream.
                await _drain_pending_next_task(_next_task, cancel_event)
                if gen is not None:
                    try:
                        # Offload the close so the generator's cleanup runs off the event
                        # loop (matches the GGUF SSE path); a disconnect can't stall the loop.
                        await asyncio.to_thread(gen.close)
                    except (RuntimeError, ValueError):
                        pass
                _tracker.__exit__(None, None, None)

        return _SameTaskStreamingResponse(
            stream_chunks(),
            unstarted_cleanup = _tracked_cancel_unstarted_cleanup(_tracker),
            media_type = "text/event-stream",
            headers = {
                "Cache-Control": "no-cache",
                "Connection": "close",
                "X-Accel-Buffering": "no",
            },
        )

    # ── Non-streaming response ────────────────────────────────────
    else:
        # `stream` defaults to False, so this is the default shape of a standard (non-GGUF) chat and
        # generate() holds the worker throughout. Unregistered, a swap cancelled this run rather
        # than returning 409 (/unload runs no idle drain).
        _cancel_keys = (payload.cancel_id, payload.session_id, completion_id)
        _tracker = _TrackedCancel.for_payload(cancel_event, payload, *_cancel_keys)
        _tracker.__enter__()
        try:
            full_text = ""
            for token in generate():
                if isinstance(token, GenStreamError):
                    backend.reset_generation_state(cancel_event)
                    _msg = _friendly_gen_stream_error(token)
                    api_monitor.fail(monitor_id, _msg)
                    raise HTTPException(status_code = 500, detail = _msg)
                full_text = token

            # Split prefilled <think> reasoning (GGUF parity); also covers MLX via
            # the shared generate(). Client-tool healing then runs on the visible
            # text so tool markup inside a reasoning block is never promoted.
            _reasoning_text, _visible_text = _extract_responses_reasoning(
                full_text,
                parse_think_markers = _sf_parse_think,
                reasoning_prefilled = _sf_reasoning_prefilled and not _sf_continue,
            )
            # Client-tool passthrough: promote text-form calls; opt-in single
            # nudge retry on unparseable tool markup.
            _msg = {"role": "assistant", "content": _visible_text}
            if _reasoning_text:
                _msg["reasoning_content"] = _reasoning_text
            # Budget exhaustion unless a heal below promotes a tool call; a cancelled turn
            # stopped on request, not at the cap, so it stays "stop".
            _finish = (
                "stop" if cancel_event.is_set() else _stats_finish_reason(stats_holder.get("stats"))
            )
            if _sf_heal:
                if heal_openai_message(_msg, _sf_heal, _sf_healing_tools):
                    _finish = "tool_calls"
                elif nudge_enabled(payload.nudge_tool_calls):
                    _data = {
                        "choices": [{"message": {"role": "assistant", "content": _visible_text}}]
                    }
                    if nudge_should_retry(_data, _sf_heal, _sf_healing_tools):
                        # A failed retry must not 500 the request; keep the first
                        # response (GGUF nudge parity). The retry's generate()
                        # overwrites stats_holder, so save the first attempt's stats
                        # and restore them if the retry is discarded.
                        _first_stats = stats_holder.get("stats")
                        try:
                            retry_text = ""
                            for token in generate(
                                [*gen_kwargs["messages"], *nudge_messages(_data, _sf_heal)]
                            ):
                                retry_text = token
                            # Re-split reasoning on the retry so its visible text is
                            # what heals into a call (and reaches the monitor).
                            # The nudge retry appends messages, so it is not a
                            # continuation and normal prefill detection applies.
                            _retry_reasoning, _retry_visible = _extract_responses_reasoning(
                                retry_text,
                                parse_think_markers = _sf_parse_think,
                                reasoning_prefilled = _sf_reasoning_prefilled,
                            )
                            retry_msg = {"role": "assistant", "content": _retry_visible}
                            if _retry_reasoning:
                                retry_msg["reasoning_content"] = _retry_reasoning
                            if heal_openai_message(retry_msg, _sf_heal, _sf_healing_tools):
                                _visible_text, _msg, _finish = (
                                    _retry_visible,
                                    retry_msg,
                                    "tool_calls",
                                )
                            else:
                                # Retry produced no healable call -> first response wins.
                                stats_holder["stats"] = _first_stats
                        except Exception as retry_exc:
                            logger.debug(
                                "Nudge retry failed; keeping first response: %s", retry_exc
                            )
                            stats_holder["stats"] = _first_stats
                # parallel_tool_calls=false: cap to one call (GGUF parity).
                if payload.parallel_tool_calls is False:
                    _tcs = _msg.get("tool_calls")
                    if isinstance(_tcs, list) and len(_tcs) > 1:
                        _msg["tool_calls"] = _tcs[:1]

            response = ChatCompletion(
                id = completion_id,
                created = created,
                model = model_name,
                choices = [
                    CompletionChoice(
                        message = CompletionMessage(
                            content = _msg["content"],
                            reasoning_content = _msg.get("reasoning_content"),
                            tool_calls = _msg.get("tool_calls"),
                        ),
                        finish_reason = _finish,
                    )
                ],
            )
            _monitor_reply = _msg.get("content") or ""
            if _finish == "tool_calls":
                _tcs = _msg.get("tool_calls") or []
                _calls_text = "; ".join(
                    f"{(tc.get('function') or {}).get('name', '')}"
                    f"({(tc.get('function') or {}).get('arguments', '')})"
                    for tc in _tcs
                )
                _monitor_reply = (_msg.get("content") or "") + (
                    f"[tool_calls] {_calls_text}" if _calls_text else ""
                )
            api_monitor.set_reply(monitor_id, _monitor_reply)
            # Reuse the response's finish_reason. Outside the stats block: a run
            # whose token count is unknown reports no stats.
            api_monitor.set_perf(monitor_id, stop_reason = _finish)
            _stats = stats_holder.get("stats")
            if _stats:
                _monitor_usage(
                    monitor_id,
                    _stats.get("usage"),
                    timings = _stats.get("timings"),
                )
            api_monitor.finish(monitor_id)
            return _model_json_response(response)

        except HTTPException:
            raise
        except GenStreamErrorRaised as exc:
            # Adapter-controlled (compare-mode) backend failure. Honor the public
            # flag so operational errors surface their real message.
            backend.reset_generation_state(cancel_event)
            _msg = _friendly_gen_stream_error(exc)
            api_monitor.fail(monitor_id, _msg)
            raise HTTPException(status_code = 500, detail = _msg)
        except Exception as e:
            backend.reset_generation_state(cancel_event)
            logger.error(f"Error during OpenAI completion: {e}", exc_info = True)
            api_monitor.fail(monitor_id, _friendly_error(e))
            raise HTTPException(status_code = 500, detail = safe_error_detail(e))
        finally:
            # Nested under the except arms too: reset_generation_state() can throw, and a leaked entry 409s swaps.
            _tracker.__exit__(None, None, None)


# =====================================================================
# Sandbox File Serving (Modularized in routes.inference_pkg)
# =====================================================================
from routes.inference_pkg.router_sandbox import (
    router as _sandbox_router,
    _sandbox_dir_for,
    _contained_sandbox_path,
    _sandbox_listing_names,
    _sandbox_listing,
    list_sandbox_files,
    reveal_sandbox_dir,
    serve_sandbox_file,
)

for r in _sandbox_router.routes:
    router.routes.append(r)

# =====================================================================
# OpenAI Models API (GET /v1/models) (Modularized in routes.inference_pkg)
# =====================================================================
from routes.inference_pkg.router_openai_models import (
    router as _openai_models_router,
    _openai_model_objects,
    _CATALOG_CACHE,
    _ADVERTISED_CACHE,
    _quant_reference_resolves,
    _advertised_local_path,
    _catalog_lock,
    _cached_local_catalog,
    _openai_catalog_objects,
    openai_list_models,
    openai_retrieve_model,
)

for r in _openai_models_router.routes:
    router.routes.append(r)

# =====================================================================
# OpenAI Completions & Embeddings API (Modularized in routes.inference_pkg)
# =====================================================================
from routes.inference_pkg.router_openai_completions import (
    router as _openai_completions_router,
    openai_completions,
    openai_embeddings,
    _flatten_monitor_prompt,
    _completions_prompt_present,
    _embeddings_input_present,
)

for r in _openai_completions_router.routes:
    router.routes.append(r)


# =====================================================================
# OpenAI Responses API (POST /v1/responses) (Modularized in routes.inference_pkg)
# =====================================================================
from routes.inference_pkg.router_openai_responses import (
    router as _openai_responses_router,
    openai_responses,
    _translate_responses_tools_to_chat,
    _translate_responses_tool_choice_to_chat,
    _responses_message_text,
    _responses_tool_output_content,
    _coerce_responses_reasoning_text,
    _responses_marker_holdback,
    _ResponsesReasoningExtractor,
    _extract_responses_reasoning,
    _responses_should_parse_think_markers,
    _responses_reasoning_output_item,
    _normalise_responses_input,
    _responses_text_format,
    _build_chat_request,
    _chat_tool_calls_to_responses_output,
    _responses_non_streaming,
    _responses_stream,
)

for r in _openai_responses_router.routes:
    router.routes.append(r)


# =====================================================================
# Anthropic Messages API (Modularized in routes.inference_pkg)
# =====================================================================
from routes.inference_pkg.router_anthropic import (
    router as _anthropic_router,
    chat_count_tokens,
    anthropic_count_tokens,
    anthropic_messages,
    _anthropic_selects_server_tools,
    _anthropic_requested_studio_tools,
    _anthropic_tool_stream,
    _anthropic_plain_stream,
    _anthropic_tool_non_streaming,
    _anthropic_plain_non_streaming,
    _llama_compatible_tool_schema,
    _llama_compatible_tools,
    _build_passthrough_payload,
    _anthropic_passthrough_stream,
    _anthropic_passthrough_non_streaming,
)

for r in _anthropic_router.routes:
    router.routes.append(r)

# =====================================================================
# Client-side tool pass-through (OpenAI-native /v1/chat/completions)
# =====================================================================


def _normalize_local_assistant_message(message: dict) -> Optional[dict]:
    """Enforce the local backend's assistant-message wire contract.

    Bare assistant messages are Stop-button sentinels and must disappear.
    A reasoning-only completed turn is real history, but llama.cpp checks for a
    ``content`` or ``tool_calls`` key before reading ``reasoning_content``. Give
    that turn an empty content key without mutating the caller's dictionary.
    """
    if message.get("role") != "assistant":
        return message
    if message.get("content") or message.get("tool_calls"):
        return message
    if message.get("reasoning_content"):
        if message.get("content") == "":
            return message
        return {**message, "content": ""}
    return None


def _drop_empty_assistant_sentinels(messages: list[dict]) -> list[dict]:
    """Drop Stop-button sentinels and normalize reasoning-only turns."""
    out: list[dict] = []
    for message in messages:
        normalized = _normalize_local_assistant_message(message)
        if normalized is not None:
            out.append(normalized)
    return out


def _merge_user_content(a: Any, b: Any) -> Any:
    """Join two user ``content`` values: strings with a blank line, else as concatenated parts."""
    if isinstance(a, str) and isinstance(b, str):
        if not a:
            return b
        if not b:
            return a
        return a + "\n\n" + b

    def _parts(c: Any) -> list:
        if c is None:
            return []
        if isinstance(c, str):
            return [{"type": "text", "text": c}] if c else []
        if isinstance(c, list):
            return list(c)
        return [{"type": "text", "text": str(c)}]

    return _parts(a) + _parts(b)


def _coalesce_consecutive_user_turns(messages: list[dict]) -> list[dict]:
    """Merge adjacent user turns so the GGUF history stays alternating.

    Dropping an empty assistant turn (0-token reply or Stop-button sentinel) can
    leave two user turns in a row, which makes strict templates (Gemma 3, ...)
    raise "Conversation roles must alternate" -> llama-server 400. Only user turns
    merge (assistant/tool turns may carry tool_calls/tool_call_id); multimodal
    parts are preserved; no-op for already-alternating histories.
    """
    out: list[dict] = []
    for m in messages:
        if m.get("role") == "user" and out and out[-1].get("role") == "user":
            prev = dict(out[-1])
            prev["content"] = _merge_user_content(prev.get("content"), m.get("content"))
            out[-1] = prev
            continue
        out.append(m)
    return out


_LOCAL_SERVER_BUILTIN_TOOL_NAMES = frozenset(
    {"web_search", "web_fetch", "code_execution", "image_generation"}
)


def _merge_stranded_local_assistant_turns(messages: list[tuple[dict, bool]]) -> list[dict]:
    """Fold scrubbed provider-tool fragments into their visible answer.

    Removing a provider-synthetic call and its tool result can expose adjacent
    assistant messages that were one logical response. Strict local templates
    reject that role sequence. A small state machine carries a stranded fragment
    through any number of synthetic rounds, preserving text-part lists and
    reasoning oldest-first, until the next assistant message completes it.
    """
    out: list[dict] = []
    pending: Optional[dict] = None

    for message, message_is_stranded in messages:
        if pending is None:
            if message_is_stranded:
                pending = message
            else:
                out.append(message)
            continue

        if message.get("role") != "assistant":
            out.append(pending)
            pending = None
            out.append(message)
            continue

        merged = dict(message)
        old_content = pending.get("content")
        new_content = merged.get("content")
        if old_content or new_content:
            merged["content"] = _merge_user_content(old_content, new_content)

        old_reasoning = pending.get("reasoning_content")
        new_reasoning = merged.get("reasoning_content")
        reasoning_parts = [
            value for value in (old_reasoning, new_reasoning) if isinstance(value, str) and value
        ]
        if reasoning_parts:
            merged["reasoning_content"] = "\n\n".join(reasoning_parts)

        if message_is_stranded:
            pending = merged
        else:
            out.append(merged)
            pending = None

    if pending is not None:
        out.append(pending)
    return out


def _strip_provider_synthetic_tool_history(messages: list[dict]) -> list[dict]:
    """Drop synthetic provider-side tool_calls + matching role=tool replies on
    the local-backend (llama-server / GGUF) dispatch path.

    A Gemini chat that ran code_execution / image_generation persists the
    server-side tool card into history as an assistant tool_calls entry tagged
    with ``args._server_tool`` (or a Gemini ``args.google.native_part`` payload)
    plus a follow-up role=tool reply. When the user switches the SAME thread to
    a local GGUF model, those synthetic tool_calls aren't real user functions,
    llama-server has no matching declaration, and Gemini-only ``extra_content``
    / ``native_part`` payloads are meaningless. Forward only ordinary user
    function calls; strip the matched role=tool replies too so the backend never
    sees an orphan tool_call_id.
    """
    dropped_ids: set[str] = set()
    sanitized_assistant: list[tuple[dict, bool]] = []
    for m in messages:
        if m.get("role") != "assistant":
            sanitized_assistant.append((m, False))
            continue
        tool_calls = m.get("tool_calls")
        if not isinstance(tool_calls, list) or not tool_calls:
            # Plain text Gemini reply: still strip message-level
            # `extra_content` (carries `google.thought_signature` replay
            # metadata) so a text-only Gemini turn switched to a local GGUF
            # backend doesn't leak Gemini-only fields to llama-server.
            # ChatMessage didn't used to have `extra_content` (implicitly
            # dropped); round-22 added it, which made this leak possible.
            if "extra_content" in m:
                m = {k: v for k, v in m.items() if k != "extra_content"}
            sanitized_assistant.append((m, False))
            continue
        cleaned: list[dict] = []
        for tc in tool_calls:
            if not isinstance(tc, dict):
                cleaned.append(tc)
                continue
            fn = tc.get("function")
            name = ""
            if isinstance(fn, dict):
                name = (fn.get("name") or "").lower()
            if name in _LOCAL_SERVER_BUILTIN_TOOL_NAMES:
                raw_args = fn.get("arguments") if isinstance(fn, dict) else None
                args_obj: Any = None
                if isinstance(raw_args, str):
                    try:
                        args_obj = json.loads(raw_args) if raw_args else None
                    except Exception:
                        args_obj = None
                elif isinstance(raw_args, dict):
                    args_obj = raw_args
                is_synthetic = False
                if isinstance(args_obj, dict):
                    if args_obj.get("_server_tool") is True:
                        is_synthetic = True
                    google = args_obj.get("google")
                    if isinstance(google, dict) and isinstance(google.get("native_part"), dict):
                        is_synthetic = True
                if is_synthetic:
                    tc_id = tc.get("id")
                    if isinstance(tc_id, str) and tc_id:
                        dropped_ids.add(tc_id)
                    continue
            # Strip Gemini-only `extra_content` on real user tool_calls too --
            # llama-server has no use for it and may pass it to the model
            # unchanged.
            if "extra_content" in tc:
                tc = {k: v for k, v in tc.items() if k != "extra_content"}
            cleaned.append(tc)
        # Drop message-level `extra_content` (Gemini thoughtSignature replay
        # metadata) on local dispatch.
        m_clean = {k: v for k, v in m.items() if k != "extra_content"}
        if cleaned:
            m_clean["tool_calls"] = cleaned
        else:
            m_clean.pop("tool_calls", None)
        is_stranded = bool(m.get("tool_calls")) and not cleaned
        if (
            not m_clean.get("content")
            and not m_clean.get("reasoning_content")
            and not m_clean.get("tool_calls")
        ):
            continue  # assistant turn now empty, drop
        sanitized_assistant.append((m_clean, is_stranded))

    out: list[tuple[dict, bool]] = []
    for m, is_stranded in sanitized_assistant:
        if (
            m.get("role") == "tool"
            and isinstance(m.get("tool_call_id"), str)
            and m["tool_call_id"] in dropped_ids
        ):
            continue
        out.append((m, is_stranded))
    merged = _merge_stranded_local_assistant_turns(out)
    return _drop_empty_assistant_sentinels(merged)


def _splice_image_into_last_user(messages: list[dict], image_part: dict) -> None:
    """Splice an image content part into the last user message, in place.

    String content becomes a text part plus the image; an existing content-part
    list gets the image appended; any other shape is replaced by the lone image.
    With no user message present, a new user turn carrying the image is appended."""
    for msg in reversed(messages):
        if msg.get("role") != "user":
            continue
        existing = msg.get("content")
        if isinstance(existing, str):
            msg["content"] = [{"type": "text", "text": existing}, image_part]
        elif isinstance(existing, list):
            existing.append(image_part)
        else:
            msg["content"] = [image_part]
        break
    else:
        messages.append({"role": "user", "content": [image_part]})


def _openai_messages_for_passthrough(payload) -> list[dict]:
    """Build OpenAI-format message dicts for the /v1/chat/completions
    passthrough path.

    ``payload.messages`` are dumped through Pydantic (dropping unset optional
    fields), so they're already standard OpenAI format -- including
    ``role="tool"`` tool-result messages and assistant messages carrying
    structured ``tool_calls``. Content-parts images already in the list are
    left untouched.

    When a client uses Unsloth's legacy ``image_base64`` top-level field, the
    image is re-encoded to PNG (llama-server's stb_image has limited format
    support) and spliced into the last user message as an OpenAI ``image_url``
    content part so vision + function-calling requests work transparently.
    """
    messages = _strip_provider_synthetic_tool_history(
        _drop_empty_assistant_sentinels([m.model_dump(exclude_none = True) for m in payload.messages])
    )

    if not payload.image_base64:
        return messages

    try:
        raw = base64.b64decode(payload.image_base64)
        png_b64 = _image_bytes_to_png_b64(raw)
    except Exception:
        raise HTTPException(
            status_code = 400,
            detail = "Failed to process image.",
        )

    data_url = f"data:image/png;base64,{png_b64}"
    image_part = {"type": "image_url", "image_url": {"url": data_url}}

    _splice_image_into_last_user(messages, image_part)

    return messages


def _flatten_content_parts_for_local_template(messages: list[dict]) -> list[dict]:
    """Flatten OpenAI content-part lists to plain strings.

    Local text templates take string content and raise on part lists (e.g. a
    remote ``image_url`` that leaves ``image is None``): keep the text parts,
    drop the rest, like the plain non-GGUF path. GGUF keeps the parts."""
    out = []
    for msg in messages:
        content = msg.get("content")
        if isinstance(content, list):
            text_parts = [
                part.get("text", "")
                for part in content
                if isinstance(part, dict) and part.get("type") == "text"
            ]
            msg = {**msg, "content": "\n".join(text_parts) if text_parts else ""}
        out.append(msg)
    return out


def _structured_tool_history_for_local_template(messages: list[dict]) -> list[dict]:
    """Deserialize assistant ``tool_calls[].function.arguments`` JSON strings to
    mappings for local templating.

    Clients send prior-turn arguments as JSON strings, but local templates take
    mappings (some raise on strings). Only the internal messages copy is
    rewritten; the HTTP response stays OpenAI-shaped and unparseable strings
    are left untouched."""
    out = []
    for msg in messages:
        tool_calls = msg.get("tool_calls")
        if isinstance(tool_calls, list) and tool_calls:
            new_calls = []
            for tc in tool_calls:
                fn = tc.get("function") if isinstance(tc, dict) else None
                args = fn.get("arguments") if isinstance(fn, dict) else None
                if isinstance(args, str):
                    try:
                        parsed = json.loads(args)
                    except ValueError:
                        parsed = None
                    if isinstance(parsed, dict):
                        tc = {**tc, "function": {**fn, "arguments": parsed}}
                new_calls.append(tc)
            msg = {**msg, "tool_calls": new_calls}
        out.append(msg)
    return out


def _openai_messages_for_gguf_chat(payload, is_vision: bool) -> tuple[list[dict], bool]:
    """Build llama-server messages for the standard GGUF chat path.

    llama-server accepts OpenAI multimodal content parts directly. Preserve all
    per-turn ``image_url`` parts so multi-image chat history keeps each image
    attached to its original turn.
    """
    # Coalesce only on the GGUF chat path (strict Jinja template); the tool path
    # reuses this via _set_or_prepend_system_message. Passthrough forwards verbatim.
    messages = _coalesce_consecutive_user_turns(
        _strip_provider_synthetic_tool_history(
            _drop_empty_assistant_sentinels(
                [m.model_dump(exclude_none = True) for m in payload.messages]
            )
        )
    )
    has_message_image = any(
        isinstance(msg.get("content"), list)
        and any(part.get("type") == "image_url" for part in msg["content"])
        for msg in messages
    )
    if payload.image_base64 and not has_message_image:
        # Legacy bytes can be any format; the normalizer below sniffs and
        # re-encodes to PNG, so the declared mime is rewritten anyway.
        image_part = {
            "type": "image_url",
            "image_url": {
                "url": f"data:image/png;base64,{payload.image_base64}",
            },
        }
        _splice_image_into_last_user(messages, image_part)
    has_image = _normalize_anthropic_openai_images(messages, is_vision)
    return messages, has_image


async def _openai_messages_for_gguf_chat_async(payload, is_vision: bool) -> tuple[list[dict], bool]:
    if _request_has_image(payload):
        return await asyncio.to_thread(_openai_messages_for_gguf_chat, payload, is_vision)
    return _openai_messages_for_gguf_chat(payload, is_vision)


def _extract_response_format(payload):
    """Return the ``response_format`` field on an incoming ChatCompletionRequest
    (or None). The model uses ``extra="allow"`` so pydantic stashes unknown
    top-level fields in ``model_extra``; OpenAI-SDK clients spread ``extra_body``
    into the request body top level, where guided-decoding recipes park their
    JSON-schema response_format.
    """
    extra = getattr(payload, "model_extra", None)
    if not isinstance(extra, dict):
        return None
    rf = extra.get("response_format")
    return rf if isinstance(rf, dict) else None


def _build_openai_passthrough_body(
    payload,
    backend_ctx = None,
    llama_backend = None,
) -> dict:
    """Assemble the llama-server request body from a ChatCompletionRequest.

    Only known OpenAI / llama-server fields are forwarded, so Unsloth-specific
    extensions (``enable_tools``, ``enabled_tools``, ``session_id``, ...) never
    leak to the backend.
    """
    messages = _openai_messages_for_passthrough(payload)
    system_prompt, _, _ = _extract_content_parts(payload.messages)
    messages = _set_or_prepend_system_message(messages, system_prompt)
    # Markup is broken in _build_passthrough_payload, shared with both /v1/messages (#7066).
    tool_choice = payload.tool_choice if payload.tool_choice is not None else "auto"
    tools = _passthrough_client_tools(payload)
    # Forward per-request reasoning fields (enable_thinking / reasoning_effort /
    # preserve_thinking) via chat_template_kwargs so the Jinja template renders
    # in the caller's mode, gated on the active template's capabilities exactly
    # like the non-passthrough paths.
    tpl_kwargs = (
        llama_backend._request_reasoning_kwargs(
            payload.enable_thinking,
            payload.reasoning_effort,
            payload.preserve_thinking,
        )
        if llama_backend is not None
        else None
    )
    body = _build_passthrough_payload(
        messages,
        tools,
        payload.temperature,
        payload.top_p,
        payload.top_k,
        # Honor max_completion_tokens on the tools/response_format passthrough too.
        _effective_openai_max_tokens(payload),
        payload.stream,
        stop = payload.stop,
        min_p = payload.min_p,
        repetition_penalty = payload.repetition_penalty,
        presence_penalty = payload.presence_penalty,
        tool_choice = tool_choice,
        response_format = _extract_response_format(payload),
        chat_template_kwargs = tpl_kwargs,
        backend_ctx = backend_ctx,
        seed = payload.seed,
        stream_options = payload.stream_options,
        markup = getattr(llama_backend, "markup_profile", None),
    )
    if _continue_final_message(payload):
        # llama-server rejects both flags set true.
        body["continue_final_message"] = True
        body["add_generation_prompt"] = False
    return body


async def _build_openai_passthrough_body_async(
    payload,
    backend_ctx = None,
    llama_backend = None,
) -> dict:
    if _request_has_image(payload):
        return await asyncio.to_thread(
            _build_openai_passthrough_body,
            payload,
            backend_ctx = backend_ctx,
            llama_backend = llama_backend,
        )
    return _build_openai_passthrough_body(
        payload,
        backend_ctx = backend_ctx,
        llama_backend = llama_backend,
    )


async def _openai_passthrough_stream(
    request,
    cancel_event,
    llama_backend,
    payload,
    model_name,
    completion_id,
    monitor_id: Optional[str] = None,
):
    _cancel_keys = (payload.cancel_id, payload.session_id, completion_id)
    _tracker = _TrackedCancel.for_payload(cancel_event, payload, *_cancel_keys)
    _tracker.__enter__()
    try:
        reservation, admission_config = _openai_llama_admission_reserve(
            request = request,
            llama_backend = llama_backend,
        )
    except LlamaAdmissionQueueFull as exc:
        _tracker.__exit__(None, None, None)
        _llama_admission_log(
            "queue-full",
            snapshot = exc.snapshot,
            request = request,
            mode = "chat_passthrough_stream",
            completion_id = completion_id,
            level = "warning",
        )
        api_monitor.fail(monitor_id, str(exc))
        raise _openai_admission_http_exception(exc, status_code = 429)

    lease = reservation.lease_nowait()
    if lease is not None:
        try:
            await _raise_if_openai_admission_cancelled(
                reservation,
                request = request,
                cancel_event = cancel_event,
            )
        except asyncio.CancelledError:
            api_monitor.finish(monitor_id, "cancelled")
            lease.release()
            _tracker.__exit__(None, None, None)
            raise
        except LlamaAdmissionCancelled as exc:
            lease.release()
            _tracker.__exit__(None, None, None)
            api_monitor.finish(monitor_id, "cancelled")
            raise HTTPException(
                status_code = 499,
                detail = _openai_admission_error_body(exc, status_code = 499),
            )
        return await _openai_passthrough_stream_admitted(
            request,
            cancel_event,
            llama_backend,
            payload,
            model_name,
            completion_id,
            monitor_id = monitor_id,
            admission_lease = lease,
            tracker = _tracker,
        )

    admission_wait_started_at = time.monotonic()
    _llama_admission_log(
        "queued",
        reservation,
        request = request,
        mode = "chat_passthrough_stream",
        completion_id = completion_id,
        level = "debug",
    )

    async def _queued_stream():
        admitted_started = False
        admitted_body_owns_cleanup = False
        admitted_response = None
        admitted_body_cancelled = False
        try:
            async for wait_item in _openai_admission_wait_stream_chunks(
                reservation,
                admission_config,
                request = request,
                cancel_event = cancel_event,
            ):
                if isinstance(wait_item, str):
                    yield wait_item
                    continue
                _llama_admission_log(
                    "granted-after-wait",
                    reservation,
                    request = request,
                    mode = "chat_passthrough_stream",
                    wait_started_at = admission_wait_started_at,
                    completion_id = completion_id,
                    level = "debug",
                )
                await _raise_if_openai_admission_cancelled(
                    reservation,
                    request = request,
                    cancel_event = cancel_event,
                )
                admitted_response = await _openai_passthrough_stream_admitted(
                    request,
                    cancel_event,
                    llama_backend,
                    payload,
                    model_name,
                    completion_id,
                    monitor_id = monitor_id,
                    admission_lease = wait_item,
                    tracker = _tracker,
                )
                admitted_started = True
                iterator = admitted_response.body_iterator
                admitted_body_owns_cleanup = True
                try:
                    async for chunk in iterator:
                        yield chunk
                except asyncio.CancelledError:
                    admitted_body_cancelled = True
                    raise
                finally:
                    await _close_openai_admitted_stream_iterator(
                        iterator,
                        cancelled = admitted_body_cancelled,
                    )
                    if not admitted_body_owns_cleanup:
                        cleanup = getattr(admitted_response, "_unstarted_cleanup", None)
                        if cleanup is not None:
                            await cleanup()
                return
        except LlamaAdmissionTimeout as exc:
            _llama_admission_log(
                "timeout",
                reservation,
                request = request,
                mode = "chat_passthrough_stream",
                wait_started_at = admission_wait_started_at,
                completion_id = completion_id,
                level = "warning",
            )
            api_monitor.fail(monitor_id, str(exc))
            yield _openai_stream_error_sse(_openai_admission_error_body(exc, status_code = 503))
        except LlamaAdmissionCancelled:
            _llama_admission_log(
                "cancelled-before-upstream",
                reservation,
                request = request,
                mode = "chat_passthrough_stream",
                wait_started_at = admission_wait_started_at,
                completion_id = completion_id,
                level = "debug",
            )
            api_monitor.finish(monitor_id, "cancelled")
            return
        except asyncio.CancelledError:
            api_monitor.finish(monitor_id, "cancelled")
            raise
        except HTTPException as exc:
            status_code = getattr(exc, "status_code", 500) or 500
            detail = exc.detail
            error = (
                detail
                if isinstance(detail, dict) and "error" in detail
                else openai_error_body(str(detail), status = status_code)
            )
            api_monitor.fail(monitor_id, str(detail))
            yield _openai_stream_error_sse(error)
        finally:
            if not admitted_started:
                api_monitor.finish(monitor_id, "cancelled")
                reservation.cancel()
                _tracker.__exit__(None, None, None)

    async def _queued_unstarted_cleanup() -> None:
        api_monitor.finish(monitor_id, "cancelled")
        reservation.cancel()
        _tracker.__exit__(None, None, None)

    return _SameTaskStreamingResponse(
        _queued_stream(),
        media_type = "text/event-stream",
        headers = {
            "Cache-Control": "no-cache",
            "Connection": "close",
            "X-Accel-Buffering": "no",
        },
        unstarted_cleanup = _queued_unstarted_cleanup,
    )


async def _openai_passthrough_stream_admitted(
    request,
    cancel_event,
    llama_backend,
    payload,
    model_name,
    completion_id,
    monitor_id: Optional[str] = None,
    *,
    admission_lease: LlamaAdmissionLease,
    tracker,
):
    """Streaming client-side pass-through after Unsloth granted an upstream slot.

    Forwards the client's OpenAI function-calling request to llama-server and
    relays the SSE stream back with minimal normalization (reasoning-only
    deltas gain ``content: ""``; errors and missing terminal markers get a
    closing ``[DONE]``), preserving llama-server's native response ``id``,
    ``finish_reason`` (including ``"tool_calls"``), ``delta.tool_calls``, and
    any client-requested trailing ``usage`` chunk so the client sees a
    standard OpenAI response.

    Reasoning/tool-call splitting is delegated to llama-server (``--jinja
    --reasoning-format auto``), so ``delta.content`` carries no raw markup and is
    deliberately not re-parsed locally, unlike the ``/completion`` paths.
    """
    _tracker = tracker
    target_url = f"{llama_backend.base_url}/v1/chat/completions"
    upstream_headers = _openai_passthrough_upstream_headers(llama_backend = llama_backend)

    client = None
    resp = None
    send_task: Optional[asyncio.Task[Optional[httpx.Response]]] = None

    async def _aclose_send_task(task: Optional[asyncio.Task[Optional[httpx.Response]]]) -> None:
        if task is None:
            return
        if not task.done():
            task.cancel()
        # Bounded: the send polls Request.is_disconnected() before dispatch, which can
        # swallow cancel(). Abandoning it is safe because the caller closes the per-request
        # client right after, tearing down whatever response it later produces. #7617
        done, _pending = await asyncio.wait({task}, timeout = _TEARDOWN_TASK_STOP_TIMEOUT_S)
        if not done:
            task.add_done_callback(_discard_task_outcome)
            return
        try:
            task_resp = task.result()
            if task_resp is not None:
                try:
                    await task_resp.aclose()
                except Exception:
                    pass
        except (asyncio.CancelledError, Exception):
            pass

    # Keep tracker cleanup paired if pre-header dispatch is cancelled.
    try:
        body = await _build_openai_passthrough_body_async(
            payload, backend_ctx = llama_backend.context_length, llama_backend = llama_backend
        )
        # Text-form tool calls from small models get promoted to structured calls on
        # the way back (declared client tools only); requests without tools or with
        # auto_heal_tool_calls=false keep the unhealed relay. tool_choice constrains
        # the allowlist ("none" disables, a forced function narrows to it).
        _allowed_tools = heal_gate(
            payload.auto_heal_tool_calls, body.get("tools"), body.get("tool_choice")
        )

        # Keep the pre-header window short so accepted SSE clients receive
        # immediate headers in the common timeout-reduced stall.
        client = httpx.AsyncClient(
            timeout = _llama_streaming_generation_timeout(),
            limits = httpx.Limits(max_keepalive_connections = 0),
            trust_env = False,
        )
        _truncate_budget = (
            _OVERFLOW_TRUNCATE_MAX_RETRIES if _overflow_truncation_requested(payload) else 0
        )
        # One respawn per request: a second unreachable upstream after a successful
        # relaunch is a real failure, not a stale port.
        _respawn_retried = False

        while True:
            try:
                req = client.build_request("POST", target_url, json = body, headers = upstream_headers)
                first_token_deadline = time.monotonic() + _DEFAULT_FIRST_TOKEN_TIMEOUT_S
                send_task = asyncio.create_task(
                    _send_stream_with_preheader_cancel(
                        client,
                        req,
                        cancel_event,
                        request = request,
                        mark_cancel_on_cancel = False,
                    )
                )
                done, _ = await asyncio.wait(
                    {send_task},
                    timeout = _OPENAI_PASSTHROUGH_PREHEADER_STATUS_WINDOW_S,
                    return_when = asyncio.FIRST_COMPLETED,
                )
                if send_task not in done:
                    break

                # Dispatch returned quickly enough to preserve pre-header status.
                resp = await send_task
                send_task = None
            except httpx.RequestError as e:
                # llama-server subprocess crashed / starting / unreachable. Nothing has
                # streamed yet, so a respawned server can be retried once on its new
                # ephemeral port without duplicating output, exactly as /v1/messages does.
                # Without this an OpenAI-API client stays broken until the next explicit
                # load, while an Anthropic-API client on the same backend recovers itself.
                if not _respawn_retried and _is_lost_upstream_connection(e):
                    _respawn_retried = True
                    retry_url = await _passthrough_retry_url(llama_backend, e)
                    if retry_url is not None:
                        closed = False
                        try:
                            await _aclose_send_task(send_task)
                            closed = True
                        finally:
                            # Only a retry that is actually going upstream keeps the slot.
                            if not closed:
                                _release_admission(admission_lease, _tracker)
                        send_task = None
                        target_url = retry_url
                        # The relaunch minted a fresh --api-key, so the pre-crash
                        # Authorization header would come back 401.
                        upstream_headers = _openai_passthrough_upstream_headers(
                            llama_backend = llama_backend
                        )
                        continue
                logger.error("openai passthrough stream: upstream unreachable: %s", e)
                api_monitor.fail(monitor_id, _friendly_error(e))
                # Nested so a cancel inside _aclose_send_task's wait cannot skip the closes.
                # The outer handler releases too, but _release_admission is idempotent.
                try:
                    await _aclose_send_task(send_task)
                finally:
                    try:
                        await _aclose_stream_resources(resp = resp, client = client)
                    finally:
                        _release_admission(admission_lease, _tracker)
                raise HTTPException(
                    status_code = 502,
                    detail = _friendly_error(e),
                )
            if resp is None and send_task is not None and not send_task.done():
                break
            if resp is None:
                if cancel_event is not None:
                    cancel_event.set()
                api_monitor.finish(monitor_id, "cancelled")
                try:
                    await _aclose_send_task(send_task)
                finally:
                    try:
                        await _aclose_stream_resources(client = client)
                    finally:
                        _release_admission(admission_lease, _tracker)
                return _SameTaskStreamingResponse(
                    iter(()),
                    media_type = "text/event-stream",
                    headers = {
                        "Cache-Control": "no-cache",
                        "Connection": "keep-alive",
                        "X-Accel-Buffering": "no",
                    },
                )

            if resp.status_code == 200:
                break
            err_bytes = await resp.aread()
            err_text = err_bytes.decode("utf-8", errors = "replace")
            logger.error(
                "openai passthrough upstream error: status=%s body=%s",
                resp.status_code,
                err_text[:500],
            )
            upstream_status = resp.status_code
            try:
                await resp.aclose()
            except Exception:
                pass
            resp = None
            # Opt-in overflow policy: shrink and retry instead of a fatal 400.
            if (
                _truncate_budget > 0
                and _classify_llama_generation_error(Exception(err_text))
                and _apply_overflow_truncation(body, err_text)
            ):
                _truncate_budget -= 1
                continue
            try:
                await client.aclose()
            except Exception:
                pass
            api_monitor.fail(monitor_id, err_text[:500])
            raise _openai_passthrough_error(upstream_status, err_text)

        # Keep tracker cleanup paired if pre-header dispatch is cancelled after we
        # have already committed headers.
        async def _stream():
            # Same httpx lifecycle pattern as _anthropic_passthrough_stream:
            # save resp.aiter_lines() so the finally block can aclose() it on
            # our task. See that function for full rationale.
            lines_iter = None
            # Watchers unblock aiter_lines() during prefill, before in-loop
            # cancel/disconnect checks can run.
            cancel_watcher = None
            disconnect_watcher = None

            nonlocal resp, send_task, first_token_deadline, _truncate_budget
            nonlocal client, target_url, upstream_headers, _respawn_retried
            monitor_done = False
            saw_finish_reason = False
            saw_done = False
            saw_stream_error = False
            saw_stream_item = False
            saw_tool_call_delta = False
            terminal_seen = False
            last_chunk_id = completion_id
            last_chunk_model = model_name
            last_chunk_created = int(time.time())
            healer = (
                StreamToolCallHealer(_allowed_tools, body.get("tools")) if _allowed_tools else None
            )
            healed_call_index = 0

            def _synthetic_finish_line() -> str:
                healed = healer is not None and healer.healed
                finish_reason = "tool_calls" if (saw_tool_call_delta or healed) else "stop"
                chunk = ChatCompletionChunk(
                    id = last_chunk_id,
                    created = last_chunk_created,
                    model = last_chunk_model,
                    choices = [
                        ChunkChoice(
                            delta = ChoiceDelta(),
                            finish_reason = finish_reason,
                        )
                    ],
                )
                return f"data: {chunk.model_dump_json(exclude_none = True)}"

            def _healer_sse_lines(events) -> list:
                # Serialize healer events as chunks matching the upstream stream's
                # id/model/created so clients see one coherent completion.
                nonlocal healed_call_index
                lines = []
                for kind, value in events:
                    if kind == "text":
                        if not value:
                            continue
                        delta = {"content": value}
                    else:
                        # parallel_tool_calls=false caps healed calls too (the SSE
                        # line cap only sees structured upstream deltas).
                        if payload.parallel_tool_calls is False and healed_call_index >= 1:
                            continue
                        delta = {
                            "tool_calls": [
                                {
                                    "index": healed_call_index,
                                    "id": value["id"],
                                    "type": "function",
                                    "function": value["function"],
                                }
                            ]
                        }
                        healed_call_index += 1
                    chunk = {
                        "id": last_chunk_id,
                        "object": "chat.completion.chunk",
                        "created": last_chunk_created,
                        "model": last_chunk_model,
                        "choices": [{"index": 0, "delta": delta, "finish_reason": None}],
                    }
                    lines.append("data: " + json.dumps(chunk, ensure_ascii = False))
                return lines

            stall_timeout_s = _openai_compat_stream_stall_timeout()

            def _terminal_read_timeout_s() -> Optional[float]:
                if terminal_seen:
                    return _OPENAI_PASSTHROUGH_TERMINAL_GRACE_S
                return stall_timeout_s

            def _heal_transform(chunk_data: dict, raw_line: str) -> list:
                """SSE lines to emit in place of one upstream line (healing on)."""
                choices = chunk_data.get("choices")
                if not (isinstance(choices, list) and choices and isinstance(choices[0], dict)):
                    return [raw_line]
                choice = choices[0]
                delta = choice.get("delta")
                delta = delta if isinstance(delta, dict) else {}
                if delta.get("tool_calls"):
                    # Structured call streamed: grammar mode worked. Flush any held
                    # text (it preceded the call) and relay verbatim from here on.
                    lines = _healer_sse_lines(healer.structured_tool_call_seen())
                    if healed_call_index:
                        if payload.parallel_tool_calls is False:
                            # A healed call already consumed the single allowed
                            # slot; the upstream SSE cap keeps native index 0, so
                            # drop the native call here or the client gets two.
                            del delta["tool_calls"]
                            if delta or choice.get("finish_reason") or chunk_data.get("usage"):
                                lines.append("data: " + json.dumps(chunk_data, ensure_ascii = False))
                            return lines
                        # A healed call already went out on index 0..n-1; OpenAI
                        # clients merge tool-call deltas by index, so shift the
                        # native calls into the next indexes or they would merge
                        # into the healed call.
                        for tc in delta["tool_calls"]:
                            if isinstance(tc, dict) and isinstance(tc.get("index"), int):
                                tc["index"] += healed_call_index
                        return lines + ["data: " + json.dumps(chunk_data, ensure_ascii = False)]
                    return lines + [raw_line]
                content = delta.get("content")
                finish = choice.get("finish_reason")
                if not isinstance(content, str) or not content:
                    if not finish:
                        return [raw_line]
                    # Finish chunk: last-chance heal of the residue, and rewrite a
                    # "stop" into "tool_calls" when text-form calls were promoted.
                    lines = _healer_sse_lines(healer.finalize())
                    if healer.healed and finish == "stop":
                        choice["finish_reason"] = "tool_calls"
                        return lines + ["data: " + json.dumps(chunk_data, ensure_ascii = False)]
                    return lines + [raw_line]
                events = healer.feed(content)
                if finish:
                    events += healer.finalize()
                if not finish and events == [("text", content)]:
                    # Nothing held or promoted: the healer passed the chunk
                    # through whole, so keep the verbatim upstream bytes.
                    return [raw_line]
                del delta["content"]
                prefix_lines = []
                if delta:
                    prefix_chunk = {k: v for k, v in chunk_data.items() if k != "usage"}
                    prefix_choice = dict(choice)
                    prefix_choice["delta"] = dict(delta)
                    prefix_choice["finish_reason"] = None
                    prefix_chunk["choices"] = [prefix_choice]
                    prefix_lines.append("data: " + json.dumps(prefix_chunk, ensure_ascii = False))
                    delta.clear()
                lines = prefix_lines + _healer_sse_lines(events)
                if delta or finish or chunk_data.get("usage"):
                    if healer.healed and finish == "stop":
                        choice["finish_reason"] = "tool_calls"
                    lines.append("data: " + json.dumps(chunk_data, ensure_ascii = False))
                return lines

            try:
                while True:
                    if send_task is not None:
                        last_keepalive_at = time.monotonic()
                        while not send_task.done():
                            # Wake often enough that _preheader_cancelled keeps
                            # cancel/disconnect latency sub-second during prefill;
                            # keepalives still pace off last_keepalive_at.
                            wait_timeout = min(
                                _STREAM_DISCONNECT_POLL_TIMEOUT_S,
                                _OPENAI_PASSTHROUGH_PENDING_RESPONSE_KEEPALIVE_S,
                            )
                            done, _ = await asyncio.wait(
                                {send_task},
                                timeout = wait_timeout,
                                return_when = asyncio.FIRST_COMPLETED,
                            )
                            if send_task in done:
                                break
                            if await _preheader_cancelled(cancel_event, request):
                                api_monitor.finish(monitor_id, "cancelled")
                                return
                            # The downstream SSE response is already committed;
                            # keep strict clients and proxies from treating a long
                            # llama-server prefill/header wait as a dead stream.
                            now = time.monotonic()
                            if (
                                now - last_keepalive_at
                                >= _OPENAI_PASSTHROUGH_PENDING_RESPONSE_KEEPALIVE_S
                            ):
                                last_keepalive_at = now
                                yield _OPENAI_PASSTHROUGH_SSE_KEEPALIVE
                        if resp is None:
                            try:
                                resp = send_task.result()
                            except httpx.RequestError as e:
                                # A crash while the request sat queued or prefilling lands
                                # here, not in the pre-header handler: the 100 ms status
                                # window closed long ago. Only SSE comments have been
                                # emitted, so the same one-shot, connection-failure-only
                                # recovery applies without duplicating model output.
                                if not _respawn_retried and _is_lost_upstream_connection(e):
                                    _respawn_retried = True
                                    # The respawn replays a full load_model, which for a large
                                    # GGUF outlasts by minutes the five second silence this
                                    # very loop already treats as too long for a committed SSE
                                    # response. Awaiting it inline would stop both keepalives
                                    # and disconnect polling for the whole reload, so the
                                    # client or proxy can drop the stream before the recovered
                                    # request is ever submitted. Pump the same loop instead.
                                    retry_task = asyncio.create_task(
                                        _passthrough_retry_url(llama_backend, e)
                                    )
                                    respawn_cancelled = False
                                    last_keepalive_at = time.monotonic()
                                    while not retry_task.done():
                                        done, _ = await asyncio.wait(
                                            {retry_task},
                                            timeout = min(
                                                _STREAM_DISCONNECT_POLL_TIMEOUT_S,
                                                _OPENAI_PASSTHROUGH_PENDING_RESPONSE_KEEPALIVE_S,
                                            ),
                                            return_when = asyncio.FIRST_COMPLETED,
                                        )
                                        if retry_task in done:
                                            break
                                        if await _preheader_cancelled(cancel_event, request):
                                            respawn_cancelled = True
                                            break
                                        now = time.monotonic()
                                        if (
                                            now - last_keepalive_at
                                            >= _OPENAI_PASSTHROUGH_PENDING_RESPONSE_KEEPALIVE_S
                                        ):
                                            last_keepalive_at = now
                                            yield _OPENAI_PASSTHROUGH_SSE_KEEPALIVE
                                    if respawn_cancelled:
                                        # The reload runs in a worker thread that cancel()
                                        # cannot interrupt, and it is serialised and
                                        # idempotent, so let it finish and drop its URL
                                        # rather than leave the outcome unretrieved.
                                        retry_task.add_done_callback(_discard_task_outcome)
                                        api_monitor.finish(monitor_id, "cancelled")
                                        return
                                    retry_url = retry_task.result()
                                    if retry_url is not None:
                                        target_url = retry_url
                                        upstream_headers = _openai_passthrough_upstream_headers(
                                            llama_backend = llama_backend
                                        )
                                        send_task = asyncio.create_task(
                                            _send_stream_with_preheader_cancel(
                                                client,
                                                client.build_request(
                                                    "POST",
                                                    target_url,
                                                    json = body,
                                                    headers = upstream_headers,
                                                ),
                                                cancel_event,
                                                request = request,
                                                mark_cancel_on_cancel = False,
                                            )
                                        )
                                        first_token_deadline = (
                                            time.monotonic() + _DEFAULT_FIRST_TOKEN_TIMEOUT_S
                                        )
                                        continue
                                logger.error(
                                    "openai passthrough stream: upstream unreachable: %s", e
                                )
                                api_monitor.fail(monitor_id, _friendly_error(e))
                                yield _openai_stream_error_sse(_openai_stream_error_chunk(e))
                                return
                            send_task = None

                    if resp is None:
                        api_monitor.finish(monitor_id, "cancelled")
                        return
                    if resp.status_code == 200:
                        break

                    err_bytes = await resp.aread()
                    err_text = err_bytes.decode("utf-8", errors = "replace")
                    logger.error(
                        "openai passthrough upstream error: status=%s body=%s",
                        resp.status_code,
                        err_text[:500],
                    )
                    upstream_status = resp.status_code
                    try:
                        await resp.aclose()
                    except Exception:
                        pass
                    resp = None
                    if (
                        _truncate_budget > 0
                        and _classify_llama_generation_error(Exception(err_text))
                        and _apply_overflow_truncation(body, err_text)
                    ):
                        _truncate_budget -= 1
                        req = client.build_request(
                            "POST", target_url, json = body, headers = upstream_headers
                        )
                        first_token_deadline = time.monotonic() + _DEFAULT_FIRST_TOKEN_TIMEOUT_S
                        send_task = asyncio.create_task(
                            _send_stream_with_preheader_cancel(
                                client,
                                req,
                                cancel_event,
                                request = request,
                                mark_cancel_on_cancel = False,
                            )
                        )
                        continue

                    upstream_error = _openai_passthrough_error(upstream_status, err_text)
                    error_payload = (
                        upstream_error.detail
                        if isinstance(upstream_error.detail, dict)
                        else openai_error_body(
                            str(upstream_error.detail),
                            status = upstream_status,
                        )
                    )
                    api_monitor.fail(monitor_id, err_text[:500])
                    yield _openai_stream_error_sse(error_payload)
                    return

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
                    post_first_item_read_timeout_s = _terminal_read_timeout_s,
                ):
                    if not raw_line:
                        continue
                    if not raw_line.startswith("data:"):
                        continue
                    saw_stream_item = True
                    data_text = raw_line[5:].strip()
                    if data_text == "[DONE]":
                        saw_done = True
                        # Upstream ended without a finish chunk: heal the residue
                        # first so the synthetic finish sees healer.healed.
                        if healer is not None and not saw_stream_error:
                            for held_line in _healer_sse_lines(healer.finalize()):
                                _monitor_openai_sse_line(
                                    monitor_id, held_line, llama_backend.context_length
                                )
                                yield held_line + "\n\n"
                        if (
                            not saw_finish_reason
                            and not saw_stream_error
                            and not cancel_event.is_set()
                        ):
                            finish_line = _synthetic_finish_line()
                            _monitor_openai_sse_line(
                                monitor_id,
                                finish_line,
                                llama_backend.context_length,
                            )
                            yield finish_line + "\n\n"
                            saw_finish_reason = True
                        _monitor_openai_sse_line(
                            monitor_id,
                            raw_line,
                            llama_backend.context_length,
                        )
                        yield raw_line + "\n\n"
                        monitor_done = True
                        break
                    raw_line = _normalize_openai_passthrough_sse_line(
                        raw_line,
                        cap_parallel_tool_calls = payload.parallel_tool_calls is False,
                    )
                    data_text = raw_line[5:].strip()
                    try:
                        chunk_data = json.loads(data_text)
                    except json.JSONDecodeError:
                        chunk_data = None
                    if isinstance(chunk_data, dict):
                        if isinstance(chunk_data.get("id"), str):
                            last_chunk_id = chunk_data["id"]
                        if isinstance(chunk_data.get("model"), str):
                            last_chunk_model = chunk_data["model"]
                        if isinstance(chunk_data.get("created"), int):
                            last_chunk_created = chunk_data["created"]
                        choices = chunk_data.get("choices")
                        if isinstance(choices, list) and choices:
                            choice = choices[0]
                            if isinstance(choice, dict):
                                if choice.get("finish_reason"):
                                    saw_finish_reason = True
                                delta = choice.get("delta")
                                if isinstance(delta, dict) and delta.get("tool_calls"):
                                    saw_tool_call_delta = True
                        # Detect an error chunk independently of API monitoring
                        # (skip_api_monitor returns early), else the synthetic
                        # finish would fire after a failed stream.
                        if _monitor_openai_error_message(chunk_data):
                            saw_stream_error = True
                    # With healing active, a content-bearing line may be replaced by
                    # held/promoted chunks; otherwise the single (already
                    # normalized) line relays unchanged (monitored exactly as
                    # emitted either way).
                    if (
                        healer is not None
                        and not healer.dormant
                        and isinstance(chunk_data, dict)
                        and not saw_stream_error
                    ):
                        out_lines = _heal_transform(chunk_data, raw_line)
                    else:
                        out_lines = [raw_line]
                    # If a trailing usage-only chunk (include_usage) arrives before
                    # any finish chunk, emit the synthetic finish first so the order
                    # stays finish -> usage -> [DONE], matching the other streams.
                    if (
                        isinstance(chunk_data, dict)
                        and chunk_data.get("usage")
                        and not (
                            isinstance(chunk_data.get("choices"), list) and chunk_data["choices"]
                        )
                        and not saw_finish_reason
                        and not saw_stream_error
                        and not cancel_event.is_set()
                    ):
                        if healer is not None:
                            # Residue must precede the finish it may upgrade.
                            held = _healer_sse_lines(healer.finalize())
                            for held_line in held:
                                _monitor_openai_sse_line(
                                    monitor_id, held_line, llama_backend.context_length
                                )
                                yield held_line + "\n\n"
                        finish_line = _synthetic_finish_line()
                        _monitor_openai_sse_line(
                            monitor_id, finish_line, llama_backend.context_length
                        )
                        yield finish_line + "\n\n"
                        saw_finish_reason = True
                    for out_line in out_lines:
                        monitor_event = _monitor_openai_sse_line(
                            monitor_id,
                            out_line,
                            llama_backend.context_length,
                        )
                        if monitor_event == "error":
                            saw_stream_error = True
                        # Relay to preserve llama-server's native id,
                        # finish_reason, delta.tool_calls, and usage chunks.
                        yield out_line + "\n\n"
                        if monitor_event == "done":
                            monitor_done = True
                            break
                        terminal_state = (
                            _openai_passthrough_terminal_state_from_data(chunk_data)
                            if out_line is raw_line
                            else _openai_passthrough_sse_line_terminal_state(out_line)
                        )
                        if terminal_state == "usage" or (
                            terminal_state == "finish" and not _wants_stream_usage(payload)
                        ):
                            done_line = _SSE_DONE_LINE
                            _monitor_openai_sse_line(
                                monitor_id,
                                done_line,
                                llama_backend.context_length,
                            )
                            yield done_line + "\n\n"
                            saw_done = True
                            monitor_done = True
                            break
                        if terminal_state == "finish":
                            terminal_seen = True
                    if monitor_done:
                        break
                if not saw_done and not saw_stream_error and not cancel_event.is_set():
                    # Synthesize a finish chunk only if one was not already
                    # emitted (e.g. before a trailing usage-only chunk), but
                    # always close with [DONE] whenever the upstream omitted it,
                    # so the stream ends on the [DONE] sentinel either way.
                    if healer is not None:
                        for held_line in _healer_sse_lines(healer.finalize()):
                            _monitor_openai_sse_line(
                                monitor_id, held_line, llama_backend.context_length
                            )
                            yield held_line + "\n\n"
                    if not saw_finish_reason:
                        finish_line = _synthetic_finish_line()
                        _monitor_openai_sse_line(
                            monitor_id,
                            finish_line,
                            llama_backend.context_length,
                        )
                        yield finish_line + "\n\n"
                    done_line = _SSE_DONE_LINE
                    _monitor_openai_sse_line(
                        monitor_id,
                        done_line,
                        llama_backend.context_length,
                    )
                    yield done_line + "\n\n"
                    monitor_done = True
                if not monitor_done:
                    api_monitor.finish(
                        monitor_id,
                        "cancelled" if cancel_event.is_set() else "completed",
                    )
            except asyncio.CancelledError:
                api_monitor.finish(monitor_id, "cancelled")
                raise
            except httpx.ReadTimeout as e:
                if terminal_seen and not saw_stream_error and not cancel_event.is_set():
                    done_line = _SSE_DONE_LINE
                    _monitor_openai_sse_line(
                        monitor_id,
                        done_line,
                        llama_backend.context_length,
                    )
                    yield done_line + "\n\n"
                    api_monitor.finish(monitor_id)
                    return
                if cancel_event.is_set():
                    api_monitor.finish(monitor_id, "cancelled")
                    return
                logger.error(
                    "openai passthrough stream %s: %s",
                    "stalled mid-response" if saw_stream_item else "timeout",
                    e,
                )
                api_monitor.fail(monitor_id, _friendly_error(e))
                get_llama_cpp_backend()._maybe_recover_from_mtp_crash(e)
                err = _openai_stream_error_chunk(e)
                yield _openai_stream_error_sse(err)
            except (httpx.RemoteProtocolError, httpx.ReadError, httpx.CloseError) as e:
                # Watcher closed resp on cancel. Emit nothing extra; the client
                # initiated the cancel or already disconnected.
                if not cancel_event.is_set():
                    api_monitor.fail(monitor_id, "Stream interrupted")
                    get_llama_cpp_backend()._maybe_recover_from_mtp_crash(e)
                    raise
                api_monitor.finish(monitor_id, "cancelled")
            except HTTPException as exc:
                status_code = getattr(exc, "status_code", 500) or 500
                detail = exc.detail
                error_payload = (
                    detail
                    if isinstance(detail, dict) and "error" in detail
                    else openai_error_body(str(detail), status = status_code)
                )
                api_monitor.fail(monitor_id, str(detail))
                yield _openai_stream_error_sse(error_payload)
            except Exception as e:
                if cancel_event.is_set():
                    api_monitor.finish(monitor_id, "cancelled")
                    return
                # 200 headers already flushed; errors must go in the SSE body.
                logger.error("openai passthrough stream error: %s", e)
                api_monitor.fail(monitor_id, _friendly_error(e))
                get_llama_cpp_backend()._maybe_recover_from_mtp_crash(e)
                err = _openai_stream_error_chunk(e)
                yield _openai_stream_error_sse(err)
            finally:
                # Close the upstream stream first: on disconnect llama-server keeps decoding
                # until resp is closed, so releasing the slot earlier admits a second request
                # past --parallel. Safe to hold the slot across these closes because every
                # task await in them is bounded, and the aclose() calls do not block on
                # HTTP/1.1 to a local llama-server. #7617
                try:
                    await _aclose_send_task(send_task)
                finally:
                    try:
                        await _aclose_stream_resources(
                            watchers = (cancel_watcher, disconnect_watcher),
                            iterator = lines_iter,
                            resp = resp,
                            client = client,
                        )
                    finally:
                        _release_admission(admission_lease, _tracker)

        async def _unstarted_cleanup() -> None:
            # Client disconnected before the body stream started, so _stream()'s
            # finally never ran. Release the eagerly-opened upstream resp/client
            # and the cancel-registry entry here; the watchers and line iterator
            # are created inside _stream(), so there is nothing else to close.
            try:
                await _aclose_send_task(send_task)
            finally:
                try:
                    await _aclose_stream_resources(resp = resp, client = client)
                finally:
                    _release_admission(admission_lease, _tracker)

        return _SameTaskStreamingResponse(
            _stream(),
            media_type = "text/event-stream",
            headers = {
                "Cache-Control": "no-cache",
                "Connection": "close",
                "X-Accel-Buffering": "no",
            },
            unstarted_cleanup = _unstarted_cleanup,
        )
    except BaseException as exc:
        if isinstance(exc, asyncio.CancelledError):
            if cancel_event is not None:
                cancel_event.set()
            api_monitor.finish(monitor_id, "cancelled")
        else:
            detail = exc.detail if isinstance(exc, HTTPException) else _friendly_error(exc)
            api_monitor.fail(monitor_id, str(detail))
        try:
            await _aclose_send_task(send_task)
        finally:
            try:
                await _aclose_stream_resources(resp = resp, client = client)
            finally:
                _release_admission(admission_lease, _tracker)
        raise


async def _openai_passthrough_non_streaming(
    llama_backend,
    payload,
    model_name,
    monitor_id: Optional[str] = None,
    *,
    request: Optional[Request] = None,
    cancel_event = None,
):
    """Non-streaming pass-through guarded by local llama-server admission."""
    try:
        reservation, admission_config = _openai_llama_admission_reserve(
            request = request,
            llama_backend = llama_backend,
        )
    except LlamaAdmissionQueueFull as exc:
        _llama_admission_log(
            "queue-full",
            snapshot = exc.snapshot,
            request = request,
            mode = "chat_passthrough_nonstream",
            level = "warning",
        )
        api_monitor.fail(monitor_id, str(exc))
        raise _openai_admission_http_exception(exc, status_code = 429)

    lease = None
    admission_wait_started_at = None
    try:
        if reservation.lease_nowait() is None:
            admission_wait_started_at = time.monotonic()
            _llama_admission_log(
                "queued",
                reservation,
                request = request,
                mode = "chat_passthrough_nonstream",
                level = "debug",
            )
        lease = await _wait_for_openai_admission_non_streaming(
            reservation,
            admission_config,
            request = request,
            cancel_event = cancel_event,
        )
        if admission_wait_started_at is not None:
            _llama_admission_log(
                "granted-after-wait",
                reservation,
                request = request,
                mode = "chat_passthrough_nonstream",
                wait_started_at = admission_wait_started_at,
                level = "debug",
            )
        await _raise_if_openai_admission_cancelled(
            reservation,
            request = request,
            cancel_event = cancel_event,
        )
        return await _openai_passthrough_non_streaming_upstream(
            llama_backend,
            payload,
            model_name,
            monitor_id = monitor_id,
            request = request,
            cancel_event = cancel_event,
        )
    except LlamaAdmissionTimeout as exc:
        _llama_admission_log(
            "timeout",
            reservation,
            request = request,
            mode = "chat_passthrough_nonstream",
            wait_started_at = admission_wait_started_at,
            level = "warning",
        )
        api_monitor.fail(monitor_id, str(exc))
        raise _openai_admission_http_exception(exc, status_code = 503)
    except LlamaAdmissionCancelled as exc:
        _llama_admission_log(
            "cancelled-before-upstream",
            reservation,
            request = request,
            mode = "chat_passthrough_nonstream",
            wait_started_at = admission_wait_started_at,
            level = "debug",
        )
        api_monitor.finish(monitor_id, "cancelled")
        raise HTTPException(
            status_code = 499,
            detail = _openai_admission_error_body(exc, status_code = 499),
        )
    except asyncio.CancelledError:
        api_monitor.finish(monitor_id, "cancelled")
        reservation.cancel()
        raise
    finally:
        if lease is not None:
            lease.release()


async def _openai_passthrough_non_streaming_upstream(
    llama_backend,
    payload,
    model_name,
    monitor_id: Optional[str] = None,
    *,
    request: Optional[Request] = None,
    cancel_event = None,
):
    """Non-streaming client-side pass-through for /v1/chat/completions.

    Returns llama-server's JSON response verbatim so the client sees the native
    response ``id``, ``finish_reason`` (including ``"tool_calls"``), structured
    ``tool_calls``, and accurate ``usage`` token counts.
    """
    target_url = f"{llama_backend.base_url}/v1/chat/completions"
    upstream_headers = _openai_passthrough_upstream_headers(llama_backend = llama_backend)
    body = await _build_openai_passthrough_body_async(
        payload, backend_ctx = llama_backend.context_length, llama_backend = llama_backend
    )
    body["stream"] = False
    body.pop("stream_options", None)

    _truncate_budget = (
        _OVERFLOW_TRUNCATE_MAX_RETRIES if _overflow_truncation_requested(payload) else 0
    )
    # One respawn per request, as on the streaming twin.
    _respawn_retried = False

    async def _post(body_to_send):
        if cancel_event is None and request is None:
            return await nonstreaming_client().post(
                target_url,
                json = body_to_send,
                headers = upstream_headers,
                timeout = _llama_non_streaming_generation_timeout(),
            )

        if cancel_event is None:
            cancel = threading.Event()
        else:
            cancel = cancel_event
        client = _cancelable_nonstreaming_client()
        watcher = asyncio.create_task(
            _await_cancel_or_disconnect_then_close_client(
                cancel_event = cancel,
                request = request,
                client = client,
            )
        )
        try:
            try:
                response = await client.post(
                    target_url,
                    json = body_to_send,
                    headers = upstream_headers,
                    timeout = _llama_non_streaming_generation_timeout(),
                )
            except httpx.RequestError:
                if cancel.is_set():
                    raise asyncio.CancelledError()
                raise
            if cancel.is_set():
                raise asyncio.CancelledError()
            return response
        finally:
            # Bounded: the watcher polls Request.is_disconnected(), which can swallow
            # cancel(). The client it owns is closed below either way. #7617
            try:
                await _stop_local_disconnect_cancel_watcher(watcher)
            except (asyncio.CancelledError, Exception):
                pass
            try:
                await client.aclose()
            except Exception:
                pass

    while True:
        try:
            resp = await _post(body)
        except asyncio.CancelledError:
            api_monitor.finish(monitor_id, "cancelled")
            raise
        except httpx.RequestError as e:
            # llama-server subprocess crashed / starting / unreachable. Nothing has been
            # sent to the client yet, so retry once on the new port of a respawned server.
            # The helper defers to an MTP fallback already in flight, so nothing respawns
            # underneath it; the recovery call below stays for the paths it declines.
            if not _respawn_retried and _is_lost_upstream_connection(e):
                _respawn_retried = True
                retry_url = await _passthrough_retry_url(llama_backend, e)
                if retry_url is not None:
                    target_url = retry_url
                    # The relaunch minted a fresh --api-key; the pre-crash header 401s.
                    upstream_headers = _openai_passthrough_upstream_headers(
                        llama_backend = llama_backend
                    )
                    continue
            # Surface the same friendly message the sync chat path emits so operators
            # don't see a bare 500 with no diagnostic.
            logger.error("openai passthrough non-streaming: upstream unreachable: %s", e)
            api_monitor.fail(monitor_id, _friendly_error(e))
            get_llama_cpp_backend()._maybe_recover_from_mtp_crash(e)
            raise HTTPException(
                status_code = 502,
                detail = _friendly_error(e),
            )

        if resp.status_code == 200:
            break
        # Opt-in overflow policy: shrink and retry instead of a fatal 400.
        if (
            _truncate_budget > 0
            and _classify_llama_generation_error(Exception(resp.text))
            and _apply_overflow_truncation(body, resp.text)
        ):
            _truncate_budget -= 1
            continue
        api_monitor.fail(monitor_id, resp.text[:500])
        raise _openai_passthrough_error(resp.status_code, resp.text)

    # The guided-decoding fence wraps each choice's JSON content in a
    # ```json ... ``` markdown fence that data_designer's structured parser
    # requires but which CORRUPTS output for standard OpenAI clients doing
    # ``json.loads(content)``. It is therefore opt-in: only the internal
    # data-recipe path sets ``_unsloth_guided_fence``; public response_format
    # clients get the raw upstream JSON verbatim.
    _guided_fence = bool((payload.model_extra or {}).get("_unsloth_guided_fence"))
    _do_fence = _guided_fence and _extract_response_format(payload) is not None
    _cap_parallel = payload.parallel_tool_calls is False
    _allowed_tools = heal_gate(
        payload.auto_heal_tool_calls, body.get("tools"), body.get("tool_choice")
    )

    try:
        data = resp.json()
    except Exception as exc:
        # Non-JSON / unparseable upstream body: relay verbatim as before.
        logger.warning(
            "openai passthrough non-streaming: response not JSON, relaying raw: %s",
            exc,
        )
        api_monitor.finish(monitor_id)
        return Response(content = resp.content, media_type = "application/json")

    # Opt-in single-retry nudge: the model clearly tried to call a tool (signal
    # present) but nothing parseable/declared came out, so re-ask once with the
    # original prompt prefix intact (llama-server reuses the slot's KV cache)
    # plus a two-message nudge suffix. The retry replaces the original response
    # only when it actually yields a usable call.
    if (
        _allowed_tools
        and nudge_enabled(payload.nudge_tool_calls)
        and nudge_should_retry(data, _allowed_tools, body.get("tools"))
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
                if response_has_promotable_calls(retry_data, _allowed_tools, body.get("tools")):
                    resp, data = retry_resp, retry_data
        except asyncio.CancelledError:
            api_monitor.finish(monitor_id, "cancelled")
            raise
        except (httpx.RequestError, ValueError) as exc:
            logger.warning("tool-call nudge retry failed; keeping original: %s", exc)

    changed = False
    for choice in data.get("choices", []):
        if not isinstance(choice, dict):
            continue
        msg = choice.get("message")
        if not isinstance(msg, dict):
            continue

        # Small models emit tool calls as text instead of structured tool_calls;
        # promote them (declared client tools only) so the agent sees a real call.
        # Truncation wins over the upgrade (same rule as the streaming and
        # Anthropic paths): a call cut off at max_tokens keeps
        # finish_reason="length" so the client knows the arguments may be
        # incomplete, while the healed call itself stays attached.
        if _allowed_tools and heal_openai_message(msg, _allowed_tools, body.get("tools")):
            if choice.get("finish_reason") == "stop":
                choice["finish_reason"] = "tool_calls"
            changed = True

        # OpenAI requires content=null on a pure tool-call turn; llama-server
        # emits content="".
        if msg.get("tool_calls") and msg.get("content") == "":
            msg["content"] = None
            changed = True

        # Honor parallel_tool_calls=false (best-effort) by capping to one call.
        if _cap_parallel:
            _tcs = msg.get("tool_calls")
            if isinstance(_tcs, list) and len(_tcs) > 1:
                msg["tool_calls"] = _tcs[:1]
                changed = True

        # Guided-decoding fence wrap (opt-in via _unsloth_guided_fence).
        if _do_fence:
            content = msg.get("content")
            if not isinstance(content, str):
                continue
            stripped = content.strip()
            if not stripped or stripped.startswith("```"):
                continue
            msg["content"] = f"```json\n{stripped}\n```"
            changed = True

    _monitor_openai_chunk(monitor_id, data, llama_backend.context_length)
    api_monitor.finish(monitor_id)
    if not changed:
        # Nothing mutated: relay the upstream bytes verbatim, skipping a
        # redundant parse + re-serialize round-trip.
        return Response(content = resp.content, media_type = "application/json")
    return JSONResponse(content = data)


# =====================================================================
# =====================================================================
# Studio Diffusion & Gallery Routes (Modularized in routes.inference_pkg)
# =====================================================================
from routes.inference_pkg.router_images_studio import (
    router as _images_compat_router,
    studio_router as _images_studio_router,
    _diffusion_training_active,
    _diffusion_training_admission,
    _guard_diffusion_load_against_training,
    _training_is_active,
    _selected_gpu_ordinal,
    _parse_openai_image_size,
    _sign_image_id,
    _IMAGE_LINK_TTL,
    diffusion_download_plan,
    load_diffusion_model,
    load_diffusion_model_gated,
    generate_diffusion_image,
    list_gallery_images,
    get_gallery_image_file,
    update_gallery_image_flags,
    delete_gallery_image,
    clear_gallery_images,
    list_gallery_audio,
    get_gallery_audio_file,
    delete_gallery_audio,
    clear_gallery_audio,
    unload_diffusion_model,
    diffusion_status,
    diffusion_inference_info,
    diffusion_load_progress,
    diffusion_generate_progress,
    cancel_diffusion_generation,
    get_gallery_image_file_signed,
    openai_image_generations,
)

for r in _images_studio_router.routes:
    studio_router.routes.append(r)

for r in _images_compat_router.routes:
    router.routes.append(r)
