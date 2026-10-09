import asyncio
import json
import threading
from unittest.mock import AsyncMock

import httpx
import pytest

from core.channels import delivery, images, runtime, web
from core.channels.policy import normalize_private_message
from core.channels.telegram import Telegram, TelegramError
from storage.channels import history, repository as repo


@pytest.fixture(autouse=True)
def isolated_storage(tmp_path, monkeypatch):
    import sys
    monkeypatch.setenv('UNSLOTH_STUDIO_HOME', str(tmp_path))
    for name, module in tuple(sys.modules.items()):
        if name.startswith('storage.') and hasattr(module, '_schema_ready'):
            monkeypatch.setattr(module, '_schema_ready', False)
    runtime.states.clear()
    runtime.workers.clear()


def account():
    saved = repo.create_account('owner', '1', {'name': 'Test', 'allowed_user_ids': ['123'], 'locale': 'es', 'provider_id': 'p', 'model': 'm', 'provider_name': 'Provider'})
    repo.set_enabled(saved['id'], 'owner', True)
    return repo.get_account(saved['id'])


def image():
    return images.ReferenceImage('Landscape', 'https://example.com/source', 'https://example.com/photo.jpg')


def message(text='/images mountains'):
    return {'user_id': '123', 'chat_id': 123, 'text': text, 'media': None}


def test_image_results_filter_destinations_and_preserve_actual_source():
    raw = [
        {'title': 'Local', 'url': 'https://example.com/source', 'image': 'http://127.0.0.1/x'},
        {'title': 'Credentials', 'url': 'https://example.com/?token=secret', 'image': 'https://example.com/a.jpg'},
        {'title': 'Landscape', 'url': 'https://example.com/source', 'image': 'https://example.com/photo.jpg', 'source': 'search engine', 'thumbnail': 'https://example.com/thumb.jpg'},
        {'title': 'Duplicate', 'url': 'https://example.com/another', 'image': 'https://example.com/photo.jpg'},
        {'title': 'Too wide', 'url': 'https://example.com/source', 'image': 'https://example.com/wide.jpg', 'width': 9999, 'height': 1},
        {'title': 'Second', 'url': 'https://example.com/second', 'image': 'https://example.com/second.jpg'},
        {'title': 'Third', 'url': 'https://example.com/third', 'image': 'https://example.com/third.jpg'},
    ]
    result = images.parse_results(raw)
    assert result == [image(), images.ReferenceImage('Second', 'https://example.com/second', 'https://example.com/second.jpg')]


@pytest.mark.parametrize('raw', [None, {}, [None, 'bad'], [{'title': 12, 'url': 'https://example.com/', 'image': 'https://example.com/a.jpg'}]])
def test_malformed_image_results_do_not_become_attachments(raw):
    assert images.parse_results(raw) == []


def test_image_search_uses_existing_library_and_bounded_safe_search(monkeypatch):
    import ddgs
    calls = []
    class Client:
        def images(self, query, **kwargs):
            calls.append((query, kwargs))
            return [{'title': image().title, 'url': image().url, 'image': image().image_url}]
    def factory(**kwargs):
        assert kwargs == {'timeout': 10}
        return Client()
    monkeypatch.setattr(ddgs, 'DDGS', factory)
    assert asyncio.run(images.search('mountain landscape')) == [image()]
    assert calls == [('mountain landscape', {'max_results': 6, 'safesearch': 'on'})]


@pytest.mark.parametrize('query', ['password=secret', 'name@example.com', 'C:\\Users\\private', 'https://localhost/a'])
def test_image_search_never_sends_private_inputs(monkeypatch, query):
    import ddgs
    def forbidden(**kwargs):
        pytest.fail('Private query reached network client')
    monkeypatch.setattr(ddgs, 'DDGS', forbidden)
    assert asyncio.run(images.search(query)) == []


def test_cancelled_lookup_discards_late_results_and_holds_shared_slot(monkeypatch):
    import ddgs
    entered, release, exited = threading.Event(), threading.Event(), threading.Event()
    class Client:
        def images(self, *args, **kwargs):
            entered.set()
            try:
                release.wait(2)
                return [{'title': image().title, 'url': image().url, 'image': image().image_url}]
            finally:
                exited.set()
    monkeypatch.setattr(ddgs, 'DDGS', lambda **kwargs: Client())
    async def scenario():
        task = asyncio.create_task(images.search('mountains'))
        try:
            assert await asyncio.to_thread(entered.wait, 1)
            task.cancel()
            with pytest.raises(asyncio.CancelledError):
                await task
            assert await images.search('another query') == []
        finally:
            release.set()
            assert await asyncio.to_thread(exited.wait, 1)
    asyncio.run(scenario())


@pytest.mark.parametrize('automatic', [False, True])
def test_executor_returns_only_adapter_photos_and_verified_links(monkeypatch, automatic):
    from core.channels.executor import respond
    from core.inference import task_scheduler
    rounds = []
    class Client:
        async def stream_chat_completion(self, **kwargs):
            rounds.append(kwargs)
            if automatic and len(rounds) == 1:
                assert {tool['function']['name'] for tool in kwargs['tools']} == {'search_public_web', 'read_public_page', 'search_reference_images'}
                yield 'data: ' + json.dumps({'choices': [{'delta': {'tool_calls': [{'index': 0, 'id': 'images1', 'function': {'name': 'search_reference_images', 'arguments': '{"query":"mountains"}'}}]}}]})
            else:
                assert kwargs['tools'] == [] and kwargs['tool_choice'] == 'none'
                assert 'not visual analysis' in kwargs['messages'][0]['content']
                yield 'data: ' + json.dumps({'choices': [{'delta': {'content': 'Referencias https://invented.example/photo.jpg'}}]})
            yield 'data: ' + json.dumps({'usage': {'prompt_tokens': 10, 'completion_tokens': 2}})
    monkeypatch.setattr(task_scheduler, 'make_client', lambda *_: Client())
    lookup = AsyncMock(return_value=[image()])
    monkeypatch.setattr(images, 'search', lookup)
    counts = []
    result = asyncio.run(respond(account(), 'Find reference images of mountains' if automatic else '/images mountains', on_usage=counts.append))
    assert isinstance(result, str) and isinstance(result, images.ChannelReply)
    assert result.images == (image(),)
    assert image().url in result and image().image_url in result and 'invented.example' not in result
    assert len(rounds) == (2 if automatic else 1)
    assert counts[-1]['total_tokens'] == (24 if automatic else 12)
    lookup.assert_awaited_once_with('mountains')


def test_no_images_is_honest_and_does_not_call_provider(monkeypatch):
    from core.channels.executor import respond
    from core.inference import task_scheduler
    client = AsyncMock()
    monkeypatch.setattr(task_scheduler, 'make_client', lambda *_: client)
    monkeypatch.setattr(images, 'search', AsyncMock(return_value=[]))
    result = asyncio.run(respond(account(), '/images mountains'))
    assert 'No pude obtener imágenes' in result
    client.stream_chat_completion.assert_not_called()


@pytest.mark.parametrize('status,code', [(400, 'photo_unavailable'), (401, 'credentials_error'), (403, 'credentials_error'), (429, 'rate_limited'), (500, 'transport_error')])
def test_photo_api_sanitizes_errors_and_does_not_retry(status, code):
    async def scenario():
        calls = []
        bot = Telegram('12345:secret')
        await bot._client.aclose()
        def handle(request):
            calls.append(request)
            payload = json.loads(request.content)
            assert payload == {'chat_id': 123, 'photo': image().image_url, 'caption': image().title + '\n' + image().url}
            assert request.url.path.endswith('/sendPhoto')
            return httpx.Response(status, json={'ok': False, 'description': 'private details', 'parameters': {'retry_after': 45}})
        bot._client = httpx.AsyncClient(transport=httpx.MockTransport(handle))
        try:
            with pytest.raises(TelegramError) as caught:
                await bot.photo(123, image())
            assert caught.value.code == code and 'private' not in str(caught.value)
            assert len(calls) == 1
        finally:
            await bot.close()
    asyncio.run(scenario())


def test_photo_api_rejects_forged_private_attachment_before_transport(monkeypatch):
    async def scenario():
        bot = Telegram('12345:secret')
        bot.call = AsyncMock()
        try:
            with pytest.raises(TelegramError, match='photo_unavailable'):
                await bot.photo(123, images.ReferenceImage('Private', image().url, 'http://127.0.0.1/file'))
            bot.call.assert_not_called()
        finally:
            await bot.close()
    asyncio.run(scenario())


def test_rejected_photo_retains_links_and_records_fallback():
    saved = account()
    transport = AsyncMock()
    transport.photo.side_effect = TelegramError('photo_unavailable')
    output = images.ChannelReply('Source ' + image().url + '\nImage ' + image().image_url, [image()])
    delivered = asyncio.run(delivery.deliver(transport, saved, message(), output))
    assert image().image_url in delivered and 'No pude enviar la imagen 1' in delivered
    assert transport.send.await_count == 2
    assert repo.events('owner')[0]['code'] == 'photo_unavailable'


def test_photo_transport_failure_does_not_send_fallback_or_retry():
    saved = account()
    transport = AsyncMock()
    transport.photo.side_effect = TelegramError('transport_error')
    with pytest.raises(TelegramError, match='transport_error'):
        asyncio.run(delivery.deliver(transport, saved, message(), images.ChannelReply('References', [image()])))
    transport.photo.assert_awaited_once()
    transport.send.assert_awaited_once()


def test_revocation_during_photo_delivery_prevents_next_photo():
    saved = account()
    transport = AsyncMock()
    async def photo(*args):
        repo.set_enabled(saved['id'], 'owner', False)
    transport.photo.side_effect = photo
    with pytest.raises(delivery.DeliveryRevoked):
        asyncio.run(delivery.deliver(transport, saved, message(), images.ChannelReply('References', [image(), image()])))
    transport.photo.assert_awaited_once()
    assert transport.send.await_count == 1


@pytest.mark.parametrize('failure', [None, 'photo_unavailable', 'transport_error'])
def test_worker_photo_delivery_projects_only_confirmed_result(monkeypatch, failure):
    saved = account()
    update = {'update_id': 1, 'message': {'from': {'id': 123, 'is_bot': False}, 'chat': {'id': 123, 'type': 'private'}, 'text': '/images mountains'}}
    repo.ingest(saved['id'], [update], lambda item: normalize_private_message(item, ['123']))
    transport = AsyncMock()
    async def call(method, **kwargs):
        if method == 'getUpdates':
            raise asyncio.CancelledError()
        return True
    transport.call.side_effect = call
    if failure:
        transport.photo.side_effect = TelegramError(failure)
    monkeypatch.setattr(runtime, 'Telegram', lambda *_: transport)
    monkeypatch.setattr(runtime, 'get_secret', lambda *_: 'secret')
    output = images.ChannelReply('References\n' + image().url + '\n' + image().image_url, [image()])
    monkeypatch.setattr(runtime, 'respond', AsyncMock(return_value=output))
    async def interrupted_backoff(_):
        raise asyncio.CancelledError()
    monkeypatch.setattr(runtime.asyncio, 'sleep', interrupted_backoff)
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(runtime._worker(saved))
    transport.photo.assert_awaited_once_with(123, image())
    turns = history.messages(saved['id'], '123')
    with repo.connection() as db:
        row = db.execute("SELECT status, result_json FROM work_runs WHERE source_kind='telegram'").fetchone()
    if failure == 'transport_error':
        assert turns == [] and row['status'] == 'needs_review'
    else:
        assert len(turns) == 2 and row['status'] == 'completed'
        if failure:
            assert 'No pude enviar la imagen' in turns[-1]['content']
        assert json.loads(row['result_json'])['summary'] == turns[-1]['content']


def test_cancel_during_photo_delivery_stops_upload_and_marks_partial_delivery(monkeypatch):
    saved = account()
    def update(update_id, text):
        return {'update_id': update_id, 'message': {'from': {'id': 123, 'is_bot': False}, 'chat': {'id': 123, 'type': 'private'}, 'text': text}}
    repo.ingest(saved['id'], [update(1, '/images mountains'), update(2, '/cancel')], lambda item: normalize_private_message(item, ['123']))
    transport = AsyncMock()
    async def call(method, **kwargs):
        if method == 'getUpdates':
            raise asyncio.CancelledError()
        return True
    transport.call.side_effect = call
    stopped = []
    async def photo(*args):
        try:
            await asyncio.Future()
        finally:
            stopped.append(True)
    transport.photo.side_effect = photo
    monkeypatch.setattr(runtime, 'Telegram', lambda *_: transport)
    monkeypatch.setattr(runtime, 'get_secret', lambda *_: 'secret')
    monkeypatch.setattr(runtime, 'respond', AsyncMock(return_value=images.ChannelReply('References', [image(), image()])))
    with pytest.raises(asyncio.CancelledError):
        asyncio.run(runtime._worker(saved))
    assert stopped == [True]
    transport.photo.assert_awaited_once()
    assert transport.send.await_count == 2 and 'Envío cancelado' in transport.send.call_args.args[1]
    assert any(call.args == (123, 'upload_photo') for call in transport.action.call_args_list)
    assert history.messages(saved['id'], '123') == []
    with repo.connection() as db:
        row = db.execute("SELECT status, result_json FROM work_runs WHERE source_kind='telegram'").fetchone()
    assert row['status'] == 'needs_review' and json.loads(row['result_json'])['reason'] == 'delivery_cancelled'
    codes = {event['code'] for event in repo.events('owner')}
    assert 'delivery_cancelled' in codes and 'reply_sent' not in codes
    assert not repo.consume_control(saved['id'], 2)


def test_provider_text_cannot_create_a_photo_attachment(monkeypatch):
    from core.channels.executor import respond
    from core.inference import task_scheduler
    class Client:
        async def stream_chat_completion(self, **kwargs):
            yield 'data: ' + json.dumps({'choices': [{'delta': {'content': 'Image: https://example.com/provider.jpg'}}]})
    monkeypatch.setattr(task_scheduler, 'make_client', lambda *_: Client())
    result = asyncio.run(respond(account(), 'hello'))
    assert isinstance(result, images.ChannelReply) and result.images == ()


def test_public_photo_is_sent_as_native_photo_with_plain_caption():
    async def scenario():
        bot = Telegram('12345:secret')
        await bot._client.aclose()
        payloads = []
        def handle(request):
            payloads.append(json.loads(request.content))
            return httpx.Response(200, json={'ok': True, 'result': {'message_id': 1}})
        bot._client = httpx.AsyncClient(transport=httpx.MockTransport(handle))
        try:
            await bot.photo(123, image())
            assert payloads == [{'chat_id': 123, 'photo': image().image_url, 'caption': image().title + '\n' + image().url}]
        finally:
            await bot.close()
    asyncio.run(scenario())
