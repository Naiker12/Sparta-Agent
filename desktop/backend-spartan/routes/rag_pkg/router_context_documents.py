"""Thread and project scoped document upload and attachment endpoints."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from auth.authentication import get_current_subject
from core.rag import config, folder_sync, ingestion, retrieval, store
from storage import rag_db
from utils.paths import ensure_dir, rag_uploads_root
from routes.rag_pkg.schemas import LinkFolderRequest
from routes.rag_pkg.helpers import (
    _require_rag,
    _rag_connection,
    _resolve_document_upload,
    _create_linked_folder,
    _folder_view,
    _doc_view,
    _remove_stored_upload,
    _raise_if_scope_retired,
)

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/threads/{thread_id}/documents")
async def upload_thread_document(
    thread_id: str,
    file: UploadFile | None = File(None),
    native_path_lease: str | None = Form(None, alias = "nativePathLease"),
    ocr: bool | None = Form(None),
    caption: bool | None = Form(None),
    subject: str = Depends(get_current_subject),
) -> dict:
    _require_rag()
    stored_path, filename = _resolve_document_upload(file, native_path_lease)
    with _rag_unavailable_as_503(stored_path):
        document_id, job_id = ingestion.start_ingestion(
            store.thread_scope(thread_id),
            None,
            thread_id,
            filename,
            stored_path,
            ocr = ocr,
            caption = caption,
        )
    return {"documentId": document_id, "jobId": job_id, "filename": filename}


@router.get("/threads/{thread_id}/documents")
def list_thread_documents(thread_id: str, subject: str = Depends(get_current_subject)) -> dict:
    _require_rag()
    conn = _rag_connection()
    try:
        docs = store.list_documents(conn, store.thread_scope(thread_id))
        return {"documents": [_doc_view(d) for d in docs]}
    finally:
        conn.close()

@router.post("/projects/{project_id}/documents")
async def upload_project_document(
    project_id: str,
    file: UploadFile | None = File(None),
    native_path_lease: str | None = Form(None, alias = "nativePathLease"),
    ocr: bool | None = Form(None),
    caption: bool | None = Form(None),
    subject: str = Depends(get_current_subject),
) -> dict:
    _require_rag()
    from storage.studio_db import get_chat_project

    if get_chat_project(project_id) is None:
        raise HTTPException(status_code = 404, detail = "Project not found")
    scope = store.project_scope(project_id)
    _raise_if_scope_retired(scope, "Project is being deleted")
    stored_path, filename = _resolve_document_upload(file, native_path_lease)
    try:
        with folder_sync.scope_lock(scope):
            _require_scope_owner("project", project_id)
            _raise_if_scope_retired(scope, "Project is being deleted")
            with _rag_unavailable_as_503(stored_path):
                document_id, job_id = ingestion.start_ingestion(
                    scope,
                    None,
                    None,
                    filename,
                    stored_path,
                    project_id = project_id,
                    ocr = ocr,
                    caption = caption,
                )
    except Exception:
        _remove_stored_upload(stored_path)
        raise
    # the project delete runs in the threadpool and can commit after the check above, once its own
    # RAG cleanup has already listed the project's documents
    if get_chat_project(project_id) is None:
        _discard_document(document_id)
        raise HTTPException(status_code = 404, detail = "Project not found")
    return {"documentId": document_id, "jobId": job_id, "filename": filename}


@router.get("/projects/{project_id}/documents")
def list_project_documents(project_id: str, subject: str = Depends(get_current_subject)) -> dict:
    _require_rag()
    _require_scope_owner("project", project_id)
    conn = _rag_connection()
    try:
        docs = store.list_documents(conn, store.project_scope(project_id))
        return {"documents": [_doc_view(d) for d in docs]}
    finally:
        conn.close()


@router.post("/projects/{project_id}/linked-folders")
def link_project_folder(
    project_id: str,
    payload: LinkFolderRequest,
    subject: str = Depends(get_current_subject),
) -> dict:
    _require_rag()
    _require_scope_owner("project", project_id)
    return _create_linked_folder("project", project_id, payload)
