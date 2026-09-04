"""Vector retrieval and hybrid semantic search endpoint."""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from auth.authentication import get_current_subject
from core.rag import config, folder_sync, ingestion, retrieval, store
from storage import rag_db
from utils.paths import ensure_dir, rag_uploads_root
from routes.rag_pkg.schemas import SearchRequest
from routes.rag_pkg.helpers import (
    _require_rag,
    _rag_connection,
    _doc_view,
)

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/search")
def search(payload: SearchRequest, subject: str = Depends(get_current_subject)) -> dict:
    _require_rag()
    # One connection for the whole request; the ownership check reads a single row.
    conn = _rag_connection()
    try:
        if payload.kb_id:
            _require_scope_owner("knowledge_base", payload.kb_id, conn)
            scope = store.kb_scope(payload.kb_id)
        else:
            scopes = []
            if payload.project_id:
                _require_scope_owner("project", payload.project_id, conn)
                scopes.append(store.project_scope(payload.project_id))
            if payload.thread_id:
                scopes.append(store.thread_scope(payload.thread_id))
            if not scopes:
                raise HTTPException(
                    status_code = 400, detail = "Provide kb_id, project_id, or thread_id"
                )
            scope = scopes[0] if len(scopes) == 1 else scopes

        if payload.mode == "lexical":
            hits = retrieval.retrieve_lexical(conn, scope, payload.query, payload.top_k)
        elif payload.mode == "dense":
            hits = retrieval.retrieve_dense(conn, scope, payload.query, payload.top_k)
        else:
            hits = retrieval.retrieve_hybrid(conn, scope, payload.query, k = payload.top_k)
        hits = retrieval.filter_min_score(hits, payload.min_score)
        rows = store.chunks_by_id(conn, [h.chunk_id for h in hits])
        results = []
        for h in hits:
            r = rows.get(h.chunk_id)
            if r is None:
                continue
            results.append(
                {
                    "chunkId": h.chunk_id,
                    "documentId": r["document_id"],
                    "filename": r["filename"],
                    "page": r["page_number"],
                    "score": h.score,
                    "text": r["text"],
                }
            )
        return {"results": results}
    finally:
        conn.close()
