import asyncio
import io
import json
import sys
import threading
import wave
from unittest.mock import AsyncMock

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from core.channels import runtime, voice
from core.channels.policy import normalize_private_message
from core.channels.telegram import Telegram, TelegramError
from core.inference import stt_service
from core.inference.stt_sidecar import SttAudioTooLongError, SttModelBusyError
from routes.channels.router import router, ui_credential
from storage.channels import history, repository as repo


@pytest.fixture(autouse=True)
def isolated_storage(tmp_path, monkeypatch):
    monkeypatch.setenv('UNSLOTH_STUDIO_HOME', str(tmp_path))
    for name, module in tuple(sys.modules.items()):
        if name.startswith('storage.') and hasattr(module, '_schema_ready'):
            monkeypatch.setattr(module, '_schema_ready', False)
    runtime.states.clear()
    runtime.workers.clear()


def account(enabled=True):
    saved = repo.create_account('owner', '1', {'name': 'Test', 'allowed_user_ids': ['123'], 'locale': 'es', 'provider_id': 'p', 'model': 'm', 'provider_name': 'Provider', 'voice_enabled': enabled})
    repo.set_enabled(saved['id'], 'owner', True)
    return repo.get_account(saved['id'])


def update(user=123, text=None, update_id=1):
    message = {'from': {'id': user, 'is_bot': False}, 'chat': {'id': user, 'type': 'private'}}
    if text is None:
        message['voice'] = {'file_id': 'telegram_file', 'duration': 12, 'file_size': 32, 'file_name': '../../private', 'url': 'http://localhost/secret'}
    else:
        message['text'] = text
    return {'update_id': update_id, 'message': message}


def message():
    return normalize_private_message(update(), ['123'])


def prepared():
    return {'ready': True, 'model': 'base', 'engine': 'gguf', 'reason': None, 'downloading': False}


def test_audio_metadata_does_not_include_paths_or_urls_and_denied_users_are_rejected():
    assert message()['audio'] == {'file_id': 'telegram_file', 'duration': 12, 'file_size': 32}
    assert normalize_private_message(update(user=456), ['123']) is None
    malformed = update()
    malformed['message']['voice']['file_id'] = {'path': '../../secret'}
    assert normalize_private_message(malformed, ['123'])['audio']['file_id'] == ''


@pytest.mark.parametrize('key,value,code', [('duration', 301, 'audio_too_long'), ('duration', True, 'audio_invalid'), ('duration', -1, 'audio_invalid'), ('file_size', 20 * 1024 * 1024 + 1, 'audio_too_large'), ('file_size', True, 'audio_too_large'), ('file_id', '../../file', 'audio_invalid')])
def test_voice_metadata_limits_before_download(key, value, code):
    candidate = message()
    candidate['audio'][key] = value
    with pytest.raises(voice.VoiceError, match=code):
        voice.validate(candidate)


@pytest.mark.parametrize('path', ['../secret', '/voice/a.ogg', 'voice/../a.ogg', 'https://example.com/a.ogg', 'voice/%2e%2e/a.ogg'])
def test_audio_download_path_cannot_escape_telegram(path):
    async def scenario():
        bot = Telegram('12345:secret')
        bot.call = AsyncMock(return_value={'file_path': path, 'file_size': 3})
        try:
            with pytest.raises(TelegramError, match='audio_invalid'):
                await bot.download_audio('file_id')
        finally:
            await bot.close()
    asyncio.run(scenario())


@pytest.mark.parametrize('case', ['ok', 'oversized_metadata', 'oversized_body', 'redirect', 'empty'])
def test_audio_download_is_bounded_without_redirects_or_disk(case):
    async def scenario():
        bot = Telegram('12345:secret')
        await bot._client.aclose()
        requests = []
        def handle(request):
            requests.append(request)
            if request.method == 'POST':
                assert json.loads(request.content) == {'file_id': 'file_id'}
                return httpx.Response(200, json={'ok': True, 'result': {'file_path': 'voice/file.oga', 'file_size': 10 if case == 'oversized_metadata' else 3}})
            assert str(request.url) == 'https://api.telegram.org/file/bot12345:secret/voice/file.oga'
            if case == 'redirect':
                return httpx.Response(302, headers={'location': 'http://localhost/private'})
            return httpx.Response(200, content=b'' if case == 'empty' else b'123456' if case == 'oversized_body' else b'123')
        bot._client = httpx.AsyncClient(transport=httpx.MockTransport(handle), follow_redirects=False)
        try:
            if case == 'ok':
                assert await bot.download_audio('file_id', max_bytes=4) == b'123'
            else:
                with pytest.raises(TelegramError) as caught:
                    await bot.download_audio('file_id', max_bytes=4)
                assert 'secret' not in str(caught.value)
            assert len(requests) == (1 if case == 'oversized_metadata' else 2)
        finally:
            await bot.close()
    asyncio.run(scenario())


def test_decoded_duration_limit_is_real_and_does_not_change_default():
    pytest.importorskip('av')
    from core.inference.stt_sidecar import _decode_audio_bounded
    buffer = io.BytesIO()
    with wave.open(buffer, 'wb') as audio:
        audio.setnchannels(1)
        audio.setsampwidth(2)
        audio.setframerate(16000)
        audio.writeframes(b'\0\0' * 16000 * 3)
    with pytest.raises(SttAudioTooLongError):
        _decode_audio_bounded(buffer.getvalue(), max_seconds=2)
    assert len(_decode_audio_bounded(buffer.getvalue())) == 48000


def test_shared_service_loads_through_registry_and_passes_channel_limit():
    calls = []
    class Sidecar:
        def transcribe(self, raw, model, language, fast, owner, **kwargs):
            assert not owner.is_set()
            calls.append(('transcribe', raw, model, language, fast, kwargs))
            return {'text': 'hola'}
    def load(model, engine, owner):
        assert not owner.is_set()
        calls.append(('load', model, engine))
    result = asyncio.run(stt_service.transcribe_local(b'audio', 'base', None, True, 'gguf', sidecar=Sidecar(), load_stt=load, max_audio_seconds=300))
    assert result == {'text': 'hola'}
    assert calls == [('load', 'base', 'gguf'), ('transcribe', b'audio', 'base', None, True, {'max_audio_seconds': 300})]


def test_shared_service_cancellation_owns_event_and_keeps_slot_until_worker_stops():
    entered, stop, done = threading.Event(), threading.Event(), threading.Event()
    owners = []
    class Sidecar:
        def transcribe(self, raw, model, language, fast, owner):
            owners.append(owner)
            entered.set()
            try:
                assert owner.wait(2)
                stop.wait(2)
                return {'text': 'discarded'}
            finally:
                done.set()
        def cancel_transcription(self, owner):
            owner.set()
    async def scenario():
        sidecar = Sidecar()
        task = asyncio.create_task(stt_service.transcribe_local(b'audio', 'base', None, True, 'gguf', sidecar=sidecar, load_stt=lambda *args: None))
        try:
            assert await asyncio.to_thread(entered.wait, 1)
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task
            assert owners[0].is_set()
            with pytest.raises(SttModelBusyError):
                await stt_service.transcribe_local(b'audio', 'base', None, True, 'gguf', sidecar=sidecar, load_stt=lambda *args: None)
        finally:
            stop.set()
            assert await asyncio.to_thread(done.wait, 1)
    asyncio.run(scenario())


@pytest.mark.parametrize('enabled,ready', [(False, True), (True, False)])
def test_voice_never_downloads_until_enabled_and_ready(monkeypatch, enabled, ready):
    saved = account(enabled)
    transport = AsyncMock()
    monkeypatch.setattr(voice, 'status', lambda: {**prepared(), 'ready': ready})
    with pytest.raises(voice.VoiceError):
        asyncio.run(voice.transcribe(transport, saved, message()))
    transport.download_audio.assert_not_called()


def test_voice_transcription_is_local_and_rechecks_permissions(monkeypatch):
    saved = account()
    transport = AsyncMock()
    transport.download_audio.return_value = b'audio'
    monkeypatch.setattr(voice, 'status', prepared)
    recognize = AsyncMock(return_value={'text': '  Hola desde Telegram  '})
    monkeypatch.setattr(stt_service, 'transcribe_local', recognize)
    assert asyncio.run(voice.transcribe(transport, saved, message())) == 'Hola desde Telegram'
    recognize.assert_awaited_once_with(b'audio', 'base', None, True, 'gguf', max_audio_seconds=300)
    assert {item['code'] for item in repo.events('owner')} == {'audio_transcription_started', 'audio_transcription_completed'}
    async def revoked(*args, **kwargs):
        repo.set_voice_enabled(saved['id'], 'owner', False)
        return b'audio'
    transport.download_audio.side_effect = revoked
    recognize.reset_mock()
    with pytest.raises(voice.VoiceError, match='voice_disabled'):
        asyncio.run(voice.transcribe(transport, saved, message()))
    recognize.assert_not_called()


@pytest.mark.parametrize('error,code', [
    (TimeoutError(), 'voice_timeout'),
    (httpx.ConnectError('private transport details'), 'voice_network_failed'),
    (ValueError('voice_model_failed'), 'voice_model_failed'),
    (ValueError('voice_permission_missing'), 'voice_permission_missing'),
])
def test_remote_voice_error_and_next_request_recovery(monkeypatch, error, code):
    from core.inference import voice_providers
    saved = account()
    transport = AsyncMock()
    transport.download_audio.return_value = b'audio'
    monkeypatch.setattr(voice_providers, 'read', lambda: {'provider': 'elevenlabs'})
    monkeypatch.setattr(voice, 'active_status', lambda: {'ready': True})
    recognize = AsyncMock(side_effect=[error, {'text': ' Hello from Telegram '}])
    monkeypatch.setattr(voice_providers, 'transcribe', recognize)
    with pytest.raises(voice.VoiceError, match=code):
        asyncio.run(voice.transcribe(transport, saved, message()))
    assert 'private transport details' not in voice.notice(code, 'es')
    assert asyncio.run(voice.transcribe(transport, saved, message())) == 'Hello from Telegram'


@pytest.mark.parametrize('transcript', ['Hola desde Telegram', 'Hello from Telegram'])
def test_remote_spanish_and_english_transcripts_preserved(monkeypatch, transcript):
    from core.inference import voice_providers
    saved = account()
    transport = AsyncMock()
    transport.download_audio.return_value = b'audio'
    monkeypatch.setattr(voice_providers, 'read', lambda: {'provider': 'elevenlabs'})
    monkeypatch.setattr(voice, 'active_status', lambda: {'ready': True})
    monkeypatch.setattr(voice_providers, 'transcribe', AsyncMock(return_value={'text': transcript}))
    assert asyncio.run(voice.transcribe(transport, saved, message())) == transcript


def test_voice_toggle_is_owner_scoped_and_cannot_enable_unprepared_model(monkeypatch):
    saved = account(False)
    app = FastAPI()
    app.include_router(router, prefix='/api/channels')
    app.dependency_overrides[ui_credential] = lambda: ('other', None)
    with TestClient(app) as client:
        assert client.patch(f"/api/channels/{saved['id']}/voice", json={'enabled': True}).status_code == 404
        assert client.post(f"/api/channels/{saved['id']}/voice/prepare").status_code == 404
        app.dependency_overrides[ui_credential] = lambda: ('owner', None)
        monkeypatch.setattr(voice, 'status', lambda: {**prepared(), 'ready': False})
        assert client.patch(f"/api/channels/{saved['id']}/voice", json={'enabled': True}).status_code == 409
        assert not repo.get_account(saved['id']).get('voice_enabled')
        monkeypatch.setattr(voice, 'status', prepared)
        assert client.patch(f"/api/channels/{saved['id']}/voice", json={'enabled': True}).status_code == 200
        assert repo.get_account(saved['id'])['voice_enabled']
        assert client.patch(f"/api/channels/{saved['id']}/voice", json={'enabled': False}).status_code == 200
        assert not repo.set_voice_enabled(saved['id'], 'other', True)


@pytest.mark.parametrize('cancelled', [False, True])
def test_worker_voice_transcript_reaches_chat_only_after_success(monkeypatch, cancelled):
    saved = account()
    updates = [update()]
    if cancelled:
        updates.append(update(text='/cancel', update_id=2))
    repo.ingest(saved['id'], updates, lambda item: normalize_private_message(item, ['123']))
    transport = AsyncMock()
    async def call(method, **kwargs):
        if method == 'getUpdates':
            raise asyncio.CancelledError()
        return True
    transport.call.side_effect = call
    monkeypatch.setattr(runtime, 'Telegram', lambda *_: transport)
    monkeypatch.setattr(runtime, 'get_secret', lambda *_: 'secret')
    async def transcribe(*args):
        if cancelled:
            await asyncio.Future()
        return 'Hola desde una nota de voz'
    monkeypatch.setattr(voice, 'transcribe', transcribe)
    provider = AsyncMock(return_value='Hola, te escucho')
    monkeypatch.setattr(runtime, 'respond', provider)
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(runtime._worker(saved))
    if cancelled:
        provider.assert_not_called()
        assert history.messages(saved['id'], '123') == []
        assert 'Consulta cancelada' in transport.send.call_args.args[1]
    else:
        assert provider.call_args.args[1] == 'Hola desde una nota de voz'
        assert history.messages(saved['id'], '123')[0]['content'] == 'Hola desde una nota de voz'
    with repo.connection() as db:
        row = db.execute("SELECT status, request_json FROM work_runs WHERE source_kind='telegram'").fetchone()
    assert row['status'] == ('cancelled' if cancelled else 'completed')
    if not cancelled:
        assert json.loads(row['request_json'])['inputKind'] == 'audio'


def test_route_transcription_reuses_shared_service_without_changing_response(monkeypatch):
    from routes.inference_pkg import router_stt_studio as route
    class Sidecar:
        def transcribe(self, raw, model, language, fast, owner):
            return {'text': 'hello', 'model': model}
    loads = []
    monkeypatch.setattr(route, '_resolve_serving_stt_engine', lambda *_: 'transformers')
    monkeypatch.setattr(route, '_stt_sidecar_for', lambda *_: Sidecar())
    monkeypatch.setattr(route, '_stt_lifecycle', lambda: (lambda model, engine, owner: loads.append((model, engine)), None))
    assert asyncio.run(route._transcribe_audio_result(b'audio', 'base', None, True, 'transformers')) == {'text': 'hello', 'model': 'base'}
    assert loads == [('base', 'transformers')]


def test_prepare_reuses_existing_downloader_and_does_not_start_twice(monkeypatch):
    from core.inference import stt_ggml_sidecar, stt_sidecar
    starts = []
    monkeypatch.setattr(voice, 'status', lambda: {**prepared(), 'ready': False, 'downloading': bool(starts)})
    monkeypatch.setattr(stt_ggml_sidecar, 'is_available', lambda: False)
    monkeypatch.setattr(stt_sidecar, 'is_available', lambda: True)
    monkeypatch.setattr(stt_sidecar, 'start_model_download', lambda model: starts.append(model))
    assert voice.prepare()['downloading']
    assert voice.prepare()['downloading']
    assert starts == ['base']


def test_ready_status_does_not_confuse_another_model_download_failure(monkeypatch):
    from core.inference import stt_ggml_sidecar, stt_sidecar
    monkeypatch.setattr(stt_ggml_sidecar, 'is_available', lambda: True)
    monkeypatch.setattr(stt_ggml_sidecar, '_cached_model_path', lambda model: None)
    monkeypatch.setattr(stt_ggml_sidecar, 'download_status', lambda: {'requested_model': 'small', 'error': 'private raw failure'})
    monkeypatch.setattr(stt_sidecar, 'download_status', lambda: {})
    monkeypatch.setattr(stt_sidecar, 'is_model_downloaded', lambda model: False)
    assert not voice.status()['download_failed']
    monkeypatch.setattr(stt_ggml_sidecar, 'download_status', lambda: {'requested_model': 'base', 'error': 'private raw failure'})
    result = voice.status()
    assert result['download_failed'] and 'private raw' not in json.dumps(result)


def test_disabling_voice_during_transcription_stops_without_provider_or_history(monkeypatch):
    saved = account()
    repo.ingest(saved['id'], [update()], lambda item: normalize_private_message(item, ['123']))
    transport = AsyncMock()
    async def call(method, **kwargs):
        if method == 'getUpdates':
            raise asyncio.CancelledError()
        return True
    transport.call.side_effect = call
    monkeypatch.setattr(runtime, 'Telegram', lambda *_: transport)
    monkeypatch.setattr(runtime, 'get_secret', lambda *_: 'secret')
    stopped = []
    async def transcribe(*args):
        repo.set_voice_enabled(saved['id'], 'owner', False)
        try:
            await asyncio.Future()
        finally:
            stopped.append(True)
    monkeypatch.setattr(voice, 'transcribe', transcribe)
    provider = AsyncMock()
    monkeypatch.setattr(runtime, 'respond', provider)
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(runtime._worker(saved))
    assert stopped == [True]
    provider.assert_not_called()
    assert history.messages(saved['id'], '123') == []
    assert 'Activa la entrada de voz' in transport.send.call_args.args[1]


def test_empty_transcription_never_reaches_provider(monkeypatch):
    saved = account()
    transport = AsyncMock()
    transport.download_audio.return_value = b'audio'
    monkeypatch.setattr(voice, 'status', prepared)
    monkeypatch.setattr(stt_service, 'transcribe_local', AsyncMock(return_value={'text': ' '}))
    with pytest.raises(voice.VoiceError, match='audio_empty'):
        asyncio.run(voice.transcribe(transport, saved, message()))


@pytest.mark.parametrize('engine', ['transformers', 'gguf'])
def test_download_status_keeps_identity_after_a_failed_transfer(engine):
    from core.inference import stt_ggml_sidecar, stt_sidecar
    state = stt_ggml_sidecar._GgmlDownloadState() if engine == 'gguf' else stt_sidecar._SnapshotDownloadState()
    state._model_id = 'base'
    state._error = 'transfer failed'
    value = state.status()
    assert not value['downloading'] and value['model'] is None
    assert value['requested_model'] == 'base' and value['error'] == 'transfer failed'


def test_subsecond_note_is_not_mistaken_for_empty_audio():
    candidate = message()
    candidate['audio']['duration'] = 0
    assert voice.validate(candidate) == 'telegram_file'


@pytest.mark.parametrize('error_name,code', [('SttAudioDecodeError', 'audio_invalid'), ('SttModelNotDownloadedError', 'voice_not_ready'), ('SttUnavailableError', 'voice_not_ready')])
def test_transcription_failures_are_actionable_without_raw_details(monkeypatch, error_name, code):
    from core.inference import stt_sidecar
    saved = account()
    transport = AsyncMock()
    transport.download_audio.return_value = b'audio'
    monkeypatch.setattr(voice, 'status', prepared)
    monkeypatch.setattr(stt_service, 'transcribe_local', AsyncMock(side_effect=getattr(stt_sidecar, error_name)('private raw details')))
    with pytest.raises(voice.VoiceError) as caught:
        asyncio.run(voice.transcribe(transport, saved, message()))
    assert caught.value.code == code and 'private' not in str(caught.value)
