"""Transformers Upgrade Routes for Studio.

Extracted from monolithic routes/inference.py to preserve SRP and modularity.
"""
from __future__ import annotations

import asyncio
import logging
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from auth import get_current_subject
from core.inference import get_inference_backend
from models.inference import (
    TransformersUpgradeInfo,
    InstallLatestTransformersRequest,
    InstallLatestTransformersResponse,
    TransformersUpgradeCheckRequest,
    TransformersUpgradeCheckResponse,
)

logger = logging.getLogger(__name__)

studio_router = APIRouter()
router = studio_router

import sys

def _get_inference_module():
    return sys.modules.get("routes.inference")

def _get_inf_attr(name: str, fallback=None):
    mod = _get_inference_module()
    if mod and hasattr(mod, name):
        return getattr(mod, name)
    return fallback

def _offline_guarded(targets, fn, /, *args, **kwargs):
    real_fn = _get_inf_attr("_offline_guarded")
    return real_fn(targets, fn, *args, **kwargs) if real_fn else fn(*args, **kwargs)

def _requires_trust_remote_code_for_model(model_name: str) -> bool:
    fn = _get_inf_attr("_requires_trust_remote_code_for_model")
    return fn(model_name) if fn else False

async def _cancel_and_drain_for_sidecar_swap():
    fn = _get_inf_attr("_cancel_and_drain_for_sidecar_swap")
    if fn:
        return await fn()




def _upgrade_check_config_target(request: TransformersUpgradeCheckRequest) -> str:
    """The config.json this load will actually read, by the remote-code scan's precedence.

    ``routes/models.py::scan_model_remote_code`` picks its target as: a local identifier
    stands for itself (resolved); else an exact ``model_snapshot_path`` pin wins; else
    ``prefer_local_cache`` resolves the selected cache directory to a snapshot; else the
    repository identifier. ``resolve_training_model_load_target`` agrees, returning
    ``model_snapshot_path or model_name``, so this check reads the same directory: a
    repo's current config.json says nothing about the pinned snapshot the run loads.

    The identifier stays the response's ``model_name``, for display; every read, the
    LoRA base resolve included, goes through this target, as the scan route does.

    Falls back to the identifier on any resolution failure: this route never raises.
    """
    from utils.paths import is_local_path, normalize_path

    model_name = request.model_name
    try:
        if is_local_path(model_name):
            normalized = normalize_path(model_name)
            try:
                return str(Path(normalized).expanduser().resolve(strict = False))
            except (OSError, RuntimeError, ValueError):
                return normalized
        snapshot_path = (request.model_snapshot_path or "").strip()
        if snapshot_path:
            from routes.models import _model_config_inspection_target
            return _model_config_inspection_target(
                (request.model_snapshot_repo_id or "").strip() or model_name,
                True,
                normalize_path(snapshot_path),
            )
        local_path = (request.model_local_path or "").strip()
        if request.prefer_local_cache:
            # No path is a legitimate cached selection (an inventory row can carry a null
            # cachePath) and _resolve_model_snapshot then searches every cache root, as
            # the scan route and /train/start both do. Taking the pin only when a path
            # came along would judge those selections on the repo's current architecture
            # while the worker loads the snapshot.
            from core.training.training import _resolve_model_snapshot
            return (
                _resolve_model_snapshot(
                    model_name, normalize_path(local_path) if local_path else None
                )
                or model_name
            )
    except Exception as exc:
        logger.debug("Cache pin resolution failed for '%s': %s", model_name, exc)
    return model_name


def _install_breaks_exact_resume(run_id: str) -> bool:
    """Would installing the offered release strand the checkpoint of ``run_id``?

    The latest sidecar is a persistent overlay, and a 4-bit run with attested exact
    resource provenance only resumes in the load mode it was attested with:
    ``effective_training_load_in_4bit`` raises the moment the sidecar routes it. So an
    install consented to on the way into a resume is not undoable.

    Answers False for an unknown run: a resume that cannot find its own row is not one
    this route should be suppressing an install for.
    """
    from core.training.provenance import exact_resume_requires_current_4bit
    from core.training.resume import training_run_config
    from storage.studio_db import get_run

    try:
        run = get_run(run_id)
        if run is None:
            return False
        return exact_resume_requires_current_4bit(training_run_config(run))
    except Exception as exc:
        logger.debug("Exact-resume check failed for run '%s': %s", run_id, exc)
        return False


# studio_router only: a Studio preflight, kept off the OpenAI-compatible /v1 mount.
@studio_router.post("/transformers-upgrade-check", response_model = TransformersUpgradeCheckResponse)
async def check_transformers_upgrade_route(
    request: TransformersUpgradeCheckRequest, current_subject: str = Depends(get_current_subject)
):
    """
    Does loading this model need a newer transformers than any installed overlay?

    /validate answers this for a chat load, but only as one field of a check that also
    resolves a ModelConfig, picks a GPU placement and runs the coexistence guard, none of
    which apply to a training start and several of which refuse while a run is active. So
    training asks on its own here, before spawning a worker that would otherwise die at
    model load with an unrecognized-architecture error the user cannot act on.

    Answers the same way /validate does: check_upgrade_for_model across [adapter, base],
    inside the same forced-offline window, on a worker thread. Also reports whether the
    run would load 16-bit instead of bnb 4-bit, which is what the latest sidecar means
    for training. Never raises: an unreadable model reports "no upgrade needed" and the
    caller proceeds exactly as it did before.
    """
    from utils.transformers_version import latest_tier_active_for

    model_name = request.model_name
    # Inspect what the load will open, not what the identifier resolves to today.
    load_target = await asyncio.to_thread(_upgrade_check_config_target, request)
    targets = [load_target]
    try:
        from utils.models.model_config import get_base_model_from_lora_identifier

        # The worker activates transformers for the BASE model, so an adapter is judged
        # by what it is an adapter for. Resolved from the load target rather than the
        # identifier, as the worker and the scan route both do: a repo that repointed
        # base_model_name_or_path since the pin was taken would otherwise have this
        # route judging a base the run never loads.
        base = await asyncio.to_thread(
            _offline_guarded,
            load_target,
            get_base_model_from_lora_identifier,
            load_target,
            request.hf_token,
        )
        if base:
            targets.append(base)
    except Exception:
        pass
    targets = list(dict.fromkeys(targets))

    transformers_upgrade: Optional[TransformersUpgradeInfo] = None
    try:
        from utils.transformers_latest import check_upgrade_for_model
        for target in targets:
            upgrade = await asyncio.to_thread(
                _offline_guarded,
                target,
                check_upgrade_for_model,
                target,
                request.hf_token,
            )
            if upgrade is not None:
                transformers_upgrade = TransformersUpgradeInfo(**upgrade)
                break
    except Exception as exc:
        logger.debug("Transformers upgrade check failed for '%s': %s", model_name, exc)

    requires_trust_remote_code = False
    try:
        requires_trust_remote_code = await asyncio.to_thread(
            _offline_guarded,
            targets,
            lambda: any(
                _requires_trust_remote_code_for_model(target, request.hf_token)
                for target in targets
            ),
        )
    except Exception as exc:
        logger.debug("Custom-code check failed for '%s': %s", model_name, exc)

    latest_tier_active = False
    try:
        latest_tier_active = await asyncio.to_thread(
            _offline_guarded,
            # Every target, not just the load target: latest_tier_active_for resolves a
            # remote adapter's base itself, so the base is fetched too.
            tuple(targets),
            latest_tier_active_for,
            load_target,
            request.hf_token,
        )
    except Exception as exc:
        logger.debug("Latest-tier check failed for '%s': %s", model_name, exc)

    # An offered install lands the model on the latest sidecar, which forces 16-bit (bnb
    # 4-bit feeds quantized experts into unvalidated paths for brand-new architectures).
    # A dev-only upgrade is never installed, so it changes nothing. Same rule /validate
    # applies: a model with a custom-code fallback still loads 4-bit on the current
    # transformers and the dialog offers that way out, so a merely offered upgrade
    # cannot be claimed as 16-bit. Only an install-only upgrade, or a sidecar already
    # routing the model, forces it.
    install_only_upgrade = bool(
        transformers_upgrade is not None
        and transformers_upgrade.supported_in_pypi
        and transformers_upgrade.pypi_version
        and not requires_trust_remote_code
    )
    # Already on the sidecar: the install is not what would strand the checkpoint, and
    # the resume is refused (or 16-bit) whatever this route answers.
    install_breaks_exact_resume = False
    if request.resume_run_id and not latest_tier_active:
        install_breaks_exact_resume = await asyncio.to_thread(
            _install_breaks_exact_resume, request.resume_run_id
        )
    return TransformersUpgradeCheckResponse(
        model_name = model_name,
        requires_transformers_upgrade = transformers_upgrade is not None,
        transformers_upgrade = transformers_upgrade,
        # Already booleans: False, or the preflight's own bool result. Re-wrapping the
        # custom-code one in bool() reads as the raw-YAML pattern the GGUF consistency
        # guard forbids, and it was never needed here.
        requires_trust_remote_code = requires_trust_remote_code,
        latest_tier_active = latest_tier_active,
        forces_16bit = latest_tier_active or install_only_upgrade,
        install_breaks_exact_resume = install_breaks_exact_resume,
    )


# studio_router only: admin action, kept off the OpenAI-compatible /v1 mount.
@studio_router.post(
    "/install-latest-transformers", response_model = InstallLatestTransformersResponse
)
async def install_latest_transformers_route(
    request: InstallLatestTransformersRequest, current_subject: str = Depends(get_current_subject)
):
    """
    Consented install of the latest transformers release into the persistent
    .venv_t5_latest sidecar.

    Called after the user confirms the transformers-upgrade dialog raised by /validate
    (requires_transformers_upgrade). The requested version must match the current latest
    PyPI release (re-verified server-side); the sidecar then participates in routing on
    this and every future start. A pip install runs off-loop, so this can take a minute.
    """
    from utils.transformers_latest import install_latest_transformers
    from utils.transformers_version import end_sidecar_swap, try_begin_sidecar_swap

    # The install stage-and-swaps .venv_t5_latest in place; a live worker would
    # lazy-import from the new version mid-run, mixing incompatible modules. Gate on
    # worker LIVENESS not tier (no HF token here, so tier re-resolution is unreliable
    # for gated repos): training and export are refused, the chat model unloaded.
    # Reserve the swap FIRST, before any await: training/export starts check this
    # reservation, so raising it after the gate wait would let a worker slip in.
    if not try_begin_sidecar_swap():
        raise HTTPException(
            status_code = 409,
            detail = "A transformers installation is already in progress.",
        )
    # Until the installer thread takes over, this coroutine owns the reservation
    # and must release it on any early exit (the 409 refusals below).
    owns_reservation = True
    try:
        from core.export import get_export_backend
        from core.training import get_training_backend

        if get_training_backend().is_training_active():
            raise HTTPException(
                status_code = 409,
                detail = (
                    "A training run is active. Wait for it to finish before "
                    "installing a new transformers version."
                ),
            )
        _export = get_export_backend()
        if _export.is_export_active():
            raise HTTPException(
                status_code = 409,
                detail = (
                    "An export is running. Wait for it to finish before "
                    "installing a new transformers version."
                ),
            )
        # A loaded (idle) export checkpoint would be torn down by the pre-swap
        # cleanup; if the swap then failed, that state would be silently lost
        # with no rollback signal. Make the user unload it deliberately first.
        if getattr(_export, "current_checkpoint", None):
            raise HTTPException(
                status_code = 409,
                detail = (
                    "An export checkpoint is loaded. Unload it from the Export "
                    "page before installing a new transformers version."
                ),
            )
        # In-flight streams passed the middleware already, so the lifecycle gate can't
        # protect them and the swap's unload would kill them mid-stream; mirror the
        # auto-switch busy check. This route is not middleware-counted and pending
        # requests stay blocked in the middleware, so neither is subtracted here.
        from core.inference.llama_keepwarm import (
            inference_lifecycle_gate,
            note_model_unloaded,
            other_inference_request_count,
        )

        # A confirmed swap skips only this fast path; the recheck under the gate still has to pass,
        # so the guard is unchanged for anyone who did not confirm.
        if (
            not request.force_cancel_active
            and other_inference_request_count(current_request_counted = False, include_pending = False)
            > 0
        ):
            raise HTTPException(
                status_code = 409,
                detail = (
                    "Another inference request is in progress. Wait for it to "
                    "finish before installing a new transformers version."
                ),
            )

        # Hold the lifecycle gate /load holds so no HF worker can start (or be mid-load
        # with active_model_name unset) while the sidecar is swapped. Teardown runs via
        # before_swap, only once the staged install succeeded: a failed pip/compat check
        # must not leave the user with their model gone. GGUF stays loaded (llama-server
        # never imports transformers).
        backend = await asyncio.to_thread(get_inference_backend)
        export_backend = get_export_backend()

        unloaded_chat = {"v": False}

        def _unload_before_swap() -> None:
            # Runs on the install thread, inside the gate held by _gated_install. Any
            # failure raises so the previous sidecar stays untouched (a worker that did
            # not tear down cleanly may still lazy-import from it). Export teardown runs
            # FIRST so its failure aborts while the chat model is still loaded;
            # cleanup_memory shuts the subprocess down even when its command fails, so
            # judge by worker liveness, not its return value.
            export_backend.cleanup_memory()
            export_alive = getattr(export_backend, "is_worker_alive", None)
            if callable(export_alive) and export_alive():
                raise RuntimeError("Export worker still alive before the transformers swap")
            active = getattr(backend, "active_model_name", None)
            if active:
                if not backend.unload_model(active):
                    # A failed unload still clears the orchestrator's model state,
                    # so the model is gone from the parent's view even though the
                    # swap aborts: report it so the client rolls back instead of
                    # pointing at an unloaded model.
                    if getattr(backend, "active_model_name", None) != active:
                        unloaded_chat["v"] = True
                        note_model_unloaded()
                    raise RuntimeError(f"Could not unload '{active}' before the transformers swap")
                note_model_unloaded()
                unloaded_chat["v"] = True
                logger.info(
                    "Unloaded '%s' before swapping in transformers %s",
                    active,
                    request.version,
                )
            # A failed load can leave a live worker with no active model that
            # still holds sidecar modules (and blocks the rename on Windows).
            worker_alive = getattr(backend, "is_worker_alive", None)
            if callable(worker_alive) and worker_alive():
                # _shutdown_subprocess keeps the handle when the worker outlives SIGKILL,
                # so both its False result and the liveness recheck catch a survivor
                # rather than the recheck being fooled by a nulled handle.
                stopped = backend._shutdown_subprocess()
                if not stopped or worker_alive():
                    raise RuntimeError("Inference worker still alive before the transformers swap")

        def _run_install() -> dict:
            # Owns the reservation from here: releasing in the thread, not the route,
            # keeps it held if the request is cancelled while the install still stages.
            try:
                return install_latest_transformers(request.version, _unload_before_swap, True)
            finally:
                end_sidecar_swap()

        # Snapshot before waiting on the gate: a /load already holding it can
        # complete meanwhile (including a same-model reload with new settings),
        # and the installer must not unload a model whose successful LoadResponse
        # the client is about to render. The generation counter catches reloads
        # the name alone would miss.
        active_before_gate = (
            getattr(backend, "active_model_name", None),
            getattr(backend, "load_generation", 0),
        )

        async def _gated_install() -> dict:
            # Held by THIS task, not the request coroutine: a cancelled POST unwinding an
            # `async with` here would drop the only guard /load honors mid-install.
            async with inference_lifecycle_gate():
                _active_now = (
                    getattr(backend, "active_model_name", None),
                    getattr(backend, "load_generation", 0),
                )
                if _active_now != active_before_gate:
                    end_sidecar_swap()
                    raise HTTPException(
                        status_code = 409,
                        detail = (
                            "A model load completed while the install was waiting. "
                            "Retry the install."
                        ),
                    )
                # Carry a confirmed swap's decision through: the user already accepted the "stop N
                # chats" prompt, and refusing here would make that answer unactionable (Retry
                # cannot succeed while the same chats run). Deliberately LAST, after every check
                # that can still reject the install, so the cancel is spent only once nothing can
                # turn this request away -- /load's rule.
                if request.force_cancel_active:
                    await _cancel_and_drain_for_sidecar_swap()
                # Recheck under the gate: new streams bump their in-flight count while
                # holding it, so once held nothing slips past. A forced install that could
                # not drain in time lands here too, for the same 409 as without the flag.
                if (
                    other_inference_request_count(
                        current_request_counted = False, include_pending = False
                    )
                    > 0
                ):
                    end_sidecar_swap()
                    raise HTTPException(
                        status_code = 409,
                        detail = (
                            "Another inference request is in progress. Wait for "
                            "it to finish before installing a new transformers "
                            "version."
                        ),
                    )
                return await asyncio.to_thread(_run_install)

        install_task = asyncio.ensure_future(_gated_install())
        owns_reservation = False
        # shield: a cancelled request stops waiting, but the installer runs to
        # completion (holding the gate) instead of being torn down mid-swap.
        result = await asyncio.shield(install_task)
    finally:
        if owns_reservation:
            end_sidecar_swap()
    if not result["success"]:
        if result.get("latest_version"):
            # Structured failure so the dialog can update to the newer release
            # and offer a retry that can actually succeed.
            return InstallLatestTransformersResponse(**result, model_unloaded = unloaded_chat["v"])
        if unloaded_chat["v"]:
            # The chat model is already gone even though the swap failed; return a
            # structured failure (not a bare 400) so the client can restore its
            # model state instead of pointing at an unloaded model.
            return InstallLatestTransformersResponse(**result, model_unloaded = True)
        raise HTTPException(status_code = 400, detail = result["message"])
    return InstallLatestTransformersResponse(**result, model_unloaded = unloaded_chat["v"])


