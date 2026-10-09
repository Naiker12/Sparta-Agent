"""Installation voice configuration and bounded, explicit remote transcription."""
import asyncio
import io
import ipaddress
import json
import re
import socket
import threading
import wave
from urllib.parse import urlsplit

import httpx
from storage.credential_secrets import get_secret, upsert_secret, delete_secret

KIND = 'voice_configuration'
SCOPE = 'default'
_lock = threading.RLock()
_decode_slot = threading.BoundedSemaphore(1)
CATALOG = {
    'local': {'name': 'Whisper', 'model': 'base', 'endpoint': ''},
    'elevenlabs': {'name': 'ElevenLabs', 'model': 'scribe_v2', 'endpoint': 'https://api.elevenlabs.io/v1/speech-to-text'},
    'groq': {'name': 'Groq', 'model': 'whisper-large-v3-turbo', 'endpoint': 'https://api.groq.com/openai/v1/audio/transcriptions'},
    'compatible': {'name': 'API', 'model': 'whisper-1', 'endpoint': ''},
}


def read():
    with _lock:
        raw = get_secret(KIND, SCOPE)
        if not raw:
            return {'provider': 'local', 'profiles': {}}
        return json.loads(raw)


def public():
    value = read()
    return {'provider': value['provider'], 'profiles': {
        key: {'model': profile['model'], 'endpoint': profile['endpoint'], 'has_key': bool(profile.get('key'))}
        for key, profile in value['profiles'].items()
    }}


def validate_endpoint(endpoint):
    try:
        parts = urlsplit(endpoint)
        if (parts.scheme != 'https' or not parts.hostname or parts.username or parts.password
                or parts.query or parts.fragment or parts.port not in (None, 443)
                or not parts.path.endswith('/audio/transcriptions')
                or any(ord(c) < 33 for c in endpoint) or '\\' in endpoint):
            raise ValueError()
        host = parts.hostname
        if host == 'localhost' or host.endswith(('.local', '.localhost', '.internal', '.lan', '.home')):
            raise ValueError()
        try:
            if not ipaddress.ip_address(host).is_global:
                raise ValueError()
        except ValueError:
            if ':' in host or '.' not in host or not re.fullmatch(r'[a-zA-Z0-9.-]+', host):
                raise ValueError()
            # Numeric IPs must not fall through as domain names.
            if re.fullmatch(r'[0-9.]+', host):
                raise ValueError()
        return endpoint
    except Exception:
        raise ValueError('invalid_voice_endpoint') from None


def save(provider, model, endpoint, api_key, consent):
    if provider not in CATALOG:
        raise ValueError('invalid_voice_provider')
    with _lock:
        value = read()
        if provider != 'local':
            if not consent:
                raise ValueError('voice_consent_required')
            if not re.fullmatch(r'[\w./:-]{1,200}', model, flags=re.ASCII):
                raise ValueError('invalid_voice_model')
            endpoint = validate_endpoint(endpoint) if provider == 'compatible' else CATALOG[provider]['endpoint']
            previous = value['profiles'].get(provider, {})
            # Never carry a key to a new custom destination implicitly.
            key = api_key or (previous.get('key') if previous.get('endpoint') == endpoint else None)
            if not key or len(key) > 4096 or any(ord(c) < 33 or ord(c) > 126 for c in key):
                raise ValueError('voice_key_required')
            value['profiles'][provider] = {'model': model, 'endpoint': endpoint, 'key': key}
        value['provider'] = provider
        upsert_secret(KIND, SCOPE, json.dumps(value))
    return public()


def remove(provider):
    if provider not in CATALOG or provider == 'local':
        raise ValueError('invalid_voice_provider')
    with _lock:
        value = read()
        value['profiles'].pop(provider, None)
        if value['provider'] == provider:
            value['provider'] = 'local'
        if not value['profiles']:
            delete_secret(KIND, SCOPE)
        else:
            upsert_secret(KIND, SCOPE, json.dumps(value))
    return public()


class PublicVoiceTransport(httpx.AsyncBaseTransport):
    """Pin each connection to a validated public address, retaining TLS hostname."""
    def __init__(self):
        self.inner = httpx.AsyncHTTPTransport(retries=0)

    async def handle_async_request(self, request):
        host = request.url.host
        addresses = await asyncio.to_thread(socket.getaddrinfo, host, 443, 0, socket.SOCK_STREAM)
        ips = [item[4][0] for item in addresses]
        if not ips or any(not ipaddress.ip_address(ip).is_global for ip in ips):
            raise ValueError('invalid_voice_endpoint')
        request.extensions['sni_hostname'] = host
        request.url = request.url.copy_with(host=ips[0])
        return await self.inner.handle_async_request(request)

    async def aclose(self):
        await self.inner.aclose()


async def audio_wav(raw):
    owner = threading.Event()
    def decode():
        from .stt_sidecar import _decode_audio_bounded, SttModelBusyError
        if not _decode_slot.acquire(blocking=False):
            raise SttModelBusyError('Voice decoding is busy')
        try:
            pcm = _decode_audio_bounded(raw, owner, max_seconds=300)
            buffer = io.BytesIO()
            with wave.open(buffer, 'wb') as output:
                output.setnchannels(1)
                output.setsampwidth(2)
                output.setframerate(16000)
                output.writeframes((pcm * 32768).clip(-32768, 32767).astype('<i2').tobytes())
            return buffer.getvalue()
        finally:
            _decode_slot.release()
    try:
        return await asyncio.to_thread(decode)
    except asyncio.CancelledError:
        owner.set()
        raise


async def transcribe(raw, snapshot=None, check=None):
    value = snapshot or read()
    provider = value['provider']
    if provider == 'local' or provider not in value['profiles']:
        raise ValueError('voice_not_ready')
    if not raw or len(raw) > 20 * 1024 * 1024:
        raise ValueError('audio_too_large')
    profile = value['profiles'][provider]
    encoded = await audio_wav(raw)
    # Configuration could be removed or changed while decoding.
    if read() != value:
        raise ValueError('voice_not_ready')
    if check is not None:
        check()
    fields = {'model_id': profile['model'], 'tag_audio_events': 'false', 'diarize': 'false'} if provider == 'elevenlabs' else {'model': profile['model'], 'response_format': 'json'}
    headers = {'xi-api-key': profile['key']} if provider == 'elevenlabs' else {'Authorization': 'Bearer ' + profile['key']}
    async with httpx.AsyncClient(transport=PublicVoiceTransport(), timeout=120, follow_redirects=False, trust_env=False) as client:
        async with client.stream('POST', profile['endpoint'], headers=headers, data=fields,
                                 files={'file': ('audio.wav', encoded, 'audio/wav')}) as response:
            if response.status_code in (401, 403):
                # Inspect only a bounded machine code; never surface provider text.
                error_body = bytearray()
                async for block in response.aiter_bytes():
                    error_body.extend(block)
                    if len(error_body) > 65536:
                        break
                try:
                    detail = json.loads(error_body).get('detail', {}) if len(error_body) <= 65536 else {}
                    permission_missing = isinstance(detail, dict) and detail.get('status') == 'missing_permissions'
                except (ValueError, AttributeError):
                    permission_missing = False
                raise ValueError('voice_permission_missing' if permission_missing else 'voice_auth_failed')
            if response.status_code == 429:
                raise ValueError('voice_rate_limited')
            if response.status_code in (400, 404, 422):
                raise ValueError('voice_model_failed')
            if response.status_code == 413:
                raise ValueError('audio_too_large')
            if response.status_code != 200:
                raise ValueError('audio_unavailable')
            body = bytearray()
            async for block in response.aiter_bytes():
                body.extend(block)
                if len(body) > 1024 * 1024:
                    raise ValueError('audio_unavailable')
    if read() != value:
        raise ValueError('voice_not_ready')
    result = json.loads(body)
    text = result.get('text') if isinstance(result, dict) else None
    if not isinstance(text, str) or not text.strip() or len(text) > 16000:
        raise ValueError('audio_empty')
    return {'text': text.strip()}
