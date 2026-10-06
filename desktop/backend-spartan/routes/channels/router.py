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
    allowed_user_ids: list[str] = Field(min_length=1, max_length=20)


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
            except Exception:
                repo.delete_account(account['id'], credential[0])
                raise
    except sqlite3.IntegrityError:
        raise HTTPException(409, 'bot_already_configured') from None
    return account


@router.patch('/{account_id}')
async def enable(account_id: str, body: EnabledInput, credential=Depends(ui_credential)):
    if not repo.get_account(account_id, credential[0]):
        raise HTTPException(404, 'account_not_found')
    # Cancel old worker before reconnecting; never start a second poll consumer.
    async with runtime.control_lock:
        await runtime.stop(account_id)
        with current_credential_write(credential):
            repo.set_enabled(account_id, credential[0], body.enabled)
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
