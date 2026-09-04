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


