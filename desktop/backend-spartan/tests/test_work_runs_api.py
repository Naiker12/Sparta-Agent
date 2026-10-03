"""HTTP contract checks with real auth dependency and isolated SQLite storage."""
import sqlite3

from fastapi import FastAPI
from fastapi.testclient import TestClient
import pytest

from auth.authentication import get_current_subject
from routes.work_runs import repository, router
from storage.work_runs_db import WorkRunRepository
from storage.work_runs_schema import ensure_work_runs_schema


@pytest.fixture
def api(tmp_path):
    path = tmp_path / "api.db"
    def connect():
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        return conn
    conn = connect()
    ensure_work_runs_schema(conn)
    conn.commit()
    conn.close()
    app = FastAPI()
    app.include_router(router, prefix="/api/work-runs")
    app.dependency_overrides[repository] = lambda: WorkRunRepository(connect)
    return app, TestClient(app)


def payload():
    return {"requestKey": "key", "request": {"prompt": "Review", "selection":
            {"providerId": "saved-provider", "modelId": "example"}}}


def test_unauthenticated_requests_rejected(api):
    _, client = api
    assert client.get("/api/work-runs").status_code == 401
    assert client.post("/api/work-runs", json=payload()).status_code == 401


def test_http_create_dedupe_events_and_revision(api):
    app, client = api
    app.dependency_overrides[get_current_subject] = lambda: "alice"
    first = client.post("/api/work-runs", json=payload())
    assert first.status_code == 200
    row = first.json()
    assert client.post("/api/work-runs", json=payload()).json()["id"] == row["id"]
    changed = payload()
    changed["request"]["prompt"] = "Changed"
    assert client.post("/api/work-runs", json=changed).status_code == 409
    url = f"/api/work-runs/{row['id']}"
    paused = client.post(url + "/actions", json={"action": "pause", "expectedRevision": row["revision"]})
    assert paused.json()["status"] == "paused"
    assert client.post(url + "/actions", json={"action": "resume", "expectedRevision": row["revision"]}).status_code == 409
    assert len(client.get(url + "/events?after=1").json()["events"]) == 1
    app.dependency_overrides[get_current_subject] = lambda: "bob"
    assert client.get(url).status_code == 404
    assert client.get(url + "/events").status_code == 404
    assert client.get("/api/work-runs").json() == {"runs": []}


@pytest.mark.parametrize("update", [
    {"apiKey": "secret"}, {"temporary": True}, {"threadId": "foreign"},
    {"permissionMode": "unknown"}, {"prompt": ""}, {"version": 2},
])
def test_invalid_or_unsupported_request_fields_rejected(api, update):
    app, client = api
    app.dependency_overrides[get_current_subject] = lambda: "alice"
    body = payload()
    body["request"].update(update)
    assert client.post("/api/work-runs", json=body).status_code == 422
    assert client.get("/api/work-runs").json()["runs"] == []


def test_unknown_credentials_inside_selection_rejected(api):
    app, client = api
    app.dependency_overrides[get_current_subject] = lambda: "alice"
    body = payload()
    body["request"]["selection"]["token"] = "secret"
    assert client.post("/api/work-runs", json=body).status_code == 422


@pytest.mark.parametrize("path", ["?limit=0", "?limit=501", "/missing/events?after=-1"])
def test_pagination_limits(api, path):
    app, client = api
    app.dependency_overrides[get_current_subject] = lambda: "alice"
    assert client.get("/api/work-runs" + path).status_code == 422


def test_worker_controls_are_not_public_endpoints(api):
    app, client = api
    app.dependency_overrides[get_current_subject] = lambda: "alice"
    for action in ("claim", "finish", "heartbeat", "recover"):
        assert client.post(f"/api/work-runs/run/{action}", json={}).status_code == 404
