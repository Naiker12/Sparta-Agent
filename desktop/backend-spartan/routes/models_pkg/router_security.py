"""Remote code scanning and download quarantine discard endpoints."""

import asyncio
import os
import shutil
import sys
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException
from loggers import get_logger

from auth.authentication import get_current_subject
from hub.dependencies import get_hf_token
from utils.utils import log_and_http_error
from utils.paths import is_local_path, normalize_path
from routes.models_pkg.helpers_paths import (
    _normalize_hf_token,
    _is_valid_repo_id,
    _repo_in_any_hf_cache,
    _all_hf_cache_scans,
)
from routes.models_pkg.helpers_detection import (
    _consent_provider,
    _model_config_inspection_target,
)

router = APIRouter()
logger = get_logger(__name__)

@router.post("/remote-code-scan")
async def scan_model_remote_code(
    model_name: str = Body(..., embed = True),
    hf_token: Optional[str] = Body(None, embed = True),
    prefer_local_cache: bool = Body(False, embed = True),
    model_local_path: Optional[str] = Body(None, embed = True),
    model_snapshot_path: Optional[str] = Body(None, embed = True),
    model_snapshot_repo_id: Optional[str] = Body(None, embed = True),
    current_subject: str = Depends(get_current_subject),
):
    """Scan a model's ``auto_map`` custom code so the UI can show findings before
    the user enables ``trust_remote_code``. Code-free: reads ``config.json`` and
    statically scans the repo ``.py`` (never loads the model). Returns
    ``has_remote_code`` plus the severity-tagged findings + a pinning fingerprint.

    POST (not GET) so the ``hf_token`` for gated repos travels in the body and
    never lands in a URL, browser history, or access log.
    """
    try:
        from utils.security import (
            load_scan_target,
            preflight_remote_code_consent_for_targets,
            security_load_subdirs,
        )

        local_model = is_local_path(model_name)
        if not local_model:
            model_name = resolve_cached_repo_id_case(model_name)
        scan_target = model_name
        exact_snapshot_path = (
            model_snapshot_path.strip()
            if isinstance(model_snapshot_path, str) and model_snapshot_path.strip()
            else None
        )
        exact_snapshot_repo_id = model_name
        if isinstance(model_snapshot_repo_id, str):
            snapshot_repo_id = model_snapshot_repo_id.strip()
            # Namespace-less Hub ids like "gpt2" are valid, so use the shared validator, not the regex.
            from hub.utils.paths import is_valid_repo_id as _shared_is_valid_repo_id

            if snapshot_repo_id and not _shared_is_valid_repo_id(snapshot_repo_id):
                raise HTTPException(
                    status_code = 400,
                    detail = "Invalid model snapshot repository ID.",
                )
            if snapshot_repo_id:
                exact_snapshot_repo_id = snapshot_repo_id
        if local_model:
            normalized_model_name = normalize_path(model_name)
            try:
                scan_target = str(Path(normalized_model_name).expanduser().resolve(strict = False))
            except (OSError, RuntimeError, ValueError):
                scan_target = normalized_model_name
        if exact_snapshot_path and not local_model:
            exact_snapshot_repo_id = resolve_cached_repo_id_case(exact_snapshot_repo_id)
            scan_target = _model_config_inspection_target(
                exact_snapshot_repo_id,
                True,
                normalize_path(exact_snapshot_path),
            )
        elif prefer_local_cache is True and not local_model:
            from core.training.training import _resolve_model_snapshot
            local_path = normalize_path(model_local_path) if model_local_path else None
            scan_target = _resolve_model_snapshot(model_name, local_path) or model_name
        # Scan the adapter AND the base together (a LoRA runs both repos' code), pinned by one
        # combined fingerprint. Snapshot the primary's cache state BEFORE resolving the base: that
        # resolve downloads adapter_config.json, which would hide the adapter from cleanup on decline.
        primary_cache_target, _ = load_scan_target(scan_target, ())
        try:
            _primary_preexisting = is_local_path(primary_cache_target) or _repo_in_any_hf_cache(
                primary_cache_target
            )
        except Exception:
            _primary_preexisting = True
        requested_scan_target = scan_target
        requested_security_targets = [requested_scan_target]
        try:
            from utils.models.model_config import get_base_model_from_lora_identifier

            # Resolve a LOCAL or REMOTE adapter's base so its code/weights are scanned too.
            _base = get_base_model_from_lora_identifier(requested_scan_target, hf_token)
            if _base:
                requested_security_targets.append(_base)
        except Exception:
            pass
        security_targets: list[str] = []
        consent_load_subdirs: dict[str, tuple] = {}
        for _requested_target in dict.fromkeys(requested_security_targets):
            _subdirs = security_load_subdirs(_requested_target, hf_token)
            if _requested_target == requested_scan_target and requested_scan_target != model_name:
                _subdirs = tuple(
                    dict.fromkeys((*_subdirs, *security_load_subdirs(model_name, hf_token)))
                )
            _target, _subdirs = load_scan_target(_requested_target, _subdirs)
            if _target not in consent_load_subdirs:
                security_targets.append(_target)
                consent_load_subdirs[_target] = ()
            _subdirs = tuple(dict.fromkeys((*consent_load_subdirs[_target], *_subdirs)))
            consent_load_subdirs[_target] = _subdirs
        # Record every repo OUR scan is first to pull into the cache (adapter, base, and external
        # auto_map repos), so a decline purges exactly what was downloaded. Computed BEFORE the
        # preflight downloads, against every cache the discard searches, so pre-existing repos stay.
        from utils.security.remote_code_scan import external_auto_map_repos

        scan_created_repos: list = []
        _seen_created: set = set()

        def _mark_scan_created(repo: str, *, preexisting: Optional[bool] = None) -> None:
            if not repo or repo in _seen_created:
                return
            _seen_created.add(repo)
            try:
                already = (
                    preexisting
                    if preexisting is not None
                    else (is_local_path(repo) or _repo_in_any_hf_cache(repo))
                )
                if not already:
                    scan_created_repos.append(repo)
            except Exception:
                pass

        external_refs: list = []
        for _target in security_targets:
            # Use the pre-base-resolution snapshot for the primary (see above).
            _mark_scan_created(
                _target,
                preexisting = _primary_preexisting if _target == primary_cache_target else None,
            )
            for _ext in external_auto_map_repos(
                _target,
                hf_token,
                load_subdirs = consent_load_subdirs[_target],
            ):
                external_refs.append(_ext)
                _mark_scan_created(_ext)
        decision = preflight_remote_code_consent_for_targets(
            security_targets,
            hf_token = hf_token,
            subject = current_subject,
            load_subdirs_by_target = consent_load_subdirs,
        )
        payload = decision.response_payload()
        payload["model_name"] = exact_snapshot_repo_id if exact_snapshot_path else model_name
        payload["requires_trust_remote_code"] = decision.has_remote_code
        # Prior approval lets the dialog be skipped; the scan still ran, so this is a real match.
        payload["already_approved"] = (
            decision.has_remote_code
            and not decision.blocked
            and decision.reason == "approved by fingerprint"
        )
        # created_by_scan = primary flag (older clients); scan_created_repos drives cleanup.
        payload["created_by_scan"] = primary_cache_target in scan_created_repos
        payload["scan_created_repos"] = scan_created_repos
        # Provider tag decided here, where locality/scan scope/external refs are known.
        provider_target = exact_snapshot_repo_id if exact_snapshot_path else model_name
        if requested_scan_target == model_name and primary_cache_target != model_name:
            provider_target = primary_cache_target
        payload["provider"] = _consent_provider(provider_target, security_targets, external_refs)

        # Malware gate (metadata-only): HF-flagged unsafe files, orthogonal to remote code.
        from utils.security import evaluate_file_security

        unsafe_files: list = []
        security_blocked = False
        for _target in security_targets:
            _sec = evaluate_file_security(
                _target,
                hf_token = hf_token,
                load_subdirs = consent_load_subdirs[_target],
            )
            security_blocked = security_blocked or _sec.blocked
            unsafe_files.extend(_sec.unsafe_files)
        payload["unsafe_files"] = unsafe_files
        payload["security_blocked"] = security_blocked
        if security_blocked:
            # Non-approvable hard block: hides "Enable and continue" while forcing the dialog open.
            payload["approvable"] = False
            payload["requires_trust_remote_code"] = True
            payload["error_kind"] = "malware_blocked"
        return payload
    except HTTPException:
        raise
    except Exception as e:
        raise log_and_http_error(
            e,
            500,
            "Failed to scan model remote code",
            event = "models.remote_code_scan_failed",
            log = logger,
        )


@router.post("/discard-remote-code")
async def discard_remote_code_download(
    model_name: str = Body(..., embed = True), current_subject: str = Depends(get_current_subject)
):
    """Purge a repo the consent scan downloaded after the user DECLINED its custom
    code, so untrusted code is not left on disk.

    Safety: only ever deletes a metadata-only cache entry the scan created. It
    refuses a local path (never touches user files), a currently-loaded model, and
    any repo that has weight files cached (``*.safetensors`` / ``*.bin`` /
    ``*.gguf``) -- i.e. a model the user actually downloaded. The frontend only
    calls this when the scan reported ``created_by_scan``.
    """
    if is_local_path(model_name):
        return {"deleted": False, "reason": "local"}
    if not _is_valid_repo_id(model_name):
        return {"deleted": False, "reason": "invalid"}

    # Never delete a model that is loaded for inference.
    try:
        from hub.services.models.deletion import _loaded_id_matches_repo
        from routes.inference import get_llama_cpp_backend

        llama_backend = get_llama_cpp_backend()
        if llama_backend.is_loaded and llama_backend.model_identifier:
            if _loaded_id_matches_repo(llama_backend.model_identifier, model_name):
                return {"deleted": False, "reason": "loaded"}
    except Exception:
        pass
    try:
        # Peek, not construct: no orchestrator means no active model, and building one hits get_device().
        from core.inference.orchestrator import peek_inference_backend
        inference_backend = peek_inference_backend()
        if inference_backend is not None and inference_backend.active_model_name:
            if _loaded_id_matches_repo(inference_backend.active_model_name, model_name):
                return {"deleted": False, "reason": "loaded"}
    except Exception:
        pass

    _WEIGHTS = (
        ".safetensors",
        ".bin",
        ".pt",
        ".pth",
        ".h5",
        ".msgpack",
        ".gguf",
        ".onnx",
        ".ckpt",
    )
    try:
        target_repo = None
        hf_cache = None
        for cache in _all_hf_cache_scans():
            for repo_info in cache.repos:
                if repo_info.repo_type != "model":
                    continue
                if repo_info.repo_id.lower() == model_name.lower():
                    target_repo, hf_cache = repo_info, cache
                    break
            if target_repo is not None:
                break

        if target_repo is None:
            return {"deleted": False, "reason": "not_cached"}

        # Hard guard: a repo with weights is a real model the user has -- leave it.
        for rev in target_repo.revisions:
            for f in rev.files:
                if f.file_name.lower().endswith(_WEIGHTS):
                    return {"deleted": False, "reason": "has_weights"}

        revision_hashes = [rev.commit_hash for rev in target_repo.revisions]
        if not revision_hashes:
            return {"deleted": False, "reason": "not_cached"}
        hf_cache.delete_revisions(*revision_hashes).execute()
        logger.info("Discarded declined remote-code download: %s", model_name)
        return {"deleted": True}
    except Exception as e:
        logger.warning("Could not discard remote-code download for %s: %s", model_name, e)
        return {"deleted": False, "reason": "error"}
