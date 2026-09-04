"""Application settings, chat settings, and legacy Dexie imports."""

import json
import logging
import sqlite3
from datetime import datetime, timezone
from typing import Any, Optional

from storage.studio.connection import get_connection
from storage.studio.exceptions import CorruptSettingsError

logger = logging.getLogger(__name__)


def _json_loads(value: str | None, fallback):
    if value is None:
        return fallback
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return fallback


def _parse_chat_setting_json(key: str, value_json: str) -> tuple[bool, Any]:
    try:
        return True, json.loads(value_json)
    except (json.JSONDecodeError, TypeError) as exc:
        logger.warning(
            "Corrupt chat_settings JSON; quarantining key=%s error=%s",
            key,
            exc,
        )
        return False, None


def _load_chat_settings_for_merge(conn: sqlite3.Connection) -> tuple[dict[str, Any], set[str]]:
    rows = conn.execute("SELECT key, value_json FROM chat_settings").fetchall()
    current: dict[str, Any] = {}
    corrupt: set[str] = set()
    now = datetime.now(timezone.utc).isoformat()
    for row in rows:
        ok, value = _parse_chat_setting_json(row["key"], row["value_json"])
        if ok:
            current[row["key"]] = value
            continue
        corrupt.add(row["key"])
        conn.execute(
            """
            INSERT INTO chat_settings_quarantine
                (key, value_json, reason, quarantined_at)
            VALUES (?, ?, ?, ?)
            """,
            (row["key"], row["value_json"], "json_decode_error", now),
        )
        conn.execute(
            "DELETE FROM chat_settings WHERE key = ? AND value_json = ?",
            (row["key"], row["value_json"]),
        )
    return current, corrupt



def get_app_setting(key: str, fallback = None):
    conn = get_connection()
    try:
        row = conn.execute("SELECT value_json FROM app_settings WHERE key = ?", (key,)).fetchone()
        if row is None:
            return fallback
        return _json_loads(row["value_json"], fallback)
    finally:
        conn.close()


def upsert_app_settings(settings: dict[str, Any]) -> dict[str, Any]:
    if not settings:
        return {}
    conn = get_connection()
    try:
        now = datetime.now(timezone.utc).isoformat()
        conn.executemany(
            """
            INSERT INTO app_settings (key, value_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
                value_json = excluded.value_json,
                updated_at = excluded.updated_at
            """,
            [(key, json.dumps(value), now) for key, value in settings.items()],
        )
        conn.commit()
        rows = conn.execute("SELECT key, value_json FROM app_settings ORDER BY key").fetchall()
        return {row["key"]: _json_loads(row["value_json"], None) for row in rows}
    finally:
        conn.close()


def upsert_app_setting_map_entry(
    key: str,
    entry_key: str,
    entry_value: dict[str, Any] | None,
    *,
    fill_absent_fields: bool = False,
) -> dict[str, Any]:
    """Set (or delete, when entry_value is falsy) one sub-entry of a dict-valued
    app setting, atomically under BEGIN IMMEDIATE so concurrent writers to other
    sub-entries cannot drop each other's updates.

    ``fill_absent_fields`` writes only what is missing: the entry is created when
    it is not there, and otherwise gains the fields it does not already hold while
    every stored value is left exactly as it is. Nothing is ever deleted. The read
    and the write share this transaction, so a caller that read the map earlier
    cannot replace a value written since. Used by the one-time localStorage
    backfill, whose contract is that the server copy is the newer authority: an
    upgraded install can hold an entry with only the fields an older release knew,
    while this browser holds the rest, and entry-level skipping would strand them.
    """
    conn = get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        row = conn.execute("SELECT value_json FROM app_settings WHERE key = ?", (key,)).fetchone()
        current = _json_loads(row["value_json"], {}) if row else {}
        if not isinstance(current, dict):
            current = {}
        if fill_absent_fields:
            if not entry_value:
                conn.rollback()
                return current
            stored = current.get(entry_key)
            if isinstance(stored, dict):
                # Stored values win field by field, so this only adds.
                merged = {**entry_value, **stored}
                if merged == stored:
                    conn.rollback()
                    return current
                current[entry_key] = merged
            else:
                current[entry_key] = entry_value
        elif entry_value:
            current[entry_key] = entry_value
        else:
            current.pop(entry_key, None)
        now = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """
            INSERT INTO app_settings (key, value_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
                value_json = excluded.value_json,
                updated_at = excluded.updated_at
            """,
            (key, json.dumps(current), now),
        )
        conn.commit()
        return current
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def list_chat_settings() -> dict[str, Any]:
    conn = get_connection()
    try:
        rows = conn.execute("SELECT key, value_json FROM chat_settings ORDER BY key").fetchall()
        settings: dict[str, Any] = {}
        for row in rows:
            settings[row["key"]] = _json_loads(row["value_json"], None)
        return settings
    finally:
        conn.close()


def upsert_chat_settings(settings: dict[str, Any]) -> dict[str, Any]:
    if not settings:
        return list_chat_settings()
    conn = get_connection()
    try:
        now = datetime.now(timezone.utc).isoformat()
        conn.executemany(
            """
            INSERT INTO chat_settings (key, value_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
                value_json = excluded.value_json,
                updated_at = excluded.updated_at
            """,
            [(key, json.dumps(value), now) for key, value in settings.items()],
        )
        conn.commit()
        return list_chat_settings()
    finally:
        conn.close()


# Discriminated unions, not partial patches: merging a `thread` pick into a stored
# `kb` one keeps `kbId`, which the payload's thread variant forbids.
_ATOMIC_SETTING_KEYS = frozenset({"ragSource"})


def _deep_merge_settings(current: dict[str, Any], updates: dict[str, Any]) -> dict[str, Any]:
    merged = dict(current)
    for key, value in updates.items():
        current_value = merged.get(key)
        if (
            key not in _ATOMIC_SETTING_KEYS
            and isinstance(current_value, dict)
            and isinstance(value, dict)
        ):
            merged[key] = _deep_merge_settings(current_value, value)
        else:
            merged[key] = value
    return merged


def upsert_chat_settings_merge(updates: dict[str, Any]) -> dict[str, Any]:
    """Atomic read-merge-write under BEGIN IMMEDIATE so concurrent writers
    cannot drop each other's updates."""
    if not updates:
        return list_chat_settings()
    conn = get_connection()
    try:
        conn.execute("BEGIN IMMEDIATE")
        current, corrupt = _load_chat_settings_for_merge(conn)
        # An atomic key carries its whole value, so it repairs a quarantined row
        # rather than patching a base that is no longer there.
        unsafe_partial_keys = [
            key
            for key, value in updates.items()
            if key in corrupt and isinstance(value, dict) and key not in _ATOMIC_SETTING_KEYS
        ]
        if unsafe_partial_keys:
            conn.commit()
            keys = ", ".join(sorted(unsafe_partial_keys))
            raise CorruptSettingsError(
                f"Cannot apply partial settings patch to corrupt key(s): {keys}"
            )
        merged = _deep_merge_settings(current, updates)
        now = datetime.now(timezone.utc).isoformat()
        conn.executemany(
            """
            INSERT INTO chat_settings (key, value_json, updated_at)
            VALUES (?, ?, ?)
            ON CONFLICT(key) DO UPDATE SET
                value_json = excluded.value_json,
                updated_at = excluded.updated_at
            """,
            [(key, json.dumps(value), now) for key, value in merged.items()],
        )
        conn.commit()
        return merged
    except CorruptSettingsError:
        raise
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# --- Legacy Dexie import ledger (recovery rationale in _ensure_schema's schema comment) ---


def list_chat_legacy_imports() -> list[str]:
    """Return the legacy_thread_id of every thread already imported."""
    conn = get_connection()
    try:
        rows = conn.execute("SELECT legacy_thread_id FROM chat_legacy_imports").fetchall()
        return [row[0] for row in rows]
    finally:
        conn.close()


def upsert_chat_legacy_imports(legacy_thread_ids: list[str]) -> tuple[int, int]:
    """Mark each given legacy thread id as imported. Idempotent.

    Returns (accepted, inserted): count of deduped non-empty input ids, and
    count of rows actually new. RETURNING lets callers tell first-time imports
    from idempotent re-runs without an extra SELECT.
    """
    ids = list(dict.fromkeys(tid for tid in legacy_thread_ids if tid))
    if not ids:
        return 0, 0
    ts = int(datetime.now(timezone.utc).timestamp() * 1000)
    conn = get_connection()
    try:
        inserted = 0
        for tid in ids:
            row = conn.execute(
                """
                INSERT INTO chat_legacy_imports (legacy_thread_id, imported_at)
                VALUES (?, ?)
                ON CONFLICT(legacy_thread_id) DO NOTHING
                RETURNING legacy_thread_id
                """,
                (tid, ts),
            ).fetchone()
            if row is not None:
                inserted += 1
        conn.commit()
        return len(ids), inserted
    finally:
        conn.close()

