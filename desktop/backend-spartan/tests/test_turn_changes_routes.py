import os

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from core.inference.turn_changes import TurnChanges
from routes.chat import router_workspaces as routes


@pytest.fixture
def fixture(tmp_path, monkeypatch):
    root = tmp_path / "project"
    root.mkdir()
    info = root.stat()
    binding = {"canonicalPath": str(root), "filesystemIdentity": f"{info.st_dev}:{info.st_ino}", "access": "write"}
    store = TurnChanges(tmp_path / "private" / "changes.db")
    monkeypatch.setattr(routes, "get_chat_thread", lambda thread: {"id": thread} if thread == "thread" else None)
    monkeypatch.setattr(routes, "get_thread_workspace_binding", lambda thread: binding)
    monkeypatch.setattr(routes, "_change_store", lambda: store)
    app = FastAPI()
    app.include_router(routes.router, prefix="/api/chat")
    app.dependency_overrides[routes.get_current_subject] = lambda: "owner"
    return TestClient(app), root, binding, app


def test_real_http_endpoints_capture_review_diff_and_undo(fixture):
    client, root, binding, app = fixture
    (root / "a.txt").write_text("old\n")
    ref = client.post("/api/chat/threads/thread/changes").json()
    assert ref["threadId"] == "thread"
    key = ref["id"]
    (root / "a.txt").write_text("new\n")
    summary = client.post(f"/api/chat/threads/thread/changes/{key}/finish")
    assert summary.status_code == 200
    assert summary.json()["files"][0]["additions"] == 1
    assert "+new" in client.get(f"/api/chat/threads/thread/changes/{key}", params={"path": "a.txt"}).json()["diff"]
    assert client.get(f"/api/chat/threads/thread/changes/{key}", params={"path": "../outside"}).status_code == 404
    assert client.post(f"/api/chat/threads/thread/changes/{key}/undo").json()["state"] == "undone"
    assert (root / "a.txt").read_text() == "old\n"


def test_http_conflict_leaves_every_file_untouched(fixture):
    client, root, binding, app = fixture
    (root / "a").write_text("before")
    key = client.post("/api/chat/threads/thread/changes").json()["id"]
    (root / "a").write_text("generated")
    client.post(f"/api/chat/threads/thread/changes/{key}/finish")
    (root / "a").write_text("later")
    result = client.post(f"/api/chat/threads/thread/changes/{key}/undo")
    assert result.status_code == 409
    assert result.json()["detail"] == "files_changed_since_turn"
    assert (root / "a").read_text() == "later"


def test_http_owner_binding_and_current_permissions_are_enforced(fixture):
    client, root, binding, app = fixture
    key = client.post("/api/chat/threads/thread/changes").json()["id"]
    (root / "a").write_text("new")
    client.post(f"/api/chat/threads/thread/changes/{key}/finish")
    app.dependency_overrides[routes.get_current_subject] = lambda: "other-owner"
    assert client.get(f"/api/chat/threads/thread/changes/{key}").status_code == 404
    app.dependency_overrides[routes.get_current_subject] = lambda: "owner"
    binding["access"] = "read"
    readonly = client.get(f"/api/chat/threads/thread/changes/{key}").json()
    assert not readonly["canUndo"]
    assert readonly["complete"] and readonly["undoReason"] == "workspace_not_writable"
    assert client.post(f"/api/chat/threads/thread/changes/{key}/undo").status_code == 403
    binding["filesystemIdentity"] = "replaced"
    assert client.get(f"/api/chat/threads/thread/changes/{key}").status_code == 409


def test_write_without_delete_can_review_but_cannot_restore(fixture):
    client, root, binding, app = fixture
    binding["access"] = "write_no_delete"
    key = client.post("/api/chat/threads/thread/changes").json()["id"]
    (root / "new").write_text("new")
    result = client.post(f"/api/chat/threads/thread/changes/{key}/finish")
    assert not result.json()["canUndo"]
    assert result.json()["complete"] and result.json()["undoReason"] == "workspace_not_writable"
    assert client.post(f"/api/chat/threads/thread/changes/{key}/undo").status_code == 403


def test_http_requires_authentication_and_known_thread(fixture):
    client, root, binding, app = fixture
    assert client.post("/api/chat/threads/unknown/changes").status_code == 404
    app.dependency_overrides.clear()
    assert client.post("/api/chat/threads/thread/changes").status_code in {401, 403}
