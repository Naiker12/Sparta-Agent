"""Studio Diffusion and Gallery Router.

Extracted from monolithic routes/inference.py to preserve SRP and modularity.
"""
from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor

_CANCEL_EXECUTOR = ThreadPoolExecutor(max_workers = 2, thread_name_prefix = "image-cancel")
import hashlib as _hashlib
import hmac as _hmac
import io
import json
import logging
import os
import re as _re
import secrets as _secrets
import shutil
import tempfile
import time
import uuid
from contextlib import contextmanager
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, Response, UploadFile
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, StreamingResponse
from pydantic import BaseModel, Field

from auth import get_current_subject
from models.inference import (
    DiffusionDownloadPlanResponse,
    DiffusionGenerateProgressResponse,
    DiffusionGenerateRequest,
    DiffusionGenerateResponse,
    DiffusionInferenceInfoResponse,
    DiffusionLoadProgressResponse,
    DiffusionLoadRequest,
    DiffusionStatusResponse,
    GalleryFlagsPatch,
    GalleryImage,
    GalleryListResponse,
    AudioGalleryItem,
    AudioGalleryListResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter()
studio_router = APIRouter()  # alias for backward-compatibility with decorators

# ──────────────────────────────────────────────────────────────────────────
# Diffusion (local text-to-image). Studio-only routes (studio_router is not mounted under /v1); the backend is in-process and
# synchronous, so blocking calls are offloaded with asyncio.to_thread. Single error boundary: the backend raises, we map to HTTP.
# ──────────────────────────────────────────────────────────────────────────


def _diffusion_training_active() -> bool:
    """Whether a diffusion (SDXL) LoRA job is running. Best-effort so a load is never
    blocked just because the training service could not be imported/read."""
    try:
        from core.training.diffusion_training_service import get_diffusion_training_service
        return get_diffusion_training_service().is_active()
    except Exception:  # noqa: BLE001
        return False


@contextmanager
def _diffusion_training_admission():
    """Hold the diffusion trainer's GPU-admission interlock for this load's registration.

    The guards below only cover the instant they run. A load then selects its engine, acquires
    the arbiter and registers with the backend, and a ``/train/diffusion/start`` reserving inside
    that window frees residents this load has not registered yet, so the trainer comes up beside
    a brand-new pipeline. Registering the admission under the same lock ``reserve()`` takes makes
    the two mutually exclusive: this raises (409) once a start is reserved, and a start raises
    while an admission is open.

    Fails open on an import error, like the guards it complements. Covers the DIFFUSION trainer
    only; the LLM trainer admits loads that fit beside it, which is a different contract."""
    try:
        from core.training.diffusion_training_service import get_diffusion_training_service
        service = get_diffusion_training_service()
    except Exception:  # noqa: BLE001 -- unknowable state never blocks a load
        yield
        return
    with service.gpu_load_admission():
        yield


def _training_is_active() -> bool:
    """The non-raising half of the load guard, for callers that must not take the GPU."""
    from core.training import get_training_backend

    try:
        if get_training_backend().is_training_active():
            return True
    except Exception as e:  # noqa: BLE001 -- an unreadable LLM backend is not evidence of idle
        logger.warning("Could not check training state: %s", e)
    return _diffusion_training_active()


def _guard_diffusion_load_against_training() -> None:
    """Refuse loading an image model while a training run is active. Unlike chat,
    a diffusion pipeline's VRAM can't be cheaply estimated before the load, so the
    load is refused outright rather than fit-checked. No-op when training is
    inactive or its state can't be read. Raises HTTP 409."""
    from core.training import get_training_backend

    try:
        llm_active = get_training_backend().is_training_active()
    except Exception as e:
        # The two probes are independent: an unreadable LLM backend must not disable the diffusion interlock below.
        logger.warning("Could not check training state for image-load guard: %s", e)
        llm_active = False
    # An SDXL LoRA trainer runs in its own subprocess on the same GPU, so an image load must be refused while one is active.
    if not llm_active and not _diffusion_training_active():
        return
    raise HTTPException(
        status_code = 409,
        detail = (
            "Can't load an image model while training is running: the diffusion "
            "pipeline would compete with the training run for GPU memory. Training "
            "was left untouched. Try again after training finishes."
        ),
    )


async def _selected_gpu_ordinal(gpu_ids, *, allow_ranking: bool = True) -> Optional[int]:
    """The torch ordinal for a request's ``gpu_ids``, or None when there is nothing to honour.

    Physical ids have no applicator off CUDA / ROCm, which the contract says to ignore rather than
    refuse, so the resolver only runs once the target reports a CUDA device. Raises ValueError for
    a bad pick, which every caller maps to a 400.

    ``allow_ranking = False`` drops only the free-VRAM comparison, for the plan routes while a
    trainer holds the cards: the ids are still validated and translated (mask plus nvidia-smi, no
    CUDA context), so a bad pick is refused at the plan rather than tens of gigabytes later.
    """
    from core.inference.diffusion_device import (
        resolve_diffusion_device_target,
        resolve_selected_cuda_ordinal,
    )

    if not gpu_ids:
        return None
    device = await asyncio.to_thread(lambda: resolve_diffusion_device_target().device)
    if device != "cuda":
        return None
    # The keyword only when it is not the default, so the ordinary path calls the resolver with
    # the same one-argument shape it always had (a monkeypatched seam still fits it).
    if allow_ranking:
        return await asyncio.to_thread(resolve_selected_cuda_ordinal, gpu_ids)
    return await asyncio.to_thread(
        lambda: resolve_selected_cuda_ordinal(gpu_ids, allow_ranking = False)
    )


@studio_router.post("/images/download-plan", response_model = DiffusionDownloadPlanResponse)
async def diffusion_download_plan(
    request: DiffusionLoadRequest, current_subject: str = Depends(get_current_subject)
):
    """The repos + files this pick needs, so the frontend can stage them through the Hub
    download manager (one mechanism, one panel) instead of the loader downloading inline.

    Validates the same way /images/load does, so an unloadable pick fails here rather than
    after a multi-GB download."""
    from core.inference.diffusion import (
        get_diffusion_backend,
        resolve_local_single_file,
        resolve_model_kind,
    )
    from core.inference.diffusion_engine_router import predict_engine
    from core.inference.sd_cpp_engine import ENGINE_SD_CPP
    from utils.native_path_leases import redact_native_paths

    backend = get_diffusion_backend()
    try:
        kind = resolve_model_kind(request.gguf_filename, request.model_kind)
        # Same bare-single-file-directory reinterpretation as the load route, so the plan describes the load that will actually run.
        if kind == "pipeline" and not request.gguf_filename:
            sole = await asyncio.to_thread(resolve_local_single_file, request.model_path)
            if sole is not None:
                request.gguf_filename = sole
                kind = resolve_model_kind(sole)
        fam = await asyncio.to_thread(
            backend.validate_load_request,
            request.model_path,
            gguf_filename = request.gguf_filename,
            family_override = request.family_override,
            model_kind = kind,
            base_repo = request.base_repo,
        )
        # Plan for the engine /images/load will pick, not diffusers unconditionally: a GGUF on a GPU-less host routes to native
        # sd.cpp, which reads different files. predict_engine applies the policy without activating anything.
        planner = backend
        if fam is not None and predict_engine(fam, model_kind = kind) == ENGINE_SD_CPP:
            from core.inference.sd_cpp_backend import get_sd_cpp_backend
            planner = get_sd_cpp_backend()
        # BEFORE the plan is handed back and staged. The load route refuses a precision this
        # host cannot honour, but the UI plans and downloads first, so an explicit FP8 on an
        # unsupported host paid for the GGUF and its companions -- or tens of GB of video
        # weights -- and then got the predictable 409. Both checks are network-free.
        # Not while a trainer holds the GPU. An UNCACHED scheme sends
        # assert_precision_available into a quantise-and-matmul smoke probe, which initialises
        # CUDA and allocates in the Studio process -- the very thing the load route's training
        # guard exists to prevent, and the plan runs BEFORE that guard has had a say. Staging
        # files during training is legitimate and needs no GPU, so the plan is answered without
        # the precision check; /images/load still refuses the same pick afterwards.
        # Ranking reads free VRAM per candidate, which opens a CUDA context on each: exactly what
        # the training guard below exists to prevent, so the RANKING waits until training is known
        # idle. The ids are validated and translated either way -- that costs no CUDA context, and
        # skipping it entirely let the plan accept a GPU the load would refuse, and size its file
        # set for the wrong card. ONE resolution for the whole request, reused by preflight + plan.
        gpu_ordinal = None
        training = fam is not None and await asyncio.to_thread(_training_is_active)
        if fam is not None:
            gpu_ordinal = await _selected_gpu_ordinal(request.gpu_ids, allow_ranking = not training)
        if fam is not None and not training:
            if planner is backend:
                await asyncio.to_thread(
                    backend.assert_precision_available,
                    fam,
                    model_kind = kind,
                    transformer_quant = request.transformer_quant,
                    text_encoder_quant = request.text_encoder_quant,
                    # The memory request settles the offload policy for balanced/low_vram before
                    # anything is measured, and an offloaded transformer skips the dense quant.
                    memory_mode = getattr(request, "memory_mode", None),
                    cpu_offload = bool(getattr(request, "cpu_offload", False)),
                    # Judged on the card this pick would load on, as the loader does.
                    gpu_ordinal = gpu_ordinal,
                )
            else:
                _assert_native_precision_unset(
                    transformer_quant = request.transformer_quant,
                    text_encoder_quant = request.text_encoder_quant,
                )
        plan = await asyncio.to_thread(
            planner.download_plan,
            request.model_path,
            gpu_ordinal = gpu_ordinal,
            gguf_filename = request.gguf_filename,
            base_repo = request.base_repo,
            family_override = request.family_override,
            model_kind = kind,
            hf_token = request.hf_token,
            transformer_quant = request.transformer_quant,
            # An fp8 encoder request loads a hosted pre-cast checkpoint, so the plan must stage that file instead of the dense encoder shards.
            text_encoder_quant = request.text_encoder_quant,
            speed_mode = request.speed_mode,
            # The dense-quant prefetch decision also reads the memory policy, prequant path and adapter selection, so the plan must see the same values the load will.
            memory_mode = request.memory_mode,
            cpu_offload = request.cpu_offload,
            transformer_prequant_path = request.transformer_prequant_path,
            loras = request.loras,
        )
        return DiffusionDownloadPlanResponse(**plan)
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(status_code = 400, detail = redact_native_paths(str(exc)))
    except RuntimeError as exc:
        # Same status the load route gives the same refusal, so the UI can reuse one handler:
        # the precision gate above raises RuntimeError, and a 500 here would read as a server
        # fault rather than the deliberate "this host cannot honour that pick" answer.
        raise HTTPException(status_code = 409, detail = redact_native_paths(str(exc)))


def _assert_native_precision_unset(
    *, transformer_quant: Optional[str] = None, text_encoder_quant: Optional[str] = None
) -> None:
    """Refuse an EXPLICIT precision on the native sd.cpp engine, which cannot honour one.

    It accepts both knobs for interface parity with the diffusers backend and ignores them, so
    without this an explicit FP8 loads happily, quantises nothing, and reports null -- the silent
    mismatch the resolved-precision work exists to remove. `auto` and `none` pass through: they
    delegate the choice, and nothing is being promised.

    Raises RuntimeError, which the route maps to 409 alongside the diffusers refusals."""
    from core.inference.diffusion_auto_policy import precision_fallback_allowed
    from core.inference.diffusion_precision import normalize_te_quant
    from core.inference.diffusion_transformer_quant import TQ_AUTO, normalize_transformer_quant

    if precision_fallback_allowed():
        return
    pinned = normalize_transformer_quant(transformer_quant)
    te_mode = normalize_te_quant(text_encoder_quant)
    asked = []
    if pinned is not None and pinned != TQ_AUTO:
        asked.append(f"transformer_quant={pinned!r}")
    if te_mode is not None and te_mode != TQ_AUTO:
        asked.append(f"text_encoder_quant={te_mode!r}")
    if not asked:
        return
    raise RuntimeError(
        # "could not be used", the same wording the diffusers refusals use: the frontend
        # classifies a precision refusal by that phrase and rendered this one as a generic
        # one-line error instead of under the actionable title.
        f"{' and '.join(asked)} could not be used: this pick runs on the native engine, which "
        "loads a GGUF checkpoint as it is and has no torchao quantisation path. Leave the "
        "precision on 'auto', or pick a model that loads through diffusers."
    )


@studio_router.post("/images/load", response_model = DiffusionStatusResponse)
async def load_diffusion_model(
    request: DiffusionLoadRequest, current_subject: str = Depends(get_current_subject)
):
    return await load_diffusion_model_gated(request, current_subject, user_initiated = True)


async def load_diffusion_model_gated(
    request: DiffusionLoadRequest,
    current_subject: str,
    *,
    user_initiated: bool = False,
):
    """Everything ``POST /images/load`` does, plus who asked for it.

    Media auto-switch awaits this rather than the route so the idle unload can tell an
    API-loaded pipeline from one the user picked on the Images page.
    """
    from core.inference.diffusion import (
        get_diffusion_backend,
        resolve_local_single_file,
        resolve_model_kind,
    )
    from core.inference.diffusion_device import (
        resolve_diffusion_device_target,
        resolve_selected_cuda_ordinal,
    )
    from core.inference.diffusion_engine_router import (
        active_engine_name,
        annotate_status,
        begin_load_on,
        engine_for,
        predict_engine,
        select_and_activate_engine,
    )
    from core.inference.gpu_arbiter import acquire_for, release, DIFFUSION
    from core.inference.media_keepwarm import note_load_origin as note_media_load_origin
    from hub.utils.gguf import extract_quant_token
    from core.inference.sd_cpp_engine import ENGINE_DIFFUSERS, ENGINE_SD_CPP
    from utils.native_path_leases import redact_native_paths

    backend = get_diffusion_backend()
    try:
        # Resolve the load kind once (gguf / single_file / pipeline) so validation, engine selection and the load agree. A bad kind raises here, so a 400.
        kind = resolve_model_kind(request.gguf_filename, request.model_kind)
        # A local On-Device pick can be a bare single-file .safetensors directory; if it holds exactly one checkpoint, reinterpret it as a single_file load so all three paths agree.
        if kind == "pipeline" and not request.gguf_filename:
            sole = await asyncio.to_thread(resolve_local_single_file, request.model_path)
            if sole is not None:
                request.gguf_filename = sole
                kind = resolve_model_kind(sole)
        # Validate cheaply BEFORE touching the GPU: an unloadable pick must not evict a working chat model and then 400. The family also drives engine selection.
        fam = await asyncio.to_thread(
            backend.validate_load_request,
            request.model_path,
            gguf_filename = request.gguf_filename,
            family_override = request.family_override,
            model_kind = kind,
            base_repo = request.base_repo,
        )
        # Refuse while training is running: a multi-GB pipeline would compete with the training subprocess for VRAM.
        _guard_diffusion_load_against_training()
        # Take the GPU from chat only on a non-CPU device: gate on the device, not the engine name.
        # Pure resolve, so it can run before selection, which the refusal below has to precede.
        device = await asyncio.to_thread(lambda: resolve_diffusion_device_target().device)
        needs_gpu = device != "cpu"
        # Refuse a bad pick before anything is evicted or staged; begin_load re-checks, but only
        # after the arbiter has taken the GPU. Only on CUDA / ROCm: physical ids have no applicator
        # on XPU / MPS / CPU, which the request contract says to ignore rather than 400.
        gpu_ordinal = await _selected_gpu_ordinal(request.gpu_ids)

        def _preflight(target):
            # Gated/unreadable-companion refusal, asked of ONE engine (they check different repos).
            return target.preflight_base_access(
                request.model_path,
                fam,
                gguf_filename = request.gguf_filename,
                model_kind = kind,
                base_repo = request.base_repo,
                hf_token = request.hf_token,
            )

        # Last refusal before anything is torn down: a gated/unreadable companion repo. The download
        # plan checks the same, but the images page falls back to THIS route when that call fails,
        # and the loader's own copy runs after acquire_for already evicted chat. Must precede
        # selection too: activating the other engine unloads the current one, so a pick refused
        # afterwards destroys the model this preserves. Fails open on offline/transient, and runs
        # only where something is at stake -- a GPU handoff, or an engine switch.
        try:
            pending_name = predict_engine(fam, model_kind = kind) if fam is not None else None
        except Exception:  # noqa: BLE001 -- a probe failure must not refuse a loadable pick
            pending_name = None
        # Same bar, same reason, for an EXPLICIT precision this host can never honor. begin_load
        # makes the identical network-free check, but it runs inside acquire_for -- which evicts
        # chat under the arbiter lock BEFORE the register callback -- and after selection, which
        # unloads the resident model on an engine switch. So a refusal raised there arrives having
        # already destroyed the two things the 409 exists to preserve. `auto` is never refused, so
        # a caller that left the precision to the backend cannot reach this.
        if fam is not None and pending_name == ENGINE_DIFFUSERS:
            await asyncio.to_thread(
                backend.assert_precision_available,
                fam,
                model_kind = kind,
                transformer_quant = request.transformer_quant,
                text_encoder_quant = request.text_encoder_quant,
                memory_mode = getattr(request, "memory_mode", None),
                cpu_offload = bool(getattr(request, "cpu_offload", False)),
                gpu_ordinal = gpu_ordinal,
            )
        elif fam is not None and pending_name == ENGINE_SD_CPP:
            # The native engine accepts both knobs for interface parity and ignores them. It was
            # excluded from the gate above so as not to refuse loads that work today, but the
            # loads it "works" for are precisely the silent mismatch this whole change exists to
            # remove: an explicit FP8 succeeds, quantises nothing, and reports null. Refusing is
            # also what the diffusers path already does on the same CPU-only host, so leaving the
            # two engines disagreeing was the worse of the options.
            _assert_native_precision_unset(
                transformer_quant = request.transformer_quant,
                text_encoder_quant = request.text_encoder_quant,
            )
        preflighted = None
        if pending_name is not None and (needs_gpu or pending_name != active_engine_name()):
            preflighted = engine_for(pending_name)
            await asyncio.to_thread(_preflight, preflighted)

        # Pick the engine for this host (diffusers on GPU, native sd.cpp otherwise), installing sd-cli if needed, BEFORE evicting chat.
        engine = await asyncio.to_thread(
            select_and_activate_engine, fam, hf_token = request.hf_token, model_kind = kind
        )
        # predict_engine is selection's read-only twin: it never installs, so a host whose sd-cli
        # install then fails lands on the OTHER engine. Re-ask the engine actually activated when
        # the prediction missed, so neither the GPU handoff nor the load runs on an unread
        # companion; a correct prediction already made this call, so it is never paid twice. Runs
        # on the CPU path too when a preflight was owed there, since the switch is what is at stake.
        if (needs_gpu or preflighted is not None) and engine is not preflighted:
            await asyncio.to_thread(_preflight, engine)
        # And the precision gate, against the engine that was actually activated. When
        # predict_engine RAISED, pending_name stayed None and both arms above were skipped, so
        # a selection that then landed on sd.cpp accepted an explicit FP8, quantised nothing
        # and reported null -- the exact silent mismatch this change exists to remove. Re-run
        # only when the prediction was inconclusive or wrong; a correct one already paid it.
        activated = active_engine_name()
        if fam is not None and activated != pending_name:
            if activated == ENGINE_SD_CPP:
                _assert_native_precision_unset(
                    transformer_quant = request.transformer_quant,
                    text_encoder_quant = request.text_encoder_quant,
                )
            elif activated == ENGINE_DIFFUSERS:
                await asyncio.to_thread(
                    backend.assert_precision_available,
                    fam,
                    model_kind = kind,
                    transformer_quant = request.transformer_quant,
                    text_encoder_quant = request.text_encoder_quant,
                    memory_mode = getattr(request, "memory_mode", None),
                    cpu_offload = bool(getattr(request, "cpu_offload", False)),
                    gpu_ordinal = gpu_ordinal,
                )

        def _start_engine_load():
            # Kicks the slow load onto a background thread and returns at once (the client polls images/load-progress).
            return engine.begin_load(
                request.model_path,
                # a load nobody asked for may not reach the hub: the switch verified locality
                # from the outside, and this is what makes that promise the loader's own rule
                local_files_only = not user_initiated,
                gguf_filename = request.gguf_filename,
                base_repo = request.base_repo,
                family_override = request.family_override,
                hf_token = request.hf_token,
                cpu_offload = request.cpu_offload,
                memory_mode = request.memory_mode,
                speed_mode = request.speed_mode,
                text_encoder_quant = request.text_encoder_quant,
                transformer_quant = request.transformer_quant,
                transformer_quant_fast_accum = request.transformer_quant_fast_accum,
                transformer_prequant_path = request.transformer_prequant_path,
                attention_backend = request.attention_backend,
                transformer_cache = request.transformer_cache,
                transformer_cache_threshold = request.transformer_cache_threshold,
                model_kind = kind,
                loras = [(s.id, s.weight) for s in request.loras] if request.loras else None,
                gpu_ids = request.gpu_ids,
                # The winner this route already ranked and preflighted, so the load cannot pick a
                # different card from free VRAM that has moved since.
                gpu_ordinal = gpu_ordinal,
            )

        def _begin_load():
            # Under the router transition lock: begin_load on a deactivated engine leaves a resident model nothing can reach.
            return begin_load_on(engine, _start_engine_load)

        if needs_gpu:
            # Register the in-flight load UNDER the arbiter lock: otherwise a competing acquire in that gap evicts DIFFUSION before
            # the load is marked, finds nothing to cancel, and both allocate at once. The training admission wraps the same span.
            def _acquire_and_begin():
                with _diffusion_training_admission():
                    return acquire_for(DIFFUSION, _begin_load)

            status_dict = await asyncio.to_thread(_acquire_and_begin)
        else:
            # A CPU-only native load never touches the GPU, but switching FROM a previous GPU load leaves DIFFUSION marked as owner, so release (owner-guarded).
            await asyncio.to_thread(release, DIFFUSION)
            status_dict = await asyncio.to_thread(_begin_load)
        # Keyed to the target: this load can still fail with the previous model resident, and
        # its origin must not be read off that model.
        note_media_load_origin(
            DIFFUSION,
            request.model_path,
            extract_quant_token(request.gguf_filename) if kind == "gguf" else None,
            user_action = user_initiated,
        )
        return DiffusionStatusResponse(**annotate_status(status_dict))
    except (ValueError, FileNotFoundError) as exc:
        raise HTTPException(status_code = 400, detail = redact_native_paths(str(exc)))
    except RuntimeError as exc:
        # A load is already in progress.
        raise HTTPException(status_code = 409, detail = str(exc))


# Count of finished generations still writing their PNG/gallery records; generate-progress reports active while above 0. Mutated only on the event loop, so no lock.
_diffusion_persist_active = 0


_GENERATE_FAILURE_FALLBACK = "Image generation failed."
# Failure classes worth naming in the UI, as FIXED text: the engine's own message can embed local paths and argv, so only the class is reported.
_GENERATE_FAILURE_CLASSES: tuple[tuple[tuple[str, ...], str], ...] = (
    (
        ("out of memory", "outofmemory", "oom"),
        "The device ran out of memory. Try a smaller size, fewer steps, or a smaller batch.",
    ),
    (
        ("sd-server connection lost", "sd-cli exited", "process exited", "ggml_abort", "signal"),
        "The native image renderer stopped unexpectedly. Switch the engine to diffusers, or see "
        "the server log for its output.",
    ),
)


def _generate_failure_detail(message: str) -> str:
    """A user-facing reason for a failed generation, built only from fixed text.

    The bare literal left a real failure undiagnosable from the UI: on a Metal host the native
    renderer aborts inside its own text encoder, and the page showed "Image generation failed."
    with nothing to act on. Naming the CLASS of failure keeps the message useful without echoing
    the engine's text, which can carry local paths and argv."""
    text = str(message or "").lower()
    for needles, detail in _GENERATE_FAILURE_CLASSES:
        if any(n in text for n in needles):
            return f"{_GENERATE_FAILURE_FALLBACK} {detail}"
    return _GENERATE_FAILURE_FALLBACK


@studio_router.post("/images/generate", response_model = DiffusionGenerateResponse)
async def generate_diffusion_image(
    request: DiffusionGenerateRequest, current_subject: str = Depends(get_current_subject)
):
    from core.inference import image_gallery
    from core.inference.diffusion_engine_router import get_active_diffusion_engine
    from core.inference.diffusion_families import (
        DIFFUSION_CANCELLED_MSG,
        DIFFUSION_NOT_LOADED_MSG,
    )

    backend = get_active_diffusion_engine()
    try:
        result = await asyncio.to_thread(
            backend.generate,
            prompt = request.prompt,
            negative_prompt = request.negative_prompt,
            width = request.width,
            height = request.height,
            steps = request.steps,
            guidance = request.guidance,
            seed = request.seed,
            batch_size = request.batch_size,
            prompts = request.prompts,
            seeds = request.seeds,
            init_image = request.init_image,
            mask_image = request.mask_image,
            strength = request.strength,
            upscale = request.upscale,
            reference_images = request.reference_images,
            loras = [(l.id, l.weight) for l in request.loras] if request.loras else None,
            controlnet = (
                (
                    request.controlnet.id,
                    request.controlnet.image,
                    request.controlnet.control_type,
                    request.controlnet.strength,
                    request.controlnet.guidance_start,
                    request.controlnet.guidance_end,
                )
                if request.controlnet
                else None
            ),
        )
    except ValueError as exc:
        # Bad client input (undecodable image/mask, or an unsupported workflow): a 400 with the reason, not a generic 500.
        raise HTTPException(status_code = 400, detail = str(exc))
    except RuntimeError as exc:
        # Only "no model loaded" / user-cancelled are client-state (409); both engines raise these two EXACT messages. The
        # native engine also raises RuntimeError for failures whose text embeds the sd-cli tail, so match the sentinels exactly.
        msg = str(exc)
        if msg in (DIFFUSION_NOT_LOADED_MSG, DIFFUSION_CANCELLED_MSG):
            raise HTTPException(status_code = 409, detail = msg)
        logger.error("diffusion.generate_failed: %s", exc, exc_info = True)
        raise HTTPException(status_code = 500, detail = _generate_failure_detail(msg))
    except Exception as exc:
        logger.error("diffusion.generate_failed: %s", exc, exc_info = True)
        raise HTTPException(status_code = 500, detail = "Image generation failed.")

    # Persist each image with its full recipe. BOTH engines batch with a distinct seed per image, returned in ``seeds``, so each is individually reproducible.
    created_at = time.time()
    per_image_seeds = result.get("seeds")
    # A prompts/seeds LIST drives the image count and each image's own seed, so persist those as single-image recipes keyed on that seed.
    list_driven = bool(request.prompts or request.seeds)

    def _persist() -> list[dict]:
        records = []
        for index, image in enumerate(result["images"]):
            seed = (
                per_image_seeds[index]
                if per_image_seeds and index < len(per_image_seeds)
                else result["seed"]
            )
            records.append(
                image_gallery.save(
                    image,
                    {
                        # A prompts-list batch records each image's OWN prompt so its recipe replays exactly.
                        "prompt": (
                            request.prompts[index]
                            if request.prompts and index < len(request.prompts)
                            else request.prompt
                        ),
                        "negative_prompt": request.negative_prompt,
                        # Persist the ACTUAL output size, not the request sliders: the conditioned workflows derive it from the upload.
                        "width": getattr(image, "width", None) or request.width,
                        "height": getattr(image, "height", None) or request.height,
                        "steps": request.steps,
                        "guidance": request.guidance,
                        "seed": seed,
                        # Base seed the batch launched with. The native engine derives per-image seeds as base + index, so restore replays from this base. A list-driven image carries its OWN seed.
                        "batch_seed": seed if list_driven else result["seed"],
                        # Position within the batch (shared timestamp), so the export filename stays unique.
                        "batch_index": index,
                        # The batch shares one seed, so reproducing a batch_index>0 image needs the original batch_size.
                        "batch_size": 1 if list_driven else request.batch_size,
                        "model": result.get("repo_id"),
                        # The BUILD the image came off, not just the repo id: a GGUF repo holds many quants, a dense load may be torchao-
                        # quantised, and a bake is not the same build as the adapter-less one. Absent on records written before this existed.
                        "model_kind": result.get("model_kind"),
                        "gguf_filename": result.get("gguf_filename"),
                        "transformer_quant": result.get("transformer_quant"),
                        # The other half of the build's precision: the text encoder is often the
                        # largest resident component and its quant changes the conditioning, and
                        # the memory mode decides whether the torchao TE modes could run at all.
                        "text_encoder_quant": result.get("text_encoder_quant"),
                        "memory_mode": result.get("memory_mode"),
                        "offload_policy": result.get("offload_policy"),
                        "baked_loras": list(result.get("baked_loras") or []),
                        # The adapters APPLIED to this generation. A baked-but-disabled adapter is recorded above as part of the build instead.
                        "loras": [f"{l.id}:{l.weight:g}" for l in request.loras or []],
                        "controlnet": (
                            f"{request.controlnet.id}:{request.controlnet.control_type}:"
                            f"{request.controlnet.strength:g}"
                            # strength 0 is disabled and skipped before loading/conditioning, so do not claim a ControlNet was applied in the recipe/metadata.
                            if request.controlnet and request.controlnet.strength > 0
                            else None
                        ),
                        # The conditioned workflows keep their scalar settings here. The source, mask, reference and control IMAGES are
                        # deliberately not persisted (user uploads with their own lifetime), so the client asks for them again on restore.
                        "workflow": result.get("workflow"),
                        "strength": request.strength,
                        "upscale": request.upscale,
                        "controlnet_guidance": (
                            f"{request.controlnet.guidance_start:g}:{request.controlnet.guidance_end:g}"
                            if request.controlnet and request.controlnet.strength > 0
                            else None
                        ),
                        "reference_image_count": len(request.reference_images or []) or None,
                        "created_at": created_at,
                    },
                )
            )
        return records

    # Hold generate-progress "active" across the persist so a reload mount probe cannot refresh the gallery before these records exist.
    global _diffusion_persist_active
    _diffusion_persist_active += 1
    try:
        records = await asyncio.to_thread(_persist)
    except Exception as exc:
        logger.error("diffusion.persist_failed: %s", exc)
        raise HTTPException(status_code = 500, detail = "Failed to save the generated image.")
    finally:
        _diffusion_persist_active -= 1

    return DiffusionGenerateResponse(images = [GalleryImage(**r) for r in records])


@studio_router.get("/images/gallery", response_model = GalleryListResponse)
async def list_gallery_images(
    limit: int = 50,
    offset: int = 0,
    archived: bool = False,
    current_subject: str = Depends(get_current_subject),
):
    from pydantic import ValidationError

    from core.inference import image_gallery

    limit = max(1, min(limit, 200))
    offset = max(0, offset)

    # Validate inside the pager so offset / limit / has_more all count over the accepted domain: a record that fails
    # GalleryImage(**r) only after slicing let a leading bad row return an empty page with has_more=True, stalling scroll.
    def _valid_gallery_image(record: dict) -> bool:
        try:
            GalleryImage(**record)
        except ValidationError:
            return False
        return True

    # Fetch one extra to learn whether more remain, without a second scan.
    records = await asyncio.to_thread(
        image_gallery.list_images,
        limit + 1,
        offset,
        valid = _valid_gallery_image,
        archived = archived,
    )
    has_more = len(records) > limit
    images = [GalleryImage(**r) for r in records[:limit]]
    return GalleryListResponse(images = images, has_more = has_more)


@studio_router.get("/images/gallery/{image_id}/file")
async def get_gallery_image_file(
    image_id: str, current_subject: str = Depends(get_current_subject)
):
    from core.inference import image_gallery

    # Ownership-gate the serve like delete/clear: resolve only a Studio-owned PNG, so a guessed stem cannot stream out a foreign file.
    path = await asyncio.to_thread(image_gallery.owned_image_path, image_id)
    if path is None:
        raise HTTPException(status_code = 404, detail = "Image not found.")
    data = await asyncio.to_thread(path.read_bytes)
    # Immutable content (id is unique per image), so let the browser cache it.
    return Response(
        content = data,
        media_type = "image/png",
        headers = {"Cache-Control": "private, max-age=31536000, immutable"},
    )


@studio_router.patch("/images/gallery/{image_id}", response_model = GalleryImage)
async def update_gallery_image_flags(
    image_id: str,
    patch: GalleryFlagsPatch,
    current_subject: str = Depends(get_current_subject),
):
    """Pin/unpin or archive/restore one image. Omitted fields are left alone."""
    from core.inference import image_gallery

    try:
        record = await asyncio.to_thread(
            image_gallery.set_flags, image_id, pinned = patch.pinned, archived = patch.archived
        )
    except OSError as exc:
        # The client already applied this optimistically, so a silent miss would look like it stuck
        # and then quietly undo on reload.
        logger.warning("image_gallery.set_flags_failed: %s", exc)
        raise HTTPException(status_code = 500, detail = "Could not save the change to this image.")
    if record is None:
        raise HTTPException(status_code = 404, detail = "Image not found.")
    return GalleryImage(**record)


@studio_router.delete("/images/gallery/{image_id}")
async def delete_gallery_image(image_id: str, current_subject: str = Depends(get_current_subject)):
    from core.inference import image_gallery

    deleted = await asyncio.to_thread(image_gallery.delete, image_id)
    if not deleted:
        raise HTTPException(status_code = 404, detail = "Image not found.")
    return {"deleted": True}


@studio_router.delete("/images/gallery")
async def clear_gallery_images(current_subject: str = Depends(get_current_subject)):
    from core.inference import image_gallery
    from core.inference.gallery_flags import FlagsUnavailable

    try:
        removed = await asyncio.to_thread(image_gallery.clear)
    except FlagsUnavailable as exc:
        # Refuse rather than delete the archive we cannot prove is archived.
        logger.warning("image_gallery.clear_blocked: %s", exc)
        raise HTTPException(
            status_code = 503,
            detail = "Could not read the gallery's pin/archive data, so clearing was stopped to "
            "avoid deleting archived images.",
        )
    return {"removed": removed}


@studio_router.get("/audio/gallery", response_model = AudioGalleryListResponse)
async def list_gallery_audio(
    limit: int = 50,
    offset: int = 0,
    before_mtime: Optional[float] = None,
    before_id: Optional[str] = None,
    current_subject: str = Depends(get_current_subject),
):
    from pydantic import ValidationError

    from core.inference import audio_gallery

    limit = max(1, min(limit, 200))
    offset = max(0, offset)
    if (before_mtime is None) != (before_id is None):
        raise HTTPException(status_code = 400, detail = "Incomplete audio gallery cursor.")
    before = (
        (before_mtime, before_id) if before_mtime is not None and before_id is not None else None
    )

    # validate inside the pager so offset, limit and has_more count over the accepted domain
    def _valid_gallery_audio(record: dict) -> bool:
        try:
            AudioGalleryItem(**record)
        except ValidationError:
            return False
        return True

    # fetch one extra to learn whether more remain, without a second scan
    entries = await asyncio.to_thread(
        audio_gallery.list_audio_page,
        limit + 1,
        offset,
        before = before,
        valid = _valid_gallery_audio,
    )
    has_more = len(entries) > limit
    visible = entries[:limit]
    audio = [AudioGalleryItem(**record) for record, _ in visible]
    next_cursor = visible[-1][1] if has_more and visible else None
    return AudioGalleryListResponse(
        audio = audio,
        has_more = has_more,
        next_before_mtime = next_cursor[0] if next_cursor else None,
        next_before_id = next_cursor[1] if next_cursor else None,
    )


@studio_router.get("/audio/gallery/{audio_id}/file")
async def get_gallery_audio_file(
    audio_id: str, current_subject: str = Depends(get_current_subject)
):
    from core.inference import audio_gallery

    # ownership-gate the serve like delete/clear, so a guessed stem cannot stream out a foreign file
    path = await asyncio.to_thread(audio_gallery.owned_audio_path, audio_id)
    if path is None:
        raise HTTPException(status_code = 404, detail = "Audio not found.")
    from fastapi.responses import FileResponse

    # immutable content (id is unique per clip), so let the browser cache it
    return FileResponse(
        path,
        media_type = "audio/wav",
        headers = {"Cache-Control": "private, max-age=31536000, immutable"},
    )


@studio_router.delete("/audio/gallery/{audio_id}")
async def delete_gallery_audio(audio_id: str, current_subject: str = Depends(get_current_subject)):
    from core.inference import audio_gallery

    deleted = await asyncio.to_thread(audio_gallery.delete, audio_id)
    if not deleted:
        raise HTTPException(status_code = 404, detail = "Audio not found.")
    return {"deleted": True}


@studio_router.delete("/audio/gallery")
async def clear_gallery_audio(current_subject: str = Depends(get_current_subject)):
    from core.inference import audio_gallery
    removed = await asyncio.to_thread(audio_gallery.clear)
    return {"removed": removed}


@studio_router.post("/images/unload", response_model = DiffusionStatusResponse)
async def unload_diffusion_model(current_subject: str = Depends(get_current_subject)):
    from core.inference.diffusion_engine_router import annotate_status, get_active_diffusion_engine
    from core.inference.gpu_arbiter import release_if, DIFFUSION

    status_dict = await asyncio.to_thread(get_active_diffusion_engine().unload)
    # Drop DIFFUSION ownership only if nothing is resident AND no load is in flight, or a later chat load skips eviction and
    # OOMs the new pipeline. An in-flight load reads is_loaded False, so gate on loading_repo_ids() and use release_if.
    engine = get_active_diffusion_engine()
    await asyncio.to_thread(
        release_if,
        DIFFUSION,
        lambda: not engine.loading_repo_ids() and not engine.is_loaded,
    )
    return DiffusionStatusResponse(**annotate_status(status_dict))


@studio_router.get("/images/status", response_model = DiffusionStatusResponse)
async def diffusion_status(current_subject: str = Depends(get_current_subject)):
    from core.inference.diffusion_engine_router import active_status
    return DiffusionStatusResponse(**active_status())


@studio_router.get("/images/info", response_model = DiffusionInferenceInfoResponse)
async def diffusion_inference_info(current_subject: str = Depends(get_current_subject)):
    """Static per-family footprint summary for the Advanced Dtype tradeoff.

    Hardware-independent (served from the pure auto-policy tables, no GPU probing), so it
    is cheap and safe to fetch before anything is loaded."""
    from core.inference.diffusion_inference_info import family_inference_infos
    return DiffusionInferenceInfoResponse(families = family_inference_infos())


@studio_router.get("/images/load-progress", response_model = DiffusionLoadProgressResponse)
async def diffusion_load_progress(current_subject: str = Depends(get_current_subject)):
    from core.inference.diffusion_engine_router import get_active_diffusion_engine
    return DiffusionLoadProgressResponse(**get_active_diffusion_engine().load_progress())


@studio_router.get("/images/generate-progress", response_model = DiffusionGenerateProgressResponse)
async def diffusion_generate_progress(current_subject: str = Depends(get_current_subject)):
    from core.inference.diffusion_engine_router import get_active_diffusion_engine

    progress = get_active_diffusion_engine().generate_progress()
    # A finished generation still persisting its gallery record counts as active, so a reload probe keeps polling.
    if _diffusion_persist_active > 0 and not progress["active"]:
        progress = {**progress, "active": True}
    return DiffusionGenerateProgressResponse(**progress)


@studio_router.post("/images/generate/cancel")
async def cancel_diffusion_generation(current_subject: str = Depends(get_current_subject)):
    """Stop the in-flight image generation, mirroring POST /video/generate/cancel.

    Resolved through the engine router, so it stops a diffusers denoise (at its next step
    boundary) and a native sd.cpp run (which kills the sd-cli process tree) alike. The
    generation's OWN request is what reports the outcome: it unwinds with the cancelled
    sentinel, which this module already maps to a 409. ``cancelled`` is False when nothing was
    running, so the page can settle its button back to Generate rather than wait for a
    generation that already finished."""
    from core.inference.diffusion_engine_router import get_active_diffusion_engine

    cancelled = await asyncio.get_running_loop().run_in_executor(
        _CANCEL_EXECUTOR, get_active_diffusion_engine().cancel_generate
    )
    return {"cancelled": cancelled}


# ──────────────────────────────────────────────────────────────────────────
# OpenAI-compatible images API (POST /v1/images/generations). The inference router is mounted at both /api/inference and /v1, so this
# also answers /v1/images/generations for OpenAI clients. The Studio Image tab uses the richer /images/generate above; this is the spec shape.
# ──────────────────────────────────────────────────────────────────────────


# Diffusion dims must land in [256, 2048] on a multiple of 16; the named OpenAI sizes all satisfy this. Mirrors DiffusionGenerateRequest.
_IMAGE_SIZE_RE = _re.compile(r"^(\d{1,5})\s*x\s*(\d{1,5})$")
_IMAGE_DIM_MIN, _IMAGE_DIM_MAX = 256, 2048
# Sanitized 503 detail shared by the pre-check and the unload-race branch, so both "no image model" responses stay identical.
_NO_IMAGE_MODEL_MSG = "No image model loaded. Load an image model first."


def _parse_openai_image_size(size: str) -> tuple[int, int]:
    """OpenAI ``size`` -> (width, height). ``auto``/empty -> 1024x1024 (~1MP, what
    these models target). Raises ValueError with a client-facing message."""
    text = (size or "").strip().lower()
    if text in ("", "auto"):
        return 1024, 1024
    match = _IMAGE_SIZE_RE.match(text)
    if not match:
        raise ValueError("size must be 'auto' or '<width>x<height>', e.g. '1024x1024'.")
    width, height = int(match.group(1)), int(match.group(2))
    for label, value in (("width", width), ("height", height)):
        if not _IMAGE_DIM_MIN <= value <= _IMAGE_DIM_MAX:
            raise ValueError(f"size {label} must be between {_IMAGE_DIM_MIN} and {_IMAGE_DIM_MAX}.")
        if value % 16 != 0:
            raise ValueError(f"size {label} must be a multiple of 16.")
    return width, height


# response_format=url links must be fetchable by whoever received them: a client downloads data[].url with a plain GET
# and no Authorization header, so mint a short-lived HMAC link (1h, like OpenAI) and leave the gallery route bearer-only.
_IMAGE_LINK_TTL = 3600
_IMAGE_LINK_SECRET = _secrets.token_bytes(32)


def _sign_image_id(image_id: str) -> str:
    exp = int(time.time()) + _IMAGE_LINK_TTL
    payload = f"{image_id}.{exp}"
    sig = _hmac.new(_IMAGE_LINK_SECRET, payload.encode(), _hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"


def _verify_image_link_token(token: str) -> Optional[str]:
    """The image id a valid, unexpired token names, else None. Gallery ids are
    ``[A-Za-z0-9_-]`` so the two dots always split id / expiry / signature."""
    try:
        image_id, exp_s, sig = token.rsplit(".", 2)
    except ValueError:
        return None
    expected = _hmac.new(
        _IMAGE_LINK_SECRET, f"{image_id}.{exp_s}".encode(), _hashlib.sha256
    ).hexdigest()
    if not _hmac.compare_digest(sig, expected):
        return None
    try:
        if int(exp_s) < int(time.time()):
            return None
    except ValueError:
        return None
    return image_id


def _absolute_image_url(request: Request, image_id: str) -> str:
    """The absolute, directly fetchable link for one gallery image, on the request's own
    scheme+host. Signed rather than bearer-gated (see above), so a standard image client can
    download it; b64_json still avoids the round trip entirely."""
    relative = (
        f"/api/inference/images/gallery/{image_id}/file-signed?token={_sign_image_id(image_id)}"
    )
    return str(request.base_url).rstrip("/") + relative


@studio_router.get("/images/gallery/{image_id}/file-signed")
async def get_gallery_image_file_signed(image_id: str, token: str = Query(...)):
    """Serve one gallery PNG gated by the HMAC token instead of the bearer, for the
    response_format=url links a plain image client downloads. Same ownership gate as the
    authenticated route, and the token names the single image it may serve."""
    from core.inference import image_gallery

    if _verify_image_link_token(token) != image_id:
        raise HTTPException(status_code = 401, detail = "Invalid or expired image link.")
    path = await asyncio.to_thread(image_gallery.owned_image_path, image_id)
    if path is None:
        raise HTTPException(status_code = 404, detail = "Image not found.")
    data = await asyncio.to_thread(path.read_bytes)
    return Response(
        content = data,
        media_type = "image/png",
        headers = {"Cache-Control": "private, max-age=31536000, immutable"},
    )



from hub.dependencies import get_hf_token
from utils.api_errors import openai_error_body
from models.inference import ImageGenerationRequest, ImageGenerationResponse, ImageGenerationData

@router.post(
    "/images/generations",
    response_model = ImageGenerationResponse,
    response_model_exclude_none = True,
)
async def openai_image_generations(
    body: ImageGenerationRequest,
    request: Request,
    current_subject: str = Depends(get_current_subject),
    hf_token: Optional[str] = Depends(get_hf_token),
):
    """OpenAI-compatible text-to-image (POST /v1/images/generations).

    Generates ``n`` images from ``prompt`` on the loaded diffusion model and
    returns them as URLs (default) or base64 PNGs per ``response_format``. Steps
    and guidance have no OpenAI knob, so they default per loaded model.

    With media auto-switch on, ``model`` names the image model to serve on and is loaded
    when it is not the resident one; with it off ``model`` stays informational."""
    from core.inference import image_gallery
    from core.inference.diffusion_engine_router import get_active_diffusion_engine
    from core.inference.diffusion_families import default_generation_params
    from core.inference.gpu_arbiter import DIFFUSION
    from core.inference.media_auto_switch import maybe_auto_switch_media_model

    if body.stream:
        raise HTTPException(
            status_code = 400,
            detail = openai_error_body(
                "Streaming image generation is not supported.", status = 400, param = "stream"
            ),
        )
    try:
        width, height = _parse_openai_image_size(body.size)
    except ValueError as exc:
        raise HTTPException(
            status_code = 400, detail = openai_error_body(str(exc), status = 400, param = "size")
        )

    # Before the loaded check: the requested model may be the one this brings up.
    await maybe_auto_switch_media_model(
        body.model,
        owner = DIFFUSION,
        current_subject = current_subject,
        openai_errors = True,
        hf_token = hf_token,
    )

    # Use the active engine (diffusers OR native sd.cpp), the same accessor /images/generate uses.
    backend = get_active_diffusion_engine()
    status = backend.status()
    if not status.get("loaded"):
        # Mirror /v1/completions and /v1/embeddings, which 503 when their backend is not loaded.
        raise HTTPException(status_code = 503, detail = _NO_IMAGE_MODEL_MSG)

    # An edit-only model needs an input image this API cannot supply; refuse with a 400 rather than a backend 500.
    workflows = status.get("workflows") or []
    if workflows and "txt2img" not in workflows:
        raise HTTPException(
            status_code = 400,
            detail = openai_error_body(
                "The loaded image model is edit-only (it requires an input image); "
                "load a text-to-image model to use this endpoint.",
                status = 400,
                param = "model",
            ),
        )

    # Fall back to the resolved base repo so a local-path load still gets the right per-model steps/guidance.
    steps, guidance = default_generation_params(status.get("repo_id"), status.get("base_repo"))
    try:
        result = await asyncio.to_thread(
            backend.generate,
            prompt = body.prompt,
            width = width,
            height = height,
            steps = steps,
            guidance = guidance,
            batch_size = body.n,
        )
    except Exception as exc:  # noqa: BLE001 (single boundary, sanitized envelope)
        # A RuntimeError with the model now unloaded means it was evicted mid-call (a race): 503. Every other failure is a real 500 whose raw message must not reach the client.
        if isinstance(exc, RuntimeError) and not backend.is_loaded:
            raise HTTPException(status_code = 503, detail = _NO_IMAGE_MODEL_MSG)
        # The activation refusal is the one message here written FOR the caller: it names the
        # resolution, the budget and the remedies. Sanitising it into "Image generation failed."
        # left an OpenAI client with a 500 for a request only they can fix, while the Studio
        # route showed the reason. Typed, so no other ValueError's raw text escapes.
        from core.inference.diffusion_memory import ImageActivationShortfallError

        if isinstance(exc, ImageActivationShortfallError):
            raise HTTPException(
                status_code = 400,
                detail = openai_error_body(str(exc), status = 400, param = "size"),
            )
        logger.error("openai_images.generate_failed: %s", exc)
        raise HTTPException(status_code = 500, detail = "Image generation failed.")

    created = int(time.time())
    want_b64 = body.response_format == "b64_json"
    # Persist each image with its full recipe, like /images/generate, so url links resolve and images show in the gallery.
    recipe = {
        "prompt": body.prompt,
        "negative_prompt": None,
        "width": width,
        "height": height,
        "steps": steps,
        "guidance": guidance,
        # The batch shares one base seed, so restoring a batch_index>0 sibling needs the original batch_size.
        "batch_size": body.n,
        "model": result.get("repo_id"),
        # The BUILD, exactly as /images/generate records it. This route is a supported way to
        # produce an image, and without these the gallery entry cannot say which GGUF quant or
        # which dense precision made the pixels -- the whole point of recording them.
        "model_kind": result.get("model_kind"),
        "gguf_filename": result.get("gguf_filename"),
        "transformer_quant": result.get("transformer_quant"),
        "baked_loras": list(result.get("baked_loras") or []),
        "created_at": float(created),
    }
    # The diffusers batch shares one seed; the native batch uses a distinct seed per image, so record each image's own seed.
    per_image_seeds = result.get("seeds")

    def _persist() -> list[ImageGenerationData]:
        items: list[ImageGenerationData] = []
        for index, image in enumerate(result["images"]):
            seed = (
                per_image_seeds[index]
                if per_image_seeds and index < len(per_image_seeds)
                else result["seed"]
            )
            # batch_seed is the base the native engine derives per-image seeds from, so restore does not double-advance.
            record = image_gallery.save(
                image,
                {**recipe, "batch_index": index, "seed": seed, "batch_seed": result["seed"]},
            )
            if want_b64:
                encoded = image_gallery.image_b64(record["id"])
                if encoded is None:  # vanished between write and read — fail the call
                    raise RuntimeError("generated image could not be read back for encoding")
                items.append(ImageGenerationData(b64_json = encoded))
            else:
                items.append(ImageGenerationData(url = _absolute_image_url(request, record["id"])))
        return items

    try:
        data = await asyncio.to_thread(_persist)
    except Exception as exc:  # noqa: BLE001
        logger.error("openai_images.persist_failed: %s", exc)
        raise HTTPException(status_code = 500, detail = "Failed to save the generated image.")

    return ImageGenerationResponse(created = created, data = data)

