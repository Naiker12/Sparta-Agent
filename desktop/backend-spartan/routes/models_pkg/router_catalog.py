"""Catalog listing, model configuration and capability check endpoints."""

import asyncio
import os
import sys
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from loggers import get_logger

from auth.authentication import get_current_subject
from hub.dependencies import get_hf_token
from models import ModelListResponse, ModelDetails
from models.responses import VisionCheckResponse, EmbeddingCheckResponse
from utils.utils import log_and_http_error
from utils.paths import is_local_path, resolve_output_dir, resolve_cached_repo_id_case
from utils.models import (
    scan_checkpoints,
    scan_trained_models,
    scan_exported_models,
    load_model_defaults,
    is_vision_model,
    is_embedding_model,
    ModelConfig,
)
from utils.models.model_config import is_audio_input_type
from core.inference.model_ids import display_model_name
from core.inference import get_inference_backend
from routes.models_pkg.helpers_paths import _safe_is_dir, _normalize_hf_token
from routes.models_pkg.helpers_detection import (
    derive_model_type,
    _looks_like_mlx_repo,
    _get_max_position_embeddings,
    _get_model_size_bytes,
    _get_snapshot_model_size_bytes,
    _model_config_inspection_target,
    _audio_probe_target,
)

router = APIRouter()
logger = get_logger(__name__)

@router.get("/list")
async def list_models(current_subject: str = Depends(get_current_subject)):
    """List available models: default plus currently loaded."""
    try:
        # Off-loop: building the singleton calls get_device(), which would freeze on the torch import.
        inference_backend = await asyncio.to_thread(get_inference_backend)

        default_models = inference_backend.default_models

        loaded_models = []
        for model_name, model_data in inference_backend.models.items():
            _is_vision = model_data.get("is_vision", False)
            _audio_type = model_data.get("audio_type")
            model_info = ModelDetails(
                id = model_name,
                name = display_model_name(model_name),
                is_vision = _is_vision,
                is_lora = model_data.get("is_lora", False),
                is_mlx = model_data.get("is_mlx", False),
                is_audio = model_data.get("is_audio", False),
                audio_type = _audio_type,
                has_audio_input = model_data.get("has_audio_input", False),
                model_type = derive_model_type(_is_vision, _audio_type),
            )
            loaded_models.append(model_info)

        # Active GGUF model (llama-server), labelled from the display id
        # /api/inference/status publishes; the id stays raw for agents-tab's path filter.
        from routes.inference import _llama_status_model_ids, get_llama_cpp_backend

        llama_backend = get_llama_cpp_backend()
        if llama_backend.is_loaded and llama_backend.model_identifier:
            display_id, _reported_identifier = _llama_status_model_ids(llama_backend)
            loaded_models.append(
                ModelDetails(
                    id = llama_backend.model_identifier,
                    name = display_model_name(display_id or llama_backend.model_identifier),
                    is_gguf = True,
                    is_vision = llama_backend.is_vision,
                    is_audio = getattr(llama_backend, "_is_audio", False),
                    audio_type = getattr(llama_backend, "_audio_type", None),
                )
            )

        # Combine default and loaded; prefer loaded entries for duplicate ids so runtime flags survive.
        all_models = []
        seen_ids = set()
        loaded_by_id = {model_info.id: model_info for model_info in loaded_models}

        for model_id in default_models:
            if model_id not in seen_ids:
                model_info = loaded_by_id.get(model_id) or ModelDetails(
                    id = model_id,
                    name = display_model_name(model_id),
                    is_gguf = model_id.upper().endswith("-GGUF"),
                    is_mlx = _looks_like_mlx_repo(model_id),
                )
                all_models.append(model_info)
                seen_ids.add(model_id)

        for model_info in loaded_models:
            if model_info.id not in seen_ids:
                all_models.append(model_info)
                seen_ids.add(model_info.id)

        return ModelListResponse(models = all_models, default_models = default_models)

    except Exception as e:
        raise log_and_http_error(
            e,
            500,
            "Failed to list models",
            event = "models.list_models_failed",
            log = logger,
        )

@router.get("/config/{model_name:path}")
async def get_model_config(
    model_name: str,
    hf_token: Optional[str] = Query(None),
    prefer_local_cache: bool = False,
    local_path: Optional[str] = None,
    header_hf_token: Optional[str] = Depends(get_hf_token),
    current_subject: str = Depends(get_current_subject),
):
    """Get configuration for a specific model (wraps load_model_defaults)."""
    hf_token = _normalize_hf_token(header_hf_token) or _normalize_hf_token(hf_token)
    from core.inference.llama_cpp import _hf_offline_if_unreachable_for

    def _resolve(model_name: str) -> ModelDetails:
        # Each probe below can reach the hub, so the guard wraps the whole handler: offline they
        # must all resolve from the HF cache. Local paths stay on disk and skip the probe.
        with _hf_offline_if_unreachable_for(model_name):
            if not is_local_path(model_name):
                resolved = resolve_cached_repo_id_case(model_name)
                if resolved != model_name:
                    logger.info(
                        "Using cached repo_id casing '%s' for requested '%s'",
                        resolved,
                        model_name,
                    )
                model_name = resolved

            logger.info(f"Getting model config for: {model_name}")
            from utils.models.model_config import detect_audio_type_checked

            inspection_target = _model_config_inspection_target(
                model_name,
                prefer_local_cache,
                local_path,
            )
            config_dict = load_model_defaults(model_name)

            is_vision = is_vision_model(
                inspection_target,
                hf_token = hf_token,
                local_files_only = prefer_local_cache,
            )
            is_embedding = is_embedding_model(inspection_target, hf_token = hf_token)
            audio_type, audio_type_definitive = detect_audio_type_checked(
                _audio_probe_target(inspection_target),
                hf_token = hf_token,
                local_files_only = prefer_local_cache,
            )

            is_lora = False
            base_model = None
            max_position_embeddings = None
            try:
                model_config = ModelConfig.from_identifier(
                    inspection_target,
                    hf_token = hf_token,
                )
                is_lora = model_config.is_lora
                base_model = model_config.base_model if is_lora else None
                max_position_embeddings = _get_max_position_embeddings(model_config)
            except Exception:
                pass

            # Fallback: raw config.json (declarative fields only) -- must never run a repo's auto_map.
            if max_position_embeddings is None:
                try:
                    from utils.transformers_version import _load_config_json
                    from types import SimpleNamespace

                    _cfg = _load_config_json(inspection_target, hf_token = hf_token)
                    if _cfg is not None:

                        def _to_ns(d):
                            if isinstance(d, dict):
                                return SimpleNamespace(**{k: _to_ns(v) for k, v in d.items()})
                            return d

                        max_position_embeddings = _get_max_position_embeddings(_to_ns(_cfg))
                except Exception:
                    pass

            logger.info(
                f"Model config result for {model_name}: is_vision={is_vision}, is_embedding={is_embedding}, audio_type={audio_type}, audio_type_known={audio_type_definitive}, is_lora={is_lora}, max_position_embeddings={max_position_embeddings}"
            )
            return ModelDetails(
                id = model_name,
                model_name = model_name,
                config = config_dict,
                is_vision = is_vision,
                is_embedding = is_embedding,
                is_lora = is_lora,
                is_audio = audio_type is not None,
                audio_type = audio_type,
                audio_type_known = audio_type_definitive,
                has_audio_input = is_audio_input_type(audio_type),
                model_type = derive_model_type(is_vision, audio_type, is_embedding),
                base_model = base_model,
                max_position_embeddings = max_position_embeddings,
                model_size_bytes = (
                    _get_snapshot_model_size_bytes(inspection_target)
                    if prefer_local_cache
                    else _get_model_size_bytes(model_name, hf_token)
                ),
            )

    try:
        # Off the loop: the guard blocks on DNS + HEAD + TCP, stalling every other request.
        return await asyncio.to_thread(_resolve, model_name)

    except HTTPException:
        raise
    except Exception as e:
        raise log_and_http_error(
            e,
            500,
            "Failed to get model config",
            event = "models.get_model_config_failed",
            log = logger,
        )

@router.get("/check-vision/{model_name:path}", response_model = VisionCheckResponse)
async def check_vision_model(
    model_name: str,
    hf_token: Optional[str] = Query(None),
    header_hf_token: Optional[str] = Depends(get_hf_token),
    current_subject: str = Depends(get_current_subject),
):
    """
    Check if a model is a vision model.

    This endpoint wraps the backend is_vision_model function.
    """
    hf_token = _normalize_hf_token(header_hf_token) or _normalize_hf_token(hf_token)
    try:
        logger.info(f"Checking if vision model: {model_name}")
        # Authenticate so a gated/private VLM classifies correctly (else 404 -> non-vision). Offline
        # the guard keeps this on the HF cache; a local path resolves from disk and skips the probe.
        from core.inference.llama_cpp import _hf_offline_if_unreachable_for

        # Off-loop: the probes block and is_vision_model()'s lazy sets can import transformers.
        def _check():
            with _hf_offline_if_unreachable_for(model_name):
                return is_vision_model(model_name, hf_token = hf_token)

        is_vision = await asyncio.to_thread(_check)

        logger.info(f"Vision check result for {model_name}: is_vision={is_vision}")
        return VisionCheckResponse(
            model_name = model_name,
            is_vision = is_vision,
        )

    except Exception as e:
        raise log_and_http_error(
            e,
            500,
            "Failed to check vision model",
            event = "models.check_vision_model_failed",
            log = logger,
        )


@router.get("/check-embedding/{model_name:path}", response_model = EmbeddingCheckResponse)
async def check_embedding_model(
    model_name: str,
    hf_token: Optional[str] = Query(None),
    header_hf_token: Optional[str] = Depends(get_hf_token),
    current_subject: str = Depends(get_current_subject),
):
    """
    Check if a model is an embedding model.

    This endpoint wraps the backend is_embedding_model function.
    """
    hf_token = _normalize_hf_token(header_hf_token) or _normalize_hf_token(hf_token)
    try:
        logger.info(f"Checking if embedding model: {model_name}")
        # Same guard as /check-vision: is_embedding_model hits the hub with a 15s timeout.
        from core.inference.llama_cpp import _hf_offline_if_unreachable_for

        def _check():
            with _hf_offline_if_unreachable_for(model_name):
                return is_embedding_model(model_name, hf_token = hf_token)

        is_embedding = await asyncio.to_thread(_check)

        logger.info(f"Embedding check result for {model_name}: is_embedding={is_embedding}")
        return EmbeddingCheckResponse(
            model_name = model_name,
            is_embedding = is_embedding,
        )

    except Exception as e:
        raise log_and_http_error(
            e,
            500,
            "Failed to check embedding model",
            event = "models.check_embedding_model_failed",
            log = logger,
        )
