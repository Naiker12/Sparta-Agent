"""Behavioral tests using real SQLite connections and competing workers."""
from concurrent.futures import ThreadPoolExecutor
import sqlite3

import pytest

from storage.work_runs_db import WorkConflictError, WorkRunRepository
from storage.work_runs_schema import ensure_work_runs_schema


@pytest.fixture
def work(tmp_path):
    path = tmp_path / "work.db"
    now = [10_000]

    def connect():
        conn = sqlite3.connect(path, timeout=5)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        return conn

    conn = connect()
    conn.execute("CREATE TABLE chat_threads(id TEXT PRIMARY KEY)")
    ensure_work_runs_schema(conn)
    conn.commit()
    conn.close()
    return WorkRunRepository(connect, lambda: now[0]), connect, now


def create(repo, key="first", owner="alice"):
    return repo.create(owner, key, {"prompt": "Review", "model": "example", "temporary": False})


def test_restart_keeps_request_and_events(work):
    repo, connect, now = work
    original = create(repo)
    restarted = WorkRunRepository(connect, lambda: now[0])
    assert restarted.get("alice", original["id"]) == original
    assert [event["event_type"] for event in restarted.events("alice", original["id"])] == ["created"]


def test_idempotency_and_changed_content(work):
    repo, _, _ = work
    assert create(repo) == create(repo)
    with pytest.raises(WorkConflictError):
        repo.create("alice", "first", {"prompt": "Different"})
    assert len(repo.list("alice")) == 1
    assert create(repo, owner="bob")["id"] != create(repo)["id"]


def test_concurrent_claim_has_one_owner(work):
    repo, _, _ = work
    create(repo)
    with ThreadPoolExecutor(max_workers=8) as workers:
        results = list(workers.map(lambda n: repo.claim("alice", f"worker-{n}"), range(8)))
    assert len([result for result in results if result is not None]) == 1


def test_concurrent_creation_deduplicates(work):
    repo, _, _ = work
    with ThreadPoolExecutor(max_workers=8) as workers:
        results = list(workers.map(lambda _: create(repo), range(8)))
    assert len({row["id"] for row in results}) == 1


def test_owner_cannot_read_events_or_update_other_work(work):
    repo, _, _ = work
    row = create(repo)
    assert repo.list("bob") == []
    assert repo.claim("bob", "worker") is None
    for operation in (
        lambda: repo.get("bob", row["id"]),
        lambda: repo.events("bob", row["id"]),
        lambda: repo.transition("bob", row["id"], row["revision"], "cancel"),
    ):
        with pytest.raises(KeyError):
            operation()


def test_pause_resume_cancel_and_stale_revision(work):
    repo, _, _ = work
    row = create(repo)
    paused = repo.transition("alice", row["id"], row["revision"], "pause")
    assert repo.claim("alice", "worker") is None
    with pytest.raises(WorkConflictError):
        repo.transition("alice", row["id"], row["revision"], "resume")
    resumed = repo.transition("alice", row["id"], paused["revision"], "resume")
    cancelled = repo.transition("alice", row["id"], resumed["revision"], "cancel")
    assert cancelled["status"] == "cancelled"
    assert repo.claim("alice", "worker") is None
    assert [e["revision"] for e in repo.events("alice", row["id"])] == [1, 2, 3, 4]


def test_expired_work_requires_review_and_rejects_late_result(work):
    repo, _, now = work
    row = create(repo)
    claimed = repo.claim("alice", "worker", 1_000)
    now[0] += 1_000
    with pytest.raises(WorkConflictError):
        repo.finish("alice", row["id"], "worker", claimed["attempt"], {"text": "late"})
    assert repo.recover_expired() == 1
    assert repo.recover_expired() == 0
    assert repo.get("alice", row["id"])["status"] == "needs_review"
    assert repo.claim("alice", "worker") is None


@pytest.mark.parametrize("failed,status", [(False, "completed"), (True, "failed")])
def test_finish_requires_current_worker_and_preserves_result(work, failed, status):
    repo, _, _ = work
    row = create(repo)
    claimed = repo.claim("alice", "worker")
    with pytest.raises(WorkConflictError):
        repo.finish("alice", row["id"], "other", claimed["attempt"], {})
    with pytest.raises(WorkConflictError):
        repo.finish("alice", row["id"], "worker", claimed["attempt"] + 1, {})
    done = repo.finish("alice", row["id"], "worker", claimed["attempt"], {"text": "result"}, failed=failed)
    assert done["status"] == status
    assert done["result"] == {"text": "result"}
    with pytest.raises(WorkConflictError):
        repo.finish("alice", row["id"], "worker", claimed["attempt"], {})


def test_running_cancel_is_not_reported_as_success(work):
    repo, _, _ = work
    create(repo)
    claimed = repo.claim("alice", "worker")
    with pytest.raises(WorkConflictError):
        repo.transition("alice", claimed["id"], claimed["revision"], "cancel")
    assert repo.get("alice", claimed["id"])["status"] == "running"


@pytest.mark.parametrize("payload", [{"temporary": True}, {"value": float("nan")}, {"prompt": "x" * 128_001}])
def test_invalid_requests_do_not_persist(work, payload):
    repo, _, _ = work
    with pytest.raises(ValueError):
        repo.create("alice", "invalid", payload)
    assert repo.list("alice") == []


def test_schema_is_additive_and_repeatable(work):
    _, connect, _ = work
    conn = connect()
    conn.execute("CREATE TABLE legacy(id TEXT PRIMARY KEY, content TEXT)")
    conn.execute("INSERT INTO legacy VALUES('old','preserved')")
    ensure_work_runs_schema(conn)
    ensure_work_runs_schema(conn)
    conn.commit()
    assert conn.execute("SELECT content FROM legacy").fetchone()[0] == "preserved"
    conn.close()


def test_transaction_failure_rolls_back_without_partial_events(work, monkeypatch):
    repo, _, _ = work
    def fail(*args):
        raise RuntimeError("simulated failure")
    monkeypatch.setattr(repo, "_event", fail)
    with pytest.raises(RuntimeError):
        create(repo)
    assert repo.list("alice") == []


def test_heartbeat_extends_only_current_live_attempt(work):
    repo, _, now = work
    create(repo)
    row = repo.claim("alice", "worker", 1_000)
    now[0] += 500
    repo.heartbeat("alice", row["id"], "worker", row["attempt"], 2_000)
    now[0] += 600
    assert repo.recover_expired() == 0
    with pytest.raises(WorkConflictError):
        repo.heartbeat("alice", row["id"], "other", row["attempt"])
    now[0] += 1_400
    with pytest.raises(WorkConflictError):
        repo.heartbeat("alice", row["id"], "worker", row["attempt"])
    assert repo.recover_expired() == 1


def test_full_studio_schema_includes_work_without_losing_existing_data(tmp_path):
    from storage.studio.schema import _ensure_schema
    conn = sqlite3.connect(tmp_path / "studio.db")
    conn.row_factory = sqlite3.Row
    _ensure_schema(conn)
    conn.execute("INSERT INTO memory_nodes "
                 "(id,type,label,content,confidence,created_at,updated_at) "
                 "VALUES('memory','fact','Keep','Existing',1,1,1)")
    conn.commit()
    _ensure_schema(conn)
    assert conn.execute("SELECT content FROM memory_nodes WHERE id='memory'").fetchone()[0] == "Existing"
    assert conn.execute("SELECT COUNT(*) FROM work_runs").fetchone()[0] == 0
    assert conn.execute("PRAGMA foreign_key_check").fetchall() == []
    conn.close()


def test_fifo_when_requests_share_same_timestamp(work):
    repo, _, _ = work
    rows = [create(repo, key=f"item-{i}") for i in range(12)]
    assert [row["id"] for row in repo.list("alice")] == [row["id"] for row in rows]
    claims = [repo.claim("alice", "worker") for _ in rows]
    assert [row["id"] for row in claims] == [row["id"] for row in rows]


def test_failed_claim_event_rolls_back_ownership(work, monkeypatch):
    repo, _, _ = work
    row = create(repo)
    def fail(*args):
        raise RuntimeError("event storage failed")
    monkeypatch.setattr(repo, "_event", fail)
    with pytest.raises(RuntimeError):
        repo.claim("alice", "worker")
    unchanged = repo.get("alice", row["id"])
    assert unchanged["status"] == "queued"
    assert unchanged["attempt"] == 0
    assert unchanged["worker_id"] is None
