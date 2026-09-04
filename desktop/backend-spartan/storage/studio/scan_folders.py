"""Scan folder registration and storage."""

import os
import platform
import sqlite3
from datetime import datetime, timezone

from utils.paths.external_media import is_linux_run_media_path, is_local_filesystem_root
from utils.paths.scan_folder_health import is_readable_dir
from storage.studio.connection import get_connection
from storage.studio.project_workspace import (
    _contains_sensitive_path_component,
    _denied_path_prefixes,
)

def list_scan_folders() -> list[dict]:
    conn = get_connection()
    try:
        rows = conn.execute(
            "SELECT id, path, created_at FROM scan_folders ORDER BY created_at"
        ).fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()


def add_scan_folder_with_status(path: str) -> tuple[dict, bool]:
    """Add a custom scan folder and return its row plus whether it was inserted."""
    if not path or not path.strip():
        raise ValueError("Path cannot be empty")
    normalized = os.path.realpath(os.path.expanduser(path.strip()))

    # Validate the path is an existing, readable directory before persisting.
    if not os.path.exists(normalized):
        raise ValueError("Path does not exist")
    if not os.path.isdir(normalized):
        raise ValueError("Path must be a directory, not a file")
    # Reject a local filesystem root ("/", or a bare "C:\\"): registering one seeds the browse
    # allowlist above denied system dirs. A UNC share root has none under it, so it stays
    # allowed (it was registerable before this guard). Mirrors scan_folders.py.
    if is_local_filesystem_root(normalized):
        raise ValueError("The filesystem root cannot be registered")
    if _contains_sensitive_path_component(normalized):
        raise ValueError("Credential or configuration directories are not allowed")

    # Windows: normcase for the denylist check but store original casing (e.g. C:\Models).
    is_win = platform.system() == "Windows"
    check = os.path.normcase(normalized) if is_win else normalized
    for prefix in _denied_path_prefixes():
        if check == prefix or check.startswith(prefix + os.sep):
            if prefix == "/run" and is_linux_run_media_path(check):
                continue
            raise ValueError(f"Path under {prefix} is not allowed")

    # Last, so a denied path is never opened: os.access alone passes on folders
    # macOS TCC or a Windows ACL still refuses at scan time, which is how a
    # registered folder ends up looking empty instead of blocked.
    if not is_readable_dir(normalized):
        raise ValueError("Path is not readable")

    conn = get_connection()
    try:
        now = datetime.now(timezone.utc).isoformat()
        # Windows: case-insensitive lookup so C:\Models and c:\models dedup.
        if is_win:
            existing = conn.execute(
                "SELECT id, path, created_at FROM scan_folders WHERE path = ? COLLATE NOCASE",
                (normalized,),
            ).fetchone()
        else:
            existing = conn.execute(
                "SELECT id, path, created_at FROM scan_folders WHERE path = ?",
                (normalized,),
            ).fetchone()
        if existing is not None:
            return dict(existing), False
        inserted = False
        try:
            conn.execute(
                "INSERT INTO scan_folders (path, created_at) VALUES (?, ?)",
                (normalized, now),
            )
            conn.commit()
            inserted = True
        except sqlite3.IntegrityError:
            pass  # duplicate; fall through to SELECT
        # Same collation as the pre-check to catch concurrent writes (Windows).
        fallback_sql = (
            "SELECT id, path, created_at FROM scan_folders WHERE path = ? COLLATE NOCASE"
            if is_win
            else "SELECT id, path, created_at FROM scan_folders WHERE path = ?"
        )
        row = conn.execute(fallback_sql, (normalized,)).fetchone()
        if row is None:
            raise ValueError("Folder was concurrently removed")
        return dict(row), inserted
    finally:
        conn.close()


def add_scan_folder(path: str) -> dict:
    """Add a directory to the custom scan folder list. Returns the row."""
    row, _ = add_scan_folder_with_status(path)
    return row


def remove_scan_folder(id: int) -> bool:
    conn = get_connection()
    try:
        cursor = conn.execute("DELETE FROM scan_folders WHERE id = ?", (id,))
        conn.commit()
        return cursor.rowcount > 0
    finally:
        conn.close()


