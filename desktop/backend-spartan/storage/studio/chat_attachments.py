"""Chat attachments, content part blobs, tombstones, and normalized inventory."""

import hashlib
import json
import logging
import re
import sqlite3
from datetime import datetime, timezone
from typing import Any, Optional

from storage.studio.connection import get_connection
from storage.studio.exceptions import ChatMessageProtectedError

logger = logging.getLogger(__name__)

_CHAT_ATTACHMENT_INVENTORY_VERSION = 1


def _json_loads(value: str | None, fallback):
    if value is None:
        return fallback
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return fallback


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


_CONTENT_PART_ID_PREFIX = "content-part-sha256-"
_URI_SCHEME_RE = re.compile(r"^[A-Za-z][A-Za-z0-9+.-]*:")


def _is_locally_stored_blob(value: str) -> bool:
    """True for data URIs or bare base64, never external/blob URI references."""
    candidate = value.lstrip()
    if not candidate:
        return False
    if candidate[:5].lower() == "data:":
        return True
    if candidate.startswith(("//", "\\\\")):
        return False
    return _URI_SCHEME_RE.match(candidate) is None


def _managed_content_part_payload(part: dict) -> Optional[tuple[str, Any]]:
    """Return the locally stored blob payload used to identify a content part."""
    image = part.get("image")
    if isinstance(image, str) and image[:5].lower() == "data:":
        return "image", image

    audio = part.get("audio")
    if isinstance(audio, str) and _is_locally_stored_blob(audio):
        return "audio", audio
    if isinstance(audio, dict):
        data = audio.get("data")
        if isinstance(data, str) and _is_locally_stored_blob(data):
            return "audio", audio
    return None


def _content_part_id(part: dict) -> Optional[str]:
    """Stable managed id derived from blob data, without mutating inference content."""
    payload = _managed_content_part_payload(part)
    if payload is None:
        return None
    canonical = json.dumps(
        payload,
        ensure_ascii = False,
        separators = (",", ":"),
        sort_keys = True,
    ).encode("utf-8")
    return f"{_CONTENT_PART_ID_PREFIX}{hashlib.sha256(canonical).hexdigest()}"




def _chat_attachment_metadata_text(value, fallback: Optional[str] = None) -> Optional[str]:
    """Keep untyped legacy/import metadata safe for SQLite binding."""
    if value is None:
        return fallback
    if isinstance(value, str):
        return value or fallback
    if isinstance(value, (bool, int, float)):
        return str(value)
    # Objects and arrays are not useful display metadata and sqlite3 rejects binding them.
    return fallback


def _chat_attachment_inventory_entries(
    attachments_json: Optional[str],
    content_json: Optional[str],
    tombstones: Optional[set[str]] = None,
) -> list[dict]:
    tombstones = tombstones or set()
    attachments = _json_loads(attachments_json, None)
    if not isinstance(attachments, list):
        attachments = []
    attachments = [
        attachment
        for attachment in attachments
        if isinstance(attachment, dict) and attachment.get("id")
    ]
    represented_parts = {
        part_id
        for attachment in attachments
        for part in _attachment_content_parts(attachment)
        for part_id in [_content_part_id(part)]
        if part_id is not None
    }
    attachments.extend(
        attachment
        for attachment in _content_part_attachments(content_json)
        if attachment["id"] not in represented_parts
    )

    entries: list[dict] = []
    seen: set[str] = set()
    for attachment in attachments:
        attachment_id = str(attachment["id"])
        if attachment_id in seen or attachment_id in tombstones:
            continue
        seen.add(attachment_id)
        entries.append(
            {
                "id": attachment_id,
                "name": _chat_attachment_metadata_text(attachment.get("name"), "attachment"),
                "type": _chat_attachment_metadata_text(attachment.get("type")),
                "contentType": _chat_attachment_metadata_text(attachment.get("contentType")),
                "sizeBytes": _chat_attachment_size_bytes(attachment),
            }
        )
    return entries


def count_chat_message_attachments(
    attachments_json: Optional[str], content_json: Optional[str]
) -> int:
    """Count distinct user-visible uploads represented by a chat message."""
    return len(_chat_attachment_inventory_entries(attachments_json, content_json))


def _replace_chat_attachment_inventory(
    conn: sqlite3.Connection,
    message_id: str,
    attachments_json: Optional[str],
    content_json: Optional[str],
    tombstones: Optional[set[str]] = None,
) -> None:
    conn.execute("DELETE FROM chat_attachment_inventory WHERE message_id = ?", (message_id,))
    entries = _chat_attachment_inventory_entries(
        attachments_json,
        content_json,
        tombstones,
    )
    conn.executemany(
        """
        INSERT INTO chat_attachment_inventory
            (message_id, attachment_id, name, type, content_type, size_bytes)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        [
            (
                message_id,
                entry["id"],
                entry["name"],
                entry["type"],
                entry["contentType"],
                entry["sizeBytes"],
            )
            for entry in entries
        ],
    )


def _mark_chat_attachment_inventory_clean(conn: sqlite3.Connection) -> None:
    conn.execute(
        """
        INSERT INTO chat_attachment_inventory_state
            (singleton, inventory_version, dirty, backfilled_at)
        VALUES (1, ?, 0, ?)
        ON CONFLICT(singleton) DO UPDATE SET
            inventory_version = excluded.inventory_version,
            dirty = 0,
            backfilled_at = excluded.backfilled_at
        """,
        (
            _CHAT_ATTACHMENT_INVENTORY_VERSION,
            int(datetime.now(timezone.utc).timestamp() * 1000),
        ),
    )


def _rebuild_chat_attachment_inventory(conn: sqlite3.Connection) -> None:
    """Rebuild after schema upgrade or a write from an older Studio build."""
    conn.execute("DELETE FROM chat_attachment_inventory")
    tombstones: dict[tuple[str, str], set[str]] = {}
    for row in conn.execute(
        "SELECT thread_id, message_id, attachment_id FROM chat_attachment_tombstones"
    ).fetchall():
        tombstones.setdefault((row["thread_id"], row["message_id"]), set()).add(
            row["attachment_id"]
        )
    rows = conn.execute(
        "SELECT id, thread_id, attachments_json, content_json FROM chat_messages"
    ).fetchall()
    for row in rows:
        _replace_chat_attachment_inventory(
            conn,
            row["id"],
            row["attachments_json"],
            row["content_json"],
            tombstones.get((row["thread_id"], row["id"]), set()),
        )


def _ensure_chat_attachment_inventory_current(conn: sqlite3.Connection) -> None:
    state = conn.execute(
        """
        SELECT inventory_version, dirty
        FROM chat_attachment_inventory_state
        WHERE singleton = 1
        """
    ).fetchone()
    if (
        state is not None
        and state["inventory_version"] == _CHAT_ATTACHMENT_INVENTORY_VERSION
        and not state["dirty"]
    ):
        return

    owns_transaction = not conn.in_transaction
    if owns_transaction:
        conn.execute("BEGIN IMMEDIATE")
    try:
        state = conn.execute(
            """
            SELECT inventory_version, dirty
            FROM chat_attachment_inventory_state
            WHERE singleton = 1
            """
        ).fetchone()
        if (
            state is None
            or state["inventory_version"] != _CHAT_ATTACHMENT_INVENTORY_VERSION
            or state["dirty"]
        ):
            _rebuild_chat_attachment_inventory(conn)
            _mark_chat_attachment_inventory_clean(conn)
        if owns_transaction:
            conn.commit()
    except Exception:
        if owns_transaction:
            conn.rollback()
        raise




def _blob_part_base64_len(part: dict) -> int:
    """Base64 payload length of an image or audio content part, or 0."""
    image = part.get("image")
    if isinstance(image, str) and image[:5].lower() == "data:":
        return len(image.rsplit(",", 1)[-1])
    audio = part.get("audio")
    if isinstance(audio, str) and _is_locally_stored_blob(audio):
        return len(audio.rsplit(",", 1)[-1])
    if isinstance(audio, dict):
        data = audio.get("data")
        if isinstance(data, str) and _is_locally_stored_blob(data):
            return len(data)
    return 0


def _attachment_content_parts(attachment: dict) -> list[dict]:
    content = attachment.get("content")
    if not isinstance(content, list):
        return []
    return [part for part in content if isinstance(part, dict)]


def _chat_attachment_size_bytes(attachment: dict) -> Optional[int]:
    """Approximate stored size of one attachment's content parts.

    Image and audio parts hold base64 payloads (decoded bytes ~= 3/4 of the
    encoded length); text parts count their character length. None when there
    is no sizable content (e.g. a stripped/legacy attachment).
    """
    total = 0
    found = False
    for part in _attachment_content_parts(attachment):
        blob_len = _blob_part_base64_len(part)
        if blob_len > 0:
            total += (blob_len * 3) // 4
            found = True
            continue
        text = part.get("text")
        if isinstance(text, str) and text:
            total += len(text.encode("utf-8", errors = "ignore"))
            found = True
    return total if found else None


def _content_part_attachments(content_json: Optional[str]) -> list[dict]:
    """Managed local blobs stored in content_json, with stable payload ids.

    Exact duplicate blobs intentionally share one inventory id. Deleting that
    id removes every identical copy, avoiding ambiguous index-based addressing.
    """
    content = _json_loads(content_json, None)
    if not isinstance(content, list):
        return []
    out: list[dict] = []
    seen: set[str] = set()
    for part in content:
        if not isinstance(part, dict):
            continue
        attachment_id = _content_part_id(part)
        payload = _managed_content_part_payload(part)
        if attachment_id is None or payload is None or attachment_id in seen:
            continue
        seen.add(attachment_id)
        kind, value = payload
        content_type = None
        part_name = part.get("name")
        if isinstance(value, str) and value[:5].lower() == "data:":
            content_type = value[5:].split(";", 1)[0].split(",", 1)[0] or None
        out.append(
            {
                "id": attachment_id,
                "type": kind,
                "name": part_name
                if isinstance(part_name, str) and part_name
                else ("Chat image" if kind == "image" else "Chat audio"),
                "contentType": content_type,
                "content": [part],
            }
        )
    return out


def list_chat_attachments_page(
    limit: int = 50, offset: int = 0
) -> tuple[list[dict], Optional[int]]:
    """One bounded page from the normalized attachment inventory."""
    if not 1 <= limit <= 100:
        raise ValueError("limit must be between 1 and 100")
    if offset < 0:
        raise ValueError("offset must be non-negative")

    conn = get_connection()
    try:
        _ensure_chat_attachment_inventory_current(conn)
        rows = conn.execute(
            """
            SELECT i.attachment_id, i.name, i.type, i.content_type,
                   i.size_bytes, m.id AS message_id, m.thread_id,
                   m.created_at, t.title AS thread_title, t.pair_id
            FROM chat_attachment_inventory i
            JOIN chat_messages m ON m.id = i.message_id
            LEFT JOIN chat_threads t ON t.id = m.thread_id
            ORDER BY m.created_at DESC, m.id ASC, i.attachment_id ASC
            LIMIT ? OFFSET ?
            """,
            (limit + 1, offset),
        ).fetchall()
    finally:
        conn.close()

    has_more = len(rows) > limit
    page_rows = rows[:limit]
    attachments = [
        {
            "id": row["attachment_id"],
            "messageId": row["message_id"],
            "threadId": row["thread_id"],
            "pairId": row["pair_id"],
            "threadTitle": row["thread_title"],
            "name": row["name"],
            "type": row["type"],
            "contentType": row["content_type"],
            "sizeBytes": row["size_bytes"],
            "createdAt": row["created_at"],
        }
        for row in page_rows
    ]
    return attachments, offset + limit if has_more else None


def list_chat_attachments() -> list[dict]:
    """Compatibility helper returning the full normalized inventory."""
    attachments: list[dict] = []
    offset = 0
    while True:
        page, next_offset = list_chat_attachments_page(limit = 100, offset = offset)
        attachments.extend(page)
        if next_offset is None:
            return attachments
        offset = next_offset


def get_chat_attachment(message_id: str, attachment_id: str) -> Optional[dict]:
    """One attachment record (full content) from a message, or None."""
    conn = get_connection()
    try:
        row = conn.execute(
            """
            SELECT message.attachments_json, message.content_json,
                   EXISTS(
                       SELECT 1 FROM chat_attachment_tombstones tombstone
                       WHERE tombstone.thread_id = message.thread_id
                         AND tombstone.message_id = message.id
                         AND tombstone.attachment_id = ?
                   ) AS tombstoned
            FROM chat_messages message
            WHERE message.id = ?
            """,
            (attachment_id, message_id),
        ).fetchone()
    finally:
        conn.close()
    if row is None or row["tombstoned"]:
        return None
    attachments = _json_loads(row["attachments_json"], None)
    if isinstance(attachments, list):
        for attachment in attachments:
            if isinstance(attachment, dict) and str(attachment.get("id") or "") == attachment_id:
                return attachment
    if attachment_id.startswith(_CONTENT_PART_ID_PREFIX):
        for attachment in _content_part_attachments(row["content_json"]):
            if attachment["id"] == attachment_id:
                return attachment
    return None


def _record_chat_attachment_tombstone(
    conn: sqlite3.Connection, thread_id: str, message_id: str, attachment_id: str
) -> None:
    conn.execute(
        """
        INSERT INTO chat_attachment_tombstones
            (thread_id, message_id, attachment_id, deleted_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(thread_id, message_id, attachment_id) DO UPDATE SET
            deleted_at = excluded.deleted_at
        """,
        (
            thread_id,
            message_id,
            attachment_id,
            int(datetime.now(timezone.utc).timestamp() * 1000),
        ),
    )


def delete_chat_attachment(message_id: str, attachment_id: str) -> bool:
    """Remove one stored upload from a message.

    The tombstone is retained while the thread exists, so pruning and later
    recreating the same message id cannot restore the deleted upload. If an
    ordinary attachment id collides with a content-blob id, both are deleted as
    one managed item.
    """
    conn = get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        _ensure_chat_attachment_inventory_current(conn)
        row = conn.execute(
            """
            SELECT thread_id, attachments_json, content_json
            FROM chat_messages WHERE id = ?
            """,
            (message_id,),
        ).fetchone()
        if row is None:
            conn.rollback()
            return False
        if str(message_id) in _research_message_ids(conn, str(row["thread_id"])):
            conn.rollback()
            raise ChatMessageProtectedError(
                "Research prompts and responses are server-managed and cannot be edited"
            )

        attachments = _json_loads(row["attachments_json"], None)
        updated_attachments_json = row["attachments_json"]
        deleted_attachment = False
        if isinstance(attachments, list):
            remaining_attachments = [
                attachment
                for attachment in attachments
                if not (
                    isinstance(attachment, dict)
                    and str(attachment.get("id") or "") == attachment_id
                )
            ]
            deleted_attachment = len(remaining_attachments) != len(attachments)
            if deleted_attachment:
                updated_attachments_json = json.dumps(remaining_attachments)

        content = _json_loads(row["content_json"], None)
        updated_content_json = row["content_json"]
        deleted_content = False
        if attachment_id.startswith(_CONTENT_PART_ID_PREFIX) and isinstance(content, list):
            remaining_content = [
                part
                for part in content
                if not (isinstance(part, dict) and _content_part_id(part) == attachment_id)
            ]
            deleted_content = len(remaining_content) != len(content)
            if deleted_content:
                updated_content_json = json.dumps(remaining_content)

        if not deleted_attachment and not deleted_content:
            conn.rollback()
            return False
        conn.execute(
            """
            UPDATE chat_messages
            SET attachments_json = ?, content_json = ?
            WHERE id = ?
            """,
            (updated_attachments_json, updated_content_json, message_id),
        )
        _record_chat_attachment_tombstone(
            conn,
            row["thread_id"],
            message_id,
            attachment_id,
        )
        _replace_chat_attachment_inventory(
            conn,
            message_id,
            updated_attachments_json,
            updated_content_json,
        )
        _mark_chat_attachment_inventory_clean(conn)
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()



