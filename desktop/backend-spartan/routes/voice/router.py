"""UI-only installation voice controls, shared by current and future consumers."""
import logging
import socket
from typing import Literal
from fastapi import APIRouter, Depends, HTTPException, File, UploadFile
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from pydantic import BaseModel, ConfigDict, Field
from auth.authentication import authenticated_via_api_key, get_current_credential
from routes.provider_credentials import current_credential_write, require_ui_session
from core.inference import voice_state as voice

class SafeValidationRoute(APIRoute):
    def get_route_handler(self):
        original = super().get_route_handler()
        async def handler(request):
            try:
                return await original(request)
            except RequestValidationError:
                # FastAPI's default validation response includes the invalid input.
                # This control plane accepts secrets; never echo request values.
                raise HTTPException(422, 'invalid_configuration') from None
        return handler


router = APIRouter(route_class=SafeValidationRoute)


async def ui_credential(credential=Depends(get_current_credential), via_api_key=Depends(authenticated_via_api_key)):
    require_ui_session(via_api_key)
    return credential


@router.get('/status')
def voice_status(credential=Depends(ui_credential)):
    return voice.status()


@router.post('/prepare')
def voice_prepare(credential=Depends(ui_credential)):
    try:
        with current_credential_write(credential):
            return voice.prepare()
    except ValueError:
        raise HTTPException(409, 'voice_busy') from None


class VoiceConfigurationInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    provider: Literal['local', 'elevenlabs', 'groq', 'compatible']
    model: str = Field(default='', max_length=200)
    endpoint: str = Field(default='', max_length=1500)
    api_key: str = Field(default='', max_length=4096, repr=False)
    consent: bool = False


@router.get('/configuration')
def voice_configuration(credential=Depends(ui_credential)):
    from core.inference import voice_providers
    return voice_providers.public()


@router.put('/configuration')
def save_voice_configuration(body: VoiceConfigurationInput, credential=Depends(ui_credential)):
    from core.inference import voice_providers
    try:
        with current_credential_write(credential):
            return voice_providers.save(body.provider, body.model, body.endpoint, body.api_key, body.consent)
    except ValueError as error:
        code = str(error)
        safe = code if code in ('voice_key_required', 'invalid_voice_endpoint', 'invalid_voice_model', 'voice_consent_required') else 'invalid_voice_configuration'
        raise HTTPException(422, safe) from None


@router.delete('/configuration/{provider}')
def remove_voice_configuration(provider: str, credential=Depends(ui_credential)):
    from core.inference import voice_providers
    try:
        with current_credential_write(credential):
            return voice_providers.remove(provider)
    except ValueError:
        raise HTTPException(422, 'invalid_voice_configuration') from None


@router.post('/test')
async def test_voice_configuration(file: UploadFile = File(...), credential=Depends(ui_credential)):
    from core.inference import voice_providers
    with current_credential_write(credential):
        config = voice_providers.read()
    raw = await file.read(voice.MAX_BYTES + 1)
    await file.close()
    if not raw or len(raw) > voice.MAX_BYTES:
        raise HTTPException(413, 'audio_too_large')
    if config['provider'] == 'local':
        raise HTTPException(422, 'select_remote_voice')
    def check_current_credential():
        with current_credential_write(credential):
            pass
    try:
        result = await voice_providers.transcribe(raw, config, check_current_credential)
        return {'text': result['text']}
    except HTTPException:
        raise
    except Exception as error:
        import httpx
        from core.inference.stt_sidecar import SttAudioTooLongError, SttAudioDecodeError, SttUnavailableError
        if isinstance(error, SttUnavailableError):
            raise HTTPException(503, 'voice_decoder_unavailable') from None
        if isinstance(error, (httpx.NetworkError, socket.gaierror)):
            raise HTTPException(502, 'voice_network_failed') from None
        if isinstance(error, httpx.TimeoutException):
            raise HTTPException(504, 'voice_timeout') from None
        if isinstance(error, SttAudioTooLongError):
            raise HTTPException(422, 'audio_too_long') from None
        if isinstance(error, SttAudioDecodeError):
            raise HTTPException(422, 'audio_invalid') from None
        if isinstance(error, ValueError) and str(error) in ('voice_auth_failed', 'voice_permission_missing', 'voice_rate_limited', 'voice_model_failed', 'audio_empty', 'audio_too_large', 'voice_not_ready', 'audio_unavailable'):
            raise HTTPException(502, str(error)) from None
        logging.getLogger(__name__).warning('Voice test failed (%s)', type(error).__name__)
        # Never expose a provider response, URL, or credentials.
        raise HTTPException(502, 'voice_test_failed') from None


