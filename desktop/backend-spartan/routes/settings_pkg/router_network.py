"""Network access, remote tunneling, LAN exposure and preview sharing settings."""

import functools
from fastapi import APIRouter, Depends, HTTPException, Request
from loggers import get_logger

from auth.authentication import (
    authenticated_via_api_key,
    get_current_subject,
)
from auth.storage import rotate_preview_link_secret
from routes.provider_credentials import require_ui_session
from utils.preview_sharing_settings import (
    DEFAULT_PREVIEW_SHARING_ENABLED,
    get_preview_sharing_enabled,
    set_preview_sharing_enabled,
)
from utils.lan_access_settings import (
    lan_access_status,
    set_lan_access_auto_start,
    start_lan_access,
    stop_lan_access,
)
from utils.remote_access_settings import (
    DEFAULT_REMOTE_ACCESS_AUTO_START,
    remote_access_status,
    set_remote_access_auto_start,
    start_remote_access,
    stop_remote_access,
)
from routes.settings_pkg.schemas import (
    PreviewLinkRotateResponse,
    PreviewSharingPayload,
    PreviewSharingResponse,
    RemoteAccessAutoStartPayload,
    RemoteAccessResponse,
    LanAccessAutoStartPayload,
    LanAccessResponse,
)

router = APIRouter()
logger = get_logger(__name__)

@router.post("/preview-links/rotate", response_model = PreviewLinkRotateResponse)
def rotate_preview_links(
    current_subject: str = Depends(get_current_subject),
) -> PreviewLinkRotateResponse:
    """Rotate the preview-link signing secret, revoking every previously shared `/p` link."""
    rotate_preview_link_secret()
    logger.info("settings.preview_links_rotated subject=%s", current_subject)
    return PreviewLinkRotateResponse(rotated = True)

def _require_ui_session(via_api_key: bool = Depends(authenticated_via_api_key)) -> None:
    if via_api_key:
        raise HTTPException(status_code = 403, detail = "Remote access requires a UI session.")


def _remote_access_response(request: Request) -> RemoteAccessResponse:
    return RemoteAccessResponse(**remote_access_status(request.app.state))


@router.get("/remote-access", response_model = RemoteAccessResponse)
def get_remote_access(
    request: Request,
    current_subject: str = Depends(get_current_subject),
    _ui_session: None = Depends(_require_ui_session),
) -> RemoteAccessResponse:
    return _remote_access_response(request)


@router.post("/remote-access/start", response_model = RemoteAccessResponse)
def start_remote_access_route(
    request: Request,
    current_subject: str = Depends(get_current_subject),
    _ui_session: None = Depends(_require_ui_session),
) -> RemoteAccessResponse:
    try:
        response = RemoteAccessResponse(**start_remote_access(request.app.state))
    except RuntimeError as exc:
        raise HTTPException(status_code = 409, detail = str(exc)) from exc
    logger.info("settings.remote_access_start_requested subject=%s", current_subject)
    return response


@router.post("/remote-access/stop", response_model = RemoteAccessResponse)
def stop_remote_access_route(
    request: Request,
    current_subject: str = Depends(get_current_subject),
    _ui_session: None = Depends(_require_ui_session),
) -> RemoteAccessResponse:
    try:
        status = stop_remote_access(request.app.state)
    except RuntimeError as exc:
        raise HTTPException(status_code = 409, detail = str(exc)) from exc
    status.update(
        state = "off",
        url = None,
        error = None,
        managed_by = None,
        can_start = False,
        can_stop = False,
    )
    response = RemoteAccessResponse(**status)
    logger.info("settings.remote_access_stop_requested subject=%s", current_subject)
    return response


@router.put("/remote-access/auto-start", response_model = RemoteAccessResponse)
def update_remote_access_auto_start(
    request: Request,
    payload: RemoteAccessAutoStartPayload,
    current_subject: str = Depends(get_current_subject),
    _ui_session: None = Depends(_require_ui_session),
) -> RemoteAccessResponse:
    if bool(getattr(request.app.state, "remote_access_is_colab", False)):
        raise HTTPException(status_code = 409, detail = "colab")
    set_remote_access_auto_start(payload.enabled)
    logger.info(
        "settings.remote_access_auto_start_updated subject=%s enabled=%s",
        current_subject,
        payload.enabled,
    )
    return _remote_access_response(request)

def _lan_access_response(request: Request) -> LanAccessResponse:
    return LanAccessResponse(**lan_access_status(request.app))


@router.get("/lan-access", response_model = LanAccessResponse)
def get_lan_access(
    request: Request,
    current_subject: str = Depends(get_current_subject),
    _ui_session: None = Depends(_require_ui_session),
) -> LanAccessResponse:
    return _lan_access_response(request)


@router.post("/lan-access/start", response_model = LanAccessResponse)
def start_lan_access_route(
    request: Request,
    current_subject: str = Depends(get_current_subject),
    _ui_session: None = Depends(_require_ui_session),
) -> LanAccessResponse:
    try:
        response = LanAccessResponse(**start_lan_access(request.app))
    except RuntimeError as exc:
        raise HTTPException(status_code = 409, detail = str(exc)) from exc
    logger.info("settings.lan_access_start_requested subject=%s", current_subject)
    return response


@router.post("/lan-access/stop", response_model = LanAccessResponse)
def stop_lan_access_route(
    request: Request,
    current_subject: str = Depends(get_current_subject),
    _ui_session: None = Depends(_require_ui_session),
) -> LanAccessResponse:
    try:
        response = LanAccessResponse(**stop_lan_access(request.app))
    except RuntimeError as exc:
        raise HTTPException(status_code = 409, detail = str(exc)) from exc
    logger.info("settings.lan_access_stop_requested subject=%s", current_subject)
    return response


@router.put("/lan-access/auto-start", response_model = LanAccessResponse)
def update_lan_access_auto_start(
    request: Request,
    payload: LanAccessAutoStartPayload,
    current_subject: str = Depends(get_current_subject),
    _ui_session: None = Depends(_require_ui_session),
) -> LanAccessResponse:
    if bool(getattr(request.app.state, "lan_access_is_colab", False)):
        raise HTTPException(status_code = 409, detail = "colab")
    set_lan_access_auto_start(payload.enabled)
    logger.info(
        "settings.lan_access_auto_start_updated subject=%s enabled=%s",
        current_subject,
        payload.enabled,
    )
    return _lan_access_response(request)


@router.get("/preview-sharing", response_model = PreviewSharingResponse)
def get_preview_sharing(
    current_subject: str = Depends(get_current_subject),
) -> PreviewSharingResponse:
    return PreviewSharingResponse(enabled = get_preview_sharing_enabled())


@router.put("/preview-sharing", response_model = PreviewSharingResponse)
def update_preview_sharing(
    payload: PreviewSharingPayload, current_subject: str = Depends(get_current_subject)
) -> PreviewSharingResponse:
    """Enable/disable the public `/p` preview surface. When off, links 404 even with a token."""
    try:
        enabled = set_preview_sharing_enabled(payload.enabled)
    except ValueError as exc:
        raise log_and_http_error(
            exc,
            400,
            safe_error_detail(exc, fallback = "Invalid preview sharing setting."),
            event = "settings.update_preview_sharing_failed",
            log = logger,
        ) from exc
    logger.info("settings.preview_sharing_updated subject=%s enabled=%s", current_subject, enabled)
    return PreviewSharingResponse(enabled = enabled)
