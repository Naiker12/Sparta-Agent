import asyncio
import html
import json
from unittest.mock import AsyncMock

import httpx
import pytest

from core.channels.telegram import Telegram, TelegramError, _to_telegram_html


@pytest.mark.parametrize('code', ['transport_error', 'rate_limited', 'credentials_error', 'consumer_conflict'])
def test_send_does_not_retry_ambiguous_or_non_format_errors(code):
    async def run():
        bot = Telegram('123:fake')
        try:
            bot.call = AsyncMock(side_effect=TelegramError(code))
            with pytest.raises(TelegramError) as error:
                await bot.send(123, '**hello**')
            assert error.value.code == code
            assert bot.call.await_count == 1
        finally:
            await bot.close()
    asyncio.run(run())


def test_only_entity_parse_error_falls_back_to_plain_text():
    async def run():
        bot = Telegram('123:fake')
        await bot.close()
        requests = []
        def handler(request):
            requests.append(json.loads(request.content))
            if len(requests) == 1:
                return httpx.Response(400, json={'ok': False, 'description': "Bad Request: can't parse entities"})
            return httpx.Response(200, json={'ok': True, 'result': {'message_id': 1}})
        bot._client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        try:
            controls = {'inline_keyboard': []}
            await bot.send(123, '**hello**', reply_markup=controls)
            assert len(requests) == 2
            assert requests[0]['parse_mode'] == 'HTML'
            assert requests[1]['text'] == '**hello**'
            assert 'parse_mode' not in requests[1]
            assert requests[1]['reply_markup'] == controls
        finally:
            await bot.close()
    asyncio.run(run())


def test_link_query_is_escaped_once():
    url = 'https://example.com/?a=1&b=2'
    formatted = _to_telegram_html(f'[source]({url})')
    assert formatted == f'<a href="{html.escape(url, quote=True)}">source</a>'


@pytest.mark.parametrize('status,code', [(400, 'upload_rejected'), (403, 'credentials_error'), (429, 'rate_limited')])
def test_send_document_uses_multipart_and_maps_errors(status, code):
    async def run():
        bot = Telegram('123:fake-secret')
        await bot.close()
        seen = []
        def handler(request):
            seen.append(request)
            payload = {'ok': status == 200, 'result': {'message_id': 4}}
            if status == 429:
                payload['parameters'] = {'retry_after': 7}
            return httpx.Response(status, json=payload)
        bot._client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        try:
            if status == 200:
                await bot.send_document(123, 'a.pdf', 'application/pdf', b'%PDF-1.7')
            else:
                with pytest.raises(TelegramError) as error:
                    await bot.send_document(123, 'a.pdf', 'application/pdf', b'%PDF-1.7')
                assert error.value.code == code
                assert 'fake-secret' not in str(error.value)
            request = seen[0]
            assert request.headers['content-type'].startswith('multipart/form-data; boundary=')
            assert b'name="chat_id"' in request.content and b'name="document"' in request.content
            assert b'a.pdf' in request.content and b'%PDF-1.7' in request.content
        finally:
            await bot.close()
    asyncio.run(run())


def test_upload_rejects_oversize_before_network():
    async def run():
        bot = Telegram('123:fake')
        bot.call = AsyncMock()
        try:
            with pytest.raises(TelegramError, match='upload_too_large'):
                await bot.send_document(123, 'a.pdf', 'application/pdf', b'x' * (50 * 1024 * 1024 + 1))
            bot.call.assert_not_called()
        finally:
            await bot.close()
    asyncio.run(run())
