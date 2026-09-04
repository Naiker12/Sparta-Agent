"""SQLite connection management for studio.db."""

import sqlite3
import threading
from utils.paths import ensure_dir, studio_db_path
from storage.studio.schema import _ensure_schema

_BUSY_TIMEOUT_SECONDS = 5.0
_CONTENDED_BUSY_TIMEOUT_SECONDS = 30.0
_SQLITE_IN_CHUNK_SIZE = 900

_schema_lock = threading.Lock()
_schema_ready = False


def get_connection(busy_timeout_seconds: float = _BUSY_TIMEOUT_SECONDS) -> sqlite3.Connection:
    """Open studio.db with WAL mode, create tables once per process, enable foreign keys."""
    global _schema_ready
    db_path = studio_db_path()
    ensure_dir(db_path.parent)
    conn = sqlite3.connect(str(db_path), timeout=busy_timeout_seconds)
    conn.row_factory = sqlite3.Row
    # foreign_keys is session-scoped; set per connection
    conn.execute("PRAGMA foreign_keys=ON")
    if not _schema_ready:
        with _schema_lock:
            if not _schema_ready:
                try:
                    _ensure_schema(conn)
                    conn.commit()
                    _schema_ready = True
                except Exception:
                    conn.close()
                    raise
    return conn
