"""
Model Lifecycle and Status Router (Extracted from routes.inference)

Endpoints for loading, validating, unloading models, and querying status/progress/flags.
"""
from __future__ import annotations

import logging
import sys
from typing import Any, Optional

from fastapi import APIRouter, Depends, Request
from routes.auth import get_current_subject

from models.inference import (
    InferenceStatusResponse,
    LlamaFlagCatalogResponse,
    LoadProgressResponse,
    LoadRequest,
    LoadResponse,
    UnloadRequest,
    UnloadResponse,
    ValidateModelRequest,
    ValidateModelResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(tags=["inference-lifecycle"])

def _get_inference_module():
    return sys.modules.get("routes.inference")

def _get_inf_attr(name: str, fallback: Any = None) -> Any:
    mod = _get_inference_module()
    if mod and hasattr(mod, name):
        return getattr(mod, name)
    return fallback


@router.post("/load", response_model = LoadResponse)
async def load_model(
    request: LoadRequest,
    fastapi_request: Request,
    current_subject: str = Depends(get_current_subject),
):
    """Load a model for inference."""
    load_model_gated = _get_inf_attr("load_model_gated")
    _tunnel_safe_json = _get_inf_attr("_tunnel_safe_json")
    if not load_model_gated or not _tunnel_safe_json:
        raise RuntimeError("Inference module lifecycle helpers not initialized")
    return await _tunnel_safe_json(
        load_model_gated(request, fastapi_request, current_subject, user_initiated = True),
        label = "Model load",
    )


@router.post("/validate", response_model = ValidateModelResponse)
async def validate_model(
    request: ValidateModelRequest,
    fastapi_request: Request = None,
    current_subject: str = Depends(get_current_subject),
):
    """Validate model identifiers without loading weights into GPU memory."""
    _validate_model_impl = _get_inf_attr("_validate_model_impl")
    if not _validate_model_impl:
        raise RuntimeError("Inference module validate helper not initialized")
    return await _validate_model_impl(request, fastapi_request, current_subject)


@router.post("/unload", response_model = UnloadResponse)
async def unload_model(
    request: UnloadRequest,
    current_subject: str = Depends(get_current_subject),
):
    """Unload a model from memory."""
    _unload_model_impl = _get_inf_attr("_unload_model_impl")
    _tunnel_safe_json = _get_inf_attr("_tunnel_safe_json")
    if not _unload_model_impl or not _tunnel_safe_json:
        raise RuntimeError("Inference module unload helpers not initialized")
    return await _tunnel_safe_json(
        _unload_model_impl(request, current_subject), label = "Model unload"
    )


@router.get("/llama-flags", response_model = LlamaFlagCatalogResponse)
async def get_llama_flags(
    fastapi_request: Request = None,
    managed_only: bool = False,
    current_subject: str = Depends(get_current_subject),
):
    """Flags the installed llama-server accepts, for the extra-arguments editor."""
    _get_llama_flags_impl = _get_inf_attr("_get_llama_flags_impl")
    if not _get_llama_flags_impl:
        raise RuntimeError("Inference module llama flags helper not initialized")
    return await _get_llama_flags_impl(fastapi_request, managed_only, current_subject)


@router.get("/status", response_model = InferenceStatusResponse)
async def get_status(current_subject: str = Depends(get_current_subject)):
    """Get current inference backend status."""
    _get_status_impl = _get_inf_attr("_get_status_impl")
    if not _get_status_impl:
        raise RuntimeError("Inference module status helper not initialized")
    return await _get_status_impl(current_subject)


@router.get("/load-progress", response_model = LoadProgressResponse)
async def get_load_progress(current_subject: str = Depends(get_current_subject)):
    """Return the active GGUF load's mmap/upload progress."""
    _get_load_progress_impl = _get_inf_attr("_get_load_progress_impl")
    if not _get_load_progress_impl:
        raise RuntimeError("Inference module load progress helper not initialized")
    return await _get_load_progress_impl(current_subject)
