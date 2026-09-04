"""OpenAI-compatible Model Listing & Catalog Router.

Extracted from monolithic routes/inference.py to preserve SRP and clean architecture.
"""
from __future__ import annotations

import asyncio
import logging
import sys
import threading
import time
import weakref
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Request

from auth import get_current_subject
from core.inference import get_inference_backend
from core.inference.local_model_resolver import (
    local_gguf_quants,
    resolve_local_gguf,
    warm_index_soon,
)
from core.inference.model_ids import model_id_matches, public_model_id
from routes.models import collect_local_models
from utils.api_errors import openai_error_body

logger = logging.getLogger(__name__)

router = APIRouter()


def _get_inference_module():
    return sys.modules.get("routes.inference")


def _resolves_to_resident(load_path: Optional[str], *, llama_only: bool = False) -> bool:
    mod = _get_inference_module()
    fn = getattr(mod, "_resolves_to_resident", None)
    if fn:
        return fn(load_path, llama_only=llama_only)
    return False


def _llama_public_model_id(llama_backend, fallback: Optional[str] = None) -> Optional[str]:
    mod = _get_inference_module()
    fn = getattr(mod, "_llama_public_model_id", None)
    if fn:
        return fn(llama_backend, fallback)
    return fallback


def get_llama_cpp_backend():
    mod = _get_inference_module()
    fn = getattr(mod, "get_llama_cpp_backend", None)
    if fn:
        return fn()
    from core.inference.llama_cpp import LlamaCppBackend
    return LlamaCppBackend()


def _positive_int_or_none(value: Any) -> Optional[int]:
    try:
        n = int(value)
        return n if n > 0 else None
    except (TypeError, ValueError):
        return None

# =====================================================================
# OpenAI-Compatible Models Listing  (/models → /v1/models)
# =====================================================================

# `owned_by` marker on every /v1/models entry (loaded and available alike).
_OWNED_BY = "unsloth-studio"


def _openai_model_objects() -> list[dict]:
    """The model objects GET /v1/models exposes (one per loaded local backend).

    Shared by the LIST and RETRIEVE handlers so both report the same ids and
    field shape.
    """
    models: list[dict] = []
    _created = int(time.time())

    # Check GGUF backend
    llama_backend = get_llama_cpp_backend()
    if llama_backend.is_loaded:
        # Advertise the repo id an auto-switch load recorded, not the concrete
        # on-disk load path, so /v1/models never leaks a host path or lists a
        # model twice (path plus repo id).
        entry = {
            # Advertised repo id after an auto-switch load, else a clean public id,
            # never the absolute .gguf path (which leaks the host filesystem layout).
            "id": _llama_public_model_id(llama_backend),
            "object": "model",
            "created": _created,
            "owned_by": _OWNED_BY,
        }
        _quant = getattr(llama_backend, "hf_variant", None)
        if _quant and _quant_reference_resolves(entry["id"], _quant):
            entry["quant"] = _quant
        _ctx = _positive_int_or_none(getattr(llama_backend, "context_length", None))
        if _ctx is not None:
            entry["context_length"] = _ctx
        _max_ctx = _positive_int_or_none(getattr(llama_backend, "max_context_length", None))
        if _max_ctx is not None:
            entry["max_context_length"] = _max_ctx
        _native_ctx = _positive_int_or_none(getattr(llama_backend, "native_context_length", None))
        if _native_ctx is not None:
            entry["native_context_length"] = _native_ctx
        models.append(entry)

    # Check Unsloth backend
    backend = get_inference_backend()
    if backend.active_model_name:
        model_info = backend.models.get(backend.active_model_name, {})
        entry = {
            "id": public_model_id(backend.active_model_name),
            "object": "model",
            "created": _created,
            "owned_by": _OWNED_BY,
        }
        _ctx = _positive_int_or_none(model_info.get("context_length"))
        if _ctx is None:
            for _candidate in (
                getattr(backend, "context_length", None),
                getattr(backend, "max_seq_length", None),
            ):
                _ctx = _positive_int_or_none(_candidate)
                if _ctx is not None:
                    break
        if _ctx is not None:
            entry["context_length"] = _ctx
        models.append(entry)

    return models


# Brief cache for the local-model filesystem scan so repeated /v1/models calls
# don't rescan the HF cache and models dirs on every request.
_CATALOG_CACHE: dict = {"at": 0.0, "models": []}
# Ids the last catalog scan listed, rebuilt only when that scan is replaced.
_ADVERTISED_CACHE: dict = {"at": None, "paths": {}}


def _quant_reference_resolves(model_id: Optional[str], quant: str) -> bool:
    """Whether ``<model_id>:<quant>`` still resolves once this model is not resident.

    A standalone .gguf takes its quant from the filename, but the resolver stores
    such files with no quants, so advertising one hands out a pin that dies the
    moment another model loads.
    """
    from core.inference.local_model_resolver import (
        index_is_built,
        recently_downloaded,
        resolve_local_gguf,
        warm_index_soon,
    )

    if not model_id:
        return False
    # A cold index proves nothing, and publishing on no proof is what hands out the
    # dead pin; warm so the next response carries the quant.
    warm_index_soon()
    return resolve_local_gguf(f"{model_id}:{quant}", allow_scan = False) is not None


def _advertised_local_path(model: str) -> Optional[str]:
    """On-disk path of *model* if the last /v1/models scan listed it, else None.

    Cache-only, never scans. The catalog scans on its own schedule, so it can have
    advertised a local model the resolver index has not picked up yet, which is
    evidence the name means something other than the resident one.
    """
    if _ADVERTISED_CACHE["at"] != _CATALOG_CACHE["at"]:
        paths = {}
        for info in _CATALOG_CACHE["models"] or ():
            cid = getattr(info, "model_id", None) or public_model_id(getattr(info, "id", None))
            path = getattr(info, "path", None)
            if cid and path:
                paths.setdefault(cid.strip().lower(), path)
        _ADVERTISED_CACHE.update(at = _CATALOG_CACHE["at"], paths = paths)
    return _ADVERTISED_CACHE["paths"].get(model.strip().lower())


_CATALOG_TTL_S = 30.0
# Per-loop lock (like _auto_switch_lock): a module-level asyncio.Lock ties its
# waiters to the loop that first awaited it, so a second event loop awaiting it
# in a multi-loop ASGI process can hang. The cache double-check keeps correctness
# even when two loops each scan once.
_catalog_locks: "weakref.WeakKeyDictionary" = weakref.WeakKeyDictionary()
_catalog_locks_guard = threading.Lock()


def _catalog_lock() -> asyncio.Lock:
    loop = asyncio.get_running_loop()
    with _catalog_locks_guard:
        lock = _catalog_locks.get(loop)
        if lock is None:
            lock = _catalog_locks[loop] = asyncio.Lock()
        return lock


async def _cached_local_catalog() -> list:
    """Locally available models (models dir + HF caches + LM Studio + scan
    folders), cached for a few seconds. Returns a list of LocalModelInfo.

    The scan walks several directories and stats many files, so it runs in a
    worker thread (asyncio.to_thread) -- calling it inline would block the event
    loop and stall every concurrent request and in-flight inference stream. A
    lock with a double-check collapses a burst of simultaneous /v1/models calls
    into a single scan instead of one per request."""
    # Validity is keyed on "at" (set only after a scan), not on list contents, so
    # an empty/errored scan is still cached instead of rescanning on every poll.
    now = time.monotonic()
    if _CATALOG_CACHE["at"] and (now - _CATALOG_CACHE["at"]) <= _CATALOG_TTL_S:
        return _CATALOG_CACHE["models"]
    async with _catalog_lock():
        now = time.monotonic()
        if _CATALOG_CACHE["at"] and (now - _CATALOG_CACHE["at"]) <= _CATALOG_TTL_S:
            return _CATALOG_CACHE["models"]
        try:
            from routes.models import collect_local_models
            _CATALOG_CACHE["models"] = await asyncio.to_thread(
                collect_local_models, Path("./models").resolve()
            )
        except Exception as exc:
            logger.debug("model catalog scan failed: %s", exc)
            _CATALOG_CACHE["models"] = []
        # Stamp after the scan, not the pre-scan "now": a scan slower than the TTL
        # would otherwise leave the cache already expired, so every waiter rescans.
        _CATALOG_CACHE["at"] = time.monotonic()
    return _CATALOG_CACHE["models"]


async def _openai_catalog_objects() -> list[dict]:
    """Every model the server knows about for ``GET /v1/models``: the loaded
    model(s) plus locally available (downloaded/cached) models discovered by
    scanning. Loaded entries keep their context fields and are marked
    ``loaded: true``. All ids are clean public ids (never absolute paths)."""
    _created = int(time.time())
    # Loaded models first (clean ids + context fields), marked loaded.
    by_id: dict[str, dict] = {}
    # Off-loop: _openai_model_objects() is sync and calls get_inference_backend(), whose cold
    # build waits on detection. Inline, an early GET /v1/models held the loop for the import.
    for entry in await asyncio.to_thread(_openai_model_objects):
        by_id[entry["id"]] = {**entry, "loaded": True}

    # Locally available (downloaded/cached) models that are not already loaded.
    # Advertise only GGUF models /v1 can actually serve (llama.cpp). GGUF-ness is
    # read from the on-disk files, not model_format: the HF-cache scanner leaves
    # model_format unset for GGUF snapshots, so a model_format filter would drop
    # every cached GGUF. The file checks run off the loop.
    from core.inference.local_model_resolver import local_gguf_quants

    catalog = await _cached_local_catalog()
    # One scan yields both "is this servable" and its on-disk quants, so no second pass.
    servable = await asyncio.to_thread(
        lambda: [(i, q) for i in catalog if (q := local_gguf_quants(i)) is not None]
    )
    for info, quants in servable:
        cid = getattr(info, "model_id", None) or public_model_id(getattr(info, "id", None))
        if not cid or cid in by_id:
            continue
        obj = {
            "id": cid,
            "object": "model",
            "created": _created,
            "owned_by": _OWNED_BY,
            # A manual load keys the resident entry by path basename while the catalog
            # uses the alias, so match on the path or the alias reads as not loaded.
            # llama-only: a Transformers model live from a directory that also holds
            # GGUF exports must not mark one of these GGUF entries loaded, or the
            # examples pin a quant nothing can serve with switching off.
            "loaded": _resolves_to_resident(getattr(info, "path", None), llama_only = True),
        }
        # The id stays bare for OpenAI compat; a client appends ":<quant>" to pin one.
        # For the resident model that must be the quant actually loaded, not the
        # preferred one on disk, or the listing advertises alias:Q4 while Q8 serves.
        resident_quant = getattr(get_llama_cpp_backend(), "hf_variant", None)
        if obj["loaded"] and resident_quant:
            obj["quant"] = resident_quant
        elif quants:
            obj["quant"] = quants[0]
        display = getattr(info, "display_name", None)
        if display:
            obj["display_name"] = display
        by_id[cid] = obj

    return list(by_id.values())


@router.get("/models")
async def openai_list_models(current_subject: str = Depends(get_current_subject)):
    """
    OpenAI-compatible model listing endpoint (``GET /v1/models``).

    Lists every model available on this server -- the loaded model(s) plus
    locally available (downloaded/cached) models -- not only what is resident in
    memory. Each entry carries a clean public id and a ``loaded`` flag.
    """
    return {"object": "list", "data": await _openai_catalog_objects()}


@router.get("/models/{model_id:path}")
async def openai_retrieve_model(model_id: str, current_subject: str = Depends(get_current_subject)):
    """
    OpenAI-compatible single-model retrieval endpoint (``GET /v1/models/{id}``).

    Returns the bare model object when ``model_id`` matches a known model
    (loaded or locally available), or 404 model_not_found otherwise. Defined
    after the LIST route so it does not shadow it; ``{model_id:path}`` keeps ids
    with slashes intact.
    """
    from core.inference.model_ids import model_id_matches

    # Loaded models resolve without a catalog scan (the common case); only build
    # the full catalog -- which may hit the filesystem -- for unloaded ids. Match
    # case-insensitively, like the catalog loop below and the resolver's index.
    # Off-loop like the catalog helper: the singleton's cold build waits on detection.
    _loaded = await asyncio.to_thread(_openai_model_objects)
    for entry in _loaded:
        eid = entry["id"]
        if isinstance(eid, str) and eid.lower() == model_id.lower():
            return {**entry, "loaded": True}

    objects = await _openai_catalog_objects()
    for model in objects:
        # Case-insensitive to match the resolver, which lowercases its index.
        mid = model.get("id")
        if isinstance(mid, str) and mid.lower() == model_id.lower():
            return model
    # Backward compatibility: a client may still send the legacy raw identifier
    # (e.g. an absolute .gguf path cached from an older /v1/models). Map it to the
    # loaded model's object so it keeps working, without ever echoing the path back.
    # Key each raw id to the SAME public id its /v1/models entry uses: an
    # auto-switch load advertises a repo id while its identifier is the snapshot
    # path, so public_model_id(path) would miss the advertised entry and 404 a
    # model that is in fact loaded.
    llama_backend = get_llama_cpp_backend()
    backend = await asyncio.to_thread(get_inference_backend)
    raw_to_public: list[tuple[str, Optional[str]]] = []
    if llama_backend.is_loaded and llama_backend.model_identifier:
        raw_to_public.append(
            (llama_backend.model_identifier, _llama_public_model_id(llama_backend))
        )
    if backend.active_model_name:
        raw_to_public.append(
            (backend.active_model_name, public_model_id(backend.active_model_name))
        )
    for raw, clean in raw_to_public:
        if model_id_matches(model_id, raw):
            for entry in _loaded:
                if entry["id"] == clean:
                    return {**entry, "loaded": True}
    raise HTTPException(
        status_code = 404,
        detail = openai_error_body(
            f"The model '{model_id}' does not exist",
            status = 404,
            code = "model_not_found",
            param = "id",
        ),
    )

