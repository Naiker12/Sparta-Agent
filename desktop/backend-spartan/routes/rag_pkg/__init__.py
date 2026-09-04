"""Modular package for Spartan Agent RAG routes and services."""

from fastapi import APIRouter

from routes.rag_pkg.schemas import (
    CreateKbRequest,
    UpdateKbRequest,
    SearchRequest,
    LinkFolderRequest,
    UpdateFolderRequest,
)
from routes.rag_pkg.helpers import (
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
)
from routes.rag_pkg.router_knowledge_bases import (
    router as _router_kb,
    list_knowledge_bases,
    create_knowledge_base,
    update_knowledge_base,
    delete_knowledge_base,
    upload_kb_document,
    list_kb_documents,
    link_kb_folder,
)
from routes.rag_pkg.router_context_documents import (
    router as _router_context,
    upload_thread_document,
    list_thread_documents,
    upload_project_document,
    list_project_documents,
    link_project_folder,
)
from routes.rag_pkg.router_linked_folders import (
    router as _router_folders,
    list_linked_folders,
    update_linked_folder,
    unlink_folder,
    sync_folder,
    rebuild_folder,
)
from routes.rag_pkg.router_documents import (
    router as _router_documents,
    list_all_uploaded_documents,
    delete_document,
    preview_target,
    document_file_url,
    document_file_signed,
)
from routes.rag_pkg.router_jobs import (
    router as _router_jobs,
    job_status,
    job_events,
    folder_job_status,
    folder_job_events,
)
from routes.rag_pkg.router_search import (
    router as _router_search,
    search,
)

router = APIRouter()
for sub_router in (
    _router_kb,
    _router_context,
    _router_folders,
    _router_documents,
    _router_jobs,
    _router_search,
):
    for r in sub_router.routes:
        router.routes.append(r)
