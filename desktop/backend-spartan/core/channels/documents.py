"""Bounded document parsing in an isolated temporary directory."""
import asyncio
import re
import tempfile
import zipfile
from pathlib import Path

from .delivery import check_access
from .telegram import TelegramError

MAX_BYTES = 10 * 1024 * 1024
MAX_CHARS = 24000
SUPPORTED = {'.txt', '.md', '.csv', '.json', '.pdf', '.docx', '.xlsx', '.pptx', '.odt', '.rtf', '.epub'}


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


def _parse(raw, filename):
    suffix = Path(filename).suffix.lower()
    if suffix not in SUPPORTED:
        raise DocumentError('document_unsupported')
    if suffix == '.pdf' and not raw.startswith(b'%PDF-'):
        raise DocumentError('document_invalid')
    if suffix in {'.docx', '.xlsx', '.pptx', '.odt', '.epub'}:
        if not raw.startswith(b'PK\x03\x04'):
            raise DocumentError('document_invalid')
        # Reject obvious zip bombs before handing the archive to a parser.
        try:
            import io
            with zipfile.ZipFile(io.BytesIO(raw)) as archive:
                entries = archive.infolist()
                total = sum(item.file_size for item in entries)
                if len(entries) > 5000 or total > 100 * 1024 * 1024 or any(
                    item.file_size > max(1, item.compress_size) * 100 for item in entries
                ):
                    raise DocumentError('document_too_large')
        except zipfile.BadZipFile:
            raise DocumentError('document_invalid') from None
    elif suffix == '.rtf' and not raw.lstrip().startswith(b'{\\rtf'):
        raise DocumentError('document_invalid')
    if suffix in {'.txt', '.md', '.csv', '.json'}:
        text = decode(raw)
        if suffix == '.json':
            import json
            try:
                json.loads(text)
            except ValueError:
                raise DocumentError('document_invalid') from None
        return text
    from utils.paths import ensure_dir, tmp_root
    root = tmp_root() / 'telegram-documents'
    ensure_dir(root)
    with tempfile.TemporaryDirectory(prefix='read-', dir=root) as folder:
        path = Path(folder) / ('attachment' + suffix)
        path.write_bytes(raw)
        try:
            from core.rag.parsers import parse
            pages = parse(str(path), want_images=False)
        except Exception:
            raise DocumentError('document_invalid') from None
        text = '\n\n'.join(f'[Página {page.page_number}]\n{page.text}' if page.page_number else page.text for page in pages)
        text = text.strip()
        if not text:
            raise DocumentError('document_invalid')
        return text[:MAX_CHARS]


async def read(transport, account, message):
    check_access(account['id'], message['user_id'])
    item = message.get('document') or {}
    file_id, size = item.get('file_id'), item.get('file_size')
    filename = item.get('file_name', '')
    if not isinstance(filename, str) or Path(filename).suffix.lower() not in SUPPORTED:
        raise DocumentError('document_unsupported')
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
    try:
        async with asyncio.timeout(60):
            text = await asyncio.to_thread(_parse, raw, filename)
    except TimeoutError:
        raise DocumentError('document_unavailable') from None
    repo.event(account['id'], 'document_read_completed')
    return text


def notice(code, locale):
    messages = {
        'document_unsupported': ('Envía TXT, Markdown, CSV, JSON, PDF, DOCX, XLSX, PPTX, ODT, RTF o EPUB.', 'Send TXT, Markdown, CSV, JSON, PDF, DOCX, XLSX, PPTX, ODT, RTF or EPUB.'),
        'document_too_large': ('El documento debe tener hasta 10 MB y el texto se limita a 24.000 caracteres.', 'The document must be at most 10 MB; extracted text is limited to 24,000 characters.'),
        'document_invalid': ('No pude leer el documento. Comprueba que el archivo no esté dañado y tenga el formato correcto.', 'I could not read the document. Check that it is not damaged and uses the correct format.'),
        'document_unavailable': ('No pude descargar el documento. Intenta enviarlo de nuevo.', 'I could not download the document. Try sending it again.'),
    }
    return messages[code][0 if locale == 'es' else 1]
