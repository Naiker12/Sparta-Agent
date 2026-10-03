"""Project queue observations into the work ledger in the same SQLite transaction."""
import hashlib
import json
import sqlite3
import uuid

from core.prompt_queue_contracts import QueueCheckpoint
from storage.work_run_events import append_work_event
from storage.work_runs_db import WorkConflictError

CHAT_LEASE_MS = 30_000
TERMINAL = frozenset({"completed", "failed", "cancelled"})


def _canonical(value: dict) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def synchronize_chat_work(conn: sqlite3.Connection, owner: str, queue_id: str,
                          checkpoint: QueueCheckpoint, now: int) -> None:
    present = {item.id for item in checkpoint.items}
    for item in checkpoint.items:
        identity = json.dumps([queue_id, item.id], separators=(",", ":"))
        key = "chat:" + hashlib.sha256(identity.encode()).hexdigest()
        request = {
            "origin": "chat_queue", "queueId": queue_id, "itemId": item.id,
            "threadId": checkpoint.threadId, "projectId": checkpoint.projectId,
            "promptPreview": item.prompt[:1000], "modelId": item.settings["params"]["checkpoint"],
            "recoveryPermissionMode": item.settings["permissionMode"],
            "snapshotHash": hashlib.sha256(_canonical({"prompt": item.prompt, "settings": item.settings}).encode()).hexdigest(),
        }
        raw = _canonical(request)
        digest = hashlib.sha256(raw.encode()).hexdigest()
        row = conn.execute("SELECT * FROM work_runs WHERE owner_subject=? AND request_key=?",
                           (owner, key)).fetchone()
        if row is None:
            run_id = str(uuid.uuid4())
            conn.execute("INSERT INTO work_runs "
                         "(id,owner_subject,request_key,request_hash,request_json,status,created_at,updated_at,"
                         "source_kind,source_thread_id,source_queue_id,source_item_id) "
                         "VALUES(?,?,?,?,?,'queued',?,?,'chat_queue',?,?,?)",
                         (run_id, owner, key, digest, raw, now, now, checkpoint.threadId, queue_id, item.id))
            append_work_event(conn, run_id, "chat.queued", now)
            row = conn.execute("SELECT * FROM work_runs WHERE id=?", (run_id,)).fetchone()
        elif row["source_kind"] != "chat_queue" or row["source_thread_id"] != checkpoint.threadId:
            raise WorkConflictError("Work item identity conflicts with its conversation")
        run_id = row["id"]
        encoded = _canonical({**item.result.model_dump(), "observedBy": "chat_runtime"}) if item.result else None
        if row["status"] in TERMINAL:
            if item.result and encoded != row["result_json"]:
                raise WorkConflictError("An observed terminal result cannot be overwritten")
            continue
        if item.result:
            # observedBy is provenance, not a claim of independently verified tool effects.
            if row["status"] == item.result.status and row["result_json"] == encoded:
                continue
            conn.execute("UPDATE work_runs SET status=?,result_json=?,worker_id=NULL,lease_until=NULL WHERE id=?",
                         (item.result.status, encoded, run_id))
            append_work_event(conn, run_id, "chat.result_observed", now,
                              {"status": item.result.status, "reason": item.result.reason})
        elif item.dispatched:
            if row["status"] != "running":
                conn.execute("UPDATE work_runs SET status='running',attempt=attempt+?,worker_id=NULL,"
                             "lease_until=? WHERE id=?", (1 if row["status"] == "queued" else 0, now + CHAT_LEASE_MS, run_id))
                append_work_event(conn, run_id, "chat.dispatch_registered", now)
            else:
                conn.execute("UPDATE work_runs SET lease_until=? WHERE id=?", (now + CHAT_LEASE_MS, run_id))
        else:
            changed = row["request_hash"] != digest or row["status"] != "queued"
            conn.execute("UPDATE work_runs SET status='queued',request_hash=?,request_json=?,lease_until=NULL,"
                         "worker_id=NULL,result_json=NULL WHERE id=?", (digest, raw, run_id))
            if changed:
                append_work_event(conn, run_id, "chat.pending_updated", now)
    removed = conn.execute("SELECT * FROM work_runs WHERE owner_subject=? AND source_queue_id=?",
                           (owner, queue_id)).fetchall()
    for row in removed:
        if row["source_item_id"] in present or row["status"] in TERMINAL | {"needs_review"}:
            continue
        status = "needs_review" if row["status"] == "running" else "cancelled"
        conn.execute("UPDATE work_runs SET status=?,lease_until=NULL,worker_id=NULL WHERE id=?", (status, row["id"]))
        append_work_event(conn, row["id"], "chat.removed", now, {"status": status})


def recover_chat_observations(conn: sqlite3.Connection, owner: str, now: int) -> None:
    rows = conn.execute("SELECT id FROM work_runs WHERE owner_subject=? AND source_kind='chat_queue' "
                        "AND status='running' AND lease_until<=?", (owner, now)).fetchall()
    for row in rows:
        conn.execute("UPDATE work_runs SET status='needs_review',lease_until=NULL WHERE id=?", (row["id"],))
        append_work_event(conn, row["id"], "chat.observation_expired", now)
