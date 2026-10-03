"""OpenRouter connection checks must validate credentials, not the public catalog."""
import asyncio
import json

import httpx
import pytest

from core.inference import external_provider as ep


def check(monkeypatch, status=200, payload=None, error=None, key="  test-key  "):
    requests = []

    def respond(request):
        requests.append(request)
        if error:
            raise error("network failure", request=request)
        return httpx.Response(status, json=payload if payload is not None else {"data": {"limit_remaining": 0}})

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as http:
            monkeypatch.setattr(ep, "_http_client", http)
            client = ep.ExternalProviderClient("openrouter", "https://openrouter.ai/api/v1", key)
            await client.verify_api_key()

    asyncio.run(run())
    return requests


def test_authenticates_key_without_paid_generation_or_catalog(monkeypatch):
    requests = check(monkeypatch)
    assert len(requests) == 1
    assert requests[0].method == "GET"
    assert str(requests[0].url) == "https://openrouter.ai/api/v1/key"
    assert requests[0].headers["Authorization"] == "Bearer test-key"


@pytest.mark.parametrize("status", [401, 403])
def test_rejected_key_has_actionable_error(monkeypatch, status):
    with pytest.raises(ValueError, match="rechazó la clave API"):
        check(monkeypatch, status=status)


def test_missing_key_does_not_pass_public_catalog_check(monkeypatch):
    with pytest.raises(ValueError, match="Falta la clave API"):
        check(monkeypatch, key=" ")


def test_rate_limit_has_actionable_error(monkeypatch):
    with pytest.raises(ValueError, match="limitó temporalmente"):
        check(monkeypatch, status=429)


@pytest.mark.parametrize("error, message", [(httpx.ReadTimeout, "tardó demasiado"), (httpx.ConnectError, "No se pudo conectar")])
def test_network_failures_explain_retry(monkeypatch, error, message):
    with pytest.raises(ValueError, match=message):
        check(monkeypatch, error=error)


def test_invalid_auth_response_is_not_reported_as_connected(monkeypatch):
    with pytest.raises(ValueError, match="respuesta de autenticación inesperada"):
        check(monkeypatch, payload={"models": []})


@pytest.mark.parametrize("effort", ["minimal", "low", "medium", "high", "xhigh", "max"])
def test_selected_effort_reaches_openrouter(monkeypatch, effort):
    bodies = []

    def respond(request):
        bodies.append(json.loads(request.content))
        return httpx.Response(200, text="data: [DONE]\n\n", headers={"Content-Type": "text/event-stream"})

    async def run():
        async with httpx.AsyncClient(transport=httpx.MockTransport(respond)) as http:
            monkeypatch.setattr(ep, "_http_client", http)
            client = ep.ExternalProviderClient("openrouter", "https://openrouter.ai/api/v1", "test-key")
            async for _ in client.stream_chat_completion(messages=[{"role": "user", "content": "ping"}], model="test/model", enable_thinking=True, reasoning_effort=effort):
                pass

    asyncio.run(run())
    assert bodies[0]["reasoning"] == {"effort": effort}
