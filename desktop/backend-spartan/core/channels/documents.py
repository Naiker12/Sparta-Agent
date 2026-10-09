"""Bounded UTF-8 attachments; no disk writes, archive expansion or browsing."""
import re

from .delivery import check_access
from .telegram import TelegramError

MAX_BYTES = 256 * 1024
MAX_CHARS = 24000


class DocumentError(Exception):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def decode(raw):
    if not isinstance(raw, bytes) or not raw or len(raw) > MAX_BYTES:
        raise DocumentError('document_too_large')
    try:
        text = raw.decode('utf-8-sig')
    except UnicodeDecodeError:
        raise DocumentError('document_invalid') from None
    if len(text) > MAX_CHARS:
        raise DocumentError('document_too_large')
    if not text.strip() or any(ord(char) < 32 and char not in '\n\r\t' for char in text):
        raise DocumentError('document_invalid')
    return text


async def read(transport, account, message):
    check_access(account['id'], message['user_id'])
    item = message.get('document') or {}
    file_id, size = item.get('file_id'), item.get('file_size')
    if not isinstance(file_id, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,512}', file_id):
        raise DocumentError('document_unsupported')
    if type(size) is not int or not 0 < size <= MAX_BYTES:
        raise DocumentError('document_too_large')
    from storage.channels import repository as repo
    repo.event(account['id'], 'document_read_started')
    try:
        raw = await transport.download_file(file_id, max_bytes=MAX_BYTES)
    except TelegramError as error:
        if error.code.startswith('audio_'):
            raise DocumentError('document_unavailable') from None
        raise
    check_access(account['id'], message['user_id'])
    text = decode(raw)
    repo.event(account['id'], 'document_read_completed')
    return text


def notice(code, locale):
    messages = {
        'document_unsupported': ('Envía un archivo .txt, .md, .csv o .json en UTF-8.', 'Send a UTF-8 .txt, .md, .csv or .json file.'),
        'document_too_large': ('El documento debe tener hasta 256 KB y 24.000 caracteres.', 'The document must be at most 256 KB and 24,000 characters.'),
        'document_invalid': ('El archivo no contiene texto UTF-8 válido. PDF y Word aún no están disponibles.', 'The file does not contain valid UTF-8 text. PDF and Word are not available yet.'),
        'document_unavailable': ('No pude descargar el documento. Intenta enviarlo de nuevo.', 'I could not download the document. Try sending it again.'),
    }
    return messages[code][0 if locale == 'es' else 1]
