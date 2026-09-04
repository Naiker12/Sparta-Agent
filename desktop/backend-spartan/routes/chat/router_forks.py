"""FastAPI route handlers for chat thread branching (forking)."""

import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException

from auth.authentication import get_current_subject
from storage.studio_db import (
    ChatThreadDeletedError,
    count_forks_for_message,
    fork_chat_thread,
    fork_counts_for_thread,
    get_chat_message,
    get_chat_thread,
    list_chat_messages,
)
from routes.chat.schemas import (
    ChatForkCountResponse,
    ChatForkRequest,
    ChatForkResponse,
    ChatMessage,
    ChatThreadForkCountsResponse,
)
from routes.chat.helpers import _deleted_thread_error, thread_from_row

router = APIRouter()

@router.post("/threads/{thread_id}/fork", response_model = ChatForkResponse)
def fork_thread(
    thread_id: str,
    payload: ChatForkRequest,
    current_subject: str = Depends(get_current_subject),
):
    """Fork a thread at `messageId` -- creates a new thread with
    ancestor msgs [root..messageId] copied with fresh ids. Both
    code-exec container ids reset on the fork. OpenAI snapshot is a
    best-effort enhancement; failure surfaces as
    `containerSnapshotWarning` and the fork still succeeds with a
    clean sandbox.
    """
    import uuid

    source = get_chat_thread(thread_id)
    if source is None:
        raise HTTPException(status_code = 404, detail = f"Thread {thread_id} not found")
    if get_chat_message(thread_id, payload.messageId) is None:
        raise HTTPException(
            status_code = 404,
            detail = f"Message {payload.messageId} not found in thread {thread_id}",
        )
    base_title = source.get("title") or "New Chat"
    new_title = f"fork · {base_title}"
    try:
        forked = fork_chat_thread(
            source_thread_id = thread_id,
            branch_message_id = payload.messageId,
            new_thread_id = payload.newThreadId,
            new_title = new_title,
            created_at = payload.createdAt,
            id_factory = lambda: str(uuid.uuid4()),
        )
    except ChatThreadDeletedError as exc:
        raise _deleted_thread_error(payload.newThreadId) from exc
    if forked is None:
        # The source can be deleted between the reads above and the fork transaction, which the
        # threadpool lets run concurrently. Report it gone rather than as a server fault.
        raise HTTPException(status_code = 404, detail = f"Thread {thread_id} not found")
    messages = list_chat_messages(payload.newThreadId)
    # Best-effort OpenAI container snapshot. Stub: a follow-up patch can
    # call /v1/containers list+download / create+upload here and patch
    # the new openaiCodeExecContainerId. For v1 we always start clean
    # and surface the same warning regardless of provider so the UI can
    # show a consistent "sandbox starts fresh" toast.
    warning: Optional[str] = None
    if source.get("openaiCodeExecContainerId") or source.get("anthropicCodeExecContainerId"):
        warning = "Sandbox starts fresh in fork; files from parent are not carried over."
    return ChatForkResponse(
        thread = thread_from_row(forked),
        messages = [ChatMessage(**m) for m in messages],
        containerSnapshotWarning = warning,
    )


@router.get(
    "/threads/{thread_id}/messages/{message_id}/forks",
    response_model = ChatForkCountResponse,
)
def get_fork_count(
    thread_id: str,
    message_id: str,
    current_subject: str = Depends(get_current_subject),
):
    return ChatForkCountResponse(count = count_forks_for_message(thread_id, message_id))


@router.get(
    "/threads/{thread_id}/forks",
    response_model = ChatThreadForkCountsResponse,
)
def get_thread_fork_counts(thread_id: str, current_subject: str = Depends(get_current_subject)):
    """Every fork count of a thread in one read, so a rendered thread costs one request."""
    return ChatThreadForkCountsResponse(counts = fork_counts_for_thread(thread_id))


