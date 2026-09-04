"""OpenAI-compatible Responses API (/v1/responses).

Extracted from monolithic routes/inference.py to preserve SRP and clean architecture.
Handles Responses requests, reasoning extraction, streaming SSE and tool mappings.
"""
from __future__ import annotations

import asyncio
import json
import logging
import sys
import threading
import time
import uuid
from typing import Any, Dict, List, Optional, Set, Tuple, Union

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse, StreamingResponse

from auth import get_current_subject
from core.inference.api_monitor import api_monitor
from core.inference.llama_cpp import LlamaCppBackend
from core.inference.passthrough_healing import StreamToolCallHealer
from models.inference import (
    ChatCompletionRequest,
    ChatMessage,
    ImageContentPart,
    ImageUrl,
    ResponsesFunctionCallInputItem,
    ResponsesFunctionCallOutputInputItem,
    ResponsesInputImagePart,
    ResponsesInputTextPart,
    ResponsesOutputFunctionCall,
    ResponsesOutputMessage,
    ResponsesOutputReasoning,
    ResponsesOutputReasoningContent,
    ResponsesOutputTextContent,
    ResponsesOutputTextPart,
    ResponsesRequest,
    ResponsesResponse,
    ResponsesUnknownInputItem,
    ResponsesUsage,
    TextContentPart,
)
from utils.api_errors import openai_error_body

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


def _friendly_upstream_error(text: str) -> str:
    fn = _get_inf_attr("_friendly_upstream_error")
    return fn(text) if fn else text


def _TrackedCancel(*args, **kwargs):
    cls = _get_inf_attr("_TrackedCancel")
    if cls:
        return cls(*args, **kwargs)
    from contextlib import nullcontext
    return nullcontext()


def _SameTaskStreamingResponse(*args, **kwargs):
    cls = _get_inf_attr("_SameTaskStreamingResponse")
    if cls:
        return cls(*args, **kwargs)
    return StreamingResponse(*args, **kwargs)


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


def _openai_admission_http_exception(*args, **kwargs):
    fn = _get_inf_attr("_openai_admission_http_exception")
    if fn:
        return fn(*args, **kwargs)
    return HTTPException(status_code=503, detail="Admission queue full")


def _raise_if_openai_admission_cancelled(*args, **kwargs):
    fn = _get_inf_attr("_raise_if_openai_admission_cancelled")
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


def _clean_model(model_name: Optional[str]) -> str:
    fn = _get_inf_attr("_clean_model")
    return fn(model_name) if fn else (model_name or "")


def _llama_public_model_id(llama_backend, fallback: Optional[str] = None) -> Optional[str]:
    fn = _get_inf_attr("_llama_public_model_id")
    return fn(llama_backend, fallback) if fn else fallback


def _llama_streaming_generation_timeout():
    fn = _get_inf_attr("_llama_streaming_generation_timeout")
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


def _monitor_context_length():
    fn = _get_inf_attr("_monitor_context_length")
    return fn() if fn else None


def _model_json_response(*args, **kwargs):
    fn = _get_inf_attr("_model_json_response")
    if fn:
        return fn(*args, **kwargs)
    return JSONResponse(content={})


def _fill_recommended_sampling_openai(*args, **kwargs):
    fn = _get_inf_attr("_fill_recommended_sampling_openai")
    if fn:
        fn(*args, **kwargs)


def _raise_unsupported_openai_parameter(param: str, message: str) -> None:
    fn = _get_inf_attr("_raise_unsupported_openai_parameter")
    if fn:
        fn(param, message)


def _drop_parallel_tool_call_deltas(chunk) -> bool:
    fn = _get_inf_attr("_drop_parallel_tool_call_deltas")
    return fn(chunk) if fn else False


def _build_openai_passthrough_body_async(*args, **kwargs):
    fn = _get_inf_attr("_build_openai_passthrough_body_async")
    if fn:
        return fn(*args, **kwargs)


def _aiter_llama_stream_items(*args, **kwargs):
    fn = _get_inf_attr("_aiter_llama_stream_items")
    if fn:
        return fn(*args, **kwargs)


async def openai_chat_completions(*args, **kwargs):
    fn = _get_inf_attr("openai_chat_completions")
    if fn:
        return await fn(*args, **kwargs)
    raise RuntimeError("openai_chat_completions not available")


# Exception types
from core.inference.llama_admission import (
    LlamaAdmissionCancelled,
    LlamaAdmissionQueueFull,
    LlamaAdmissionTimeout,
)

_DEFAULT_FIRST_TOKEN_TIMEOUT_S = 60.0

# =====================================================================
# OpenAI Responses API  (/responses → /v1/responses)
# =====================================================================


def _translate_responses_tools_to_chat(tools: Optional[list[dict]]) -> Optional[list[dict]]:
    """Translate Responses-shape function tools to the Chat Completions nested shape.

    Responses uses a flat shape per tool entry::

        {"type": "function", "name": "...", "description": "...",
         "parameters": {...}, "strict": true}

    The Chat Completions / llama-server passthrough expects the nested shape::

        {"type": "function",
         "function": {"name": "...", "description": "...",
                      "parameters": {...}, "strict": true}}

    Only ``type=="function"`` entries are forwarded. Built-in Responses tools
    (``web_search``, ``file_search``, ``mcp``, ...) are dropped: llama-server
    doesn't implement them server-side, so keeping them would produce an opaque
    upstream 400.
    """
    if not tools:
        return None
    out: list[dict] = []
    for tool in tools:
        if not isinstance(tool, dict):
            continue
        if tool.get("type") != "function":
            continue
        fn: dict = {}
        if "name" in tool:
            fn["name"] = tool["name"]
        if tool.get("description") is not None:
            fn["description"] = tool["description"]
        if tool.get("parameters") is not None:
            fn["parameters"] = tool["parameters"]
        if tool.get("strict") is not None:
            fn["strict"] = tool["strict"]
        out.append({"type": "function", "function": fn})
    return out or None


def _translate_responses_tool_choice_to_chat(tool_choice: Any) -> Any:
    """Translate a Responses-shape ``tool_choice`` to the Chat Completions shape.

    String values (``"auto"``/``"none"``/``"required"``) pass through unchanged.
    The Responses forcing object ``{"type": "function", "name": "X"}`` becomes
    Chat Completions' ``{"type": "function", "function": {"name": "X"}}``.
    Unknown / built-in tool choices are forwarded as-is; llama-server ignores
    what it doesn't recognise.
    """
    if tool_choice is None:
        return None
    if isinstance(tool_choice, str):
        return tool_choice
    if (
        isinstance(tool_choice, dict)
        and tool_choice.get("type") == "function"
        and "name" in tool_choice
        and "function" not in tool_choice
    ):
        return {"type": "function", "function": {"name": tool_choice["name"]}}
    return tool_choice


def _responses_message_text(content: Union[str, list]) -> str:
    """Flatten a ResponsesInputMessage ``content`` into a plain text string.

    Used for system/developer message hoisting and for assistant-replay
    (``output_text``) messages when images/unknown parts are irrelevant.
    Returns an empty string for empty input.
    """
    if isinstance(content, str):
        return content
    parts: list[str] = []
    for part in content or []:
        if isinstance(part, (ResponsesInputTextPart, ResponsesOutputTextPart)):
            parts.append(part.text)
    return "\n".join(parts)


def _responses_tool_output_content(output: Union[str, list]) -> Union[str, list]:
    """Return Chat Completions-safe content for a Responses tool result."""
    if isinstance(output, str):
        return output if output.strip() else "(no output)"

    if not output:
        return "(no output)"

    text_parts: list[str] = []
    chat_parts: list = []
    has_multimodal = False
    for part in output:
        if not isinstance(part, dict):
            return json.dumps(output)
        part_type = part.get("type")
        if part_type in ("input_text", "output_text", "text"):
            text = part.get("text")
            if text is None:
                _raise_unsupported_openai_parameter(
                    "input",
                    "Responses function_call_output.output text parts require a text field.",
                )
            text = str(text)
            text_parts.append(text)
            chat_parts.append(TextContentPart(type = "text", text = text))
            continue
        if part_type == "input_image":
            image_url = part.get("image_url")
            if not isinstance(image_url, str) or not image_url:
                if part.get("file_id"):
                    _raise_unsupported_openai_parameter(
                        "input",
                        "Responses function_call_output.output input_image parts with file_id are not supported by the local adapter. Use image_url instead.",
                    )
                _raise_unsupported_openai_parameter(
                    "input",
                    "Responses function_call_output.output input_image parts require an image_url string.",
                )
            detail = part.get("detail", "auto")
            if detail is None:
                detail = "auto"
            if detail not in ("auto", "low", "high", "original"):
                _raise_unsupported_openai_parameter(
                    "input",
                    "Responses function_call_output.output input_image detail must be auto, low, high, or original.",
                )
            chat_parts.append(
                ImageContentPart(
                    type = "image_url",
                    image_url = ImageUrl(url = image_url, detail = detail),
                )
            )
            has_multimodal = True
            continue
        if part_type == "input_file":
            _raise_unsupported_openai_parameter(
                "input",
                "Responses function_call_output.output input_file parts are not supported by the local adapter.",
            )
        return json.dumps(output)

    if has_multimodal:
        return chat_parts

    text = "\n".join(text_parts)
    return text if text.strip() else "(no output)"


_RESPONSES_THINK_OPEN = "<think>"
_RESPONSES_THINK_CLOSE = "</think>"
_RESPONSES_REASONING_EFFORTS = {"none", "minimal", "low", "medium", "high", "max", "xhigh"}


def _coerce_responses_reasoning_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "".join(_coerce_responses_reasoning_text(part) for part in value)
    if isinstance(value, dict):
        for key in ("text", "reasoning_text", "content"):
            text = _coerce_responses_reasoning_text(value.get(key))
            if text:
                return text
        return ""
    return json.dumps(value)


def _responses_marker_holdback(text: str, markers: tuple[str, ...]) -> int:
    """Number of trailing chars to retain because they may start a marker."""
    for size in range(min(len(text), max(len(m) for m in markers) - 1), 0, -1):
        suffix = text[-size:]
        if any(marker.startswith(suffix) for marker in markers):
            return size
    return 0


class _ResponsesReasoningExtractor:
    """Split local <think> markup into Responses reasoning and visible text."""

    def __init__(
        self,
        *,
        parse_think_markers: bool = False,
        reasoning_prefilled: bool = False,
    ) -> None:
        self._buffer = ""
        # reasoning_prefilled: the template inserts an unclosed <think>, so output begins inside
        # the block; start in reasoning until the first close tag. Existing callers pass False.
        self._in_reasoning = reasoning_prefilled
        # Splitting requires marker parsing; a prefilled open implies it.
        self._parse_think_markers = parse_think_markers or reasoning_prefilled

    def feed(
        self,
        text: str = "",
        reasoning_content: Any = None,
    ) -> tuple[str, str]:
        reasoning_parts: list[str] = []
        visible_parts: list[str] = []
        structured_reasoning = _coerce_responses_reasoning_text(reasoning_content)
        if structured_reasoning:
            reasoning_parts.append(structured_reasoning)
        if text:
            self._buffer += text
        if not self._parse_think_markers:
            visible_parts.append(self._buffer)
            self._buffer = ""
            return "".join(reasoning_parts), "".join(visible_parts)

        while self._buffer:
            if self._in_reasoning:
                close_idx = self._buffer.find(_RESPONSES_THINK_CLOSE)
                if close_idx != -1:
                    reasoning_parts.append(
                        self._buffer[:close_idx].replace(_RESPONSES_THINK_OPEN, "")
                    )
                    self._buffer = self._buffer[close_idx + len(_RESPONSES_THINK_CLOSE) :]
                    self._in_reasoning = False
                    continue
                # Hold back a trailing partial of either marker: the close (clean split across chunks)
                # and a stray open (a re-emitted <think> is suppressed, not leaked).
                keep = _responses_marker_holdback(
                    self._buffer, (_RESPONSES_THINK_CLOSE, _RESPONSES_THINK_OPEN)
                )
                if keep == len(self._buffer):
                    break
                emit = self._buffer[:-keep] if keep else self._buffer
                reasoning_parts.append(emit.replace(_RESPONSES_THINK_OPEN, ""))
                self._buffer = self._buffer[-keep:] if keep else ""
                break

            open_idx = self._buffer.find(_RESPONSES_THINK_OPEN)
            close_idx = self._buffer.find(_RESPONSES_THINK_CLOSE)
            if close_idx != -1 and (open_idx == -1 or close_idx < open_idx):
                visible_parts.append(self._buffer[:close_idx])
                self._buffer = self._buffer[close_idx + len(_RESPONSES_THINK_CLOSE) :]
                continue
            if open_idx != -1:
                visible_parts.append(self._buffer[:open_idx])
                self._buffer = self._buffer[open_idx + len(_RESPONSES_THINK_OPEN) :]
                self._in_reasoning = True
                continue

            keep = _responses_marker_holdback(
                self._buffer,
                (_RESPONSES_THINK_OPEN, _RESPONSES_THINK_CLOSE),
            )
            if keep == len(self._buffer):
                break
            visible_parts.append(self._buffer[:-keep] if keep else self._buffer)
            self._buffer = self._buffer[-keep:] if keep else ""
            break

        return "".join(reasoning_parts), "".join(visible_parts)

    def finish(self) -> tuple[str, str]:
        if not self._buffer:
            return "", ""
        remaining = self._buffer
        self._buffer = ""
        if not self._parse_think_markers:
            return "", remaining
        if self._in_reasoning:
            self._in_reasoning = False
            return remaining.replace(_RESPONSES_THINK_OPEN, ""), ""
        return "", remaining.replace(_RESPONSES_THINK_CLOSE, "")


def _extract_responses_reasoning(
    text: str = "",
    reasoning_content: Any = None,
    *,
    parse_think_markers: bool = False,
    reasoning_prefilled: bool = False,
) -> tuple[str, str]:
    extractor = _ResponsesReasoningExtractor(
        parse_think_markers = parse_think_markers,
        reasoning_prefilled = reasoning_prefilled,
    )
    reasoning, visible = extractor.feed(text, reasoning_content)
    final_reasoning, final_visible = extractor.finish()
    return reasoning + final_reasoning, visible + final_visible


def _responses_should_parse_think_markers(
    chat_req: ChatCompletionRequest, llama_backend: Any = None
) -> bool:
    if llama_backend is not None and getattr(llama_backend, "is_loaded", False):
        if getattr(llama_backend, "reasoning_always_on", False):
            return True
        if getattr(llama_backend, "supports_reasoning", False):
            return True
        return False
    if chat_req.enable_thinking is True:
        return True
    return chat_req.enable_thinking is None and chat_req.reasoning_effort not in (None, "none")


def _responses_reasoning_output_item(reasoning_text: str, item_id: Optional[str] = None) -> dict:
    kwargs: dict[str, Any] = {
        "status": "completed",
        "summary": [],
        "content": [ResponsesOutputReasoningContent(text = reasoning_text)],
    }
    if item_id is not None:
        kwargs["id"] = item_id
    return ResponsesOutputReasoning(**kwargs).model_dump()


def _normalise_responses_input(payload: ResponsesRequest) -> list[ChatMessage]:
    """Convert a ResponsesRequest's ``input`` into a Chat-format ``ChatMessage`` list.

    Handles the three input item shapes allowed by the Responses API:

    - ``ResponsesInputMessage`` -- regular chat messages (text or multimodal).
    - ``ResponsesFunctionCallInputItem`` -- a prior assistant tool call
      replayed on a follow-up turn. Becomes an assistant message carrying a
      Chat Completions ``tool_calls`` entry keyed by ``call_id``.
    - ``ResponsesFunctionCallOutputInputItem`` -- a tool result the client is
      returning. Becomes a ``role="tool"`` message with ``tool_call_id`` set to
      the originating ``call_id`` so llama-server can reconcile call with result.

    System / developer content is collected from ``instructions`` *and* any
    ``role="system"`` / ``role="developer"`` entries in ``input``, then merged
    into a single top-of-list ``role="system"`` message. This satisfies strict
    chat templates (harmony / gpt-oss, Qwen3, ...) whose Jinja raises
    ``"System message must be at the beginning."`` when more than one system
    message is present or a system message follows a user turn -- the exact
    pattern the OpenAI Codex CLI hits, since Codex sets ``instructions`` *and*
    also sends a developer message in ``input``.
    """
    system_parts: list[str] = []
    messages: list[ChatMessage] = []

    if payload.instructions:
        system_parts.append(payload.instructions)

    def _with_system(msgs: list[ChatMessage]) -> list[ChatMessage]:
        if not system_parts:
            return msgs
        merged = "\n\n".join(p for p in system_parts if p)
        return [ChatMessage(role = "system", content = merged), *msgs]

    # Simple string input
    if isinstance(payload.input, str):
        if payload.input:
            messages.append(ChatMessage(role = "user", content = payload.input))
        return _with_system(messages)

    for item in payload.input:
        if isinstance(item, ResponsesFunctionCallInputItem):
            messages.append(
                ChatMessage(
                    role = "assistant",
                    content = None,
                    tool_calls = [
                        {
                            "id": item.call_id,
                            "type": "function",
                            "function": {
                                "name": item.name,
                                "arguments": item.arguments,
                            },
                        }
                    ],
                )
            )
            continue

        if isinstance(item, ResponsesFunctionCallOutputInputItem):
            # Flatten pure text arrays for broad template compatibility, and
            # forward image URL outputs as real multimodal parts for vision models.
            output = _responses_tool_output_content(item.output)
            messages.append(
                ChatMessage(
                    role = "tool",
                    tool_call_id = item.call_id,
                    content = output,
                )
            )
            continue

        if isinstance(item, ResponsesUnknownInputItem):
            # Reasoning items and other unmodelled top-level Responses item
            # types are silently dropped -- llama-server-backed GGUFs can't
            # consume them; lenient validation lets them in so unrelated turns
            # don't 422.
            continue

        # ResponsesInputMessage -- hoist system/developer to the top, merge.
        if item.role in ("system", "developer"):
            hoisted = _responses_message_text(item.content)
            if hoisted:
                system_parts.append(hoisted)
            continue

        if isinstance(item.content, str):
            messages.append(ChatMessage(role = item.role, content = item.content))
            continue

        # Assistant-replay turns come back as content = [output_text, ...].
        # Chat Completions' assistant role expects a plain string, not a
        # multimodal array, so flatten output_text (and any stray input_text /
        # unknown text) to a single string.
        if item.role == "assistant":
            text = _responses_message_text(item.content)
            if text:
                messages.append(ChatMessage(role = "assistant", content = text))
            continue

        # User (and any other remaining roles) -- keep multimodal when present,
        # drop unknown content parts silently.
        parts: list = []
        for part in item.content:
            if isinstance(part, (ResponsesInputTextPart, ResponsesOutputTextPart)):
                parts.append(TextContentPart(type = "text", text = part.text))
            elif isinstance(part, ResponsesInputImagePart):
                parts.append(
                    ImageContentPart(
                        type = "image_url",
                        image_url = ImageUrl(url = part.image_url, detail = part.detail),
                    )
                )
            # ResponsesUnknownContentPart and anything else: drop.
        if parts:
            # Collapse single-text-part content to a plain string so roles that
            # reject multimodal arrays (e.g. legacy templates) still accept it.
            if len(parts) == 1 and isinstance(parts[0], TextContentPart):
                messages.append(ChatMessage(role = item.role, content = parts[0].text))
            else:
                messages.append(ChatMessage(role = item.role, content = parts))

    return _with_system(messages)


def _responses_text_format(text: Any) -> Optional[dict]:
    """Responses ``text.format`` -> Chat Completions ``response_format``.

    ``{"type": "text"}`` and a verbosity-only ``text`` carry no constraint -> None.
    """
    fmt = text.get("format") if isinstance(text, dict) else None
    if not isinstance(fmt, dict):
        return None
    if fmt.get("type") == "json_object":
        return {"type": "json_object"}
    if fmt.get("type") != "json_schema" or not isinstance(fmt.get("schema"), dict):
        return None
    json_schema = {"name": str(fmt.get("name") or "response"), "schema": fmt["schema"]}
    if fmt.get("strict") is not None:
        json_schema["strict"] = bool(fmt["strict"])
    return {"type": "json_schema", "json_schema": json_schema}


def _build_chat_request(
    payload: ResponsesRequest, messages: list[ChatMessage], stream: bool
) -> ChatCompletionRequest:
    """Build a ChatCompletionRequest from a ResponsesRequest.

    Tools and ``tool_choice`` are translated from the flat Responses shape to
    the nested Chat Completions shape here so the existing #5099
    ``/v1/chat/completions`` client-side pass-through picks them up unchanged.
    """
    chat_kwargs: dict = dict(
        messages = messages,
        stream = stream,
    )
    # Only forward an explicitly set model so an omitted Responses model stays
    # reload-only when openai_chat_completions re-checks on the non-streaming path.
    if "model" in payload.model_fields_set:
        chat_kwargs["model"] = payload.model
    if payload.temperature is not None:
        chat_kwargs["temperature"] = payload.temperature
    if payload.top_p is not None:
        chat_kwargs["top_p"] = payload.top_p
    if payload.max_output_tokens is not None:
        chat_kwargs["max_tokens"] = payload.max_output_tokens

    chat_tools = _translate_responses_tools_to_chat(payload.tools)
    if chat_tools is not None:
        chat_kwargs["tools"] = chat_tools

    chat_tool_choice = _translate_responses_tool_choice_to_chat(payload.tool_choice)
    if chat_tool_choice is not None:
        chat_kwargs["tool_choice"] = chat_tool_choice
    if payload.parallel_tool_calls is not None:
        chat_kwargs["parallel_tool_calls"] = payload.parallel_tool_calls

    # ``chat_template_kwargs`` (e.g. ``{"enable_thinking": true}``) arrives via
    # the Responses extra-body: ResponsesRequest has ``extra="allow"``, so the
    # OpenAI SDK's ``extra_body`` spread lands the dict in ``model_extra``. The
    # downstream Chat Completions paths consume the typed ``enable_thinking``
    # field -- the non-streaming path lifts it in ``openai_chat_completions``
    # only when it is still ``None``, and the streaming pass-through reads
    # ``payload.enable_thinking`` directly -- so lift it here, mirroring that
    # handler, to cover both Responses paths.
    explicit_enable_thinking = False
    _extra = getattr(payload, "model_extra", None)
    if isinstance(_extra, dict):
        _tpl_kw = _extra.get("chat_template_kwargs")
        if isinstance(_tpl_kw, dict) and "enable_thinking" in _tpl_kw:
            chat_kwargs["enable_thinking"] = bool(_tpl_kw["enable_thinking"])
            explicit_enable_thinking = True
        # auto_heal_tool_calls / nudge_tool_calls are not typed on
        # ResponsesRequest; lift them from the extra-body so passthrough
        # healing (and the opt-in nudge) honor them on both paths.
        if isinstance(_extra.get("auto_heal_tool_calls"), bool):
            chat_kwargs["auto_heal_tool_calls"] = _extra["auto_heal_tool_calls"]
        if isinstance(_extra.get("nudge_tool_calls"), bool):
            chat_kwargs["nudge_tool_calls"] = _extra["nudge_tool_calls"]
        # Same for continuation, or a Responses request resuming a trailing assistant
        # turn opens a fresh one and restarts the answer.
        if isinstance(_extra.get("continue_final_message"), bool):
            chat_kwargs["continue_final_message"] = _extra["continue_final_message"]

    if isinstance(payload.reasoning, dict):
        effort = payload.reasoning.get("effort")
        if isinstance(effort, str) and effort in _RESPONSES_REASONING_EFFORTS:
            if not explicit_enable_thinking:
                chat_kwargs["reasoning_effort"] = effort
                chat_kwargs["enable_thinking"] = effort != "none"
            elif chat_kwargs.get("enable_thinking") is False:
                chat_kwargs["reasoning_effort"] = "none"
            elif effort != "none":
                chat_kwargs["reasoning_effort"] = effort

    response_format = _responses_text_format(payload.text)
    if response_format is not None:
        # Lands in model_extra, where _extract_response_format reads it.
        chat_kwargs["response_format"] = response_format

    return ChatCompletionRequest(**chat_kwargs)


def _chat_tool_calls_to_responses_output(tool_calls: list[dict]) -> list[dict]:
    """Map Chat Completions ``tool_calls`` into Responses ``function_call`` output items.

    The Chat Completions id (``call_xxx``) is the shared correlation key across
    turns in the Responses API -- stored as ``call_id`` on the output item and
    echoed back by the client as ``function_call_output.call_id`` next turn.
    """
    items: list[dict] = []
    for tc in tool_calls:
        if tc.get("type") != "function":
            continue
        fn = tc.get("function") or {}
        items.append(
            ResponsesOutputFunctionCall(
                call_id = tc.get("id", ""),
                name = fn.get("name", ""),
                arguments = fn.get("arguments", "") or "",
                status = "completed",
            ).model_dump()
        )
    return items


async def _responses_non_streaming(
    payload: ResponsesRequest,
    messages: list[ChatMessage],
    request: Request,
    current_subject: Optional[str] = None,
) -> JSONResponse:
    """Handle a non-streaming Responses API call."""
    chat_req = _build_chat_request(payload, messages, stream = False)
    request_state = getattr(request, "state", None)
    if request_state is None:
        request_state = type("_RequestState", (), {})()
        try:
            setattr(request, "state", request_state)
        except Exception:
            request_state = None
    previous_skip_monitor = (
        bool(getattr(request_state, "skip_api_monitor", False))
        if request_state is not None
        else False
    )
    monitor_id = None
    if not previous_skip_monitor:
        monitor_id = api_monitor.start(
            endpoint = getattr(getattr(request, "url", None), "path", "/v1/responses"),
            method = getattr(request, "method", "POST"),
            via_api_key = _request_used_api_key(request),
            model = payload.model,
            prompt = _monitor_prompt_from_messages(messages),
            context_length = _monitor_context_length(),
            subject = current_subject,
        )
    if request_state is not None:
        request_state.skip_api_monitor = True

    # Catches the engine timings the suppressed inner monitor would otherwise drop.
    inner_perf: dict = {}
    if monitor_id:
        inner_perf["monitor_id"] = monitor_id
        inner_perf["context_length"] = _monitor_context_length()
    try:
        _sink_token = _monitor_perf_sink.set(inner_perf if monitor_id else None)
        try:
            result = await openai_chat_completions(chat_req, request)
        finally:
            _monitor_perf_sink.reset(_sink_token)

        # openai_chat_completions returns a JSONResponse for non-streaming.
        if isinstance(result, Response):
            body = json.loads(result.body.decode())
        else:
            body = result

        choices = body.get("choices", [])
        text = ""
        reasoning_text = ""
        tool_calls: list[dict] = []
        if choices:
            msg = choices[0].get("message", {}) or {}
            raw_content = msg.get("content", "") or ""
            raw_text = raw_content if isinstance(raw_content, str) else json.dumps(raw_content)
            llama_backend = get_llama_cpp_backend()
            reasoning_text, text = _extract_responses_reasoning(
                raw_text,
                msg.get("reasoning_content"),
                parse_think_markers = _responses_should_parse_think_markers(chat_req, llama_backend),
            )
            tool_calls = msg.get("tool_calls") or []

        usage_data = body.get("usage", {})
        input_tokens = usage_data.get("prompt_tokens", 0)
        output_tokens = usage_data.get("completion_tokens", 0)

        resp_id = f"resp_{uuid.uuid4().hex[:12]}"

        # Responses API emits each tool call as its own top-level output item,
        # plus an optional assistant text message. Emit the text message only when
        # the model produced content, so clients expecting a pure tool-call turn
        # (finish_reason="tool_calls") don't see a spurious empty message item.
        output_items: list[dict] = []
        if reasoning_text:
            output_items.append(_responses_reasoning_output_item(reasoning_text))
        if text:
            msg_id = f"msg_{uuid.uuid4().hex[:12]}"
            output_items.append(
                ResponsesOutputMessage(
                    id = msg_id,
                    status = "completed",
                    role = "assistant",
                    content = [ResponsesOutputTextContent(text = text)],
                ).model_dump()
            )
        output_items.extend(_chat_tool_calls_to_responses_output(tool_calls))

        response = ResponsesResponse(
            id = resp_id,
            created_at = int(time.time()),
            status = "completed",
            model = body.get("model", payload.model),
            output = output_items,
            usage = ResponsesUsage(
                input_tokens = input_tokens,
                output_tokens = output_tokens,
                total_tokens = input_tokens + output_tokens,
            ),
            temperature = payload.temperature,
            top_p = payload.top_p,
            max_output_tokens = payload.max_output_tokens,
            instructions = payload.instructions,
        )
        api_monitor.set_reply(monitor_id, text or _monitor_tool_calls_text(tool_calls))
        _monitor_usage(
            monitor_id,
            usage_data,
            _monitor_context_length(),
            # Inner monitor suppressed: only the llama-server pass-through carries timings on
            # the body; in-process paths return a ChatCompletion with no field for them.
            timings = (
                (body.get("timings") if isinstance(body, dict) else None)
                or inner_perf.get("timings")
            ),
            stop_reason = (choices[0].get("finish_reason") if choices else None),
        )
        api_monitor.finish(monitor_id)
        return _model_json_response(response)
    except asyncio.CancelledError:
        api_monitor.finish(monitor_id, "cancelled")
        raise
    except Exception as exc:
        api_monitor.fail(monitor_id, _friendly_error(exc))
        raise
    finally:
        if request_state is not None:
            request_state.skip_api_monitor = previous_skip_monitor


async def _responses_stream(
    payload: ResponsesRequest,
    messages: list[ChatMessage],
    request: Request,
    monitor_id: Optional[str] = None,
):
    """Handle a streaming Responses API call, emitting named SSE events.

    For GGUF models the request goes directly to llama-server's
    ``/v1/chat/completions`` from inside the StreamingResponse child task -- one
    httpx lifecycle, one async generator. Wrapping the existing
    ``openai_chat_completions`` pass-through (which has its own httpx lifecycle)
    stacks two generators: Python 3.13 + httpcore 1.0.x then loses the
    close-propagation chain on the innermost ``HTTP11ConnectionByteStream`` at
    asyncgen finalisation, tripping "Attempted to exit cancel scope in a
    different task" / "async generator ignored GeneratorExit". The direct path
    avoids that. Non-GGUF falls back to the wrapper (which doesn't use httpx, so
    the issue doesn't apply).

    Output items are allocated as upstream deltas appear. Reasoning/text deltas
    open top-level ``reasoning`` / ``message`` items; each tool call from
    ``delta.tool_calls[]`` is promoted to its own top-level ``function_call``
    item (one per distinct ``tool_calls[].index``) and relayed as
    ``response.function_call_arguments.delta`` / ``.done`` events so clients
    (Codex, OpenAI Python SDK) can reconstruct the call incrementally and reply
    with a ``function_call_output`` item next turn.
    """
    resp_id = f"resp_{uuid.uuid4().hex[:12]}"
    created_at = int(time.time())

    chat_req = _build_chat_request(payload, messages, stream = True)

    llama_backend = get_llama_cpp_backend()
    if not llama_backend.is_loaded:
        # The direct pass-through is GGUF-only. Non-GGUF /v1/responses streaming
        # isn't a Codex-compatible path today, and wrapping the transformers
        # backend's streaming generator here would re-introduce the
        # double-layer asyncgen close pattern that produces "Attempted to exit
        # cancel scope in a different task" on Python 3.13. Surface a typed 400
        # so the client sees a useful error instead of a dangling stream.
        _status, _detail = await _no_model_loaded_error(
            "Streaming /v1/responses requires a GGUF model loaded via "
            "llama-server. Use non-streaming /v1/responses, "
            "/v1/chat/completions, or load a GGUF model.",
            _switch_model_for_payload(payload),
            request,
            status = 400,
        )
        raise HTTPException(status_code = _status, detail = _detail)

    # Direct pass-through bypasses the openai_chat_completions image gate.
    if not llama_backend.is_vision and any(
        isinstance(m.content, list) and any(isinstance(p, ImageContentPart) for p in m.content)
        for m in messages
    ):
        raise HTTPException(
            status_code = 400,
            detail = "Image provided but current GGUF model does not support vision.",
        )

    # Streaming /v1/responses builds the passthrough body directly (bypassing
    # openai_chat_completions), so apply recommended sampling here too.
    _fill_recommended_sampling_openai(chat_req, getattr(llama_backend, "model_identifier", None))
    body = await _build_openai_passthrough_body_async(
        chat_req, backend_ctx = llama_backend.context_length, llama_backend = llama_backend
    )
    body["stream_options"] = {"include_usage": True}
    target_url = f"{llama_backend.base_url}/v1/chat/completions"
    # The stream's own disconnect event, shared with the cancel/active-generation registries:
    # this path decodes on llama-server, so a non-forced /unload must see it and refuse instead
    # of tearing the server down mid-response. Entered inside the body generator below, so a
    # response whose body never starts leaves nothing behind.
    cancel_event = threading.Event()
    _tracker = _TrackedCancel.for_payload(cancel_event, payload, resp_id)
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
            mode = "responses_stream",
            completion_id = resp_id,
            level = "warning",
        )
        api_monitor.fail(monitor_id, str(exc))
        raise _openai_admission_http_exception(exc, status_code = 429)

    def _responses_admission_failed_sse(exc: Exception, *, status_code: int) -> str:
        return (
            "event: response.failed\n"
            "data: "
            + json.dumps(
                {
                    "type": "response.failed",
                    "response": {
                        "id": resp_id,
                        "object": "response",
                        "created_at": created_at,
                        "status": "failed",
                        "model": _llama_public_model_id(llama_backend, payload.model)
                        or payload.model,
                        "output": [],
                        "usage": {
                            "input_tokens": 0,
                            "output_tokens": 0,
                            "total_tokens": 0,
                        },
                        "error": {
                            "code": status_code,
                            "message": str(exc),
                        },
                    },
                }
            )
            + "\n\n"
        )

    async def event_generator():
        # Clean public id for every response envelope. Prefer the loaded model's
        # id so the stream agrees with /v1/models, chat/completions and the
        # non-streaming twin; fall back to a sanitized payload.model (a legacy
        # raw .gguf path is stripped, never echoed back). Use the advertised-id
        # helper, not the raw identifier: after an auto-switch to a cached HF GGUF
        # the identifier is the snapshot path while the repo id lives in
        # _openai_advertised_id, so the raw form would stream a snapshot basename.
        _clean_model = _llama_public_model_id(llama_backend, payload.model) or payload.model
        full_text = ""
        full_reasoning = ""
        input_tokens = 0
        output_tokens = 0
        # From the chat chunks; applied once before finish, so chunk order does not matter.
        stream_finish_reason: Optional[str] = None
        extractor = _ResponsesReasoningExtractor(
            parse_think_markers = _responses_should_parse_think_markers(chat_req, llama_backend)
        )
        reasoning_state: dict[str, Any] = {"output_index": None, "item_id": None, "opened": False}
        message_state: dict[str, Any] = {
            "output_index": None,
            "item_id": None,
            "opened": False,
            "text": "",
        }
        # Message items already closed mid-stream (a healed tool call splits
        # the assistant text into separate message items, as native Responses
        # streams do). Kept for the final response.completed snapshot.
        closed_message_states: list[dict] = []
        # Per-tool-call state keyed by Chat Completions `tool_calls[].index`,
        # stable across chunks for the same call. Values:
        #   {output_index, item_id, call_id, name, arguments, opened}
        tool_call_state: dict[int, dict] = {}
        next_output_index = 0
        # Text-form tool calls promoted back to structured calls (declared
        # client tools only); dormant once grammar-mode structured deltas appear.
        _allowed_tools = heal_gate(
            getattr(chat_req, "auto_heal_tool_calls", None),
            body.get("tools"),
            body.get("tool_choice"),
        )
        healer = StreamToolCallHealer(_allowed_tools, body.get("tools")) if _allowed_tools else None
        healed_tc_index = 0

        def _healed_tc(call: dict):
            # Chat-delta shape for a healed call. Indexes live in a disjoint
            # range so a healed call can never merge into a structured call's
            # state slot; parallel_tool_calls=false caps healed calls too (the
            # upstream cap ran before injection).
            nonlocal healed_tc_index
            if payload.parallel_tool_calls is False and healed_tc_index >= 1:
                return None
            tc = {
                "index": 1_000_000 + healed_tc_index,
                "id": call["id"],
                "type": "function",
                "function": call["function"],
            }
            healed_tc_index += 1
            return tc

        def _sse(event_name: str, payload: dict) -> str:
            return f"event: {event_name}\ndata: {json.dumps(payload)}\n\n"

        def _tool_call_delta_events(tc: dict) -> list:
            # One Chat Completions tool_calls delta -> Responses SSE events,
            # allocating/merging per-call state (shared by the structured loop
            # and the healer's promoted calls).
            events = []
            idx = tc.get("index", 0)
            st = tool_call_state.get(idx)
            fn = tc.get("function") or {}
            if st is None:
                # First chunk for this tool call -- allocate an
                # output_index and emit output_item.added.
                st = {
                    "output_index": _claim_output_index(),
                    "item_id": f"fc_{uuid.uuid4().hex[:12]}",
                    "call_id": tc.get("id") or "",
                    "name": fn.get("name") or "",
                    "arguments": "",
                    "opened": False,
                }
                tool_call_state[idx] = st
            else:
                # Later chunks sometimes carry id/name only once; merge
                # when present.
                if tc.get("id") and not st["call_id"]:
                    st["call_id"] = tc["id"]
                if fn.get("name") and not st["name"]:
                    st["name"] = fn["name"]

            if not st["opened"] and st["call_id"] and st["name"]:
                item_added = {
                    "type": "response.output_item.added",
                    "output_index": st["output_index"],
                    "item": {
                        "type": "function_call",
                        "id": st["item_id"],
                        "status": "in_progress",
                        "call_id": st["call_id"],
                        "name": st["name"],
                        "arguments": "",
                    },
                }
                events.append(_sse("response.output_item.added", item_added))
                st["opened"] = True

            arg_delta = fn.get("arguments") or ""
            if arg_delta and st["opened"]:
                st["arguments"] += arg_delta
                args_delta_event = {
                    "type": "response.function_call_arguments.delta",
                    "item_id": st["item_id"],
                    "output_index": st["output_index"],
                    "delta": arg_delta,
                }
                events.append(_sse("response.function_call_arguments.delta", args_delta_event))
            elif arg_delta:
                # Buffer args until we can open the item (some models
                # send id/name in the same chunk as the first arg delta;
                # if not, stash).
                st["arguments"] += arg_delta
            return events

        def _claim_output_index() -> int:
            nonlocal next_output_index
            output_index = next_output_index
            next_output_index += 1
            return output_index

        def _apply_usage(u, timings = None) -> None:
            nonlocal input_tokens, output_tokens
            # No early return on a falsy usage: the final chunk can carry timings alone.
            if isinstance(u, dict):
                input_tokens = u.get("prompt_tokens", input_tokens)
                output_tokens = u.get("completion_tokens", output_tokens)
            _monitor_usage(monitor_id, u, llama_backend.context_length, timings = timings)

        def _ensure_reasoning_open() -> list[str]:
            if reasoning_state["opened"]:
                return []
            reasoning_state["output_index"] = _claim_output_index()
            reasoning_state["item_id"] = f"rs_{uuid.uuid4().hex[:12]}"
            reasoning_state["opened"] = True
            output_index = reasoning_state["output_index"]
            item_id = reasoning_state["item_id"]
            return [
                _sse(
                    "response.output_item.added",
                    {
                        "type": "response.output_item.added",
                        "output_index": output_index,
                        "item": {
                            "type": "reasoning",
                            "id": item_id,
                            "status": "in_progress",
                            "summary": [],
                            "content": [],
                        },
                    },
                ),
                _sse(
                    "response.content_part.added",
                    {
                        "type": "response.content_part.added",
                        "item_id": item_id,
                        "output_index": output_index,
                        "content_index": 0,
                        "part": {"type": "reasoning_text", "text": ""},
                    },
                ),
            ]

        def _ensure_message_open() -> list[str]:
            if message_state["opened"]:
                return []
            message_state["output_index"] = _claim_output_index()
            message_state["item_id"] = f"msg_{uuid.uuid4().hex[:12]}"
            message_state["opened"] = True
            output_index = message_state["output_index"]
            item_id = message_state["item_id"]
            return [
                _sse(
                    "response.output_item.added",
                    {
                        "type": "response.output_item.added",
                        "output_index": output_index,
                        "item": {
                            "type": "message",
                            "id": item_id,
                            "status": "in_progress",
                            "role": "assistant",
                            "content": [],
                        },
                    },
                ),
                _sse(
                    "response.content_part.added",
                    {
                        "type": "response.content_part.added",
                        "item_id": item_id,
                        "output_index": output_index,
                        "content_index": 0,
                        "part": {"type": "output_text", "text": "", "annotations": []},
                    },
                ),
            ]

        def _close_message_item() -> list[str]:
            """Close the open message item so later text opens a fresh one.

            Emits the same done-event triplet the end-of-stream close loop
            would, records the item for the final snapshot, and resets the
            state in place. No-op when no message item is open.
            """
            if not message_state["opened"]:
                return []
            text = message_state["text"]
            events = [
                _sse(
                    "response.output_text.done",
                    {
                        "type": "response.output_text.done",
                        "item_id": message_state["item_id"],
                        "output_index": message_state["output_index"],
                        "content_index": 0,
                        "text": text,
                    },
                ),
                _sse(
                    "response.content_part.done",
                    {
                        "type": "response.content_part.done",
                        "item_id": message_state["item_id"],
                        "output_index": message_state["output_index"],
                        "content_index": 0,
                        "part": {"type": "output_text", "text": text, "annotations": []},
                    },
                ),
                _sse(
                    "response.output_item.done",
                    {
                        "type": "response.output_item.done",
                        "output_index": message_state["output_index"],
                        "item": {
                            "type": "message",
                            "id": message_state["item_id"],
                            "status": "completed",
                            "role": "assistant",
                            "content": [{"type": "output_text", "text": text, "annotations": []}],
                        },
                    },
                ),
            ]
            closed_message_states.append(dict(message_state))
            message_state.update(
                {"output_index": None, "item_id": None, "opened": False, "text": ""}
            )
            return events

        def _healed_event_sse(events) -> list[str]:
            """Serialize healer events preserving their order.

            Text around a healed call must keep its position relative to the
            function_call item (output indexes are claimed in emission order),
            so never split an event list into all-text-then-all-calls. A healed
            call also CLOSES any open message item, so trailing text opens a
            fresh message with a later output index, exactly like a native
            Responses stream that interleaves messages and calls.
            """
            nonlocal full_text
            out: list[str] = []
            for kind, value in events:
                if kind == "text":
                    if not value:
                        continue
                    out.extend(_ensure_message_open())
                    full_text += value
                    message_state["text"] += value
                    api_monitor.append_reply(monitor_id, value)
                    out.append(
                        _sse(
                            "response.output_text.delta",
                            {
                                "type": "response.output_text.delta",
                                "item_id": message_state["item_id"],
                                "output_index": message_state["output_index"],
                                "content_index": 0,
                                "delta": value,
                            },
                        )
                    )
                else:
                    tc = _healed_tc(value)
                    if tc is None:
                        continue
                    out.extend(_close_message_item())
                    out.extend(_tool_call_delta_events(tc))
            return out

        def _snapshot_output() -> list[dict]:
            """Snapshot of all completed output items for response.completed."""
            indexed_items: list[tuple[int, dict]] = []
            if reasoning_state["opened"]:
                indexed_items.append(
                    (
                        reasoning_state["output_index"],
                        {
                            "type": "reasoning",
                            "id": reasoning_state["item_id"],
                            "status": "completed",
                            "summary": [],
                            "content": [{"type": "reasoning_text", "text": full_reasoning}],
                        },
                    )
                )
            # Closed copies keep opened=True (snapshotted before reset); the
            # live state contributes only when a message is currently open.
            for msg_st in [*closed_message_states, message_state]:
                if not msg_st["opened"]:
                    continue
                indexed_items.append(
                    (
                        msg_st["output_index"],
                        {
                            "type": "message",
                            "id": msg_st["item_id"],
                            "status": "completed",
                            "role": "assistant",
                            "content": [
                                {
                                    "type": "output_text",
                                    "text": msg_st["text"],
                                    "annotations": [],
                                }
                            ],
                        },
                    )
                )
            for st in tool_call_state.values():
                indexed_items.append(
                    (
                        st["output_index"],
                        {
                            "type": "function_call",
                            "id": st["item_id"],
                            "status": "completed",
                            "call_id": st["call_id"],
                            "name": st["name"],
                            "arguments": st["arguments"],
                        },
                    )
                )
            return [item for _, item in sorted(indexed_items, key = lambda pair: pair[0])]

        def _failed_response_payload(exc: Exception, status_code: int) -> dict:
            return {
                "type": "response.failed",
                "response": {
                    "id": resp_id,
                    "object": "response",
                    "created_at": created_at,
                    "status": "failed",
                    "model": _clean_model,
                    "output": _snapshot_output(),
                    "usage": {
                        "input_tokens": input_tokens,
                        "output_tokens": output_tokens,
                        "total_tokens": input_tokens + output_tokens,
                    },
                    "error": {
                        "code": status_code,
                        "message": _friendly_error(exc),
                    },
                },
            }

        # ── Preamble events ──
        yield _sse(
            "response.created",
            {
                "type": "response.created",
                "response": {
                    "id": resp_id,
                    "object": "response",
                    "created_at": created_at,
                    "status": "in_progress",
                    "model": _clean_model,
                    "output": [],
                    "usage": {"input_tokens": 0, "output_tokens": 0, "total_tokens": 0},
                },
            },
        )

        # ── Direct httpx lifecycle to llama-server ──
        # Full same-task open + close, same pattern as
        # _openai_passthrough_stream and _anthropic_passthrough_stream: no
        # `async with`, explicit aclose of lines_iter BEFORE resp / client so
        # the innermost httpcore byte stream is finalised in this task (not via
        # the asyncgen GC in a sibling task).
        client = httpx.AsyncClient(
            timeout = _llama_streaming_generation_timeout(),
            trust_env = False,
        )
        resp = None
        lines_iter = None
        disconnect_watcher = None
        # Tracked per-run event: a client disconnect and a forced reload both land here.
        disconnect_event = cancel_event
        try:
            req = client.build_request(
                "POST", target_url, json = body, headers = {"Connection": "close"}
            )
            first_token_deadline = time.monotonic() + _DEFAULT_FIRST_TOKEN_TIMEOUT_S
            try:
                # Same event the loop below polls: prefill can run for the whole first-token window,
                # and only the send watcher can end it early.
                resp = await _send_stream_with_preheader_cancel(
                    client, req, disconnect_event, request = request
                )
                if resp is None:
                    api_monitor.finish(monitor_id, "cancelled")
                    return
            except httpx.RequestError as e:
                logger.error("responses stream: upstream unreachable: %s", e)
                api_monitor.fail(monitor_id, _friendly_error(e))
                yield _sse(
                    "response.failed",
                    {
                        "type": "response.failed",
                        "response": {
                            "id": resp_id,
                            "object": "response",
                            "created_at": created_at,
                            "status": "failed",
                            "model": _clean_model,
                            "output": [],
                            "error": {"code": 502, "message": _friendly_error(e)},
                        },
                    },
                )
                return

            if resp.status_code != 200:
                err_bytes = await resp.aread()
                err_text = err_bytes.decode("utf-8", errors = "replace")
                logger.error(
                    "responses stream upstream error: status=%s body=%s",
                    resp.status_code,
                    err_text[:500],
                )
                api_monitor.fail(monitor_id, err_text[:500])
                yield _sse(
                    "response.failed",
                    {
                        "type": "response.failed",
                        "response": {
                            "id": resp_id,
                            "object": "response",
                            "created_at": created_at,
                            "status": "failed",
                            "model": _clean_model,
                            "output": [],
                            "error": {
                                "code": resp.status_code,
                                "message": _friendly_upstream_error(err_text[:500]),
                            },
                        },
                    },
                )
                return

            lines_iter = resp.aiter_lines()
            disconnect_watcher = asyncio.create_task(
                _await_disconnect_then_close(request, resp, disconnect_event)
            )
            async for raw_line in _aiter_llama_stream_items(
                lines_iter,
                cancel_event = disconnect_event,
                request = request,
                first_token_deadline = first_token_deadline,
                response = resp,
            ):
                if not raw_line:
                    continue
                if not raw_line.startswith("data: "):
                    continue
                data_str = raw_line[6:]
                if data_str.strip() == "[DONE]":
                    break
                try:
                    chunk_data = json.loads(data_str)
                except json.JSONDecodeError:
                    continue
                if payload.parallel_tool_calls is False:
                    _drop_parallel_tool_call_deltas(chunk_data)

                choices = chunk_data.get("choices", [])
                if not choices:
                    _apply_usage(chunk_data.get("usage"), chunk_data.get("timings"))
                    continue
                if choices[0].get("finish_reason"):
                    stream_finish_reason = choices[0]["finish_reason"]

                delta = choices[0].get("delta", {}) or {}
                reasoning_delta, visible_delta = extractor.feed(
                    delta.get("content") or "",
                    delta.get("reasoning_content"),
                )
                if reasoning_delta:
                    # Not on visible text: the client already has this, so waiting would
                    # time from the end of the thinking block instead.
                    api_monitor.mark_first_token(monitor_id)
                    for event in _ensure_reasoning_open():
                        yield event
                    full_reasoning += reasoning_delta
                    yield _sse(
                        "response.reasoning_text.delta",
                        {
                            "type": "response.reasoning_text.delta",
                            "item_id": reasoning_state["item_id"],
                            "output_index": reasoning_state["output_index"],
                            "content_index": 0,
                            "delta": reasoning_delta,
                        },
                    )
                # Heal text-form tool calls in the visible stream (never in
                # reasoning text): promoted calls join the structured tc loop
                # below through the same state machinery, and healer events are
                # emitted IN ORDER so text after a healed call never jumps ahead
                # of the function_call item. Once a structured delta arrives,
                # grammar mode worked and the healer goes dormant.
                if healer is not None and not healer.dormant:
                    healed_events = []
                    if delta.get("tool_calls"):
                        # Held text preceded the structured call; the call's own
                        # deltas follow in the structured loop below.
                        healed_events = healer.structured_tool_call_seen()
                        if visible_delta:
                            healed_events.append(("text", visible_delta))
                    elif visible_delta:
                        healed_events = healer.feed(visible_delta)
                    visible_delta = ""
                    if healed_events:
                        # Not append_reply below: this is where the client first sees
                        # the promoted tool call or its surrounding text.
                        api_monitor.mark_first_token(monitor_id)
                    for event in _healed_event_sse(healed_events):
                        yield event
                if visible_delta:
                    for event in _ensure_message_open():
                        yield event
                    full_text += visible_delta
                    message_state["text"] += visible_delta
                    api_monitor.append_reply(monitor_id, visible_delta)
                    yield _sse(
                        "response.output_text.delta",
                        {
                            "type": "response.output_text.delta",
                            "item_id": message_state["item_id"],
                            "output_index": message_state["output_index"],
                            "content_index": 0,
                            "delta": visible_delta,
                        },
                    )

                if delta.get("tool_calls"):
                    # A tool call is output the client already received; stamp it too.
                    api_monitor.mark_first_token(monitor_id)
                for tc in delta.get("tool_calls") or []:
                    if (
                        payload.parallel_tool_calls is False
                        and healed_tc_index >= 1
                        and tc.get("index", 0) not in tool_call_state
                    ):
                        # A healed call already consumed the single allowed slot;
                        # _drop_parallel_tool_call_deltas only sees native indexes,
                        # so a native index-0 call would still open a second
                        # function_call item. Skip it (and its later argument
                        # deltas, which never allocate a state either).
                        continue
                    for event in _tool_call_delta_events(tc):
                        yield event

                _apply_usage(chunk_data.get("usage"), chunk_data.get("timings"))
        except asyncio.CancelledError:
            disconnect_event.set()
            api_monitor.finish(monitor_id, "cancelled")
            raise
        except (httpx.RemoteProtocolError, httpx.ReadError, httpx.CloseError) as e:
            if not disconnect_event.is_set():
                logger.error("responses stream error: %s", e)
                api_monitor.fail(monitor_id, _friendly_error(e))
                status_code = 400 if _classify_llama_generation_error(e) is not None else 500
                yield _sse(
                    "response.failed",
                    _failed_response_payload(e, status_code),
                )
                return
        except Exception as e:
            if disconnect_event.is_set():
                api_monitor.finish(monitor_id, "cancelled")
                return
            logger.error("responses stream error: %s", e)
            api_monitor.fail(monitor_id, _friendly_error(e))
            status_code = 400 if _classify_llama_generation_error(e) is not None else 500
            yield _sse(
                "response.failed",
                _failed_response_payload(e, status_code),
            )
            return
        finally:
            await _aclose_stream_resources(
                watchers = (disconnect_watcher,),
                iterator = lines_iter,
                resp = resp,
                client = client,
            )

        if disconnect_event.is_set():
            api_monitor.finish(monitor_id, "cancelled")
            return

        final_reasoning, final_visible = extractor.finish()
        if final_reasoning:
            # Held-back markers can make this the FIRST output of all.
            api_monitor.mark_first_token(monitor_id)
            for event in _ensure_reasoning_open():
                yield event
            full_reasoning += final_reasoning
            yield _sse(
                "response.reasoning_text.delta",
                {
                    "type": "response.reasoning_text.delta",
                    "item_id": reasoning_state["item_id"],
                    "output_index": reasoning_state["output_index"],
                    "content_index": 0,
                    "delta": final_reasoning,
                },
            )
        # Last-chance heal of any held residue (e.g. a tool block the model
        # never closed) before the trailing visible text is flushed; events
        # keep healer order so trailing text stays behind a healed call.
        if healer is not None:
            events = (healer.feed(final_visible) if final_visible else []) + healer.finalize()
            final_visible = ""
            if events:
                # Same as the in-loop stamp: this is where the client first sees
                # the promoted call, and the item only closes several yields later.
                api_monitor.mark_first_token(monitor_id)
            for event in _healed_event_sse(events):
                yield event
        if final_visible:
            for event in _ensure_message_open():
                yield event
            full_text += final_visible
            message_state["text"] += final_visible
            api_monitor.append_reply(monitor_id, final_visible)
            yield _sse(
                "response.output_text.delta",
                {
                    "type": "response.output_text.delta",
                    "item_id": message_state["item_id"],
                    "output_index": message_state["output_index"],
                    "content_index": 0,
                    "delta": final_visible,
                },
            )

        close_items: list[tuple[int, str, dict[str, Any]]] = []
        if reasoning_state["opened"]:
            close_items.append((reasoning_state["output_index"], "reasoning", reasoning_state))
        if message_state["opened"]:
            close_items.append((message_state["output_index"], "message", message_state))
        close_items.extend((st["output_index"], "tool", st) for st in tool_call_state.values())

        for _, kind, st in sorted(close_items, key = lambda item: item[0]):
            if kind == "reasoning":
                yield _sse(
                    "response.reasoning_text.done",
                    {
                        "type": "response.reasoning_text.done",
                        "item_id": st["item_id"],
                        "output_index": st["output_index"],
                        "content_index": 0,
                        "text": full_reasoning,
                    },
                )
                yield _sse(
                    "response.content_part.done",
                    {
                        "type": "response.content_part.done",
                        "item_id": st["item_id"],
                        "output_index": st["output_index"],
                        "content_index": 0,
                        "part": {"type": "reasoning_text", "text": full_reasoning},
                    },
                )
                yield _sse(
                    "response.output_item.done",
                    {
                        "type": "response.output_item.done",
                        "output_index": st["output_index"],
                        "item": {
                            "type": "reasoning",
                            "id": st["item_id"],
                            "status": "completed",
                            "summary": [],
                            "content": [{"type": "reasoning_text", "text": full_reasoning}],
                        },
                    },
                )
                continue

            if kind == "message":
                # Per-item text: message items closed mid-stream (healed-call
                # rotation) already emitted their done events, so this state
                # carries only its own text, not the whole stream's.
                _msg_text = st["text"]
                yield _sse(
                    "response.output_text.done",
                    {
                        "type": "response.output_text.done",
                        "item_id": st["item_id"],
                        "output_index": st["output_index"],
                        "content_index": 0,
                        "text": _msg_text,
                    },
                )
                yield _sse(
                    "response.content_part.done",
                    {
                        "type": "response.content_part.done",
                        "item_id": st["item_id"],
                        "output_index": st["output_index"],
                        "content_index": 0,
                        "part": {"type": "output_text", "text": _msg_text, "annotations": []},
                    },
                )
                yield _sse(
                    "response.output_item.done",
                    {
                        "type": "response.output_item.done",
                        "output_index": st["output_index"],
                        "item": {
                            "type": "message",
                            "id": st["item_id"],
                            "status": "completed",
                            "role": "assistant",
                            "content": [
                                {"type": "output_text", "text": _msg_text, "annotations": []}
                            ],
                        },
                    },
                )
                continue

            # If id/name never arrived (malformed upstream), synthesise so the
            # client still sees a coherent frame sequence.
            if not st["opened"]:
                if not st["call_id"]:
                    st["call_id"] = f"call_{uuid.uuid4().hex[:12]}"
                item_added = {
                    "type": "response.output_item.added",
                    "output_index": st["output_index"],
                    "item": {
                        "type": "function_call",
                        "id": st["item_id"],
                        "status": "in_progress",
                        "call_id": st["call_id"],
                        "name": st["name"],
                        "arguments": "",
                    },
                }
                yield _sse("response.output_item.added", item_added)
                if st["arguments"]:
                    yield _sse(
                        "response.function_call_arguments.delta",
                        {
                            "type": "response.function_call_arguments.delta",
                            "item_id": st["item_id"],
                            "output_index": st["output_index"],
                            "delta": st["arguments"],
                        },
                    )
                st["opened"] = True

            args_done = {
                "type": "response.function_call_arguments.done",
                "item_id": st["item_id"],
                "output_index": st["output_index"],
                "name": st["name"],
                "arguments": st["arguments"],
            }
            yield _sse("response.function_call_arguments.done", args_done)

            item_done = {
                "type": "response.output_item.done",
                "output_index": st["output_index"],
                "item": {
                    "type": "function_call",
                    "id": st["item_id"],
                    "status": "completed",
                    "call_id": st["call_id"],
                    "name": st["name"],
                    "arguments": st["arguments"],
                },
            }
            api_monitor.append_reply(monitor_id, _monitor_call_text(st["name"], st["arguments"]))
            yield _sse("response.output_item.done", item_done)

        # response.completed
        total_tokens = input_tokens + output_tokens
        completed_response = {
            "type": "response.completed",
            "response": {
                "id": resp_id,
                "object": "response",
                "created_at": created_at,
                "status": "completed",
                "model": _clean_model,
                "output": _snapshot_output(),
                "usage": {
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "total_tokens": total_tokens,
                },
            },
        }
        # A healed call reaches the client as a function_call item while the upstream chunk
        # still says "stop", so report what this adapter emitted -- same rule the chat
        # stream's synthetic finish line applies.
        if healer is not None and healer.healed:
            stream_finish_reason = "tool_calls"
        if stream_finish_reason:
            api_monitor.set_perf(monitor_id, stop_reason = stream_finish_reason)
        api_monitor.finish(monitor_id)
        yield _sse("response.completed", completed_response)

    async def admitted_event_generator():
        # Register for the body's whole lifetime, admission wait included: the run holds a decode
        # slot from here on, so /load and /unload must count it. __exit__ runs from the finally below.
        _tracker.__enter__()
        lease = reservation.lease_nowait()
        admission_wait_started_at = None
        stream_started = False
        stream_cancelled = False
        iterator = None
        try:
            if lease is None:
                admission_wait_started_at = time.monotonic()
                _llama_admission_log(
                    "queued",
                    reservation,
                    request = request,
                    mode = "responses_stream",
                    completion_id = resp_id,
                    level = "debug",
                )
                # The tracked event, not just the client socket: registered above, so a forced swap's
                # cancel_all() reaches this run while it is still queued. Otherwise it takes a lease it was
                # told to give up and the post-cancel drain waits out the round trip it just cancelled.
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
                        mode = "responses_stream",
                        wait_started_at = admission_wait_started_at,
                        completion_id = resp_id,
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
            iterator = event_generator()
            stream_started = True
            try:
                async for chunk in iterator:
                    yield chunk
            except asyncio.CancelledError:
                stream_cancelled = True
                api_monitor.finish(monitor_id, "cancelled")
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
                mode = "responses_stream",
                wait_started_at = admission_wait_started_at,
                completion_id = resp_id,
                level = "warning",
            )
            api_monitor.fail(monitor_id, str(exc))
            yield _responses_admission_failed_sse(exc, status_code = 503)
        except LlamaAdmissionCancelled:
            _llama_admission_log(
                "cancelled-before-upstream",
                reservation,
                request = request,
                mode = "responses_stream",
                wait_started_at = admission_wait_started_at,
                completion_id = resp_id,
                level = "debug",
            )
            api_monitor.finish(monitor_id, "cancelled")
            return
        except asyncio.CancelledError:
            api_monitor.finish(monitor_id, "cancelled")
            raise
        finally:
            if lease is not None:
                lease.release()
            if not stream_started:
                api_monitor.finish(monitor_id, "cancelled")
                reservation.cancel()
            _tracker.__exit__(None, None, None)

    async def _responses_admission_unstarted_cleanup() -> None:
        api_monitor.finish(monitor_id, "cancelled")
        reservation.cancel()

    return _SameTaskStreamingResponse(
        admitted_event_generator(),
        media_type = "text/event-stream",
        headers = {
            "Cache-Control": "no-cache",
            "Connection": "close",
            "X-Accel-Buffering": "no",
        },
        unstarted_cleanup = _responses_admission_unstarted_cleanup,
    )


@router.post("/responses")
async def openai_responses(
    payload: ResponsesRequest,
    request: Request,
    current_subject: str = Depends(get_current_subject),
):
    """
    OpenAI Responses API endpoint.

    Accepts a Responses-format request, converts it to a ChatCompletionRequest
    internally, and returns a response matching the Responses API schema
    (output array, input_tokens/output_tokens, named SSE events for streaming).
    """
    messages = _normalise_responses_input(payload)
    if not messages:
        raise HTTPException(status_code = 400, detail = "No input provided.")
    # System/developer-only input normalises to a non-empty list, so reject it
    # before the switch (mirror chat) or an invalid request evicts the resident
    # model only for the chat handler to 400 it as having no non-system message.
    if not any(m.role not in ("system", "developer") for m in messages):
        raise HTTPException(status_code = 400, detail = "At least one non-system message is required.")
    # Reject a malformed function tool before any model load, mirroring the
    # /v1/chat/completions check, so an invalid request never switches the model.
    # Built-in tools (web_search, mcp, ...) carry no name and are dropped later.
    for _tool in payload.tools or []:
        if not isinstance(_tool, dict) or _tool.get("type") != "function":
            continue
        _name = _tool.get("name")
        if not isinstance(_name, str) or not _name.strip():
            raise HTTPException(
                status_code = 400,
                detail = openai_error_body(
                    "Invalid 'tools': each function tool must have a 'name'.",
                    status = 400,
                    code = "invalid_value",
                    param = "tools",
                ),
            )
    # Reject a forcing-function tool_choice with no name before the switch (mirror
    # chat), so a malformed request can't evict the model. Responses forces with
    # {"type": "function", "name": "X"}; the streaming path would otherwise forward
    # the bad choice and the non-streaming path only 400s after the swap.
    _tc = payload.tool_choice
    if isinstance(_tc, dict) and _tc.get("type") == "function":
        _tc_name = _tc.get("name")
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
    # After input validation so a 400 never triggers a load. Switches the
    # streaming path; non-streaming re-checks via the idempotent chat handler.
    # require_vision rejects a swap to a text-only target before it runs, so an
    # image request can't evict the resident vision model only to 400 afterwards
    # (the non-streaming chat re-check short-circuits on _already_serving).
    await _maybe_auto_switch_model(
        _switch_model_for_payload(payload),
        request,
        current_subject,
        require_vision = _messages_have_image(messages),
    )

    if payload.stream:
        monitor_id = None
        if not getattr(request.state, "skip_api_monitor", False):
            monitor_id = api_monitor.start(
                endpoint = request.url.path,
                via_api_key = _request_used_api_key(request),
                method = request.method,
                model = payload.model,
                prompt = _monitor_prompt_from_messages(messages),
                context_length = _monitor_context_length(),
                subject = current_subject,
            )
        try:
            return await _responses_stream(payload, messages, request, monitor_id)
        except HTTPException as exc:
            detail = exc.detail
            if not isinstance(detail, str):
                detail = json.dumps(detail, default = str)
            api_monitor.fail(monitor_id, detail)
            raise
        except Exception as exc:
            api_monitor.fail(monitor_id, _friendly_error(exc))
            raise
    return await _responses_non_streaming(payload, messages, request, current_subject)

