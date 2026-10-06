"""Application-lifetime workers; one long-poll consumer per saved bot."""
import asyncio
import time

from storage.channels import repository as repo
from storage.credential_secrets import get_secret
from .catalog import COMMANDS, command_reply
from .executor import respond
from .policy import normalize_private_message
from .telegram import Telegram, TelegramError

TOKEN_KIND = 'channel_bot_token'
states: dict[str, str] = {}
workers: dict[str, asyncio.Task] = {}
control_lock = asyncio.Lock()


async def stop(account_id: str):
    task = workers.pop(account_id, None)
    if task:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
    states[account_id] = 'paused'


async def _worker(account):
    account_id = account['id']
    token = get_secret(TOKEN_KIND, account_id)
    if not token:
        states[account_id] = 'credentials_error'
        return
    transport = Telegram(token)
    last_request: dict[str, float] = {}
    try:
        repo.recover(account_id)
        await transport.call('setMyCommands', commands=[{'command': name, 'description': description} for name, description in COMMANDS[account['locale']]])
        await transport.call('setMyCommands', language_code=account['locale'], commands=[{'command': name, 'description': description} for name, description in COMMANDS[account['locale']]])
        while True:
            try:
                states[account_id] = 'connected'
                pending = repo.claim(account_id)
                if not pending:
                    updates = await transport.call('getUpdates', offset=repo.offset(account_id), timeout=25, limit=20, allowed_updates=['message'])
                    repo.ingest(account_id, updates, lambda update: normalize_private_message(update, account['allowed_user_ids']))
                    continue
                update_id, message = pending
                try:
                    if time.monotonic() - last_request.get(message['user_id'], -100) < 3:
                        output = 'Espera unos segundos antes de enviar otra solicitud.' if account['locale'] == 'es' else 'Wait a few seconds before sending another request.'
                    elif message['media']:
                        output = 'Audios y documentos todavía no están habilitados en este canal. Envía texto por ahora.' if account['locale'] == 'es' else 'Audio and documents are not enabled for this channel yet. Send text for now.'
                    else:
                        last_request[message['user_id']] = time.monotonic()
                        output = command_reply(message['text'], account)
                        if output is None:
                            if repo.reserve_provider_request(account_id):
                                output = await respond(account, message['text'])
                            else:
                                output = 'Se alcanzó el límite de 30 consultas por hora. Intenta más tarde.' if account['locale'] == 'es' else 'The 30 requests per hour limit has been reached. Try again later.'
                    await transport.send(message['chat_id'], output)
                    repo.finish(account_id, update_id, 'completed')
                    repo.event(account_id, 'reply_sent')
                except asyncio.CancelledError:
                    repo.finish(account_id, update_id, 'failed')
                    raise
                except Exception:
                    repo.finish(account_id, update_id, 'failed')
                    repo.event(account_id, 'reply_failed')
            except TelegramError as error:
                states[account_id] = error.code
                repo.event(account_id, error.code)
                if error.code in ('credentials_error', 'consumer_conflict'):
                    return
                await asyncio.sleep(error.retry_after)
    except TelegramError as error:
        states[account_id] = error.code
        repo.event(account_id, error.code)
    except asyncio.CancelledError:
        raise
    except Exception:
        states[account_id] = 'transport_error'
        repo.event(account_id, 'transport_error')
    finally:
        await transport.close()


async def run():
    try:
        while True:
            try:
                async with control_lock:
                    enabled = {a['id']: a for a in repo.accounts() if a['enabled']}
                    for account_id in list(workers):
                        if account_id not in enabled:
                            await stop(account_id)
                    for account_id, account in enabled.items():
                        if account_id not in workers:
                            states[account_id] = 'connecting'
                            workers[account_id] = asyncio.create_task(_worker(account))
                        elif workers[account_id].done() and not workers[account_id].cancelled():
                            if workers[account_id].exception():
                                states[account_id] = 'transport_error'
            except Exception:
                await asyncio.sleep(5)
                continue
            await asyncio.sleep(2)
    finally:
        await asyncio.gather(*(stop(account_id) for account_id in list(workers)))
