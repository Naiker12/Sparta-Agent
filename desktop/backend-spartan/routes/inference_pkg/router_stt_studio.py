"""Studio Speech-To-Text (STT) and Audio Transcribe Router.

Extracted from monolithic routes/inference.py to preserve SRP and clean architecture.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.responses import JSONResponse, PlainTextResponse

from auth import get_current_subject
from hub.dependencies import get_hf_token
from models.inference import SttLoadRequest, TranscribeRequest
from utils.upload_limits import STT_AUDIO_B64_MAX_CHARS, STT_AUDIO_RAW_MAX_BYTES

logger = logging.getLogger(__name__)

router = APIRouter()
studio_router = router  # alias for backward-compatibility with decorators

_MAX_AUDIO_RAW_BYTES = STT_AUDIO_RAW_MAX_BYTES

# =====================================================================
# Speech-to-text (STT) sidecar  (/audio/transcribe, /audio/stt/*)
# =====================================================================


def _stt_engine_for_model(model: Optional[str]) -> Optional[str]:
    """The engine an STT id *requires*, or None to leave the default alone.

    Qwen3-ASR only runs on the mtmd sidecar; without this an explicit id fell through to
    the Transformers Whisper sidecar, which rejects it.
    """
    if not model:
        return None
    from core.inference.stt_mtmd_sidecar import is_mtmd_model

    # Only the mtmd ids are forced. Whisper ids are shared with the Transformers
    # sidecar and work there, so leaving them alone keeps the default behaviour.
    return "mtmd" if is_mtmd_model(model.strip()) else None


def _resolve_stt_engine(engine: Optional[str]) -> str:
    """Normalize the requested STT engine name; default is Transformers."""
    normalized = (engine or "transformers").strip().lower()
    if normalized in ("", "transformers", "whisper"):
        return "transformers"
    if normalized in ("gguf", "ggml", "whisper_cpp", "whisper.cpp"):
        return "gguf"
    if normalized in ("mtmd", "llama_cpp", "llama.cpp"):
        return "mtmd"
    raise HTTPException(
        status_code = 422,
        detail = f"Unknown STT engine '{engine}'. Use 'transformers', 'gguf', or 'mtmd'.",
    )


def _resolve_serving_stt_engine(engine: Optional[str]) -> str:
    """Resolve the engine that will actually serve a model.

    whisper.cpp (gguf) only accepts curated ids, which Transformers serves too,
    so when whisper-server is not installed (the common case: `unsloth studio
    update` does not yet build it) fall back to Transformers instead of 501-ing
    on every recording. Used for download/load/transcribe; unload targets a
    specific engine via _resolve_stt_engine.
    """
    resolved = _resolve_stt_engine(engine)
    if resolved == "gguf":
        from core.inference import stt_ggml_sidecar
        if not stt_ggml_sidecar.is_available():
            return "transformers"
    # mtmd models exist in no other engine, so there is nothing to fall back to.
    return resolved


def _prepare_runtime_fallback_checkpoint(
    requested_engine: Optional[str],
    serving_engine: str,
    model: Optional[str],
    hf_token: Optional[str] = None,
) -> None:
    """Fetch the Transformers snapshot a broken whisper.cpp runtime now falls back to.

    A GGUF pick downloads one .bin file, so when the runtime turns out to be broken at
    inference time the Transformers engine it is redirected to has no snapshot and every
    retry raises SttModelNotDownloadedError instead of the promised fallback. The two
    engines share curated ids, so the equivalent snapshot is known and is fetched in the
    background here; /audio/stt/status reports its progress and the next attempt lands on
    a usable checkpoint. Only for a runtime that broke: whisper-server simply not being
    installed already routes the download itself through Transformers.
    """
    if serving_engine != "transformers" or _resolve_stt_engine(requested_engine) != "gguf":
        return
    from core.inference import stt_ggml_sidecar, stt_sidecar

    if stt_ggml_sidecar.runtime_inference_failure() is None:
        return
    if stt_sidecar.is_model_downloaded(model):
        return
    try:
        stt_sidecar.start_model_download(model, hf_token)
    except Exception as exc:  # noqa: BLE001 - preparation is best effort, never fatal
        # Another dictation model already downloading is the common case, and the caller
        # is about to report "not downloaded" anyway.
        logger.info(
            "Could not start the Transformers fallback download for STT model %r: %s",
            model,
            exc,
        )


def _stt_download_module(engine: str):
    """Module owning download/status for an engine."""
    if engine == "mtmd":
        from core.inference import stt_mtmd_sidecar
        return stt_mtmd_sidecar
    if engine == "gguf":
        from core.inference import stt_ggml_sidecar
        return stt_ggml_sidecar
    from core.inference import stt_sidecar

    return stt_sidecar


def _stt_sidecar_for(engine: str):
    """The sidecar serving an engine. One resolver, shared with the orchestrator."""
    from core.inference import stt_registry
    return stt_registry.sidecar_for(engine)


def _stt_lifecycle() -> tuple:
    """(load, unload) for dictation models, off the orchestrator when it exists.

    Same object Model Hub loads a chat model with, so one thing knows everything
    resident. Its methods only forward to `stt_registry`, so a cold process
    calls that directly rather than constructing an orchestrator (which blocks
    on hardware detection) to load a model that never touches the chat worker.
    """
    from core.inference import stt_registry
    from core.inference.orchestrator import peek_inference_backend

    backend = peek_inference_backend()
    if backend is None:
        return stt_registry.load, stt_registry.unload
    return backend.load_stt_model, backend.unload_stt_model


@studio_router.get("/audio/stt/status")
async def stt_status(
    model: Optional[str] = None, current_subject: str = Depends(get_current_subject)
):
    """Report STT availability and which model, if any, is resident.

    ``model`` extends the Transformers ``downloaded_models`` check to a
    custom Hugging Face repository beyond the curated defaults.
    """
    from core.inference import stt_ggml_sidecar, stt_mtmd_sidecar, stt_sidecar
    from core.inference.stt_sidecar import (
        DEFAULT_STT_MODEL,
        STT_MODELS,
        get_stt_sidecar,
        is_available,
    )

    sidecar = get_stt_sidecar()
    ggml = stt_ggml_sidecar.get_ggml_stt_sidecar()
    mtmd = stt_mtmd_sidecar.get_mtmd_stt_sidecar()
    transformers_downloaded = [
        model_id for model_id in STT_MODELS if stt_sidecar.is_model_downloaded(model_id)
    ]
    if model and model not in STT_MODELS and stt_sidecar.is_model_downloaded(model):
        transformers_downloaded.append(model)
    return JSONResponse(
        content = {
            "available": is_available(),
            "loaded_model": sidecar.loaded_model,
            "loading": sidecar.is_loading(),
            "device": sidecar.device,
            "keep_alive_seconds": sidecar.keep_alive_seconds,
            "default_model": DEFAULT_STT_MODEL,
            "models": list(STT_MODELS.keys()),
            # Transformers engine, same shape as "gguf" below so clients read
            # either generically. Top-level fields above kept for old clients.
            "transformers": {
                "available": is_available(),
                "loaded_model": sidecar.loaded_model,
                "loading": sidecar.is_loading(),
                "device": sidecar.device,
                "keep_alive_seconds": sidecar.keep_alive_seconds,
                "default_model": DEFAULT_STT_MODEL,
                "models": list(STT_MODELS.keys()),
                "downloaded_models": transformers_downloaded,
                "download": stt_sidecar.download_status(),
            },
            # llama.cpp (mtmd) engine: non-Whisper ASR models.
            "mtmd": {
                "available": stt_mtmd_sidecar.is_available(),
                "loaded_model": mtmd.loaded_model,
                "loading": mtmd.is_loading(),
                "device": mtmd.device,
                "keep_alive_seconds": mtmd.keep_alive_seconds,
                "default_model": None,
                "models": list(stt_mtmd_sidecar.MTMD_STT_MODELS),
                "downloaded_models": [
                    model_id
                    for model_id in stt_mtmd_sidecar.MTMD_STT_MODELS
                    if stt_mtmd_sidecar.is_model_downloaded(model_id)
                ],
                "download": stt_mtmd_sidecar.download_status(),
            },
            # whisper.cpp (GGUF) engine.
            "gguf": {
                "available": stt_ggml_sidecar.is_available(),
                "loaded_model": ggml.loaded_model,
                "loading": ggml.is_loading(),
                "device": ggml.device,
                "keep_alive_seconds": ggml.keep_alive_seconds,
                "default_model": stt_ggml_sidecar.DEFAULT_GGML_STT_MODEL,
                "models": list(stt_ggml_sidecar.GGML_STT_MODELS.keys()),
                "downloaded_models": [
                    model_id
                    for model_id in stt_ggml_sidecar.GGML_STT_MODELS
                    if stt_ggml_sidecar._cached_model_path(model_id) is not None
                ],
                "download": stt_ggml_sidecar.download_status(),
            },
        }
    )


@studio_router.post("/audio/stt/download")
async def stt_download(
    payload: SttLoadRequest,
    current_subject: str = Depends(get_current_subject),
    hf_token: Optional[str] = Depends(get_hf_token),
):
    """Start a background download of a dictation model.

    Both engines download directly (a GGML checkpoint is a single file the Model
    Hub's GGUF variant planner cannot express; a Transformers checkpoint is a
    whole snapshot). Progress is reported by /audio/stt/status.
    """
    from core.inference import stt_ggml_sidecar, stt_sidecar
    from core.inference.stt_sidecar import (
        SttModelCompatibilityError,
        SttModelIdError,
        validate_remote_model,
    )

    engine = _resolve_serving_stt_engine(payload.engine)
    module = _stt_download_module(engine)
    try:
        # Transformers accepts custom `owner/model` repos, so confirm the repo is
        # a Whisper checkpoint (metadata-only) before snapshot_download pulls a
        # possibly-large non-STT repo into the shared cache. Curated ids
        # short-circuit; GGUF and mtmd accept curated ids only, so they skip it.
        if engine == "transformers":
            validated = await asyncio.to_thread(validate_remote_model, payload.model, hf_token)
            # Pin the download to the commit that was just validated so the
            # repo cannot be swapped between validation and snapshot_download.
            await asyncio.to_thread(
                module.start_model_download,
                payload.model,
                hf_token,
                validated.get("revision"),
            )
        else:
            await asyncio.to_thread(module.start_model_download, payload.model, hf_token)
    except SttModelIdError as e:
        raise HTTPException(status_code = 422, detail = str(e))
    except SttModelCompatibilityError as e:
        raise HTTPException(status_code = 422, detail = str(e))
    return JSONResponse(content = module.download_status())


@studio_router.post("/audio/stt/download/cancel")
async def stt_download_cancel(
    payload: Optional[SttLoadRequest] = None, current_subject: str = Depends(get_current_subject)
):
    """Stop an in-flight dictation model download.

    Partial files stay cached, so the same download resumes. Cancelling when
    nothing is downloading is a no-op, so a double click cannot fail.
    """
    from core.inference import stt_ggml_sidecar, stt_sidecar

    engine = _resolve_serving_stt_engine(payload.engine if payload else None)
    module = _stt_download_module(engine)
    cancelled = await asyncio.to_thread(module.cancel_model_download)
    # This request's result last: download_status() carries its own historical
    # "cancelled", which would otherwise report a no-op as a cancellation.
    return JSONResponse(content = {**module.download_status(), "cancelled": cancelled})


@studio_router.post("/audio/stt/load")
async def stt_load(
    payload: SttLoadRequest,
    request: Request,
    current_subject: str = Depends(get_current_subject),
):
    """Load the selected STT model after the user starts local dictation."""
    from core.inference.stt_sidecar import (
        SttLoadCancelledError,
        SttModelBusyError,
        SttModelCompatibilityError,
        SttModelIdError,
        SttModelNotDownloadedError,
        SttTranscriptionCancelledError,
        SttUnavailableError,
        get_stt_sidecar,
    )

    engine = _resolve_serving_stt_engine(payload.engine)
    await asyncio.to_thread(
        _prepare_runtime_fallback_checkpoint,
        payload.engine,
        engine,
        payload.model,
    )
    sidecar = _stt_sidecar_for(engine)
    load_stt, _ = _stt_lifecycle()
    cancel_event = threading.Event()
    disconnect_watcher = asyncio.create_task(
        _await_stt_disconnect_then_cancel(request, sidecar, cancel_event)
    )
    try:
        await asyncio.to_thread(load_stt, payload.model, engine, cancel_event)
    except SttModelNotDownloadedError as e:
        raise HTTPException(status_code = 409, detail = str(e))
    except SttUnavailableError as e:
        raise HTTPException(status_code = 501, detail = str(e))
    except (SttLoadCancelledError, SttTranscriptionCancelledError) as e:
        raise HTTPException(status_code = 409, detail = str(e))
    except SttModelBusyError as e:
        raise HTTPException(status_code = 409, detail = str(e))
    except SttModelIdError as e:
        raise HTTPException(status_code = 422, detail = str(e))
    except SttModelCompatibilityError as e:
        raise HTTPException(status_code = 422, detail = str(e))
    except Exception as e:
        logger.error(f"STT load error: {e}", exc_info = True)
        raise HTTPException(status_code = 500, detail = safe_error_detail(e))
    finally:
        await _stop_local_disconnect_cancel_watcher(disconnect_watcher)
    return JSONResponse(content = {"loaded_model": sidecar.loaded_model, "device": sidecar.device})


@studio_router.post("/audio/stt/validate")
async def stt_validate(
    payload: SttLoadRequest,
    current_subject: str = Depends(get_current_subject),
    hf_token: Optional[str] = Depends(get_hf_token),
):
    """Verify a Hub repository is a Whisper checkpoint before downloading it."""
    from core.inference.stt_sidecar import (
        SttModelCompatibilityError,
        SttModelIdError,
        validate_remote_model,
    )

    try:
        result = await asyncio.to_thread(validate_remote_model, payload.model, hf_token)
    except (SttModelIdError, SttModelCompatibilityError) as e:
        raise HTTPException(status_code = 422, detail = str(e))
    return JSONResponse(content = result)


@studio_router.post("/audio/stt/unload")
async def stt_unload(
    engine: Optional[str] = None,
    model: Optional[str] = None,
    current_subject: str = Depends(get_current_subject),
):
    """Release the local STT model when dictation is idle.

    Without an engine, both sidecars unload so an engine switch in Voice
    settings always frees whichever backend was resident. ``model`` scopes the
    release to the model the caller claims: a surface owns one model, and another
    can switch the same engine between that ownership check and this request
    arriving, so the sidecar re-checks under its own lock rather than releasing
    whatever happens to be resident by then.
    """
    if engine is None:
        engines = None
    else:
        # Use the serving resolver: a "gguf" pick without whisper-server is
        # actually served by the Transformers fallback, so unload must target
        # that same engine or the resident model is never freed.
        engines = [_resolve_serving_stt_engine(engine)]
    # Every engine is attempted even if one raises, so failing to free one never
    # skips the other (both can be resident after a switch).
    _, unload_stt = _stt_lifecycle()
    # expected_model by keyword: _stt_lifecycle returns the orchestrator's
    # unload_stt_model when a backend is resident and stt_registry.unload when one
    # is not, and only the former takes it positionally. Registry-side it sits
    # behind a `*`, so passing it positionally raised TypeError, which is the
    # state a fresh process is in before anything has loaded.
    failed: list[str] = await asyncio.to_thread(unload_stt, engines, expected_model = model)
    if failed:
        raise HTTPException(
            status_code = 500,
            detail = f"Failed to unload STT engine(s): {', '.join(failed)}",
        )
    return JSONResponse(content = {"loaded_model": None, "device": None})


async def _transcribe_audio_bytes(
    raw: bytes,
    model: Optional[str],
    language: Optional[str],
    fast: bool,
    engine: Optional[str] = None,
    request: Optional[Request] = None,
) -> JSONResponse:
    """Run STT for already-decoded request bytes."""
    return JSONResponse(
        content = await _transcribe_audio_result(raw, model, language, fast, engine, request)
    )


async def _transcribe_audio_result(
    raw: bytes,
    model: Optional[str],
    language: Optional[str],
    fast: bool,
    engine: Optional[str] = None,
    request: Optional[Request] = None,
) -> dict:
    """STT for already-decoded bytes, sidecar errors mapped to HTTP statuses.
    Returns the sidecar's result dict so callers own the response shape."""
    from core.inference.stt_sidecar import (
        SttAudioDecodeError,
        SttAudioTooLongError,
        SttLanguageError,
        SttLoadCancelledError,
        SttModelBusyError,
        SttModelCompatibilityError,
        SttModelIdError,
        SttModelNotDownloadedError,
        SttUnavailableError,
        SttTranscriptionCancelledError,
    )

    if not raw:
        raise HTTPException(status_code = 400, detail = "Audio is empty.")
    if len(raw) > _MAX_AUDIO_RAW_BYTES:
        raise HTTPException(status_code = 413, detail = "Audio is too large.")

    serving_engine = _resolve_serving_stt_engine(engine)
    await asyncio.to_thread(
        _prepare_runtime_fallback_checkpoint,
        engine,
        serving_engine,
        model,
    )
    sidecar = _stt_sidecar_for(serving_engine)
    cancel_event = threading.Event() if request is not None else None
    disconnect_watcher = (
        asyncio.create_task(_await_stt_disconnect_then_cancel(request, sidecar, cancel_event))
        if request is not None and cancel_event is not None
        else None
    )
    try:
        # An implicit load has to go through the registry, not the sidecar: each sidecar
        # loads its own model happily, but only the registry releases the other engines.
        # An API client alternating between engines (Qwen3-ASR then Whisper through
        # /v1/audio/transcriptions) therefore held both until their independent idle
        # timers fired, which is what OOMs a device that fits either alone. A no-op once
        # the model is resident, so the steady state costs a residency check.
        load_stt, _ = _stt_lifecycle()
        await asyncio.to_thread(load_stt, model, serving_engine, cancel_event)
        if cancel_event is None:
            result = await asyncio.to_thread(sidecar.transcribe, raw, model, language, fast)
        else:
            result = await asyncio.to_thread(
                sidecar.transcribe,
                raw,
                model,
                language,
                fast,
                cancel_event,
            )
    except asyncio.CancelledError:
        if cancel_event is not None:
            # cancel_transcription takes a lock a load can hold, so inline would stall the loop.
            threading.Thread(
                target = sidecar.cancel_transcription,
                args = (cancel_event,),
                daemon = True,
            ).start()
        raise
    except SttTranscriptionCancelledError as e:
        raise HTTPException(status_code = 499, detail = str(e))
    except SttUnavailableError as e:
        raise HTTPException(status_code = 501, detail = str(e))
    except SttLoadCancelledError as e:
        raise HTTPException(status_code = 409, detail = str(e))
    except SttModelNotDownloadedError as e:
        raise HTTPException(status_code = 409, detail = str(e))
    except SttModelBusyError as e:
        # Another client switching the dictation model is ordinary concurrency,
        # so say retry rather than report a server failure.
        raise HTTPException(status_code = 409, detail = str(e))
    except SttModelIdError as e:
        raise HTTPException(status_code = 422, detail = str(e))
    except SttModelCompatibilityError as e:
        raise HTTPException(status_code = 422, detail = str(e))
    except SttLanguageError as e:
        raise HTTPException(status_code = 422, detail = str(e))
    except SttAudioTooLongError as e:
        raise HTTPException(status_code = 413, detail = str(e))
    except SttAudioDecodeError as e:
        raise HTTPException(status_code = 400, detail = str(e))
    except Exception as e:
        logger.error(f"Transcription error: {e}", exc_info = True)
        raise HTTPException(status_code = 500, detail = safe_error_detail(e))
    finally:
        if disconnect_watcher is not None:
            await _stop_local_disconnect_cancel_watcher(disconnect_watcher)
    return result


@studio_router.post("/audio/transcribe")
async def transcribe_audio(
    payload: TranscribeRequest,
    request: Request,
    current_subject: str = Depends(get_current_subject),
):
    """Transcribe dictation audio to text via the STT sidecar.

    Runs alongside the chat model without evicting it, so any model (including
    text-only ones) can be driven by voice.
    """
    b64 = payload.audio or ""
    if not b64:
        raise HTTPException(status_code = 400, detail = "No audio provided.")
    if len(b64) > _MAX_AUDIO_B64_CHARS:
        raise HTTPException(status_code = 413, detail = "Audio is too large.")
    try:
        raw = base64.b64decode(b64, validate = True)
    except Exception:
        raise HTTPException(status_code = 400, detail = "Audio is not valid base64.")
    # Same disconnect cancellation as the raw and OpenAI routes: without the request
    # a client that goes away leaves the sidecar transcribing under its lock.
    return await _transcribe_audio_bytes(
        raw, payload.model, payload.language, payload.fast, payload.engine, request
    )


@studio_router.post("/audio/transcribe/raw")
async def transcribe_audio_raw(
    request: Request,
    model: Optional[str] = None,
    language: Optional[str] = None,
    fast: bool = False,
    engine: Optional[str] = None,
    current_subject: str = Depends(get_current_subject),
):
    """Transcribe a raw audio body without base64 or JSON conversion overhead."""
    chunks: list[bytes] = []
    size = 0
    async for chunk in request.stream():
        size += len(chunk)
        if size > _MAX_AUDIO_RAW_BYTES:
            raise HTTPException(status_code = 413, detail = "Audio is too large.")
        chunks.append(chunk)
    return JSONResponse(
        content = await _transcribe_audio_result(
            b"".join(chunks), model, language, fast, engine, request
        )
    )


