"""Durable long-term memory graph and scheduled-agent task records."""
from __future__ import annotations

import time
import uuid
import json
import re
from zoneinfo import ZoneInfo
from typing import Any

from storage.studio.connection import get_connection

_MEMORY_TYPES = {"entity", "fact", "preference", "event"}
_SCHEDULE_TYPES = {"interval", "once", "weekly"}

def _now() -> int: return int(time.time() * 1000)
def _node(row: Any) -> dict: return {"id": row["id"], "type": row["type"], "label": row["label"], "content": row["content"], "sourceThreadId": row["source_thread_id"], "confidence": row["confidence"], "createdAt": row["created_at"], "updatedAt": row["updated_at"], "lastAccessedAt": row["last_accessed_at"]}
def _task(row: Any) -> dict: return {"id": row["id"], "title": row["title"], "prompt": row["prompt"], "scheduleType": row["schedule_type"], "intervalSeconds": row["interval_seconds"], "runAt": row["run_at"], "channel": row["channel"], "threadId": row["thread_id"], "enabled": bool(row["enabled"]), "status": row["status"], "lastRunAt": row["last_run_at"], "nextRunAt": row["next_run_at"], "lastError": row["last_error"], "createdAt": row["created_at"], "updatedAt": row["updated_at"]}

def list_memory(query: str | None = None) -> dict:
    conn = get_connection()
    try:
        if query:
            token = f"%{query.strip()}%"
            rows = conn.execute("SELECT * FROM memory_nodes WHERE label LIKE ? OR content LIKE ? ORDER BY updated_at DESC LIMIT 200", (token, token)).fetchall()
        else: rows = conn.execute("SELECT * FROM memory_nodes ORDER BY updated_at DESC LIMIT 500").fetchall()
        node_ids = {row["id"] for row in rows}
        edges = [dict(row) for row in conn.execute("SELECT id, source_node_id AS source, target_node_id AS target, relation, created_at AS createdAt FROM memory_edges").fetchall() if row["source"] in node_ids and row["target"] in node_ids]
        return {"nodes": [_node(row) for row in rows], "edges": edges}
    finally: conn.close()

def get_memory_node(node_id: str) -> dict | None:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM memory_nodes WHERE id=?", (node_id,)).fetchone()
        if not row: return None
        conn.execute("UPDATE memory_nodes SET last_accessed_at=? WHERE id=?", (_now(), node_id)); conn.commit()
        return _node(row)
    finally: conn.close()

def upsert_memory(data: dict, node_id: str | None = None) -> dict:
    kind = data.get("type", "fact")
    if kind not in _MEMORY_TYPES: raise ValueError("Invalid memory type")
    label, content = str(data.get("label", "")).strip(), str(data.get("content", "")).strip()
    if not label or not content: raise ValueError("Memory label and content are required")
    now = _now()
    conn = get_connection()
    try:
        # Synchronization can run repeatedly after restarts. Preserve one
        # durable node for the same fact and its original chat source.
        if node_id is None:
            duplicate = conn.execute(
                "SELECT id FROM memory_nodes WHERE type=? AND label=? AND content=? "
                "AND COALESCE(source_thread_id, '')=COALESCE(?, '')",
                (kind, label, content, data.get("sourceThreadId")),
            ).fetchone()
            node_id = duplicate["id"] if duplicate else str(uuid.uuid4())
        exists = conn.execute("SELECT 1 FROM memory_nodes WHERE id=?", (node_id,)).fetchone()
        if exists: conn.execute("UPDATE memory_nodes SET type=?, label=?, content=?, source_thread_id=?, confidence=?, updated_at=? WHERE id=?", (kind, label, content, data.get("sourceThreadId"), float(data.get("confidence", 1)), now, node_id))
        else: conn.execute("INSERT INTO memory_nodes(id,type,label,content,source_thread_id,confidence,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)", (node_id, kind, label, content, data.get("sourceThreadId"), float(data.get("confidence", 1)), now, now))
        conn.commit(); return get_memory_node(node_id) or {}
    finally: conn.close()

def delete_memory(node_id: str) -> bool:
    conn = get_connection()
    try: result = conn.execute("DELETE FROM memory_nodes WHERE id=?", (node_id,)); conn.commit(); return result.rowcount > 0
    finally: conn.close()

def upsert_memory_edge(source_node_id: str, target_node_id: str, relation: str) -> dict:
    """Create or update a directed relation between two durable memories."""
    relation = relation.strip()
    if not relation:
        raise ValueError("A memory relation is required")
    if source_node_id == target_node_id:
        raise ValueError("A memory cannot relate to itself")
    conn = get_connection()
    try:
        count = conn.execute(
            "SELECT COUNT(*) FROM memory_nodes WHERE id IN (?, ?)",
            (source_node_id, target_node_id),
        ).fetchone()[0]
        if count != 2:
            raise ValueError("Both memory nodes must exist")
        existing = conn.execute(
            "SELECT id FROM memory_edges WHERE source_node_id=? AND target_node_id=? AND relation=?",
            (source_node_id, target_node_id, relation),
        ).fetchone()
        edge_id = existing["id"] if existing else str(uuid.uuid4())
        if not existing:
            conn.execute(
                "INSERT INTO memory_edges(id,source_node_id,target_node_id,relation,created_at) VALUES(?,?,?,?,?)",
                (edge_id, source_node_id, target_node_id, relation, _now()),
            )
            conn.commit()
        row = conn.execute(
            "SELECT id, source_node_id AS source, target_node_id AS target, relation, created_at AS createdAt FROM memory_edges WHERE id=?",
            (edge_id,),
        ).fetchone()
        return dict(row)
    finally:
        conn.close()

def delete_memory_edge(edge_id: str) -> bool:
    conn = get_connection()
    try:
        result = conn.execute("DELETE FROM memory_edges WHERE id=?", (edge_id,))
        conn.commit()
        return result.rowcount > 0
    finally:
        conn.close()

def list_tasks(owner_subject: str) -> list[dict]:
    conn = get_connection()
    try: return [_configured_task(row) for row in conn.execute("SELECT * FROM agent_tasks WHERE owner_subject=? ORDER BY enabled DESC, next_run_at ASC, created_at DESC", (owner_subject,)).fetchall()]
    finally: conn.close()

def get_task(task_id: str, owner_subject: str | None = None) -> dict | None:
    conn = get_connection()
    try:
        where, values = ("id=?", (task_id,)) if owner_subject is None else ("id=? AND owner_subject=?", (task_id, owner_subject))
        row = conn.execute(f"SELECT * FROM agent_tasks WHERE {where}", values).fetchone()
        if not row: return None
        task = _configured_task(row); task["runs"] = [dict(run) for run in conn.execute("SELECT id, started_at AS startedAt, finished_at AS finishedAt, status, output, error FROM agent_task_runs WHERE task_id=? ORDER BY started_at DESC LIMIT 50", (task_id,)).fetchall()]; return task
    finally: conn.close()

def upsert_task(data: dict, task_id: str | None = None, owner_subject: str | None = None) -> dict:
    title, prompt = str(data.get("title", "")).strip(), str(data.get("prompt", "")).strip()
    schedule = data.get("scheduleType", "interval")
    if not title or not prompt or schedule not in _SCHEDULE_TYPES: raise ValueError("Invalid task")
    config = {"timezone": data.get("timezone") or "UTC", "weekdays": data.get("weekdays") or [], "localTime": data.get("localTime") or "09:00", "notify": bool(data.get("notify", True))}
    try: ZoneInfo(config["timezone"])
    except (KeyError, ValueError, TypeError) as error: raise ValueError("Invalid timezone") from error
    if schedule == "weekly":
        if not re.fullmatch(r"(?:[01]\d|2[0-3]):[0-5]\d", config["localTime"]): raise ValueError("Invalid local time")
        if not config["weekdays"] or any(type(day) is not int or day not in range(7) for day in config["weekdays"]): raise ValueError("Choose weekdays from Monday (0) to Sunday (6)")
        config["weekdays"] = sorted(set(config["weekdays"]))
    interval = int(data.get("intervalSeconds") or 0) or None
    if schedule == "interval" and (interval is None or interval < 60): raise ValueError("Interval must be at least 60 seconds")
    now = _now()
    if schedule == "once" and (not isinstance(data.get("runAt"), int) or (data["runAt"] <= now and (task_id is None or data.get("enabled")))):
        raise ValueError("One-time tasks require a future runAt timestamp")
    updating = task_id is not None
    task_id = task_id or str(uuid.uuid4())
    enabled = bool(data.get("enabled", False))
    next_run = (now + interval * 1000 if schedule == "interval" else data.get("runAt")) if enabled else None
    conn = get_connection()
    try:
        existing = conn.execute("SELECT * FROM agent_tasks WHERE id=?", (task_id,)).fetchone()
        if updating and not existing: return {}
        if existing and existing["owner_subject"] != owner_subject:
            return {}
        if existing and enabled and existing["enabled"] and existing["schedule_type"] == schedule and existing["interval_seconds"] == interval and existing["run_at"] == data.get("runAt"):
            next_run = existing["next_run_at"]
        if existing: conn.execute("UPDATE agent_tasks SET title=?,prompt=?,schedule_type=?,interval_seconds=?,run_at=?,thread_id=?,enabled=?,next_run_at=?,updated_at=? WHERE id=?", (title,prompt,schedule,interval,data.get("runAt"),data.get("threadId"),enabled,next_run,now,task_id))
        else: conn.execute("INSERT INTO agent_tasks(id,title,prompt,schedule_type,interval_seconds,run_at,thread_id,owner_subject,enabled,next_run_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)", (task_id,title,prompt,schedule,interval,data.get("runAt"),data.get("threadId"),owner_subject,enabled,next_run,now,now))
        conn.execute("UPDATE agent_tasks SET schedule_config=? WHERE id=?", (json.dumps(config), task_id))
        conn.commit(); return get_task(task_id, owner_subject) or {}
    finally: conn.close()

def delete_task(task_id: str, owner_subject: str) -> bool:
    conn = get_connection()
    try:
        owned = conn.execute("SELECT 1 FROM agent_tasks WHERE id=? AND owner_subject=?", (task_id, owner_subject)).fetchone()
        if not owned:
            return False
        conn.execute("DELETE FROM agent_task_runs WHERE task_id=?", (task_id,))
        result = conn.execute("DELETE FROM agent_tasks WHERE id=?", (task_id,))
        conn.commit()
        return result.rowcount > 0
    finally:
        conn.close()

def activate_task(task_id, owner_subject, provider_id, model):
    from core.inference.task_scheduler import next_occurrence
    conn = get_connection()
    try:
        conn.execute('BEGIN IMMEDIATE')
        row = conn.execute('SELECT * FROM agent_tasks WHERE id=? AND owner_subject=?', (task_id, owner_subject)).fetchone()
        if not row: raise LookupError('Task not found')
        task = _configured_task(row)
        now = _now()
        due = task['runAt'] if task['scheduleType'] == 'once' else next_occurrence(task, now)
        if due is None or due <= now: raise ValueError('Choose a future schedule')
        config = json.loads(row['schedule_config'])
        config.update(providerId=provider_id, model=model, automaticConsent=True)
        conn.execute('UPDATE agent_tasks SET enabled=1,next_run_at=?,schedule_config=?,updated_at=? WHERE id=?', (due, json.dumps(config), now, task_id))
        conn.commit()
        return get_task(task_id, owner_subject)
    finally: conn.close()

def claim_due_task():
    from core.inference.task_scheduler import next_occurrence
    conn = get_connection()
    now = _now()
    try:
        conn.execute('BEGIN IMMEDIATE')
        conn.execute("UPDATE agent_task_runs SET status='interrupted',finished_at=?,error='Execution interrupted' WHERE status='running' AND started_at<?", (now, now - 120000))
        rows = conn.execute("SELECT * FROM agent_tasks WHERE enabled=1 AND owner_subject IS NOT NULL AND next_run_at<=? AND NOT EXISTS (SELECT 1 FROM agent_task_runs r WHERE r.task_id=agent_tasks.id AND r.status='running') ORDER BY next_run_at", (now,)).fetchall()
        for row in rows:
            task = _configured_task(row)
            if not task.get('automaticConsent') or not task.get('providerId') or not task.get('model'):
                continue  # Legacy enabled tasks never gain implicit credential access.
            next_run = next_occurrence(task, now)
            run_id = str(uuid.uuid4())
            conn.execute("INSERT INTO agent_task_runs(id,task_id,started_at,status) VALUES(?,?,?,'running')", (run_id, task['id'], now))
            conn.execute('UPDATE agent_tasks SET next_run_at=?,enabled=?,last_run_at=? WHERE id=?', (next_run, next_run is not None, now, task['id']))
            conn.commit()
            return task, run_id
        conn.commit()
        return None
    finally: conn.close()

def task_notifications(owner_subject, since):
    conn = get_connection()
    try:
        rows = conn.execute("SELECT r.id,r.status,r.finished_at AS finishedAt,t.schedule_config FROM agent_task_runs r JOIN agent_tasks t ON t.id=r.task_id WHERE t.owner_subject=? AND r.finished_at>? ORDER BY r.finished_at LIMIT 100", (owner_subject, since)).fetchall()
        return [{'id': row['id'], 'status': row['status'], 'finishedAt': row['finishedAt'], 'notify': json.loads(row['schedule_config']).get('notify', True)} for row in rows]
    finally: conn.close()

def begin_task_preview(task_id: str, owner_subject: str) -> str:
    """Atomically prevent duplicate manual runs, including across server workers."""
    conn = get_connection()
    now = _now()
    try:
        conn.execute("BEGIN IMMEDIATE")
        if not conn.execute("SELECT 1 FROM agent_tasks WHERE id=? AND owner_subject=?", (task_id, owner_subject)).fetchone():
            raise LookupError("Task not found")
        conn.execute("UPDATE agent_task_runs SET status='interrupted', finished_at=?, error='Execution interrupted' WHERE task_id=? AND status='running' AND started_at<?", (now, task_id, now - 120000))
        if conn.execute("SELECT 1 FROM agent_task_runs WHERE task_id=? AND status='running'", (task_id,)).fetchone():
            raise ValueError("A test is already running")
        run_id = str(uuid.uuid4())
        conn.execute("INSERT INTO agent_task_runs(id,task_id,started_at,status) VALUES(?,?,?,'running')", (run_id, task_id, now))
        conn.commit()
        return run_id
    finally:
        conn.close()

def _configured_task(row):
    return {**_task(row), **json.loads(row['schedule_config'] or '{}')}

def finish_task_preview(run_id: str, output: str | None = None, error: str | None = None):
    conn = get_connection()
    try:
        conn.execute("UPDATE agent_task_runs SET finished_at=?,status=?,output=?,error=? WHERE id=? AND status='running'", (_now(), 'failed' if error else 'completed', output, error, run_id))
        conn.commit()
    finally:
        conn.close()
