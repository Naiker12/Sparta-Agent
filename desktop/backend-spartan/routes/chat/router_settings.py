"""FastAPI route handlers for chat settings and history export."""

from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import ValidationError

from auth.authentication import get_current_subject
from loggers import get_logger
from storage.studio_db import (
    CorruptSettingsError,
    build_chat_history_export,
    list_chat_settings,
    upsert_chat_settings_merge,
)
from utils.api_errors import safe_validation_errors
from utils.utils import log_and_http_error, safe_curated_detail
from routes.chat.schemas import (
    ChatExportResponse,
    ChatMessage,
    ChatProject,
    ChatSettingsPayload,
    ChatSettingsResponse,
)
from routes.chat.helpers import thread_from_row

logger = get_logger(__name__)
router = APIRouter()

@router.get("/settings", response_model = ChatSettingsResponse)
def get_settings(current_subject: str = Depends(get_current_subject)):
    return ChatSettingsResponse(settings = list_chat_settings())


@router.put("/settings", response_model = ChatSettingsResponse)
def put_settings(payload: dict[str, Any], current_subject: str = Depends(get_current_subject)):
    try:
        parsed = ChatSettingsPayload.model_validate(payload)
    except ValidationError as exc:
        # safe_validation_errors, not exc.errors(): the raw errors echo the offending
        # input, and Starlette's JSONResponse dumps with allow_nan = False, so a
        # rejected NaN or Infinity made the 400 handler itself unrenderable and the
        # caller got a 500 for a request the validator had already refused. It also
        # bounds a multi-megabyte value being quoted back.
        raise HTTPException(status_code = 400, detail = safe_validation_errors(exc.errors())) from exc
    # Atomic read + deep-merge + write in one BEGIN IMMEDIATE so concurrent updates don't clobber.
    try:
        return ChatSettingsResponse(
            settings = upsert_chat_settings_merge(parsed.model_dump(exclude_unset = True))
        )
    except CorruptSettingsError as exc:
        raise log_and_http_error(
            exc,
            409,
            safe_curated_detail(exc),
            event = "chat_history.put_settings_conflict",
            log = logger,
        ) from exc



@router.get("/export", response_model = ChatExportResponse)
def export_history(current_subject: str = Depends(get_current_subject)):
    from datetime import datetime, timezone
    projects, threads, messages = build_chat_history_export()
    return ChatExportResponse(
        exportedAt = datetime.now(timezone.utc).isoformat(),
        version = 1,
        threadCount = len(threads),
        projects = [ChatProject(**project) for project in projects],
        threads = [thread_from_row(thread) for thread in threads],
        messages = [ChatMessage(**message) for message in messages],
    )

