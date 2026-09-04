"""RAG API routes façade.

This module preserves backward compatibility by re-exporting all symbols
and the FastAPI APIRouter from the modularized routes.rag_pkg package:
- routes.rag_pkg.schemas: Request and response Pydantic models
- routes.rag_pkg.helpers: Filesystem, token signing, owner validation and doc views
- routes.rag_pkg.router_knowledge_bases: Knowledge bases and KB documents
- routes.rag_pkg.router_context_documents: Thread and project scoped documents
- routes.rag_pkg.router_linked_folders: Local linked folders sync and rebuild
- routes.rag_pkg.router_documents: Global uploaded documents and signed previews
- routes.rag_pkg.router_jobs: Ingestion job status and SSE event streams
- routes.rag_pkg.router_search: Vector and hybrid semantic retrieval
"""

import logging

logger = logging.getLogger(__name__)

from routes.rag_pkg import (
    router,
    # Schemas
    CreateKbRequest,
    UpdateKbRequest,
    SearchRequest,
    LinkFolderRequest,
    UpdateFolderRequest,
    # Helpers
    _UNAVAILABLE_DETAIL,
    _require_rag,
    _rag_unavailable_as_503,
    _rag_connection,
    _availability,
    _SAFE,
    _sanitize_filename,
    _persist_upload_stream,
    _save_upload,
    _save_native_path_upload,
    _resolve_document_upload,
    _remove_stored_upload,
    _is_managed_preview_path,
    _doc_view,
    _resolve_linked_folder_path,
    _folder_view,
    _scope_for_owner,
    _require_scope_owner,
    _require_document_owner,
    _create_linked_folder,
    _raise_if_scope_retired,
    _discard_document,
    _folder_job_view,
    _PREVIEW_SECRET,
    _PREVIEW_TTL,
    _CONTENT_TYPES,
    _sign_document,
    _verify_document_token,
    # Router Endpoints
    list_knowledge_bases,
    create_knowledge_base,
    update_knowledge_base,
    delete_knowledge_base,
    upload_kb_document,
    list_kb_documents,
    link_kb_folder,
    upload_thread_document,
    list_thread_documents,
    upload_project_document,
    list_project_documents,
    link_project_folder,
    list_linked_folders,
    update_linked_folder,
    unlink_folder,
    sync_folder,
    rebuild_folder,
    list_all_uploaded_documents,
    delete_document,
    preview_target,
    document_file_url,
    document_file_signed,
    job_status,
    job_events,
    folder_job_status,
    folder_job_events,
    search,
)
