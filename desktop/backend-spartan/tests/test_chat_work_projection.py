import sqlite3
import pytest
from pydantic import ValidationError
from core.prompt_queue_contracts import QueueCheckpoint
from storage.prompt_queues_db import PromptQueueRepository
from storage.work_runs_schema import ensure_work_runs_schema
from storage.work_runs_db import WorkConflictError

@pytest.fixture
def store(tmp_path):
    path = tmp_path / "work.db"
    def connect():
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        return conn
    with connect() as conn:
        conn.executescript("CREATE TABLE chat_projects(id TEXT PRIMARY KEY,name TEXT); CREATE TABLE chat_threads(id TEXT PRIMARY KEY,project_id TEXT,title TEXT); INSERT INTO chat_threads VALUES('thread',NULL,'Chat');")
        ensure_work_runs_schema(conn)
    clock = [1000]
    return PromptQueueRepository(connect, lambda: clock[0]), connect, clock

def checkpoint(dispatched=False, result=None):
    item = {"id": "item", "prompt": "Revisa el formulario", "dispatched": dispatched, "settings": {"params": {"checkpoint": "external:provider:model"}, "permissionMode": "ask", "bypassPermissions": False}}
    if result: item["result"] = result
    return QueueCheckpoint.model_validate({"version": 1, "threadId": "thread", "projectId": None, "items": [item]})

@pytest.mark.parametrize("status", ["completed", "failed", "cancelled", "needs_review"])
def test_observed_results_and_owner_isolation(store, status):
    repo, connect, clock = store
    repo.save("alice", "queue", 0, checkpoint())
    repo.save("alice", "queue", 1, checkpoint(True))
    result = {"status": status, "summary": "Respuesta", "reason": "unknown"}
    repo.save("alice", "queue", 2, checkpoint(True, result))
    overview = repo.overview("alice")
    assert overview["runs"][0]["status"] == status
    assert overview["runs"][0]["result"]["observedBy"] == "chat_runtime"
    assert repo.overview("bob")["runs"] == []
    assert overview["runs"][0]["attempt"] == 1
    repo.save("alice", "queue", 2, checkpoint(True, result))
    with connect() as conn:
        assert conn.execute("SELECT COUNT(*) FROM work_run_events WHERE event_type='chat.result_observed'").fetchone()[0] == 1

def test_expiry_requires_review_then_late_result_can_complete(store):
    repo, _, clock = store
    repo.save("alice", "queue", 0, checkpoint(True))
    clock[0] += 31000
    assert repo.overview("alice")["runs"][0]["status"] == "needs_review"
    repo.save("alice", "queue", 1, checkpoint(True, {"status": "completed", "summary": "Listo", "reason": "completed"}))
    assert repo.overview("alice")["runs"][0]["status"] == "completed"

def test_terminal_overwrite_rolls_back_checkpoint(store):
    repo, _, _ = store
    repo.save("alice", "queue", 0, checkpoint(True, {"status": "completed", "summary": "Listo"}))
    with pytest.raises(WorkConflictError):
        repo.save("alice", "queue", 1, checkpoint(True, {"status": "failed", "summary": "Otro"}))
    assert repo.list_for_thread("alice", "thread")[0]["revision"] == 1

def test_result_requires_dispatch():
    with pytest.raises(ValidationError):
        checkpoint(False, {"status": "completed"})
