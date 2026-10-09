"""UI-only control plane. Bot messages cannot access these endpoints."""
import sqlite3
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field

from auth.authentication import authenticated_via_api_key, get_current_credential
from routes.provider_credentials import current_credential_write, require_ui_session
from storage.channels import repository as repo
from storage.channels import pairing
from storage.channels import usage
from storage.credential_secrets import delete_secret, upsert_secret
from core.channels import runtime, voice
from core.channels.catalog import inventory
from core.channels.permissions import project_context_allowed
from core.channels.telegram import Telegram, TelegramError

# Keep prior channel voice URLs as aliases; new consumers use /api/voice.
from routes.voice.router import router as shared_voice_router, ui_credential, SafeValidationRoute

router = APIRouter(route_class=SafeValidationRoute)
router.include_router(shared_voice_router, prefix='/voice', include_in_schema=False)


class AccountInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    name: str = Field(min_length=1, max_length=80)
    token: str = Field(min_length=20, max_length=200, pattern=r'^\d{5,20}:[A-Za-z0-9_-]{20,180}$', repr=False)
    provider_id: str = Field(min_length=1, max_length=200)
    model: str = Field(min_length=1, max_length=300)
    locale: Literal['es', 'en'] = 'es'
    allowed_user_ids: list[str] = Field(default_factory=list, max_length=20)


class EnabledInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    enabled: bool


class ProjectGrantInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    user_id: str = Field(min_length=1, max_length=20)
    project_ids: list[str] = Field(max_length=100)
    mode: Literal['selected', 'all'] = 'selected'
    context: bool | None = None


@router.get('/{account_id}/projects')
def project_options(account_id: str, credential=Depends(ui_credential)):
    account = repo.get_account(account_id, credential[0])
    if not account:
        raise HTTPException(404, 'account_not_found')
    from storage.studio.chat_projects import list_chat_projects
    return {'projects': [{'id': p['id'], 'name': p['name']} for p in list_chat_projects()],
            'grants': account.get('project_grants', {}),
            'access': account.get('project_access', {}),
            'context': {user: project_context_allowed(account, user) for user in account['allowed_user_ids']}}


@router.put('/{account_id}/projects')
async def project_grants(account_id: str, body: ProjectGrantInput, credential=Depends(ui_credential)):
    from storage.channels.projects import grant
    try:
        async with runtime.control_lock:
            with current_credential_write(credential):
                grant(account_id, credential[0], body.user_id, body.project_ids, mode=body.mode, context=body.context)
                repo.event(account_id, 'project_access_updated')
            await runtime.stop(account_id)
    except ValueError as error:
        raise HTTPException(404 if str(error) == 'account_not_found' else 422, str(error)) from None
    return {'ok': True}


@router.get('')
def overview(credential=Depends(ui_credential)):
    return {'accounts': [{**a, 'status': runtime.states.get(a['id'], 'connecting' if a['enabled'] else 'paused'), 'usage': usage.summary(a['id'])} for a in repo.accounts(credential[0])], 'inventory': inventory(), 'events': repo.events(credential[0]), 'voice': voice.active_status()}


@router.patch('/{account_id}/voice')
def set_voice(account_id: str, body: EnabledInput, credential=Depends(ui_credential)):
    if not repo.get_account(account_id, credential[0]):
        raise HTTPException(404, 'account_not_found')
    if body.enabled and not voice.active_status()['ready']:
        raise HTTPException(409, 'voice_not_ready')
    with current_credential_write(credential):
        if not repo.set_voice_enabled(account_id, credential[0], body.enabled):
            raise HTTPException(404, 'account_not_found')
        repo.event(account_id, 'voice_enabled' if body.enabled else 'voice_disabled')
    return {'ok': True}


@router.post('/{account_id}/voice/prepare')
def prepare_voice(account_id: str, credential=Depends(ui_credential)):
    if not repo.get_account(account_id, credential[0]):
        raise HTTPException(404, 'account_not_found')
    try:
        with current_credential_write(credential):
            result = voice.prepare()
            repo.event(account_id, 'voice_preparation_requested')
        return result
    except voice.VoiceError as error:
        raise HTTPException(409, error.code) from None


@router.post('')
async def create(body: AccountInput, credential=Depends(ui_credential)):
    ids = sorted(set(body.allowed_user_ids))
    if any(not value.isascii() or not value.isdecimal() or not 0 < int(value) < 2**53 for value in ids):
        raise HTTPException(422, 'invalid_user_ids')
    from core.inference.task_scheduler import make_client
    from storage.providers_db import get_provider
    try:
        make_client(body.provider_id, body.model)
    except Exception:
        raise HTTPException(422, 'invalid_provider') from None
    transport = Telegram(body.token)
    try:
        bot = await transport.call('getMe')
        webhook = await transport.call('getWebhookInfo')
        if webhook.get('url'):
            raise HTTPException(409, 'webhook_conflict')
    except TelegramError as error:
        raise HTTPException(422, error.code) from None
    finally:
        await transport.close()
    config = body.model_dump(exclude={'token'})
    config.update(allowed_user_ids=ids, platform='telegram', bot_username=bot.get('username', ''), provider_name=get_provider(body.provider_id)['display_name'])
    try:
        with current_credential_write(credential):
            account = repo.create_account(credential[0], str(bot['id']), config)
            try:
                upsert_secret(runtime.TOKEN_KIND, account['id'], body.token)
                repo.event(account['id'], 'connection_saved')
            except Exception:
                repo.delete_account(account['id'], credential[0])
                raise
    except sqlite3.IntegrityError:
        raise HTTPException(409, 'bot_already_configured') from None
    return account


@router.patch('/{account_id}')
async def enable(account_id: str, body: EnabledInput, credential=Depends(ui_credential)):
    account = repo.get_account(account_id, credential[0])
    if not account:
        raise HTTPException(404, 'account_not_found')
    if body.enabled and not account['allowed_user_ids']:
        raise HTTPException(422, 'authorized_user_required')
    # Cancel old worker before reconnecting; never start a second poll consumer.
    async with runtime.control_lock:
        await runtime.stop(account_id)
        with current_credential_write(credential):
            repo.set_enabled(account_id, credential[0], body.enabled)
            repo.event(account_id, 'connection_requested' if body.enabled else 'connection_paused')
        if body.enabled:
            runtime.states[account_id] = 'connecting'
    return {'ok': True}


@router.post('/{account_id}/pairings')
async def start_pairing(account_id: str, credential=Depends(ui_credential)):
    try:
        async with runtime.control_lock:
            with current_credential_write(credential):
                result = pairing.create(account_id, credential[0])
                repo.event(account_id, 'pairing_started')
            worker = runtime.workers.get(account_id)
            if worker and worker.done():
                await runtime.stop(account_id)
            return result
    except ValueError as error:
        raise HTTPException(404 if str(error) == 'account_not_found' else 422, str(error)) from None


@router.get('/{account_id}/pairings/{session_id}')
def pairing_status(account_id: str, session_id: str, credential=Depends(ui_credential)):
    result = pairing.get(account_id, session_id, credential[0])
    if not result:
        raise HTTPException(404, 'pairing_not_found')
    return {**result, 'transport_status': runtime.states.get(account_id, 'connecting')}


class PairingApprovalInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    purpose: Literal['self', 'guest'] = 'guest'


@router.post('/{account_id}/pairings/{session_id}/approve')
async def approve_pairing(account_id: str, session_id: str, body: PairingApprovalInput | None = None, credential=Depends(ui_credential)):
    if not repo.get_account(account_id, credential[0]):
        raise HTTPException(404, 'account_not_found')
    async with runtime.control_lock:
        try:
            with current_credential_write(credential):
                result = pairing.approve(account_id, session_id, credential[0], purpose=body.purpose if body else 'guest')
                repo.event(account_id, 'pairing_approved')
        except ValueError as error:
            raise HTTPException(409, str(error)) from None
        await runtime.stop(account_id)
        runtime.states[account_id] = 'connecting'
    return result


@router.delete('/{account_id}/pairings/{session_id}')
async def cancel_pairing(account_id: str, session_id: str, credential=Depends(ui_credential)):
    with current_credential_write(credential):
        if not pairing.cancel(account_id, session_id, credential[0]):
            raise HTTPException(404, 'pairing_not_found')
        repo.event(account_id, 'pairing_cancelled')
    return {'ok': True}


@router.delete('/{account_id}')
async def remove(account_id: str, credential=Depends(ui_credential)):
    if not repo.get_account(account_id, credential[0]):
        raise HTTPException(404, 'account_not_found')
    async with runtime.control_lock:
        await runtime.stop(account_id)
        with current_credential_write(credential):
            repo.delete_account(account_id, credential[0])
            delete_secret(runtime.TOKEN_KIND, account_id)
    runtime.states.pop(account_id, None)
    return {'ok': True}


@router.delete('/{account_id}/users/{user_id}')
async def revoke_user(account_id: str, user_id: str, credential=Depends(ui_credential)):
    async with runtime.control_lock:
        try:
            with current_credential_write(credential):
                repo.revoke_user(account_id, credential[0], user_id)
                from core.channels.controls import revoke_user as revoke_controls
                revoke_controls(account_id, user_id)
                repo.event(account_id, 'user_access_revoked')
        except ValueError as error:
            raise HTTPException(404 if str(error) == 'account_not_found' else 422, str(error)) from None
        await runtime.stop(account_id)
    return {'ok': True}


class ProfileBindingInput(BaseModel):
    model_config = ConfigDict(extra='forbid')
    user_id: str | None = Field(default=None, max_length=20)


@router.put('/{account_id}/profile-binding')
async def bind_profile(account_id: str, body: ProfileBindingInput, credential=Depends(ui_credential)):
    from core.channels.profile import bind
    async with runtime.control_lock:
        try:
            with current_credential_write(credential):
                bind(account_id, credential[0], body.user_id)
        except ValueError as error:
            raise HTTPException(404 if str(error) == 'account_not_found' else 422, str(error)) from None
        await runtime.stop(account_id)
    return {'ok': True}
