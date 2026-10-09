"""Authorized voice input using the shared local Whisper service."""
import asyncio
import re
import socket
import httpx

from storage.channels import repository as repo
from .delivery import check_access
from .telegram import TelegramError

MODEL = 'base'
MAX_BYTES = 20 * 1024 * 1024
MAX_SECONDS = 300


class VoiceError(Exception):
    def __init__(self, code):
        super().__init__(code)
        self.code = code


def status():
    from core.inference.voice_state import status as local_status
    return local_status()


def prepare():
    from core.inference.voice_state import prepare as local_prepare
    try:
        return local_prepare(status)
    except ValueError:
        raise VoiceError('voice_busy') from None


def active_status():
    from core.inference.voice_state import active_status as configured_status
    return configured_status(status)


def validate(message):
    value = message.get('audio')
    if not isinstance(value, dict) or not isinstance(value.get('file_id'), str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,512}', value['file_id']):
        raise VoiceError('audio_invalid')
    duration, size = value.get('duration'), value.get('file_size')
    if type(duration) is not int or duration < 0:
        raise VoiceError('audio_invalid')
    if duration > MAX_SECONDS:
        raise VoiceError('audio_too_long')
    if size is not None and (type(size) is not int or size <= 0 or size > MAX_BYTES):
        raise VoiceError('audio_too_large')
    return value['file_id']


def check_voice_access(account, message):
    check_access(account['id'], message['user_id'])
    current = repo.get_account(account['id'])
    if not current.get('voice_enabled'):
        raise VoiceError('voice_disabled')


async def transcribe(transport, account, message):
    check_voice_access(account, message)
    file_id = validate(message)
    from core.inference import voice_providers
    config = await asyncio.to_thread(voice_providers.read)
    prepared = await asyncio.to_thread(status) if config['provider'] == 'local' else active_status()
    if not prepared['ready']:
        raise VoiceError('voice_not_ready')
    check_voice_access(account, message)
    repo.event(account['id'], 'audio_transcription_started')
    try:
        raw = await transport.download_audio(file_id, max_bytes=MAX_BYTES)
        check_voice_access(account, message)
        from core.inference.stt_service import transcribe_local
        async with asyncio.timeout(360):
            result = (await transcribe_local(raw, MODEL, None, True, prepared['engine'], max_audio_seconds=MAX_SECONDS)
                      if config['provider'] == 'local' else await voice_providers.transcribe(raw, config, lambda: check_voice_access(account, message)))
        check_voice_access(account, message)
        text = result.get('text')
        if not isinstance(text, str) or not text.strip():
            raise VoiceError('audio_empty')
        if len(text) > 16000:
            raise VoiceError('audio_too_long')
        repo.event(account['id'], 'audio_transcription_completed')
        return text.strip()
    except asyncio.CancelledError:
        raise
    except (VoiceError, TelegramError):
        raise
    except (TimeoutError, httpx.TimeoutException):
        raise VoiceError('voice_timeout') from None
    except (httpx.NetworkError, socket.gaierror):
        raise VoiceError('voice_network_failed') from None
    except Exception as error:
        if isinstance(error, ValueError) and str(error) in ('voice_not_ready', 'voice_auth_failed', 'voice_permission_missing', 'voice_rate_limited', 'voice_model_failed', 'audio_empty', 'audio_too_large'):
            raise VoiceError(str(error)) from None
        from core.inference.stt_sidecar import SttAudioDecodeError, SttAudioTooLongError, SttModelBusyError, SttModelNotDownloadedError, SttUnavailableError
        if isinstance(error, SttAudioDecodeError):
            raise VoiceError('audio_invalid') from None
        if isinstance(error, (SttModelNotDownloadedError, SttUnavailableError)):
            raise VoiceError('voice_not_ready') from None
        if isinstance(error, SttAudioTooLongError):
            raise VoiceError('audio_too_long') from None
        if isinstance(error, SttModelBusyError):
            raise VoiceError('voice_busy') from None
        raise VoiceError('audio_unavailable') from None


def notice(code, locale):
    messages = {
        'voice_disabled': ('Activa la entrada de voz en esta conexión desde Spartan.', 'Enable voice input for this connection in Spartan.'),
        'voice_not_ready': ('Revisa el proveedor de transcripción en Ajustes → Voz de Spartan.', 'Check the transcription provider in Spartan Settings → Voice.'),
        'voice_permission_missing': ('La clave no tiene permiso de transcripción. Activa Speech to Text en ElevenLabs para la clave guardada.', 'The key lacks transcription permission. Enable Speech to Text in ElevenLabs for the saved key.'),
        'voice_auth_failed': ('Revisa la clave y los permisos del proveedor en Ajustes → Voz.', 'Check the provider key and permissions in Settings → Voice.'),
        'voice_rate_limited': ('El proveedor de voz alcanzó su límite. Intenta más tarde.', 'The voice provider reached its limit. Try again later.'),
        'voice_model_failed': ('El proveedor rechazó el modelo de transcripción. Revísalo en Ajustes → Voz y vuelve a enviar el audio.', 'The provider rejected the transcription model. Check it in Settings → Voice and resend the audio.'),
        'voice_timeout': ('La transcripción tardó demasiado. Puedes enviar una nota más corta o intentarlo de nuevo.', 'Transcription took too long. Send a shorter voice note or try again.'),
        'voice_network_failed': ('No pude conectar con el proveedor de voz. Revisa internet y vuelve a enviar el audio.', 'Could not connect to the voice provider. Check your internet connection and resend the audio.'),
        'voice_busy': ('El reconocimiento de voz local está ocupado. Intenta más tarde.', 'Local speech recognition is busy. Try again later.'),
        'audio_invalid': ('No pude reconocer este audio. Envía una nota de voz válida.', 'I could not recognize this audio. Send a valid voice note.'),
        'audio_too_long': ('El audio debe durar como máximo cinco minutos.', 'Audio must be no longer than five minutes.'),
        'audio_too_large': ('El audio debe ocupar como máximo 20 MB.', 'Audio must be no larger than 20 MB.'),
        'audio_empty': ('No reconocí palabras en el audio. Puedes volver a grabarlo o enviar texto.', 'I did not recognize words in the audio. You can record again or send text.'),
        'audio_unavailable': ('No pude transcribir el audio. Revisa Voz en Spartan o envía texto.', 'I could not transcribe the audio. Check Voice in Spartan or send text.'),
    }
    return messages.get(code, messages['audio_unavailable'])[0 if locale == 'es' else 1]
