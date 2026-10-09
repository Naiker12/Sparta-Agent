import asyncio
import json
import socket
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from core.inference import voice_providers as providers
from core.channels import voice
from routes.channels.router import router, ui_credential
from routes.voice import router as shared_voice_router
from storage import credential_secrets


@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    monkeypatch.setenv('UNSLOTH_STUDIO_HOME', str(tmp_path))
    monkeypatch.setattr(credential_secrets, '_schema_ready', False)
    monkeypatch.setattr(credential_secrets, 'get_or_create_credential_encryption_key', lambda: b'x' * 32)


def configure(provider='groq', endpoint=''):
    return providers.save(provider, providers.CATALOG[provider]['model'], endpoint, 'test-secret', True)


def test_encrypted_configuration_never_returns_key_and_switch_retains_profiles():
    configure()
    safe = providers.public()
    assert safe['profiles']['groq']['has_key']
    assert 'test-secret' not in json.dumps(safe)
    with credential_secrets.get_connection() as db:
        row = db.execute('SELECT ciphertext FROM credential_secrets').fetchone()
        assert b'test-secret' not in bytes(row[0])
    providers.save('local', '', '', '', False)
    assert providers.read()['provider'] == 'local'
    assert providers.read()['profiles']['groq']['key'] == 'test-secret'
    providers.save('groq', 'whisper-large-v3', '', '', True)
    assert providers.read()['profiles']['groq']['model'] == 'whisper-large-v3'
    providers.remove('groq')
    assert providers.read() == {'provider': 'local', 'profiles': {}}


@pytest.mark.parametrize('url', ['http://example.com/v1/audio/transcriptions', 'https://localhost/v1/audio/transcriptions', 'https://127.0.0.1/v1/audio/transcriptions', 'https://169.254.169.254/v1/audio/transcriptions', 'https://user:pass@example.com/v1/audio/transcriptions', 'https://example.com:8443/v1/audio/transcriptions', 'https://example.com/v1/audio/transcriptions?key=secret', 'https://example.com/chat/completions', 'file:///audio/transcriptions'])
def test_invalid_endpoints_rejected_without_saving(url):
    with pytest.raises(ValueError):
        configure('compatible', url)
    assert providers.read()['provider'] == 'local'


def test_new_destination_requires_new_key_and_consent():
    configure('compatible', 'https://first.example.com/v1/audio/transcriptions')
    with pytest.raises(ValueError, match='voice_key_required'):
        providers.save('compatible', 'whisper-1', 'https://second.example.com/v1/audio/transcriptions', '', True)
    with pytest.raises(ValueError, match='voice_consent_required'):
        providers.save('groq', 'whisper-large-v3', '', 'key', False)


@pytest.mark.parametrize('provider', ['elevenlabs', 'groq', 'compatible'])
def test_real_multipart_adapter_contract(provider, monkeypatch):
    configure(provider, 'https://example.com/v1/audio/transcriptions')
    async def handler(request):
        body = await request.aread()
        assert b'name="file"' in body and b'audio.wav' in body
        assert b'bounded-wav' in body
        field = b'model_id' if provider == 'elevenlabs' else b'model'
        assert field in body
        assert request.headers.get('xi-api-key' if provider == 'elevenlabs' else 'Authorization') == ('test-secret' if provider == 'elevenlabs' else 'Bearer test-secret')
        return httpx.Response(200, json={'text': ' Hola, mundo. '})
    monkeypatch.setattr(providers, 'PublicVoiceTransport', lambda: httpx.MockTransport(handler))
    monkeypatch.setattr(providers, 'audio_wav', AsyncMock(return_value=b'bounded-wav'))
    check = []
    assert asyncio.run(providers.transcribe(b'audio', check=lambda: check.append(True))) == {'text': 'Hola, mundo.'}
    assert check == [True]


@pytest.mark.parametrize('code,notice', [(401, 'voice_auth_failed'), (403, 'voice_auth_failed'), (429, 'voice_rate_limited'), (302, 'audio_unavailable'), (500, 'audio_unavailable')])
def test_provider_errors_do_not_echo_remote_secrets(code, notice, monkeypatch):
    configure()
    monkeypatch.setattr(providers, 'audio_wav', AsyncMock(return_value=b'wav'))
    monkeypatch.setattr(providers, 'PublicVoiceTransport', lambda: httpx.MockTransport(lambda _: httpx.Response(code, text='private secret')))
    with pytest.raises(ValueError, match=notice) as caught:
        asyncio.run(providers.transcribe(b'audio'))
    assert 'private' not in str(caught.value)


def test_configuration_changed_while_decoding_stops_upload(monkeypatch):
    configure()
    async def decode(_):
        providers.remove('groq')
        return b'wav'
    monkeypatch.setattr(providers, 'audio_wav', decode)
    transport = AsyncMock()
    monkeypatch.setattr(providers, 'PublicVoiceTransport', transport)
    with pytest.raises(ValueError, match='voice_not_ready'):
        asyncio.run(providers.transcribe(b'audio'))
    transport.assert_not_called()


@pytest.mark.parametrize('ip', ['127.0.0.1', '10.0.0.1', '169.254.169.254', '::1'])
def test_dns_resolution_rejects_private_addresses_before_transport(ip, monkeypatch):
    monkeypatch.setattr(socket, 'getaddrinfo', lambda *_: [(socket.AF_INET, socket.SOCK_STREAM, 6, '', (ip, 443))])
    async def run():
        transport = providers.PublicVoiceTransport()
        inner = AsyncMock()
        original = transport.inner
        transport.inner = inner
        try:
            with pytest.raises(ValueError, match='invalid_voice_endpoint'):
                await transport.handle_async_request(httpx.Request('POST', 'https://example.com/v1/audio/transcriptions'))
            inner.handle_async_request.assert_not_called()
        finally:
            await original.aclose()
    asyncio.run(run())


def test_public_ip_is_pinned_with_original_tls_hostname(monkeypatch):
    monkeypatch.setattr(socket, 'getaddrinfo', lambda *_: [(socket.AF_INET, socket.SOCK_STREAM, 6, '', ('8.8.8.8', 443))])
    async def run():
        transport = providers.PublicVoiceTransport()
        original = transport.inner
        transport.inner = AsyncMock()
        try:
            request = httpx.Request('POST', 'https://example.com/v1/audio/transcriptions')
            await transport.handle_async_request(request)
            assert request.url.host == '8.8.8.8'
            assert request.headers['host'] == 'example.com'
            assert request.extensions['sni_hostname'] == 'example.com'
        finally:
            await original.aclose()
    asyncio.run(run())


def test_ui_routes_sanitize_validation_and_support_save_remove():
    app = FastAPI()
    app.include_router(router, prefix='/api/channels')
    app.dependency_overrides[ui_credential] = lambda: ('owner', None)
    with TestClient(app) as client:
        bad = client.put('/api/channels/voice/configuration', json={'provider': 'bad', 'api_key': 'private'})
        assert bad.status_code == 422 and 'private' not in bad.text
        good = client.put('/api/channels/voice/configuration', json={'provider': 'groq', 'model': 'whisper-large-v3', 'api_key': 'private', 'consent': True})
        assert good.status_code == 200 and 'private' not in good.text
        assert voice.active_status()['engine'] == 'remote'
        assert client.get('/api/channels/voice/configuration').json()['profiles']['groq']['has_key']
        assert client.delete('/api/channels/voice/configuration/groq').status_code == 200


def test_bounded_audio_decode_makes_valid_wave(monkeypatch):
    import numpy as np
    from core.inference import stt_sidecar
    observed = []
    def decode(raw, owner, *, max_seconds):
        observed.append(max_seconds)
        return np.zeros(1600, dtype=np.float32)
    monkeypatch.setattr(stt_sidecar, '_decode_audio_bounded', decode)
    encoded = asyncio.run(providers.audio_wav(b'raw'))
    assert encoded[:4] == b'RIFF' and b'WAVE' in encoded[:16]
    assert observed == [300]


def test_telegram_uses_saved_remote_provider_without_loading_whisper(monkeypatch):
    from storage.channels import repository as repo
    configure()
    account = repo.create_account('owner', '1', {'name': 'Test', 'allowed_user_ids': ['123'], 'voice_enabled': True})
    repo.set_enabled(account['id'], 'owner', True)
    message = {'user_id': '123', 'audio': {'file_id': 'audio_id', 'duration': 1, 'file_size': 10}}
    transport = AsyncMock()
    transport.download_audio.return_value = b'audio'
    monkeypatch.setattr(voice, 'status', lambda: pytest.fail('Remote transcription must not load local Whisper'))
    remote = AsyncMock(return_value={'text': 'Hola'})
    monkeypatch.setattr(providers, 'transcribe', remote)
    assert asyncio.run(voice.transcribe(transport, account, message)) == 'Hola'
    remote.assert_awaited_once()
    assert remote.call_args.args[1]['provider'] == 'groq'


def test_test_audio_route_returns_only_text_and_sanitizes_failures(monkeypatch):
    configure()
    app = FastAPI()
    app.include_router(router, prefix='/api/channels')
    app.dependency_overrides[ui_credential] = lambda: ('owner', None)
    with TestClient(app) as client:
        monkeypatch.setattr(providers, 'transcribe', AsyncMock(return_value={'text': 'Hola'}))
        response = client.post('/api/channels/voice/test', files={'file': ('audio.wav', b'audio', 'audio/wav')})
        assert response.status_code == 200 and response.json() == {'text': 'Hola'}
        monkeypatch.setattr(providers, 'transcribe', AsyncMock(side_effect=ValueError('private secret')))
        response = client.post('/api/channels/voice/test', files={'file': ('audio.wav', b'audio', 'audio/wav')})
        assert response.status_code == 502 and 'private' not in response.text


def test_canonical_voice_routes_share_configuration_with_channel_aliases():
    app = FastAPI()
    app.include_router(router, prefix='/api/channels')
    app.include_router(shared_voice_router, prefix='/api/voice')
    app.dependency_overrides[ui_credential] = lambda: ('owner', None)
    with TestClient(app) as client:
        result = client.put('/api/voice/configuration', json={'provider': 'groq', 'model': 'whisper-large-v3', 'api_key': 'secret', 'consent': True})
        assert result.status_code == 200
        assert client.get('/api/voice/configuration').json() == client.get('/api/channels/voice/configuration').json()
        assert 'secret' not in client.get('/api/voice/configuration').text


@pytest.mark.parametrize('code', ['voice_auth_failed', 'voice_permission_missing', 'voice_rate_limited', 'voice_model_failed', 'audio_empty', 'voice_not_ready', 'audio_unavailable'])
def test_test_route_returns_only_known_error_codes(code, monkeypatch):
    configure()
    app = FastAPI()
    app.include_router(shared_voice_router, prefix='/api/voice')
    app.dependency_overrides[ui_credential] = lambda: ('owner', None)
    monkeypatch.setattr(providers, 'transcribe', AsyncMock(side_effect=ValueError(code)))
    with TestClient(app) as client:
        result = client.post('/api/voice/test', files={'file': ('test.wav', b'audio', 'audio/wav')})
        assert result.status_code == 502 and result.json() == {'detail': code}


def test_voice_settings_reject_remote_api_key_access(monkeypatch):
    from routes.voice.router import get_current_credential, authenticated_via_api_key
    app = FastAPI()
    app.include_router(shared_voice_router, prefix='/api/voice')
    app.dependency_overrides[get_current_credential] = lambda: ('owner', None)
    app.dependency_overrides[authenticated_via_api_key] = lambda: True
    with TestClient(app) as client:
        assert client.get('/api/voice/configuration').status_code == 403
        assert client.put('/api/voice/configuration', json={'provider': 'local'}).status_code == 403


@pytest.mark.parametrize('failure', [httpx.ConnectError('private endpoint secret'), socket.gaierror('private hostname')])
def test_voice_test_connection_failures_are_actionable_and_redacted(monkeypatch, failure):
    configure()
    app = FastAPI()
    app.include_router(shared_voice_router, prefix='/api/voice')
    app.dependency_overrides[ui_credential] = lambda: ('owner', None)
    monkeypatch.setattr(providers, 'transcribe', AsyncMock(side_effect=failure))
    with TestClient(app) as client:
        result = client.post('/api/voice/test', files={'file': ('test.wav', b'audio', 'audio/wav')})
        assert result.status_code == 502
        assert result.json() == {'detail': 'voice_network_failed'}
