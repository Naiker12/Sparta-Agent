"""Bounded public HTTPS downloads for owner initiated Telegram file delivery."""
import asyncio
import ipaddress
import re
import socket
from pathlib import Path
from urllib.parse import urljoin, urlsplit, unquote

import httpx

from core.inference.web_access_policy import check_url_access
from core.net.public_transport import PublicPinnedTransport
from storage.channels import repository as repo
from storage.channels import projects
from . import attachments, permissions
from .delivery import check_access

MAX_REDIRECTS = 3
MAX_BYTES = attachments.MAX_FILE_BYTES
_ALLOWED = {'.pdf', '.docx', '.xlsx', '.pptx', '.csv', '.txt', '.md', '.json', '.png', '.jpg', '.webp'}


class FileError(Exception):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def _validate_url(url, account):
    allowed, _, host = check_url_access(url, None)
    parsed = urlsplit(url)
    if (not allowed or parsed.scheme != 'https' or parsed.port not in (None, 443)
            or not host or not parsed.hostname):
        raise FileError('file_url_blocked')
    if host == 'localhost' or host.endswith(('.localhost', '.local', '.internal', '.lan', '.home')):
        raise FileError('file_url_blocked')
    try:
        if not ipaddress.ip_address(host).is_global:
            raise FileError('file_url_blocked')
    except ValueError:
        pass
    if account.get('website_policy'):
        ok, _, _ = check_url_access(url, account.get('website_policy'))
        if not ok:
            raise FileError('file_url_blocked')
    try:
        addresses = socket.getaddrinfo(host, 443, 0, socket.SOCK_STREAM)
        ips = [ipaddress.ip_address(item[4][0]) for item in addresses]
    except (OSError, ValueError):
        raise FileError('file_unavailable') from None
    if not ips or any(not ip.is_global for ip in ips):
        raise FileError('file_url_blocked')
    return parsed


def _filename(response, url):
    disposition = response.headers.get('content-disposition', '')
    match = re.search(r"filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)", disposition, re.I)
    name = unquote(match.group(1) or match.group(2)) if match else unquote(urlsplit(url).path.rsplit('/', 1)[-1])
    return name or 'download'


async def download(transport, account, message, url):
    check_access(account['id'], message['user_id'])
    if not permissions.file_allowed(account, message['user_id'], 'web_download'):
        raise FileError('web_download_disabled')
    if not permissions.file_allowed(account, message['user_id'], 'file_send'):
        raise FileError('file_send_disabled')
    if projects.selected(account['id'], message['user_id']):
        raise FileError('file_project_active')
    if not isinstance(url, str) or len(url) > 4096:
        raise FileError('file_url_blocked')
    repo.event(account['id'], 'public_file_download_started')
    current = url
    try:
        async with asyncio.timeout(60):
            async with httpx.AsyncClient(transport=PublicPinnedTransport(), timeout=30,
                                         follow_redirects=False, trust_env=False) as client:
                for hop in range(MAX_REDIRECTS + 1):
                    _validate_url(current, account)
                    async with client.stream('GET', current, headers={'Accept': '*/*'}) as response:
                        if response.status_code in (301, 302, 303, 307, 308):
                            if hop == MAX_REDIRECTS or not response.headers.get('location'):
                                raise FileError('file_redirect_blocked')
                            current = urljoin(current, response.headers['location'])
                            continue
                        if response.status_code != 200:
                            raise FileError('file_unavailable')
                        length = response.headers.get('content-length')
                        if length and (not length.isdecimal() or int(length) > MAX_BYTES):
                            raise FileError('file_too_large')
                        name = _filename(response, current)
                        if Path(name).suffix.lower() not in _ALLOWED:
                            raise FileError('file_type_blocked')
                        data = bytearray()
                        async for block in response.aiter_bytes(65536):
                            if len(data) + len(block) > MAX_BYTES:
                                raise FileError('file_too_large')
                            data.extend(block)
                        check_access(account['id'], message['user_id'])
                        try:
                            doc = attachments.stage_document(account['id'], message['user_id'], name, bytes(data))
                        except attachments.AttachmentError as error:
                            raise FileError(error.code) from None
                        repo.event(account['id'], 'public_file_download_completed')
                        return doc
    except FileError:
        raise
    except (httpx.HTTPError, OSError, ValueError, TimeoutError):
        raise FileError('file_unavailable') from None
    raise FileError('file_unavailable')


async def confirm_delivery(transport, account, message):
    """Consume a previously staged file only for its authorized confirmation action."""
    from .delivery import check_access
    from .attachments import read_staged, delete_staged, AttachmentError
    action, identifier = message.get('action'), message.get('ref')
    if action not in ('send_file', 'cancel_file'):
        raise FileError('file_confirmation_required')
    try:
        if action == 'cancel_file':
            check_access(account['id'], message['user_id'])
            delete_staged(account['id'], message['user_id'], identifier)
            return 'Archivo pendiente cancelado.' if account['locale'] == 'es' else 'Pending file cancelled.'
        current_account = repo.get_account(account['id'])
        if not current_account or not permissions.file_allowed(current_account, message['user_id'], 'file_send'):
            raise FileError('file_send_disabled')
        document, raw = read_staged(account['id'], message['user_id'], identifier)
        check_access(account['id'], message['user_id'])
        # The controls token is single-use. Deleting the staged copy before
        # upload prevents duplicate delivery after an ambiguous network result.
        delete_staged(account['id'], message['user_id'], identifier)
        check_access(account['id'], message['user_id'])
        await transport.send_document(message['chat_id'], document.filename, document.mime, raw)
        repo.event(account['id'], 'public_file_sent')
        return ('Archivo enviado: ' if account['locale'] == 'es' else 'File sent: ') + document.filename
    except AttachmentError as error:
        raise FileError(error.code) from None


def file_url(text):
    if not isinstance(text, str):
        return None
    match = re.fullmatch(r'\s*/file(?:@\w+)?\s+(\S+)\s*', text, re.I)
    if match:
        return match.group(1)
    match = re.fullmatch(r'\s*(?:descarga|baja|download)\s+(?:este\s+)?(?:archivo|file)?\s*(https://\S+)\s*', text, re.I)
    return match.group(1) if match else None


def notice(code, locale):
    es = {
        'file_owner_only': 'La descarga de archivos está disponible solo para el propietario de esta conexión.',
        'file_send_disabled': 'El envío de archivos está desactivado. El propietario puede habilitarlo en Canales y permisos.',
        'web_download_disabled': 'La descarga de archivos públicos está desactivada para este usuario. El propietario puede cambiarlo en Canales y permisos.',
        'file_project_active': 'Sal del proyecto con /project off antes de descargar un archivo.',
        'file_url_blocked': 'Solo puedo descargar una URL HTTPS pública permitida.',
        'file_redirect_blocked': 'El enlace redirige demasiadas veces o a un destino no permitido.',
        'file_too_large': 'El archivo supera el límite de 25 MB.',
        'file_type_blocked': 'Ese formato no está permitido. Usa PDF, Office, texto o imagen PNG/JPG/WebP.',
        'too_many_pending_files': 'Ya hay cinco archivos pendientes de confirmación. Confirma o cancela alguno primero.',
        'file_expired': 'El archivo pendiente caducó. Vuelve a solicitarlo.',
        'file_unavailable': 'No pude descargar o preparar ese archivo. Revisa el enlace e inténtalo otra vez.',
        'file_confirmation_required': 'Confirma el envío con el botón del archivo pendiente.',
    }
    en = {
        'file_owner_only': 'File downloads are available only to this connection owner.',
        'file_send_disabled': 'File delivery is disabled. The connection owner can enable it in Channels and permissions.',
        'web_download_disabled': 'Public file downloads are disabled for this user. The connection owner can change this in Channels and permissions.',
        'file_project_active': 'Leave the project with /project off before downloading a file.',
        'file_url_blocked': 'I can download only a permitted public HTTPS URL.',
        'file_redirect_blocked': 'The link redirects too many times or to a blocked destination.',
        'file_too_large': 'The file exceeds the 25 MB limit.',
        'file_type_blocked': 'That format is not allowed. Use PDF, Office, text, or PNG/JPG/WebP.',
        'too_many_pending_files': 'Five files are already awaiting confirmation. Confirm or cancel one first.',
        'file_expired': 'The pending file expired. Request it again.',
        'file_unavailable': 'I could not download or prepare that file. Check the link and try again.',
        'file_confirmation_required': 'Confirm delivery with the pending file button.',
    }
    return (es if locale == 'es' else en).get(code, (es if locale == 'es' else en)['file_unavailable'])
