import os

os.environ.setdefault("UNSLOTH_API_ONLY", "1")

from fastapi.testclient import TestClient
from fastapi.responses import StreamingResponse
from main import app
from auth.authentication import get_current_subject
from routes import inference
from routes.chat import router_messages
from routes.inference_pkg import router_external_proxy


def test_remote_completion_does_not_import_retired_local_runtime(monkeypatch):
    async def remote_reply(payload, request, subject):
        return StreamingResponse(iter(['data: {"choices":[]}\n\ndata: [DONE]\n\n']), media_type="text/event-stream")

    monkeypatch.setattr(inference, "_proxy_to_external_provider", remote_reply)
    app.dependency_overrides[get_current_subject] = lambda: "console-test"
    try:
        response = TestClient(app).post("/v1/chat/completions", headers={"Origin": "http://localhost:5173"}, json={
            "model": "openrouter/free", "provider_type": "openrouter", "stream": True,
            "messages": [{"role": "user", "content": "hola"}],
        })
        assert response.status_code == 200, response.text
        assert "[DONE]" in response.text
        assert response.headers["access-control-allow-origin"] == "http://localhost:5173"
    finally:
        app.dependency_overrides.pop(get_current_subject, None)


def test_unexpected_completion_error_keeps_cors_and_hides_internal_details(monkeypatch):
    async def broken_reply(*args):
        raise RuntimeError("private internal traceback")

    monkeypatch.setattr(inference, "_proxy_to_external_provider", broken_reply)
    app.dependency_overrides[get_current_subject] = lambda: "console-test"
    try:
        client = TestClient(app, raise_server_exceptions=False)
        for origin, allowed in [("http://localhost:5173", True), ("https://untrusted.example", False)]:
            response = client.post("/v1/chat/completions", headers={"Origin": origin}, json={
                "model": "openrouter/free", "provider_type": "openrouter",
                "messages": [{"role": "user", "content": "hola"}],
            })
            assert response.status_code == 500
            assert "private internal traceback" not in response.text
            assert ("access-control-allow-origin" in response.headers) == allowed
    finally:
        app.dependency_overrides.pop(get_current_subject, None)


def test_optional_message_lookup_does_not_treat_new_message_as_error(monkeypatch):
    monkeypatch.setattr(router_messages, "get_chat_thread", lambda _: {"id": "stored"})
    monkeypatch.setattr(router_messages, "get_chat_message", lambda *_: None)
    assert router_messages.get_thread_message("stored", "new", missing_ok=True, current_subject="test") is None


def test_actual_remote_proxy_streams_without_local_engine(monkeypatch):
    class ProviderStub:
        def __init__(self, **kwargs):
            pass

        async def stream_chat_completion(self, **kwargs):
            yield 'data: {"choices":[{"delta":{"content":"hola"}}]}\n\n'
            yield 'data: [DONE]\n\n'

        async def close(self):
            pass

    monkeypatch.setattr(router_external_proxy, "resolve_provider_api_key_or_400", lambda *args, **kwargs: "test-key")
    monkeypatch.setattr(router_external_proxy, "ExternalProviderClient", ProviderStub)
    app.dependency_overrides[get_current_subject] = lambda: "console-test"
    try:
        response = TestClient(app).post("/v1/chat/completions", headers={"Origin":"http://localhost:5173"}, json={
            "model":"openrouter/free", "provider_type":"openrouter", "stream":True,
            "enable_tools":True, "enabled_tools":[], "mcp_enabled":False,
            "messages":[{"role":"user", "content":"hola"}],
        })
        assert response.status_code == 200, response.text
        assert '"content":"hola"' in response.text, response.text
        assert '"error"' not in response.text, response.text
    finally:
        app.dependency_overrides.pop(get_current_subject, None)
