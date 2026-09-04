"""Filesystem, security, preview token and serialization helpers for RAG API."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import re
import secrets
import sqlite3
import time
import uuid
from contextlib import contextmanager
from typing import Iterator, Optional

from fastapi import HTTPException, UploadFile
from core.rag import config, folder_sync, ingestion, retrieval, store
from storage import rag_db
from utils.paths import ensure_dir, rag_uploads_root

logger = logging.getLogger(__name__)

_UNAVAILABLE_DETAIL = "RAG is unavailable: the sqlite-vec extension could not be loaded."


def _require_rag() -> None:
    """Gate an endpoint on RAG being runnable here.

    Covers both halves of unavailable: sqlite-vec never imported, and it imported but
    its native library will not load. 503 with a stated reason rather than the 500 plus
    traceback a raising connection would produce, and rag_db's warn-once keeps the log
    quiet however often this fires.
    """
    if not rag_db.rag_available():
        raise HTTPException(status_code = 503, detail = _UNAVAILABLE_DETAIL)


@contextmanager
def _rag_unavailable_as_503(cleanup_path: str | None = None) -> Iterator[None]:
    """Report RagExtensionUnavailable as the same 503, wherever it is raised.

    _require_rag() has normally answered for the session already; this closes the window
    where the very first request is the one that discovers the missing library, and it
    reaches the connections ingestion opens for itself. ``cleanup_path`` removes an
    upload that was saved before the failure, so nothing is orphaned in the uploads
    root. Real database errors are left alone.
    """
    try:
        yield
    except rag_db.RagExtensionUnavailable as exc:
        _remove_stored_upload(cleanup_path)
        raise HTTPException(status_code = 503, detail = _UNAVAILABLE_DETAIL) from exc


def _rag_connection() -> sqlite3.Connection:
    """rag_db.get_connection() with the unavailable case reported as 503."""
    with _rag_unavailable_as_503():
        return rag_db.get_connection()


def _availability(available: bool) -> dict:
    """Availability marker carried by the KB list, the one response that degrades
    rather than erroring.

    Additive: a client that only reads the list is unaffected, one that reads this can
    say "RAG cannot run here" instead of showing an empty page that looks ready to use
    and offering a Create that can only 503.
    """
    return {
        "ragAvailable": available,
        "ragUnavailableReason": None if available else _UNAVAILABLE_DETAIL,
    }


_SAFE = re.compile(r"[^A-Za-z0-9._-]+")


def _sanitize_filename(name: str) -> str:
    base = os.path.basename(name or "").strip() or "document"
    base = _SAFE.sub("_", base)
    if len(base) <= 200:
        return base
    # Trim the stem, not the extension: _save_upload gates on the extension, so
    # a plain truncation would reject a long-named .txt as "unsupported".
    stem, ext = os.path.splitext(base)
    if not ext or len(ext) > 32:
        return base[:200]
    return stem[: 200 - len(ext)] + ext


def _persist_upload_stream(source, filename: str, *, empty_detail: str) -> tuple[str, str]:
    """Copy a validated document stream into the managed uploads root."""
    ext = os.path.splitext(filename)[1].lower()
    if ext not in config.UPLOAD_EXTS:
        raise HTTPException(
            status_code = 400,
            detail = f"Unsupported file type '{ext}'. Allowed: {sorted(config.UPLOAD_EXTS)}",
        )
    uploads = ensure_dir(rag_uploads_root())
    stored_path = str(uploads / f"{uuid.uuid4().hex}{ext}")
    size = 0
    cap = config.MAX_UPLOAD_BYTES
    try:
        with open(stored_path, "wb") as out:
            while True:
                block = source.read(1 << 20)
                if not block:
                    break
                size += len(block)
                if cap and size > cap:
                    break
                out.write(block)
    except OSError:
        _remove_stored_upload(stored_path)
        raise
    if cap and size > cap:
        _remove_stored_upload(stored_path)
        raise HTTPException(
            status_code = 413,
            detail = f"File exceeds the {cap // (1024 * 1024)} MB upload limit.",
        )
    if size == 0:
        _remove_stored_upload(stored_path)
        raise HTTPException(status_code = 400, detail = empty_detail)
    return stored_path, filename


def _save_upload(file: UploadFile) -> tuple[str, str]:
    """Persist a browser upload; returns (stored_path, filename)."""
    filename = _sanitize_filename(file.filename or "document")
    return _persist_upload_stream(
        file.file,
        filename,
        empty_detail = "Uploaded file is empty.",
    )


def _save_native_path_upload(lease: str) -> tuple[str, str]:
    """Persist a desktop drop; returns (stored_path, filename).

    The webview never gets to name a path directly: Rust signs the path it saw and we
    re-verify + re-stat that grant here before reading a byte.
    """
    from utils.native_path_leases import NativePathLeaseError, verify_native_path_lease

    try:
        grant = verify_native_path_lease(
            lease,
            operation = "attach",
            expected_kind = "attachment",
            expected_path_type = "file",
            allowed_suffixes = sorted(config.UPLOAD_EXTS),
        )
    except NativePathLeaseError as exc:
        raise HTTPException(status_code = 400, detail = str(exc)) from exc

    filename = _sanitize_filename(grant.canonical_path.name)
    try:
        with open(grant.canonical_path, "rb") as source:
            return _persist_upload_stream(
                source,
                filename,
                empty_detail = "Dropped file is empty.",
            )
    except OSError as exc:
        raise HTTPException(status_code = 400, detail = "Dropped file could not be read.") from exc


def _resolve_document_upload(
    file: UploadFile | None, native_path_lease: str | None
) -> tuple[str, str]:
    if native_path_lease:
        return _save_native_path_upload(native_path_lease)
    if file is None:
        raise HTTPException(status_code = 400, detail = "No file was provided.")
    return _save_upload(file)


def _remove_stored_upload(stored_path: str | None) -> None:
    """Best-effort cleanup for files saved by _save_upload."""
    if not stored_path:
        return
    try:
        uploads = os.path.realpath(str(rag_uploads_root()))
        target = os.path.realpath(stored_path)
        if os.path.isfile(target) and os.path.commonpath([uploads, target]) == uploads:
            os.remove(target)
    except Exception:  # noqa: BLE001 - DB/index deletion has already succeeded.
        logger.warning("failed to remove RAG upload %s", stored_path, exc_info = True)


def _is_managed_preview_path(stored_path: str) -> bool:
    uploads = os.path.realpath(str(rag_uploads_root()))
    try:
        common = os.path.commonpath([uploads, os.path.realpath(stored_path)])
        return os.path.normcase(common) == os.path.normcase(uploads)
    except ValueError:
        return False


def _doc_view(row: dict) -> dict:
    return {
        "id": row["id"],
        "filename": row["filename"],
        "status": row["status"],
        "error": row.get("error"),
        "numChunks": row.get("num_chunks") or 0,
        "kbId": row.get("kb_id"),
        "threadId": row.get("thread_id"),
        "projectId": row.get("project_id"),
        "linkedFolderId": row.get("linked_folder_id"),
        "managed": bool(row.get("linked_folder_id")),
        "createdAt": row.get("created_at"),
    }

def _resolve_linked_folder_path(
    native_path_lease: str, *, verifier = None
) -> tuple[str, tuple[int, int]]:
    """Resolve a desktop grant; the injectable verifier keeps resolution unit-testable."""
    from utils.native_path_leases import NativePathLeaseError, verify_native_path_lease

    verify = verifier or verify_native_path_lease
    try:
        grant = verify(
            native_path_lease,
            operation = "link-documents",
            expected_kind = "document-folder",
            expected_path_type = "directory",
        )
        device_id = getattr(grant, "device_id", None)
        file_id = getattr(grant, "file_id", None)
        if device_id is None or file_id is None:
            raise NativePathLeaseError("Native folder grant has no stable identity.")
        return (
            folder_sync.validate_folder_path(str(grant.canonical_path)),
            (device_id, file_id),
        )
    except NativePathLeaseError as exc:
        raise HTTPException(status_code = 400, detail = str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code = 400, detail = str(exc)) from exc


def _folder_view(row: dict) -> dict:
    status = (
        "syncing"
        if row["status"] == "syncing"
        else "error"
        if row["status"] in {"error", "retired"}
        else "idle"
    )
    return {
        "id": row["id"],
        "displayName": row["name"],
        "scopeType": row["scope_type"],
        "scopeId": row["scope_id"],
        "status": status,
        "error": row.get("last_error"),
        "lastSyncedAt": row.get("last_scan_at"),
        "documentCount": row.get("file_count", 0),
        "activeJobId": row.get("active_job_id"),
        "scopeName": row.get("scope_name"),
        "createdAt": row["created_at"],
    }


def _scope_for_owner(scope_type: str, scope_id: str) -> str:
    return (
        store.kb_scope(scope_id)
        if scope_type == "knowledge_base"
        else store.project_scope(scope_id)
    )


def _require_scope_owner(
    scope_type: str,
    scope_id: str,
    conn: sqlite3.Connection | None = None,
) -> None:
    """404 unless the scope's owner still exists.

    ``conn`` reuses a connection the caller already holds: sqlite-vec loads per
    connection, so opening a second one to read a single row pays that twice.
    """
    if scope_type == "knowledge_base":
        if conn is not None:
            exists = store.get_kb(conn, scope_id) is not None
        else:
            owner_conn = _rag_connection()
            try:
                exists = store.get_kb(owner_conn, scope_id) is not None
            finally:
                owner_conn.close()
        detail = "Knowledge base not found"
    else:
        from storage.studio_db import get_chat_project
        exists = get_chat_project(scope_id) is not None
        detail = "Project not found"
    if not exists:
        raise HTTPException(status_code = 404, detail = detail)


def _require_document_owner(conn: sqlite3.Connection, document: dict) -> None:
    if document.get("kb_id") and store.get_kb(conn, document["kb_id"]) is None:
        raise HTTPException(status_code = 404, detail = "Document not found")
    if document.get("project_id"):
        from storage.studio_db import get_chat_project
        if get_chat_project(document["project_id"]) is None:
            raise HTTPException(status_code = 404, detail = "Document not found")


def _create_linked_folder(scope_type: str, scope_id: str, payload: LinkFolderRequest) -> dict:
    path, signed_identity = _resolve_linked_folder_path(payload.native_path_lease)
    try:
        with folder_sync.scope_lock(_scope_for_owner(scope_type, scope_id)):
            _require_scope_owner(scope_type, scope_id)
            folder, job_id = folder_sync.create_folder_with_sync(
                scope_type = scope_type,
                scope_id = scope_id,
                path = path,
                expected_identity = signed_identity,
                name = payload.name,
                auto_sync = payload.auto_sync,
            )
    except ValueError as exc:
        raise HTTPException(status_code = 400, detail = str(exc)) from exc
    job = folder_sync.get_job(job_id)
    return {"linkedFolder": _folder_view(folder), "job": _folder_job_view(job)}

def _raise_if_scope_retired(scope: str, detail: str = "Knowledge base is being deleted") -> None:
    if folder_sync.scope_retired(scope):
        raise HTTPException(status_code = 409, detail = detail)

def _discard_document(document_id: str) -> None:
    """Drop a document and its upload after the scope it was ingested for disappeared."""
    conn = _rag_connection()
    try:
        document = store.get_document(conn, document_id) or {}
        store.delete_document(conn, document_id)
    finally:
        conn.close()
    # Same uploads-root confinement as every other cleanup path, and best-effort for the same
    # reason: on Windows commonpath raises across drives and os.remove raises while the ingestion
    # worker still holds the file, neither of which should turn this into a 500.
    _remove_stored_upload(document.get("stored_path"))

def _folder_job_view(row: dict) -> dict:
    processed = (
        (row.get("added") or 0)
        + (row.get("changed") or 0)
        + (row.get("deleted") or 0)
        + (row.get("failed") or 0)
    )
    return {
        "id": row["id"],
        "linkedFolderId": row["folder_id"],
        "mode": row["kind"],
        "status": row["status"],
        "stage": row.get("stage"),
        "progress": row.get("progress") or 0.0,
        "discoveredFiles": row.get("discovered") or 0,
        "processedFiles": processed,
        "indexedFiles": (row.get("added") or 0) + (row.get("changed") or 0),
        "removedFiles": row.get("deleted") or 0,
        "failedFiles": row.get("failed") or 0,
        "error": row.get("error"),
        "createdAt": row.get("created_at"),
        "completedAt": row.get("completed_at"),
    }

_PREVIEW_SECRET = secrets.token_bytes(32)
_PREVIEW_TTL = 600  # seconds

_CONTENT_TYPES = {
    ".pdf": "application/pdf",
    ".txt": "text/plain; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".markdown": "text/markdown; charset=utf-8",
    # Served as plain text, never text/html: an uploaded HTML document rendered
    # same-origin would execute its scripts with access to the app's storage.
    ".html": "text/plain; charset=utf-8",
    ".htm": "text/plain; charset=utf-8",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


def _sign_document(document_id: str) -> str:
    exp = int(time.time()) + _PREVIEW_TTL
    payload = f"{document_id}.{exp}"
    sig = hmac.new(_PREVIEW_SECRET, payload.encode(), hashlib.sha256).hexdigest()
    return f"{payload}.{sig}"


def _verify_document_token(token: str) -> str | None:
    try:
        document_id, exp_s, sig = token.rsplit(".", 2)
    except ValueError:
        return None
    expected = hmac.new(
        _PREVIEW_SECRET, f"{document_id}.{exp_s}".encode(), hashlib.sha256
    ).hexdigest()
    if not hmac.compare_digest(sig, expected):
        return None
    try:
        if int(exp_s) < int(time.time()):
            return None
    except ValueError:
        return None
    return document_id
