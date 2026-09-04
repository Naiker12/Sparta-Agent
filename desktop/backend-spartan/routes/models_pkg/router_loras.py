"""LoRA adapters, diffusion fine-tunes, and ControlNet management endpoints."""

import asyncio
import os
import shutil
import sys
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from loggers import get_logger

from auth.authentication import get_current_subject
from hub.dependencies import get_hf_token
from models import LoRAScanResponse, LoRAInfo
from models.responses import LoRABaseModelResponse
from utils.utils import log_and_http_error
from utils.paths import (
    is_local_path,
    normalize_path,
    outputs_root,
    exports_root,
    resolve_output_dir,
    resolve_export_dir,
)
from utils.models import (
    get_base_model_from_checkpoint,
    get_base_model_from_lora,
    scan_checkpoints,
    scan_trained_models,
    scan_exported_models,
)
from routes.models_pkg.helpers_paths import (
    _safe_is_dir,
    _is_path_under,
    _is_path_under_lexically,
    _loaded_model_matches_deleted_path,
    _loading_model_matches_deleted_path,
    _active_diffusion_backend,
    _active_video_backend,
    _prune_empty_parents,
    _variant_names_same_checkpoint,
    _delete_gguf_variant_files,
)
from routes.models_pkg.helpers_detection import (
    _audio_probe_target,
    _audio_type_of_checkpoint,
    _is_h3_bundle_gguf_hint,
)

router = APIRouter()
logger = get_logger(__name__)

@router.get("/loras")
async def scan_loras(
    outputs_dir: str = Query(
        default = str(outputs_root()), description = "Directory to scan for LoRA adapters"
    ),
    exports_dir: str = Query(
        default = str(exports_root()), description = "Directory to scan for exported models"
    ),
    hf_token: Optional[str] = Depends(get_hf_token),
    current_subject: str = Depends(get_current_subject),
):
    """Scan for trained LoRA adapters and exported models.

    Returns training outputs (outputs_dir) and exported models
    (exports_dir) in one list, distinguished by the source field.
    """
    try:
        resolved_outputs_dir = str(resolve_output_dir(outputs_dir))
        resolved_exports_dir = str(resolve_export_dir(exports_dir))
        # Off the event loop: this is a directory walk plus, per checkpoint, a tokenizer
        # read. It was already blocking before the audio probe was added; the probe made
        # the block long enough to delay unrelated requests, streamed tokens included.
        lora_list = await asyncio.to_thread(
            _scan_loras_sync, resolved_outputs_dir, resolved_exports_dir, hf_token
        )

        return LoRAScanResponse(loras = lora_list, outputs_dir = resolved_outputs_dir)

    except Exception as e:
        raise log_and_http_error(
            e,
            500,
            "Failed to scan LoRA adapters",
            event = "models.scan_loras_failed",
            log = logger,
        )

def _scan_loras_sync(
    resolved_outputs_dir: str, resolved_exports_dir: str, hf_token: Optional[str]
) -> List[LoRAInfo]:
    """The filesystem half of scan_loras, so it can run in a worker thread."""
    lora_list: List[LoRAInfo] = []

    trained_models = scan_trained_models(outputs_dir = resolved_outputs_dir)
    for display_name, model_path, model_type in trained_models:
        base_model = get_base_model_from_checkpoint(model_path)
        lora_list.append(
            LoRAInfo(
                display_name = display_name,
                adapter_path = model_path,
                base_model = base_model,
                source = "training",
                export_type = model_type,
                audio_type = _audio_type_of_checkpoint(model_path, base_model, hf_token),
            )
        )

    # Scan exported models (merged, LoRA, base — skips GGUF)
    exported = scan_exported_models(exports_dir = resolved_exports_dir)
    for display_name, model_path, export_type, base_model in exported:
        lora_list.append(
            LoRAInfo(
                display_name = display_name,
                adapter_path = model_path,
                base_model = base_model,
                source = "exported",
                export_type = export_type,
                audio_type = _audio_type_of_checkpoint(model_path, base_model, hf_token),
            )
        )

    return lora_list

@router.get("/diffusion-loras")
async def scan_diffusion_loras(
    family: Optional[str] = Query(
        default = None, description = "Filter to LoRAs compatible with this diffusion family"
    ),
    current_subject: str = Depends(get_current_subject),
):
    """List diffusion image LoRA adapters for the Images workflow.

    Merges the curated catalog with local files in ``<studio_home>/loras/diffusion``,
    optionally filtered to the loaded model's family. Cheap: one directory scan, no network
    (a hub adapter is only downloaded when actually selected for a generation). Distinct from
    ``/loras`` above, which lists trained/exported TEXT adapters.
    """
    from core.inference import diffusion_lora

    entries = diffusion_lora.list_loras(family = family)
    return {
        "loras": [
            {
                "id": e.id,
                "display_name": e.display_name,
                "source": e.source,
                "format": e.fmt,
                "families": list(e.families),
                "size_bytes": e.size_bytes,
                "weight_default": e.weight_default,
            }
            for e in entries
        ],
        "loras_dir": str(diffusion_lora.loras_dir()),
    }


@router.get("/diffusion-controlnets")
async def scan_diffusion_controlnets(
    family: Optional[str] = Query(
        default = None, description = "Filter to ControlNets compatible with this diffusion family"
    ),
    current_subject: str = Depends(get_current_subject),
):
    """List diffusion ControlNet models for the Images workflow.

    Merges the curated, family-tagged catalog with local model folders in
    ``<studio_home>/controlnets/diffusion``, optionally filtered to the loaded model's family.
    Cheap: one directory scan, no network (a hub model is only downloaded when selected).
    """
    from core.inference import diffusion_controlnet

    entries = diffusion_controlnet.list_controlnets(family = family)
    return {
        "controlnets": [
            {
                "id": e.id,
                "display_name": e.display_name,
                "source": e.source,
                "families": list(e.families),
                "control_types": list(e.control_types),
                "is_union": e.is_union,
            }
            for e in entries
        ],
        "control_types": list(diffusion_controlnet.CONTROL_TYPES),
        "controlnets_dir": str(diffusion_controlnet.controlnets_dir()),
    }

@router.delete("/delete-finetuned")
async def delete_finetuned_model(
    model_path: str = Body(...),
    source: str = Body(...),
    export_type: Optional[str] = Body(None),
    gguf_variant: Optional[str] = Body(None),
    current_subject: str = Depends(get_current_subject),
):
    """Delete an Unsloth-trained or exported model from disk.

    Only paths under Unsloth's outputs/exports roots are accepted.
    Exported GGUF entries can delete one quant variant at a time.
    """
    if source not in {"training", "exported"}:
        raise HTTPException(
            status_code = 400,
            detail = "Only trained or exported Unsloth models can be deleted",
        )

    if not model_path or not model_path.strip():
        raise HTTPException(status_code = 400, detail = "model_path is required")

    if export_type == "gguf" and not gguf_variant:
        raise HTTPException(
            status_code = 400,
            detail = "gguf_variant is required when export_type is 'gguf'",
        )

    raw_path = Path(model_path).expanduser()
    if source == "training":
        target_path = raw_path
        allowed_root = outputs_root()
    else:
        allowed_root = exports_root()
        target_path = (
            raw_path.parent
            if export_type == "gguf" and raw_path.suffix.lower() == ".gguf"
            else raw_path
        )

    allowed_root = allowed_root.resolve()
    delete_path = Path(os.path.abspath(str(target_path)))
    delete_path_is_symlink = delete_path.is_symlink()

    if delete_path_is_symlink:
        if not _is_path_under_lexically(delete_path, allowed_root):
            raise HTTPException(
                status_code = 400,
                detail = "Model path is outside Unsloth storage",
            )
        if export_type == "gguf" and gguf_variant:
            target_path = delete_path.resolve()
            if not _is_path_under(target_path, allowed_root):
                raise HTTPException(
                    status_code = 400,
                    detail = "Model path is outside Unsloth storage",
                )
        else:
            target_path = delete_path
    else:
        target_path = target_path.resolve()

    should_check_resolved_path = not delete_path_is_symlink or (
        export_type == "gguf" and gguf_variant
    )
    if should_check_resolved_path and not _is_path_under(target_path, allowed_root):
        raise HTTPException(
            status_code = 400,
            detail = "Model path is outside Unsloth storage",
        )
    if target_path == allowed_root:
        raise HTTPException(
            status_code = 400,
            detail = "Refusing to delete storage root",
        )
    if not target_path.exists() and not target_path.is_symlink():
        raise HTTPException(status_code = 404, detail = "Model not found on disk")

    if source == "training":
        try:
            from core.training import get_training_backend

            training_backend = get_training_backend()
            if training_backend.is_training_active():
                raise HTTPException(
                    status_code = 409,
                    detail = "Cannot delete trained models while training is running",
                )
            # The diffusion (Images) trainer is a second independent run on the same storage root, so
            # checking only the LLM backend let a delete rmtree a live run's output directory.
            from core.training.diffusion_training_service import get_diffusion_training_service

            if get_diffusion_training_service().is_active():
                raise HTTPException(
                    status_code = 409,
                    detail = (
                        "Cannot delete trained models while diffusion (Images) training is running"
                    ),
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.warning("Could not check training status before delete: %s", e)
            raise HTTPException(
                status_code = 500,
                detail = "Could not verify training status before deleting",
            ) from e

    try:
        from routes.inference import get_llama_cpp_backend

        llama_backend = get_llama_cpp_backend()
        if (
            llama_backend.is_active
            and not llama_backend.is_loaded
            and llama_backend.model_identifier
            and _loaded_model_matches_deleted_path(
                llama_backend.model_identifier,
                target_path,
            )
            and (
                not gguf_variant
                or not llama_backend.hf_variant
                # Alias-aware: the delete below accepts a bare quant for a qualified key, so a
                # literal comparison here would wave through the very spelling it then deletes.
                or _variant_names_same_checkpoint(llama_backend.hf_variant, gguf_variant)
            )
        ):
            raise HTTPException(
                status_code = 409,
                detail = "Cannot delete a model while it is loading",
            )
        if (
            llama_backend.is_loaded
            and llama_backend.model_identifier
            and _loaded_model_matches_deleted_path(
                llama_backend.model_identifier,
                target_path,
            )
            and (
                not gguf_variant
                or not llama_backend.hf_variant
                or _variant_names_same_checkpoint(llama_backend.hf_variant, gguf_variant)
            )
        ):
            raise HTTPException(
                status_code = 400,
                detail = "Unload the model before deleting",
            )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Could not check llama.cpp loaded model before delete: %s", e)
        raise HTTPException(
            status_code = 503,
            detail = "Could not verify model load status before deleting",
        ) from e

    try:
        # Peek: building an orchestrator to learn there is none reaches get_device() (a torch import).
        from core.inference.orchestrator import peek_inference_backend
        inference_backend = peek_inference_backend()
        if inference_backend is not None:
            loading_models = getattr(inference_backend, "loading_models", set())
            if any(
                _loading_model_matches_deleted_path(loading_model, target_path)
                for loading_model in loading_models
            ):
                raise HTTPException(
                    status_code = 409,
                    detail = "Cannot delete a model while it is loading",
                )
            if inference_backend.active_model_name:
                if _loaded_model_matches_deleted_path(
                    inference_backend.active_model_name,
                    target_path,
                ):
                    raise HTTPException(
                        status_code = 400,
                        detail = "Unload the model before deleting",
                    )
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("Could not check inference backend loaded model before delete: %s", e)
        raise HTTPException(
            status_code = 503,
            detail = "Could not verify model load status before deleting",
        ) from e

    # Every guard above is chat-only, and Images / Video hold their own pipelines: a local model
    # loads by path, so rmtree would pull weights from under a live engine. Cached matches by id.
    for label, get_backend in (
        ("Images", _active_diffusion_backend),
        ("Video", _active_video_backend),
    ):
        backend = get_backend()
        if backend is None:
            continue
        try:
            status = backend.status()
            held = (
                [status.get(key) for key in ("repo_id", "base_repo")]
                if status.get("loaded")
                else []
            )
            held += list(getattr(backend, "loaded_repo_ids", tuple)())
            if any(h and _loaded_model_matches_deleted_path(str(h), target_path) for h in held):
                raise HTTPException(
                    status_code = 400,
                    detail = "Unload the model before deleting",
                )
            if any(
                _loading_model_matches_deleted_path(lid, target_path)
                for lid in getattr(backend, "loading_repo_ids", tuple)()
            ):
                raise HTTPException(
                    status_code = 409,
                    detail = "Cannot delete a model while it is loading",
                )
        except HTTPException:
            raise
        except Exception as e:
            logger.warning("Could not check the %s model before delete: %s", label, e)
            raise HTTPException(
                status_code = 503,
                detail = "Could not verify model load status before deleting",
            ) from e

    try:
        if export_type == "gguf" and gguf_variant:
            if not target_path.is_dir():
                raise HTTPException(
                    status_code = 400,
                    detail = "GGUF variant deletion requires an export directory",
                )
            deleted_count, deleted_bytes = _delete_gguf_variant_files(
                target_path,
                gguf_variant,
            )
            if deleted_count == 0:
                raise HTTPException(
                    status_code = 404,
                    detail = f"Variant {gguf_variant} not found on disk",
                )
            try:
                if not any(target_path.iterdir()):
                    target_path.rmdir()
                    _prune_empty_parents(target_path, allowed_root)
            except OSError:
                pass
            logger.info(
                "Deleted %s GGUF file(s) for exported model at %s variant %s (%0.1f MB freed)",
                deleted_count,
                target_path,
                gguf_variant,
                deleted_bytes / (1024 * 1024),
            )
            return {
                "status": "deleted",
                "path": str(target_path),
                "gguf_variant": gguf_variant,
            }

        if target_path.is_symlink() or target_path.is_file():
            target_path.unlink()
        else:
            shutil.rmtree(target_path)

        if target_path.exists() or target_path.is_symlink():
            raise HTTPException(
                status_code = 500,
                detail = "Deletion incomplete; some files could not be removed",
            )

        _prune_empty_parents(target_path, allowed_root)

        logger.info("Deleted fine-tuned model at %s", target_path)
        return {"status": "deleted", "path": str(target_path)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(
            "Error deleting fine-tuned model %s: %s",
            target_path,
            e,
            exc_info = True,
        )
        raise HTTPException(
            status_code = 500,
            detail = "Failed to delete fine-tuned model",
        )


@router.get("/loras/{lora_path:path}/base-model", response_model = LoRABaseModelResponse)
async def get_lora_base_model(lora_path: str, current_subject: str = Depends(get_current_subject)):
    """
    Get the base model for a LoRA adapter.

    This endpoint wraps the backend get_base_model_from_lora function.
    """
    try:
        base_model = get_base_model_from_lora(lora_path)

        if base_model is None:
            raise HTTPException(
                status_code = 404,
                detail = f"Could not determine base model for LoRA: {lora_path}",
            )

        return LoRABaseModelResponse(
            lora_path = lora_path,
            base_model = base_model,
        )

    except HTTPException:
        raise
    except Exception as e:
        raise log_and_http_error(
            e,
            500,
            "Failed to get base model",
            event = "models.get_lora_base_model_failed",
            log = logger,
        )
