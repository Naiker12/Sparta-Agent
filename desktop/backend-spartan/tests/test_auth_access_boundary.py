"""CPU-only HTTP regressions for the real authentication dependency and routes.

Run from backend-spartan with pytest --noconftest tests/test_auth_access_boundary.py.
The global inference fixtures are intentionally not needed by these HTTP tests.
"""

import importlib.util
import secrets
from datetime import timedelta
from pathlib import Path

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from auth import storage
from auth.authentication import create_access_token, get_current_subject


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "DB_PATH", tmp_path / "auth.db")
    monkeypatch.setattr(storage, "_BOOTSTRAP_PW_PATH", tmp_path / ".bootstrap_password")
    monkeypatch.setattr(storage, "_bootstrap_password", None)
    monkeypatch.setattr(storage, "_api_key_pbkdf2_salt_cache", None)
    storage.create_initial_user(storage.DEFAULT_ADMIN_USERNAME, "valid-password-123", secrets.token_urlsafe(64), must_change_password = False)
    spec = importlib.util.spec_from_file_location("_boundary_auth", Path(__file__).parents[1] / "routes" / "auth.py")
    routes = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(routes)
    app = FastAPI()
    app.include_router(routes.router, prefix = "/api/auth")

    @app.get("/protected")
    def protected(subject: str = Depends(get_current_subject)):
        return {"subject": subject}

    with TestClient(app) as http:
        yield http


@pytest.mark.parametrize("authorization", [None, "Bearer", "Basic abc", "Bearer invalid"])
def test_protected_rejects_missing_or_invalid_token(client, authorization):
    response = client.get("/protected", headers = {"Authorization": authorization} if authorization else {})
    assert response.status_code == 401


def test_expired_and_forged_tokens_rejected(client):
    for token in (
        create_access_token(storage.DEFAULT_ADMIN_USERNAME, expires_delta = timedelta(seconds = -1)),
        create_access_token(storage.DEFAULT_ADMIN_USERNAME, secret = secrets.token_urlsafe(64)),
    ):
        assert client.get("/protected", headers = {"Authorization": f"Bearer {token}"}).status_code == 401


@pytest.mark.parametrize("username,password", [("unsloth", "incorrect"), ("missing", "valid-password-123"), ("unsloth", "")])
def test_password_login_rejects_invalid_credentials(client, username, password):
    assert client.post("/api/auth/login", json = {"username": username, "password": password}).status_code == 401


def test_password_login_and_refresh_rotation(client):
    login = client.post("/api/auth/login", json = {"username": storage.DEFAULT_ADMIN_USERNAME, "password": "valid-password-123"})
    assert login.status_code == 200
    tokens = login.json()
    response = client.get("/protected", headers = {"Authorization": f"Bearer {tokens['access_token']}"})
    assert response.json() == {"subject": storage.DEFAULT_ADMIN_USERNAME}
    refreshed = client.post("/api/auth/refresh", json = {"refresh_token": tokens["refresh_token"]})
    assert refreshed.status_code == 200
    assert refreshed.json()["refresh_token"] != tokens["refresh_token"]
    assert client.post("/api/auth/refresh", json = {"refresh_token": tokens["refresh_token"]}).status_code == 401
    assert client.post("/api/auth/refresh", json = {"refresh_token": "invented"}).status_code == 401


def test_desktop_login_and_refresh_preserve_access(client):
    secret = storage.create_desktop_secret()
    assert client.post("/api/auth/desktop-login", json = {"secret": "invalid"}).status_code == 401
    tokens = client.post("/api/auth/desktop-login", json = {"secret": secret}).json()
    refreshed = client.post("/api/auth/refresh", json = {"refresh_token": tokens["refresh_token"]})
    assert refreshed.status_code == 200
    assert client.get("/protected", headers = {"Authorization": f"Bearer {refreshed.json()['access_token']}"}).status_code == 200


def test_login_rate_limit(client):
    for _ in range(5):
        assert client.post("/api/auth/login", json = {"username": "unsloth", "password": "wrong"}).status_code == 401
    assert client.post("/api/auth/login", json = {"username": "unsloth", "password": "wrong"}).status_code == 429


def test_managed_bootstrap_emits_a_valid_secret_before_running_backend(client, monkeypatch, capsys):
    import desktop_bootstrap
    import sys

    called = []
    monkeypatch.setattr(sys, "argv", ["desktop_bootstrap.py", "--api-only", "--port", "0"])
    monkeypatch.setattr(desktop_bootstrap.runpy, "run_path", lambda entrypoint, **kwargs: called.append((entrypoint, kwargs, list(sys.argv))))
    desktop_bootstrap.main()
    lines = capsys.readouterr().out.splitlines()
    secrets = [line.split("=", 1)[1] for line in lines if line.startswith("SPARTA_DESKTOP_SECRET=")]
    assert len(secrets) == 1
    assert storage.validate_desktop_secret(secrets[0]) == storage.DEFAULT_ADMIN_USERNAME
    assert Path(called[0][0]).name == "run.py"
    assert called[0][1] == {"run_name": "__main__"}
    assert called[0][2][1:] == ["--api-only", "--port", "0"]
