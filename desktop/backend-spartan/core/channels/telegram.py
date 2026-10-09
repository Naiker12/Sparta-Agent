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


import html


def _to_telegram_html(text: str) -> str:
    """Safely converts standard Markdown to Telegram-supported HTML."""
    if not text:
        return ""
    code_blocks = []

    def _save_code_block(match):
        idx = len(code_blocks)
        lang = match.group(1) or ""
        code = match.group(2)
        code_blocks.append((lang, code))
        return f"\x00CB{idx}\x00"

    content = re.sub(r'```([a-zA-Z0-9_-]*)\n?([\s\S]*?)```', _save_code_block, text)

    inline_codes = []

    def _save_inline_code(match):
        idx = len(inline_codes)
        inline_codes.append(match.group(1))
        return f"\x00IC{idx}\x00"

    content = re.sub(r'`([^`]+)`', _save_inline_code, content)

    # Escape HTML entities in raw content
    content = html.escape(content)

    # Bold: **bold** or __bold__
    content = re.sub(r'\*\*(.+?)\*\*', r'<b>\1</b>', content)
    content = re.sub(r'__(.+?)__', r'<b>\1</b>', content)

    # Italic: *italic* or _italic_
    content = re.sub(r'(?<!\w)\*([^*]+?)\*(?!\w)', r'<i>\1</i>', content)
    content = re.sub(r'(?<!\w)_([^_]+?)_(?!\w)', r'<i>\1</i>', content)

    # Links: [text](url)
    def _format_link(match):
        link_text = match.group(1)
        # The entire content has already been escaped above.
        url = match.group(2)
        return f'<a href="{url}">{link_text}</a>'

    content = re.sub(r'\[([^\]]+)\]\((https?://[^\s\)]+)\)', _format_link, content)

    # Restore inline code
    for idx, ic in enumerate(inline_codes):
        content = content.replace(f"\x00IC{idx}\x00", f"<code>{html.escape(ic)}</code>")

    # Restore code blocks
    for idx, (lang, cb) in enumerate(code_blocks):
        escaped_code = html.escape(cb)
        if lang:
            block = f'<pre><code class="language-{html.escape(lang)}">{escaped_code}</code></pre>'
        else:
            block = f'<pre><code>{escaped_code}</code></pre>'
        content = content.replace(f"\x00CB{idx}\x00", block)

    return content


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
            if response.status_code == 400 and isinstance(data, dict):
                description = str(data.get('description', '')).lower()
                if "can't parse entities" in description or 'cannot parse entities' in description:
                    raise TelegramError('format_error')
            if response.status_code == 400 and method == 'getFile':
                raise TelegramError('audio_unavailable')
            if response.status_code == 400 and method == 'sendPhoto':
                raise TelegramError('photo_unavailable')
            if not response.is_success or not data.get('ok'):
                raise TelegramError()
            return data['result']
        except TelegramError:
            raise
        except (httpx.HTTPError, ValueError, KeyError, TypeError):
            raise TelegramError() from None

    async def send(self, chat_id: int, text: str, *, reply_markup=None):
        # Format as Telegram HTML; gracefully fall back to plain text if markup parsing fails.
        for start in range(0, len(text), 3500):
            chunk = text[start:start + 3500]
            controls = {'reply_markup': reply_markup} if reply_markup and start + 3500 >= len(text) else {}
            try:
                formatted = _to_telegram_html(chunk)
                await self.call('sendMessage', chat_id=chat_id, text=formatted, parse_mode='HTML', **controls)
            except TelegramError as error:
                if error.code != 'format_error':
                    raise
                await self.call('sendMessage', chat_id=chat_id, text=chunk, **controls)
            if start + 3500 < len(text):
                await asyncio.sleep(1)

    async def send_controls(self, chat_id, text, reply_markup):
        result = await self.call('sendMessage', chat_id=chat_id, text=text, reply_markup=reply_markup)
        return result['message_id']

    async def clear_controls(self, chat_id, message_id, *, text=None):
        payload = {'chat_id': chat_id, 'message_id': message_id,
                   'reply_markup': {'inline_keyboard': []}}
        if text:
            payload['text'] = text
        await self.call('editMessageText' if text else 'editMessageReplyMarkup', **payload)

    async def send_voice(self, chat_id: int, voice_url_or_id: str, caption: str = ''):
        payload = {'chat_id': chat_id, 'voice': voice_url_or_id}
        if caption:
            payload['caption'] = caption[:1024]
        await self.call('sendVoice', **payload)

    async def action(self, chat_id: int, action: str = 'typing'):
        await self.call('sendChatAction', chat_id=chat_id, action=action)

    async def photo(self, chat_id: int, image):
        from .images import ReferenceImage, public_url
        if not isinstance(image, ReferenceImage) or not public_url(image.image_url) or not public_url(image.url):
            raise TelegramError('photo_unavailable')
        # Plain captions and URLs from the adapter, never provider-controlled uploads.
        # The complete source and image links are also in the text reply.
        caption = image.title[:160]
        if len(image.url) + len(caption) + 1 <= 1024:
            caption += '\n' + image.url
        await self.call('sendPhoto', chat_id=chat_id, photo=image.image_url, caption=caption)

    async def download_audio(self, file_id: str, *, max_bytes=20 * 1024 * 1024):
        return await self.download_file(file_id, max_bytes=max_bytes)

    async def download_file(self, file_id: str, *, max_bytes):
        if not isinstance(file_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,512}', file_id):
            raise TelegramError('audio_invalid')
        async with asyncio.timeout(60):
            metadata = await self.call('getFile', file_id=file_id)
            if not isinstance(metadata, dict):
                raise TelegramError('audio_invalid')
            path, size = metadata.get('file_path'), metadata.get('file_size')
            if (not isinstance(path, str) or len(path) > 300 or
                    not re.fullmatch(r'[A-Za-z0-9_./-]+', path) or
                    any(part in ('', '.', '..') for part in path.split('/'))):
                raise TelegramError('audio_invalid')
            if size is not None and (type(size) is not int or size <= 0 or size > max_bytes):
                raise TelegramError('audio_too_large')
            try:
                # Fixed host, validated Telegram path, no redirect or filesystem write.
                async with self._client.stream('GET', f'https://api.telegram.org/file/bot{self._token}/{path}') as response:
                    if not response.is_success:
                        raise TelegramError('audio_unavailable')
                    length = response.headers.get('content-length')
                    if length is not None and (not length.isdecimal() or int(length) > max_bytes):
                        raise TelegramError('audio_too_large')
                    raw = bytearray()
                    async for chunk in response.aiter_bytes(65536):
                        if len(raw) + len(chunk) > max_bytes:
                            raise TelegramError('audio_too_large')
                        raw.extend(chunk)
                    if not raw:
                        raise TelegramError('audio_invalid')
                    return bytes(raw)
            except (httpx.HTTPError, ValueError, TypeError):
                raise TelegramError('audio_unavailable') from None
