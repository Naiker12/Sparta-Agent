from utils.host_policy import cors_origins_for_mode


def test_packaged_electron_and_vite_origins_are_allowed_in_api_only_mode():
    origins = cors_origins_for_mode(api_only=True, secure=False)
    assert "null" in origins
    assert "http://127.0.0.1:5173" in origins
    assert "*" not in origins
    assert "https://untrusted.example" not in origins


def test_actual_loopback_vite_port_is_allowed(monkeypatch):
    monkeypatch.setenv("SPARTA_DESKTOP_ORIGIN", "http://localhost:5174/")
    assert "http://localhost:5174" in cors_origins_for_mode(api_only=True, secure=False)


def test_remote_renderer_origin_is_not_accepted(monkeypatch):
    monkeypatch.setenv("SPARTA_DESKTOP_ORIGIN", "https://untrusted.example:5174/")
    assert "https://untrusted.example:5174" not in cors_origins_for_mode(api_only=True, secure=False)
