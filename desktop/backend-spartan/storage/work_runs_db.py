"""Durable work repository. No provider calls, timers, or UI dependencies."""
from __future__ import annotations

from contextlib import contextmanager
import hashlib
import json
import sqlite3
import time
from typing import Callable, Iterator
import uuid

from storage.studio.connection import get_connection
from storage.work_run_events import append_work_event, decode_work_run


class WorkConflictError(ValueError):
    """The caller's version or execution ownership is no longer current."""


def _json(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"),
                      ensure_ascii=False, allow_nan=False)


class WorkRunRepository:
    """Connection and clock injection keep transactions independently testable."""

    def __init__(self, connection: Callable[[], sqlite3.Connection] = get_connection,
                 clock: Callable[[], int] | None = None):
        self._connection = connection
        self._clock = clock or (lambda: time.time_ns() // 1_000_000)

    @contextmanager
    def _transaction(self) -> Iterator[sqlite3.Connection]:
        conn = self._connection()
        try:
            conn.execute("BEGIN IMMEDIATE")
            yield conn
            conn.commit()
        except BaseException:
            conn.rollback()
            raise
        finally:
            conn.close()

    @staticmethod
    def _require(conn: sqlite3.Connection, owner: str, run_id: str) -> sqlite3.Row:
        row = conn.execute("SELECT * FROM work_runs WHERE id=? AND owner_subject=?",
                           (run_id, owner)).fetchone()
        if row is None:
            raise KeyError(run_id)
        return row

    @staticmethod
    def _decode(row: sqlite3.Row) -> dict:
        return decode_work_run(row)

    def _event(self, conn: sqlite3.Connection, run_id: str, kind: str,
               data: dict | None = None) -> None:
        append_work_event(conn, run_id, kind, self._clock(), data)

    def create(self, owner: str, request_key: str, request: dict) -> dict:
        if not owner.strip() or not request_key.strip():
            raise ValueError("Owner and request key are required")
        if request_key.startswith(("chat:", "channel:")):
            raise ValueError("Request key namespace is reserved for projected work")
        if request.get("temporary"):
            raise ValueError("Temporary conversations cannot create durable work")
        raw = _json(request)
        if len(raw.encode("utf-8")) > 128_000:
            raise ValueError("Work request exceeds storage limit")
        digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        with self._transaction() as conn:
            row = conn.execute("SELECT * FROM work_runs WHERE owner_subject=? AND request_key=?",
                               (owner, request_key)).fetchone()
            if row is not None:
                if row["request_hash"] != digest:
                    raise WorkConflictError("Request key already has different content")
                return self._decode(row)
            run_id, now = str(uuid.uuid4()), self._clock()
            conn.execute("INSERT INTO work_runs "
                         "(id,owner_subject,request_key,request_hash,request_json,status,created_at,updated_at) "
                         "VALUES(?,?,?,?,?,'queued',?,?)",
                         (run_id, owner, request_key, digest, raw, now, now))
            self._event(conn, run_id, "created")
            return self._decode(self._require(conn, owner, run_id))

    def get(self, owner: str, run_id: str) -> dict:
        with self._transaction() as conn:
            return self._decode(self._require(conn, owner, run_id))

    def list(self, owner: str, limit: int = 100) -> list[dict]:
        if not 1 <= limit <= 500:
            raise ValueError("Limit must be between 1 and 500")
        with self._transaction() as conn:
            return [self._decode(row) for row in conn.execute(
                "SELECT * FROM work_runs WHERE owner_subject=? ORDER BY created_at,rowid LIMIT ?",
                (owner, limit))]

    def events(self, owner: str, run_id: str, after: int = 0) -> list[dict]:
        with self._transaction() as conn:
            self._require(conn, owner, run_id)
            rows = conn.execute("SELECT * FROM work_run_events WHERE run_id=? AND revision>? "
                                "ORDER BY revision LIMIT 500", (run_id, after))
            return [{**dict(row), "data": json.loads(row["data_json"])} for row in rows]

    def claim(self, owner: str, worker_id: str, lease_ms: int = 30_000) -> dict | None:
        if not worker_id.strip() or not 1_000 <= lease_ms <= 300_000:
            raise ValueError("Invalid worker or lease duration")
        with self._transaction() as conn:
            row = conn.execute("SELECT id FROM work_runs WHERE owner_subject=? AND status='queued' AND source_kind='manual' "
                               "ORDER BY created_at,rowid LIMIT 1", (owner,)).fetchone()
            if row is None:
                return None
            run_id = row["id"]
            conn.execute("UPDATE work_runs SET status='running',worker_id=?,lease_until=?,"
                         "attempt=attempt+1 WHERE id=?",
                         (worker_id, self._clock() + lease_ms, run_id))
            self._event(conn, run_id, "claimed")
            return self._decode(self._require(conn, owner, run_id))

    def finish(self, owner: str, run_id: str, worker_id: str, attempt: int,
               result: dict, *, failed: bool = False) -> dict:
        raw = _json(result)
        if len(raw.encode("utf-8")) > 128_000:
            raise ValueError("Work result exceeds storage limit")
        with self._transaction() as conn:
            row = self._require(conn, owner, run_id)
            if (row["status"] != "running" or row["worker_id"] != worker_id
                    or row["attempt"] != attempt or row["lease_until"] <= self._clock()):
                raise WorkConflictError("Execution lease is no longer valid")
            status = "failed" if failed else "completed"
            conn.execute("UPDATE work_runs SET status=?,result_json=?,worker_id=NULL,lease_until=NULL "
                         "WHERE id=?", (status, raw, run_id))
            self._event(conn, run_id, status)
            return self._decode(self._require(conn, owner, run_id))

    def heartbeat(self, owner: str, run_id: str, worker_id: str, attempt: int,
                  lease_ms: int = 30_000) -> None:
        if not 1_000 <= lease_ms <= 300_000:
            raise ValueError("Invalid lease duration")
        with self._transaction() as conn:
            row = self._require(conn, owner, run_id)
            if (row["status"] != "running" or row["worker_id"] != worker_id
                    or row["attempt"] != attempt or row["lease_until"] <= self._clock()):
                raise WorkConflictError("Execution lease is no longer valid")
            conn.execute("UPDATE work_runs SET lease_until=? WHERE id=?",
                         (self._clock() + lease_ms, run_id))

    def transition(self, owner: str, run_id: str, expected_revision: int, action: str) -> dict:
        transitions = {"pause": {"queued": "paused"}, "resume": {"paused": "queued"},
                       "cancel": {"queued": "cancelled", "paused": "cancelled",
                                  "needs_review": "cancelled"}}
        with self._transaction() as conn:
            row = self._require(conn, owner, run_id)
            target = transitions.get(action, {}).get(row["status"])
            if row["revision"] != expected_revision or target is None:
                raise WorkConflictError("Stale revision or unsupported transition")
            conn.execute("UPDATE work_runs SET status=? WHERE id=?", (target, run_id))
            self._event(conn, run_id, action)
            return self._decode(self._require(conn, owner, run_id))

    def recover_expired(self) -> int:
        """Internal maintenance only: never automatically replay uncertain work."""
        with self._transaction() as conn:
            rows = conn.execute("SELECT id FROM work_runs WHERE status='running' AND lease_until<=?",
                                (self._clock(),)).fetchall()
            for row in rows:
                conn.execute("UPDATE work_runs SET status='needs_review',worker_id=NULL,lease_until=NULL "
                             "WHERE id=?", (row["id"],))
                self._event(conn, row["id"], "interrupted")
            return len(rows)
