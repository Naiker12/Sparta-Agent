"""Queue checkpoint HTTP and storage integration with real SQLite and restart."""
import sqlite3
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from auth.authentication import get_current_subject
from core.prompt_queue_contracts import QueueCheckpoint
from routes.work_runs import queue_repository, router
from storage.prompt_queues_db import PromptQueueRepository
from storage.work_runs_db import WorkConflictError
from storage.work_runs_schema import ensure_work_runs_schema


def snapshot(prompt="First", dispatched=False, project=None):
    return {"version": 1, "threadId": "thread", "projectId": project, "items": [{
        "id": "item", "prompt": prompt, "dispatched": dispatched,
        "settings": {"params": {"checkpoint": "external:provider:model", "temperature": 0.6},
                     "permissionMode": "ask", "bypassPermissions": False,
                     "researchWebsitePolicy": {"allowedDomains": ["example.com"], "blockedDomains": []}},
    }]}


@pytest.fixture
def checkpoint_store(tmp_path):
    path = tmp_path / "checkpoint.db"
    def connect():
        conn = sqlite3.connect(path, timeout=5)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        return conn
    conn = connect()
    conn.executescript("CREATE TABLE chat_threads(id TEXT PRIMARY KEY,project_id TEXT);"
                       "INSERT INTO chat_threads VALUES('thread',NULL);"
                       "INSERT INTO chat_threads VALUES('other',NULL);")
    ensure_work_runs_schema(conn)
    conn.commit()
    conn.close()
    return PromptQueueRepository(connect), connect


def test_checkpoint_restart_and_exact_network_retry(checkpoint_store):
    repo, connect = checkpoint_store
    data = QueueCheckpoint.model_validate(snapshot())
    first = repo.save("alice", "queue", 0, data)
    assert first == repo.save("alice", "queue", 0, data)
    reopened = PromptQueueRepository(connect)
    assert reopened.list_for_thread("alice", "thread") == [first]
    assert reopened.list_for_thread("bob", "thread") == []
    edited = reopened.save("alice", "queue", 1, QueueCheckpoint.model_validate(snapshot("Edited")))
    assert edited["revision"] == 2
    with pytest.raises(WorkConflictError):
        reopened.save("alice", "queue", 1, data)


def test_competing_windows_do_not_overwrite_queue(checkpoint_store):
    repo, _ = checkpoint_store
    repo.save("alice", "queue", 0, QueueCheckpoint.model_validate(snapshot()))
    def save(prompt):
        try:
            return repo.save("alice", "queue", 1, QueueCheckpoint.model_validate(snapshot(prompt)))
        except WorkConflictError:
            return None
    with ThreadPoolExecutor(max_workers=2) as workers:
        outcomes = list(workers.map(save, ["A", "B"]))
    assert sum(result is not None for result in outcomes) == 1


def test_dispatched_marker_survives_restart_and_pending_order_is_preserved(checkpoint_store):
    repo, connect = checkpoint_store
    data = snapshot(dispatched=True)
    data["items"].extend([{**snapshot("Second")["items"][0], "id": "second"},
                          {**snapshot("Third")["items"][0], "id": "third"}])
    repo.save("alice", "queue", 0, QueueCheckpoint.model_validate(data))
    saved = PromptQueueRepository(connect).list_for_thread("alice", "thread")[0]
    assert saved["checkpoint"]["items"][0]["dispatched"] is True
    assert [item["prompt"] for item in saved["checkpoint"]["items"] if not item["dispatched"]] == ["Second", "Third"]


def test_cancel_tombstone_and_chat_delete(checkpoint_store):
    repo, connect = checkpoint_store
    repo.save("alice", "queue", 0, QueueCheckpoint.model_validate(snapshot()))
    empty = snapshot()
    empty["items"] = []
    repo.save("alice", "queue", 1, QueueCheckpoint.model_validate(empty))
    assert repo.list_for_thread("alice", "thread") == []
    with pytest.raises(WorkConflictError):
        repo.save("alice", "queue", 0, QueueCheckpoint.model_validate(snapshot()))
    conn = connect()
    conn.execute("DELETE FROM chat_threads WHERE id='thread'")
    conn.commit()
    assert conn.execute("SELECT COUNT(*) FROM work_prompt_queues").fetchone()[0] == 0
    conn.close()


def test_invalid_thread_and_project_are_rejected_atomically(checkpoint_store):
    repo, connect = checkpoint_store
    missing = snapshot()
    missing["threadId"] = "missing"
    with pytest.raises(KeyError):
        repo.save("alice", "queue", 0, QueueCheckpoint.model_validate(missing))
    with pytest.raises(WorkConflictError):
        repo.save("alice", "queue", 0, QueueCheckpoint.model_validate(snapshot(project="wrong")))
    repo.save("alice", "queue", 0, QueueCheckpoint.model_validate(snapshot()))
    moved = snapshot()
    moved["threadId"] = "other"
    with pytest.raises(WorkConflictError):
        repo.save("alice", "queue", 1, QueueCheckpoint.model_validate(moved))
    conn = connect()
    conn.execute("UPDATE chat_threads SET project_id='new' WHERE id='thread'")
    conn.commit()
    conn.close()
    with pytest.raises(WorkConflictError):
        repo.save("alice", "queue", 1, QueueCheckpoint.model_validate(snapshot(project="new")))
    empty = snapshot()
    empty["items"] = []
    repo.save("alice", "queue", 1, QueueCheckpoint.model_validate(empty))


@pytest.fixture
def http(checkpoint_store):
    repo, _ = checkpoint_store
    app = FastAPI()
    app.include_router(router, prefix="/api/work-runs")
    app.dependency_overrides[queue_repository] = lambda: repo
    return app, TestClient(app)


def test_checkpoint_http_requires_auth_and_scopes_owner(http):
    app, client = http
    url = "/api/work-runs/prompt-queues"
    assert client.get(url + "?threadId=thread").status_code == 401
    app.dependency_overrides[get_current_subject] = lambda: "alice"
    result = client.put(url + "/queue", json={"expectedRevision": 0, "checkpoint": snapshot()})
    assert result.status_code == 200
    assert client.get(url + "?threadId=thread").json()["queues"] == [result.json()]
    app.dependency_overrides[get_current_subject] = lambda: "bob"
    assert client.get(url + "?threadId=thread").json()["queues"] == []


@pytest.mark.parametrize("mutate", [
    lambda data: data.update({"temporary": True}),
    lambda data: data["items"][0]["settings"].update({"apiKey": "secret"}),
    lambda data: data["items"][0]["settings"]["params"].update({"token": "secret"}),
    lambda data: data["items"][0]["settings"]["params"].update({"maxTokens": {"credential": "secret"}}),
    lambda data: data["items"][0]["settings"].update({"permissionMode": "full"}),
    lambda data: data["items"][0]["settings"].update({"bypassPermissions": True}),
    lambda data: data["items"][0]["settings"].update({"permissionMode": []}),
    lambda data: data["items"][0]["settings"].update({"toolsEnabled": "true"}),
    lambda data: data["items"][0]["settings"].update({"ragSource": {"type": "kb", "kbId": {"token": "secret"}}}),
    lambda data: data["items"].append(data["items"][0]),
])
def test_invalid_checkpoints_never_persist(http, mutate):
    app, client = http
    app.dependency_overrides[get_current_subject] = lambda: "alice"
    data = snapshot()
    mutate(data)
    assert client.put("/api/work-runs/prompt-queues/queue", json={"expectedRevision": 0, "checkpoint": data}).status_code == 422
    assert client.get("/api/work-runs/prompt-queues?threadId=thread").json()["queues"] == []
