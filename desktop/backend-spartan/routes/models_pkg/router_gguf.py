"""GGUF quantization variants, KV-cache estimation, and download progress endpoints."""

import asyncio
import os
import sys
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from loggers import get_logger

from auth.authentication import get_current_subject
from hub.dependencies import get_hf_token
from models.models import GgufVariantsResponse, GgufVariantDetail
from utils.utils import log_and_http_error
from utils.paths import is_local_path, resolve_cached_repo_id_case
from routes.models_pkg.helpers_paths import (
    _resolve_hf_cache_dir,
    _resolve_hf_cache_realpath,
    _normalize_hf_token,
)
from routes.models_pkg.helpers_detection import (
    _read_native_context_length_bounded,
    _resolve_quant_gguf,
)

router = APIRouter()
logger = get_logger(__name__)

@router.get("/kv-cache-estimate")
async def get_kv_cache_estimate(
    repo_id: str = Query(..., description = "HF repo ID or local path"),
    quant: str = Query(..., description = "Quantization label (e.g. Q4_K_M)"),
    n_ctx: int = Query(..., ge = 1, description = "Context length to size the KV cache for"),
    cache_type_kv: Optional[str] = Query(
        None,
        description = "KV cache dtype (e.g. q8_0, q4_0, q5_0, iq4_nl, f32)",
    ),
    current_subject: str = Depends(get_current_subject),
):
    """Estimate KV cache + weight bytes for a downloaded GGUF at n_ctx.

    Powers the load dialog's "exceeds memory" warning using the same
    architecture-aware estimator as load. Best-effort: returns nulls when the
    metadata is unavailable so the UI simply shows no warning.
    """
    null = {"kv_bytes": None, "weights_bytes": None, "native_context": None}
    try:
        from utils.models.model_config import is_local_path

        is_local = is_local_path(repo_id)
        path, weights_bytes = _resolve_quant_gguf(repo_id, quant, is_local)
        if not path:
            return null

        from core.inference.llama_cpp import LlamaCppBackend

        be = LlamaCppBackend.__new__(LlamaCppBackend)
        for attr in (
            "_context_length",
            "_n_layers",
            "_n_kv_heads",
            "_n_heads",
            "_embedding_length",
            "_kv_key_length",
            "_kv_value_length",
            "_kv_lora_rank",
            "_sliding_window",
            "_sliding_window_pattern",
            "_ssm_inner_size",
            "_full_attention_interval",
            "_key_length_mla",
            "_n_kv_heads_by_layer",
            "_kv_key_length_swa",
            "_kv_value_length_swa",
            "_shared_kv_layers",
            "_nextn_predict_layers",
        ):
            setattr(be, attr, None)
        be._model_identifier = "kv-estimate"
        be._read_gguf_metadata(path)

        kv = be._estimate_kv_cache_bytes(n_ctx, cache_type_kv)
        return {
            "kv_bytes": int(kv) if kv else None,
            "weights_bytes": weights_bytes or None,
            "native_context": be._context_length,
        }
    except Exception as e:
        logger.debug(f"kv-cache-estimate failed for '{repo_id}' {quant}: {e}")
        return null


@router.get("/gguf-variants", response_model = GgufVariantsResponse)
async def get_gguf_variants(
    repo_id: str = Query(
        ..., description = "HuggingFace repo ID (e.g. 'unsloth/gemma-3-4b-it-GGUF')"
    ),
    prefer_local_cache: bool = False,
    offline: bool = False,
    local_path: Optional[str] = None,
    hf_token: Optional[str] = Query(None, description = "HuggingFace token for private repos"),
    hf_token_header: Optional[str] = Depends(get_hf_token),
    current_subject: str = Depends(get_current_subject),
):
    """List GGUF quantization variants for a HF repo or local directory."""
    try:
        hf_token = _normalize_hf_token(hf_token_header) or _normalize_hf_token(hf_token)
        from hub.services.models import gguf_variants as hub_gguf_variants

        answer = await hub_gguf_variants.get_gguf_variants_answer(
            repo_id,
            prefer_local_cache = prefer_local_cache,
            offline = offline,
            local_path = local_path,
            hf_token = hf_token,
        )
        response = answer.response
        # The copy the listing answered from, else the pin; both beat a repo-wide walk.
        context_model = (
            answer.context_source
            or hub_gguf_variants.pinned_snapshot_for_request(repo_id, local_path)
            or repo_id
        )
        local = is_local_path(context_model)

        return GgufVariantsResponse(
            repo_id = response.repo_id,
            variants = [
                GgufVariantDetail(
                    filename = v.filename,
                    quant = v.quant,
                    # A path-qualified key is not a label a picker can show; without this
                    # the row reads as its whole relative path.
                    display_label = getattr(v, "display_label", None),
                    size_bytes = v.size_bytes,
                    download_size_bytes = int(
                        getattr(v, "download_size_bytes", v.size_bytes) or v.size_bytes
                    ),
                    downloaded = bool(v.downloaded),
                    update_available = bool(getattr(v, "update_available", False)),
                    partial = bool(getattr(v, "partial", False)),
                    cleanable = bool(getattr(v, "cleanable", False)),
                )
                for v in response.variants
            ],
            has_vision = response.has_vision,
            default_variant = response.default_variant,
            context_length = await _read_native_context_length_bounded(context_model, local),
            resolved_locally = bool(getattr(response, "resolved_locally", False)),
            loadable_variants = getattr(response, "loadable_variants", None),
            loadable = getattr(response, "loadable", None),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error listing GGUF variants for '{repo_id}': {e}", exc_info = True)
        raise HTTPException(
            status_code = 500,
            detail = "Failed to list GGUF variants",
        )


@router.get("/gguf-download-progress")
async def get_gguf_download_progress(
    repo_id: str = Query(..., description = "HuggingFace repo ID"),
    variant: str = Query("", description = "Quantization variant (e.g. UD-TQ1_0)"),
    expected_bytes: int = Query(0, description = "Expected total download size in bytes"),
    hf_token: Optional[str] = Depends(get_hf_token),
    current_subject: str = Depends(get_current_subject),
):
    """Compatibility route backed by the shared multi-cache progress service."""
    from hub.services.models import downloads
    return await downloads.get_gguf_download_progress_response(
        repo_id,
        variant = variant,
        expected_bytes = expected_bytes,
        hf_token = hf_token,
    )

@router.get("/download-progress")
async def get_download_progress(
    repo_id: str = Query(..., description = "HuggingFace repo ID"),
    hf_token: Optional[str] = Depends(get_hf_token),
    current_subject: str = Depends(get_current_subject),
):
    """Compatibility route backed by the shared multi-cache progress service."""
    from hub.services.models import downloads
    return await downloads.get_download_progress_response(repo_id, hf_token = hf_token)
