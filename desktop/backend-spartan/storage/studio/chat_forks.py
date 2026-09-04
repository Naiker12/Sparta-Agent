"""Chat thread branching, fork lineage, and message reseating."""

import json
import sqlite3
from typing import Optional

from storage.studio.connection import get_connection
from storage.studio.chat_attachments import (
    _ensure_chat_attachment_inventory_current,
    _mark_chat_attachment_inventory_clean,
    _replace_chat_attachment_inventory,
)
from storage.studio.exceptions import ChatThreadDeletedError

def _json_loads(value: str | None, fallback):
    if value is None:
        return fallback
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return fallback


def _raise_if_chat_thread_deleted(conn: sqlite3.Connection, thread_id: str) -> None:
    row = conn.execute(
        "SELECT 1 FROM chat_thread_tombstones WHERE id = ?",
        (thread_id,),
    ).fetchone()
    if row is not None:
        raise ChatThreadDeletedError(thread_id)


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


def _parents_of(conn, thread_id: str, message_ids: set) -> dict:
    """Stored parent of each id in *message_ids*, for rows that exist."""
    if not message_ids:
        return {}
    return {
        str(row["id"]): (str(row["parent_id"]) if row["parent_id"] else None)
        for row in conn.execute(
            "SELECT id, parent_id FROM chat_messages WHERE thread_id = ?",
            (thread_id,),
        ).fetchall()
        if str(row["id"]) in message_ids
    }


def _reseat_protected_messages(conn, thread_id: str, reseat_parents: dict) -> None:
    """Point protected messages at the ancestor that survived the prune.

    Their own rows survive it, the parents they pointed at need not, and a dangling parent
    makes the whole thread unimportable on the next load rather than just that turn.
    """
    for message_id, parent_id in reseat_parents.items():
        conn.execute(
            "UPDATE chat_messages SET parent_id = ? WHERE thread_id = ? AND id = ?",
            (parent_id, thread_id, message_id),
        )


_RESEARCH_LINK_KEYS = {
    "researchRunId",
    "researchRun",
    "researchStatus",
    "researchPlanRevision",
    "serverManaged",
}


def _detach_research_message_json(
    content_json: str, metadata_json: str | None
) -> tuple[str, str | None]:
    content = _json_loads(content_json, [])
    metadata = _json_loads(metadata_json, None)
    custom = metadata.get("custom") if isinstance(metadata, dict) else None
    linked = (
        isinstance(metadata, dict)
        and any(key in metadata for key in _RESEARCH_LINK_KEYS)
        or isinstance(custom, dict)
        and any(key in custom for key in _RESEARCH_LINK_KEYS)
        or isinstance(content, list)
        and any(
            isinstance(part, dict) and any(key in part for key in _RESEARCH_LINK_KEYS)
            for part in content
        )
    )
    if not linked:
        return content_json, metadata_json

    if isinstance(content, list):
        content = [
            {key: value for key, value in part.items() if key not in _RESEARCH_LINK_KEYS}
            if isinstance(part, dict)
            else part
            for part in content
        ]
    if isinstance(metadata, dict):
        metadata = {key: value for key, value in metadata.items() if key not in _RESEARCH_LINK_KEYS}
        custom = metadata.get("custom")
        if isinstance(custom, dict):
            metadata["custom"] = {
                key: value for key, value in custom.items() if key not in _RESEARCH_LINK_KEYS
            }
    return (
        json.dumps(content, ensure_ascii = False),
        json.dumps(metadata, ensure_ascii = False) if metadata is not None else None,
    )


def fork_chat_thread(
    source_thread_id: str,
    branch_message_id: str,
    new_thread_id: str,
    new_title: str,
    created_at: int,
    id_factory,
) -> Optional[dict]:
    """Atomically clone thread + ancestor msgs `[root..branch_message_id]`
    into a new thread. Returns the new thread dict (with messages copied)
    or None if source missing.

    Reset both code-exec container ids -- per-provider snapshot is handled
    by the route layer (best-effort, OpenAI only).

    `id_factory()` produces fresh message uuids; injected for testability.
    """
    conn = get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        _ensure_chat_attachment_inventory_current(conn)
        _raise_if_chat_thread_deleted(conn, new_thread_id)
        src = conn.execute(
            "SELECT * FROM chat_threads WHERE id = ?", (source_thread_id,)
        ).fetchone()
        if src is None:
            conn.rollback()
            return None
        # Verify branch msg belongs to source thread.
        branch_row = conn.execute(
            "SELECT * FROM chat_messages WHERE thread_id = ? AND id = ?",
            (source_thread_id, branch_message_id),
        ).fetchone()
        if branch_row is None:
            conn.rollback()
            return None
        # Walk ancestry from branch msg back to root via parent_id chain.
        ancestry: list[sqlite3.Row] = []
        cursor_row = branch_row
        seen: set[str] = set()
        while cursor_row is not None and cursor_row["id"] not in seen:
            ancestry.append(cursor_row)
            seen.add(cursor_row["id"])
            parent = cursor_row["parent_id"]
            if not parent:
                break
            cursor_row = conn.execute(
                "SELECT * FROM chat_messages WHERE thread_id = ? AND id = ?",
                (source_thread_id, parent),
            ).fetchone()
        ancestry.reverse()  # root .. branch msg
        # Map old msg id -> new msg id for parent_id rewriting.
        id_map: dict[str, str] = {row["id"]: id_factory() for row in ancestry}
        src_dict = dict(src)
        conn.execute(
            """
            INSERT INTO chat_threads
                (id, title, model_type, model_id, pair_id, project_id, archived, created_at,
                 openai_code_exec_container_id, anthropic_code_exec_container_id,
                 forked_from_thread_id, forked_from_message_id, settings_json)
            VALUES (?, ?, ?, ?, ?, ?, 0, ?, NULL, NULL, ?, ?, ?)
            """,
            (
                new_thread_id,
                new_title,
                src_dict["model_type"],
                src_dict.get("model_id") or "",
                None,  # pairId: forks always standalone (compare-mode disabled v1)
                src_dict.get("project_id"),
                int(created_at),
                source_thread_id,
                branch_message_id,
                src_dict.get("settings_json"),
            ),
        )
        fork_messages = []
        for row in ancestry:
            content_json, metadata_json = _detach_research_message_json(
                row["content_json"], row["metadata_json"]
            )
            fork_messages.append(
                (
                    id_map[row["id"]],
                    new_thread_id,
                    id_map.get(row["parent_id"]) if row["parent_id"] else None,
                    row["role"],
                    content_json,
                    row["attachments_json"],
                    metadata_json,
                    int(row["created_at"]),
                )
            )
        conn.executemany(
            """
            INSERT INTO chat_messages
                (id, thread_id, parent_id, role, content_json, attachments_json,
                 metadata_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            fork_messages,
        )
        for row in ancestry:
            _replace_chat_attachment_inventory(
                conn,
                id_map[row["id"]],
                row["attachments_json"],
                row["content_json"],
            )
        _mark_chat_attachment_inventory_clean(conn)
        conn.commit()
        thread_row = conn.execute(
            "SELECT * FROM chat_threads WHERE id = ?", (new_thread_id,)
        ).fetchone()
        return _chat_thread_from_row(thread_row) if thread_row is not None else None
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def count_forks_for_message(thread_id: str, message_id: str) -> int:
    conn = get_connection()
    try:
        row = conn.execute(
            """
            SELECT COUNT(*) FROM chat_threads
            WHERE forked_from_thread_id = ? AND forked_from_message_id = ?
            """,
            (thread_id, message_id),
        ).fetchone()
        return int(row[0]) if row is not None else 0
    finally:
        conn.close()


def fork_counts_for_thread(thread_id: str) -> dict[str, int]:
    """Fork counts for every message of one thread, keyed by message id."""
    conn = get_connection()
    try:
        rows = conn.execute(
            """
            SELECT forked_from_message_id, COUNT(*) FROM chat_threads
            WHERE forked_from_thread_id = ? AND forked_from_message_id IS NOT NULL
            GROUP BY forked_from_message_id
            """,
            (thread_id,),
        ).fetchall()
        return {str(row[0]): int(row[1]) for row in rows}
    finally:
        conn.close()



