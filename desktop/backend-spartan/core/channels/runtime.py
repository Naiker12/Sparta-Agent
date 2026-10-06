"""Application-lifetime workers; one long-poll consumer per saved bot."""
import asyncio
import time

from storage.channels import repository as repo
from storage.channels import history
from storage.channels import pairing
from storage.channels import usage, work
from storage.credential_secrets import get_secret
from .catalog import COMMANDS, command_reply
from .executor import respond
from .requests import RequestCancelled, command, receive, respond_with_progress
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
    repo.recover(account_id)
    work.recover(account_id)
    token = get_secret(TOKEN_KIND, account_id)
    if not token:
        states[account_id] = 'credentials_error'
        repo.event(account_id, 'credentials_error')
        return
    transport = Telegram(token)
    last_request: dict[str, float] = {}
    try:
        await transport.call('setMyCommands', commands=[{'command': name, 'description': description} for name, description in COMMANDS[account['locale']]])
        await transport.call('setMyCommands', language_code=account['locale'], commands=[{'command': name, 'description': description} for name, description in COMMANDS[account['locale']]])
        while True:
            try:
                account = repo.get_account(account_id)
                if not account:
                    return
                # Paused discovery listens only for a valid single-use link.
                # It cannot execute a provider or accept ordinary messages.
                connection_changed = account['enabled'] and states.get(account_id) != 'connected'
                states[account_id] = 'connected' if account['enabled'] else 'paused'
                pending = repo.claim(account_id) if account['enabled'] else None
                if not pending:
                    await receive(transport, account_id)
                    if connection_changed:
                        repo.event(account_id, 'connected')
                    continue
                update_id, message = pending
                run_id = None
                generation_complete = False
                if message['user_id'] not in account['allowed_user_ids']:
                    repo.finish(account_id, update_id, 'failed')
                    continue
                try:
                    conversation_reply = False
                    if command(message['text']) == '/cancel':
                        output = 'No tienes una consulta en curso para cancelar.' if account['locale'] == 'es' else 'You have no active request to cancel.'
                    elif command(message['text']) == '/reset':
                        history.reset(account_id, message['user_id'])
                        repo.event(account_id, 'context_reset')
                        output = 'Conversación reiniciada. El contexto de este chat se ha borrado.' if account['locale'] == 'es' else 'Conversation reset. The context for this chat has been cleared.'
                    elif command(message['text']) == '/usage' and not message['media']:
                        # A local status read remains usable immediately after a reply.
                        output = command_reply(message['text'], account, user_id=message['user_id'])
                    elif time.monotonic() - last_request.get(message['user_id'], -100) < 3:
                        output = 'Espera unos segundos antes de enviar otra solicitud.' if account['locale'] == 'es' else 'Wait a few seconds before sending another request.'
                    elif message['media']:
                        output = 'Audios y documentos todavía no están habilitados en este canal. Envía texto por ahora.' if account['locale'] == 'es' else 'Audio and documents are not enabled for this channel yet. Send text for now.'
                    else:
                        last_request[message['user_id']] = time.monotonic()
                        output = command_reply(message['text'], account, user_id=message['user_id'])
                        if output is None:
                            if repo.reserve_provider_request(account_id):
                                run_id = work.start(account_id, update_id, message)
                                usage.start(account, update_id, message['user_id'])
                                repo.event(account_id, 'request_started')
                                try:
                                    output = await respond_with_progress(transport, account, update_id, message,
                                        lambda: respond(account, message['text'], history=history.messages(account_id, message['user_id']),
                                            on_usage=lambda value: usage.record(account_id, update_id, value)))
                                    usage.finish(account_id, update_id, 'completed')
                                    generation_complete = True
                                    conversation_reply = True
                                except RequestCancelled:
                                    usage.finish(account_id, update_id, 'cancelled')
                                    work.finish(run_id, 'cancelled', reason='sender_cancelled')
                                    repo.event(account_id, 'request_cancelled')
                                    output = 'Consulta cancelada. No se ha añadido al contexto de la conversación.' if account['locale'] == 'es' else 'Request cancelled. It was not added to the conversation context.'
                            else:
                                output = 'Se alcanzó el límite de 30 consultas por hora. Intenta más tarde.' if account['locale'] == 'es' else 'The 30 requests per hour limit has been reached. Try again later.'
                    current = repo.get_account(account_id)
                    if not current or not current['enabled'] or message['user_id'] not in current['allowed_user_ids']:
                        repo.finish(account_id, update_id, 'failed')
                        if run_id:
                            work.finish(run_id, 'failed', reason='access_revoked')
                        continue
                    await transport.send(message['chat_id'], output)
                    if connection_changed:
                        repo.event(account_id, 'connected')
                    if conversation_reply:
                        history.complete(account_id, update_id, message, output)
                    else:
                        repo.finish(account_id, update_id, 'completed')
                    repo.event(account_id, 'reply_sent')
                    if run_id and conversation_reply:
                        work.finish(run_id, 'completed', summary=output)
                except asyncio.CancelledError:
                    repo.finish(account_id, update_id, 'failed')
                    if run_id:
                        if not generation_complete:
                            usage.finish(account_id, update_id, 'failed')
                        work.finish(run_id, 'needs_review', reason='worker_interrupted')
                    raise
                except TelegramError:
                    repo.finish(account_id, update_id, 'failed')
                    if run_id:
                        if not generation_complete:
                            usage.finish(account_id, update_id, 'failed')
                        work.finish(run_id, 'needs_review' if generation_complete else 'failed', reason='delivery_unconfirmed' if generation_complete else 'transport_error')
                    repo.event(account_id, 'reply_failed')
                    # Apply the same transport backoff to sending and polling.
                    # An ambiguous reply is not replayed after the wait.
                    raise
                except Exception:
                    repo.finish(account_id, update_id, 'failed')
                    if run_id:
                        if not generation_complete:
                            usage.finish(account_id, update_id, 'failed')
                        work.finish(run_id, 'needs_review' if generation_complete else 'failed', reason='delivery_unconfirmed' if generation_complete else 'request_failed')
                    repo.event(account_id, 'reply_failed')
                    if run_id and not generation_complete:
                        current = repo.get_account(account_id)
                        if current and current['enabled'] and message['user_id'] in current['allowed_user_ids']:
                            notice = ('No pude completar la consulta. Revisa el proveedor en Spartan. Para buscar en internet sin herramientas del modelo, usa /search seguido del tema.' if account['locale'] == 'es' else 'I could not complete the request. Check the provider in Spartan. To search without model tool support, use /search followed by the topic.')
                            try:
                                await transport.send(message['chat_id'], notice)
                            except TelegramError:
                                raise
                            except Exception:
                                pass
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
    last_cleanup = -60.0
    try:
        while True:
            try:
                if time.monotonic() - last_cleanup >= 60:
                    pairing.expire()
                    last_cleanup = time.monotonic()
                async with control_lock:
                    enabled = {a['id']: a for a in repo.accounts() if a['enabled'] or pairing.active(a['id'])}
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
