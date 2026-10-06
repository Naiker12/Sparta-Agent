"""UI-only control plane. Bot messages cannot access these endpoints."""
import sqlite3
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from fastapi.exceptions import RequestValidationError
from fastapi.routing import APIRoute
from pydantic import BaseModel, ConfigDict, Field

from auth.authentication import authenticated_via_api_key, get_current_credential
from routes.provider_credentials import current_credential_write, require_ui_session
from storage.channels import repository as repo
from storage.channels import pairing
from storage.credential_secrets import delete_secret, upsert_secret
from core.channels import runtime
from core.channels.catalog import inventory
from core.channels.telegram import Telegram, TelegramError

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


@router.get('')
def overview(credential=Depends(ui_credential)):
    return {'accounts': [{**a, 'status': runtime.states.get(a['id'], 'connecting' if a['enabled'] else 'paused')} for a in repo.accounts(credential[0])], 'inventory': inventory(), 'events': repo.events(credential[0])}


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


@router.post('/{account_id}/pairings/{session_id}/approve')
async def approve_pairing(account_id: str, session_id: str, credential=Depends(ui_credential)):
    if not repo.get_account(account_id, credential[0]):
        raise HTTPException(404, 'account_not_found')
    async with runtime.control_lock:
        try:
            with current_credential_write(credential):
                result = pairing.approve(account_id, session_id, credential[0])
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
