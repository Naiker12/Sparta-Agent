"""Endpoints and scan pipelines for local models, scan folders and folder browsing."""

import asyncio
import hashlib
import json
import os
import uuid
import sys
import time
from pathlib import Path
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from loggers import get_logger

from auth.authentication import get_current_subject
from hub.dependencies import get_hf_token
from models import LocalModelInfo, LocalModelListResponse
from models.models import (
    AddScanFolderRequest,
    BrowseEntry,
    BrowseFoldersResponse,
    ScanFolderInfo,
)
from utils.utils import log_and_http_error
from utils.paths import is_local_path, normalize_path, resolve_output_dir
from utils.paths.scan_folder_health import (
    annotate_scan_folders,
    note_scan_folder_scanned,
    record_scan_failure,
    refresh_failed_scan_folders,
)
from utils.hidden_models import (
    _safe_resolve,
    is_hidden_model as _is_hidden_model,
)
from routes.models_pkg.schemas import (
    _CompatLocalInventorySources,
    _CompatLocalInventoryKey,
    _COMPAT_LOCAL_INVENTORY_MAX_ATTEMPTS,
    _CompatLocalCacheChanged,
)
from routes.models_pkg.helpers_paths import (
    _safe_is_dir,
    _resolve_hf_cache_dir,
    _is_model_directory,
    _dir_has_downloaded_model,
    _count_model_files,
    _has_direct_model_signal,
    _looks_like_model_dir,
    _build_browse_allowlist,
    _is_path_inside_allowlist,
    _normalize_browse_request_path,
    _browse_relative_parts,
    _match_browse_child,
    _resolve_browse_target,
    _resolve_hf_cache_realpath,
    _normalize_hf_token,
    _BROWSE_ENTRY_CAP,
)
from routes.models_pkg.helpers_detection import (
    _has_non_gguf_weights,
    _is_weight_bin,
    _local_pipeline_index,
    _is_gguf_companion_only_dir,
    _local_model_task,
    _is_main_gguf_filename,
)

router = APIRouter()
logger = get_logger(__name__)

_compat_local_inventory_flights: dict[
    tuple[asyncio.AbstractEventLoop, _CompatLocalInventoryKey], asyncio.Task[List[LocalModelInfo]]
] = {}

def _scan_models_dir(models_dir: Path, *, limit: int | None = None) -> List[LocalModelInfo]:
    if not models_dir.exists() or not models_dir.is_dir():
        return []

    # A scan folder can point at a diffusers PIPELINE dir, which _is_model_directory rejects but the load path accepts.
    _is_self_model = _is_model_directory(models_dir) or _local_pipeline_index(models_dir)

    if _is_self_model:
        try:
            updated_at = models_dir.stat().st_mtime
        except OSError:
            updated_at = None
        return [
            LocalModelInfo(
                id = str(models_dir),
                display_name = models_dir.name,
                path = str(models_dir),
                source = "models_dir",
                model_format = _dir_model_format(models_dir),
                updated_at = updated_at,
            ),
        ]

    found: List[LocalModelInfo] = []
    for child in models_dir.iterdir():
        if limit is not None and len(found) >= limit:
            break
        try:
            if not child.is_dir():
                continue
            gguf_names = [p.name for p in child.glob("*.gguf")]
            has_gguf = bool(gguf_names)
            # mmproj alone is a vision adapter, not servable weights: decides presence, never format.
            has_main_gguf = any(_is_main_gguf_filename(n) for n in gguf_names)
            has_non_gguf_weights = _has_non_gguf_weights(child)
            has_config = (child / "config.json").exists() or (
                child / "adapter_config.json"
            ).exists()
            # A diffusers PIPELINE folder (weights in component subdirs) is missed above but loadable.
            has_pipeline_index = _local_pipeline_index(child)
            has_model_files = has_gguf or has_non_gguf_weights or has_config or has_pipeline_index
        except OSError:
            # Skip unreadable children rather than failing the scan.
            continue
        if not has_model_files:
            continue
        try:
            updated_at = child.stat().st_mtime
        except OSError:
            updated_at = None
        # A folder whose only weights are .gguf is GGUF-format even with a config.json (common for
        # HF GGUF repos, often without a -GGUF suffix), so surface the format for the UI.
        model_format = "gguf" if has_main_gguf and not has_non_gguf_weights else None
        found.append(
            LocalModelInfo(
                id = str(child),
                display_name = child.name,
                path = str(child),
                source = "models_dir",
                model_format = model_format,
                updated_at = updated_at,
            ),
        )
    if limit is None or len(found) < limit:
        for gguf_file in models_dir.glob("*.gguf"):
            if limit is not None and len(found) >= limit:
                break
            # A standalone mmproj is a vision adapter, not servable weights.
            if gguf_file.is_file() and _is_main_gguf_filename(gguf_file.name):
                try:
                    updated_at = gguf_file.stat().st_mtime
                except OSError:
                    updated_at = None
                found.append(
                    LocalModelInfo(
                        id = str(gguf_file),
                        display_name = gguf_file.stem,
                        path = str(gguf_file),
                        source = "models_dir",
                        model_format = "gguf",
                        updated_at = updated_at,
                    ),
                )

    # A scan folder can also point at a BARE single-file checkpoint dir (one loose .safetensors,
    # no configs): both checks reject it, but resolve_local_single_file loads it.
    if not found and (limit is None or limit > 0) and _has_non_gguf_weights(models_dir):
        try:
            updated_at = models_dir.stat().st_mtime
        except OSError:
            updated_at = None
        found.append(
            LocalModelInfo(
                id = str(models_dir),
                display_name = models_dir.name,
                path = str(models_dir),
                source = "models_dir",
                model_format = _dir_model_format(models_dir),
                updated_at = updated_at,
            ),
        )

    return found


def _scan_hf_cache(
    cache_dir: Path,
    *,
    active_cache: bool = True,
    classify_format: bool = True,
    variant_states = None,
) -> List[LocalModelInfo]:
    if not cache_dir.exists() or not cache_dir.is_dir():
        return []

    from hub.utils import inventory_scan as hf_cache_scan

    found: List[LocalModelInfo] = []
    for repo_dir in cache_dir.glob("models--*"):
        if not repo_dir.is_dir():
            continue

        repo_name = repo_dir.name[len("models--") :]
        if not repo_name:
            continue
        model_id = repo_name.replace("--", "/")

        try:
            updated_at = repo_dir.stat().st_mtime
        except OSError:
            updated_at = None

        variant_state = (
            variant_states.for_repo("model", model_id, hub_cache = cache_dir)
            if variant_states is not None
            else None
        )
        partial = hf_cache_scan.is_snapshot_partial(
            "model", model_id, repo_dir, variant_state = variant_state
        )
        partial = partial or hf_cache_scan.is_gguf_repo_partial(
            model_id, repo_dir, variant_state = variant_state
        )

        load_id = model_id
        snapshot = _resolve_hf_cache_realpath(repo_dir)
        if not active_cache:
            load_id = snapshot or str(repo_dir.resolve())
        # Classify from the snapshot's own weights: a GGUF repo without a -GGUF suffix is common,
        # and leaving this unset makes every consumer guess from the name.
        model_format = (
            _dir_model_format(Path(snapshot), recursive = True)
            if snapshot and classify_format
            else None
        )
        found.append(
            LocalModelInfo(
                id = load_id,
                model_id = model_id,
                display_name = model_id.split("/")[-1],
                model_format = model_format,
                path = load_id if not active_cache else str(repo_dir),
                source = "hf_cache",
                active_cache = active_cache,
                partial = partial,
                updated_at = updated_at,
            ),
        )
    return found


def _dir_model_format(path: Path, recursive: bool = False) -> Optional[str]:
    """Return ``"gguf"`` for a directory whose only weights are ``.gguf`` files.

    LM Studio and custom GGUF folders frequently lack a ``-GGUF`` name suffix,
    so the UI relies on this hint to route them through the GGUF load path
    rather than treating them as plain local checkpoints. A directory whose only
    ``.gguf`` is an mmproj vision adapter is not one: the variant selector drops
    mmproj, so that path would find nothing to serve.

    ``recursive`` is for HF cache snapshots, which keep split quants in per-quant
    subdirectories: a flat glob sees no ``.gguf`` there and would report the
    snapshot as non-GGUF, hiding every sharded repo from the GGUF pickers. It looks
    one level down rather than walking the tree, because that is where split quants
    live and ``/api/models/local`` is async: an unbounded ``rglob`` per repo would
    have to exhaust every non-GGUF snapshot before concluding there is no GGUF,
    blocking the event loop on a large cache.
    """
    try:
        found = path.glob("*.gguf")
        if not any(_is_main_gguf_filename(p.name) for p in found):
            if not recursive:
                return None
            if not any(_is_main_gguf_filename(p.name) for p in path.glob("*/*.gguf")):
                return None
        return None if _has_non_gguf_weights(path) else "gguf"
    except OSError:
        return None


def _scan_lmstudio_dir(lm_dir: Path) -> List[LocalModelInfo]:
    """Scan an LM Studio models directory for model files.

    LM Studio uses a ``publisher/model-name`` folder structure with GGUF
    files, or standalone GGUF files at the top level.
    """
    if not lm_dir.exists() or not lm_dir.is_dir():
        return []

    # lm_dir may itself be a model directory (not a publisher); return it rather than skip it.
    if _is_model_directory(lm_dir):
        try:
            updated_at = lm_dir.stat().st_mtime
        except OSError:
            updated_at = None
        return [
            LocalModelInfo(
                id = str(lm_dir),
                display_name = lm_dir.name,
                path = str(lm_dir),
                source = "lmstudio",
                model_format = _dir_model_format(lm_dir),
                updated_at = updated_at,
            ),
        ]

    found: List[LocalModelInfo] = []
    for child in lm_dir.iterdir():
        try:
            if not child.is_dir():
                if _is_main_gguf_filename(child.name) and child.is_file():
                    try:
                        updated_at = child.stat().st_mtime
                    except OSError:
                        updated_at = None
                    found.append(
                        LocalModelInfo(
                            id = str(child),
                            display_name = child.stem,
                            path = str(child),
                            source = "lmstudio",
                            model_format = "gguf",
                            updated_at = updated_at,
                        ),
                    )
                continue

            # Surface a model-directory child directly instead of descending into it as a publisher.
            if _is_model_directory(child):
                try:
                    updated_at = child.stat().st_mtime
                except OSError:
                    updated_at = None
                found.append(
                    LocalModelInfo(
                        id = str(child),
                        display_name = child.name,
                        path = str(child),
                        source = "lmstudio",
                        model_format = _dir_model_format(child),
                        updated_at = updated_at,
                    ),
                )
                continue

            # child is a publisher directory; scan its subdirectories.
            for model_dir in child.iterdir():
                try:
                    if model_dir.is_dir():
                        has_model = (
                            any(model_dir.glob("*.gguf"))
                            or (model_dir / "config.json").exists()
                            or any(model_dir.glob("*.safetensors"))
                        )
                        if not has_model:
                            continue
                        model_id = f"{child.name}/{model_dir.name}"
                        try:
                            updated_at = model_dir.stat().st_mtime
                        except OSError:
                            updated_at = None
                        found.append(
                            LocalModelInfo(
                                id = str(model_dir),
                                model_id = model_id,
                                display_name = model_dir.name,
                                path = str(model_dir),
                                source = "lmstudio",
                                model_format = _dir_model_format(model_dir),
                                updated_at = updated_at,
                            ),
                        )
                    elif _is_main_gguf_filename(model_dir.name) and model_dir.is_file():
                        try:
                            updated_at = model_dir.stat().st_mtime
                        except OSError:
                            updated_at = None
                        found.append(
                            LocalModelInfo(
                                id = str(model_dir),
                                model_id = f"{child.name}/{model_dir.stem}",
                                display_name = model_dir.stem,
                                path = str(model_dir),
                                source = "lmstudio",
                                model_format = "gguf",
                                updated_at = updated_at,
                            ),
                        )
                except OSError:
                    continue
        except OSError:
            continue
    return found


def _ollama_links_dir(ollama_dir: Path) -> Optional[Path]:
    """Return a writable directory for Ollama ``.gguf`` symlinks.

    Prefers ``<ollama_dir>/.studio_links/`` so links sit next to their
    blobs; falls back to a per-ollama-dir namespace under Unsloth's cache
    when the models dir is read-only (common for system installs).
    """
    from utils.paths.storage_roots import cache_root

    primary = ollama_dir / ".studio_links"
    try:
        primary.mkdir(exist_ok = True)
        return primary
    except OSError as e:
        logger.debug(
            "Ollama dir %s not writable for .studio_links (%s); falling back to Unsloth cache",
            ollama_dir,
            e,
        )

    # Fallback: namespace by a hash of ollama_dir so two roots don't collide (cache path only).
    try:
        digest = hashlib.sha256(str(ollama_dir.resolve()).encode()).hexdigest()[:12]
    except OSError:
        digest = "default"
    fallback = cache_root() / "ollama_links" / digest
    try:
        fallback.mkdir(parents = True, exist_ok = True)
        return fallback
    except OSError as e:
        logger.warning(
            "Could not create Ollama symlink cache at %s: %s",
            fallback,
            e,
        )
        return None


def _scan_ollama_dir(ollama_dir: Path, limit: Optional[int] = None) -> List[LocalModelInfo]:
    """Scan an Ollama models directory for downloaded models.

    Ollama uses a content-addressable layout
    (``manifests/<host>/<namespace>/<model>/<tag>`` + ``blobs/sha256-...``);
    we ``rglob`` all manifests so every layout depth is found. Each
    manifest is JSON with a ``layers`` array: the
    ``application/vnd.ollama.image.model`` layer holds the GGUF weights
    and ``...image.projector`` is the vision adapter.

    Ollama blobs lack the ``.gguf`` extension the loading pipeline
    requires, so we create ``.gguf``-named links to them (one subdir per
    model, keyed by a short hash of the manifest path, so
    ``detect_mmproj_file`` only sees that model's projector). Links are
    symlinks when possible, else hardlinks; the link dir is
    ``.studio_links/`` when writable, else Unsloth's cache.
    """
    manifests_root = ollama_dir / "manifests"
    if not manifests_root.is_dir():
        return []

    found: List[LocalModelInfo] = []
    blobs_dir = ollama_dir / "blobs"
    links_root = _ollama_links_dir(ollama_dir)
    if links_root is None:
        logger.warning(
            "Skipping Ollama scan for %s: no writable location for .gguf links",
            ollama_dir,
        )
        return []

    def _make_link(link_dir: Path, link_name: str, target: Path) -> Optional[str]:
        """Create a .gguf-named link to an Ollama blob.

        Tries symlink, then hardlink; skips the model if neither works
        (a multi-GB copy in a sync request would block the backend).
        Idempotent: skips recreation when a valid link already exists.
        """
        link_dir.mkdir(parents = True, exist_ok = True)
        link_path = link_dir / link_name
        resolved = target.resolve()

        # Skip if the link already points at the same blob; size checks can reuse stale links.
        try:
            if link_path.exists() and os.path.samefile(str(link_path), str(resolved)):
                return str(link_path)
        except OSError as e:
            logger.debug("Error checking existing link %s: %s", link_path, e)

        tmp_path = link_dir / f".{link_name}.tmp-{uuid.uuid4().hex[:8]}"
        try:
            if tmp_path.is_symlink() or tmp_path.exists():
                tmp_path.unlink()
            try:
                tmp_path.symlink_to(resolved)
            except OSError:
                try:
                    os.link(str(resolved), str(tmp_path))
                except OSError:
                    logger.warning(
                        "Could not create link for Ollama blob %s "
                        "(symlinks and hardlinks both failed). "
                        "Skipping model to avoid blocking the API.",
                        target,
                    )
                    return None
            os.replace(str(tmp_path), str(link_path))
            return str(link_path)
        except OSError as e:
            logger.debug("Could not create Ollama link %s: %s", link_path, e)
            try:
                if tmp_path.is_symlink() or tmp_path.exists():
                    tmp_path.unlink()
            except OSError as cleanup_err:
                logger.debug("Could not clean up tmp path %s: %s", tmp_path, cleanup_err)
            return None

    try:
        for tag_file in manifests_root.rglob("*"):
            if not tag_file.is_file():
                continue

            rel = tag_file.relative_to(manifests_root)
            parts = rel.parts
            if len(parts) < 3:
                continue

            host = parts[0]
            repo_parts = list(parts[1:-1])
            tag = parts[-1]

            if host == "registry.ollama.ai" and repo_parts and repo_parts[0] == "library":
                repo_name = "/".join(repo_parts[1:])
            elif host == "registry.ollama.ai":
                repo_name = "/".join(repo_parts)
            else:
                repo_name = "/".join([host] + repo_parts)

            if not repo_name:
                continue

            display = f"{repo_name}:{tag}"

            manifest_key = rel.as_posix()
            stem_hash = hashlib.sha256(manifest_key.encode()).hexdigest()[:10]

            try:
                manifest = json.loads(tag_file.read_text(encoding = "utf-8-sig"))
            except (json.JSONDecodeError, OSError, UnicodeDecodeError) as e:
                logger.debug(
                    "Skipping unreadable/invalid Ollama manifest %s: %s",
                    tag_file,
                    e,
                )
                continue

            config_digest = manifest.get("config", {}).get("digest", "")
            model_type = ""
            file_type = ""
            if config_digest and blobs_dir.is_dir():
                config_blob = blobs_dir / config_digest.replace(":", "-")
                if config_blob.is_file():
                    try:
                        cfg = json.loads(config_blob.read_text(encoding = "utf-8-sig"))
                        model_type = cfg.get("model_type", "")
                        file_type = cfg.get("file_type", "")
                    except (json.JSONDecodeError, OSError, UnicodeDecodeError) as e:
                        logger.debug(
                            "Could not parse Ollama config blob %s: %s",
                            config_blob,
                            e,
                        )

            model_link_dir = links_root / stem_hash

            gguf_link_path: Optional[str] = None
            quant = f"-{file_type}" if file_type else ""
            safe_name = repo_name.replace("/", "-")
            for layer in manifest.get("layers") or []:
                media = layer.get("mediaType", "")
                digest = layer.get("digest", "")
                if not digest:
                    continue

                if media == "application/vnd.ollama.image.model":
                    candidate = blobs_dir / digest.replace(":", "-")
                    if candidate.is_file():
                        link_name = f"{safe_name}-{tag}{quant}.gguf"
                        gguf_link_path = _make_link(model_link_dir, link_name, candidate)

                elif media == "application/vnd.ollama.image.projector":
                    candidate = blobs_dir / digest.replace(":", "-")
                    if candidate.is_file():
                        mmproj_name = f"{safe_name}-{tag}-mmproj.gguf"
                        _make_link(model_link_dir, mmproj_name, candidate)

            if not gguf_link_path:
                continue

            suffix = ""
            if model_type:
                suffix += f" ({model_type}"
                if file_type:
                    suffix += f" {file_type}"
                suffix += ")"

            try:
                updated_at = tag_file.stat().st_mtime
            except OSError:
                updated_at = None

            found.append(
                LocalModelInfo(
                    id = gguf_link_path,
                    model_id = f"ollama/{repo_name}:{tag}",
                    display_name = display + suffix,
                    path = gguf_link_path,
                    source = "custom",
                    updated_at = updated_at,
                ),
            )
            if limit is not None and len(found) >= limit:
                return found
    except OSError as e:
        logger.warning("Error scanning Ollama directory %s: %s", ollama_dir, e)
    return found

def _compat_local_inventory_sources() -> _CompatLocalInventorySources:
    from utils.paths import hf_default_cache_dir, legacy_hf_cache_dir, lmstudio_model_dirs
    from utils.hf_cache_settings import known_hf_hub_caches
    return _CompatLocalInventorySources(
        _resolve_hf_cache_dir(),
        legacy_hf_cache_dir(),
        hf_default_cache_dir(),
        tuple(lmstudio_model_dirs()),
        tuple(known_hf_hub_caches()),
    )


def collect_local_models(
    models_root: Path,
    *,
    custom_folders: Optional[list[dict]] = None,
    sources: Optional[_CompatLocalInventorySources] = None,
) -> List[LocalModelInfo]:
    """Scan ``models_root``, the HF caches, LM Studio dirs, and user scan folders,
    returning a deduplicated, hidden-filtered list of discovered local models.

    Shared by ``GET /models/local`` (the model picker) and the OpenAI-compatible
    catalog (``GET /v1/models``) so the UI and the API never drift. ``models_root``
    must already be validated/trusted by the caller.
    """
    from storage.studio_db import list_scan_folders
    from utils.models.model_config import detect_gguf_model

    sources = sources or _compat_local_inventory_sources()
    hf_cache_dir = sources.hf_cache_dir
    legacy_hf = sources.legacy_hf
    hf_default = sources.hf_default
    lm_dirs = sources.lm_dirs
    if custom_folders is None:
        try:
            custom_folders = list_scan_folders()
        except Exception as e:
            logger.warning("Could not load custom scan folders: %s", e)
            custom_folders = []

    local_models = _scan_models_dir(models_root)
    active_cache_real = _safe_resolve(hf_cache_dir)
    active_cache_key = os.path.normcase(active_cache_real) if active_cache_real else None
    seen_hf: set[str] = set()
    hf_sources: list[tuple[Path, bool]] = []
    for cache_dir in (
        hf_cache_dir,
        *sources.known_hf_caches,
        legacy_hf,
        hf_default,
    ):
        cache_real = _safe_resolve(cache_dir)
        if cache_real is None:
            continue
        cache_key = os.path.normcase(str(cache_real))
        if cache_key in seen_hf:
            continue
        seen_hf.add(cache_key)
        hf_sources.append((cache_dir, cache_key == active_cache_key))

    state_repositories = []
    state_cache_dirs = [cache_dir for cache_dir, _active_cache in hf_sources]
    state_cache_dirs.extend(Path(folder["path"]) for folder in custom_folders)
    for cache_dir in dict.fromkeys(state_cache_dirs):
        try:
            for repo_dir in cache_dir.glob("models--*"):
                repo_name = repo_dir.name[len("models--") :]
                if repo_name and repo_dir.is_dir():
                    state_repositories.append(("model", repo_name.replace("--", "/"), cache_dir))
        except OSError:
            continue
    try:
        from hub.utils import download_manifest
        variant_states = download_manifest.build_variant_state_index(
            state_repositories,
            active_hub_cache = hf_cache_dir,
        )
    except Exception as e:
        logger.warning("Could not build shared legacy Hub-state index: %s", e)
        variant_states = None

    for cache_dir, active_cache in hf_sources:
        local_models += _scan_hf_cache(
            cache_dir,
            active_cache = active_cache,
            variant_states = variant_states,
        )

    for lm_dir in lm_dirs:
        local_models += _scan_lmstudio_dir(lm_dir)

    # Scan user-added custom folders (per-folder cap).
    _MAX_MODELS_PER_FOLDER = 200
    for folder in custom_folders:
        folder_path = Path(folder["path"])
        try:
            # Filter Ollama .studio_links/ from generic scanners: duplicates and internal paths.
            _generic = [
                m
                for m in (
                    _scan_models_dir(folder_path, limit = _MAX_MODELS_PER_FOLDER)
                    + _scan_hf_cache(
                        folder_path,
                        active_cache = False,
                        variant_states = variant_states,
                    )
                    + _scan_lmstudio_dir(folder_path)
                )
                if not any(p in (".studio_links", "ollama_links") for p in Path(m.path).parts)
            ]
            custom_models = []
            for model in _generic:
                path = Path(model.path)
                is_gguf_row = model.model_format == "gguf" or _is_gguf_companion_only_dir(path)
                if not is_gguf_row or model.partial:
                    custom_models.append(model)
                    continue
                if path.is_dir():
                    patterns = ("*", "*/*") if model.source == "hf_cache" else ("*",)
                    if any(
                        detect_gguf_model(str(file), model_root = str(folder_path)) is not None
                        for pattern in patterns
                        for file in path.glob(pattern)
                        if not _safe_is_dir(file) and file.suffix.lower() == ".gguf"
                    ):
                        custom_models.append(model)
                elif (
                    detect_gguf_model(
                        model.path,
                        model_root = str(folder_path),
                    )
                    is not None
                ):
                    custom_models.append(model)
            if len(custom_models) < _MAX_MODELS_PER_FOLDER:
                custom_models += _scan_ollama_dir(
                    folder_path,
                    limit = _MAX_MODELS_PER_FOLDER - len(custom_models),
                )
        except OSError as e:
            logger.warning("Skipping unreadable scan folder %s: %s", folder_path, e)
            # Keep the reason so the folder list can show it instead of nothing.
            record_scan_failure(str(folder.get("path", folder_path)), e)
            continue
        note_scan_folder_scanned(str(folder.get("path", folder_path)), found = bool(custom_models))
        local_models += [m.model_copy(update = {"source": "custom"}) for m in custom_models]

    # Deduplicate, but always keep custom folder entries (keyed by (id, source)) so they show
    # in the "Custom Folders" UI section even when the model is also in the HF cache.
    deduped: dict[str, LocalModelInfo] = {}
    for model in local_models:
        semantic_id = model.model_id if model.source == "hf_cache" and model.model_id else model.id
        key = f"{semantic_id}\x00custom" if model.source == "custom" else semantic_id
        existing = deduped.get(key)
        prefer_model = existing is None
        if existing is not None and model.source == existing.source == "hf_cache":
            if model.partial != existing.partial:
                prefer_model = not model.partial
            elif bool(model.active_cache) != bool(existing.active_cache):
                prefer_model = bool(model.active_cache)
            else:
                prefer_model = (model.updated_at or 0) > (existing.updated_at or 0)
        if prefer_model:
            deduped[key] = model

    models = sorted(
        deduped.values(),
        key = lambda item: item.updated_at or 0,
        reverse = True,
    )
    return [m for m in models if not _is_hidden_model(m.id, m.model_id, m.path)]

def _compat_inventory_path_identity(path: object) -> str:
    """Canonical source identity for compatibility inventory flights."""
    raw = str(path)
    try:
        return os.path.normcase(os.path.realpath(os.path.expanduser(raw)))
    except (OSError, UnicodeError, ValueError):
        return os.path.normcase(raw)


async def _shared_compat_local_inventory_scan(
    models_root: Path, sources: Optional[_CompatLocalInventorySources] = None
) -> List[LocalModelInfo]:
    from storage.studio_db import list_scan_folders
    from hub.utils import inventory_scan as hf_cache_scan

    requested_sources = sources

    def classify(models: List[LocalModelInfo]) -> List[LocalModelInfo]:
        # Tag each model with its task so the Images picker can filter to diffusion.
        # Inside the shared flight so overlapping callers reuse one classified result
        # instead of each repeating the GGUF header reads.
        return [m.model_copy(update = {"task": _local_model_task(m)}) for m in models]

    async def collect(
        expected_epoch: int, custom_folders: List[dict], scan_sources: _CompatLocalInventorySources
    ) -> List[LocalModelInfo]:
        models = await asyncio.to_thread(
            collect_local_models,
            models_root,
            custom_folders = custom_folders,
            sources = scan_sources,
        )
        if hf_cache_scan.hf_cache_scans_epoch() != expected_epoch:
            raise _CompatLocalCacheChanged(models)
        classified = await asyncio.to_thread(classify, models)
        # That hop is an await point of its own, so a mutation can land after the check above.
        if hf_cache_scan.hf_cache_scans_epoch() != expected_epoch:
            raise _CompatLocalCacheChanged(models)
        return classified

    # Discard obsolete results and retry their waiters against the current cache epoch.
    superseded: Optional[List[LocalModelInfo]] = None
    for _attempt in range(_COMPAT_LOCAL_INVENTORY_MAX_ATTEMPTS):
        # Epoch first: the sources and folders below are read after it, so any
        # change to them lands in a later epoch and the post-scan check sees it.
        # A caller-supplied ``sources`` stays pinned - the /local route validated
        # its models_dir against exactly those roots.
        epoch = hf_cache_scan.hf_cache_scans_epoch()
        scan_sources = requested_sources or _compat_local_inventory_sources()
        try:
            custom_folders = await asyncio.to_thread(list_scan_folders)
        except Exception as e:
            logger.warning("Could not load custom scan folders: %s", e)
            custom_folders = []
        key: _CompatLocalInventoryKey = (
            Path(_compat_inventory_path_identity(models_root)),
            scan_sources,
            tuple(
                _compat_inventory_path_identity(folder.get("path", "")) for folder in custom_folders
            ),
            epoch,
        )
        try:
            return await hf_cache_scan.shared_scan(
                _compat_local_inventory_flights,
                key,
                lambda expected_epoch = epoch, folders = custom_folders, roots = scan_sources: (
                    collect(expected_epoch, folders, roots)
                ),
            )
        except _CompatLocalCacheChanged as changed:
            superseded = changed.models
            continue
    # Invalidations are outpacing the walk, so no scan will ever confirm as
    # current. Answer with the freshest one (the loop only reaches here through
    # the retry path, so there is always one) instead of rescanning forever.
    logger.warning("Compat local inventory kept racing cache invalidations; serving the last scan")
    return await asyncio.to_thread(classify, superseded)

@router.get("/local", response_model = LocalModelListResponse)
async def list_local_models(
    models_dir: str = Query(
        default = "./models", description = "Directory to scan for local model folders"
    ),
    current_subject: str = Depends(get_current_subject),
):
    """List local model candidates from the models dir, HF caches, and LM Studio dirs."""
    # Resolve all scan directories up front.
    sources = _compat_local_inventory_sources()
    hf_cache_dir = sources.hf_cache_dir
    legacy_hf = sources.legacy_hf
    hf_default = sources.hf_default
    lm_dirs = sources.lm_dirs

    # Validate models_dir against an allowlist of trusted dirs. Only the trusted Path objects
    # are used for FS access; the user string is for matching only, never path construction.
    allowed_roots: list[Path] = [Path("./models").resolve(), hf_cache_dir]
    if _safe_is_dir(legacy_hf):
        allowed_roots.append(legacy_hf)
    if _safe_is_dir(hf_default):
        allowed_roots.append(hf_default)
    try:
        from utils.paths import studio_root, outputs_root
        allowed_roots.extend([studio_root(), outputs_root()])
    except Exception:
        pass

    requested = os.path.realpath(os.path.expanduser(models_dir))
    models_root = None
    for root in allowed_roots:
        root_str = os.path.realpath(str(root))
        if requested == root_str or requested.startswith(root_str + os.sep):
            models_root = root  # trusted root, not the user-supplied path
            break
    if models_root is None:
        raise HTTPException(
            status_code = 403,
            detail = "Directory not allowed",
        )

    try:
        models = await _shared_compat_local_inventory_scan(models_root, sources)
        return LocalModelListResponse(
            models_dir = str(models_root),
            hf_cache_dir = str(hf_cache_dir),
            lmstudio_dirs = [str(d) for d in lm_dirs],
            models = models,
        )
    except Exception as e:
        raise log_and_http_error(
            e,
            500,
            "Failed to list local models",
            event = "models.list_local_models_failed",
            log = logger,
        )


@router.get("/scan-folders")
async def get_scan_folders(current_subject: str = Depends(get_current_subject)):
    """List all registered custom model scan folders."""
    from storage.studio_db import list_scan_folders

    folders = list_scan_folders()
    # Opening the dialog is how a fixed folder clears, so recheck the bad ones.
    await asyncio.to_thread(refresh_failed_scan_folders, folders)
    return {"folders": annotate_scan_folders(folders)}


@router.post("/scan-folders", response_model = ScanFolderInfo, status_code = 201)
async def add_scan_folder_endpoint(
    body: AddScanFolderRequest, current_subject: str = Depends(get_current_subject)
):
    """Register a new directory to scan for local models."""
    from storage.studio_db import add_scan_folder_with_status

    try:
        folder, inserted = await asyncio.to_thread(add_scan_folder_with_status, body.path)
    except ValueError as e:
        logger.warning("Scan folder rejected: %s (path=%s)", e, body.path)
        # Forward the curated, path-free validation message.
        rejection_message = str(e)
        raise HTTPException(status_code = 400, detail = rejection_message)
    logger.info("Scan folder added: %s", folder.get("path"))
    if inserted:
        from core.inference.local_model_resolver import invalidate_index, warm_index_soon
        await asyncio.to_thread(invalidate_index)
        warm_index_soon()
    return folder


@router.delete("/scan-folders/{folder_id}")
async def remove_scan_folder_endpoint(
    folder_id: int, current_subject: str = Depends(get_current_subject)
):
    """Remove a registered custom scan folder."""
    from storage.studio_db import remove_scan_folder

    removed = await asyncio.to_thread(remove_scan_folder, folder_id)
    if removed:
        logger.info("Scan folder removed: id=%s", folder_id)
        from core.inference.local_model_resolver import invalidate_index, warm_index_soon

        await asyncio.to_thread(invalidate_index)
        warm_index_soon()
    return {"ok": True}

@router.get("/recommended-folders")
async def get_recommended_folders(current_subject: str = Depends(get_current_subject)):
    """Return well-known model directories that hold a downloaded model.

    Lightweight alternative to ``browse-folders`` for the frontend's
    one-click "Recommended" chips. Only paths that actually contain
    weights are returned, so an empty LM Studio/Ollama scaffold no longer
    shows up as a suggestion.
    """
    from utils.paths.storage_roots import lmstudio_model_dirs

    folders: list[str] = []
    seen: set[str] = set()

    def _add(p: Optional[Path]) -> None:
        if p is None:
            return
        try:
            resolved = str(p.resolve())
        except OSError:
            return
        if resolved in seen:
            return
        if (
            _safe_is_dir(resolved)
            and os.access(resolved, os.R_OK | os.X_OK)
            and _dir_has_downloaded_model(Path(resolved))
        ):
            seen.add(resolved)
            folders.append(resolved)

    try:
        for p in lmstudio_model_dirs():
            _add(p)
    except Exception as e:
        logger.warning("Failed to scan for LM Studio model directories: %s", e)

    ollama_env = os.environ.get("OLLAMA_MODELS")
    if ollama_env:
        _add(Path(ollama_env).expanduser())
    for candidate in (
        Path.home() / ".ollama" / "models",
        Path("/usr/share/ollama/.ollama/models"),
        Path("/var/lib/ollama/.ollama/models"),
    ):
        _add(candidate)

    return {"folders": folders}

@router.get("/browse-folders", response_model = BrowseFoldersResponse)
def browse_folders(
    path: Optional[str] = Query(
        None,
        description = (
            "Directory to list. If omitted, defaults to the current user's "
            "home directory. Tilde (`~`) and relative paths are expanded. "
            "Must resolve inside the allowlist of browseable roots (HOME, "
            "HF cache, Unsloth dirs, registered scan folders, well-known "
            "model dirs)."
        ),
    ),
    show_hidden: bool = Query(
        False,
        description = "Include entries whose name starts with a dot",
    ),
    current_subject: str = Depends(get_current_subject),
):
    """List immediate subdirectories of *path* for the Custom Folders picker.

    Lets the frontend render a modal folder browser without a native OS
    dialog. Read-only: enumerates visible subdirectories so the user can
    click to a folder and hand the string to POST /api/models/scan-folders.

    Sandbox: bounded to :func:`_build_browse_allowlist`; paths outside it
    return 403, and symlinks are resolved via ``os.path.realpath`` first
    so traversal can't escape. Sorting: model-bearing dirs, then plain,
    then hidden (if ``show_hidden=true``).
    """
    from utils.paths import hf_default_cache_dir, well_known_model_dirs
    from utils.paths import external_media
    from storage.studio_db import (
        contains_sensitive_path_component,
        is_denied_system_path,
        list_scan_folders,
    )

    # Probe removable-media and Windows drive roots once; allowlist and chips reuse the result.
    media_roots = [
        *external_media.linux_run_media_mount_roots(),
        *external_media.macos_volume_roots(),
    ]
    drive_roots = external_media.windows_drive_roots()
    # Build once; the sandbox check and suggestion chips share it.
    allowed_roots = _build_browse_allowlist(media_roots, drive_roots)

    try:
        target = _resolve_browse_target(path, allowed_roots)
    except HTTPException:
        requested_path = _normalize_browse_request_path(path)
        if path is not None and path.strip():
            logger.warning(
                "browse-folders: rejected path %r (normalized=%s)",
                path,
                requested_path,
            )
        raise

    entries: list[BrowseEntry] = []
    truncated = False
    visited = 0
    try:
        it = target.iterdir()
    except PermissionError:
        raise HTTPException(
            status_code = 403,
            detail = f"Permission denied reading {os.path.basename(str(target))}",
        )
    except OSError as exc:
        logger.warning("browse-folders: could not read %s: %s", target, exc, exc_info = True)
        raise HTTPException(
            status_code = 500,
            detail = f"Could not read {os.path.basename(str(target))}",
        )

    try:
        for child in it:
            # Bound by *visited*, not *appended*: a cap on len(entries) would never trigger in dirs
            # full of files. Counting visits caps worst-case work at ``_BROWSE_ENTRY_CAP``.
            visited += 1
            if visited > _BROWSE_ENTRY_CAP:
                truncated = True
                break
            try:
                if not child.is_dir():
                    continue
            except OSError:
                continue
            name = child.name
            is_hidden = name.startswith(".")
            if is_hidden and not show_hidden:
                continue
            if contains_sensitive_path_component(name):
                continue
            # Hide denied system dirs (C:\Windows, /etc, ...) so they don't render as rows that then
            # 403 on descent. Resolve first so a symlink into a denied dir is hidden too.
            try:
                resolved_child = os.path.realpath(str(child))
            except (OSError, ValueError):
                resolved_child = str(child)
            if is_denied_system_path(resolved_child):
                continue
            entries.append(
                BrowseEntry(
                    name = name,
                    has_models = _looks_like_model_dir(child),
                    hidden = is_hidden,
                )
            )
    except PermissionError as exc:
        logger.debug(
            "browse-folders: permission denied during enumeration of %s: %s",
            target,
            exc,
        )
    except OSError as exc:
        # Rare: iterdir succeeded but reading an entry failed.
        logger.warning("browse-folders: partial enumeration of %s: %s", target, exc)

    # Model-bearing first, then plain, then hidden; case-insensitive within each bucket.
    def _sort_key(e: BrowseEntry) -> tuple[int, str]:
        bucket = 0 if e.has_models else (2 if e.hidden else 1)
        return (bucket, e.name.lower())

    entries.sort(key = _sort_key)

    # Parent is None at the filesystem root and when it would leave the sandbox (else the
    # up-row would 403); users can still hop to other allowed roots via the chips.
    parent: Optional[str]
    if target.parent == target or not _is_path_inside_allowlist(target.parent, allowed_roots):
        parent = None
    else:
        parent = str(target.parent)

    # Handy starting points for the quick-pick chips.
    suggestions: list[str] = []
    seen_sug: set[str] = set()

    def _add_sug(p: Optional[Path]) -> None:
        if p is None:
            return
        try:
            resolved = str(p.resolve())
        except OSError:
            return
        if resolved in seen_sug:
            return
        # Drop a denied system dir (e.g. a stale scan-folder row) so it never becomes a chip that
        # 403s on click. Drive roots stay: only their system subdirectories are denied.
        if is_denied_system_path(resolved):
            return
        if _safe_is_dir(resolved):
            seen_sug.add(resolved)
            suggestions.append(resolved)

    # Home first -- the safe fallback when everything else is cold.
    _add_sug(Path.home())
    # Reuse the roots probed for the allowlist above (no second drive scan).
    for p in media_roots:
        _add_sug(p)
    # Windows drive roots so the user can hop between C:, D:, E: ...
    for p in drive_roots:
        _add_sug(p)
    # The HF cache root the process is actually using.
    try:
        _add_sug(hf_default_cache_dir())
    except Exception:
        pass
    # Already-registered scan folders (user-curated).
    try:
        for folder in list_scan_folders():
            _add_sug(Path(folder.get("path", "")))
    except Exception as exc:
        logger.debug("browse-folders: could not load scan folders: %s", exc)
    # Dirs used by other local-LLM tools (LM Studio, Ollama, ~/models); existing paths only.
    try:
        for p in well_known_model_dirs():
            _add_sug(p)
    except Exception as exc:
        logger.debug("browse-folders: could not load well-known dirs: %s", exc)

    return BrowseFoldersResponse(
        current = str(target),
        parent = parent,
        entries = entries,
        suggestions = suggestions,
        truncated = truncated,
        model_files_here = _count_model_files(target),
    )
