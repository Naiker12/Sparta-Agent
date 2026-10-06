"""Additive schema for durable work; independent of scheduling and inference."""
import sqlite3


def ensure_work_runs_schema(conn: sqlite3.Connection) -> None:
    conn.execute("""CREATE TABLE IF NOT EXISTS work_prompt_queues (
        owner_subject TEXT NOT NULL, id TEXT NOT NULL,
        thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
        revision INTEGER NOT NULL, snapshot_json TEXT NOT NULL,
        PRIMARY KEY(owner_subject,id)
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_work_prompt_queues_thread "
                 "ON work_prompt_queues(owner_subject,thread_id)")
    conn.execute("""CREATE TABLE IF NOT EXISTS work_runs (
        id TEXT PRIMARY KEY, owner_subject TEXT NOT NULL,
        request_key TEXT NOT NULL, request_hash TEXT NOT NULL,
        request_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN
            ('queued','running','paused','completed','failed','cancelled','needs_review')),
        revision INTEGER NOT NULL DEFAULT 0,
        attempt INTEGER NOT NULL DEFAULT 0,
        worker_id TEXT, lease_until INTEGER,
        result_json TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
        UNIQUE(owner_subject, request_key)
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS work_run_events (
        run_id TEXT NOT NULL REFERENCES work_runs(id) ON DELETE CASCADE,
        revision INTEGER NOT NULL, event_type TEXT NOT NULL,
        data_json TEXT NOT NULL, created_at INTEGER NOT NULL,
        PRIMARY KEY(run_id, revision)
    )""")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_work_runs_queue "
                 "ON work_runs(owner_subject,status,created_at,id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_work_runs_lease "
                 "ON work_runs(status,lease_until)")
    columns = {row[1] for row in conn.execute("PRAGMA table_info(work_runs)")}
    for name, declaration in {
        "source_kind": "TEXT NOT NULL DEFAULT 'manual'",
        "source_thread_id": "TEXT REFERENCES chat_threads(id) ON DELETE CASCADE",
        "source_queue_id": "TEXT",
        "source_item_id": "TEXT",
        "source_channel_id": "TEXT",
    }.items():
        if name not in columns:
            conn.execute(f"ALTER TABLE work_runs ADD COLUMN {name} {declaration}")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_work_runs_chat_queue "
                 "ON work_runs(owner_subject,source_queue_id)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_work_runs_channel "
                 "ON work_runs(owner_subject,source_kind,source_channel_id)")
