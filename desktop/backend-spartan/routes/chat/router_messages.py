"""FastAPI route handlers for chat messages and batch retrieval."""

import sqlite3
from fastapi import APIRouter, Depends, HTTPException

from auth.authentication import get_current_subject
from loggers import get_logger
from storage.studio_db import (
    ChatMessageConflictError,
    ChatMessageProtectedError,
    get_chat_message,
    get_chat_thread,
    list_chat_messages,
    list_chat_messages_for_threads,
    sync_chat_messages,
    upsert_chat_message,
)
from utils.utils import log_and_http_error, safe_curated_detail
from routes.chat.schemas import (
    ChatMessage,
    ChatMessageListResponse,
    ChatMessageSyncRequest,
    ChatMessagesBatchRequest,
    ChatMessagesBatchResponse,
)
from routes.chat.helpers import _missing_thread_error

logger = get_logger(__name__)
router = APIRouter()

@router.get("/threads/{thread_id}/messages", response_model = ChatMessageListResponse)
def get_thread_messages(thread_id: str, current_subject: str = Depends(get_current_subject)):
    if get_chat_thread(thread_id) is None:
        raise HTTPException(status_code = 404, detail = f"Thread {thread_id} not found")
    return ChatMessageListResponse(
        messages = [ChatMessage(**m) for m in list_chat_messages(thread_id)]
    )


@router.post("/messages:batch", response_model = ChatMessagesBatchResponse)
def batch_thread_messages(
    payload: ChatMessagesBatchRequest, current_subject: str = Depends(get_current_subject)
):
    """One round-trip per sidebar/search rebuild instead of N. Unknown thread ids return empty lists."""
    by_thread: dict[str, list[ChatMessage]] = {tid: [] for tid in payload.threadIds}
    for m in list_chat_messages_for_threads(payload.threadIds):
        tid = m["threadId"]
        if tid in by_thread:
            by_thread[tid].append(ChatMessage(**m))
    return ChatMessagesBatchResponse(messagesByThreadId = by_thread)


@router.get("/threads/{thread_id}/messages/{message_id}", response_model = ChatMessage)
def get_thread_message(
    thread_id: str,
    message_id: str,
    current_subject: str = Depends(get_current_subject),
):
    if get_chat_thread(thread_id) is None:
        raise HTTPException(status_code = 404, detail = f"Thread {thread_id} not found")
    message = get_chat_message(thread_id, message_id)
    if message is None:
        raise HTTPException(status_code = 404, detail = f"Message {message_id} not found")
    return ChatMessage(**message)


@router.put("/threads/{thread_id}/messages/{message_id}", response_model = ChatMessage)
def save_thread_message(
    thread_id: str,
    message_id: str,
    payload: ChatMessage,
    current_subject: str = Depends(get_current_subject),
):
    if thread_id != payload.threadId or message_id != payload.id:
        raise HTTPException(status_code = 400, detail = "Message id mismatch")
    if get_chat_thread(thread_id) is None:
        raise HTTPException(status_code = 404, detail = f"Thread {thread_id} not found")
    try:
        return ChatMessage(**upsert_chat_message(payload.model_dump()))
    except sqlite3.IntegrityError as exc:
        if get_chat_thread(thread_id) is None:
            raise _missing_thread_error(thread_id) from exc
        raise
    except (ChatMessageConflictError, ChatMessageProtectedError) as exc:
        raise log_and_http_error(
            exc,
            409,
            safe_curated_detail(exc),
            event = "chat_history.save_message_conflict",
            log = logger,
        ) from exc


@router.put("/threads/{thread_id}/messages", response_model = ChatMessageListResponse)
def replace_thread_messages(
    thread_id: str,
    payload: ChatMessageSyncRequest,
    current_subject: str = Depends(get_current_subject),
):
    mismatched_ids = [message.id for message in payload.messages if message.threadId != thread_id]
    if mismatched_ids:
        preview = ", ".join(mismatched_ids[:5])
        suffix = "" if len(mismatched_ids) <= 5 else f" (+{len(mismatched_ids) - 5} more)"
        raise HTTPException(
            status_code = 400,
            detail = f"Message threadId mismatch: {preview}{suffix}",
        )
    if get_chat_thread(thread_id) is None:
        raise HTTPException(status_code = 404, detail = f"Thread {thread_id} not found")
    messages = [message.model_dump() for message in payload.messages]
    try:
        return ChatMessageListResponse(
            messages = [
                ChatMessage(**m)
                for m in sync_chat_messages(
                    thread_id,
                    messages,
                    prune_missing = payload.pruneMissing,
                )
            ]
        )
    except sqlite3.IntegrityError as exc:
        if get_chat_thread(thread_id) is None:
            raise _missing_thread_error(thread_id) from exc
        raise
    except (ChatMessageConflictError, ChatMessageProtectedError) as exc:
        raise log_and_http_error(
            exc,
            409,
            safe_curated_detail(exc),
            event = "chat_history.replace_messages_conflict",
            log = logger,
        ) from exc


