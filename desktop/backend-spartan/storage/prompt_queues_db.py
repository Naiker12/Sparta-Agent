"""Owner-scoped queue checkpoints with optimistic concurrency and chat binding."""
import json
import sqlite3
import time

from core.prompt_queue_contracts import QueueCheckpoint
from storage.studio.connection import get_connection
from storage.work_runs_db import WorkConflictError
from storage.chat_work_projection import synchronize_chat_work, recover_chat_observations
from storage.work_run_events import decode_work_run


class PromptQueueRepository:
    def __init__(self, connection=get_connection, clock=None):
        self._connection = connection
        self._clock = clock or (lambda: time.time_ns() // 1_000_000)

    def save(self, owner: str, queue_id: str, expected_revision: int,
             checkpoint: QueueCheckpoint) -> dict:
        raw = checkpoint.model_dump_json()
        if len(raw.encode("utf-8")) > 2_000_000:
            raise ValueError("Queue checkpoint exceeds storage limit")
        conn = self._connection()
        try:
            conn.execute("BEGIN IMMEDIATE")
            thread = conn.execute("SELECT project_id FROM chat_threads WHERE id=?",
                                  (checkpoint.threadId,)).fetchone()
            if thread is None:
                raise KeyError(checkpoint.threadId)
            if checkpoint.items and thread["project_id"] != checkpoint.projectId:
                raise WorkConflictError("Chat project changed; queue checkpoint needs review")
            row = conn.execute("SELECT * FROM work_prompt_queues WHERE owner_subject=? AND id=?",
                               (owner, queue_id)).fetchone()
            if row and row["thread_id"] != checkpoint.threadId:
                raise WorkConflictError("A queue cannot move to another conversation")
            if row and checkpoint.items and json.loads(row["snapshot_json"])["projectId"] != checkpoint.projectId:
                raise WorkConflictError("Recovered work cannot change its project scope")
            if row and row["snapshot_json"] == raw and expected_revision == row["revision"] - 1:
                return self._decode(row)  # uncertain network response, exact retry
            if (row["revision"] if row else 0) != expected_revision:
                raise WorkConflictError("Queue checkpoint was changed in another session")
            revision = expected_revision + 1
            conn.execute("INSERT INTO work_prompt_queues(owner_subject,id,thread_id,revision,snapshot_json) "
                         "VALUES(?,?,?,?,?) ON CONFLICT(owner_subject,id) DO UPDATE SET "
                         "revision=excluded.revision,snapshot_json=excluded.snapshot_json",
                         (owner, queue_id, checkpoint.threadId, revision, raw))
            synchronize_chat_work(conn, owner, queue_id, checkpoint, self._clock())
            conn.commit()
            return {"id": queue_id, "revision": revision, "checkpoint": json.loads(raw)}
        except BaseException:
            conn.rollback()
            raise
        finally:
            conn.close()

    def list_for_thread(self, owner: str, thread_id: str) -> list[dict]:
        conn = self._connection()
        try:
            return [self._decode(row) for row in conn.execute(
                "SELECT * FROM work_prompt_queues WHERE owner_subject=? AND thread_id=? ORDER BY rowid",
                (owner, thread_id)) if json.loads(row["snapshot_json"])["items"]]
        finally:
            conn.close()

    def overview(self, owner: str, limit: int = 100, offset: int = 0) -> dict:
        conn = self._connection()
        try:
            conn.execute("BEGIN IMMEDIATE")
            recover_chat_observations(conn, owner, self._clock())
            rows = conn.execute("SELECT r.*,t.title AS thread_title,p.name AS project_name "
                                "FROM work_runs r LEFT JOIN chat_threads t ON t.id=r.source_thread_id "
                                "LEFT JOIN chat_projects p ON p.id=t.project_id "
                                "WHERE r.owner_subject=? ORDER BY r.created_at DESC,r.rowid DESC LIMIT ? OFFSET ?",
                                (owner, limit + 1, offset)).fetchall()
            conn.commit()
            return {"runs": [decode_work_run(row) for row in rows[:limit]],
                    "hasMore": len(rows) > limit, "offset": offset}
        except BaseException:
            conn.rollback()
            raise
        finally:
            conn.close()

    @staticmethod
    def _decode(row: sqlite3.Row) -> dict:
        return {"id": row["id"], "revision": row["revision"],
                "checkpoint": json.loads(row["snapshot_json"])}
