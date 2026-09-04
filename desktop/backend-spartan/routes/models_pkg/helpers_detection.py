"""Architecture detection, context length, GGUF/Diffusers classification and config extraction."""

import asyncio
import hashlib
import json
import os
import re as _re
import sys
import threading
import time
import weakref
from pathlib import Path
from typing import List, NamedTuple, Optional
from fastapi import HTTPException
from loggers import get_logger

from models.models import ModelType
from routes.models_pkg.schemas import CachedModelRepo
from utils.paths import is_local_path
from utils.utils import canonical_model_repo_id
from utils.models.model_config import (
    _extract_quant_label,
    _is_big_endian_gguf_path,
    _is_mtp_drafter,
    is_audio_input_type,
)

logger = get_logger(__name__)

_VALID_REPO_ID = _re.compile(r"^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$")


def _is_valid_repo_id(repo_id: str) -> bool:
    return bool(_VALID_REPO_ID.fullmatch(repo_id))


def derive_model_type(
    is_vision: bool,
    audio_type: Optional[str],
    is_embedding: bool = False,
) -> ModelType:
    """Collapse individual capability flags into a single model modality string."""
    if is_embedding:
        return "embeddings"
    if audio_type is not None:
        return "audio"
    if is_vision:
        return "vision"
    return "text"

_WEIGHT_BIN_PREFIXES = ("pytorch_model", "model", "adapter_model", "consolidated")


def _is_weight_bin(name: str) -> bool:
    low = name.lower()
    return low.endswith(".bin") and low.startswith(_WEIGHT_BIN_PREFIXES)


def _has_non_gguf_weights(path: Path) -> bool:
    """True if *path* holds non-GGUF weight files (``.safetensors`` or a weight
    ``.bin``), ignoring companion ``.bin`` files such as ``tokenizer.bin`` so a
    GGUF-only folder is not misread as a plain checkpoint."""
    try:
        if any(path.glob("*.safetensors")):
            return True
        return any(_is_weight_bin(f.name) for f in path.glob("*.bin"))
    except OSError:
        return False


def _local_pipeline_index(d: Path) -> bool:
    """True when *d* is a diffusers PIPELINE root (a top-level index, weights in component
    subdirs), which ``_is_model_directory`` (root config + loose weights) rejects.

    Either index counts. A Modular Diffusers pipeline carries ``modular_model_index.json`` and no
    ``model_index.json``, and the video loader accepts exactly that pair, so recognising only the
    conventional one hid a valid local root from the picker and let the publisher walk descend
    into it and offer its components as separate, unusable models."""
    try:
        return (d / "model_index.json").is_file() or (d / "modular_model_index.json").is_file()
    except OSError:
        return False


def _is_gguf_companion_only_dir(path: Path) -> bool:
    """True for a folder whose entire content is GGUF companions -- a lone mmproj adapter, an
    MTP drafter, or both -- with nothing servable beside them.

    The scanners report ``model_format = None`` for such a folder, because neither companion is a
    primary weight, and that is also what a plain checkpoint reports. The custom-folder scan below
    validates GGUF rows through ``detect_gguf_model`` and waves the rest through, so without this
    the folder is published as a model that no loader can start.
    """
    try:
        if not path.is_dir():
            return False
        if (path / "config.json").exists() or (path / "adapter_config.json").exists():
            return False
        return any(path.glob("*.gguf")) and not _has_non_gguf_weights(path)
    except OSError:
        return False

def _looks_like_mlx_repo(model_id: str) -> bool:
    """Name heuristic for unloaded models (mirrors the -GGUF suffix check);
    tokenized so MLX only matches as a whole name segment."""
    if model_id.lower().startswith("mlx-community/"):
        return True
    tail = model_id.split("/")[-1]
    return "MLX" in _re.split(r"[-_.]", tail.upper())

def _get_max_position_embeddings(config) -> Optional[int]:
    """Extract max_position_embeddings from a config, with text_config fallback."""
    if hasattr(config, "max_position_embeddings"):
        return config.max_position_embeddings
    if hasattr(config, "text_config") and hasattr(config.text_config, "max_position_embeddings"):
        return config.text_config.max_position_embeddings
    return None


_MODEL_WEIGHT_EXTENSIONS = (".safetensors", ".bin", ".pt", ".pth", ".gguf")


def _get_model_size_bytes(model_name: str, hf_token: Optional[str] = None) -> Optional[int]:
    """Total size of model weight files from HF Hub."""
    try:
        from huggingface_hub import HfApi

        api = HfApi(token = hf_token)
        info = api.repo_info(model_name, repo_type = "model", token = hf_token)
        if not info.siblings:
            return None

        total = 0
        for sibling in info.siblings:
            if sibling.rfilename and sibling.rfilename.endswith(_MODEL_WEIGHT_EXTENSIONS):
                if sibling.size is not None:
                    total += sibling.size

        return total if total > 0 else None
    except Exception as e:
        logger.warning(f"Could not get model size for {model_name}: {e}")
        return None


def _get_snapshot_model_size_bytes(snapshot_path: str) -> Optional[int]:
    try:
        snapshot = Path(snapshot_path).resolve(strict = True)
        snapshots_dir = snapshot.parent.resolve(strict = True)
        repo_dir = snapshots_dir.parent.resolve(strict = True)
        if not snapshot.is_dir() or snapshots_dir.name != "snapshots" or not repo_dir.is_dir():
            return None
        blobs_dir = repo_dir / "blobs"
        resolved_blobs_dir = blobs_dir.resolve(strict = True) if blobs_dir.is_dir() else None
    except (OSError, RuntimeError, ValueError):
        return None

    total = 0
    scan_failed = False

    def _record_walk_error(_error: OSError) -> None:
        nonlocal scan_failed
        scan_failed = True

    try:
        for root, _, filenames in os.walk(
            snapshot,
            followlinks = False,
            onerror = _record_walk_error,
        ):
            root_path = Path(root)
            for filename in filenames:
                if not filename.endswith(_MODEL_WEIGHT_EXTENSIONS):
                    continue
                try:
                    candidate = (root_path / filename).resolve(strict = True)
                    if not candidate.is_file():
                        continue
                    if not candidate.is_relative_to(snapshot) and not (
                        resolved_blobs_dir is not None
                        and candidate.is_relative_to(resolved_blobs_dir)
                    ):
                        continue
                    total += candidate.stat().st_size
                except (OSError, RuntimeError, ValueError):
                    scan_failed = True
    except OSError:
        return None
    return total if total > 0 and not scan_failed else None


def _model_config_inspection_target(
    model_name: str, prefer_local_cache: bool, local_path: Optional[str]
) -> str:
    if not prefer_local_cache or is_local_path(model_name):
        return model_name
    from hub.utils.hf_cache_state import (
        latest_snapshot_from_cache_path,
        with_load_subdirs,
    )

    snapshot = latest_snapshot_from_cache_path(
        local_path,
        "model",
        canonical_model_repo_id(model_name),
        with_load_subdirs(model_name, ("config.json", "adapter_config.json")),
    )
    if snapshot is None:
        raise HTTPException(
            status_code = 404,
            detail = "Selected cached model is no longer available.",
        )
    return snapshot

def _consent_provider(
    model_name: str,
    scanned_targets: List[str],
    external_refs: Optional[List[str]] = None,
) -> Optional[str]:
    """HF org for the consent dialog's `from "<provider>"` tag, or None.

    Returns the owner only for a single, non-local, canonical ``owner/repo`` id; a LoRA's
    extra base, a local path, or an external ``auto_map`` ref yields None so the dialog
    never misattributes scanned code.
    """
    if len(scanned_targets) != 1 or external_refs or is_local_path(model_name):
        return None
    parts = model_name.split("/")
    return parts[0] if len(parts) == 2 and all(parts) else None

def _audio_probe_target(inspection_target: str) -> str:
    """Repo to ask about audio capability, resolving a registry alias first.

    A curated entry like "Spark-TTS-0.5B/LLM" names a load subdirectory, not a repo, so
    the probe fetched a repo that does not exist, got a 404 on every path, and read that
    as "definitely not an audio model" rather than "not a repo id". Spark-TTS then looked
    like a text model, and picking it with an audio dataset hit the modality gate. Same
    resolution routes/training.py already uses for the trainer's own preflight.
    """
    if is_local_path(inspection_target):
        return inspection_target
    try:
        from utils.security import load_scan_target
        repo_id, _load_subdirs = load_scan_target(canonical_model_repo_id(inspection_target), ())
        return repo_id or inspection_target
    except Exception:  # noqa: BLE001 - a probe target must never fail the handler
        return inspection_target


def _audio_type_of_checkpoint(
    model_path: str,
    base_model: Optional[str],
    hf_token: Optional[str] = None,
) -> Optional[str]:
    """Codec a trained checkpoint speaks, or None for a text one.

    A scan row carries no modality, so without this every trained audio model reads
    as text: the Audio page filters it out and chat routes it to the GGUF auto-switch,
    which cannot resolve a local adapter directory. Detection reads the checkpoint
    itself first (a merged export has its own tokenizer) and falls back to the base
    repo an adapter names. Cached per model, so the scan stays one pass.
    """
    from utils.models.model_config import detect_audio_type

    for candidate in (model_path, base_model):
        if not candidate:
            continue
        try:
            # local_files_only: this route was a filesystem scan. A trained checkpoint's
            # base is already cached, and a non-definitive miss is deliberately not cached,
            # so a gated or offline base would re-fetch on every poll.
            # hf_token even under local_files_only: a gated base resolves through the same
            # hub helpers, and the capability caches are keyed by token fingerprint, so a
            # token-less probe would both misclassify and poison the cache for the rest.
            audio_type = detect_audio_type(candidate, hf_token = hf_token, local_files_only = True)
        except Exception as exc:  # never let a scan row fail the whole listing
            logger.debug("audio detection failed for %r: %s", candidate, exc)
            continue
        if audio_type:
            return audio_type
    return None

_NATIVE_CONTEXT_READ_TIMEOUT_SECONDS = 5.0
# Backstop the walk's own budget cannot cover: a single syscall that never returns. Longer
# than the walk budget, so a responding filesystem always ends the walk itself.
_NATIVE_CONTEXT_HARD_TIMEOUT_SECONDS = 8.0
# Concurrent reads. A read stranded on a hung mount holds its slot, so retries wait.
_NATIVE_CONTEXT_MAX_CONCURRENT_READS = 4
_NATIVE_CONTEXT_SLOTS: "weakref.WeakKeyDictionary" = weakref.WeakKeyDictionary()


def _native_context_slots() -> asyncio.Semaphore:
    """Per running loop, since an asyncio primitive cannot be shared across loops."""
    loop = asyncio.get_running_loop()
    slots = _NATIVE_CONTEXT_SLOTS.get(loop)
    if slots is None:
        slots = asyncio.Semaphore(_NATIVE_CONTEXT_MAX_CONCURRENT_READS)
        _NATIVE_CONTEXT_SLOTS[loop] = slots
    return slots


def _settle_native_context(
    slots: asyncio.Semaphore, future: "asyncio.Future", value: Optional[int]
) -> None:
    slots.release()
    if not future.done():
        future.set_result(value)


async def _read_native_context_length_bounded(model: str, is_local: bool) -> Optional[int]:
    """``_read_native_context_length`` off the event loop, with a hard bound.

    Reporting None costs a pre-filled context field; waiting costs the whole variant
    listing, which is what left the picker on "Loading variants…". Runs on a daemon
    thread, not a pool: a stranded read must not join at interpreter exit, which would
    hang shutdown for as long as the mount stays hung. Waiting for a slot is awaited
    rather than skipped, so ordinary concurrent reads queue instead of losing their
    length; the wait and the read share one budget.
    """
    slots = _native_context_slots()
    began = time.monotonic()
    try:
        await asyncio.wait_for(slots.acquire(), timeout = _NATIVE_CONTEXT_HARD_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        logger.debug("native context read for '%s' waited out its slot; reporting none", model)
        return None

    remaining = _NATIVE_CONTEXT_HARD_TIMEOUT_SECONDS - (time.monotonic() - began)
    loop = asyncio.get_running_loop()
    future: "asyncio.Future" = loop.create_future()

    def worker() -> None:
        try:
            value = _read_native_context_length(model, is_local = is_local)
        except Exception:
            value = None
        try:
            loop.call_soon_threadsafe(_settle_native_context, slots, future, value)
        except RuntimeError:
            pass  # loop already closed; nothing is waiting on this

    if remaining <= 0:
        slots.release()
        return None
    try:
        threading.Thread(target = worker, name = "native-ctx", daemon = True).start()
    except RuntimeError:
        slots.release()  # thread never ran, so it will never release
        return None

    try:
        return await asyncio.wait_for(future, timeout = remaining)
    except asyncio.TimeoutError:
        logger.debug("native context read for '%s' did not return; reporting none", model)
        return None


def _read_native_context_length(repo_id: str, is_local: bool) -> Optional[int]:
    """Native max context from a downloaded GGUF for this repo, or None.

    The value is identical across quants, so reading one non-mmproj shard's
    header is enough. Only resolves once a file is on disk. Never raises.

    Bounded by ``_NATIVE_CONTEXT_READ_TIMEOUT_SECONDS``: this only pre-fills a
    context field on an already selectable row, so a dragging walk reports None
    rather than holding the variant listing open. Checked between files, and
    files already read stay cached, so a later request resumes.
    """
    try:
        from utils.models.gguf_metadata import read_gguf_context_length

        # Before cache discovery (also filesystem I/O): started after, a slow enumeration would hand the walk a fresh budget.
        deadline = time.monotonic() + _NATIVE_CONTEXT_READ_TIMEOUT_SECONDS
        if is_local:
            roots = [Path(repo_id)]
        else:
            from hub.utils.hf_cache_state import iter_repo_cache_dirs
            if not _is_valid_repo_id(repo_id):
                return None
            roots = list(iter_repo_cache_dirs("model", repo_id))

        for root in roots:
            if time.monotonic() >= deadline:
                logger.debug("native context read for '%s' out of budget", repo_id)
                return None
            for f in _iter_gguf_paths(root, deadline):
                if time.monotonic() >= deadline:
                    logger.debug("native context read for '%s' out of budget", repo_id)
                    return None
                if _is_mmproj_filename(f.name):
                    continue
                n = read_gguf_context_length(str(f))
                if n:
                    return n
    except Exception:
        pass
    return None


def _resolve_quant_gguf(repo_id: str, quant: str, is_local: bool) -> tuple[Optional[str], int]:
    """Primary shard path and total weight bytes for a downloaded quant, or
    (None, 0). Metadata lives in shard 1, so the lexicographically first file of
    the matching quant is returned. Scoped to one snapshot to avoid summing the
    same quant across revisions; when several snapshots hold the quant the most
    complete one (largest total) wins so a partial revision can't shadow it.
    Mirrors list_local_gguf_variants: quant labels are read from the snapshot-
    relative path (so layouts like ``BF16/model.gguf`` resolve) and MTP drafter
    files are skipped (so a ``...-Q8_0-MTP.gguf`` drafter can't be picked as the
    Q8_0 weights). Never raises.
    """
    try:
        if is_local:
            roots = [Path(repo_id)]
        else:
            from hub.utils.hf_cache_state import iter_repo_cache_dirs

            if not _is_valid_repo_id(repo_id):
                return None, 0
            roots = []
            for entry in iter_repo_cache_dirs("model", repo_id):
                snaps = entry / "snapshots"
                if snaps.is_dir():
                    roots.extend(s for s in snaps.iterdir() if s.is_dir())

        want = (quant or "").strip()
        best_total = 0
        best_first: Optional[str] = None
        for root in roots:
            ranked: dict[int, list[tuple[str, Path, int]]] = {0: [], 1: []}
            for f in _iter_gguf_paths(root):
                try:
                    rel = f.relative_to(root).as_posix()
                except ValueError:
                    rel = f.name
                rank = _main_variant_rank(rel, want)
                if rank is None:
                    continue
                try:
                    size = f.stat().st_size
                except OSError:
                    continue
                ranked[rank].append((rel, f, size))
            # Exact keys alone when any exist: summing them with the label matches counts other
            # checkpoints' bytes into this row's estimate and can reveal one of their files.
            # ... and within those, ONE shard family, the same rule group_gguf_variant_files
            # applies: a snapshot holding the same quant twice (QwQ-32B's two BF16 shard sets)
            # would otherwise report double the weights the loader opens, which /kv-cache-estimate
            # turns into a false exceeds-memory warning and which can make a snapshot look
            # "more complete" purely for holding a redundant copy.
            chosen = _one_shard_family_of(ranked[0] or ranked[1])
            matches = [(rel, f) for rel, f, _size in chosen]
            total = sum(size for _rel, _f, size in chosen)
            # Prefer the most complete snapshot so a partial older revision can't underestimate bytes.
            if matches and total > best_total:
                matches.sort(key = lambda m: m[0])
                best_total = total
                best_first = str(matches[0][1])
        if best_first is not None:
            return best_first, best_total
    except Exception:
        pass
    return None, 0

def _is_gguf_filename(name: str) -> bool:
    return name.lower().endswith(".gguf")


def _is_mmproj_filename(name: str) -> bool:
    """Match GGUF vision-adapter (mmproj) files. Consistent with
    ``utils.models.model_config._is_mmproj``."""
    return "mmproj" in name.lower()


def _is_main_gguf_filename(name: str) -> bool:
    """A primary GGUF weight, not an mmproj vision adapter or an MTP drafter. Same rule as
    ``hub.services.models.common``; pass a snapshot-relative path to catch ``MTP/`` copies too."""
    return _is_gguf_filename(name) and not _is_mmproj_filename(name) and not _is_mtp_drafter(name)


def _recovered_repo_is_unusable_by_repo_id(repo_info) -> bool:
    """See hub.utils.inventory_scan; False for anything upstream already returns."""
    from hub.utils.inventory_scan import recovered_repo_is_unusable_by_repo_id as impl
    return impl(repo_info)


def _repo_id_will_not_resolve(repo_cache_dir: Path) -> bool:
    """See hub.utils.inventory_scan; True only in the dangling refs/main window."""
    from hub.utils.inventory_scan import repo_id_will_not_resolve as impl
    return impl(repo_cache_dir)


def _default_ref_offers_no_whole_quant(repo_cache_dir: Path) -> bool:
    """See hub.utils.inventory_scan; True when refs/main resolves onto a torn quant."""
    from hub.utils.inventory_scan import default_ref_offers_no_whole_quant as impl
    return impl(repo_cache_dir)


def _gguf_copy_is_usable(repo_info, load_id: Optional[str]) -> bool:
    """Whether this copy of the repo holds a quant a load can reach.

    A pinned copy names a complete snapshot. An unpinned one is usable when its id resolves onto a
    whole quant, which is exactly what withheld the pin.
    """
    if load_id:
        return True
    try:
        repo_path = Path(repo_info.repo_path)
        return not _repo_id_will_not_resolve(repo_path) and not _default_ref_offers_no_whole_quant(
            repo_path
        )
    except (OSError, RuntimeError, ValueError):
        return False


def _snapshot_has_gguf_projector(snapshot: str) -> bool:
    """See hub.utils.inventory_scan; reads the same walk the variant lister reports from."""
    from hub.utils.inventory_scan import snapshot_has_gguf_projector as impl
    return impl(Path(snapshot))


def _cached_repo_file_name(file_obj) -> str:
    """Snapshot-relative name for a cached file: huggingface_hub records the bare ``file_name``,
    which cannot tell an ``MTP/`` drafter from a quant."""
    from hub.services.models.cache_inventory import _cached_repo_file_name as impl
    return impl(file_obj)


def _main_variant_gguf_label(rel_path: str) -> Optional[str]:
    name = rel_path.rsplit("/", 1)[-1]
    if not _is_main_gguf_filename(name):
        return None
    if _is_mtp_drafter(rel_path):
        return None
    label = _extract_quant_label(rel_path)
    if _is_big_endian_gguf_path(rel_path, label):
        return None
    return label


def _one_shard_family_of(entries: list) -> list:
    """*entries* narrowed to the single shard family the loader would open.

    ``(rel, path, size)`` triples. Same rule as ``hub.utils.gguf.group_gguf_variant_files``:
    every shard of one split GGUF shares a family, two files that do not are two checkpoints, and
    the family kept is the one holding the lexicographically first file. A genuinely split GGUF is
    one family and survives whole.
    """
    if len(entries) < 2:
        return list(entries)
    from hub.utils.gguf import gguf_variant_family

    families: dict[str, list] = {}
    for entry in entries:
        families.setdefault(gguf_variant_family(entry[0]), []).append(entry)
    if len(families) < 2:
        return list(entries)
    return min(families.values(), key = lambda group: min(e[0] for e in group))


def _main_variant_rank(rel_path: str, want: str) -> Optional[int]:
    """How well *want* names this file's variant: 0 for its own key, 1 for the legacy
    quant-label spelling, None for neither.

    *want* is the request VERBATIM: the bare-quant folding is applied per comparison, because
    doing it once up front strips a qualified key's own path punctuation and folds ``exp-a/`` into
    ``expa/``. Directory-qualified keys keep their legacy bare spelling, since stored pins predate
    them. Root-level H3 stems do not: a bare quant names both FL2VA and Ref2VA, and picking the
    first file would load a different task. Exact keys are used alone whenever any exist, and the
    label is the fallback for rows with no root-stem identity.
    """
    from hub.utils.gguf import is_qualified_gguf_variant_key
    from utils.models.model_config import _gguf_variant_key

    label = _main_variant_gguf_label(rel_path)
    if label is None:
        return None
    key = _gguf_variant_key(rel_path)
    if _variant_keys_match(key, want):
        return 0
    if is_qualified_gguf_variant_key(key) and "/" not in key.replace("\\", "/"):
        return None
    return 1 if _normalized_quant_label(label) == _normalized_quant_label(want) else None


def _variant_keys_match(key: str, want: str) -> bool:
    """Whether *want* is *key*, for the exact-key test.

    ``_normalized_quant_label`` strips hyphens and underscores, which is right for a bare quant
    (``UD-Q4_K_XL`` and ``udq4kxl`` are the same ask) and wrong for a path: it folds ``exp-a/`` and
    ``expa/`` into one, so two advertised checkpoints both answered to the other's key. A qualified
    key keeps its punctuation and compares case-insensitively; the legacy folding applies to the
    bare aliases it was written for.
    """
    from hub.utils.gguf import is_qualified_gguf_variant_key

    if is_qualified_gguf_variant_key(key) or is_qualified_gguf_variant_key(want):
        return key.strip().lower() == want.strip().lower()
    return _normalized_quant_label(key) == _normalized_quant_label(want)


def _normalized_quant_label(label: str) -> str:
    return label.lower().replace("-", "").replace("_", "")


def _repo_has_mmproj(repo_info) -> bool:
    """True if the repo ships a GGUF vision adapter (mmproj), so it can
    take image inputs. Cheap: scans already-listed file names only."""
    return any(
        _is_mmproj_filename(f.file_name) for revision in repo_info.revisions for f in revision.files
    )


def _cached_gguf_row_has_vision(repo_info, load_id: Optional[str]) -> bool:
    """Whether the copy this row loads ships a projector.

    The loader opens the projector out of the snapshot it loads from, so one in a revision the
    load never reaches is not vision support. A pinned row is judged on its snapshot, an unpinned
    one on the first snapshot the load's own ordering finds a quant in. Judged per snapshot, not
    per file: a split quant can sit in a subdirectory while the projector sits at the root.
    """
    if load_id:
        return _snapshot_has_gguf_projector(load_id)
    # No projector in any revision means none to reach, and saves a cache walk.
    if not _repo_has_mmproj(repo_info):
        return False
    try:
        from hub.utils.gguf import iter_snapshots_preferring_whole, list_local_gguf_variants

        # The row describes this copy; a duplicate in another root is one the load never reaches.
        root = Path(repo_info.repo_path).parent
        for snapshot in iter_snapshots_preferring_whole(repo_info.repo_id, None, root = root):
            variants, has_vision = list_local_gguf_variants(str(snapshot))
            if variants:
                return bool(has_vision)
    except Exception:
        pass
    # Nothing on disk to load, so the row describes the repo rather than a copy of it.
    return True

def _iter_gguf_paths(root: Path, deadline: Optional[float] = None):
    """GGUF files under ``root``. With a ``deadline`` (time.monotonic), gives up mid-walk:
    only .gguf files are yielded, so a large tree can walk for a long time yielding nothing,
    and a caller checking its budget per yield would never get to check it."""
    for path in root.rglob("*"):
        if deadline is not None and time.monotonic() >= deadline:
            return
        if path.is_file() and _is_gguf_filename(path.name):
            yield path


def _repo_gguf_size_bytes(repo_info) -> int:
    """Total on-disk size of primary GGUF weight files across all
    revisions, excluding mmproj vision-adapter files.

    Hugging Face hardlinks blobs shared between revisions, so this
    deduplicates by blob path (or revision commit hash + filename as a
    fallback) to avoid double-counting. Unknown sizes (``size_on_disk is
    None``, e.g. a partial download) count as zero. mmproj files are
    excluded so repos whose only ``.gguf`` artifact is a vision adapter
    aren't classed as GGUF repos: the variant selector filters mmproj
    out and would otherwise show zero pickable variants.
    """
    unique_blobs: dict[str, int] = {}
    for revision in repo_info.revisions:
        rev_id = getattr(revision, "commit_hash", None) or str(id(revision))
        for f in revision.files:
            # Snapshot-relative: only the directory tells an MTP/ drafter from a primary quant.
            name = _cached_repo_file_name(f)
            if _is_main_gguf_filename(name):
                blob_path = getattr(f, "blob_path", None)
                size = f.size_on_disk or 0
                if blob_path:
                    unique_blobs[str(blob_path)] = size
                else:
                    unique_blobs[f"{rev_id}:{name}"] = size
    return sum(unique_blobs.values())


def _repo_has_gguf_files(repo_info) -> bool:
    """True when any revision in a cached repo has a primary GGUF weight
    file. Repos whose only ``.gguf`` artifact is an mmproj vision adapter
    are not treated as GGUF here."""
    return _repo_gguf_size_bytes(repo_info) > 0


def _blob_mtime(f) -> float:
    """Blob modification time in epoch seconds (0.0 if unknown).

    Prefers HF metadata ``blob_last_modified``, falls back to stat(); uses
    only mtimes (portable across Windows, macOS, Linux), never path parsing.
    """
    ts = getattr(f, "blob_last_modified", None)
    if isinstance(ts, (int, float)) and ts > 0:
        return float(ts)
    blob_path = getattr(f, "blob_path", None)
    if blob_path:
        try:
            return float(Path(blob_path).stat().st_mtime)
        except OSError:
            pass
    return 0.0


def _repo_gguf_last_modified(repo_info) -> float:
    """Newest mtime among a repo's primary (non-mmproj) GGUF blobs.

    Drives the Downloaded list's "last downloaded" ordering and groups a
    multi-quant repo by its most recently downloaded quant.
    """
    latest = 0.0
    for revision in repo_info.revisions:
        for f in revision.files:
            if _is_main_gguf_filename(_cached_repo_file_name(f)):
                latest = max(latest, _blob_mtime(f))
    return latest

_DIFFUSION_GGUF_ARCHS = frozenset(
    {
        # ONLY the families the diffusion backend can assemble. Other diffusion archs would pass this filter then 400 in validate_load.
        "flux",  # flux.1
        "flux2",  # flux.2-klein
        "qwen_image",  # qwen-image
        "qwenimage",
        "z_image",  # z-image
        "zimage",
    }
)

# Diffusion / image-video GGUF archs the backend can NOT assemble yet (LlamaCppBackend._DIFFUSION_ARCHES minus the loadable set).
_UNSUPPORTED_DIFFUSION_GGUF_ARCHS = frozenset(
    {
        "sd1",
        "sd3",
        "sdxl",
        "aura",
        "hidream",
        "cosmos",
        "hyvid",
    }
)

# Archs shared by a buildable family and a non-buildable one. Z-Image's DiT is a Lumina2
# derivative, so its GGUFs declare "lumina2"; these resolve from the repo/file name.
_AMBIGUOUS_DIFFUSION_GGUF_ARCHS = frozenset({"lumina2"})

# Literal placeholders gguf-connector writes into general.architecture for its diffusion
# GGUFs. Mirrors LlamaCppBackend._PLACEHOLDER_ARCHES, which does the same normalisation on
# the load side; the two must agree or a row is offered to chat and then refused by it.
_PLACEHOLDER_DIFFUSION_GGUF_ARCHS = frozenset({"pig", "cow"})

# Video GGUF archs the video backend CAN load (LTX-2.x ships as "ltxv", the Wan community GGUFs as "wan").
_VIDEO_GGUF_ARCHS = frozenset({"ltxv", "wan"})
_VIDEO_GEN_TASK = "text-to-video"

# Task tag for the archs above; mirrored by the frontend NON_CHAT_TASKS gate.
_UNSUPPORTED_DIFFUSION_TASK = "image-diffusion-unsupported"


# The two denoiser partitions, by the filename prefix the loader itself validates against
# (``video_minimax_h3``). These GGUFs carry no architecture metadata, so the NAME is the only
# evidence there is, and it is the same evidence the load path acts on.
_H3_DENOISER_GGUF_PREFIXES = ("minimax_h3_fl2va", "minimax_h3_ref2va")


def _is_h3_bundle_gguf_hint(hint: Optional[str]) -> bool:
    """True when a name hint names MiniMax-H3 GGUF weights (video, never chat).

    Either a known bundle repo id, or a validated denoiser FILENAME. The filename half matters
    for a GGUF the user copied into a custom local directory rather than leaving under one of the
    bundle ids: with no architecture metadata to fall back on, ``_local_model_task`` returned null
    and an otherwise loadable checkpoint was dropped from the Video On Device picker."""
    if not hint:
        return False
    name = str(hint).strip().lower().rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
    if name.endswith(".gguf") and name.startswith(_H3_DENOISER_GGUF_PREFIXES):
        return True
    try:
        from hub.utils.gguf import is_h3_bundle_repo
        return is_h3_bundle_repo(hint)
    except Exception:  # noqa: BLE001 -- never misclassify a model over a probe failure
        return False


def _gguf_architecture(path: str) -> Optional[str]:
    """The GGUF ``general.architecture``, or None. Delegates to the shared,
    bounds-checked header reader (cached by path/mtime/size)."""
    from utils.models.gguf_metadata import read_gguf_architecture
    return read_gguf_architecture(path)


def _gguf_family_buildable(name_hints: tuple[Optional[str], ...]) -> bool:
    """Whether an engine on THIS host can build the diffusion family a GGUF belongs to.

    The listing twin of the loader's gate, and the same predicate: ``validate_load_request`` refuses
    a family whose diffusers pipeline class this environment lacks (the newer families ship only in a
    newer diffusers, and packaging still allows an older one on Python 3.9) UNLESS the native sd.cpp
    engine would serve the GGUF, which needs no pipeline class at all. Advertising a row neither
    engine can build is a pick that can only fail; hiding one the native engine loads is the opposite
    mistake, on exactly the CPU/MPS hosts that engine exists for.

    Fails OPEN when no family resolves from the hints or the probe raises: the load path reports a
    real problem properly, and a listing must not hide a usable model over a detection miss."""
    try:
        from core.inference.diffusion_engine_router import family_buildable_here
        from core.inference.diffusion_families import detect_family_for_pick
        for hint in name_hints:
            if not hint:
                continue
            fam = detect_family_for_pick(hint)
            if fam is not None:
                return family_buildable_here(fam, model_kind = "gguf")
    except Exception:  # noqa: BLE001 -- never hide a model over a probe failure
        return True
    return True


def _video_family_buildable(fam) -> bool:
    """Whether the installed diffusers can build this video family's pipeline class.

    The video backend has no native engine, so it is the plain class check its own
    ``validate_load_request`` runs (``video.py`` -> ``assert_pipeline_class_available``): LTX-2 and
    the other newer pipelines exist only in a newer diffusers. Fails OPEN on any probe error."""
    try:
        from core.inference.diffusion_families import family_pipeline_available
        return family_pipeline_available(fam)
    except Exception:  # noqa: BLE001 -- never hide a model over a probe failure
        return True


def _arch_to_task(arch: Optional[str], name_hints: tuple[Optional[str], ...] = ()) -> Optional[str]:
    # MiniMax-H3's GGUFs carry NO metadata keys at all -- every file in the bundle, denoisers and
    # the Qwen conditioner alike, has kv_count 0, so general.architecture is absent where LTX-2 and
    # Wan GGUFs declare "ltxv"/"wan". The arch read therefore classifies the whole repo as unknown,
    # and an unknown task is dropped from the Video picker's On Device list while the chat picker
    # still offers the video DiT. Key the bundle repos by id instead, before the arch is consulted.
    if any(_is_h3_bundle_gguf_hint(hint) for hint in name_hints):
        return _VIDEO_GEN_TASK
    if arch is None:
        return None
    a = arch.lower()
    if a in _PLACEHOLDER_DIFFUSION_GGUF_ARCHS:
        # Not an architecture at all: gguf-connector writes these literals in place of one
        # (gguf-org/flux2-dev-gguf and calcuis/cosmos-predict2-gguf both declare "pig").
        # Being non-null they used to fall past every media branch to "text-generation", so
        # a diffusion GGUF was offered to chat and only refused at load. Only gguf-connector
        # writes them and only for diffusion GGUFs, so the row is never a chat model:
        # resolve the page by name, and stay unsupported when neither answers.
        from core.inference.video_families import detect_video_family

        for hint in name_hints:
            fam = detect_video_family(hint) if hint else None
            if fam is not None:
                if not getattr(fam, "is_moe", False) and _video_family_buildable(fam):
                    return _VIDEO_GEN_TASK
                return _UNSUPPORTED_DIFFUSION_TASK
        # An image family has to RESOLVE, not merely fail open: _gguf_family_buildable is
        # permissive by design for a branch whose arch already says "image GGUF", and a
        # placeholder says nothing, so it would advertise Images for anything.
        from core.inference.diffusion_families import detect_family_for_pick

        if any(detect_family_for_pick(hint) is not None for hint in name_hints if hint):
            return (
                "text-to-image"
                if _gguf_family_buildable(name_hints)
                else _UNSUPPORTED_DIFFUSION_TASK
            )
        return _UNSUPPORTED_DIFFUSION_TASK
    if a in _DIFFUSION_GGUF_ARCHS:
        # Third gate, mirroring the cached-repo picker: a family no engine here can build can only fail.
        if not _gguf_family_buildable(name_hints):
            return _UNSUPPORTED_DIFFUSION_TASK
        return "text-to-image"
    if a in _VIDEO_GGUF_ARCHS:
        # Advertise as loadable video only when a VideoFamily resolves. Some archs map straight
        # from the arch (ltxv); bare "wan" is ambiguous, so fall back to repo/file names.
        from core.inference.video_families import detect_video_family

        fam = detect_video_family("", override = a)
        if fam is None:
            for hint in name_hints:
                if hint:
                    fam = detect_video_family(hint)
                    if fam is not None:
                        break
        if fam is not None and not getattr(fam, "is_moe", False) and _video_family_buildable(fam):
            return _VIDEO_GEN_TASK
        return _UNSUPPORTED_DIFFUSION_TASK
    if a in _AMBIGUOUS_DIFFUSION_GGUF_ARCHS:
        # Same as the video branch: the arch is shared, so let the loader's family detection decide.
        from core.inference.diffusion_engine_router import family_buildable_here
        from core.inference.diffusion_families import detect_family_for_pick, family_gguf_loadable

        for hint in name_hints:
            if not hint:
                continue
            fam = detect_family_for_pick(hint)
            if fam is not None:
                # Both gates: a GGUF-assemblable family AND an engine here that can build it.
                loadable = family_gguf_loadable(fam) and family_buildable_here(
                    fam, model_kind = "gguf"
                )
                return "text-to-image" if loadable else _UNSUPPORTED_DIFFUSION_TASK
        return _UNSUPPORTED_DIFFUSION_TASK
    # A diffusion arch the backend cannot assemble: hide from chat and from Images (would 400).
    if a in _UNSUPPORTED_DIFFUSION_GGUF_ARCHS:
        return _UNSUPPORTED_DIFFUSION_TASK
    return "text-generation"


# A media checkpoint outranks a text one in the same GGUF folder (see _gguf_folder_task), and is
# ranked within the media answers too: _UNSUPPORTED_DIFFUSION_TASK hides the row from the chat
# picker AND from the Images and Video ones, so a folder holding both a buildable denoiser and an
# arch this backend cannot assemble has exactly one loadable answer, and returning the other on the
# strength of where it sorts hides a model that works.
_LOADABLE_MEDIA_GGUF_TASKS = frozenset({"text-to-image", _VIDEO_GEN_TASK})
# Enough to reach the denoiser past a bundle's encoders, VAE and LoRAs. The guarantee is "the first
# 64 in order decide", the same 64 on every host. A folder deep enough to hit this is a dump.
_MAX_TASK_CLASSIFY_GGUFS = 64
# Ordering costs first-wins' early exit, so bound the walk as _dir_has_downloaded_model and
# _read_native_context_length already do. A scan folder is arbitrary (a network mount, or weights
# beside a huge unrelated subtree rglob counts every entry of) and this runs once per listed row.
# Past the budget the answer comes from what was reached, still at least what first-wins saw.
_TASK_CLASSIFY_WALK_SECONDS = 0.75
# The header reads get their own budget, started after the walk, so a slow walk cannot cut them
# short at the encoder and hand back the answer this function exists to avoid.
_TASK_CLASSIFY_READ_SECONDS = 1.5


def _is_trailing_split_shard(name: str) -> bool:
    """True for shard 2..N of a split GGUF.

    ``gguf-split`` writes the whole KV block into shard 1 only, so a trailing shard carries no
    ``general.architecture`` at all: reading one can only fail, and a 51-shard repo would cost 51
    header reads to answer one question.

    False if the shared pattern cannot be imported, so a rename there costs the optimisation and
    nothing else: this runs inside the caller's blanket except, where an ImportError would come
    back as no classification for any folder."""
    try:
        from utils.models.model_config import _GGUF_SPLIT_FILE_RE
    except ImportError:
        return False

    match = _GGUF_SPLIT_FILE_RE.match(name)
    return match is not None and match.group("index") != "00001"


def _task_classify_sort_key(root: Path, path: Path) -> tuple[str, str]:
    """Order a candidate by its path RELATIVE to the folder, in posix form.

    Ordering exists so the answer stops depending on the filesystem, so the key carries neither the
    mount point (what moving a Models folder changes) nor the separator: ``\\`` sorts against ``-``
    and ``.`` differently than ``/``, so an absolute-path key can order the same two files one way
    on Windows and the other on Linux. Lowercased so a case-insensitive filesystem agrees, exact
    form as tie-break to keep the order total."""
    try:
        rel = path.relative_to(root).as_posix()
    except ValueError:
        rel = path.name
    return (rel.lower(), rel)


def _gguf_folder_task(
    root: Path,
    id_hints: tuple[Optional[str], ...],
    deadline: Optional[float] = None,
) -> Optional[str]:
    """The task a folder of GGUFs classifies as, ordered and decided by the media file.

    Two bugs, one fix (#8406, #8407). The walk is ``rglob``, i.e. raw directory order, and the
    answer used to be whichever file it yielded first, so a folder classified differently on two
    machines and differently before and after a copy, which is what moving the Models folder makes.
    Sorting makes the answer a property of the contents, not of the filesystem.

    Decisive rather than first-wins because a media checkpoint does not ship alone: community
    bundles put the text encoder (t5 / clip / a qwen3 conditioner) beside the denoiser. Answering
    with the encoder tags a real image or video repo ``text-generation``, dropping it out of the
    Images picker and offering a DiT in the chat one. A text repo has no diffusion GGUF in it, so
    nothing gains a media task that did not already have one.

    Bounded on both halves so neither scales with the folder: ``deadline`` (time.monotonic,
    defaulted here) stops the walk, and candidates are trimmed to the cap as they are found."""
    if deadline is None:
        deadline = time.monotonic() + _TASK_CLASSIFY_WALK_SECONDS
    fallback: Optional[str] = None
    try:
        # Trimmed back to the cap as it fills: a folder holding thousands of GGUFs should not cost
        # a list of thousands of paths to read 64 of them.
        scored: list[tuple[tuple[str, str], Path]] = []
        for path in _iter_gguf_paths(root, deadline):
            name = path.name
            if _is_mmproj_filename(name) or _is_trailing_split_shard(name):
                continue
            scored.append((_task_classify_sort_key(root, path), path))
            if len(scored) > _MAX_TASK_CLASSIFY_GGUFS * 2:
                scored.sort(key = lambda item: item[0])
                del scored[_MAX_TASK_CLASSIFY_GGUFS:]
        scored.sort(key = lambda item: item[0])
        paths = [path for _, path in scored[:_MAX_TASK_CLASSIFY_GGUFS]]
    except Exception:
        return None
    unsupported: Optional[str] = None
    read_deadline = time.monotonic() + _TASK_CLASSIFY_READ_SECONDS
    for index, path in enumerate(paths):
        # The first read always happens, so a folder still classifies from its first ordered file
        # even where the budget was gone before this loop started.
        if index and time.monotonic() >= read_deadline:
            break
        try:
            task = _arch_to_task(_gguf_architecture(str(path)), name_hints = id_hints + (path.name,))
        except Exception:
            continue
        if task in _LOADABLE_MEDIA_GGUF_TASKS:
            return task
        if task == _UNSUPPORTED_DIFFUSION_TASK:
            if unsupported is None:
                unsupported = task
        elif task is not None and fallback is None:
            fallback = task
    return unsupported or fallback


def _repo_gguf_task(repo_info) -> Optional[str]:
    """HF pipeline task of a cached GGUF repo, from its architecture:
    'text-to-image' for a loadable diffusion arch, the non-loadable diffusion tag
    for a recognized-but-unsupported image arch, else 'text-generation' (None if
    unreadable)."""
    repo_id = getattr(repo_info, "repo_id", None)
    try:
        return _gguf_folder_task(Path(repo_info.repo_path), (repo_id,))
    except Exception:
        return None


def _hf_cache_snapshot_repo_id(path: Optional[str]) -> Optional[str]:
    """``org/name`` when *path* IS a ``models--org--name/snapshots/<sha>`` root, else None.

    ``hf_cache_repo_id`` also answers for anything UNDER that directory, which is right for its own
    job and wrong for a needle: a pipeline's ``transformer``, ``vae`` and ``text_encoder`` dirs
    carry a ``config.json`` and weights, so a scan folder registers each as a row, and handing them
    the parent's repo id makes every one detect the family, satisfy ``_local_is_diffusers`` and
    enter the Images picker as a checkpoint that cannot load. Hence the shape must end at the
    snapshot; the decode itself is still the strict shared one."""
    if not path:
        return None
    parts = str(path).replace("\\", "/").rstrip("/").split("/")
    if len(parts) >= 3 and parts[-2] == "snapshots" and parts[-3].startswith("models--"):
        from core.inference.model_ids import hf_cache_repo_id
        return hf_cache_repo_id(path)
    return None


def _local_family_needles(model: "LocalModelInfo") -> tuple[str, ...]:
    """Family-detection hints for a local (non-GGUF) checkpoint: model id, display name, leaf dir
    name, and -- for a bare single-file dir -- the sole checkpoint's filename (a generic folder
    holding one ``qwen-image-*.safetensors`` identifies its family only there, and the load route
    resolves it via ``resolve_local_single_file``). Only basenames, so a parent-dir token can't
    match -- with one exception, the encoded repo id below.

    A checkpoint still in HF cache layout carries its repo id in the ``models--org--name``
    directory, while every other needle degrades to the snapshot basename, a commit hash. That is
    a moved Models folder registered as a scan folder (#8407): a GGUF still classifies from its
    architecture, but a diffusers pipeline, proven to be one by its ``model_index.json``, had no
    name left and dropped out of the Images picker as task=null. The decode answers only for a real
    ``models--*/snapshots/*`` path AND only for the row that IS the snapshot, so it recovers the id
    that row lost without letting arbitrary parent-dir tokens match or component dirs inherit it.
    Last of the name needles, so the basenames still win."""
    needles = [model.model_id, model.display_name, Path(model.id).name]
    try:
        needles.append(
            _hf_cache_snapshot_repo_id(model.path) or _hf_cache_snapshot_repo_id(model.id)
        )
    except Exception:
        pass
    try:
        from core.inference.diffusion import resolve_local_single_file
        single = resolve_local_single_file(model.path)
        if single:
            needles.append(single)
    except Exception:
        pass
    return tuple(n for n in needles if n)


def _local_model_task(model: "LocalModelInfo") -> Optional[str]:
    """Classify a local model into an HF pipeline task so the Images picker can filter.

    For a GGUF, read its architecture (the path may be the .gguf file itself or a folder
    containing one). For a local non-GGUF image checkpoint (a diffusers pipeline dir or a
    single-file safetensors), fall through to the diffusers detection so on-device image
    models get the 'text-to-image' tag instead of being dropped as task=null; the load
    path accepts these as a local pipeline."""
    path = model.path
    _id_hints = (model.model_id, model.display_name, model.id)
    if model.model_format == "gguf":
        try:
            p = Path(path)
            if p.suffix.lower() == ".gguf" and p.is_file():
                return _arch_to_task(_gguf_architecture(str(p)), name_hints = _id_hints + (p.name,))
            return _gguf_folder_task(p, _id_hints)
        except Exception:
            pass
        return None
    if _local_is_diffusers(model):
        # A local diffusers pipeline can be a VIDEO family, not just image; tag it text-to-video so it surfaces in the Video picker.
        try:
            from core.inference.video import _is_trusted_video_repo
            from core.inference.video_families import detect_video_family
            for needle in _local_family_needles(model):
                vfam = detect_video_family(needle)
                # Third gate: the video load asserts the family's pipeline class, and newer ones need newer diffusers.
                if vfam is not None and _is_trusted_video_repo(path):
                    return _VIDEO_GEN_TASK if _video_family_buildable(vfam) else None
        except Exception:
            pass
        # The Images load path 400s AFTER eviction when no image family is supported, so tag only when detection succeeds.
        try:
            from core.inference.diffusion_engine_router import family_buildable_here
            from core.inference.diffusion_families import (
                detect_family,
                detect_family_by_pipeline_index,
            )

            # The saved pipeline class first: evidence out of the checkpoint, where every needle
            # below is a name, and a moved model's name is what does not survive (#8407). The
            # loader reads the index through the same helper, so anything shown on this evidence is
            # something validate_load_request accepts on it.
            for fam in (
                detect_family_by_pipeline_index(path),
                *(detect_family(needle) for needle in _local_family_needles(model)),
            ):
                if fam is not None:
                    # A local non-GGUF checkpoint always loads through diffusers, so the pipeline class has to exist here.
                    return (
                        "text-to-image"
                        if family_buildable_here(fam, model_kind = "pipeline")
                        else None
                    )
            return None
        except Exception:
            # Detection unavailable: fall back to the prior permissive tag rather than hiding a possibly-loadable pipeline.
            return "text-to-image"
    return None


def _local_is_diffusers(model: "LocalModelInfo") -> bool:
    """True for a local diffusers image checkpoint, mirroring the cached-repo
    ``_repo_is_diffusers`` heuristics: a full pipeline carries a top-level
    ``model_index.json``, while single-file / safetensors image checkpoints ship none, so
    fall back to the model id resolving to a known diffusion family (the same resolver the
    Images backend loads from). Family detection uses _local_family_needles (id / name / sole
    checkpoint filename, not the on-disk path), so a parent-dir keyword can't spuriously match."""
    try:
        p = Path(model.path)
        if p.is_dir() and (p / "model_index.json").is_file():
            return True
    except Exception:
        pass
    try:
        from core.inference.diffusion_families import detect_family
        for needle in _local_family_needles(model):
            if detect_family(needle) is not None:
                return True
    except Exception:
        pass
    # A single-file VIDEO checkpoint (no model_index.json) is missed above but loaded as single_file by the video route, so surface it.
    try:
        from core.inference.video_families import detect_video_family
        for needle in _local_family_needles(model):
            if detect_video_family(needle) is not None:
                return True
    except Exception:
        pass
    return False


def snapshot_variants_all_complete(snapshot: str) -> bool:
    """Re-export; the predicate lives beside the completed-variant walk it uses."""
    from hub.utils import inventory_scan
    return inventory_scan.snapshot_variants_all_complete(snapshot)


def snapshot_has_complete_variants(snapshot: str) -> bool:
    """Re-export of the predicate every load-id pin shares; see above."""
    from hub.utils import inventory_scan
    return inventory_scan.snapshot_has_complete_variants(snapshot)


def _repo_gguf_load_id(repo_info, active_root: Optional[Path]) -> Optional[str]:
    """Snapshot dir holding the newest primary GGUF, for a repo outside the active
    hub cache that does not resolve by id. ``None`` when the id works or no
    snapshot is recorded, since the repo dir itself is not loadable.
    """
    from hub.utils.hf_cache_state import snapshot_selection_key

    repo_path = getattr(repo_info, "repo_path", None)
    if repo_path is None or active_root is None:
        return None
    try:
        # A recovered repo's refs/main names nothing, so its id resolves nowhere and needs a pin.
        if (
            repo_path.parent.resolve(strict = False) == active_root
            and not _repo_id_will_not_resolve(repo_path)
            and not _default_ref_offers_no_whole_quant(repo_path)
        ):
            return None
    except (OSError, RuntimeError, ValueError):
        pass
    # Shared selection key, so this route and the /gguf-variants lister name one snapshot.
    candidates = [
        Path(snapshot)
        for revision in repo_info.revisions
        if (snapshot := getattr(revision, "snapshot_path", None)) is not None
        and any(_is_main_gguf_filename(_cached_repo_file_name(f)) for f in revision.files)
    ]
    candidates.sort(key = snapshot_selection_key, reverse = True)
    # Newest first, skipping any holding no whole quant, else a torn download beats a loadable one.
    for snapshot in candidates:
        if snapshot_has_complete_variants(str(snapshot)):
            return str(snapshot)
    # Nothing complete anywhere: publishing a half-downloaded snapshot would put that path in
    # the copied command and fail on load. Drop the id so the repo id fetches the missing shards.
    return None


def _preferred_gguf_copy(
    rows: dict, ranks: dict, key: str, candidate: tuple[bool, bool], size: int
) -> bool:
    """Whether this copy should replace the one already kept for *key*.

    Same order the Hub inventory deduplicates by: a copy that cannot load loses to one that can,
    whichever cache holds it, then the active cache wins, then the larger download.
    """
    existing = rows.get(key)
    if existing is None:
        return True
    kept = ranks.get(key, (True, True))
    if candidate[0] != kept[0]:
        return candidate[0]
    if candidate[1] != kept[1]:
        return candidate[1]
    return size > int(existing.get("size_bytes") or 0)

def _repo_has_pipeline_index(repo_info) -> bool:
    """Root-model_index.json check. Shared with the hub inventory scan, which classifies the
    same repos for the same pickers; see :func:`hub.utils.inventory_scan.repo_has_pipeline_index`."""
    from hub.utils import inventory_scan as hf_cache_scan
    return hf_cache_scan.repo_has_pipeline_index(repo_info)


def _repo_is_diffusers(repo_info) -> bool:
    """True for an image-diffusion repo, so the chat picker hides it (it renders
    images, not chat) and the Images picker claims it — mirroring how cached
    diffusion GGUFs are classified by arch.

    Two signals: a full diffusers pipeline carries a top-level model_index.json,
    while single-file / ComfyUI / ControlNet image checkpoints (e.g. an FP8
    Qwen-Image or a z-image .safetensors) ship none. For those, fall back to the
    repo id resolving to a known diffusion family — the same resolver the Images
    backend loads from — so they don't surface as loadable chat models."""
    if _repo_has_pipeline_index(repo_info):
        return True
    try:
        from core.inference.diffusion_families import detect_family
        if detect_family(getattr(repo_info, "repo_id", "") or "") is not None:
            return True
    except Exception:
        pass
    return False


def _repo_pipeline_missing_denoiser(repo_info) -> bool:
    """Companion-only-prefetch check (pipeline manifest present, denoiser weights absent). Shared
    with the hub inventory scan so both listings agree on which rows are really on-device; see
    :func:`hub.utils.inventory_scan.repo_pipeline_missing_denoiser`."""
    from hub.utils import inventory_scan as hf_cache_scan
    return hf_cache_scan.repo_pipeline_missing_denoiser(repo_info)


def _cached_repo_partial(repo_id: str, repo_cache_dir: Optional[Path] = None) -> bool:
    """Whether the cached model snapshot is incomplete (cancelled/partial download).
    Reuses the hub inventory scan's snapshot-partial detector (cancel marker, legacy
    .incomplete blob, manifest walk -- cheapest first). ``repo_cache_dir`` scopes all three
    signals to the specific snapshot being listed: without it the scan spans every HF cache
    root, so a stale .incomplete copy in one root would flag a complete copy in another as
    partial and hide it from the picker (the sibling inventory paths all scope the same way).
    Best-effort: a detection error reports not-partial so a scan glitch never hides a
    genuinely usable repo."""
    try:
        from hub.utils.inventory_scan import is_snapshot_partial
        return bool(is_snapshot_partial("model", repo_id, repo_cache_dir))
    except Exception:  # noqa: BLE001 -- never fail the listing over a partial probe
        return False


def _is_sd_cpp_companion_repo(repo_id: str) -> bool:
    """True for a mirror that holds only sd.cpp companions (VAE / text encoders, no denoiser)."""
    try:
        from core.inference.diffusion_families import sd_cpp_companion_only_repo_ids
        return (repo_id or "").strip().lower() in sd_cpp_companion_only_repo_ids()
    except Exception:  # noqa: BLE001 -- an import failure must not hide a usable repo
        return False


def _cached_repo_task(repo_info) -> Optional[str]:
    """Pipeline task for a cached non-GGUF repo: 'text-to-video' for repos the
    video backend can load as full pipelines (its trust list / family detector),
    else 'text-to-image' for diffusers image repos, else None (chat). Without the
    video tag, cached Lightricks / Wan / Hunyuan pipelines never surfaced in the
    Video picker's On Device list -- everything diffusers was blanket-tagged
    text-to-image."""
    repo_id = getattr(repo_info, "repo_id", "") or ""
    try:
        from core.inference.video import _is_trusted_video_repo
        from core.inference.video_families import detect_video_family

        # Both gates: a detected video family (so image repos don't match) AND the load path's trust
        # rule. Third gate: the video load asserts the family's pipeline class (needs newer diffusers).
        video_fam = detect_video_family(repo_id)
        if video_fam is not None:
            if not _is_trusted_video_repo(repo_id) or not _video_family_buildable(video_fam):
                return None
            return _VIDEO_GEN_TASK
    except Exception:
        pass
    if not _repo_is_diffusers(repo_info):
        return None
    # BOTH gates, mirroring the video branch: trust rule AND a detected image family. A
    # model_index.json only proves it is a diffusers pipeline; newer families need diffusers 0.39.
    try:
        from core.inference.diffusion import _is_trusted_diffusion_repo
        from core.inference.diffusion_families import (
            detect_family,
            family_pipeline_available,
        )

        # An sd.cpp companion repo holds no denoiser, so it is never a pick even though its
        # unsloth/* mirror clears the trust gate below (the third-party ids never did). No task
        # keeps it out of the IMAGE picker; the row's companion flag is what keeps it out of the
        # chat one, since a task of None is what every unclassified chat repo carries.
        if _is_sd_cpp_companion_repo(repo_id):
            return None
        fam = detect_family(repo_id)
        if not _is_trusted_diffusion_repo(repo_id) or fam is None:
            return None
        if not family_pipeline_available(fam):
            return None
        return "text-to-image"
    except Exception:  # noqa: BLE001 -- an import failure must not hide a usable repo
        return "text-to-image"
