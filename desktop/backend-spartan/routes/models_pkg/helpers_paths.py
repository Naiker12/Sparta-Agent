"""Path resolution, allowlisting and filesystem helpers for model management."""

import hashlib
import os
import re as _re
import shutil
import sys
from pathlib import Path
from typing import List, Optional

from fastapi import HTTPException
from loggers import get_logger
from utils.utils import log_and_http_error
from utils.paths import (
    outputs_root,
    exports_root,
    resolve_cached_repo_id_case,
    resolve_output_dir,
    resolve_export_dir,
    is_local_path,
    normalize_path,
)
from utils.hidden_models import (
    _HF_REPO_ID_RE,
    _existing_resolved_path,
    _safe_resolve,
    is_hidden_model as _is_hidden_model,
)
from routes.models_pkg.helpers_detection import (
    _VALID_REPO_ID,
    _is_valid_repo_id,
    _is_main_gguf_filename,
    _is_weight_bin,
    _main_variant_rank,
    _repo_gguf_size_bytes,
)

logger = get_logger(__name__)


def _normalize_hf_token(hf_token) -> Optional[str]:
    if not isinstance(hf_token, str):
        return None
    token = hf_token.strip()
    return token or None


def _safe_is_dir(path) -> bool:
    """``Path.is_dir()`` returning ``False`` instead of raising.

    Python >= 3.12 propagates ``PermissionError`` from ``is_dir()``;
    folder-scan endpoints probe system locations (e.g. root-owned
    ``/usr/share/ollama``) and must treat un-stat-able paths as "not a
    directory", never 500.
    """
    try:
        return Path(path).is_dir()
    except OSError:
        return False


def hidden_model_matchers() -> tuple[list[str], list[str], list[str]]:
    """Substring needles, exact repo ids, and exact resolved paths identifying
    infra models (the RAG embedder and the llama.cpp install validation probe)
    that pickers hide. Served by the ``/api/hub/hidden-models`` endpoint. A
    configured HF-repo embedder is published as its exact lowercased repo id
    (mirroring ``utils.hidden_models.is_hidden_model``) and a local-path
    embedder as its exact resolved path only: a generic basename like "model"
    must not substring-hide unrelated chat models."""
    from core.rag import config as rag_config

    needles = [
        # Validation probe repo + exact filename; .gguf so it won't hide unrelated *-GGUF repos.
        "ggml-org/models",
        "stories260k.gguf",
    ]
    exact_ids: list[str] = []
    exact_paths: list[str] = []
    for model in (
        rag_config.effective_embedding_model(),
        rag_config.effective_gguf_repo(),
    ):
        # Resolve a local path before the repo-id regex: "models/embedder" is a path, not a repo id.
        existing_path = _existing_resolved_path(model)
        if existing_path:
            exact_paths.append(existing_path.lower())
        elif _HF_REPO_ID_RE.match(model):
            exact_ids.append(model.lower())
        else:
            resolved = _safe_resolve(Path(model).expanduser())
            if resolved:
                exact_paths.append(resolved.lower())
    return needles, exact_ids, exact_paths


def _resolve_hf_cache_dir() -> Path:
    """Resolve local HF cache root used by hub downloads."""
    from utils.hf_cache_settings import get_hf_cache_paths
    return get_hf_cache_paths().hub_cache


def _is_model_directory(d: Path) -> bool:
    """Return ``True`` when *d* looks like a model directory.

    Requires both a config (``config.json``/``adapter_config.json``) and
    weight files. Excludes ``mmproj`` GGUFs (vision projectors) and
    non-weight ``.bin`` files (``tokenizer.bin`` etc.) to avoid false
    positives.
    """

    def _is_weight_file(f: Path) -> bool:
        suffix = f.suffix.lower()
        if suffix == ".safetensors":
            return True
        if suffix == ".gguf":
            return "mmproj" not in f.name.lower()
        if suffix == ".bin":
            name = f.name.lower()
            return (
                name.startswith("pytorch_model")
                or name.startswith("model")
                or name.startswith("adapter_model")
                or name.startswith("consolidated")
            )
        return False

    try:
        has_config = (d / "config.json").exists() or (d / "adapter_config.json").exists()
        if not has_config:
            return False
        return any(_is_weight_file(f) for f in d.iterdir() if f.is_file())
    except OSError:
        return False

def _dir_has_downloaded_model(directory: Path, max_entries: int = 4000) -> bool:
    """True if *directory* actually holds a downloaded model.

    Recommended-folder chips should only appear once the well-known dir
    has real weights, not just an empty LM Studio/Ollama scaffold. Two
    layouts: a GGUF/safetensors/PyTorch-bin weight file anywhere in the
    tree (LM Studio, plain dirs) or the Ollama content-addressable store
    (a non-empty ``manifests/`` beside ``blobs/``, whose blobs carry no
    extension). Weight detection mirrors the local scanner so a folder the
    chip leads to is one the scanner would actually surface a model from.
    Bounded by *max_entries* so a huge tree can't stall the request.
    """
    # Ollama layout: each manifest is JSON referencing content-addressable blobs. A manifest
    # alone is not enough -- a failed or pruned pull leaves it behind with the model blob
    # missing, so resolve the ``application/vnd.ollama.image.model`` layer to an on-disk blob
    # before counting it (mirrors _scan_ollama_dir), else the chip leads to an empty picker.
    visited = 0
    manifests = directory / "manifests"
    blobs = directory / "blobs"
    try:
        if _safe_is_dir(manifests) and _safe_is_dir(blobs):
            for m in manifests.rglob("*"):
                visited += 1
                if visited > max_entries:
                    break
                if not m.is_file():
                    continue
                try:
                    manifest = json.loads(m.read_text(encoding = "utf-8-sig"))
                except (json.JSONDecodeError, OSError, ValueError):
                    continue
                for layer in manifest.get("layers") or []:
                    if layer.get("mediaType") != "application/vnd.ollama.image.model":
                        continue
                    digest = layer.get("digest", "")
                    if digest and (blobs / digest.replace(":", "-")).is_file():
                        return True
    except OSError:
        pass
    # Generic weights: any GGUF/safetensors in a bounded BFS that skips hidden directories.
    # ``rglob`` walks in arbitrary order and counts every entry, so a large hidden subtree
    # could exhaust the budget before reaching real weights and falsely report "no model".
    queue = [directory]
    visited = 0
    while queue:
        current = queue.pop(0)
        try:
            entries = list(current.iterdir())
        except OSError:
            continue
        for entry in entries:
            visited += 1
            if visited > max_entries:
                return False
            try:
                if entry.is_dir():
                    if not entry.name.startswith("."):
                        queue.append(entry)
                else:
                    low = entry.name.lower()
                    if low.endswith((".gguf", ".safetensors")):
                        return True
                    # PyTorch checkpoints; gate by name so tokenizer.bin and friends don't count as weights.
                    if _is_weight_bin(entry.name):
                        return True
            except OSError:
                continue
    return False

_BROWSE_MODEL_HINT_PROBE = 64
# Hard cap on subdirectory entries so browsing ``/usr/lib`` can't stat-storm the process.
_BROWSE_ENTRY_CAP = 2000


def _count_model_files(directory: Path, cap: int = 200) -> int:
    """Count GGUF/safetensors files immediately inside *directory*.

    Surfaces a count-hint so the UI can mark a weights-only leaf dir as a
    valid "Use this folder" target. Bounded by *visited entries* (stops
    after ``cap``), so the hint never costs more than a bounded walk.
    """
    n = 0
    visited = 0
    try:
        for f in directory.iterdir():
            visited += 1
            if visited > cap:
                break
            try:
                if f.is_file():
                    low = f.name.lower()
                    if low.endswith((".gguf", ".safetensors")):
                        n += 1
            except OSError:
                continue
    except PermissionError as e:
        logger.debug("browse-folders: permission denied counting %s: %s", directory, e)
        return 0
    except OSError as e:
        logger.debug("browse-folders: OS error counting %s: %s", directory, e)
        return 0
    return n


def _has_direct_model_signal(directory: Path) -> bool:
    """Return True if an immediate child signals a model: a
    GGUF/safetensors/config.json file or a ``models--*`` subdir (HF
    cache). Bounded by ``_BROWSE_MODEL_HINT_PROBE``."""
    try:
        it = directory.iterdir()
    except OSError:
        return False
    try:
        for i, child in enumerate(it):
            if i >= _BROWSE_MODEL_HINT_PROBE:
                break
            try:
                name = child.name
                if child.is_file():
                    low = name.lower()
                    if low.endswith((".gguf", ".safetensors")):
                        return True
                    if low in ("config.json", "adapter_config.json"):
                        return True
                elif child.is_dir() and name.startswith("models--"):
                    return True
            except OSError:
                continue
    except OSError:
        return False
    return False


def _looks_like_model_dir(directory: Path) -> bool:
    """Bounded heuristic to flag dirs worth exploring in the browser.

    False negatives are fine (the real scanner is authoritative). Three
    signals, cheapest first: (1) name ``models--*`` (HF cache layout),
    (2) an immediate child weight/config file, (3) a grandchild with a
    direct signal (LM Studio / Ollama ``publisher/model`` layout, probing
    the first ``_BROWSE_MODEL_HINT_PROBE`` child dirs).
    """
    if directory.name.startswith("models--"):
        return True
    if _has_direct_model_signal(directory):
        return True
    # Grandchild probe: LM Studio / Ollama publisher/model layout.
    try:
        it = directory.iterdir()
    except OSError:
        return False
    try:
        for i, child in enumerate(it):
            if i >= _BROWSE_MODEL_HINT_PROBE:
                break
            try:
                if not child.is_dir():
                    continue
            except OSError:
                continue
            if child.name.startswith("models--"):
                return True
            if _has_direct_model_signal(child):
                return True
    except OSError:
        return False
    return False


def _build_browse_allowlist(
    media_roots: Optional[list[Path]] = None, drive_roots: Optional[list[Path]] = None
) -> list[Path]:
    """Return the root directories the folder browser may walk.

    The same list seeds the sidebar suggestion chips, so chip targets are
    always reachable. Roots: HOME, resolved HF cache dirs, Unsloth's
    outputs/exports/studio root, registered scan folders, and well-known
    local-LLM dirs (LM Studio, Ollama, ``~/models``); each added only if
    it resolves to a real directory.

    *media_roots* / *drive_roots* let the caller pass already-probed
    removable-media and Windows drive roots so they aren't scanned again (a
    disconnected mapped drive can make each probe slow); probed here when ``None``.
    """
    from utils.paths import (
        hf_default_cache_dir,
        legacy_hf_cache_dir,
        well_known_model_dirs,
    )
    from utils.paths import external_media
    from storage.studio_db import list_scan_folders

    candidates: list[Path] = []

    def _add(p: Optional[Path]) -> None:
        if p is None:
            return
        try:
            resolved = p.resolve()
        except OSError:
            return
        if _safe_is_dir(resolved):
            candidates.append(resolved)

    _add(Path.home())
    if media_roots is None:
        media_roots = [
            *external_media.linux_run_media_mount_roots(),
            *external_media.macos_volume_roots(),
        ]
    if drive_roots is None:
        drive_roots = external_media.windows_drive_roots()
    for p in media_roots:
        _add(p)
    for p in drive_roots:
        _add(p)
    _add(_resolve_hf_cache_dir())
    try:
        _add(hf_default_cache_dir())
    except Exception:  # noqa: BLE001 -- best-effort
        pass
    try:
        _add(legacy_hf_cache_dir())
    except Exception:  # noqa: BLE001 -- best-effort
        pass
    try:
        from utils.paths import (
            exports_root,
            outputs_root,
            studio_root,
        )

        _add(studio_root())
        _add(outputs_root())
        _add(exports_root())
    except Exception as exc:  # noqa: BLE001 -- best-effort
        logger.debug("browse-folders: studio roots unavailable: %s", exc)
    try:
        for folder in list_scan_folders():
            p = folder.get("path")
            if p:
                _add(Path(p))
    except Exception as exc:  # noqa: BLE001 -- best-effort
        logger.debug("browse-folders: could not load scan folders: %s", exc)
    try:
        for p in well_known_model_dirs():
            _add(p)
    except Exception as exc:  # noqa: BLE001 -- best-effort
        logger.debug("browse-folders: well-known dirs unavailable: %s", exc)

    # Dedupe while preserving order.
    seen: set[str] = set()
    deduped: list[Path] = []
    for p in candidates:
        key = str(p)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(p)
    return deduped


def _is_path_inside_allowlist(target: Path, allowed_roots: list[Path]) -> bool:
    """True if *target* equals or descends from any allowed root.

    Uses ``os.path.realpath`` (symlinks can't escape the sandbox) and
    ``os.path.commonpath`` for a component-wise containment test, so a string
    prefix like ``/home/u`` never matches a sibling ``/home/user2`` while a
    drive root ``D:\\`` still contains ``D:\\models``. A Windows drive root
    authorizes its descendants, but a bare POSIX root ``/`` must NOT, else one
    ``/`` allowlist entry would authorize every absolute path. ``normcase`` keeps
    the drive-letter comparison case-insensitive, matching the hub browser.
    """
    try:
        target_real = os.path.normcase(os.path.realpath(str(target)))
    except OSError:
        return False
    for root in allowed_roots:
        try:
            root_real = os.path.normcase(os.path.realpath(str(root)))
        except OSError:
            continue
        if target_real == root_real:
            return True
        drive, tail = os.path.splitdrive(root_real)
        if os.path.dirname(root_real) == root_real and not drive:
            # Bare POSIX root ("/"): equality above is the only match; don't authorize descendants.
            continue
        if drive.startswith(("\\\\", "//")) and not tail:
            # Bare UNC share root (\\server\share): os.path.commonpath raises on it, so authorize
            # descendants with a boundary-safe prefix test (normcase applied).
            if target_real.startswith(root_real.rstrip("\\/") + os.sep):
                return True
            continue
        try:
            if os.path.commonpath([target_real, root_real]) == root_real:
                return True
        except ValueError:
            # Different drives / mixed absolute-relative: not contained.
            continue
    return False


def _normalize_browse_request_path(path: Optional[str]) -> str:
    """Normalize the browse request path lexically, without touching the FS."""
    if path is None or not path.strip():
        return os.path.normpath(str(Path.home()))

    expanded = os.path.expanduser(path.strip())
    if not os.path.isabs(expanded):
        expanded = os.path.join(str(Path.cwd()), expanded)
    return os.path.normpath(expanded)


def _browse_relative_parts(requested_path: str, root: Path) -> Optional[list[str]]:
    """Return validated relative path components under ``root``."""
    root_text = os.path.normpath(str(root))
    try:
        rel_text = os.path.relpath(requested_path, root_text)
    except ValueError:
        return None

    if rel_text == ".":
        return []
    if rel_text == ".." or rel_text.startswith(f"..{os.sep}"):
        return None

    parts = [part for part in rel_text.split(os.sep) if part not in ("", ".")]
    altsep = os.altsep
    for part in parts:
        if part == ".." or os.sep in part or (altsep and altsep in part):
            return None
    return parts


def _match_browse_child(current: Path, name: str) -> Optional[Path]:
    """Return the immediate child named ``name`` under ``current``."""
    try:
        for child in current.iterdir():
            if child.name == name:
                return child
    except PermissionError:
        raise HTTPException(
            status_code = 403,
            detail = f"Permission denied reading {current.name}",
        ) from None
    except OSError as exc:
        logger.warning("browse-folders: could not read %s: %s", current, exc, exc_info = True)
        raise HTTPException(
            status_code = 500,
            detail = f"Could not read {os.path.basename(str(current))}",
        ) from exc
    return None


def _resolve_browse_target(path: Optional[str], allowed_roots: list[Path]) -> Path:
    """Resolve a requested browse path by walking from trusted allowlist roots."""
    from storage.studio_db import (
        contains_sensitive_path_component,
        is_denied_system_path,
    )

    requested_path = _normalize_browse_request_path(path)
    resolved_roots: list[Path] = []
    seen_roots: set[str] = set()
    for root in sorted(allowed_roots, key = lambda p: len(str(p)), reverse = True):
        try:
            resolved = root.resolve()
        except OSError:
            continue
        key = str(resolved)
        if key in seen_roots:
            continue
        seen_roots.add(key)
        resolved_roots.append(resolved)

    for root in resolved_roots:
        parts = _browse_relative_parts(requested_path, root)
        if parts is None:
            continue

        current = root
        for part in parts:
            child = _match_browse_child(current, part)
            if child is None:
                raise HTTPException(
                    status_code = 404,
                    detail = f"Path does not exist: {os.path.basename(requested_path)}",
                )
            try:
                resolved_child = child.resolve()
            except OSError as exc:
                logger.warning(
                    "browse-folders: invalid path component %r under %s: %s",
                    part,
                    current,
                    exc,
                    exc_info = True,
                )
                raise HTTPException(
                    status_code = 400,
                    detail = "Invalid path",
                ) from exc
            if not _is_path_inside_allowlist(resolved_child, resolved_roots):
                raise HTTPException(
                    status_code = 403,
                    detail = (
                        "Path is not in the browseable allowlist. Register it via "
                        "POST /api/models/scan-folders first, or pick a directory "
                        "under your home folder."
                    ),
                )
            if contains_sensitive_path_component(str(resolved_child)):
                raise HTTPException(
                    status_code = 403,
                    detail = "Credential or configuration directories are not browseable.",
                )
            if is_denied_system_path(str(resolved_child)):
                raise HTTPException(
                    status_code = 403,
                    detail = "System directories are not browseable.",
                )
            current = resolved_child

        if contains_sensitive_path_component(str(current)):
            raise HTTPException(
                status_code = 403,
                detail = "Credential or configuration directories are not browseable.",
            )
        # Zero-component case: the requested path IS an allowlist root (legacy "/" or a drive root).
        if is_denied_system_path(str(current)):
            raise HTTPException(
                status_code = 403,
                detail = "System directories are not browseable.",
            )
        if not current.is_dir():
            raise HTTPException(
                status_code = 400,
                detail = f"Not a directory: {os.path.basename(str(current))}",
            )
        return current

    raise HTTPException(
        status_code = 403,
        detail = (
            "Path is not in the browseable allowlist. Register it via "
            "POST /api/models/scan-folders first, or pick a directory "
            "under your home folder."
        ),
    )

def _is_path_under(path: Path, root: Path) -> bool:
    try:
        path.resolve().relative_to(root.resolve())
        return True
    except ValueError:
        return False


def _is_path_under_lexically(path: Path, root: Path) -> bool:
    """Check containment without resolving the final path's symlink."""
    try:
        absolute_path = Path(os.path.abspath(str(path)))
        absolute_root = Path(os.path.abspath(str(root)))
        absolute_path.relative_to(absolute_root)
        return True
    except ValueError:
        return False


def _loaded_model_matches_deleted_path(active_model: str, deleted_path: Path) -> bool:
    try:
        active = Path(active_model).expanduser().resolve()
        target = deleted_path.resolve()
        return active == target or (target.is_dir() and active.is_relative_to(target))
    except (OSError, RuntimeError, ValueError) as e:
        logger.debug(
            "Could not resolve loaded/deleted model paths; falling back to string comparison: %s",
            e,
        )
        active_lower = active_model.lower()
        target_lower = str(deleted_path).lower()
        return active_lower == target_lower or active_lower.startswith(f"{target_lower}{os.sep}")


def _loading_model_matches_deleted_path(loading_model: object, deleted_path: Path) -> bool:
    if not loading_model:
        return False
    return _loaded_model_matches_deleted_path(str(loading_model), deleted_path)


def _active_diffusion_backend():
    """The live Images engine, or None when this install has no diffusion stack.

    Fails OPEN on import: a chat-only install (no diffusers) must still be able to delete
    its fine-tuned models. Reading the returned backend's state is what fails closed.
    """
    try:
        from core.inference.diffusion_engine_router import get_active_diffusion_engine
        return get_active_diffusion_engine()
    except Exception as e:
        logger.debug(f"Images engine unavailable during delete guard: {e}")
        return None


def _active_video_backend():
    """The live Video backend, or None when this install has no video stack."""
    try:
        from core.inference.video import get_video_backend
        return get_video_backend()
    except Exception as e:
        logger.debug(f"Video backend unavailable during delete guard: {e}")
        return None


def _prune_empty_parents(start: Path, stop_at: Path) -> None:
    """Remove empty ancestors of ``start`` up to (not including) ``stop_at``.

    Used after deleting a checkpoint so the enclosing run dir doesn't
    linger as an empty entry in scan results.
    """
    try:
        stop_resolved = stop_at.resolve()
    except OSError:
        return
    parent = start.parent
    while True:
        try:
            parent_resolved = parent.resolve()
        except OSError:
            return
        if parent_resolved == stop_resolved:
            return
        try:
            parent_resolved.relative_to(stop_resolved)
        except ValueError:
            return
        try:
            parent.rmdir()
        except OSError:
            return
        parent = parent.parent


def _variant_names_same_checkpoint(a: Optional[str], b: Optional[str]) -> bool:
    """Whether two variant spellings can name the SAME checkpoint, for the load-state guard.

    Deletion accepts an unambiguous bare quant for a path-qualified key (the shared-container
    layout, ``weights/model-Q4_K_M.gguf``), so a guard comparing the two spellings literally lets
    a model loaded through a legacy bare pin be deleted through its advertised qualified row --
    unlinking the resident model's snapshot and blob. Deliberately loose: a false match only
    refuses a delete, a false miss loses weights.
    """
    from hub.utils.gguf import bare_quant_alias, is_qualified_gguf_variant_key

    left = (a or "").strip().lower()
    right = (b or "").strip().lower()
    if not left or not right:
        return False
    if left == right:
        return True
    for key, bare in ((left, right), (right, left)):
        if (
            is_qualified_gguf_variant_key(key)
            and not is_qualified_gguf_variant_key(bare)
            and bare_quant_alias(key).lower() == bare
        ):
            return True
    return False


def _delete_gguf_variant_files(root: Path, variant: str) -> tuple[int, int]:
    deleted_count = 0
    deleted_bytes = 0
    for path in root.rglob("*"):
        if not path.is_file() or not _is_main_gguf_filename(path.name):
            continue
        # Keyed on the path, not the basename: a repo holding several checkpoints at
        # one quant would otherwise delete every one of them for a single row.
        from utils.models.model_config import _gguf_variant_key

        try:
            relative = path.relative_to(root).as_posix()
        except ValueError:
            relative = path.name
        if _gguf_variant_key(relative).lower() != variant.lower():
            continue
        try:
            deleted_bytes += path.stat().st_size
        except OSError:
            pass
        path.unlink()
        deleted_count += 1
    return deleted_count, deleted_bytes

def _resolve_hf_cache_realpath(repo_dir: Path) -> Optional[str]:
    """Most useful on-disk path for a HF cache repo.

    Delegates to the Hub scanner's function of the same name so this route and
    ``/api/hub/local-models`` name one directory: the newest snapshot dir, ties broken by
    ``snapshot_selection_key``.
    """
    from hub.utils import inventory_scan as hf_cache_scan
    return hf_cache_scan.resolve_hf_cache_realpath(repo_dir)

def _repo_in_any_hf_cache(model_name: str) -> bool:
    """Whether ``model_name`` already exists in ANY HF cache the discard searches
    (active, legacy, default).

    ``created_by_scan`` must be True only when the scan itself first pulled the repo;
    checking just the active cache (``get_cache_path``) would mark a repo the user
    already had in a legacy/default cache as scan-created, so declining the consent
    would delete a model they did not download via the scan. Mirrors the cache set in
    ``_all_hf_cache_scans`` but only probes for the one repo dir (cheap, no full scan).
    """
    from utils.paths import resolve_cached_repo_id_case

    dirname = f"models--{resolve_cached_repo_id_case(model_name).replace('/', '--')}"
    dirname_lower = dirname.lower()
    from hub.utils.hf_cache_state import hf_cache_roots

    candidates = hf_cache_roots()
    # resolve_cached_repo_id_case only normalizes the ACTIVE cache, but discard deletes
    # case-insensitively across all caches, else a pre-existing case-variant is deleted on decline.
    for cache in candidates:
        try:
            if (cache / dirname).exists():
                return True
            if cache.is_dir():
                for entry in cache.iterdir():
                    if entry.name.lower() == dirname_lower and entry.is_dir():
                        return True
        except Exception:
            continue
    return False


def _all_hf_cache_scans():
    """scan_cache_dir for the active, legacy, and default HF caches.

    Each probe is isolated: an unreadable auxiliary cache (permission denied,
    broken symlink, OS-redirected ~/.cache) is skipped, not fatal, so the
    Downloaded list never blanks out and downloads never leak into Recommended.
    """
    from hub.utils.inventory_scan import all_hf_cache_scans
    return all_hf_cache_scans()

def _loaded_id_matches_repo(loaded_id: str, repo_id: str) -> bool:
    """True when *loaded_id* is *repo_id* or a file within it; ``/``-boundary aware so a
    loaded ``org/model-2512`` does not block deleting the sibling cached ``org/model``."""
    rid = repo_id.lower()
    lid = loaded_id.lower()
    return lid == rid or lid.startswith(f"{rid}/")

def _resolve_cached_model_path(repo_id: str, variant: Optional[str]) -> Path:
    """Absolute path of a cached repo (newest snapshot dir) or, with *variant*,
    that quant's main GGUF file (first split of a sharded quant). Paths come
    from the HF cache scan only, so callers can't probe arbitrary paths."""
    cache_scans = _all_hf_cache_scans()

    matching_repos = []
    for hf_cache in cache_scans:
        for repo_info in hf_cache.repos:
            if repo_info.repo_type != "model":
                continue
            if repo_info.repo_id.lower() == repo_id.lower():
                matching_repos.append(repo_info)
    if not matching_repos:
        raise HTTPException(status_code = 404, detail = "Model not found in cache")

    if variant:
        want = (variant or "").strip()
        candidate_revisions = sorted(
            (rev for repo_info in matching_repos for rev in repo_info.revisions),
            key = lambda rev: getattr(rev, "last_modified", 0) or 0,
            reverse = True,
        )
        for rev in candidate_revisions:
            snapshot = getattr(rev, "snapshot_path", None)
            ranked: dict[int, list[tuple[str, Path]]] = {0: [], 1: []}
            for f in rev.files:
                p = Path(f.file_path)
                rel = f.file_name
                if snapshot:
                    try:
                        rel = p.relative_to(snapshot).as_posix()
                    except ValueError:
                        pass
                rank = _main_variant_rank(rel, want)
                if rank is None:
                    continue
                if p.exists() or p.is_symlink():
                    ranked[rank].append((rel, p))
            # Exact keys alone when any exist, else the legacy label spelling.
            matches = ranked[0] or ranked[1]
            if matches:
                # Path-sorted so a sharded quant deterministically yields its first split.
                return sorted(matches, key = lambda m: m[0].lower())[0][1]
        raise HTTPException(
            status_code = 404,
            detail = f"Variant {variant} not found in cache for {repo_id}",
        )

    def repo_size(repo_info) -> int:
        gguf_size = _repo_gguf_size_bytes(repo_info)
        if gguf_size > 0:
            return gguf_size
        return sum(
            (getattr(f, "size_on_disk", None) or 0)
            for rev in repo_info.revisions
            for f in rev.files
        )

    def repo_last_modified(repo_info) -> float:
        return max(
            (getattr(rev, "last_modified", 0) or 0 for rev in repo_info.revisions),
            default = 0,
        )

    target_repo = max(
        matching_repos,
        key = lambda repo_info: (repo_size(repo_info), repo_last_modified(repo_info)),
    )

    # Whole repo: the newest revision's snapshot dir holds the visible files.
    revisions = sorted(
        (rev for rev in target_repo.revisions if getattr(rev, "snapshot_path", None)),
        key = lambda rev: getattr(rev, "last_modified", 0) or 0,
        reverse = True,
    )
    for rev in revisions:
        p = Path(rev.snapshot_path)
        if p.exists():
            return p
    p = Path(target_repo.repo_path)
    if p.exists():
        return p
    raise HTTPException(status_code = 404, detail = "Cached model path not found")

_EXPORT_SIZE_CACHE: dict[str, tuple[int, int, str]] = {}


def _is_sizable_local_path(model: str) -> bool:
    """True only for local paths under an Unsloth data root.

    Containment is decided lexically (no filesystem access) before the path is
    touched, then the path is symlink-resolved and re-checked so a symlink
    inside a root can't point the sizer outside it. A user-controlled path thus
    can't trigger a scan of an arbitrary dir.
    """
    from utils.paths import outputs_root, exports_root, studio_root
    from utils.paths.storage_roots import cache_root

    def _lexical(p: str) -> str:
        # Lexical only (no filesystem read); normpath collapses '..'.
        return os.path.normpath(os.path.abspath(os.path.expanduser(p)))

    raw_roots = [studio_root(), outputs_root(), exports_root(), cache_root()]
    roots = []
    for root in raw_roots:
        try:
            roots.append(_lexical(str(root)))
        except (OSError, RuntimeError, ValueError):
            continue

    try:
        candidate = _lexical(model)
    except (OSError, RuntimeError, ValueError):
        return False
    for root in roots:
        if candidate == root or candidate.startswith(root + os.sep):
            # Contained lexically; resolve symlinks and re-verify before touching the filesystem.
            try:
                real = os.path.realpath(candidate)
            except (OSError, RuntimeError, ValueError):
                return False
            for raw in raw_roots:
                try:
                    real_root = os.path.realpath(str(raw))
                except (OSError, RuntimeError, ValueError):
                    continue
                if real == real_root or real.startswith(real_root + os.sep):
                    return os.path.exists(real)
            return False
    return False


def _export_size_cached(
    model: str, hf_token: Optional[str]
) -> tuple[Optional[int], Optional[int], str]:
    """Estimate a model's fp16/bf16-equivalent size in bytes (+ total params).

    Memoizes successful results by model id; never raises (failures return
    (None, None, "unavailable") and are not cached). Blocking I/O; call off-thread.
    """
    cached = _EXPORT_SIZE_CACHE.get(model)
    if cached is not None:
        return cached
    try:
        from utils.hardware.hardware import (
            _resolve_model_identifier_for_gpu_estimate,
            estimate_fp16_model_size_bytes,
        )

        # A local LoRA adapter is sized via its base model from the adapter config; re-validate that
        # resolved base so a crafted adapter can't redirect the local scan outside the roots.
        if is_local_path(model):
            base = _resolve_model_identifier_for_gpu_estimate(model, hf_token = hf_token)
            if is_local_path(base) and not _is_sizable_local_path(base):
                return None, None, "unavailable"

        fp16_bytes, source = estimate_fp16_model_size_bytes(model, hf_token = hf_token)
        if not fp16_bytes or fp16_bytes <= 0:
            return None, None, source or "unavailable"
        result = (int(fp16_bytes), int(fp16_bytes) // 2, source)
        _EXPORT_SIZE_CACHE[model] = result
        return result
    except Exception as e:  # a size hint must never break export
        logger.warning("Could not estimate export size for '%s': %s", model, e)
        return None, None, "unavailable"
