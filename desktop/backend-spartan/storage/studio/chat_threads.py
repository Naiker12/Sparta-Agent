"""Chat threads storage, workspace bindings, listings, settings snapshots, and deletions."""

import json
import logging
import sqlite3
import uuid
from datetime import datetime, timezone
from typing import Any, Iterable, Optional

from storage.studio.connection import (
    get_connection,
    _CONTENDED_BUSY_TIMEOUT_SECONDS,
    _SQLITE_IN_CHUNK_SIZE,
)
from storage.studio.chat_attachments import (
    _ensure_chat_attachment_inventory_current,
    _mark_chat_attachment_inventory_clean,
)
from storage.studio.chat_forks import (
    _chat_thread_from_row,
    _json_loads,
    _raise_if_chat_thread_deleted,
)
from storage.studio.exceptions import (
    ChatThreadDeletedError,
    ChatThreadPreconditionFailed,
)

logger = logging.getLogger(__name__)

_MAX_SETTINGS_WRITERS = 32

_OPENING_USER_MESSAGE = """(
    SELECT id FROM chat_messages
    WHERE thread_id = ? AND role = 'user'
    ORDER BY created_at ASC, id ASC LIMIT 1
) IS ?"""

_ACTIVE_RESEARCH_RUN_STATUSES = (
    "planning",
    "running",
    "cancelling",
)


def _workspace_from_row(row: sqlite3.Row) -> dict:
    data = dict(row)
    return {
        "id": data["id"],
        "displayName": data["display_name"],
        "canonicalPath": data["canonical_path"],
        "filesystemIdentity": data.get("filesystem_identity"),
        "createdAt": data["created_at"],
        "updatedAt": data["updated_at"],
        "lastUsedAt": data.get("last_used_at"),
    }


def _tombstone_chat_threads(conn: sqlite3.Connection, thread_ids: Iterable[str]) -> None:
    deleted_at = int(datetime.now(timezone.utc).timestamp() * 1000)
    conn.executemany(
        """
        INSERT INTO chat_thread_tombstones (id, deleted_at)
        VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET deleted_at = excluded.deleted_at
        """,
        [(thread_id, deleted_at) for thread_id in sorted(set(thread_ids))],
    )


def _active_research_run_ids(
    conn: sqlite3.Connection, thread_ids: set[str] | None = None
) -> list[str]:
    status_placeholders = ",".join("?" for _ in _ACTIVE_RESEARCH_RUN_STATUSES)
    if thread_ids is None:
        rows = conn.execute(
            f"""
            SELECT id, created_at FROM research_runs
            WHERE status IN ({status_placeholders}) AND lease_owner IS NOT NULL
            """,
            _ACTIVE_RESEARCH_RUN_STATUSES,
        ).fetchall()
    else:
        rows = []
        sorted_thread_ids = sorted(thread_ids)
        for start in range(0, len(sorted_thread_ids), _SQLITE_IN_CHUNK_SIZE):
            chunk = sorted_thread_ids[start : start + _SQLITE_IN_CHUNK_SIZE]
            thread_placeholders = ",".join("?" for _ in chunk)
            rows.extend(
                conn.execute(
                    f"SELECT id, created_at FROM research_runs "
                    f"WHERE thread_id IN ({thread_placeholders}) "
                    f"AND status IN ({status_placeholders}) "
                    f"AND lease_owner IS NOT NULL",
                    (*chunk, *_ACTIVE_RESEARCH_RUN_STATUSES),
                ).fetchall()
            )
    return [row["id"] for row in sorted(rows, key=lambda row: (row["created_at"], row["id"]))]


def _json_loads(value: str | None, fallback):
    if value is None:
        return fallback
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return fallback


def _chat_thread_from_row(row: sqlite3.Row, include_settings: bool = True) -> dict:
    data = dict(row)
    thread = {
        "id": data["id"],
        "title": data["title"],
        "modelType": data["model_type"],
        "modelId": data.get("model_id") or "",
        "pairId": data.get("pair_id") or None,
        "projectId": data.get("project_id") or None,
        "archived": bool(data["archived"]),
        "createdAt": data["created_at"],
        "updatedAt": data.get("updated_at")
        if data.get("updated_at") is not None
        else data["created_at"],
        "openaiCodeExecContainerId": data.get("openai_code_exec_container_id"),
        "anthropicCodeExecContainerId": data.get("anthropic_code_exec_container_id"),
        "forkedFromThreadId": data.get("forked_from_thread_id"),
        "forkedFromMessageId": data.get("forked_from_message_id"),
    }
    if include_settings:
        thread["settings"] = _json_loads(data.get("settings_json"), None)
    return thread


def _chat_project_from_row(row: sqlite3.Row) -> dict:
    data = dict(row)
    root_path = data.get("root_path")
    return {
        "id": data["id"],
        "name": data["name"],
        "instructions": data.get("instructions") or "",
        "rootPath": root_path or None,
        "sandboxPath": os.path.join(root_path, "sandbox") if root_path else None,
        "connectedFolderPath": data.get("connected_folder_path") or None,
        "workspaceAccess": data.get("workspace_access") or "read",
        "archived": bool(data["archived"]),
        "createdAt": data["created_at"],
        "updatedAt": data["updated_at"],
    }


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


class ChatThreadDeletedError(RuntimeError):
    """Raised when a stale writer tries to recreate a deleted thread id."""


def _raise_if_chat_thread_deleted(conn: sqlite3.Connection, thread_id: str) -> None:
    row = conn.execute(
        "SELECT 1 FROM chat_thread_tombstones WHERE id = ?",
        (thread_id,),
    ).fetchone()
    if row is not None:
        raise ChatThreadDeletedError(thread_id)


def upsert_chat_thread(thread: dict) -> dict:
    conn = get_connection(_CONTENDED_BUSY_TIMEOUT_SECONDS)
    try:
        conn.execute("BEGIN IMMEDIATE")
        _raise_if_chat_thread_deleted(conn, thread["id"])
        conn.execute(
            """
            INSERT INTO chat_threads
                (id, title, model_type, model_id, pair_id, project_id, archived, created_at, updated_at, openai_code_exec_container_id, anthropic_code_exec_container_id, forked_from_thread_id, forked_from_message_id, settings_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                model_type = excluded.model_type,
                model_id = excluded.model_id,
                pair_id = excluded.pair_id,
                project_id = excluded.project_id,
                archived = excluded.archived,
                created_at = excluded.created_at,
                updated_at = COALESCE(excluded.updated_at, chat_threads.updated_at),
                openai_code_exec_container_id = excluded.openai_code_exec_container_id,
                anthropic_code_exec_container_id = excluded.anthropic_code_exec_container_id,
                forked_from_thread_id = excluded.forked_from_thread_id,
                forked_from_message_id = excluded.forked_from_message_id,
                -- an absent snapshot keeps the stored one: most writers rebuild the record without it.
                settings_json = COALESCE(excluded.settings_json, chat_threads.settings_json)
            """,
            (
                thread["id"],
                thread.get("title") or "New Chat",
                thread["modelType"],
                thread.get("modelId") or "",
                thread.get("pairId"),
                thread.get("projectId"),
                1 if thread.get("archived") else 0,
                int(thread["createdAt"]),
                int(thread["updatedAt"]) if thread.get("updatedAt") is not None else None,
                thread.get("openaiCodeExecContainerId"),
                thread.get("anthropicCodeExecContainerId"),
                thread.get("forkedFromThreadId"),
                thread.get("forkedFromMessageId"),
                json.dumps(thread["settings"]) if thread.get("settings") is not None else None,
            ),
        )
        conn.commit()
        return get_chat_thread(thread["id"]) or thread
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


class ChatThreadPreconditionFailed(Exception):
    """The thread changed between the caller reading it and writing it."""


# Same order the title migration picks its opening message in.
# Watermarks kept per thread, one per tab that has written its settings.
_MAX_SETTINGS_WRITERS = 32

_OPENING_USER_MESSAGE = """(
    SELECT id FROM chat_messages
    WHERE thread_id = ? AND role = 'user'
    ORDER BY created_at ASC, id ASC LIMIT 1
) IS ?"""


def update_chat_thread(
    id: str,
    patch: dict,
    expected_title: Optional[str] = None,
    expected_opening_message_id: Optional[str] = None,
    settings_write: Optional[dict] = None,
) -> Optional[dict]:
    """Patch a thread. With expected_title, the write only lands while the row
    still holds that title, so a concurrent rename wins instead of being lost.
    expected_opening_message_id guards a title derived from that message: if it
    is gone, the write is rejected rather than expanding deleted text."""
    allowed = {
        "title": ("title", patch.get("title")),
        "modelType": ("model_type", patch.get("modelType")),
        "modelId": ("model_id", patch.get("modelId")),
        "pairId": ("pair_id", patch.get("pairId")),
        "projectId": ("project_id", patch.get("projectId")),
        "archived": ("archived", 1 if patch.get("archived") else 0),
        "createdAt": ("created_at", patch.get("createdAt")),
        "updatedAt": ("updated_at", patch.get("updatedAt")),
        "openaiCodeExecContainerId": (
            "openai_code_exec_container_id",
            patch.get("openaiCodeExecContainerId"),
        ),
        "anthropicCodeExecContainerId": (
            "anthropic_code_exec_container_id",
            patch.get("anthropicCodeExecContainerId"),
        ),
        "forkedFromThreadId": (
            "forked_from_thread_id",
            patch.get("forkedFromThreadId"),
        ),
        "forkedFromMessageId": (
            "forked_from_message_id",
            patch.get("forkedFromMessageId"),
        ),
        "settings": (
            "settings_json",
            json.dumps(patch["settings"]) if patch.get("settings") is not None else None,
        ),
    }
    assignments = []
    values = []
    for key, (column, value) in allowed.items():
        if key in patch:
            assignments.append(f"{column} = ?")
            values.append(value)
    if not assignments and settings_write is None:
        return get_chat_thread(id)

    conn = get_connection()
    try:
        # The snapshot rides in the same transaction as the guarded metadata write, or a
        # rejected precondition returns 409 with the settings change already committed.
        conn.execute("BEGIN IMMEDIATE")
        # Guards ride in the WHERE clause, so check and write are one statement.
        where = ["id = ?"]
        guard: list = [id]
        if expected_title is not None:
            where.append("title = ?")
            guard.append(expected_title)
        if expected_opening_message_id is not None:
            where.append(_OPENING_USER_MESSAGE)
            guard += [id, expected_opening_message_id]
        guarded = expected_title is not None or expected_opening_message_id is not None
        applied = 1
        if assignments:
            cursor = conn.execute(
                f"UPDATE chat_threads SET {', '.join(assignments)} WHERE {' AND '.join(where)}",
                (*values, *guard),
            )
            applied = cursor.rowcount
        if guarded and applied == 0:
            conn.rollback()
            if conn.execute("SELECT 1 FROM chat_threads WHERE id = ?", (id,)).fetchone() is None:
                return None
            raise ChatThreadPreconditionFailed(id)
        if settings_write is not None:
            if _write_chat_thread_settings_in_conn(conn, id, **settings_write) is None:
                conn.rollback()
                return None
        conn.commit()
        row = conn.execute("SELECT * FROM chat_threads WHERE id = ?", (id,)).fetchone()
        if row is None:
            return None
        return _chat_thread_from_row(row)
    finally:
        conn.close()


def _write_chat_thread_settings_in_conn(
    conn,
    id: str,
    *,
    replace: Optional[dict] = None,
    merge: Optional[dict] = None,
    clear: bool = False,
    seq: Optional[int] = None,
    writer: Optional[str] = None,
    keep_unreadable = None,
) -> Optional[bool]:
    """The snapshot write itself, on a connection whose transaction the caller owns.

    None when the row is gone. True when it wrote, False when an older write from the
    same writer was refused; both leave the caller's transaction usable.

    The all-or-nothing the caller wants is about FAILURE: a rejected metadata
    precondition must not leave the settings committed, and a missing row must write
    nothing. A refusal is not a failure. It means this writer has already landed a newer
    snapshot, so the row holds what the writer wanted either way, and rolling the
    metadata back with it would drop a rename the client sent in the same PATCH and got
    a 200 for.
    """
    row = conn.execute(
        "SELECT settings_json, settings_seqs FROM chat_threads WHERE id = ?",
        (id,),
    ).fetchone()
    if row is None:
        return None
    seqs = _json_loads(row["settings_seqs"], None) if "settings_seqs" in row.keys() else None
    seqs = seqs if isinstance(seqs, dict) else {}
    if seq is not None and writer is not None:
        seen = seqs.get(writer)
        if isinstance(seen, int) and seq <= seen:
            # This writer has already had a newer snapshot stored; this one is the
            # straggler. Held per writer, so a write from another tab in between does
            # not wipe the watermark this comparison depends on.
            return False
        # Re-inserted, not just assigned, so this writer moves to the end and the map
        # stays in least-recently-used order.
        seqs.pop(writer, None)
        seqs[writer] = seq
        # One entry per tab that has ever written, so bound it. Evicted by last use and
        # never by counter: every session starts its own counter at 1, so comparing them
        # across writers would throw out the newest tab and keep long-dead ones, leaving
        # the active writer with no watermark for its own stragglers to be refused by.
        while len(seqs) > _MAX_SETTINGS_WRITERS:
            seqs.pop(next(iter(seqs)))
    stored = _json_loads(row["settings_json"], None)
    stored = stored if isinstance(stored, dict) else {}
    if clear:
        settings_json = None
    else:
        if merge is not None:
            base = stored
            changes = merge
        else:
            base = keep_unreadable(stored) if keep_unreadable else {}
            changes = replace or {}
        settings_json = json.dumps({**base, **changes})
    conn.execute(
        "UPDATE chat_threads SET settings_json = ?, settings_seqs = ? WHERE id = ?",
        (settings_json, json.dumps(seqs) if seqs else None, id),
    )
    return True


def write_chat_thread_settings(
    id: str,
    *,
    replace: Optional[dict] = None,
    merge: Optional[dict] = None,
    clear: bool = False,
    seq: Optional[int] = None,
    writer: Optional[str] = None,
    keep_unreadable = None,
) -> Optional[dict]:
    """Write a thread's settings snapshot, reading and merging in one transaction.

    Doing the read in the route and the write here lets two requests on the same thread,
    two tabs or a tab closing behind an open one, both turn a partial patch into a full
    replacement built from the same stale snapshot, and the second one lands on top. The
    read, the merge and the write have to be one transaction, so they are.

    `writer` and `seq` order the writes, and only ever against the same writer's own
    earlier ones: a write is dropped when it comes from the writer whose snapshot is
    already stored and carries a seq no newer than it. Two browsers are never compared,
    because their clocks and counters have nothing to do with each other and the one that
    happened to be behind would have every edit silently refused. Within one writer the
    ordering is real, which is the case that needs it: an aborted fetch does not stop a
    handler the server has already started.

    `keep_unreadable(stored) -> dict` names the part of the stored snapshot the caller
    could not read, which a replacement carries forward rather than deleting. Passed in
    rather than imported so this module stays free of the wire models.
    """
    conn = get_connection()
    try:
        # IMMEDIATE takes the write lock up front, so the read below cannot be overtaken.
        conn.execute("BEGIN IMMEDIATE")
        applied = _write_chat_thread_settings_in_conn(
            conn,
            id,
            replace = replace,
            merge = merge,
            clear = clear,
            seq = seq,
            writer = writer,
            keep_unreadable = keep_unreadable,
        )
        if applied is None:
            conn.rollback()
            return None
        conn.commit()
        row = conn.execute("SELECT * FROM chat_threads WHERE id = ?", (id,)).fetchone()
        return _chat_thread_from_row(row) if row is not None else None
    finally:
        conn.close()


def get_chat_thread(id: str) -> Optional[dict]:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM chat_threads WHERE id = ?", (id,)).fetchone()
        return _chat_thread_from_row(row) if row is not None else None
    finally:
        conn.close()




def get_thread_workspace_binding(thread_id: str) -> Optional[dict]:
    conn = get_connection()
    try:
        row = conn.execute(
            "SELECT b.id AS binding_id, b.thread_id, b.access, b.created_at AS binding_created_at, "
            "b.updated_at AS binding_updated_at, w.* "
            "FROM chat_workspace_bindings b JOIN chat_workspaces w ON w.id=b.workspace_id "
            "WHERE b.thread_id=?",
            (thread_id,),
        ).fetchone()
        if row is None:
            return None
        binding = _workspace_from_row(row)
        binding.update({
            "bindingId": row["binding_id"],
            "threadId": row["thread_id"],
            "access": row["access"],
            "boundAt": row["binding_created_at"],
        })
        return binding
    finally:
        conn.close()


def bind_chat_thread_workspace(
    thread_id: str, canonical_path: str, display_name: str, filesystem_identity: str | None,
    access: str, now: int,
) -> dict:
    if access not in {"read", "write", "write_no_delete"}:
        raise ValueError("Invalid workspace access")
    conn = get_connection(_CONTENDED_BUSY_TIMEOUT_SECONDS)
    try:
        conn.execute("BEGIN IMMEDIATE")
        if conn.execute("SELECT 1 FROM chat_threads WHERE id=?", (thread_id,)).fetchone() is None:
            raise ValueError("Chat thread not found")
        row = conn.execute("SELECT id FROM chat_workspaces WHERE canonical_path=?", (canonical_path,)).fetchone()
        workspace_id = row["id"] if row else str(uuid.uuid4())
        if row:
            conn.execute("UPDATE chat_workspaces SET display_name=?, filesystem_identity=?, updated_at=?, last_used_at=? WHERE id=?", (display_name, filesystem_identity, now, now, workspace_id))
        else:
            conn.execute("INSERT INTO chat_workspaces(id, display_name, canonical_path, filesystem_identity, created_at, updated_at, last_used_at) VALUES(?,?,?,?,?,?,?)", (workspace_id, display_name, canonical_path, filesystem_identity, now, now, now))
        binding_id = str(uuid.uuid4())
        conn.execute("INSERT INTO chat_workspace_bindings(id, thread_id, workspace_id, access, created_at, updated_at) VALUES(?,?,?,?,?,?) ON CONFLICT(thread_id) DO UPDATE SET workspace_id=excluded.workspace_id, access=excluded.access, updated_at=excluded.updated_at", (binding_id, thread_id, workspace_id, access, now, now))
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return get_thread_workspace_binding(thread_id) or {}


def unbind_chat_thread_workspace(thread_id: str) -> bool:
    conn = get_connection(_CONTENDED_BUSY_TIMEOUT_SECONDS)
    try:
        cur = conn.execute("DELETE FROM chat_workspace_bindings WHERE thread_id=?", (thread_id,))
        conn.commit()
        return cur.rowcount > 0
    finally:
        conn.close()


def list_chat_threads(
    model_type: str | None = None,
    pair_id: str | None = None,
    project_id: str | None = None,
    include_archived: bool = True,
    require_messages: bool = False,
) -> list[dict]:
    clauses = []
    values: list[object] = []
    if model_type is not None:
        clauses.append("model_type = ?")
        values.append(model_type)
    if pair_id is not None:
        clauses.append("pair_id = ?")
        values.append(pair_id)
    if project_id is not None:
        clauses.append("project_id = ?")
        values.append(project_id)
    if not include_archived:
        clauses.append("archived = 0")
    if require_messages:
        clauses.append("EXISTS (SELECT 1 FROM chat_messages cm WHERE cm.thread_id = chat_threads.id)")
    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    conn = get_connection()
    try:
        rows = conn.execute(
            f"SELECT * FROM chat_threads {where} "
            "ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC",
            values,
        ).fetchall()
        # the snapshot is only read when a thread is opened, so it is left out of the listing.
        return [_chat_thread_from_row(row, include_settings = False) for row in rows]
    finally:
        conn.close()


def build_chat_history_export() -> tuple[list[dict], list[dict], list[dict]]:
    """Read projects, threads, and messages from one SQLite snapshot."""
    conn = get_connection()
    try:
        conn.execute("BEGIN")
        thread_rows = conn.execute(
            """
            SELECT * FROM chat_threads
            ORDER BY COALESCE(updated_at, created_at) DESC, created_at DESC
            """
        ).fetchall()
        project_rows = conn.execute(
            "SELECT * FROM chat_projects ORDER BY updated_at DESC"
        ).fetchall()
        message_rows = conn.execute(
            "SELECT * FROM chat_messages ORDER BY created_at ASC, id ASC"
        ).fetchall()
        conn.commit()
        return (
            [_chat_project_from_row(row) for row in project_rows],
            [_chat_thread_from_row(row) for row in thread_rows],
            [_chat_message_from_row(row) for row in message_rows],
        )
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def _reparent_surviving_forks(conn: sqlite3.Connection, deleted_ids: set[str]) -> None:
    """Keep fork lineage connected across any thread deletion path."""
    if not deleted_ids:
        return
    rows = conn.execute("SELECT id, forked_from_thread_id FROM chat_threads").fetchall()
    sources = {row["id"]: row["forked_from_thread_id"] for row in rows}
    for row in rows:
        if row["id"] in deleted_ids or row["forked_from_thread_id"] not in deleted_ids:
            continue
        source_id = row["forked_from_thread_id"]
        seen: set[str] = set()
        while source_id in deleted_ids and source_id not in seen:
            seen.add(source_id)
            parent_id = sources.get(source_id)
            if parent_id is None:
                # Preserve the deleted root id: sibling forks use it to elect one surviving copy of shared history.
                break
            source_id = parent_id
        conn.execute(
            "UPDATE chat_threads SET forked_from_thread_id = ? WHERE id = ?",
            (source_id, row["id"]),
        )


def _tombstone_chat_threads(conn: sqlite3.Connection, thread_ids: Iterable[str]) -> None:
    deleted_at = int(datetime.now(timezone.utc).timestamp() * 1000)
    conn.executemany(
        """
        INSERT INTO chat_thread_tombstones (id, deleted_at)
        VALUES (?, ?)
        ON CONFLICT(id) DO UPDATE SET deleted_at = excluded.deleted_at
        """,
        [(thread_id, deleted_at) for thread_id in sorted(set(thread_ids))],
    )


# Only these states can already own a worker. Queued, paused, and approval rows are removed before
# they can be claimed, so signalling them would only leave unused supervisor cancellation events.
_ACTIVE_RESEARCH_RUN_STATUSES = (
    "planning",
    "running",
    "cancelling",
)


def _active_research_run_ids(
    conn: sqlite3.Connection, thread_ids: set[str] | None = None
) -> list[str]:
    # lease_owner is the other half of "can already own a worker": a planning run that no worker
    # has claimed yet never will once its row is gone, and signalling it would leave a
    # cancellation event in the supervisor that nothing is left to consume.
    status_placeholders = ",".join("?" for _ in _ACTIVE_RESEARCH_RUN_STATUSES)
    if thread_ids is None:
        rows = conn.execute(
            f"""
            SELECT id, created_at FROM research_runs
            WHERE status IN ({status_placeholders}) AND lease_owner IS NOT NULL
            """,
            _ACTIVE_RESEARCH_RUN_STATUSES,
        ).fetchall()
    else:
        rows = []
        sorted_thread_ids = sorted(thread_ids)
        for start in range(0, len(sorted_thread_ids), _SQLITE_IN_CHUNK_SIZE):
            chunk = sorted_thread_ids[start : start + _SQLITE_IN_CHUNK_SIZE]
            thread_placeholders = ",".join("?" for _ in chunk)
            rows.extend(
                conn.execute(
                    f"SELECT id, created_at FROM research_runs "
                    f"WHERE thread_id IN ({thread_placeholders}) "
                    f"AND status IN ({status_placeholders}) "
                    f"AND lease_owner IS NOT NULL",
                    (*chunk, *_ACTIVE_RESEARCH_RUN_STATUSES),
                ).fetchall()
            )
    return [row["id"] for row in sorted(rows, key = lambda row: (row["created_at"], row["id"]))]


def delete_chat_threads_with_active_research_runs(ids: list[str]) -> list[str]:
    if not ids:
        return []
    conn = get_connection(_CONTENDED_BUSY_TIMEOUT_SECONDS)
    try:
        conn.execute("BEGIN IMMEDIATE")
        _ensure_chat_attachment_inventory_current(conn)
        thread_ids = set(ids)
        active_research_run_ids = _active_research_run_ids(conn, thread_ids)
        _reparent_surviving_forks(conn, thread_ids)
        # Record the delete even when no row exists yet. A late POST carrying the same unique id
        # must not recreate a thread after this request has confirmed deletion.
        _tombstone_chat_threads(conn, thread_ids)
        conn.executemany(
            "DELETE FROM chat_attachment_tombstones WHERE thread_id = ?",
            [(id,) for id in ids],
        )
        conn.executemany("DELETE FROM chat_threads WHERE id = ?", [(id,) for id in ids])
        _mark_chat_attachment_inventory_clean(conn)
        conn.commit()
        return active_research_run_ids
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def delete_chat_threads(ids: list[str]) -> list[str]:
    """Delete threads and return the active research runs removed with them."""
    return delete_chat_threads_with_active_research_runs(ids)


def clear_chat_history_with_active_research_runs(
    additional_thread_ids: Iterable[str] = (), operation_id: Optional[str] = None
) -> tuple[list[str], list[str]]:
    removed, active_runs = clear_chat_history(
        additional_thread_ids,
        operation_id = operation_id,
    )
    return active_runs, removed


def clear_chat_history(
    additional_thread_ids: Iterable[str] = (), operation_id: Optional[str] = None
) -> "tuple[list[str], list[str]]":
    """Delete every chat thread. Returns (thread ids removed, research runs cascaded).

    Both taken inside the same transaction: another process can add a thread
    between a listing and this call, its sandbox has to be cleaned up too, and
    after the cascade nothing can tell the supervisor which runs to stop.
    """
    conn = get_connection(_CONTENDED_BUSY_TIMEOUT_SECONDS)
    try:
        conn.execute("BEGIN IMMEDIATE")
        if operation_id is not None:
            completed = conn.execute(
                """
                SELECT deleted_thread_ids_json
                FROM chat_clear_operations WHERE id = ?
                """,
                (operation_id,),
            ).fetchone()
            if completed is not None:
                conn.commit()
                # The original request already signalled its workers. Replaying that signal can
                # leave a cancellation event behind after the worker has exited.
                return list(json.loads(completed["deleted_thread_ids_json"])), []
        _ensure_chat_attachment_inventory_current(conn)
        removed = sorted(str(row[0]) for row in conn.execute("SELECT id FROM chat_threads"))
        status_placeholders = ",".join("?" for _ in _ACTIVE_RESEARCH_RUN_STATUSES)
        active_runs = [
            row["id"]
            for row in conn.execute(
                f"SELECT id FROM research_runs WHERE status IN ({status_placeholders}) "
                "AND lease_owner IS NOT NULL ORDER BY created_at, id",
                _ACTIVE_RESEARCH_RUN_STATUSES,
            )
        ]
        # Fence pending frontend writes and legacy-only ids in the same transaction as the clear.
        _tombstone_chat_threads(conn, sorted(set(additional_thread_ids) | set(removed)))
        conn.execute("DELETE FROM chat_attachment_tombstones")
        conn.execute("DELETE FROM chat_threads")
        _mark_chat_attachment_inventory_clean(conn)
        if operation_id is not None:
            conn.execute(
                """
                INSERT INTO chat_clear_operations (
                    id, active_research_run_ids_json, deleted_thread_ids_json, cleared_at
                ) VALUES (?, ?, ?, ?)
                """,
                (
                    operation_id,
                    json.dumps(active_runs),
                    json.dumps(removed),
                    int(datetime.now(timezone.utc).timestamp() * 1000),
                ),
            )
        conn.commit()
        return removed, active_runs
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def count_chat_threads() -> int:
    conn = get_connection()
    try:
        return int(conn.execute("SELECT COUNT(*) FROM chat_threads").fetchone()[0])
    finally:
        conn.close()

