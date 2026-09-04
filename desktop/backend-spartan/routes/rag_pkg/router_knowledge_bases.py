"""Knowledge base management and KB document endpoints."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from auth.authentication import get_current_subject
from core.rag import config, folder_sync, ingestion, retrieval, store
from storage import rag_db
from utils.paths import ensure_dir, rag_uploads_root
from routes.rag_pkg.schemas import CreateKbRequest, UpdateKbRequest, LinkFolderRequest
from routes.rag_pkg.helpers import (
    _require_rag,
    _rag_connection,
    _resolve_document_upload,
    _create_linked_folder,
    _folder_view,
    _doc_view,
    _remove_stored_upload,
    _availability,
    _rag_unavailable_as_503,
    _require_scope_owner,
    _raise_if_scope_retired,
)

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/knowledge-bases")
def list_knowledge_bases(subject: str = Depends(get_current_subject)) -> dict:
    try:
        conn = rag_db.get_connection()
    except rag_db.RagExtensionUnavailable:
        # RAG_AVAILABLE only covers the import; the native library can still fail to
        # load per connection (a missing vec0 binary in the venv). The UI polls this
        # list, so 500ing here costs a traceback every few seconds for a condition that
        # never changes within a session. rag_db has warned once; an empty list is what
        # a machine without RAG has anyway. The marker is what keeps that honest: it is
        # the difference between "no knowledge bases yet" and "RAG cannot run here", and
        # without it the empty page looks ready to use. Only the unavailable case
        # degrades: a locked or corrupt database still raises.
        return {"knowledgeBases": [], **_availability(False)}
    try:
        kbs = store.list_kbs(conn)
        out = []
        for kb in kbs:
            docs = store.list_documents(conn, store.kb_scope(kb["id"]))
            out.append(
                {
                    "id": kb["id"],
                    "name": kb["name"],
                    "description": kb.get("description"),
                    "createdAt": kb.get("created_at"),
                    "documentCount": len(docs),
                }
            )
        return {"knowledgeBases": out, **_availability(True)}
    finally:
        conn.close()


@router.post("/knowledge-bases")
def create_knowledge_base(
    payload: CreateKbRequest, subject: str = Depends(get_current_subject)
) -> dict:
    _require_rag()
    conn = _rag_connection()
    try:
        kb_id = store.create_kb(
            conn,
            name = payload.name.strip(),
            description = (payload.description or None),
            embedding_model = config.effective_embedding_model(),
        )
        return {"id": kb_id, "name": payload.name.strip()}
    finally:
        conn.close()


@router.patch("/knowledge-bases/{kb_id}")
def update_knowledge_base(
    kb_id: str,
    payload: UpdateKbRequest,
    subject: str = Depends(get_current_subject),
) -> dict:
    _require_rag()
    conn = _rag_connection()
    try:
        if store.get_kb(conn, kb_id) is None:
            raise HTTPException(status_code = 404, detail = "Knowledge base not found")
        sets, params = [], []
        if payload.name is not None:
            sets.append("name=?")
            params.append(payload.name.strip())
        if payload.description is not None:
            sets.append("description=?")
            params.append(payload.description or None)
        if sets:
            params.append(kb_id)
            conn.execute(f"UPDATE knowledge_bases SET {', '.join(sets)} WHERE id=?", params)
            conn.commit()
        return {"ok": True}
    finally:
        conn.close()


@router.delete("/knowledge-bases/{kb_id}")
def delete_knowledge_base(kb_id: str, subject: str = Depends(get_current_subject)) -> dict:
    _require_rag()
    with _rag_unavailable_as_503():
        deleted = folder_sync.retire_and_delete_kb(kb_id)
    if not deleted:
        raise HTTPException(status_code = 404, detail = "Knowledge base not found")
    try:
        folder_sync.delete_retired_scope(store.kb_scope(kb_id))
    except Exception:
        logger.warning("failed to delete retired knowledge-base scope %s", kb_id, exc_info = True)
    return {"ok": True}

@router.post("/knowledge-bases/{kb_id}/documents")
async def upload_kb_document(
    kb_id: str,
    file: UploadFile | None = File(None),
    native_path_lease: str | None = Form(None, alias = "nativePathLease"),
    ocr: bool | None = Form(None),
    caption: bool | None = Form(None),
    subject: str = Depends(get_current_subject),
) -> dict:
    _require_rag()
    conn = _rag_connection()
    try:
        if store.get_kb(conn, kb_id) is None:
            raise HTTPException(status_code = 404, detail = "Knowledge base not found")
    finally:
        conn.close()
    scope = store.kb_scope(kb_id)
    _raise_if_scope_retired(scope)
    stored_path, filename = _resolve_document_upload(file, native_path_lease)
    try:
        with folder_sync.scope_lock(scope):
            _require_scope_owner("knowledge_base", kb_id)
            _raise_if_scope_retired(scope)
            with _rag_unavailable_as_503(stored_path):
                document_id, job_id = ingestion.start_ingestion(
                    scope, kb_id, None, filename, stored_path, ocr = ocr, caption = caption
                )
    except Exception:
        _remove_stored_upload(stored_path)
        raise
    return {"documentId": document_id, "jobId": job_id, "filename": filename}


@router.get("/knowledge-bases/{kb_id}/documents")
def list_kb_documents(kb_id: str, subject: str = Depends(get_current_subject)) -> dict:
    _require_rag()
    conn = _rag_connection()
    try:
        docs = store.list_documents(conn, store.kb_scope(kb_id))
        return {"documents": [_doc_view(d) for d in docs]}
    finally:
        conn.close()


@router.post("/knowledge-bases/{kb_id}/linked-folders")
def link_kb_folder(
    kb_id: str,
    payload: LinkFolderRequest,
    subject: str = Depends(get_current_subject),
) -> dict:
    _require_rag()
    _require_scope_owner("knowledge_base", kb_id)
    return _create_linked_folder("knowledge_base", kb_id, payload)
