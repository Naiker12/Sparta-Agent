"""FastAPI route handlers for chat threads and history lifecycle."""

import sqlite3
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from auth.authentication import get_current_subject
from storage.studio_db import (
    ChatThreadDeletedError,
    ChatThreadPreconditionFailed,
    clear_chat_history,
    count_chat_threads,
    delete_chat_threads,
    get_chat_project,
    get_chat_thread,
    list_chat_legacy_imports,
    list_chat_threads,
    update_chat_thread,
    upsert_chat_legacy_imports,
    upsert_chat_thread,
)
from routes.chat.schemas import (
    ChatClearRequest,
    ChatCountResponse,
    ChatDeleteRequest,
    ChatImportLedgerRecordRequest,
    ChatImportLedgerRecordResponse,
    ChatImportLedgerResponse,
    ChatThread,
    ChatThreadListResponse,
    ChatThreadPatch,
)
from routes.chat.helpers import (
    _cancel_active_generations,
    _cancel_research_runs,
    _deleted_thread_error,
    _missing_project_error,
    _remove_sandboxes,
    _settings_write_from_patch,
    thread_from_row,
)

router = APIRouter()

@router.get("/threads", response_model = ChatThreadListResponse)
def list_threads(
    model_type: Optional[str] = Query(None),
    pair_id: Optional[str] = Query(None),
    project_id: Optional[str] = Query(None),
    include_archived: bool = Query(True),
    require_messages: bool = Query(False),
    current_subject: str = Depends(get_current_subject),
):
    threads = list_chat_threads(
        model_type = model_type,
        pair_id = pair_id,
        project_id = project_id,
        include_archived = include_archived,
        require_messages = require_messages,
    )
    return ChatThreadListResponse(threads = [thread_from_row(t) for t in threads])



@router.post("/threads", response_model = ChatThread)
def save_thread(payload: ChatThread, current_subject: str = Depends(get_current_subject)):
    if payload.projectId and get_chat_project(payload.projectId) is None:
        raise _missing_project_error(payload.projectId)
    try:
        return thread_from_row(upsert_chat_thread(payload.model_dump()))
    except ChatThreadDeletedError as exc:
        raise _deleted_thread_error(payload.id) from exc
    except sqlite3.IntegrityError as exc:
        # The project can be deleted between the check above and this insert, and the foreign key
        # then fails. Report the same 404 rather than surfacing a 500.
        if not payload.projectId:
            raise
        raise _missing_project_error(payload.projectId) from exc


@router.get("/threads/{thread_id}", response_model = ChatThread)
def get_thread(thread_id: str, current_subject: str = Depends(get_current_subject)):
    thread = get_chat_thread(thread_id)
    if thread is None:
        raise HTTPException(status_code = 404, detail = f"Thread {thread_id} not found")
    return thread_from_row(thread)


@router.patch("/threads/{thread_id}", response_model = ChatThread)
def patch_thread(
    thread_id: str,
    payload: ChatThreadPatch,
    current_subject: str = Depends(get_current_subject),
):
    patch = payload.model_dump(exclude_unset = True)
    expected_title = patch.pop("expectedTitle", None)
    expected_opening_message_id = patch.pop("expectedOpeningMessageId", None)
    for field in ("title", "modelType", "modelId", "archived", "createdAt", "updatedAt"):
        if field in patch and patch[field] is None:
            raise HTTPException(status_code = 400, detail = f"{field} cannot be null")
    if patch.get("projectId") and get_chat_project(patch["projectId"]) is None:
        raise _missing_project_error(patch["projectId"])
    settings_write = _settings_write_from_patch(patch)
    try:
        thread = update_chat_thread(
            thread_id,
            patch,
            expected_title = expected_title,
            expected_opening_message_id = expected_opening_message_id,
            settings_write = settings_write,
        )
    except sqlite3.IntegrityError as exc:
        # Same race as save_thread: the project can go away before this write lands.
        if not patch.get("projectId"):
            raise
        raise _missing_project_error(patch["projectId"]) from exc
    except ChatThreadPreconditionFailed:
        raise HTTPException(
            status_code = 409,
            detail = f"Thread {thread_id} changed since it was read",
        )
    if thread is None:
        raise HTTPException(status_code = 404, detail = f"Thread {thread_id} not found")
    return thread_from_row(thread)



@router.delete("/threads")
async def delete_threads(
    payload: ChatDeleteRequest,
    request: Request,
    current_subject: str = Depends(get_current_subject),
):
    from starlette.concurrency import run_in_threadpool

    deleted_research_run_ids = await run_in_threadpool(delete_chat_threads, payload.ids)
    _cancel_research_runs(request, deleted_research_run_ids)
    _cancel_active_generations(payload.ids)
    # Keyed by thread id, so nothing can reference the folder once the thread
    # is gone. Clean it up rather than leaking one per chat.
    # In a worker: right after an upgrade this also runs the legacy move, and a
    # cross-filesystem copy on the event loop stops every other request.
    removed, kept = await _remove_sandboxes(payload.ids, payload.delete_files)
    return {"status": "deleted", "sandboxes_removed": removed, "sandboxes_kept": kept}



@router.get("/count", response_model = ChatCountResponse)
def count_threads(current_subject: str = Depends(get_current_subject)):
    return ChatCountResponse(count = count_chat_threads())


@router.get("/import-ledger", response_model = ChatImportLedgerResponse)
def get_import_ledger(current_subject: str = Depends(get_current_subject)):
    """Legacy-Dexie import ledger: legacy thread ids already copied into chat tables.

    The frontend checks this on tab open to decide whether to re-run the Dexie -> studio.db import.
    """
    return ChatImportLedgerResponse(threadIds = list_chat_legacy_imports())


@router.post("/import-ledger", response_model = ChatImportLedgerRecordResponse)
def record_import_ledger(
    payload: ChatImportLedgerRecordRequest, current_subject: str = Depends(get_current_subject)
):
    """Mark each legacy thread id as imported. Idempotent."""
    accepted, inserted = upsert_chat_legacy_imports(payload.threadIds)
    return ChatImportLedgerRecordResponse(accepted = accepted, inserted = inserted)


@router.delete("")
async def clear_history(
    request: Request,
    payload: Optional[ChatClearRequest] = None,
    delete_files: bool = False,
    current_subject: str = Depends(get_current_subject),
):
    from starlette.concurrency import run_in_threadpool

    # Admission is already closed in the frontend. Include its pending and legacy ids in the
    # transaction's fence so a delayed POST cannot recreate a chat after this returns.
    thread_ids = (
        list(payload.ids)
        if payload is not None
        else [thread["id"] for thread in await run_in_threadpool(list_chat_threads)]
    )

    def _clear_rows() -> tuple[list[str], list[str]]:
        if payload is None:
            cleared, cleared_runs = clear_chat_history()
        else:
            cleared, cleared_runs = clear_chat_history(
                payload.ids,
                operation_id = payload.operationId,
            )
        return cleared, cleared_runs

    # The clear reports what it deleted, which is what gets cleaned up: a thread
    # added between the listing above and the delete is gone too, and its
    # sandbox would otherwise be stranded.
    cleared, cleared_runs = await run_in_threadpool(_clear_rows)
    # A chat started between the listing and the transaction is in `cleared`
    # but was never cancelled, and a generation still running would dispatch a
    # tool and rebuild the sandbox this call is about to remove.
    listed = set(thread_ids)
    late = [thread_id for thread_id in cleared if thread_id not in listed]
    _cancel_active_generations(thread_ids)
    if late:
        _cancel_active_generations(late)
    # By id: the rows went with the threads, so nothing can look them up now.
    _cancel_research_runs(request, cleared_runs)
    # "Clear all chats" is the common bulk delete, so it has to clean up the
    # same folders DELETE /threads does; otherwise every sandbox is stranded.
    # delete_files matches DELETE /threads: off by default, since the files are
    # the user's, but a caller clearing everything can ask for them too.
    removed, kept = await _remove_sandboxes(list(dict.fromkeys(thread_ids + cleared)), delete_files)
    return {
        "status": "deleted",
        "deletedThreadIds": cleared,
        "sandboxes_removed": removed,
        "sandboxes_kept": kept,
    }


