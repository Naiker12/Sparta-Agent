"""Small Bot API adapter. Credentials and raw HTTP exceptions never leave it."""
import asyncio
import logging
import re

import httpx


class _RedactBotURL(logging.Filter):
    def filter(self, record):
        record.msg = re.sub(r'/bot\d+:[A-Za-z0-9_-]+', '/bot[REDACTED]', record.getMessage())
        record.args = ()
        return True


for _name in ('httpx', 'httpcore.http11', 'httpcore.http2'):
    logging.getLogger(_name).addFilter(_RedactBotURL())


class TelegramError(Exception):
    def __init__(self, code='transport_error', retry_after=5):
        super().__init__(code)
        self.code, self.retry_after = code, min(max(retry_after, 1), 300)


class Telegram:
    def __init__(self, token: str):
        self._token = token
        self._client = httpx.AsyncClient(timeout=40, follow_redirects=False)

    async def close(self):
        await self._client.aclose()

    async def call(self, method: str, **payload):
        try:
            response = await self._client.post(f'https://api.telegram.org/bot{self._token}/{method}', json=payload)
            data = response.json()
            if response.status_code == 429:
                raise TelegramError('rate_limited', int((data.get('parameters') or {}).get('retry_after', 5)))
            if response.status_code in (401, 403):
                raise TelegramError('credentials_error')
            if response.status_code == 409:
                raise TelegramError('consumer_conflict')
            if not response.is_success or not data.get('ok'):
                raise TelegramError()
            return data['result']
        except TelegramError:
            raise
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            raise TelegramError() from None

    async def send(self, chat_id: int, text: str):
        # Plain text deliberately avoids parsing provider output as Telegram markup.
        for start in range(0, len(text), 3500):
            await self.call('sendMessage', chat_id=chat_id, text=text[start:start + 3500])
            if start + 3500 < len(text):
                await asyncio.sleep(1)
