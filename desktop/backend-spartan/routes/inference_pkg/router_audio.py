"""OpenAI-compatible Audio API Router (/v1/audio/speech, /v1/audio/transcriptions, /audio/generate).

Extracted from monolithic routes/inference.py to preserve SRP and clean architecture.
"""
from __future__ import annotations

import asyncio
import base64
import logging
import sys
import threading
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.responses import JSONResponse, PlainTextResponse

from auth import get_current_subject
from core.inference.api_monitor import api_monitor
from core.inference.llama_cpp import LlamaCppBackend
from models.inference import AudioSpeechRequest, ChatCompletionRequest
from core.inference.audio_errors import AudioBackendUnsupportedError, AudioGenerationCancelledError
from utils.utils import safe_error_detail

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_inference_module():
    return sys.modules.get("routes.inference")


def _get_inf_attr(name: str, fallback=None):
    mod = _get_inference_module()
    if mod and hasattr(mod, name):
        return getattr(mod, name)
    return fallback

def get_inference_backend():
    fn = _get_inf_attr("get_inference_backend")
    return fn() if fn else None

def public_model_id(model_id):
    fn = _get_inf_attr("public_model_id")
    return fn(model_id) if fn else model_id

def _fill_recommended_sampling_openai(payload, model_id):
    fn = _get_inf_attr("_fill_recommended_sampling_openai")
    if fn:
        fn(payload, model_id)

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

async def _await_disconnect_then_cancel(*args, **kwargs):
    fn = _get_inf_attr("_await_disconnect_then_cancel")
    if fn:
        return await fn(*args, **kwargs)

async def _direct_llama_request(*args, **kwargs):
    fn = _get_inf_attr("_direct_llama_request")
    if fn:
        return await fn(*args, **kwargs)

async def _stop_local_disconnect_cancel_watcher(*args, **kwargs):
    fn = _get_inf_attr("_stop_local_disconnect_cancel_watcher")
    if fn:
        return await fn(*args, **kwargs)

def _tts_max_new_tokens(voice, text):
    fn = _get_inf_attr("_tts_max_new_tokens")
    return fn(voice, text) if fn else 4096


def get_llama_cpp_backend():
    fn = _get_inf_attr("get_llama_cpp_backend")
    if fn:
        return fn()
    return LlamaCppBackend()


def _friendly_error(e):
    fn = _get_inf_attr("_friendly_error")
    return fn(e) if fn else str(e)


def _raise_if_prompt_leaves_no_speech_budget(text: str) -> None:
    fn = _get_inf_attr("_raise_if_prompt_leaves_no_speech_budget")
    if fn:
        fn(text)


def _maybe_auto_switch_model(*args, **kwargs):
    fn = _get_inf_attr("_maybe_auto_switch_model")
    if fn:
        return fn(*args, **kwargs)


def _llama_public_model_id(llama_backend, fallback: Optional[str] = None) -> Optional[str]:
    fn = _get_inf_attr("_llama_public_model_id")
    return fn(llama_backend, fallback) if fn else fallback


def _extract_content_parts(messages: list):
    fn = _get_inf_attr("_extract_content_parts")
    if fn:
        return fn(messages)
    from routes.inference_pkg.multimodal_media import _extract_content_parts as fn2
    return fn2(messages)


def _stt_engine_for_model(model_name: Optional[str]) -> str:
    fn = _get_inf_attr("_stt_engine_for_model")
    if fn:
        return fn(model_name)
    from routes.inference_pkg.router_stt_studio import _stt_engine_for_model as fn2
    return fn2(model_name)


async def _transcribe_audio_result(*args, **kwargs):
    fn = _get_inf_attr("_transcribe_audio_result")
    if fn:
        return await fn(*args, **kwargs)
    raise RuntimeError("_transcribe_audio_result not available")


_RELOAD_ONLY_MODEL = "reload_only"
AUDIO_GENERATION_MAX_TOKENS = 2048
_MAX_AUDIO_RAW_BYTES = 25 * 1024 * 1024

# Audio (TTS) Generation  (/audio/generate)
# =====================================================================

_TRANSFORMERS_TTS_AUDIO_TYPES = frozenset(("snac", "csm", "bicodec", "dac"))
_GGUF_TTS_AUDIO_TYPES = frozenset(("snac", "bicodec", "dac"))


async def _generate_tts_wav(
    text: str, payload: ChatCompletionRequest, request: Request, current_subject: str
) -> tuple[bytes, int, str, Optional[str]]:
    """Shared core of /audio/generate and /audio/speech. Returns
    (wav_bytes, sample_rate, model_name, audio_type)."""
    _raise_if_prompt_leaves_no_speech_budget(text)
    # Restore an idle-evicted GGUF before selecting a backend: this path is
    # keep-warm-tracked but had no reload hook, so a standalone idle TTL could
    # unload an audio GGUF the next request then failed to restore. Validation
    # above ran first, so an invalid request never triggers a reload.
    #
    # Reload-only on purpose: a local GGUF's audio-input capability is not a cheap
    # pre-load probe (the companion mmproj signal can't tell an audio projector
    # from a vision one, and codec-based TTS ships no projector at all), so passing
    # the client model through the resolver could load a text- or vision-only target
    # and evict the working audio model before the audio backend check fails. Only
    # the idle-stash restore runs here; switching TTS models is an explicit /load.
    await _maybe_auto_switch_model(_RELOAD_ONLY_MODEL, request, current_subject)
    # Again, now that a context exists to measure against. The check above runs before the
    # restore so an invalid request never triggers a reload, but with nothing loaded it has
    # no context length and passes everything, so the first request after an idle eviction
    # would reach generation over-context and come back as a one-token clip.
    _raise_if_prompt_leaves_no_speech_budget(text)

    # Created before the backend pick so the GGUF lambda can close over it; the registration
    # that arms it is below, once the model name is known.
    _audio_cancel = threading.Event()

    # Pick backend — both return (wav_bytes, sample_rate)
    llama_backend = get_llama_cpp_backend()
    # GGUF TTS goes straight to llama-server /completion, holding a slot with no
    # admission lease, so only the direct counter can show it in the slot readout.
    _direct_llama_tts = bool(llama_backend.is_loaded and getattr(llama_backend, "_is_audio", False))
    if _direct_llama_tts:
        # Advertised repo id after an auto-switch load, else a clean public id,
        # never the absolute .gguf path.
        model_name = _llama_public_model_id(llama_backend)
        audio_type = getattr(llama_backend, "_audio_type", None)
        supported_audio_types = _GGUF_TTS_AUDIO_TYPES
        _audio_model_id = getattr(llama_backend, "model_identifier", None) or model_name
        gen = lambda: llama_backend.generate_audio_response(
            text = text,
            audio_type = llama_backend._audio_type,
            temperature = payload.temperature,
            top_p = payload.top_p,
            top_k = payload.top_k,
            min_p = payload.min_p,
            max_new_tokens = _tts_max_new_tokens(payload, text),
            repetition_penalty = payload.repetition_penalty,
            cancel_event = _audio_cancel,
        )
    else:
        backend = await asyncio.to_thread(get_inference_backend)
        if not backend.active_model_name:
            raise HTTPException(status_code = 400, detail = "No model loaded.")
        model_info = backend.models.get(backend.active_model_name, {})
        if not model_info.get("is_audio"):
            raise HTTPException(status_code = 400, detail = "Active model is not an audio model.")
        model_name = public_model_id(backend.active_model_name)
        audio_type = model_info.get("audio_type")
        supported_audio_types = _TRANSFORMERS_TTS_AUDIO_TYPES
        _audio_model_id = getattr(backend, "active_model_name", None) or model_name
        gen = lambda: backend.generate_audio_response(
            text = text,
            temperature = payload.temperature,
            top_p = payload.top_p,
            top_k = payload.top_k,
            min_p = payload.min_p,
            max_new_tokens = _tts_max_new_tokens(payload, text),
            repetition_penalty = payload.repetition_penalty,
            use_adapter = payload.use_adapter,
            cancel_event = _audio_cancel,
        )

    if audio_type not in supported_audio_types:
        raise HTTPException(
            status_code = 400,
            detail = f"Active model does not support text-to-speech (audio_type={audio_type or 'unknown'}).",
        )

    # Apply per-model recommended sampling + any operator UNSLOTH_SAMPLING_* pin before
    # generating, so `unsloth run --temperature` (and the other pins) and per-model
    # recommendations reach audio (TTS) generation too, not just chat. The gen lambdas read
    # payload.* lazily at call time, so filling here takes effect; this covers both the direct
    # /audio/generate route and the chat-completions audio branches that delegate here.
    _fill_recommended_sampling_openai(payload, _audio_model_id)

    # TTS holds the model for the whole request, so unregistered a non-forced swap counted zero
    # generations and tore the model down mid-generation. Both GGUF and subprocess paths observe
    # the request event. No cancel keys: /cancel addresses streams, and this route has none; the
    # disconnect watcher below is the cancellation source.
    with _TrackedCancel(
        _audio_cancel,
        thread_id = getattr(payload, "thread_id", None),
        model = model_name,
        kind = "audio",
    ):
        # Stop in the UI aborts the fetch and nothing more, and this route has no cancel id to
        # address, so without watching the disconnect llama-server kept generating for the rest
        # of the request timeout after the chat had already reported it stopped.
        _audio_watcher = asyncio.create_task(_await_disconnect_then_cancel(request, _audio_cancel))
        try:
            with _direct_llama_request(_direct_llama_tts):
                wav_bytes, sample_rate = await asyncio.to_thread(gen)
        except Exception as e:
            # An idle auto-unload cancels through the backend without setting this route's event.
            if _audio_cancel.is_set() or isinstance(e, AudioGenerationCancelledError):
                raise HTTPException(status_code = 499, detail = "Audio generation cancelled")
            # Missing capability, not a failure: no retry helps, and the message
            # carries no path or user input, so send it as written.
            if isinstance(e, AudioBackendUnsupportedError):
                logger.info("Audio generation unsupported on this backend: %s", e.detail)
                raise HTTPException(status_code = 501, detail = e.message)
            logger.error(f"Audio generation error: {e}", exc_info = True)
            raise HTTPException(status_code = 500, detail = safe_error_detail(e))
        finally:
            await _stop_local_disconnect_cancel_watcher(_audio_watcher)

    return wav_bytes, sample_rate, model_name, audio_type


def _wav_duration_seconds(wav_bytes: bytes, sample_rate: int) -> float:
    """Duration of an in-memory WAV, from its own header when readable."""
    import io
    import wave

    try:
        with wave.open(io.BytesIO(wav_bytes)) as wav:
            rate = wav.getframerate() or sample_rate
            return round(wav.getnframes() / rate, 3) if rate else 0.0
    except Exception:  # noqa: BLE001 - fall back to the 16-bit mono pcm the codecs emit
        payload_bytes = max(0, len(wav_bytes) - 44)
        return round(payload_bytes / (2 * sample_rate), 3) if sample_rate else 0.0


def _persist_tts_clip(
    wav_bytes: bytes, sample_rate: int, text: str, model_name: str, audio_type: Optional[str]
) -> Optional[dict[str, Any]]:
    """Best-effort gallery save: persistence never fails the request that produced
    the audio. Blocking, so callers run it off the event loop."""
    from core.inference import audio_gallery
    try:
        return audio_gallery.save(
            wav_bytes,
            {
                "prompt": text,
                "model": model_name,
                "audio_type": audio_type or "unknown",
                "sample_rate": sample_rate,
                "duration_s": _wav_duration_seconds(wav_bytes, sample_rate),
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            },
        )
    except Exception as exc:  # noqa: BLE001 - log and serve the audio anyway
        logger.warning("audio_gallery.persist_failed: %s", exc)
        return None


@router.post("/audio/generate")
async def generate_audio(
    payload: ChatCompletionRequest,
    request: Request,
    current_subject: str = Depends(get_current_subject),
):
    """Generate audio (TTS) from the latest user message, as base64 WAV.
    Works with both GGUF (llama-server) and Unsloth/transformers backends."""
    import base64

    # Extract text from the last user message
    _, chat_messages, _ = _extract_content_parts(payload.messages)
    if not chat_messages:
        raise HTTPException(status_code = 400, detail = "No messages provided.")
    last_user_msg = next((m for m in reversed(chat_messages) if m["role"] == "user"), None)
    if not last_user_msg:
        raise HTTPException(status_code = 400, detail = "No user message found.")
    text = last_user_msg["content"]

    wav_bytes, sample_rate, model_name, audio_type = await _generate_tts_wav(
        text, payload, request, current_subject
    )
    persisted_clip = await asyncio.to_thread(
        _persist_tts_clip, wav_bytes, sample_rate, text, model_name, audio_type
    )

    audio_b64 = base64.b64encode(wav_bytes).decode("ascii")
    return JSONResponse(
        content = {
            "id": f"chatcmpl-{uuid.uuid4().hex[:12]}",
            "object": "chat.completion.audio",
            "model": model_name,
            "clip_id": persisted_clip.get("id") if persisted_clip else None,
            "audio": {"data": audio_b64, "format": "wav", "sample_rate": sample_rate},
            "choices": [
                {
                    "index": 0,
                    "message": {
                        "role": "assistant",
                        "content": f'[Generated audio from: "{text[:100]}"]',
                    },
                    "finish_reason": "stop",
                }
            ],
        }
    )


# openai-compatible speech api: the router's dual mount also answers /v1/audio/speech
@router.post("/audio/speech")
async def openai_audio_speech(
    body: AudioSpeechRequest,
    request: Request,
    current_subject: str = Depends(get_current_subject),
) -> Response:
    """OpenAI-compatible text-to-speech (POST /v1/audio/speech).

    ``model`` is informational (the loaded audio model is used); ``voice`` and ``speed``
    are ignored. Only WAV exists, so another ``response_format`` is a 400 rather than a
    silent container mismatch."""
    fmt = (body.response_format or "wav").strip().lower()
    if fmt != "wav":
        raise HTTPException(
            status_code = 400,
            detail = f"Unsupported response_format '{body.response_format}'. Only 'wav' is supported.",
        )
    # The tts core reads its sampling knobs from a chat request shape; defaults apply here.
    # max_tokens is set explicitly because the OpenAI CreateSpeech shape has no field for it,
    # so the chat default of 2048 would silently truncate any input past ~30s of speech and
    # still return HTTP 200 with a short WAV.
    # Unlike the Audio page, which loads with headroom for both, this route is reachable
    # after any /api/inference/load, including the default max_seq_length=0 that becomes
    # 2048. Asking for the full ceiling against that context overflows or truncates, so
    # cap to what is actually left once the prompt is accounted for.
    # The over-context check lives in _generate_tts_wav, so both routes share it.
    payload = ChatCompletionRequest(
        messages = [{"role": "user", "content": body.input}],
        max_tokens = AUDIO_GENERATION_MAX_TOKENS,
    )
    wav_bytes, sample_rate, model_name, audio_type = await _generate_tts_wav(
        body.input, payload, request, current_subject
    )
    await asyncio.to_thread(
        _persist_tts_clip, wav_bytes, sample_rate, body.input, model_name, audio_type
    )
    return Response(content = wav_bytes, media_type = "audio/wav")


# openai-compatible transcription api, dual-mounted like /audio/speech; runs on the stt sidecar, not the main gpu slot
@router.post("/audio/transcriptions")
async def openai_audio_transcriptions(
    request: Request,
    file: UploadFile = File(...),
    model: Optional[str] = Form(None),
    language: Optional[str] = Form(None),
    response_format: str = Form("json"),
    current_subject: str = Depends(get_current_subject),
):
    """OpenAI-compatible speech-to-text (POST /v1/audio/transcriptions).

    ``model`` maps to a sidecar model id, with ``whisper-1`` or nothing selecting the
    default. ``response_format`` supports ``json`` and ``text``."""
    fmt = (response_format or "json").strip().lower()
    if fmt not in ("json", "text"):
        raise HTTPException(
            status_code = 400,
            detail = f"Unsupported response_format '{response_format}'. Use 'json' or 'text'.",
        )
    # UploadFile spools to disk, but an unbounded read materializes the whole upload in
    # memory before the shared size check. One byte past the limit is enough to reject it.
    raw = await file.read(_MAX_AUDIO_RAW_BYTES + 1)
    # openai's whisper-1 placeholder means the default transcription model, not a sidecar id
    sidecar_model = None if model in (None, "", "whisper-1") else model
    result = await _transcribe_audio_result(
        raw,
        sidecar_model,
        language,
        fast = False,
        engine = _stt_engine_for_model(sidecar_model),
        request = request,
    )
    if fmt == "text":
        return PlainTextResponse(content = str(result.get("text", "")))
    return JSONResponse(content = {"text": result.get("text", "")})

