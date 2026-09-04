"""Coding agents, OpenAI auto switch, model overrides, and RAG embedding model."""

import functools
import threading
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from loggers import get_logger
from utils.utils import safe_error_detail

from auth.authentication import get_current_subject
from utils.coding_agents import CODING_AGENTS, detect_installed_coding_agents
from utils.openai_auto_switch_settings import (
    DEFAULT_AUTO_UNLOAD_API_ONLY,
    DEFAULT_AUTO_UNLOAD_KEEP_KV,
    DEFAULT_MEDIA_AUTO_SWITCH_ENABLED,
    DEFAULT_MEDIA_AUTO_UNLOAD_IDLE_SECONDS,
    DEFAULT_OPENAI_AUTO_DOWNLOAD_ENABLED,
    DEFAULT_OPENAI_AUTO_SWITCH_ENABLED,
    cached_repo_alias_keys,
    get_auto_unload_api_only,
    get_auto_unload_idle_seconds,
    get_auto_unload_keep_kv,
    get_media_auto_switch_enabled,
    get_media_auto_unload_idle_seconds,
    get_model_overrides,
    get_openai_auto_switch_enabled,
    resolve_model_override_key,
    resolve_model_override_keys,
    get_stored_auto_unload_idle_seconds,
    get_stored_media_auto_unload_idle_seconds,
    get_stored_openai_auto_download_enabled,
    idle_unload_is_configured,
    set_model_override,
    set_openai_auto_switch,
)
from utils.embedding_model_settings import (
    default_embedding_model,
    get_rag_embedding_model,
    get_stored_embedding_model,
    reset_rag_embedding_model,
    set_rag_embedding_model,
    validate_embedding_model,
)
from core.rag.config import default_gguf_repo, effective_gguf_repo
from utils.utils import log_and_http_error
from routes.settings_pkg.schemas import (
    CodingAgentsResponse,
    OpenAIAutoSwitchPayload,
    OpenAIAutoSwitchResponse,
    ModelOverridePayload,
    ModelOverridesResponse,
    EmbeddingModelPayload,
    EmbeddingModelResponse,
    _MAX_VARIANT_SUFFIX_LEN,
    MAX_MODEL_OVERRIDE_KEY_LEN,
    MAX_GGUF_VARIANT_KEY_LEN,
    MAX_GPU_IDS,
)

router = APIRouter()
logger = get_logger(__name__)

@router.get("/coding-agents", response_model = CodingAgentsResponse)
def get_coding_agents(current_subject: str = Depends(get_current_subject)) -> CodingAgentsResponse:
    return CodingAgentsResponse(detected = detect_installed_coding_agents())


@router.get("/openai-auto-switch", response_model = OpenAIAutoSwitchResponse)
def get_openai_auto_switch(
    current_subject: str = Depends(get_current_subject),
) -> OpenAIAutoSwitchResponse:
    return OpenAIAutoSwitchResponse(
        enabled = get_openai_auto_switch_enabled(),
        auto_unload_idle_seconds = get_stored_auto_unload_idle_seconds(),
        idle_unload_active = get_auto_unload_idle_seconds() > 0,
        auto_unload_keep_kv = get_auto_unload_keep_kv(),
        auto_download_model = get_stored_openai_auto_download_enabled(),
        auto_unload_api_only = get_auto_unload_api_only(),
        media_auto_unload_idle_seconds = get_stored_media_auto_unload_idle_seconds(),
        media_idle_unload_active = get_media_auto_unload_idle_seconds() > 0,
        media_auto_switch_model = get_media_auto_switch_enabled(),
    )


@router.put("/openai-auto-switch", response_model = OpenAIAutoSwitchResponse)
def update_openai_auto_switch(
    payload: OpenAIAutoSwitchPayload, current_subject: str = Depends(get_current_subject)
) -> OpenAIAutoSwitchResponse:
    try:
        (
            enabled,
            idle_seconds,
            keep_kv,
            auto_download,
            api_only,
            media_idle_seconds,
            media_auto_switch,
        ) = set_openai_auto_switch(
            payload.enabled,
            payload.auto_unload_idle_seconds,
            payload.auto_unload_keep_kv,
            payload.auto_download_model,
            payload.auto_unload_api_only,
            payload.media_auto_unload_idle_seconds,
            payload.media_auto_switch_model,
        )
    except ValueError as exc:
        raise log_and_http_error(
            exc,
            400,
            safe_error_detail(exc, fallback = "Invalid OpenAI auto-switch setting."),
            event = "settings.update_openai_auto_switch_failed",
            log = logger,
        ) from exc
    idle_unload_active = get_auto_unload_idle_seconds() > 0
    if not keep_kv or not idle_unload_is_configured():
        # Drop already-saved chat context too. Configured, not effective: residency
        # zeroes the TTL, and that must not discard KV the user still wants.
        from core.inference.llama_keepwarm import purge_kv_resume
        purge_kv_resume()
    return OpenAIAutoSwitchResponse(
        enabled = enabled,
        auto_unload_idle_seconds = idle_seconds,
        idle_unload_active = idle_unload_active,
        auto_unload_keep_kv = keep_kv,
        auto_download_model = auto_download,
        auto_unload_api_only = api_only,
        media_auto_unload_idle_seconds = media_idle_seconds,
        media_idle_unload_active = get_media_auto_unload_idle_seconds() > 0,
        media_auto_switch_model = media_auto_switch,
    )


@router.get("/openai-auto-switch/overrides", response_model = ModelOverridesResponse)
def get_openai_auto_switch_overrides(
    model_id: Optional[str] = None,
    alias_id: Optional[str] = None,
    gguf_variant: Optional[str] = None,
    current_subject: str = Depends(get_current_subject),
) -> ModelOverridesResponse:
    """Every stored override, and optionally the one a named model's load would use.

    The resolution is the loader's own (``resolve_override_for_load``), so what a
    panel shows and what a load applies cannot disagree.
    """
    resolved_key: Optional[str] = None
    resolved: Optional[dict] = None
    if model_id:
        from utils.openai_auto_switch_settings import resolve_override_for_load
        resolved_key, resolved = resolve_override_for_load(model_id, alias_id, gguf_variant)
    return ModelOverridesResponse(
        overrides = get_model_overrides(),
        resolved = resolved,
        resolved_key = resolved_key,
    )


def _bare_model_id(model_id: str) -> Optional[str]:
    """``repo`` for a ``repo:QUANT`` key, or None when there is no quant suffix."""
    from utils.openai_auto_switch_settings import split_quant_suffix

    # Must look like a quant, not a short path segment; a bpw modifier and stem label both count.
    split = split_quant_suffix(model_id)
    return split[0] if split is not None else None


def _fallback_supplies_extra_args(model_id: str, target_id: str) -> bool:
    """Whether a load for this model would still pick flags off another entry.

    The carry-over copies a legacy bare ``repo`` row's flags onto the first
    ``repo:QUANT`` save and leaves the bare row in place, and a load reads the
    qualified key first and the bare one after it. So clearing the box for the quant
    is only a clear while the quant keeps a row of its own: an all-default save
    stores nothing, and the next load falls through to a row no page can show.

    Answered rather than repaired. Stripping the flags off the bare row was the first
    fix and it is too broad: that row is the fallback for every quant that has no row,
    so forgetting Q4's flags took Q6's with them, and it did nothing at all when a
    sibling quant had a row of its own.
    """
    from utils.openai_auto_switch_settings import get_model_override

    for candidate in (
        _bare_model_id(model_id),
        _legacy_standalone_gguf_key(model_id),
    ):
        if (
            candidate
            and candidate != target_id
            and get_model_override(candidate).get("llama_extra_args")
        ):
            return True
    return False


def _other_quants_remain(bare_id: str, removed_ids: list[str]) -> bool:
    """Whether a quant of ``bare_id`` other than the ones being removed still has an entry.

    Such a quant has its own settings and never reads the bare fallback, so this is not
    "is anyone inheriting" but "is this forget the last one for the model". If it is not,
    the bare entry stays: an inheriting quant is exactly what it is there for.
    """
    from utils.openai_auto_switch_settings import split_quant_suffix

    removed = {key.strip().lower() for key in removed_ids}
    prefix = bare_id.strip().lower()
    for key, entry in get_model_overrides().items():
        if not isinstance(entry, dict) or key.strip().lower() in removed:
            continue
        split = split_quant_suffix(key)
        if split is not None and split[0].strip().lower() == prefix:
            return True
    return False


def _legacy_standalone_gguf_key(model_id: str) -> Optional[str]:
    """The stored ``<path>:LABEL`` entry for a bare standalone .gguf path, if any.

    A loose file has no quant to choose between, so it is keyed by the bare path,
    but the label derived from its filename is never empty and that is how the
    picker keyed the same file before, so an upgraded install carries entries
    under it. The auto-switch loader reads that spelling after the bare path
    misses; resolve_model_override_key does not, since folding a POSIX path only
    touches an existing suffix. None for an id that already names a quant, for a
    repo id, and when nothing is stored under the derived key.
    """
    import os

    if not model_id.lower().endswith(".gguf"):
        return None
    # Already qualified, so the caller named the entry it meant, as the loader does.
    if _bare_model_id(model_id) is not None:
        return None
    from hub.utils.gguf import extract_quant_label

    label = extract_quant_label(os.path.basename(model_id))
    if not label:
        return None
    # Through the resolver: the browser lowercases the variant, and an ambiguous fold misses.
    return resolve_model_override_key(f"{model_id}:{label}")


def _fill_target_id(target_id: str) -> str:
    """Where a one-time backfill write for ``target_id`` has to land.

    A fill only adds, so unlike a save it cannot retire the other spelling of a cached
    repo. Creating the snapshot-path key while the server already holds the repo id
    would leave two entries for one quant, and the loader reads the load path before the
    advertised id, so an upgraded browser's pre-upgrade copy would shadow the newer
    server config on every API load. Fill into the entry already there instead: nothing
    outranks it, and the fields it lacks still arrive.

    Only in that direction. A repo-id key never outranks an existing path entry, and two
    snapshot paths name two caches, neither of which is knowably the one loaded here.
    """
    from core.inference.model_ids import hf_cache_repo_id
    from utils.openai_auto_switch_settings import split_quant_suffix

    # Already stored, so this write creates no second key to outrank anything.
    if isinstance(get_model_overrides().get(target_id), dict):
        return target_id
    split = split_quant_suffix(target_id)
    # A bare id backs every quant and is read last, and only a cache path outranks.
    if split is None or hf_cache_repo_id(split[0]) is None:
        return target_id
    for alias_id in cached_repo_alias_keys(target_id):
        alias_split = split_quant_suffix(alias_id)
        if alias_split is not None and hf_cache_repo_id(alias_split[0]) is None:
            return alias_id
    return target_id


# One override write at a time. A save stores its target key and then reads the map back to
# retire the other spelling of the same cached repo, and a remove clears up to four keys, each
# its own transaction: atomic on their own, but not as a sequence. This route is a plain `def`,
# so FastAPI runs it in a threadpool, and two clients saving one quant under both spellings (the
# repo id the picker sends and the snapshot path an upgraded install still holds) could each
# write before either cleanup ran and then retire the other's row, leaving no override at all
# from two saves that both returned 200. Serialize the whole handler instead: overrides are
# written by a settings edit, never on a hot path, and the server runs one process.
_override_write_lock = threading.Lock()


def _serialized_override_write(func):
    """Run ``func`` under _override_write_lock, keeping the handler body as it reads.

    functools.wraps carries __wrapped__, which inspect.signature follows, so FastAPI still
    sees the endpoint's own parameters and dependencies.
    """

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        with _override_write_lock:
            return func(*args, **kwargs)

    return wrapper


@router.put("/openai-auto-switch/overrides", response_model = ModelOverridesResponse)
@_serialized_override_write
def update_openai_auto_switch_override(
    payload: ModelOverridePayload, current_subject: str = Depends(get_current_subject)
) -> ModelOverridesResponse:
    from core.inference.llama_server_args import drop_managed_flags, validate_extra_args
    from utils.openai_auto_switch_settings import get_model_override

    try:
        if payload.fill_absent_fields and payload.remove is True:
            # A fill that is also a delete has no meaning; picking one loses or resurrects.
            raise ValueError("fill_absent_fields cannot be combined with remove.")
        # Only model_id is the documented "remove"; otherwise omitted flags carry over.
        requested_extra_args = payload.llama_extra_args
        # fill_absent_fields is a write mode, not a saved field: leaving it in would make
        # every payload look non-empty and break the legacy "no fields means remove".
        saved_fields = payload.model_dump(
            exclude = {"model_id", "llama_extra_args", "remove", "fill_absent_fields"},
            exclude_none = True,
        )
        if payload.remove is not None:
            is_removal = payload.remove
        else:
            is_removal = not payload.tensor_parallel and not {
                key: value for key, value in saved_fields.items() if key != "tensor_parallel"
            }
        if requested_extra_args is None and not is_removal:
            stored = get_model_override(payload.model_id)
            # A fill keeps the stored flags without echoing them back through validation: one
            # denylisted since it was saved would 400 the migration, which then retries forever.
            if not (payload.fill_absent_fields and stored):
                requested_extra_args = stored.get("llama_extra_args")
                if requested_extra_args is None:
                    # First per-quant save for flags under the bare repo id; carry them over.
                    bare_id = _bare_model_id(payload.model_id)
                    if bare_id:
                        requested_extra_args = get_model_override(bare_id).get("llama_extra_args")
                if requested_extra_args is None:
                    # And for a standalone .gguf upgraded from the build that keyed it by its
                    # filename label: the bare path written here is read before that key, so
                    # its flags would go dark with no page able to show or restore them.
                    legacy_id = _legacy_standalone_gguf_key(payload.model_id)
                    if legacy_id:
                        requested_extra_args = get_model_override(legacy_id).get("llama_extra_args")
                if requested_extra_args is None:
                    # Same for the other spelling of a cached repo, which this save retires
                    # below: its flags have nowhere else to live, and the page cannot show them.
                    for alias_id in cached_repo_alias_keys(payload.model_id):
                        requested_extra_args = get_model_override(alias_id).get("llama_extra_args")
                        if requested_extra_args is not None:
                            break
        # Not validated on an explicit remove: a 400 would only leave the override in place.
        if payload.remove is True:
            extra_args = []
        elif payload.llama_extra_args is None:
            # Carried over, not sent: the caller is saving some other field and this
            # value predates the request. A flag denylisted since it was written is
            # dropped rather than refused, or an unrelated save fails naming a flag
            # the user may not remember writing (and cannot fix from this payload).
            extra_args, dropped_flags = drop_managed_flags(requested_extra_args)
            if dropped_flags:
                logger.warning(
                    "model_override.dropped_managed_flags model_id=%s flags=%s",
                    payload.model_id,
                    ", ".join(dropped_flags),
                )
        else:
            extra_args = validate_extra_args(requested_extra_args)
        if payload.remove is True:
            # An explicit remove wins over any other field. Remove the key a load resolves to,
            # not the literal one sent (the browser normalizes casing), and every spelling:
            # clearing one of two leaves the survivor as the sole fold match.
            target_ids = resolve_model_override_keys(payload.model_id) or [
                payload.model_id,
            ]
            for target_id in target_ids:
                set_model_override(target_id, llama_extra_args = [], max_seq_length = None)
            # A standalone .gguf is keyed by its bare path now, but a load also reads the
            # filename-derived <path>:LABEL an upgraded install holds, which would outlive this.
            legacy_id = _legacy_standalone_gguf_key(payload.model_id)
            if legacy_id and legacy_id not in target_ids:
                set_model_override(
                    legacy_id,
                    llama_extra_args = [],
                    max_seq_length = None,
                )
            # The mirror image of the carry-over above: a save under repo:QUANT copies the
            # flags off a legacy bare `repo` entry and leaves it in place, and the loader falls
            # back to it when the qualified key misses, so clearing only the qualified key hands
            # the same flags straight back and the forget does nothing. Nothing in the UI can
            # reach that bare entry. Only once it is nobody else's fallback, though: it backs
            # every quant with no entry of its own, so forgetting Q4 must not strip Q8.
            bare_id = _bare_model_id(payload.model_id)
            if (
                bare_id
                and bare_id not in target_ids
                and not _other_quants_remain(
                    bare_id,
                    target_ids,
                )
            ):
                set_model_override(
                    bare_id,
                    llama_extra_args = [],
                    max_seq_length = None,
                )
            # And the other spelling of a cached repo: the loader reads the load path before
            # the advertised id, so clearing only the id leaves the path entry still applying.
            for alias_id in cached_repo_alias_keys(payload.model_id):
                set_model_override(alias_id, llama_extra_args = [], max_seq_length = None)
        else:
            # Save under the key a load resolves to, as the removal branch does: the literal
            # id would leave two keys for one model, making every other casing ambiguous.
            target_id = resolve_model_override_key(payload.model_id) or payload.model_id
            if payload.fill_absent_fields:
                # A fill retires nothing below, so it must not create the higher-priority
                # spelling of a row the server already holds.
                target_id = _fill_target_id(target_id)
            # An explicit clear keeps a row even when nothing else is set, so long as a
            # fallback would otherwise answer for this model: "no launch flags" and
            # "nothing stored" are the same thing everywhere else, and different here.
            # Written on the quant's own key, so no other quant is touched.
            keep_empty = (
                payload.llama_extra_args == []
                and not payload.fill_absent_fields
                and _fallback_supplies_extra_args(payload.model_id, target_id)
            )
            set_model_override(
                target_id,
                llama_extra_args = extra_args,
                keep_empty_extra_args = keep_empty,
                max_seq_length = payload.max_seq_length,
                custom_context_length = payload.custom_context_length,
                kv_cache_dtype = payload.kv_cache_dtype,
                mlx_kv_bits = payload.mlx_kv_bits,
                speculative_type = payload.speculative_type,
                spec_draft_n_max = payload.spec_draft_n_max,
                n_parallel = payload.n_parallel,
                n_batch = payload.n_batch,
                n_ubatch = payload.n_ubatch,
                tensor_parallel = payload.tensor_parallel,
                chat_template_override = payload.chat_template_override,
                gpu_memory_mode = payload.gpu_memory_mode,
                gpu_layers = payload.gpu_layers,
                n_cpu_moe = payload.n_cpu_moe,
                gpu_ids = payload.gpu_ids,
                fill_absent_fields = payload.fill_absent_fields,
            )
            # A repo cached outside the active HF cache is keyed here by its repo id, while the
            # loader reads the snapshot path first and an older release keyed the row by that
            # path, so an upgrade can hold both. Retire the spelling this save supersedes (its
            # flags were carried over above), or the leftover outranks the key just written.
            # After the write, so a rejected save deletes nothing. Not on a fill: that pass only
            # adds, and the migration mirroring both spellings must not delete either.
            if not payload.fill_absent_fields:
                for alias_id in cached_repo_alias_keys(target_id):
                    set_model_override(alias_id, llama_extra_args = [], max_seq_length = None)
    except ValueError as exc:
        raise log_and_http_error(
            exc,
            400,
            safe_error_detail(exc, fallback = "Invalid model launch override."),
            event = "settings.update_model_override_failed",
            log = logger,
        ) from exc
    return ModelOverridesResponse(overrides = get_model_overrides())

def _embedding_model_response() -> EmbeddingModelResponse:
    return EmbeddingModelResponse(
        embedding_model = get_rag_embedding_model(),
        embedding_gguf_repo = effective_gguf_repo(),
        default_embedding_model = default_embedding_model(),
        default_embedding_gguf_repo = default_gguf_repo(),
        is_custom = get_stored_embedding_model() is not None,
    )


def _ambient_hf_token() -> Optional[str]:
    """The HF token the loader would use (HF_TOKEN env or the cached login), so a gated
    repo is scanned rather than failing open. None if unavailable."""
    try:
        from huggingface_hub import get_token
        return get_token()
    except Exception:
        return None


def _llama_backend_active() -> bool:
    """True when this install actually embeds via the llama-server (GGUF) backend.

    Delegates to the embeddings module so a runtime fallback from
    sentence-transformers to llama-server (after a torch/CUDA load or encode
    failure) is honored: in that state the process loads only inert GGUF, so the
    ST pickle gate below must not hard-block a repo whose GGUF companion is clean.
    Before any backend is built this still reflects the resolver."""
    from core.rag import embeddings
    try:
        return embeddings.active_backend_is_llama()
    except Exception:  # noqa: BLE001 - backend probe must never block saving
        return False


def _resolves_as_local_gguf(model: str) -> bool:
    """True when ``model`` is a local .gguf file or a directory holding one, so
    a save on the llama-server backend needs no HF verification (the artifact
    itself is the proof)."""
    from core.rag.embed_llama_server import LlamaServerBackend
    try:
        return LlamaServerBackend._resolve_local_gguf(model) is not None
    except Exception:  # noqa: BLE001 - dir without .gguf, filesystem oddity
        return False


def _local_gguf_backend_error(model: str) -> str | None:
    """409 detail when ``model`` is a local dir without a .gguf but this install
    embeds via llama-server (macOS/CPU default), which needs one. A
    sentence-transformers-only folder would verify fine yet fail at first index.
    None when not applicable. ``force`` skips this check like HF verification."""
    from pathlib import Path

    if not Path(model).expanduser().is_dir():
        return None
    from core.rag.embed_llama_server import LlamaServerBackend

    if not _llama_backend_active():
        return None
    try:
        LlamaServerBackend._resolve_local_gguf(model)
        return None
    except RuntimeError:
        return (
            f"{model!r} contains no .gguf file, but this install embeds with the "
            "llama-server backend which requires one. Add a GGUF file to the "
            "folder or use a Hugging Face repo."
        )
    except Exception:  # noqa: BLE001 - filesystem oddity: don't block saving
        return None


def _hf_gguf_backend_error(model: str, hf_token: Optional[str]) -> str | None:
    """409 detail when the llama-server backend would find no .gguf for an HF
    repo: neither the derived companion repo nor the repo itself has one. Saves
    that verify as embedding models would otherwise fail at first index.
    None when not applicable; ``force`` skips this like HF verification."""
    from pathlib import Path

    if Path(model).expanduser().exists():
        return None  # local paths are handled by the local checks
    if not _llama_backend_active():
        return None
    from core.rag import config as rag_config

    candidates = [model] if rag_config._names_gguf(model) else [f"{model}-GGUF", model]
    try:
        from huggingface_hub import list_repo_files
    except Exception:  # noqa: BLE001 - hub client unavailable: don't block saving
        return None
    for candidate in candidates:
        try:
            files = list_repo_files(candidate, token = hf_token)
        except Exception:  # noqa: BLE001 - missing/gated repo: try next candidate
            continue
        if any(f.lower().endswith(".gguf") and "mmproj" not in f.lower() for f in files):
            return None
    checked = " or ".join(repr(c) for c in candidates)
    return (
        f"No GGUF weights found in {checked}, but this install embeds with the "
        "llama-server backend which requires them. Pick a model with a GGUF "
        "companion repo or GGUF files in the repo itself."
    )


@router.get("/embedding-model", response_model = EmbeddingModelResponse)
def get_embedding_model(
    current_subject: str = Depends(get_current_subject),
) -> EmbeddingModelResponse:
    return _embedding_model_response()


@router.put("/embedding-model", response_model = EmbeddingModelResponse)
def update_embedding_model(
    payload: EmbeddingModelPayload, current_subject: str = Depends(get_current_subject)
) -> EmbeddingModelResponse:
    """Set the RAG embedding model. Unless ``force`` is set, the repo is verified
    to be an embedding model via HF metadata; an unverifiable model (wrong type,
    typo, gated repo, or no network) returns 409 so the UI can offer "save anyway".
    A repo flagged unsafe by HF's security scan returns 403 instead: a hard block
    that ``force`` cannot bypass, so the UI must not offer "save anyway".
    Documents indexed under the previous model must be re-uploaded."""
    from utils.models import is_embedding_model

    try:
        model = validate_embedding_model(payload.embedding_model)
    except ValueError as exc:
        raise log_and_http_error(
            exc,
            400,
            safe_error_detail(exc, fallback = "Invalid embedding model."),
            event = "settings.update_embedding_model_failed",
            log = logger,
        ) from exc
    hf_token = (payload.hf_token or "").strip() or None
    from utils.utils import hf_env_offline

    # Offline, both the Hub malware scan and the is-embedding check are unreachable and degrade
    # to the local cache below; capture the state once.
    local_only_load = hf_env_offline()
    # The env/default model needs no verification; saving it is a no-op override.
    # A local GGUF on the llama-server backend is accepted as-is: it is exactly
    # what the backend loads, and HF metadata cannot verify a local path.
    is_local_gguf = _llama_backend_active() and _resolves_as_local_gguf(model)
    # The pickle gate only matters for the sentence-transformers backend, which is what
    # deserializes pickles. On the llama-server backend the embedder loads GGUF files
    # (inert) from effective_gguf_repo(), so scanning the ST repo's pickle here would
    # wrongly reject a custom repo whose GGUF companion is clean; the GGUF availability
    # checks below cover that path instead.
    scan_st_pickle = (
        model != default_embedding_model() and not is_local_gguf and not _llama_backend_active()
    )
    if scan_st_pickle:
        # Malware/pickle gate before we persist a repo the embedder later loads with
        # SentenceTransformer. Runs even under force (force only skips the is-embedding
        # type check for offline/local repos HF cannot verify); local paths and
        # unreachable scans fail open inside evaluate_file_security.
        from utils.security import evaluate_file_security, security_load_subdirs
        from core.rag.embeddings import _st_module_subdirs

        # Fall back to the loader's own token so a gated/private repo is actually scanned
        # (a token-less scan fails open for exactly the repo that would still load).
        scan_token = hf_token or _ambient_hf_token()
        # Offline: subdir probes would hit the network and hang; the offline gate walks the
        # whole cached snapshot, so no load-subdir hints are needed.
        if local_only_load:
            load_subdirs = ()
        else:
            # Include ST module dirs (0_Transformer/) so a flagged pickle directly under one
            # blocks instead of passing as an unreferenced nested shard.
            load_subdirs = tuple(
                dict.fromkeys(
                    (
                        *security_load_subdirs(model, scan_token),
                        *_st_module_subdirs(model, scan_token),
                    )
                )
            )
        if evaluate_file_security(
            model,
            hf_token = scan_token,
            load_subdirs = load_subdirs,
            local_only_load = local_only_load,
        ).blocked:
            # 403, not 409: the client routes every 409 into the forceable "save anyway"
            # flow, but this block is a hard, non-forceable security refusal.
            if local_only_load:
                detail = (
                    f"{model!r} has cached pickle weights that cannot be security-scanned "
                    "offline and no safetensors alternative, so it cannot be used as the "
                    "embedding model. Re-download it with safetensors weights while online."
                )
            else:
                detail = (
                    f"{model!r} is flagged as unsafe by Hugging Face's security scan and "
                    "cannot be used as the embedding model."
                )
            raise HTTPException(status_code = 403, detail = detail)
    if model != default_embedding_model() and not payload.force and not is_local_gguf:
        from core.rag import config as rag_config

        # A GGUF-named repo on the llama-server backend is loaded from its .gguf
        # files, which rarely carry sentence-transformers metadata; verify the
        # GGUF is available (below) rather than the ST embedding-metadata gate,
        # which would wrongly 409 a valid online GGUF embedder.
        gguf_named = _llama_backend_active() and rag_config._names_gguf(model)
        if not gguf_named and not is_embedding_model(model, hf_token = hf_token):
            # Offline, is_embedding_model can only confirm the ST layout (modules.json); a
            # transformers-native embedder (e.g. gte-modernbert) is unverifiable without Hub
            # metadata. If already cached and loadable, accept it rather than raising a 409 that
            # online would not (ST can load any cached encoder). Uncached -> 409.
            from utils.utils import hf_cache_snapshot_is_loadable

            # Require a genuinely loadable cache (config + weights), not just a resolved refs/main,
            # so a metadata-only partial cache still gets the forceable 409.
            offline_cached = local_only_load and hf_cache_snapshot_is_loadable(model)
            if not offline_cached:
                raise HTTPException(
                    status_code = 409,
                    detail = (
                        f"Could not verify {model!r} as an embedding model on "
                        "Hugging Face (it may be the wrong model type, gated, or "
                        "you may be offline)."
                    ),
                )
        # The Hub GGUF probe (list_repo_files) can hang offline; skip it. Local check stays.
        gguf_error = _local_gguf_backend_error(model)
        if gguf_error is None and not local_only_load:
            gguf_error = _hf_gguf_backend_error(model, hf_token)
        if gguf_error:
            raise HTTPException(status_code = 409, detail = gguf_error)
    set_rag_embedding_model(model)
    logger.info(
        "settings.embedding_model_updated subject=%s model=%s forced=%s",
        current_subject,
        model,
        payload.force,
    )
    return _embedding_model_response()


@router.delete("/embedding-model", response_model = EmbeddingModelResponse)
def reset_embedding_model(
    current_subject: str = Depends(get_current_subject),
) -> EmbeddingModelResponse:
    """Clear the override, returning to the env/default model."""
    reset_rag_embedding_model()
    logger.info("settings.embedding_model_reset subject=%s", current_subject)
    return _embedding_model_response()
