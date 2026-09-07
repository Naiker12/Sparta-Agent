"""Durable long-term memory graph and scheduled-agent task records."""
from __future__ import annotations

import time
import uuid
from typing import Any

from storage.studio.connection import get_connection

_MEMORY_TYPES = {"entity", "fact", "preference", "event"}
_SCHEDULE_TYPES = {"interval", "once"}

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
    now, node_id = _now(), node_id or str(uuid.uuid4())
    conn = get_connection()
    try:
        exists = conn.execute("SELECT 1 FROM memory_nodes WHERE id=?", (node_id,)).fetchone()
        if exists: conn.execute("UPDATE memory_nodes SET type=?, label=?, content=?, confidence=?, updated_at=? WHERE id=?", (kind, label, content, float(data.get("confidence", 1)), now, node_id))
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

def list_tasks() -> list[dict]:
    conn = get_connection()
    try: return [_task(row) for row in conn.execute("SELECT * FROM agent_tasks ORDER BY enabled DESC, next_run_at ASC, created_at DESC").fetchall()]
    finally: conn.close()

def get_task(task_id: str) -> dict | None:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM agent_tasks WHERE id=?", (task_id,)).fetchone()
        if not row: return None
        task = _task(row); task["runs"] = [dict(run) for run in conn.execute("SELECT id, started_at AS startedAt, finished_at AS finishedAt, status, output, error FROM agent_task_runs WHERE task_id=? ORDER BY started_at DESC LIMIT 50", (task_id,)).fetchall()]; return task
    finally: conn.close()

def upsert_task(data: dict, task_id: str | None = None) -> dict:
    title, prompt = str(data.get("title", "")).strip(), str(data.get("prompt", "")).strip()
    schedule = data.get("scheduleType", "interval")
    if not title or not prompt or schedule not in _SCHEDULE_TYPES: raise ValueError("Invalid task")
    interval = int(data.get("intervalSeconds") or 0) or None
    if schedule == "interval" and (interval is None or interval < 60): raise ValueError("Interval must be at least 60 seconds")
    now, task_id = _now(), task_id or str(uuid.uuid4()); enabled = bool(data.get("enabled", True)); next_run = now + interval * 1000 if enabled and interval else data.get("runAt")
    conn = get_connection()
    try:
        if conn.execute("SELECT 1 FROM agent_tasks WHERE id=?", (task_id,)).fetchone(): conn.execute("UPDATE agent_tasks SET title=?,prompt=?,schedule_type=?,interval_seconds=?,run_at=?,thread_id=?,enabled=?,next_run_at=?,updated_at=? WHERE id=?", (title,prompt,schedule,interval,data.get("runAt"),data.get("threadId"),enabled,next_run,now,task_id))
        else: conn.execute("INSERT INTO agent_tasks(id,title,prompt,schedule_type,interval_seconds,run_at,thread_id,enabled,next_run_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)", (task_id,title,prompt,schedule,interval,data.get("runAt"),data.get("threadId"),enabled,next_run,now,now))
        conn.commit(); return get_task(task_id) or {}
    finally: conn.close()

def delete_task(task_id: str) -> bool:
    conn = get_connection()
    try:
        conn.execute("DELETE FROM agent_task_runs WHERE task_id=?", (task_id,))
        result = conn.execute("DELETE FROM agent_tasks WHERE id=?", (task_id,))
        conn.commit()
        return result.rowcount > 0
    finally:
        conn.close()
