"""Linked directory monitoring, synchronization and rebuilding endpoints."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from auth.authentication import get_current_subject
from core.rag import config, folder_sync, ingestion, retrieval, store
from storage import rag_db
from utils.paths import ensure_dir, rag_uploads_root
from routes.rag_pkg.schemas import UpdateFolderRequest
from routes.rag_pkg.helpers import (
    _require_rag,
    _rag_connection,
    _folder_view,
    _folder_job_view,
    _scope_for_owner,
    _require_scope_owner,
)

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/linked-folders")
def list_linked_folders(
    scope_type: str | None = Query(default = None),
    scope_id: str | None = Query(default = None),
    subject: str = Depends(get_current_subject),
) -> dict:
    _require_rag()
    if bool(scope_type) != bool(scope_id):
        raise HTTPException(
            status_code = 400, detail = "scope_type and scope_id must be provided together"
        )
    if scope_type:
        if scope_type not in {"knowledge_base", "project"}:
            raise HTTPException(status_code = 400, detail = "Unsupported linked-folder scope")
        scope = (
            store.kb_scope(scope_id)
            if scope_type == "knowledge_base"
            else store.project_scope(scope_id)
        )
        rows = folder_sync.list_folders(scope)
    else:
        conn = rag_db.get_connection()
        try:
            scopes = [
                row["scope"] for row in conn.execute("SELECT DISTINCT scope FROM linked_folders")
            ]
            kb_names = {row["id"]: row["name"] for row in store.list_kbs(conn)}
        finally:
            conn.close()
        from storage.studio_db import list_chat_projects

        project_names = {
            row["id"]: row["name"] for row in list_chat_projects(include_archived = True)
        }
        rows = [row for scope in scopes for row in folder_sync.list_folders(scope)]
        for row in rows:
            names = kb_names if row["scope_type"] == "knowledge_base" else project_names
            row["scope_name"] = names.get(row["scope_id"])
        rows = [row for row in rows if row["scope_name"] is not None]
    return {"linkedFolders": [_folder_view(row) for row in rows]}


@router.patch("/linked-folders/{folder_id}")
def update_linked_folder(
    folder_id: str,
    payload: UpdateFolderRequest,
    subject: str = Depends(get_current_subject),
) -> dict:
    _require_rag()
    try:
        row = folder_sync.update_folder(folder_id, name = payload.name, auto_sync = payload.auto_sync)
    except KeyError as exc:
        raise HTTPException(status_code = 404, detail = "Linked folder not found") from exc
    except ValueError as exc:
        raise HTTPException(status_code = 400, detail = str(exc)) from exc
    return {"linkedFolder": _folder_view(row)}


@router.delete("/linked-folders/{folder_id}")
def unlink_folder(
    folder_id: str,
    remove_index: bool = Query(default = True),
    subject: str = Depends(get_current_subject),
) -> dict:
    _require_rag()
    if not folder_sync.delete_folder(folder_id, remove_index = remove_index):
        raise HTTPException(status_code = 404, detail = "Linked folder not found")
    return {"ok": True}


@router.post("/linked-folders/{folder_id}/sync")
def sync_folder(folder_id: str, subject: str = Depends(get_current_subject)) -> dict:
    _require_rag()
    try:
        return {"job": _folder_job_view(folder_sync.get_job(folder_sync.request_sync(folder_id)))}
    except KeyError as exc:
        raise HTTPException(status_code = 404, detail = "Linked folder not found") from exc


@router.post("/linked-folders/{folder_id}/rebuild")
def rebuild_folder(folder_id: str, subject: str = Depends(get_current_subject)) -> dict:
    _require_rag()
    try:
        return {
            "job": _folder_job_view(
                folder_sync.get_job(folder_sync.request_sync(folder_id, rebuild = True))
            )
        }
    except KeyError as exc:
        raise HTTPException(status_code = 404, detail = "Linked folder not found") from exc
