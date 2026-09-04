"""Uploaded document listing, removal, preview target and signed URL delivery."""

from __future__ import annotations

import json
import logging
import os
import secrets
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from auth.authentication import get_current_subject
from core.rag import config, folder_sync, ingestion, retrieval, store
from storage import rag_db
from utils.paths import ensure_dir, rag_uploads_root
from routes.rag_pkg.helpers import (
    _require_rag,
    _rag_connection,
    _doc_view,
    _discard_document,
    _require_document_owner,
    _is_managed_preview_path,
    _sign_document,
    _verify_document_token,
    _CONTENT_TYPES,
    _remove_stored_upload,
)

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/documents")
def list_all_uploaded_documents(subject: str = Depends(get_current_subject)) -> dict:
    """Every uploaded file across chats, projects, and knowledge bases (settings
    Data tab)."""
    _require_rag()
    conn = _rag_connection()
    try:
        docs = store.list_all_documents(conn)
        kb_names = {kb["id"]: kb["name"] for kb in store.list_kbs(conn)}
    finally:
        conn.close()

    from storage.studio_db import list_chat_projects

    project_names = {p["id"]: p["name"] for p in list_chat_projects(include_archived = True)}

    out = []
    for doc in docs:
        view = _doc_view(doc)
        stored_path = doc.get("stored_path")
        size = None
        if stored_path:
            try:
                size = os.path.getsize(stored_path)
            except OSError:
                size = None
        view["sizeBytes"] = size
        view["kbName"] = kb_names.get(doc.get("kb_id"))
        view["projectName"] = project_names.get(doc.get("project_id"))
        out.append(view)
    return {"documents": out}


@router.delete("/documents/{document_id}")
def delete_document(document_id: str, subject: str = Depends(get_current_subject)) -> dict:
    _require_rag()
    conn = _rag_connection()
    try:
        doc = store.get_visible_document(conn, document_id)
        if doc is None:
            raise HTTPException(status_code = 404, detail = "Document not found")
        if doc.get("linked_folder_id"):
            raise HTTPException(
                status_code = 409,
                detail = "Linked-folder documents are managed by folder synchronization",
            )
        store.delete_document(conn, document_id)
        _remove_stored_upload(doc.get("stored_path"))
        return {"ok": True}
    finally:
        conn.close()

@router.get("/documents/{document_id}/preview-target")
def preview_target(
    document_id: str,
    chunk_id: str | None = Query(default = None),
    subject: str = Depends(get_current_subject),
) -> dict:
    """Resolve a citation to filename, page, and highlight regions."""
    _require_rag()
    conn = _rag_connection()
    try:
        doc = store.get_visible_document(conn, document_id)
        if doc is None:
            raise HTTPException(status_code = 404, detail = "Document not found")
        _require_document_owner(conn, doc)
        ext = os.path.splitext(doc["filename"])[1].lower()
        out = {
            "documentId": document_id,
            "filename": doc["filename"],
            "mediaKind": "pdf" if ext == ".pdf" else "text",
            "targetPage": None,
            "pdfRegions": [],
            "text": None,
        }
        if chunk_id:
            row = conn.execute(
                "SELECT text, page_number, pdf_regions_json FROM chunks "
                "WHERE id=? AND document_id=?",
                (chunk_id, document_id),
            ).fetchone()
            if row is not None:
                out["text"] = row["text"]
                out["targetPage"] = row["page_number"]
                if row["pdf_regions_json"]:
                    try:
                        out["pdfRegions"] = json.loads(row["pdf_regions_json"])
                    except Exception:
                        out["pdfRegions"] = []
        return out
    finally:
        conn.close()


@router.get("/documents/{document_id}/file-url")
def document_file_url(document_id: str, subject: str = Depends(get_current_subject)) -> dict:
    """Mint a short-lived signed URL for the source file."""
    _require_rag()
    conn = _rag_connection()
    try:
        doc = store.get_visible_document(conn, document_id)
        if doc is None or not doc.get("stored_path"):
            raise HTTPException(status_code = 404, detail = "Document file not available")
        _require_document_owner(conn, doc)
    finally:
        conn.close()
    token = _sign_document(document_id)
    return {"url": f"/api/rag/documents/{document_id}/file-signed?token={token}"}


@router.get("/documents/{document_id}/file-signed", response_model = None)
def document_file_signed(document_id: str, token: str = Query(...)) -> FileResponse:
    """Serve the source file gated by the HMAC token (no bearer) so pdf.js range
    requests work."""
    # Token first: this is the one endpoint with no bearer, and _require_rag() now opens
    # a connection on its first call, which is not work an unverified token should buy.
    signed_id = _verify_document_token(token)
    if signed_id != document_id:
        raise HTTPException(status_code = 401, detail = "Invalid or expired token")
    _require_rag()
    conn = _rag_connection()
    try:
        doc = store.get_visible_document(conn, document_id)
        if doc is not None:
            _require_document_owner(conn, doc)
    finally:
        conn.close()
    stored_path = (doc or {}).get("stored_path")
    if not doc or not stored_path or not os.path.isfile(stored_path):
        raise HTTPException(status_code = 404, detail = "Document file not found")
    # Confine to the uploads root (defense in depth).
    if not _is_managed_preview_path(stored_path):
        raise HTTPException(status_code = 403, detail = "Forbidden")
    ext = os.path.splitext(doc["filename"])[1].lower()
    return FileResponse(
        stored_path,
        media_type = _CONTENT_TYPES.get(ext, "application/octet-stream"),
        # linked documents are named by a posix relative path, invalid in this header
        filename = doc["filename"].rsplit("/", 1)[-1],
    )
