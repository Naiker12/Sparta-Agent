"""FastAPI route handlers for thread-specific local workspace bindings."""

import os
import time
from fastapi import APIRouter, Depends, HTTPException

from auth.authentication import get_current_subject
from state.project_workspace_link import validate_connectable_folder
from storage.studio_db import (
    bind_chat_thread_workspace,
    get_chat_thread,
    get_thread_workspace_binding,
    unbind_chat_thread_workspace,
)
from routes.chat.schemas import (
    ChatThreadWorkspaceBinding,
    ChatThreadWorkspacePatch,
)

router = APIRouter()


def _change_scope(thread_id):
    from state.thread_workspace import resolve_thread_workspace
    from storage.studio_db import get_chat_project
    thread = get_chat_thread(thread_id)
    if thread is None:
        raise HTTPException(status_code=404, detail="thread_not_found")
    binding = get_thread_workspace_binding(thread_id)
    if binding:
        root = resolve_thread_workspace(binding)
        if root:
            return root, binding.get("access", "read")
        raise HTTPException(status_code=409, detail="workspace_changed")
    project = get_chat_project(thread.get("projectId")) if thread.get("projectId") else None
    if project:
        from state.project_workspace_link import resolve_active_workspace
        root = resolve_active_workspace(project)
        if os.path.isdir(root):
            access = project.get("workspaceAccess", "read") if root == os.path.realpath(project.get("connectedFolderPath") or "") else "write"
            return root, access
    raise HTTPException(status_code=404, detail="workspace_unavailable")


def _change_store():
    from core.inference.turn_changes import default_store
    return default_store()


def _change_action(action, thread_id, change_id, subject, path=None):
    from core.inference.turn_changes import ChangeConflict
    root, access = _change_scope(thread_id)
    if (action == "undo" and access != "write") or (action == "begin" and access not in {"write", "write_no_delete"}):
        raise HTTPException(status_code=403, detail="workspace_read_only")
    store = _change_store()
    try:
        if action == "begin":
            return store.begin(str(subject), thread_id, root)
        if action == "review":
            result = store.review(str(subject), thread_id, change_id, root, path)
        else:
            result = getattr(store, action)(str(subject), thread_id, change_id, root)
        if access != "write":
            result["canUndo"] = False
            result["undoReason"] = "workspace_not_writable"
        return result
    except KeyError:
        raise HTTPException(status_code=404, detail="changes_not_found") from None
    except ChangeConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from None


@router.post("/threads/{thread_id}/changes")
def begin_turn_changes(thread_id: str, subject: str = Depends(get_current_subject)):
    return _change_action("begin", thread_id, None, subject)


@router.get("/threads/{thread_id}/changes/{change_id}")
def review_turn_changes(thread_id: str, change_id: str, path: str | None = None, subject: str = Depends(get_current_subject)):
    return _change_action("review", thread_id, change_id, subject, path)


@router.post("/threads/{thread_id}/changes/{change_id}/finish")
def finish_turn_changes(thread_id: str, change_id: str, subject: str = Depends(get_current_subject)):
    return _change_action("finish", thread_id, change_id, subject)


@router.post("/threads/{thread_id}/changes/{change_id}/undo")
def undo_turn_changes(thread_id: str, change_id: str, subject: str = Depends(get_current_subject)):
    return _change_action("undo", thread_id, change_id, subject)

@router.get("/threads/{thread_id}/workspace", response_model = ChatThreadWorkspaceBinding | None)
def get_thread_workspace(
    thread_id: str, current_subject: str = Depends(get_current_subject),
):
    if get_chat_thread(thread_id) is None:
        raise HTTPException(status_code = 404, detail = f"Thread {thread_id} not found")
    binding = get_thread_workspace_binding(thread_id)
    return ChatThreadWorkspaceBinding(**binding) if binding else None


@router.put("/threads/{thread_id}/workspace", response_model = ChatThreadWorkspaceBinding)
def bind_thread_workspace(
    thread_id: str,
    payload: ChatThreadWorkspacePatch,
    current_subject: str = Depends(get_current_subject),
):
    valid, canonical_path = validate_connectable_folder(payload.folderPath)
    if not valid or canonical_path is None:
        raise HTTPException(status_code = 400, detail = canonical_path or "Invalid workspace folder")
    try:
        stat = os.stat(canonical_path)
        identity = f"{stat.st_dev}:{stat.st_ino}"
        binding = bind_chat_thread_workspace(
            thread_id, canonical_path, os.path.basename(canonical_path) or canonical_path,
            identity, payload.access, int(time.time() * 1000),
        )
    except ValueError as exc:
        raise HTTPException(status_code = 404, detail = str(exc)) from exc
    return ChatThreadWorkspaceBinding(**binding)


@router.delete("/threads/{thread_id}/workspace", status_code = 204)
def unbind_thread_workspace(
    thread_id: str, current_subject: str = Depends(get_current_subject),
):
    if get_chat_thread(thread_id) is None:
        raise HTTPException(status_code = 404, detail = f"Thread {thread_id} not found")
    unbind_chat_thread_workspace(thread_id)


