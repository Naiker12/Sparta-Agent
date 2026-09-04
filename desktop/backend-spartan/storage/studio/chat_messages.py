"""Chat messages storage, sync, conflicts, and guards."""

import json
import logging
import sqlite3
from typing import Optional

from storage.studio.connection import get_connection, _SQLITE_IN_CHUNK_SIZE
from storage.studio.chat_attachments import (
    _content_part_id,
    _ensure_chat_attachment_inventory_current,
    _mark_chat_attachment_inventory_clean,
    _replace_chat_attachment_inventory,
)
from storage.studio.chat_forks import _parents_of, _reseat_protected_messages
from storage.studio.exceptions import (
    ChatMessageConflictError,
    ChatMessageProtectedError,
)

logger = logging.getLogger(__name__)


def _json_loads(value: str | None, fallback):
    if value is None:
        return fallback
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return fallback


def _chat_message_from_row(row: sqlite3.Row) -> dict:
    data = dict(row)
    message = {
        "id": data["id"],
        "threadId": data["thread_id"],
        "parentId": data.get("parent_id"),
        "role": data["role"],
        "content": _json_loads(data.get("content_json"), []),
        "createdAt": data["created_at"],
    }
    attachments = _json_loads(data.get("attachments_json"), None)
    metadata = _json_loads(data.get("metadata_json"), None)
    if attachments is not None:
        message["attachments"] = attachments
    if metadata is not None:
        message["metadata"] = metadata
    return message


def _raise_if_chat_message_thread_conflicts(
    conn: sqlite3.Connection, thread_id: str, message_ids: list[str]
) -> None:
    unique_ids = list(dict.fromkeys(message_ids))
    if not unique_ids:
        return
    conflicts: list[str] = []
    for start in range(0, len(unique_ids), _SQLITE_IN_CHUNK_SIZE):
        chunk = unique_ids[start : start + _SQLITE_IN_CHUNK_SIZE]
        placeholders = ",".join("?" for _ in chunk)
        rows = conn.execute(
            f"""
            SELECT id FROM chat_messages
            WHERE id IN ({placeholders}) AND thread_id != ?
            ORDER BY id
            """,
            (*chunk, thread_id),
        ).fetchall()
        conflicts.extend(row["id"] for row in rows)
    if conflicts:
        preview = ", ".join(conflicts[:5])
        suffix = "" if len(conflicts) <= 5 else f" (+{len(conflicts) - 5} more)"
        raise ChatMessageConflictError(
            f"Message id already belongs to another thread: {preview}{suffix}"
        )


def _bump_chat_thread_updated_at(
    conn: sqlite3.Connection, thread_id: str, message_created_at: int
) -> None:
    conn.execute(
        """
        UPDATE chat_threads
        SET updated_at = MAX(COALESCE(updated_at, created_at), ?)
        WHERE id = ?
        """,
        (message_created_at, thread_id),
    )


def _recompute_chat_thread_updated_at(conn: sqlite3.Connection, thread_id: str) -> None:
    """Set updated_at from the remaining messages, floored at created_at.

    Unlike the ratchet-only bump, this can lower updated_at -- needed after
    pruning, which may delete the thread's newest message.
    """
    conn.execute(
        """
        UPDATE chat_threads
        SET updated_at = MAX(
            COALESCE(
                (
                    SELECT MAX(m.created_at) FROM chat_messages m
                    WHERE m.thread_id = chat_threads.id
                ),
                created_at
            ),
            created_at
        )
        WHERE id = ?
        """,
        (thread_id,),
    )


def _research_message_ids(conn: sqlite3.Connection, thread_id: str) -> set[str]:
    return {
        str(message_id)
        for row in conn.execute(
            "SELECT user_message_id, assistant_message_id FROM research_runs WHERE thread_id = ?",
            (thread_id,),
        ).fetchall()
        for message_id in row
        if message_id is not None
    }


def _surviving_parent_id(
    conn: sqlite3.Connection, thread_id: str, message_id: str, pruned: set
) -> "str | None":
    """The stored ancestor a message relinks to once `pruned` is deleted, or None at the root.

    Walking the stored chain server side is what makes the relink allowance safe: the expected
    parent is derived from rows the server already holds, so a client cannot smuggle an arbitrary
    link past the guard by claiming its old parent went away.
    """
    seen = {message_id}
    row = conn.execute(
        "SELECT parent_id FROM chat_messages WHERE thread_id = ? AND id = ?",
        (thread_id, message_id),
    ).fetchone()
    parent = row["parent_id"] if row is not None else None
    while parent and str(parent) in pruned:
        if str(parent) in seen:
            # A cycle can only come from a corrupt thread; stop rather than spin.
            return None
        seen.add(str(parent))
        row = conn.execute(
            "SELECT parent_id FROM chat_messages WHERE thread_id = ? AND id = ?",
            (thread_id, str(parent)),
        ).fetchone()
        parent = row["parent_id"] if row is not None else None
    # Normalized the way the caller reads parentId (`or None`), so an empty stored parent_id
    # cannot make the two disagree, and a self-link left by a corrupt chain resolves to the root.
    survivor = str(parent) if parent else None
    return None if survivor == message_id else survivor


def _research_message_would_change(
    conn: sqlite3.Connection,
    thread_id: str,
    message: dict,
    pruned: set = frozenset(),
) -> bool:
    message_id = str(message["id"])
    row = conn.execute(
        "SELECT parent_id, role, content_json, metadata_json, attachments_json, created_at "
        "FROM chat_messages WHERE thread_id = ? AND id = ?",
        (thread_id, message_id),
    ).fetchone()
    if row is None:
        return False

    def canon(value: object) -> str | None:
        return json.dumps(value, sort_keys = True) if value is not None else None

    stored_parent = row["parent_id"] or None
    sent_parent = message.get("parentId") or None
    parent_changed = sent_parent != stored_parent
    if parent_changed and stored_parent is not None and str(stored_parent) in pruned:
        # The same sync is deleting this message's parent, so the client is repairing a link this
        # request is about to break rather than editing a protected message. Only the relink the
        # server itself would compute is accepted; anything else is still a rejected edit.
        parent_changed = sent_parent != _surviving_parent_id(conn, thread_id, message_id, pruned)

    # created_at is compared too: without it a client could re-upsert a protected message with an
    # unchanged body but a different timestamp and silently reorder the research prompt/response
    # pair. Absent createdAt defaults to the stored value (a no-op re-sync).
    return (
        canon(message.get("content", [])) != canon(json.loads(row["content_json"] or "[]"))
        or canon(message.get("metadata"))
        != canon(json.loads(row["metadata_json"]) if row["metadata_json"] else None)
        or canon(message.get("attachments"))
        != canon(json.loads(row["attachments_json"]) if row["attachments_json"] else None)
        or parent_changed
        or str(message.get("role")) != str(row["role"])
        or int(message.get("createdAt", row["created_at"])) != int(row["created_at"])
    )


def _guard_research_messages(
    conn: sqlite3.Connection,
    thread_id: str,
    messages: list[dict],
    pruned: set = frozenset(),
) -> None:
    protected = _research_message_ids(conn, thread_id)
    if not protected:
        return
    for message in messages:
        if str(message["id"]) in protected and _research_message_would_change(
            conn, thread_id, message, pruned
        ):
            raise ChatMessageProtectedError(
                "Research prompts and responses are server-managed and cannot be edited"
            )




def _chat_attachment_tombstones_for_messages(
    conn: sqlite3.Connection, thread_id: str, message_ids: list[str]
) -> dict[str, set[str]]:
    tombstones = {message_id: set() for message_id in message_ids}
    unique_ids = list(dict.fromkeys(message_ids))
    for start in range(0, len(unique_ids), _SQLITE_IN_CHUNK_SIZE):
        chunk = unique_ids[start : start + _SQLITE_IN_CHUNK_SIZE]
        placeholders = ",".join("?" for _ in chunk)
        rows = conn.execute(
            f"""
            SELECT message_id, attachment_id
            FROM chat_attachment_tombstones
            WHERE thread_id = ? AND message_id IN ({placeholders})
            """,
            (thread_id, *chunk),
        ).fetchall()
        for row in rows:
            tombstones[row["message_id"]].add(row["attachment_id"])
    return tombstones


def _reconcile_chat_message_uploads(message: dict, tombstones: set[str]) -> dict:
    """Strip uploads previously deleted through the Data tab from a stale write."""
    if not tombstones:
        return message

    reconciled = dict(message)
    attachments = message.get("attachments")
    if isinstance(attachments, list):
        reconciled["attachments"] = [
            attachment
            for attachment in attachments
            if not (isinstance(attachment, dict) and str(attachment.get("id") or "") in tombstones)
        ]

    content = message.get("content")
    if isinstance(content, list):
        reconciled["content"] = [
            part
            for part in content
            if not (isinstance(part, dict) and (_content_part_id(part) or "") in tombstones)
        ]
    return reconciled



def upsert_chat_message(message: dict, *, allow_research_update: bool = False) -> dict:
    conn = get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        _ensure_chat_attachment_inventory_current(conn)
        if not allow_research_update:
            _guard_research_messages(conn, message["threadId"], [message])
        _raise_if_chat_message_thread_conflicts(
            conn,
            message["threadId"],
            [message["id"]],
        )
        tombstones = _chat_attachment_tombstones_for_messages(
            conn,
            message["threadId"],
            [message["id"]],
        )
        reconciled = _reconcile_chat_message_uploads(
            message,
            tombstones.get(message["id"], set()),
        )
        content_json = json.dumps(reconciled.get("content", []))
        attachments_json = (
            json.dumps(reconciled.get("attachments"))
            if reconciled.get("attachments") is not None
            else None
        )
        conn.execute(
            """
            INSERT INTO chat_messages
                (id, thread_id, parent_id, role, content_json, attachments_json, metadata_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                parent_id = excluded.parent_id,
                role = excluded.role,
                content_json = excluded.content_json,
                attachments_json = excluded.attachments_json,
                metadata_json = excluded.metadata_json,
                created_at = excluded.created_at
            WHERE excluded.thread_id = chat_messages.thread_id
            """,
            (
                reconciled["id"],
                reconciled["threadId"],
                reconciled.get("parentId"),
                reconciled["role"],
                content_json,
                attachments_json,
                json.dumps(reconciled.get("metadata"))
                if reconciled.get("metadata") is not None
                else None,
                int(reconciled["createdAt"]),
            ),
        )
        _replace_chat_attachment_inventory(
            conn,
            reconciled["id"],
            attachments_json,
            content_json,
        )
        _bump_chat_thread_updated_at(
            conn,
            reconciled["threadId"],
            int(reconciled["createdAt"]),
        )
        _mark_chat_attachment_inventory_clean(conn)
        conn.commit()
        return reconciled
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def sync_chat_messages(
    thread_id: str,
    messages: list[dict],
    prune_missing: bool = False,
    *,
    allow_research_update: bool = False,
) -> list[dict]:
    conn = get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        _ensure_chat_attachment_inventory_current(conn)
        # Research messages are server-managed: keep the server record rather than reject the
        # batch on client drift. No _guard_research_messages call here as a result -- these ids
        # never reach it. upsert_chat_message still guards, so the single-message route keeps
        # rejecting edits.
        research_ids = _research_message_ids(conn, thread_id)
        # The rows this sync will delete, computed before the upsert so a relink forced by
        # that deletion can be told apart from an edit. Research ids are subtracted because
        # the delete below exempts them: counting one as pruned would walk the reseat past a
        # parent that actually survives, detaching a research turn from its own prompt.
        pruned: set = set()
        if prune_missing:
            retained = {str(m["id"]) for m in messages}
            pruned = (
                {
                    str(row["id"])
                    for row in conn.execute(
                        "SELECT id FROM chat_messages WHERE thread_id = ?",
                        (thread_id,),
                    ).fetchall()
                }
                - retained
                - research_ids
            )
        protected = set() if allow_research_update else research_ids
        messages = [m for m in messages if str(m["id"]) not in protected]
        # Content is dropped, structure is not: the prune below can delete a research
        # message's parent, and a dangling parent makes the whole thread unimportable. The
        # replacement is walked from the stored chain, never taken from the client.
        #
        # Candidates come from research_ids rather than `protected` because the delete exempts
        # research rows whatever allow_research_update says, so a narrower set would leave one
        # dangling. Ids the batch itself writes are excluded: an authorized caller reparenting
        # a research row must not have that overwritten by the repair.
        reseat_candidates = research_ids - {str(m["id"]) for m in messages}
        reseat_parents = {
            message_id: _surviving_parent_id(conn, thread_id, message_id, pruned)
            for message_id, stored_parent in _parents_of(conn, thread_id, reseat_candidates).items()
            if stored_parent is not None and stored_parent in pruned
        }
        _raise_if_chat_message_thread_conflicts(
            conn,
            thread_id,
            [m["id"] for m in messages],
        )
        tombstones = _chat_attachment_tombstones_for_messages(
            conn,
            thread_id,
            [m["id"] for m in messages],
        )
        reconciled_messages = [
            _reconcile_chat_message_uploads(m, tombstones.get(m["id"], set())) for m in messages
        ]
        serialized_messages = [
            (
                m,
                json.dumps(m.get("content", [])),
                json.dumps(m.get("attachments")) if m.get("attachments") is not None else None,
            )
            for m in reconciled_messages
        ]
        conn.executemany(
            """
            INSERT INTO chat_messages
                (id, thread_id, parent_id, role, content_json, attachments_json, metadata_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                parent_id = excluded.parent_id,
                role = excluded.role,
                content_json = excluded.content_json,
                attachments_json = excluded.attachments_json,
                metadata_json = excluded.metadata_json,
                created_at = excluded.created_at
            WHERE excluded.thread_id = chat_messages.thread_id
            """,
            [
                (
                    m["id"],
                    thread_id,
                    m.get("parentId"),
                    m["role"],
                    content_json,
                    attachments_json,
                    json.dumps(m.get("metadata")) if m.get("metadata") is not None else None,
                    int(m["createdAt"]),
                )
                for m, content_json, attachments_json in serialized_messages
            ],
        )
        for m, content_json, attachments_json in serialized_messages:
            _replace_chat_attachment_inventory(
                conn,
                m["id"],
                attachments_json,
                content_json,
            )
        if prune_missing:
            retained_ids = {m["id"] for m in reconciled_messages}
            existing_ids = {
                row["id"]
                for row in conn.execute(
                    "SELECT id FROM chat_messages WHERE thread_id = ?",
                    (thread_id,),
                ).fetchall()
            }
            # Update permission is not delete permission: prune-exempt even for
            # allow_research_update callers.
            missing_ids = sorted(existing_ids - retained_ids - research_ids)
            for start in range(0, len(missing_ids), _SQLITE_IN_CHUNK_SIZE):
                chunk = missing_ids[start : start + _SQLITE_IN_CHUNK_SIZE]
                placeholders = ",".join("?" for _ in chunk)
                conn.execute(
                    f"DELETE FROM chat_messages WHERE thread_id = ? AND id IN ({placeholders})",
                    (thread_id, *chunk),
                )
            _reseat_protected_messages(conn, thread_id, reseat_parents)
            _recompute_chat_thread_updated_at(conn, thread_id)
        elif reconciled_messages:
            _bump_chat_thread_updated_at(
                conn,
                thread_id,
                max(int(m["createdAt"]) for m in reconciled_messages),
            )
        _mark_chat_attachment_inventory_clean(conn)
        conn.commit()
        return list_chat_messages(thread_id)
    except (ChatMessageConflictError, ChatMessageProtectedError):
        conn.rollback()
        raise
    except sqlite3.Error:
        logger.exception("Failed to sync chat messages for thread %s", thread_id)
        conn.rollback()
        raise
    finally:
        conn.close()



def list_chat_messages(thread_id: str) -> list[dict]:
    conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT * FROM chat_messages
            WHERE thread_id = ?
            ORDER BY created_at ASC, id ASC
            """,
            (thread_id,),
        ).fetchall()
        return [_chat_message_from_row(row) for row in rows]
    finally:
        conn.close()


def get_chat_message(thread_id: str, message_id: str) -> Optional[dict]:
    conn = get_connection()
    try:
        row = conn.execute(
            """
            SELECT * FROM chat_messages
            WHERE thread_id = ? AND id = ?
            """,
            (thread_id, message_id),
        ).fetchone()
        return _chat_message_from_row(row) if row is not None else None
    finally:
        conn.close()



def list_chat_messages_for_threads(thread_ids: list[str]) -> list[dict]:
    if not thread_ids:
        return []
    unique_thread_ids = list(dict.fromkeys(thread_ids))
    messages: list[dict] = []
    conn = get_connection()
    try:
        for start in range(0, len(unique_thread_ids), _SQLITE_IN_CHUNK_SIZE):
            chunk = unique_thread_ids[start : start + _SQLITE_IN_CHUNK_SIZE]
            placeholders = ",".join("?" for _ in chunk)
            rows = conn.execute(
                f"""
                SELECT * FROM chat_messages
                WHERE thread_id IN ({placeholders})
                ORDER BY created_at ASC, id ASC
                """,
                chunk,
            ).fetchall()
            messages.extend(_chat_message_from_row(row) for row in rows)
        return sorted(
            messages,
            key = lambda message: (message["createdAt"], message["id"]),
        )
    finally:
        conn.close()


