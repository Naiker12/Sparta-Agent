"""Asynchronous ingestion job status and server-sent event (SSE) streaming."""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from auth.authentication import get_current_subject
from core.rag import config, folder_sync, ingestion, retrieval, store
from storage import rag_db
from utils.paths import ensure_dir, rag_uploads_root
from routes.rag_pkg.helpers import (
    _require_rag,
    _folder_job_view,
    _scope_for_owner,
    _require_scope_owner,
    _rag_unavailable_as_503,
)

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/jobs/{job_id}")
def job_status(job_id: str, subject: str = Depends(get_current_subject)) -> dict:
    _require_rag()
    with _rag_unavailable_as_503():
        row = ingestion.get_job_status(job_id)
    if row is None:
        raise HTTPException(status_code = 404, detail = "Job not found")
    return {
        "id": row["id"],
        "documentId": row["document_id"],
        "status": row["status"],
        "stage": row.get("stage"),
        "progress": row.get("progress") or 0.0,
        "error": row.get("error"),
        "numChunks": row.get("num_chunks") or 0,
    }


@router.get("/jobs/{job_id}/events")
def job_events(job_id: str, subject: str = Depends(get_current_subject)) -> StreamingResponse:
    _require_rag()

    def gen():
        try:
            for event in ingestion.job_events(job_id):
                yield f"data: {json.dumps(event)}\n\n"
        except Exception as exc:  # noqa: BLE001
            yield f"data: {json.dumps({'type': 'error', 'error': str(exc)})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        gen(),
        media_type = "text/event-stream",
        headers = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )

@router.get("/linked-folder-jobs/{job_id}")
def folder_job_status(job_id: str, subject: str = Depends(get_current_subject)) -> dict:
    _require_rag()
    row = folder_sync.get_job(job_id)
    if row is None:
        raise HTTPException(status_code = 404, detail = "Folder sync job not found")
    return _folder_job_view(row)


@router.get("/linked-folder-jobs/{job_id}/events")
def folder_job_events(
    job_id: str, subject: str = Depends(get_current_subject)
) -> StreamingResponse:
    _require_rag()
    if folder_sync.get_job(job_id) is None:
        raise HTTPException(status_code = 404, detail = "Folder sync job not found")

    def gen():
        for event in folder_sync.job_events(job_id):
            if event is None:
                yield ": keepalive\n\n"
                continue
            view = _folder_job_view(event)
            view["type"] = (
                "complete"
                if event["status"] == "completed"
                else "error"
                if event["status"] == "failed"
                else "progress"
            )
            yield f"data: {json.dumps(view)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        gen(),
        media_type = "text/event-stream",
        headers = {"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
