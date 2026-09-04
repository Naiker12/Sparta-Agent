"""Hardware, storage, memory, VRAM budget and cache settings."""

import functools
import hashlib
import threading
import time
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from loggers import get_logger

from auth.authentication import (
    authenticated_via_api_key,
    get_current_credential,
    get_current_subject,
)
from storage import credential_secrets
from routes.provider_credentials import current_credential_write, require_ui_session
from utils.utils import safe_error_detail, log_and_http_error
from utils.upload_limits import (
    default_upload_limit_mb,
    get_upload_limit_mb,
    set_upload_limit_mb,
    upload_limit_bytes,
    upload_limit_label,
)
from utils.helper_precache_settings import (
    DEFAULT_HELPER_PRECACHE_ENABLED,
    get_helper_precache_enabled,
    helper_model_disabled_by_env,
    set_helper_precache_enabled,
)
from utils.model_memory_settings import (
    DEFAULT_KEEP_RESIDENT,
    DEFAULT_NO_RAM_RESERVE,
    get_model_memory_settings,
    memlock_limit_bytes,
    set_model_memory_settings,
    should_mlock,
)
from utils.vram_budget_settings import (
    VRAM_FRACTION_DEFAULT,
    VRAM_FRACTION_MAX,
    VRAM_FRACTION_MIN,
    get_vram_budget_state,
    set_vram_budget_fraction,
)
from utils.hf_cache_settings import cache_status, get_hf_cache_paths, set_hf_cache_home
from utils.llama_cpp_path_settings import (
    custom_llama_cpp_path_status,
    set_custom_llama_cpp_path,
)
from routes.settings_pkg.schemas import (
    UploadLimitPayload,
    UploadLimitResponse,
    HuggingFaceTokenPayload,
    HuggingFaceTokenResponse,
    HelperPrecachePayload,
    HelperPrecacheResponse,
    ModelMemoryPayload,
    ModelMemoryResponse,
    VramBudgetPayload,
    VramBudgetResponse,
    HuggingFaceCachePayload,
    HuggingFaceCacheResponse,
    LlamaCppPathPayload,
    LlamaCppPathResponse,
    LastLocalModelPayload,
    LastLocalModelResponse,
    _LAST_LOCAL_MODEL_CLOCK_SLACK_MS,
)

router = APIRouter()
logger = get_logger(__name__)

@router.get("/hugging-face-token", response_model = HuggingFaceTokenResponse)
def get_hugging_face_token(
    _current_subject: str = Depends(get_current_subject),
    via_api_key: bool = Depends(authenticated_via_api_key),
) -> HuggingFaceTokenResponse:
    require_ui_session(via_api_key)
    token = credential_secrets.get_hf_token()
    return HuggingFaceTokenResponse(token = token, has_token = token is not None)


@router.put("/hugging-face-token", response_model = HuggingFaceTokenResponse)
def update_hugging_face_token(
    payload: HuggingFaceTokenPayload,
    credential: tuple = Depends(get_current_credential),
    via_api_key: bool = Depends(authenticated_via_api_key),
) -> HuggingFaceTokenResponse:
    require_ui_session(via_api_key)

    # Warm the auth-owned key before the generation guard takes its write lock.
    credential_secrets.get_or_create_credential_encryption_key()
    with current_credential_write(credential):
        credential_secrets.save_hf_token(payload.token)
    return HuggingFaceTokenResponse(token = payload.token, has_token = True)


@router.put("/hugging-face-token/migrate", response_model = HuggingFaceTokenResponse)
def migrate_hugging_face_token(
    payload: HuggingFaceTokenPayload,
    credential: tuple = Depends(get_current_credential),
    via_api_key: bool = Depends(authenticated_via_api_key),
) -> HuggingFaceTokenResponse:
    """Insert a browser legacy token only when the installation has none."""
    require_ui_session(via_api_key)
    credential_secrets.get_or_create_credential_encryption_key()
    with current_credential_write(credential):
        credential_secrets.save_hf_token_if_absent(payload.token)
        token = credential_secrets.get_hf_token()
    return HuggingFaceTokenResponse(token = token, has_token = token is not None)


@router.delete("/hugging-face-token", response_model = HuggingFaceTokenResponse)
def clear_hugging_face_token(
    credential: tuple = Depends(get_current_credential),
    via_api_key: bool = Depends(authenticated_via_api_key),
) -> HuggingFaceTokenResponse:
    require_ui_session(via_api_key)
    with current_credential_write(credential):
        credential_secrets.delete_hf_token()
    return HuggingFaceTokenResponse(token = None, has_token = False)


def _upload_limit_response(limit_mb: int) -> UploadLimitResponse:
    return UploadLimitResponse(
        max_upload_size_mb = limit_mb,
        max_upload_size_bytes = upload_limit_bytes(limit_mb),
        max_upload_size_label = upload_limit_label(limit_mb),
        default_upload_size_mb = default_upload_limit_mb(),
    )


def _helper_precache_response(enabled: bool | None = None) -> HelperPrecacheResponse:
    return HelperPrecacheResponse(
        enabled = get_helper_precache_enabled() if enabled is None else enabled,
        disabled_by_env = helper_model_disabled_by_env(),
    )


# Distinct from None, which is a real launch this policy does not govern.
_NO_LAUNCH = object()


def _active_launch_placement():
    """``(state, policy_active, mlock_applicable)`` for the running child.

    ``state`` is ``_NO_LAUNCH`` when nothing is running or coming up, so the
    caller can tell "no process" apart from "a process with no load-mode".
    """
    try:
        from routes.inference import get_llama_cpp_backend

        backend = get_llama_cpp_backend()
        pending = bool(getattr(backend, "_memory_launch_pending", False))
        if not backend.is_active and not pending:
            return _NO_LAUNCH, False, True
        return (
            getattr(backend, "_memory_state", None),
            bool(getattr(backend, "_memory_policy_active", False)),
            bool(getattr(backend, "_memory_mlock_applicable", True)),
        )
    except Exception:
        return _NO_LAUNCH, False, True


def _model_memory_reload_required() -> bool:
    """True when the loaded process's memory placement contradicts the settings.

    Compares the state the child ACTUALLY launched with -- env defaults plus
    last-wins argv, so a user-supplied --mlock / --no-mmap counts -- against
    what the current settings would produce. The idle-unload veto applies
    immediately (the loop re-reads each poll), so only placement can be stale.

    Keyed on is_active, not is_loaded: a save that lands while a load is still
    passing its health check would otherwise report no reload while the child is
    already committed to the pre-save flags. _memory_launch_pending covers the
    same window before Popen, where the placement is decided but _process is
    still None.
    """
    state, policy_active, mlock_applicable = _active_launch_placement()
    if state is _NO_LAUNCH:
        return False

    # Same predicate the duplicate-load comparator uses, so the reload hint and
    # the reload path can never disagree.
    from core.inference.llama_server_args import memory_state_satisfies_settings

    return not memory_state_satisfies_settings(state, policy_active, mlock_applicable)


def _model_memory_mlock_active(want_mlock: bool) -> bool:
    """Whether page-locking is actually in force, not merely asked for.

    This drives the locked-memory cap warning, so taking it from the toggles
    alone would tell a discrete-GPU user to raise a limit nothing consults.
    With nothing running this is the intent, so the UI reflects the toggle. Once
    a child exists it is what that child got: a full offload to a discrete GPU
    skips the lock, and a diffusion runner has no load-mode at all, so claiming
    otherwise would warn about ulimit -l for a lock nobody took. A user's own
    --mlock counts, since the resolver reads the launched argv.
    """
    if not want_mlock:
        return False
    state, _policy_active, _applicable = _active_launch_placement()
    if state is _NO_LAUNCH:
        return True
    return bool(state and state[0])


def _model_memory_response() -> ModelMemoryResponse:
    keep_resident, no_ram_reserve = get_model_memory_settings()
    mlock_active = _model_memory_mlock_active(should_mlock())
    return ModelMemoryResponse(
        keep_resident = keep_resident,
        no_ram_reserve = no_ram_reserve,
        mlock_active = mlock_active,
        reload_required = _model_memory_reload_required(),
        memlock_limit_bytes = memlock_limit_bytes() if mlock_active else None,
    )


def _vram_budget_reload_required(fraction: float) -> bool:
    """True when a child is running that was sized against a different budget.

    Compares against the fraction the child actually launched with, not merely
    "is something loaded", so re-saving the same value does not nag for a reload.
    Exact equality is fine: both sides come from the same clamp, so a stored 0.97
    and a launched 0.97 are the same float.
    """
    try:
        from routes.inference import get_llama_cpp_backend

        backend = get_llama_cpp_backend()
        # A planned-but-unspawned load has no _process, so is_active is False while
        # the child is already committed to its captured fraction; answer from the
        # pending value there, as _active_launch_placement does for Model Memory.
        pending = getattr(backend, "_vram_fraction_pending", None)
        if pending is not None:
            return float(pending) != float(fraction)
        if not backend.is_active:
            return False
        launched = getattr(backend, "_vram_fraction_launched", None)
        # A child predating this field, or from a path that never set it, cannot be
        # compared; say no rather than nagging on every save.
        if launched is None:
            return False
        return float(launched) != float(fraction)
    except Exception:
        return False


def _vram_budget_response() -> VramBudgetResponse:
    fraction, is_stored = get_vram_budget_state()
    return VramBudgetResponse(
        fraction = fraction,
        is_stored = is_stored,
        reload_required = _vram_budget_reload_required(fraction),
    )


def _hugging_face_cache_response() -> HuggingFaceCacheResponse:
    return HuggingFaceCacheResponse(**cache_status(get_hf_cache_paths()))


def _llama_cpp_path_reload_required() -> bool:
    """Whether a running or pending GGUF server predates the path selection."""
    try:
        from routes.inference import get_llama_cpp_backend

        backend = get_llama_cpp_backend()
        pending = getattr(backend, "_binary_revision_pending", None)
        if pending is not None:
            return backend._binary_changed_since_revision(pending)
        return bool(backend.is_active and backend._binary_changed_since_launch())
    except Exception:
        return False


def _llama_cpp_path_response() -> LlamaCppPathResponse:
    return LlamaCppPathResponse(
        **custom_llama_cpp_path_status(),
        reload_required = _llama_cpp_path_reload_required(),
    )


@router.get("/hugging-face-cache", response_model = HuggingFaceCacheResponse)
def get_hugging_face_cache(
    current_subject: str = Depends(get_current_subject),
) -> HuggingFaceCacheResponse:
    return _hugging_face_cache_response()


@router.put("/hugging-face-cache", response_model = HuggingFaceCacheResponse)
def update_hugging_face_cache(
    payload: HuggingFaceCachePayload, current_subject: str = Depends(get_current_subject)
) -> HuggingFaceCacheResponse:
    try:
        set_hf_cache_home(payload.cache_home)
    except RuntimeError as exc:
        raise HTTPException(status_code = 409, detail = str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code = 400, detail = str(exc)) from exc
    return _hugging_face_cache_response()


@router.get("/llama-cpp-path", response_model = LlamaCppPathResponse)
def get_llama_cpp_path(current_subject: str = Depends(get_current_subject)) -> LlamaCppPathResponse:
    return _llama_cpp_path_response()


@router.put("/llama-cpp-path", response_model = LlamaCppPathResponse)
def update_llama_cpp_path(
    payload: LlamaCppPathPayload,
    current_subject: str = Depends(get_current_subject),
    via_api_key: bool = Depends(authenticated_via_api_key),
) -> LlamaCppPathResponse:
    # Only the interactive Studio UI may change this executable setting.
    require_ui_session(via_api_key)
    try:
        set_custom_llama_cpp_path(payload.path)
    except RuntimeError as exc:
        raise HTTPException(status_code = 409, detail = str(exc)) from exc
    except ValueError as exc:
        raise log_and_http_error(
            exc,
            400,
            # Validator messages are safe to expose to the UI.
            str(exc),
            event = "settings.update_llama_cpp_path_failed",
            log = logger,
        ) from exc
    return _llama_cpp_path_response()


@router.get("/upload-limit", response_model = UploadLimitResponse)
def get_upload_limit(current_subject: str = Depends(get_current_subject)) -> UploadLimitResponse:
    return _upload_limit_response(get_upload_limit_mb())


@router.put("/upload-limit", response_model = UploadLimitResponse)
def update_upload_limit(
    payload: UploadLimitPayload, current_subject: str = Depends(get_current_subject)
) -> UploadLimitResponse:
    try:
        limit_mb = set_upload_limit_mb(payload.max_upload_size_mb)
    except ValueError as exc:
        raise log_and_http_error(
            exc,
            400,
            safe_error_detail(exc, fallback = "Invalid upload limit."),
            event = "settings.update_upload_limit_failed",
            log = logger,
        ) from exc
    return _upload_limit_response(limit_mb)


@router.get("/helper-precache", response_model = HelperPrecacheResponse)
def get_helper_precache(
    current_subject: str = Depends(get_current_subject),
) -> HelperPrecacheResponse:
    return _helper_precache_response()


@router.put("/helper-precache", response_model = HelperPrecacheResponse)
def update_helper_precache(
    payload: HelperPrecachePayload, current_subject: str = Depends(get_current_subject)
) -> HelperPrecacheResponse:
    try:
        enabled = set_helper_precache_enabled(payload.enabled)
    except ValueError as exc:
        raise log_and_http_error(
            exc,
            400,
            safe_error_detail(exc, fallback = "Invalid Helper LLM pre-cache setting."),
            event = "settings.update_helper_precache_failed",
            log = logger,
        ) from exc
    return _helper_precache_response(enabled)


@router.get("/model-memory", response_model = ModelMemoryResponse)
def get_model_memory(current_subject: str = Depends(get_current_subject)) -> ModelMemoryResponse:
    return _model_memory_response()


@router.put("/model-memory", response_model = ModelMemoryResponse)
def update_model_memory(
    payload: ModelMemoryPayload, current_subject: str = Depends(get_current_subject)
) -> ModelMemoryResponse:
    try:
        set_model_memory_settings(
            keep_resident = payload.keep_resident,
            no_ram_reserve = payload.no_ram_reserve,
        )
    except ValueError as exc:
        raise log_and_http_error(
            exc,
            400,
            safe_error_detail(exc, fallback = "Invalid model memory setting."),
            event = "settings.update_model_memory_failed",
            log = logger,
        ) from exc
    return _model_memory_response()


LAST_LOCAL_MODEL_SETTING_KEY = "last_local_model_load"
_LAST_LOCAL_MODEL_LOCK = threading.Lock()


def _last_local_model_key(subject: str) -> str:
    """Per-subject key: one shared row would hand user B user A's last model."""
    subject = (subject or "").strip()
    if not subject:
        return LAST_LOCAL_MODEL_SETTING_KEY
    # Hashed so an arbitrary subject cannot collide with another key.
    digest = hashlib.sha256(subject.encode("utf-8")).hexdigest()[:32]
    return f"{LAST_LOCAL_MODEL_SETTING_KEY}:{digest}"


def _read_last_local_model(subject: str) -> "dict | None":
    """The subject's record, falling back to the pre-scoping shared row so an
    upgrade keeps the model the install already remembered."""
    from storage.studio_db import get_app_setting

    stored = get_app_setting(_last_local_model_key(subject), None)
    if not isinstance(stored, dict):
        stored = get_app_setting(LAST_LOCAL_MODEL_SETTING_KEY, None)
    return stored if isinstance(stored, dict) else None

@router.get("/last-local-model", response_model = LastLocalModelResponse)
def get_last_local_model(
    current_subject: str = Depends(get_current_subject),
) -> LastLocalModelResponse:
    stored = _read_last_local_model(current_subject)
    _now = int(time.time() * 1000)
    if stored is None:
        return LastLocalModelResponse(server_now = _now)
    try:
        payload = LastLocalModelPayload(**stored)
    except Exception:
        return LastLocalModelResponse(server_now = _now)
    return LastLocalModelResponse(**payload.model_dump(exclude = {"client_now"}), server_now = _now)


@router.put("/last-local-model", response_model = LastLocalModelResponse)
def update_last_local_model(
    payload: LastLocalModelPayload, current_subject: str = Depends(get_current_subject)
) -> LastLocalModelResponse:
    from storage.studio_db import upsert_app_settings

    # loaded_at orders stamped writes so a delayed older PUT cannot overwrite a newer
    # load; the stored record is returned. Unstamped writes stay last-write-wins.
    _server_now = int(time.time() * 1000)
    _key = _last_local_model_key(current_subject)
    with _LAST_LOCAL_MODEL_LOCK:
        if payload.loaded_at is not None:
            if payload.client_now is not None:
                # Into the server frame: fresh loads land near now, re-issued shadows stay old.
                _shifted = payload.loaded_at + (_server_now - payload.client_now)
                payload = payload.model_copy(update = {"loaded_at": max(0, _shifted)})
            _cap = _server_now + _LAST_LOCAL_MODEL_CLOCK_SLACK_MS
            if payload.loaded_at > _cap:
                payload = payload.model_copy(update = {"loaded_at": _cap})
            stored = _read_last_local_model(current_subject)
            if stored is not None:
                try:
                    current = LastLocalModelPayload(**stored)
                except Exception:
                    current = None
                if (
                    current is not None
                    and current.loaded_at is not None
                    and payload.loaded_at < current.loaded_at
                ):
                    return LastLocalModelResponse(
                        **current.model_dump(exclude = {"client_now"}), server_now = _server_now
                    )
        upsert_app_settings({_key: payload.model_dump(exclude = {"client_now"})})
    return LastLocalModelResponse(
        **payload.model_dump(exclude = {"client_now"}), server_now = _server_now
    )


@router.get("/vram-budget", response_model = VramBudgetResponse)
def get_vram_budget(current_subject: str = Depends(get_current_subject)) -> VramBudgetResponse:
    return _vram_budget_response()


@router.put("/vram-budget", response_model = VramBudgetResponse)
def update_vram_budget(
    payload: VramBudgetPayload, current_subject: str = Depends(get_current_subject)
) -> VramBudgetResponse:
    try:
        set_vram_budget_fraction(payload.fraction)
    except ValueError as exc:
        raise log_and_http_error(
            exc,
            400,
            safe_error_detail(exc, fallback = "Invalid VRAM budget."),
            event = "settings.update_vram_budget_failed",
            log = logger,
        ) from exc
    return _vram_budget_response()
