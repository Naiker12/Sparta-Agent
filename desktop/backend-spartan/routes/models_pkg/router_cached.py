"""Cached HF models, cached GGUF inspection, checkpoints and export size endpoints."""

import asyncio
import os
import sys
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Body, Depends, Header, HTTPException, Query
from loggers import get_logger

from auth.authentication import get_current_subject
from hub.dependencies import get_hf_token
from models import CheckpointInfo, CheckpointListResponse, ModelCheckpoints
from models.models import ExportSizeResponse
from utils.utils import canonical_model_repo_id, log_and_http_error
from utils.paths import (
    is_local_path,
    normalize_path,
    outputs_root,
    resolve_cached_repo_id_case,
    resolve_output_dir,
    resolve_export_dir,
)
from utils.models import scan_checkpoints
from utils.hidden_models import is_hidden_model as _is_hidden_model
from routes.models_pkg.schemas import (
    CachedModelRepo,
    CachedModelsResponse,
    CachedModelPathResponse,
)
from routes.models_pkg.helpers_paths import (
    _safe_is_dir,
    _resolve_hf_cache_dir,
    _is_valid_repo_id,
    _repo_in_any_hf_cache,
    _all_hf_cache_scans,
    _loaded_id_matches_repo,
    _resolve_cached_model_path,
    _is_sizable_local_path,
    _export_size_cached,
    _normalize_hf_token,
)
from routes.models_pkg.helpers_detection import (
    _is_gguf_filename,
    _is_mmproj_filename,
    _is_main_gguf_filename,
    _recovered_repo_is_unusable_by_repo_id,
    _repo_id_will_not_resolve,
    _default_ref_offers_no_whole_quant,
    _gguf_copy_is_usable,
    _snapshot_has_gguf_projector,
    _cached_repo_file_name,
    _main_variant_gguf_label,
    _one_shard_family_of,
    _main_variant_rank,
    _variant_keys_match,
    _normalized_quant_label,
    _repo_has_mmproj,
    _cached_gguf_row_has_vision,
    _iter_gguf_paths,
    _repo_gguf_size_bytes,
    _repo_has_gguf_files,
    _blob_mtime,
    _repo_gguf_last_modified,
    _repo_gguf_load_id,
    _preferred_gguf_copy,
    _repo_has_pipeline_index,
    _repo_is_diffusers,
    _repo_pipeline_missing_denoiser,
    _cached_repo_partial,
    _is_sd_cpp_companion_repo,
    _cached_repo_task,
    _repo_gguf_task,
)

router = APIRouter()
logger = get_logger(__name__)

@router.get("/cached-gguf")
async def list_cached_gguf(current_subject: str = Depends(get_current_subject)):
    """List GGUF repos downloaded to HF cache, legacy Unsloth cache, and HF default cache."""
    try:
        cache_scans = _all_hf_cache_scans()
        try:
            active_root = _resolve_hf_cache_dir().resolve(strict = False)
        except Exception:
            active_root = None

        seen_lower: dict[str, dict] = {}
        # How each kept row's copy ranks, since the compatibility schema carries neither field.
        seen_rank: dict[str, tuple[bool, bool]] = {}
        for hf_cache in cache_scans:
            for repo_info in hf_cache.repos:
                try:
                    if repo_info.repo_type != "model":
                        continue
                    repo_id = repo_info.repo_id
                    # Pass the snapshot path too so the config check also hides custom Whisper checkpoints.
                    if _is_hidden_model(repo_id, str(repo_info.repo_path)):
                        continue
                    total_size = _repo_gguf_size_bytes(repo_info)
                    if total_size == 0:
                        continue
                    key = repo_id.lower()
                    existing = seen_lower.get(key)
                    last_modified = _repo_gguf_last_modified(repo_info)
                    load_id = _repo_gguf_load_id(repo_info, active_root)
                    rank = (
                        _gguf_copy_is_usable(repo_info, load_id),
                        active_root is not None
                        and Path(repo_info.repo_path).parent.resolve(strict = False) == active_root,
                    )
                    if _preferred_gguf_copy(seen_lower, seen_rank, key, rank, total_size):
                        row = {
                            "repo_id": repo_id,
                            "size_bytes": total_size,
                            "cache_path": str(repo_info.repo_path),
                            "has_vision": _cached_gguf_row_has_vision(repo_info, load_id),
                            "task": _repo_gguf_task(repo_info),
                        }
                        if load_id:
                            row["load_id"] = load_id
                        # Keep the newest timestamp across duplicate caches; absent rows sort as oldest.
                        lm = max(last_modified, (existing or {}).get("last_modified", 0.0))
                        if lm > 0:
                            row["last_modified"] = lm
                        seen_lower[key] = row
                        seen_rank[key] = rank
                    elif last_modified > existing.get("last_modified", 0.0):
                        existing["last_modified"] = last_modified
                except Exception as e:
                    repo_label = getattr(repo_info, "repo_id", "<unknown>")
                    logger.warning(f"Skipping cached GGUF repo {repo_label}: {e}")
                    continue
        # Newest download first; stable repo_id tie-break for equal/missing mtimes.
        cached = sorted(
            seen_lower.values(),
            key = lambda c: (-(c.get("last_modified") or 0.0), c["repo_id"].lower()),
        )
        return {"cached": cached}
    except Exception as e:
        logger.error(f"Error listing cached GGUF repos: {e}", exc_info = True)
        return {"cached": []}

@router.get("/cached-models", response_model = CachedModelsResponse)
async def list_cached_models(
    current_subject: str = Depends(get_current_subject),
    hf_token: Optional[str] = Depends(get_hf_token),
):
    """List non-GGUF model repos downloaded to HF cache, legacy Unsloth cache, and HF default cache."""
    _WEIGHT_EXTENSIONS = (".safetensors", ".bin")
    hf_token = _normalize_hf_token(hf_token)

    try:
        cache_scans = _all_hf_cache_scans()
        try:
            active_root = _resolve_hf_cache_dir().resolve(strict = False)
        except Exception:
            active_root = None

        seen_lower: dict[str, dict] = {}
        # Repos whose active-cache copy cannot be loaded by id; this schema carries no path.
        unusable_active: set[str] = set()
        for hf_cache in cache_scans:
            for repo_info in hf_cache.repos:
                try:
                    if repo_info.repo_type != "model":
                        continue
                    repo_id = repo_info.repo_id
                    # Pass the snapshot path too so the config check also hides custom Whisper checkpoints.
                    if _is_hidden_model(repo_id, str(repo_info.repo_path)):
                        continue
                    # No partial or load id here, so a snapshot-path-only repo would read as ready.
                    if _recovered_repo_is_unusable_by_repo_id(repo_info):
                        try:
                            if (
                                active_root is not None
                                and Path(repo_info.repo_path).parent.resolve(strict = False)
                                == active_root
                            ):
                                unusable_active.add(repo_id.lower())
                        except (OSError, RuntimeError, ValueError):
                            pass
                        continue
                    if _repo_has_gguf_files(repo_info):
                        continue
                    total_size = sum(
                        (f.size_on_disk or 0) for rev in repo_info.revisions for f in rev.files
                    )
                    if total_size == 0:
                        continue
                    weight_files = [
                        f
                        for rev in repo_info.revisions
                        for f in rev.files
                        if f.file_name.endswith(_WEIGHT_EXTENSIONS)
                    ]
                    if not weight_files:
                        continue
                    last_modified = max(
                        (_blob_mtime(f) for f in weight_files),
                        default = 0.0,
                    )
                    key = repo_id.lower()
                    existing = seen_lower.get(key)
                    # A companion-only prefetch (manifest + VAE/TE but no transformer shards) is not a loadable pipeline; treat it as partial.
                    is_partial = _cached_repo_partial(
                        repo_id, Path(repo_info.repo_path)
                    ) or _repo_pipeline_missing_denoiser(repo_info)
                    # Prefer the most COMPLETE snapshot, then largest: a partial copy in one cache root must not shadow a complete copy in another.
                    if existing is None or (not is_partial, total_size) > (
                        not bool(existing.get("partial")),
                        existing["size_bytes"],
                    ):
                        row = {
                            "repo_id": repo_id,
                            "size_bytes": total_size,
                            "task": _cached_repo_task(repo_info),
                        }
                        if is_partial:
                            row["partial"] = True
                        # Listed, so tens of GB of companion weights stay visible and deletable,
                        # but flagged, so no picker offers a denoiser-less repo as a load.
                        if _is_sd_cpp_companion_repo(repo_id):
                            row["companion"] = True
                        # Flag diffusion repos with no pipeline index: loadable only via from_single_file, so pickers must not offer a pipeline load.
                        if row["task"] is not None and not _repo_has_pipeline_index(repo_info):
                            row["single_file"] = True
                        # Keep the newest timestamp across duplicate caches; absent rows sort as oldest.
                        lm = max(last_modified, (existing or {}).get("last_modified", 0.0))
                        if lm > 0:
                            row["last_modified"] = lm
                        seen_lower[key] = row
                    elif last_modified > existing.get("last_modified", 0.0):
                        existing["last_modified"] = last_modified
                except Exception as e:
                    repo_label = getattr(repo_info, "repo_id", "<unknown>")
                    logger.warning(f"Skipping cached model repo {repo_label}: {e}")
                    continue

        rows = [row for key, row in seen_lower.items() if key not in unusable_active]
        # Local-only list path: update checks are GGUF-only and happen lazily when variants are viewed.
        cached = sorted(
            rows,
            key = lambda c: (-(c.get("last_modified") or 0.0), c["repo_id"].lower()),
        )
        return {"cached": cached}
    except Exception as e:
        logger.error(f"Error listing cached models: {e}", exc_info = True)
        return {"cached": []}

@router.delete("/delete-cached")
async def delete_cached_model(
    repo_id: str = Body(...),
    variant: Optional[str] = Body(None),
    cache_path: Optional[str] = Body(None),
    hf_token: Optional[str] = Depends(get_hf_token),
    current_subject: str = Depends(get_current_subject),
):
    """Compatibility route backed by the shared multi-cache deletion service."""
    from hub.services.models import deletion
    return await deletion.delete_cached_model_response(repo_id, variant, hf_token, cache_path)

@router.get("/cached-model-path", response_model = CachedModelPathResponse)
async def get_cached_model_path(
    repo_id: str = Query(..., description = "HuggingFace repo ID"),
    variant: str = Query("", description = "Quantization variant (empty for whole repo)"),
    current_subject: str = Depends(get_current_subject),
):
    """Absolute on-disk path of a cached repo or one of its GGUF variants."""
    if not _is_valid_repo_id(repo_id):
        raise HTTPException(status_code = 400, detail = "Invalid repo_id format")
    path = await asyncio.to_thread(_resolve_cached_model_path, repo_id, variant.strip() or None)
    return {"path": str(path), "is_dir": path.is_dir()}


@router.post("/reveal-cached-model")
async def reveal_cached_model(
    repo_id: str = Body(...),
    variant: Optional[str] = Body(None),
    current_subject: str = Depends(get_current_subject),
):
    """Reveal a cached repo (or one GGUF variant's file) in the OS file manager."""
    from utils.paths.path_utils import reveal_in_file_manager

    if not _is_valid_repo_id(repo_id):
        raise HTTPException(status_code = 400, detail = "Invalid repo_id format")
    variant = (variant or "").strip() or None
    path = await asyncio.to_thread(_resolve_cached_model_path, repo_id, variant)
    try:
        await asyncio.to_thread(reveal_in_file_manager, path)
    except Exception as e:
        logger.error(f"Failed to reveal {path}: {e}")
        raise HTTPException(status_code = 500, detail = "Failed to open file manager")
    return {"status": "ok", "path": str(path)}


@router.get("/checkpoints", response_model = CheckpointListResponse)
async def list_checkpoints(
    outputs_dir: str = Query(
        default = str(outputs_root()),
        description = "Directory to scan for checkpoints",
    ),
    current_subject: str = Depends(get_current_subject),
):
    """List checkpoints in the outputs directory.

    Scans the outputs folder for training runs and their checkpoints.
    """
    try:
        resolved_outputs_dir = str(resolve_output_dir(outputs_dir))
        raw_models = scan_checkpoints(outputs_dir = resolved_outputs_dir)

        models = [
            ModelCheckpoints(
                name = model_name,
                checkpoints = [
                    CheckpointInfo(display_name = display_name, path = path, loss = loss)
                    for display_name, path, loss in checkpoints
                ],
                base_model = metadata.get("base_model"),
                peft_type = metadata.get("peft_type"),
                lora_rank = metadata.get("lora_rank"),
                is_quantized = metadata.get("is_quantized", False),
            )
            for model_name, checkpoints, metadata in raw_models
        ]

        return CheckpointListResponse(
            outputs_dir = resolved_outputs_dir,
            models = models,
        )
    except Exception as e:
        raise log_and_http_error(
            e,
            500,
            "Failed to list checkpoints",
            event = "models.list_checkpoints_failed",
            log = logger,
        )

@router.get("/export-size", response_model = ExportSizeResponse)
async def get_export_size(
    model: str = Query(..., description = "Base model id or local model path to size"),
    hf_token: Optional[str] = Header(None, alias = "X-HF-Token"),
    current_subject: str = Depends(get_current_subject),
):
    """Estimate a model's fp16/bf16-equivalent size for the Export page.

    Returns nulls with HTTP 200 when the size can't be determined. The HF token
    (for gated repos) comes from the X-HF-Token header so it never hits URLs/logs.
    """
    if is_local_path(model):
        if not _is_sizable_local_path(model):
            return ExportSizeResponse(
                model = model, fp16_bytes = None, total_params = None, source = "unavailable"
            )
        resolved = model
    else:
        resolved = resolve_cached_repo_id_case(model)
    # Blocking network/disk I/O: run off the event loop.
    fp16_bytes, total_params, source = await asyncio.to_thread(
        _export_size_cached, resolved, hf_token
    )
    return ExportSizeResponse(
        model = resolved,
        fp16_bytes = fp16_bytes,
        total_params = total_params,
        source = source,
    )
