"""SQLite schema definitions and migrations for studio.db."""

import logging
import platform
import sqlite3

logger = logging.getLogger(__name__)

_CHAT_ATTACHMENT_INVENTORY_VERSION = 1


def _ensure_schema(conn: sqlite3.Connection) -> None:
    """Create tables and indexes if they don't exist. Called once per process."""
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS training_runs (
            id TEXT NOT NULL PRIMARY KEY,
            status TEXT NOT NULL DEFAULT 'running',
            model_name TEXT NOT NULL,
            dataset_name TEXT NOT NULL,
            config_json TEXT NOT NULL,
            started_at TEXT NOT NULL,
            ended_at TEXT,
            total_steps INTEGER,
            final_step INTEGER,
            final_loss REAL,
            output_dir TEXT,
            error_message TEXT,
            duration_seconds REAL,
            loss_sparkline TEXT,
            display_name TEXT,
            resume_blocked INTEGER NOT NULL DEFAULT 0,
            resumed_from_run_id TEXT
        )
        """
    )
    existing_cols = {row[1] for row in conn.execute("PRAGMA table_info(training_runs)").fetchall()}
    if "display_name" not in existing_cols:
        conn.execute("ALTER TABLE training_runs ADD COLUMN display_name TEXT")
    if "resume_blocked" not in existing_cols:
        conn.execute(
            "ALTER TABLE training_runs ADD COLUMN resume_blocked INTEGER NOT NULL DEFAULT 0"
        )
    # Nullable, so older rows stay NULL and fall back to the output_dir heuristic.
    if "resumed_from_run_id" not in existing_cols:
        conn.execute("ALTER TABLE training_runs ADD COLUMN resumed_from_run_id TEXT")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS training_metrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id TEXT NOT NULL REFERENCES training_runs(id) ON DELETE CASCADE,
            step INTEGER NOT NULL,
            loss REAL,
            learning_rate REAL,
            grad_norm REAL,
            eval_loss REAL,
            epoch REAL,
            num_tokens INTEGER,
            elapsed_seconds REAL,
            UNIQUE(run_id, step)
        )
        """
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_metrics_run_id ON training_metrics(run_id)")
    # Windows: COLLATE NOCASE so C:\Models and c:\models dedup; elsewhere BINARY keeps them distinct.
    collation = "COLLATE NOCASE" if platform.system() == "Windows" else ""
    conn.execute(
        f"""
        CREATE TABLE IF NOT EXISTS scan_folders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            path TEXT NOT NULL UNIQUE {collation},
            created_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_projects (
            id TEXT NOT NULL PRIMARY KEY,
            name TEXT NOT NULL,
            instructions TEXT,
            root_path TEXT,
            connected_folder_path TEXT,
            workspace_access TEXT NOT NULL DEFAULT 'read',
            archived INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
        """
    )
    chat_project_cols = {
        row[1] for row in conn.execute("PRAGMA table_info(chat_projects)").fetchall()
    }
    if "root_path" not in chat_project_cols:
        conn.execute("ALTER TABLE chat_projects ADD COLUMN root_path TEXT")
    if "connected_folder_path" not in chat_project_cols:
        conn.execute("ALTER TABLE chat_projects ADD COLUMN connected_folder_path TEXT")
    if "workspace_access" not in chat_project_cols:
        conn.execute("ALTER TABLE chat_projects ADD COLUMN workspace_access TEXT NOT NULL DEFAULT 'read'")
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_chat_projects_archived_updated_at ON chat_projects(archived, updated_at)"
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_threads (
            id TEXT NOT NULL PRIMARY KEY,
            title TEXT NOT NULL,
            model_type TEXT NOT NULL,
            model_id TEXT,
            pair_id TEXT,
            project_id TEXT,
            archived INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            updated_at INTEGER,
            openai_code_exec_container_id TEXT,
            anthropic_code_exec_container_id TEXT,
            forked_from_thread_id TEXT,
            forked_from_message_id TEXT,
            settings_json TEXT,
            FOREIGN KEY(project_id) REFERENCES chat_projects(id) ON DELETE CASCADE
        )
        """
    )
    chat_thread_cols = {
        row[1] for row in conn.execute("PRAGMA table_info(chat_threads)").fetchall()
    }
    if "settings_json" not in chat_thread_cols:
        conn.execute("ALTER TABLE chat_threads ADD COLUMN settings_json TEXT")
    # Orders one writer's snapshot writes against its own earlier ones. A tab closing
    # sends its last edit keepalive, which can overtake a PATCH already accepted by the
    # server, and no client-side cancel reaches a handler that is already running: the
    # older write has to be refused here. Scoped to the writer that sent it, so two
    # browsers are never ordered against each other; see write_chat_thread_settings.
    # {writer id: highest seq seen from it}. One writer and one seq is not enough: a
    # write from another tab overwrites them, and the delayed request the ordering exists
    # to refuse is then compared against a watermark that is no longer its own.
    if "settings_seqs" not in chat_thread_cols:
        conn.execute("ALTER TABLE chat_threads ADD COLUMN settings_seqs TEXT")
    if "project_id" not in chat_thread_cols:
        conn.execute("ALTER TABLE chat_threads ADD COLUMN project_id TEXT")
    if "openai_code_exec_container_id" not in chat_thread_cols:
        conn.execute("ALTER TABLE chat_threads ADD COLUMN openai_code_exec_container_id TEXT")
    if "anthropic_code_exec_container_id" not in chat_thread_cols:
        conn.execute("ALTER TABLE chat_threads ADD COLUMN anthropic_code_exec_container_id TEXT")
    if "forked_from_thread_id" not in chat_thread_cols:
        conn.execute("ALTER TABLE chat_threads ADD COLUMN forked_from_thread_id TEXT")
    if "forked_from_message_id" not in chat_thread_cols:
        conn.execute("ALTER TABLE chat_threads ADD COLUMN forked_from_message_id TEXT")
    if "updated_at" not in chat_thread_cols:
        conn.execute("ALTER TABLE chat_threads ADD COLUMN updated_at INTEGER")
        # Floor at created_at: forked threads copy older ancestor messages, so the fork's creation time wins.
        conn.execute(
            """
            UPDATE chat_threads SET updated_at = MAX(
                COALESCE(
                    (
                        SELECT MAX(m.created_at) FROM chat_messages m
                        WHERE m.thread_id = chat_threads.id
                    ),
                    created_at
                ),
                created_at
            )
            """
        )
    # A local workspace is a reusable capability, not project knowledge. A
    # thread selects at most one active workspace; every file operation later
    # receives this binding rather than consulting a process-global root.
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_workspaces (
            id TEXT NOT NULL PRIMARY KEY,
            display_name TEXT NOT NULL,
            canonical_path TEXT NOT NULL UNIQUE,
            filesystem_identity TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            last_used_at INTEGER
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_workspace_bindings (
            id TEXT NOT NULL PRIMARY KEY,
            thread_id TEXT NOT NULL UNIQUE,
            workspace_id TEXT NOT NULL,
            access TEXT NOT NULL CHECK(access IN ('read', 'write', 'write_no_delete')),
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            FOREIGN KEY(thread_id) REFERENCES chat_threads(id) ON DELETE CASCADE,
            FOREIGN KEY(workspace_id) REFERENCES chat_workspaces(id) ON DELETE CASCADE
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_chat_workspace_bindings_workspace ON chat_workspace_bindings(workspace_id)"
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_thread_tombstones (
            id TEXT NOT NULL PRIMARY KEY,
            deleted_at INTEGER NOT NULL
        ) WITHOUT ROWID
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_clear_operations (
            id TEXT NOT NULL PRIMARY KEY,
            active_research_run_ids_json TEXT NOT NULL,
            deleted_thread_ids_json TEXT NOT NULL DEFAULT '[]',
            cleared_at INTEGER NOT NULL
        ) WITHOUT ROWID
        """
    )
    chat_clear_operation_cols = {
        row[1] for row in conn.execute("PRAGMA table_info(chat_clear_operations)").fetchall()
    }
    if "deleted_thread_ids_json" not in chat_clear_operation_cols:
        conn.execute(
            "ALTER TABLE chat_clear_operations ADD COLUMN deleted_thread_ids_json TEXT NOT NULL DEFAULT '[]'"
        )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT NOT NULL PRIMARY KEY,
            thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
            parent_id TEXT,
            role TEXT NOT NULL,
            content_json TEXT NOT NULL,
            attachments_json TEXT,
            metadata_json TEXT,
            created_at INTEGER NOT NULL
        )
        """
    )
    tombstone_schema = """
        CREATE TABLE chat_attachment_tombstones (
            thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
            message_id TEXT NOT NULL,
            attachment_id TEXT NOT NULL,
            deleted_at INTEGER NOT NULL,
            PRIMARY KEY(thread_id, message_id, attachment_id)
        ) WITHOUT ROWID
    """
    tombstone_table = conn.execute(
        """
        SELECT 1 FROM sqlite_master
        WHERE type = 'table' AND name = 'chat_attachment_tombstones'
        """
    ).fetchone()
    if tombstone_table is None:
        conn.execute(tombstone_schema)
    else:
        tombstone_columns = {
            row[1] for row in conn.execute("PRAGMA table_info(chat_attachment_tombstones)")
        }
        tombstone_fk_targets = {
            row[2] for row in conn.execute("PRAGMA foreign_key_list(chat_attachment_tombstones)")
        }
        if "thread_id" not in tombstone_columns or "chat_threads" not in tombstone_fk_targets:
            # The first implementation cascaded through chat_messages, which erased deletion knowledge
            # during pruneMissing. Rebuild once, retaining every tombstone whose thread still exists.
            conn.execute("SAVEPOINT migrate_chat_attachment_tombstones")
            try:
                conn.execute(
                    "ALTER TABLE chat_attachment_tombstones "
                    "RENAME TO chat_attachment_tombstones_legacy"
                )
                conn.execute(tombstone_schema)
                if "thread_id" in tombstone_columns:
                    conn.execute(
                        """
                        INSERT OR IGNORE INTO chat_attachment_tombstones
                            (thread_id, message_id, attachment_id, deleted_at)
                        SELECT legacy.thread_id, legacy.message_id,
                               legacy.attachment_id, legacy.deleted_at
                        FROM chat_attachment_tombstones_legacy legacy
                        JOIN chat_threads thread ON thread.id = legacy.thread_id
                        """
                    )
                else:
                    conn.execute(
                        """
                        INSERT OR IGNORE INTO chat_attachment_tombstones
                            (thread_id, message_id, attachment_id, deleted_at)
                        SELECT message.thread_id, legacy.message_id,
                               legacy.attachment_id, legacy.deleted_at
                        FROM chat_attachment_tombstones_legacy legacy
                        JOIN chat_messages message ON message.id = legacy.message_id
                        """
                    )
                conn.execute("DROP TABLE chat_attachment_tombstones_legacy")
                conn.execute("RELEASE SAVEPOINT migrate_chat_attachment_tombstones")
            except Exception:
                conn.execute("ROLLBACK TO SAVEPOINT migrate_chat_attachment_tombstones")
                conn.execute("RELEASE SAVEPOINT migrate_chat_attachment_tombstones")
                raise
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_attachment_inventory (
            message_id TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
            attachment_id TEXT NOT NULL,
            name TEXT NOT NULL,
            type TEXT,
            content_type TEXT,
            size_bytes INTEGER,
            PRIMARY KEY(message_id, attachment_id)
        ) WITHOUT ROWID
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_attachment_inventory_state (
            singleton INTEGER NOT NULL PRIMARY KEY CHECK(singleton = 1),
            inventory_version INTEGER NOT NULL DEFAULT 0,
            dirty INTEGER NOT NULL DEFAULT 1,
            backfilled_at INTEGER NOT NULL
        )
        """
    )
    inventory_state_columns = {
        row[1] for row in conn.execute("PRAGMA table_info(chat_attachment_inventory_state)")
    }
    if "inventory_version" not in inventory_state_columns:
        conn.execute(
            "ALTER TABLE chat_attachment_inventory_state "
            "ADD COLUMN inventory_version INTEGER NOT NULL DEFAULT 0"
        )
    if "dirty" not in inventory_state_columns:
        conn.execute(
            "ALTER TABLE chat_attachment_inventory_state "
            "ADD COLUMN dirty INTEGER NOT NULL DEFAULT 1"
        )
    conn.execute(
        """
        CREATE TRIGGER IF NOT EXISTS chat_attachment_inventory_dirty_insert
        AFTER INSERT ON chat_messages
        BEGIN
            INSERT INTO chat_attachment_inventory_state
                (singleton, inventory_version, dirty, backfilled_at)
            VALUES (1, 0, 1, 0)
            ON CONFLICT(singleton) DO UPDATE SET dirty = 1;
        END
        """
    )
    conn.execute(
        """
        CREATE TRIGGER IF NOT EXISTS chat_attachment_inventory_dirty_update
        AFTER UPDATE ON chat_messages
        BEGIN
            INSERT INTO chat_attachment_inventory_state
                (singleton, inventory_version, dirty, backfilled_at)
            VALUES (1, 0, 1, 0)
            ON CONFLICT(singleton) DO UPDATE SET dirty = 1;
        END
        """
    )
    conn.execute(
        """
        CREATE TRIGGER IF NOT EXISTS chat_attachment_inventory_dirty_delete
        AFTER DELETE ON chat_messages
        BEGIN
            INSERT INTO chat_attachment_inventory_state
                (singleton, inventory_version, dirty, backfilled_at)
            VALUES (1, 0, 1, 0)
            ON CONFLICT(singleton) DO UPDATE SET dirty = 1;
        END
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_chat_threads_model_type_created_at ON chat_threads(model_type, created_at)"
    )
    conn.execute("CREATE INDEX IF NOT EXISTS idx_chat_threads_pair_id ON chat_threads(pair_id)")
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_chat_threads_project_id ON chat_threads(project_id)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_chat_messages_thread_id_created_at ON chat_messages(thread_id, created_at)"
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_settings (
            key TEXT NOT NULL PRIMARY KEY,
            value_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS app_settings (
            key TEXT NOT NULL PRIMARY KEY,
            value_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_settings_quarantine (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL,
            value_json TEXT NOT NULL,
            reason TEXT NOT NULL,
            quarantined_at TEXT NOT NULL
        )
        """
    )
    # Import ledger inside studio.db (vs a localStorage boolean) so a db wipe re-triggers the
    # legacy Dexie import instead of silently hiding threads. Keyed by legacy thread id.
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS chat_legacy_imports (
            legacy_thread_id TEXT NOT NULL PRIMARY KEY,
            imported_at INTEGER NOT NULL
        ) WITHOUT ROWID
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS prompt_entries (
            id TEXT NOT NULL PRIMARY KEY,
            name TEXT NOT NULL,
            text TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_prompt_entries_created_at ON prompt_entries(created_at)"
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS prompt_lists (
            id TEXT NOT NULL PRIMARY KEY,
            name TEXT NOT NULL,
            items_json TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_prompt_lists_created_at ON prompt_lists(created_at)"
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS research_runs (
            id TEXT NOT NULL PRIMARY KEY,
            owner_subject TEXT NOT NULL,
            thread_id TEXT NOT NULL REFERENCES chat_threads(id) ON DELETE CASCADE,
            user_message_id TEXT NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
            assistant_message_id TEXT REFERENCES chat_messages(id) ON DELETE SET NULL,
            status TEXT NOT NULL CHECK(status IN (
                'planning', 'awaiting_approval', 'queued', 'running', 'paused',
                'cancelling', 'cancelled', 'completed', 'failed'
            )),
            plan_json TEXT,
            plan_revision INTEGER NOT NULL DEFAULT 0,
            plan_hash TEXT,
            config_json TEXT NOT NULL,
            cancel_requested INTEGER NOT NULL DEFAULT 0,
            lease_owner TEXT,
            lease_expires_at INTEGER,
            heartbeat_at INTEGER,
            retry_count INTEGER NOT NULL DEFAULT 0,
            error_message TEXT,
            report_text TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL,
            started_at INTEGER,
            completed_at INTEGER,
            next_event_seq INTEGER NOT NULL DEFAULT 1
        )
        """
    )
    research_run_cols = {
        row[1] for row in conn.execute("PRAGMA table_info(research_runs)").fetchall()
    }
    if "report_text" not in research_run_cols:
        conn.execute("ALTER TABLE research_runs ADD COLUMN report_text TEXT")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS research_thread_claims (
            owner_subject TEXT NOT NULL,
            thread_id TEXT NOT NULL PRIMARY KEY REFERENCES chat_threads(id) ON DELETE CASCADE,
            created_at INTEGER NOT NULL
        ) WITHOUT ROWID
        """
    )
    claim_pk = [
        row[1]
        for row in sorted(
            conn.execute("PRAGMA table_info(research_thread_claims)").fetchall(),
            key = lambda row: int(row[5] or 0),
        )
        if int(row[5] or 0) > 0
    ]
    if claim_pk != ["thread_id"]:
        # Rebuild the claims table (legacy owner_subject+thread_id PK -> thread_id PK) atomically: in
        # autocommit an interruption after CREATE orphaned the rows in _legacy and never re-triggered.
        conn.commit()
        conn.execute("BEGIN IMMEDIATE")
        try:
            conn.execute(
                "ALTER TABLE research_thread_claims RENAME TO research_thread_claims_legacy"
            )
            conn.execute(
                """
                CREATE TABLE research_thread_claims (
                    owner_subject TEXT NOT NULL,
                    thread_id TEXT NOT NULL PRIMARY KEY REFERENCES chat_threads(id) ON DELETE CASCADE,
                    created_at INTEGER NOT NULL
                ) WITHOUT ROWID
                """
            )
            conn.execute(
                """INSERT OR IGNORE INTO research_thread_claims
                   (owner_subject, thread_id, created_at)
                   SELECT owner_subject, thread_id, created_at
                   FROM research_thread_claims_legacy
                   ORDER BY created_at, owner_subject"""
            )
            conn.execute("DROP TABLE research_thread_claims_legacy")
            conn.commit()
        except Exception:
            conn.rollback()
            raise
    conn.execute(
        """INSERT OR IGNORE INTO research_thread_claims
           (owner_subject, thread_id, created_at)
           SELECT owner_subject, thread_id, created_at
           FROM research_runs ORDER BY created_at, id"""
    )
    conn.execute(
        """UPDATE research_runs
           SET status='failed', error_message='Superseded by the global thread research claim',
               lease_owner=NULL, lease_expires_at=NULL, completed_at=COALESCE(completed_at, updated_at)
           WHERE status IN ('planning','awaiting_approval','queued','running','paused','cancelling')
             AND EXISTS (
                 SELECT 1 FROM research_thread_claims c
                 WHERE c.thread_id=research_runs.thread_id
                   AND c.owner_subject<>research_runs.owner_subject
             )"""
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS research_plan_steps (
            run_id TEXT NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
            position INTEGER NOT NULL,
            title TEXT NOT NULL,
            query TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            result_json TEXT,
            started_at INTEGER,
            completed_at INTEGER,
            PRIMARY KEY(run_id, position)
        ) WITHOUT ROWID
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS research_sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id TEXT NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
            step_position INTEGER,
            url TEXT NOT NULL,
            title TEXT,
            snippet TEXT,
            fetched_at INTEGER NOT NULL,
            UNIQUE(run_id, url)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS research_document_sources (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            run_id TEXT NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
            step_position INTEGER,
            source_key TEXT NOT NULL,
            document_id TEXT,
            chunk_id TEXT,
            filename TEXT NOT NULL,
            page INTEGER,
            score REAL,
            snippet TEXT,
            fetched_at INTEGER NOT NULL,
            UNIQUE(run_id, source_key)
        )
        """
    )
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS research_events (
            run_id TEXT NOT NULL REFERENCES research_runs(id) ON DELETE CASCADE,
            seq INTEGER NOT NULL,
            event_type TEXT NOT NULL,
            data_json TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            PRIMARY KEY(run_id, seq)
        ) WITHOUT ROWID
        """
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_research_runs_owner_thread_status "
        "ON research_runs(owner_subject, thread_id, status)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_research_runs_lease "
        "ON research_runs(status, lease_expires_at)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_research_sources_run ON research_sources(run_id, id)"
    )
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_research_document_sources_run "
        "ON research_document_sources(run_id, id)"
    )
    inventory_state = conn.execute(
        """
        SELECT inventory_version, dirty
        FROM chat_attachment_inventory_state
        WHERE singleton = 1
        """
    ).fetchone()
    # Positional read: works for raw tuple or sqlite3.Row (no row_factory precondition).
    if (
        inventory_state is None
        or inventory_state[0] != _CHAT_ATTACHMENT_INVENTORY_VERSION
        or inventory_state[1]
    ):
        _rebuild_chat_attachment_inventory(conn)
        _mark_chat_attachment_inventory_clean(conn)
    conn.commit()


