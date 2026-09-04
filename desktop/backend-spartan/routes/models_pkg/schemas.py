"""Pydantic schemas and internal dataclasses for model management routes."""

import asyncio
from pathlib import Path
from typing import List, NamedTuple, Optional
from pydantic import BaseModel

from models import LocalModelInfo


class CachedModelRepo(BaseModel):
    repo_id: str
    size_bytes: int
    last_modified: Optional[float] = None
    # "text-to-image" for cached diffusers image repos; declared here or response_model drops it.
    task: Optional[str] = None
    # Snapshot incomplete (cancelled/partial download): the picker must not treat it as usable.
    partial: Optional[bool] = None
    # Diffusion-tagged repo with NO top-level model_index.json: needs from_single_file + a filename.
    single_file: Optional[bool] = None
    # True for an sd.cpp companion mirror (VAE / text encoders, no denoiser). Declared here or
    # response_model drops it and the flag never reaches the picker that has to filter on it.
    companion: Optional[bool] = None


class CachedModelsResponse(BaseModel):
    cached: List[CachedModelRepo]


class _CompatLocalInventorySources(NamedTuple):
    hf_cache_dir: Path
    legacy_hf: Path
    hf_default: Path
    lm_dirs: tuple[Path, ...]
    known_hf_caches: tuple[Path, ...]


_CompatLocalInventoryKey = tuple[Path, _CompatLocalInventorySources, tuple[str, ...], int]
_COMPAT_LOCAL_INVENTORY_MAX_ATTEMPTS = 8


class _CompatLocalCacheChanged(RuntimeError):
    def __init__(self, models: List[LocalModelInfo]) -> None:
        super().__init__("local inventory sources changed during the scan")
        # Carried so the attempt cap can serve the freshest scan it has instead
        # of looping forever or answering with nothing.
        self.models = models


class CachedModelPathResponse(BaseModel):
    path: str
