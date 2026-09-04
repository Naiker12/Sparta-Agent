"""Debug logging sources and log streaming endpoints."""

import os
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from loggers import get_logger

from auth.authentication import get_current_subject
from routes.settings_pkg.router_network import _require_ui_session
from routes.settings_pkg.schemas import (
    DebugLogSourceModel,
    DebugLogSourcesResponse,
    DebugLogResponse,
)

router = APIRouter()
logger = get_logger(__name__)

@router.get("/debug/logs/sources", response_model = DebugLogSourcesResponse)
def get_debug_log_sources(
    current_subject: str = Depends(get_current_subject),
    _ui_session: None = Depends(_require_ui_session),
) -> DebugLogSourcesResponse:
    """Every log file the viewer may read, newest first within each family.

    Individual files, not one entry per family: the llama runner writes one file
    per load ATTEMPT, so after a retry the useful one is often not the newest.
    """
    from utils import debug_log_sources

    sources = debug_log_sources.list_sources()
    return DebugLogSourcesResponse(
        sources = [DebugLogSourceModel(**vars(source)) for source in sources],
        default_source_id = debug_log_sources.default_source_id(),
        file_logging_disabled = debug_log_sources.file_logging_disabled(),
    )


@router.get("/debug/logs", response_model = DebugLogResponse)
def get_debug_log(
    source: Optional[str] = None,
    cursor: Optional[str] = None,
    lines: int = 1000,
    current_subject: str = Depends(get_current_subject),
    _ui_session: None = Depends(_require_ui_session),
) -> DebugLogResponse:
    """The tail of one log, then only what was appended after `cursor`.

    Every content state answers 200. This is polled once a second in Live mode,
    and a 404 or a 500 on "the file is not there yet" would make the viewer
    flash an error on every tick; the caller reads `status` instead.
    """
    from utils import debug_log_reader, debug_log_sources

    source_id = source or debug_log_sources.default_source_id()
    if not source_id:
        disabled = debug_log_sources.file_logging_disabled()
        return DebugLogResponse(
            status = "disabled" if disabled else "missing",
            reason = (
                "File logging is turned off (UNSLOTH_STUDIO_NO_FILE_LOG=1)."
                if disabled
                else "No log files have been written yet."
            ),
        )

    path = debug_log_sources.resolve_source_id(source_id)
    if path is None:
        # An id the enumeration no longer produces. 404 here (unlike the content
        # states above) so a stale picker refetches its sources.
        raise HTTPException(status_code = 404, detail = "Unknown log source.")

    try:
        result = debug_log_reader.read_since(path, cursor, lines)
    except FileNotFoundError:
        return DebugLogResponse(
            status = "missing",
            reason = "The log file was removed.",
            source_id = source_id,
        )
    except (OSError, PermissionError) as exc:
        # The message embeds the path, so it goes through redaction too.
        from utils.log_redaction import redact_log_text
        return DebugLogResponse(
            status = "unreadable",
            reason = redact_log_text(str(exc)),
            source_id = source_id,
        )

    return DebugLogResponse(
        status = "empty" if (result.size_bytes == 0 and not result.lines) else "ok",
        source_id = source_id,
        realpath = str(path),
        lines = result.lines,
        cursor = result.cursor,
        reset = result.reset,
        reset_reason = result.reset_reason,
        dropped_bytes = result.dropped_bytes,
        truncated_head = result.truncated_head,
        more_pending = result.more_pending,
        file_logging_disabled = debug_log_sources.source_is_frozen(source_id),
        size_bytes = result.size_bytes,
    )
