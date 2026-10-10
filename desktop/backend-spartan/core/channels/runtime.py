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
from .delivery import DeliveryRevoked, deliver
from .images import ChannelReply
from . import voice, documents, profile, controls, project_context
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
                    from . import automation_plans
                    schedule_result = automation_plans.resolve(account, message) if not message['media'] else None
                    requested_name = profile.name_request(account_id, message['user_id'], message['text']) if not message['media'] else None
                    if schedule_result is not None:
                        output = schedule_result
                    elif requested_name:
                        if profile.change_name(account_id, message['user_id'], requested_name):
                            run_id = work.start(account_id, update_id, message)
                            work.set_stage(run_id, account_id, 'updating_profile')
                            work.finish(run_id, 'completed', summary='Profile name updated')
                            repo.event(account_id, 'profile_updated')
                            output = ('Tu nombre en Spartan ahora es ' if account['locale'] == 'es' else 'Your Spartan name is now ') + requested_name + '.'
                        else:
                            output = profile.setup_reply(account, message['user_id'])
                    elif command(message['text']) == '/cancel' and not message['media']:
                        output = 'No tienes una consulta en curso para cancelar.' if account['locale'] == 'es' else 'You have no active request to cancel.'
                    elif command(message['text']) == '/reset' and not message['media']:
                        history.reset(account_id, message['user_id'])
                        repo.event(account_id, 'context_reset')
                        output = 'Conversación reiniciada. El contexto de este chat se ha borrado.' if account['locale'] == 'es' else 'Conversation reset. The context for this chat has been cleared.'
                    elif command(message['text']) in ('/usage', '/projects', '/project') and not message['media']:
                        # A local status read remains usable immediately after a reply.
                        output = command_reply(message['text'], account, user_id=message['user_id'], buttons=True)
                    elif time.monotonic() - last_request.get(message['user_id'], -100) < 3:
                        output = 'Espera unos segundos antes de enviar otra solicitud.' if account['locale'] == 'es' else 'Wait a few seconds before sending another request.'
                    elif message['media'] == 'document' and not message.get('document'):
                        output = documents.notice('document_unsupported', account['locale'])
                    elif message['media'] in ('voice', 'audio') and not account.get('voice_enabled'):
                        output = voice.notice('voice_disabled', account['locale'])
                    else:
                        last_request[message['user_id']] = time.monotonic()
                        output = None if message['media'] else command_reply(message['text'], account, user_id=message['user_id'])
                        if output is None:
                            if repo.reserve_provider_request(account_id):
                                run_id = work.start(account_id, update_id, message)
                                usage.start(account, update_id, message['user_id'])
                                repo.event(account_id, 'request_started')
                                try:
                                    async def invoke():
                                        document = None
                                        if message['media'] == 'document':
                                            work.set_stage(run_id, account_id, 'reading_document')
                                            document = await documents.read(transport, account, message)
                                            if not message['text'].strip():
                                                message['text'] = 'Resume el documento adjunto.' if account['locale'] == 'es' else 'Summarize the attached document.'
                                            work.update_prompt(run_id, account_id, message['text'], input_kind='document')
                                        if message['media'] in ('voice', 'audio'):
                                            work.set_stage(run_id, account_id, 'transcribing')
                                            text = await voice.transcribe(transport, account, message)
                                            # Spoken text is conversation input; it cannot execute
                                            # deterministic control commands such as /reset.
                                            message['text'] = text
                                            work.update_prompt(run_id, account_id, text)
                                            spoken_name = profile.name_request(account_id, message['user_id'], text)
                                            if spoken_name:
                                                work.set_stage(run_id, account_id, 'updating_profile')
                                                if profile.change_name(account_id, message['user_id'], spoken_name):
                                                    repo.event(account_id, 'profile_updated')
                                                    return ('Tu nombre en Spartan ahora es ' if account['locale'] == 'es' else 'Your Spartan name is now ') + spoken_name + '.'
                                                return profile.setup_reply(account, message['user_id'])
                                        work.set_stage(run_id, account_id, 'responding')
                                        arguments = {'document': document} if document is not None else {}
                                        return await respond(account, message['text'], history=history.messages(account_id, message['user_id']),
                                            on_usage=lambda value: usage.record(account_id, update_id, value),
                                            on_stage=lambda stage: work.set_stage(run_id, account_id, stage), user_id=message['user_id'], **arguments)
                                    output = await respond_with_progress(transport, account, update_id, message,
                                        invoke)
                                    usage.finish(account_id, update_id, 'completed')
                                    generation_complete = True
                                    conversation_reply = True
                                except RequestCancelled:
                                    usage.finish(account_id, update_id, 'cancelled')
                                    work.finish(run_id, 'cancelled', reason='sender_cancelled')
                                    repo.event(account_id, 'request_cancelled')
                                    output = 'Consulta cancelada. No se ha añadido al contexto de la conversación.' if account['locale'] == 'es' else 'Request cancelled. It was not added to the conversation context.'
                                except documents.DocumentError as error:
                                    usage.finish(account_id, update_id, 'failed')
                                    work.finish(run_id, 'failed', reason=error.code)
                                    repo.event(account_id, 'document_read_failed')
                                    output = documents.notice(error.code, account['locale'])
                                except (voice.VoiceError, TelegramError) as error:
                                    if isinstance(error, TelegramError) and error.code not in ('audio_invalid', 'audio_too_large', 'audio_unavailable'):
                                        raise
                                    usage.finish(account_id, update_id, 'failed')
                                    work.finish(run_id, 'failed', reason=error.code)
                                    repo.event(account_id, 'audio_transcription_failed')
                                    output = voice.notice(error.code, account['locale'])
                            else:
                                output = 'Se alcanzó el límite de 30 consultas por hora. Intenta más tarde.' if account['locale'] == 'es' else 'The 30 requests per hour limit has been reached. Try again later.'
                    if getattr(output, 'project_scope', None) is not None:
                        project_context.check(account_id, message['user_id'], output.project_scope)
                    current = repo.get_account(account_id)
                    if not current or not current['enabled'] or message['user_id'] not in current['allowed_user_ids']:
                        repo.finish(account_id, update_id, 'failed')
                        if run_id:
                            work.finish(run_id, 'failed', reason='access_revoked')
                        continue
                    if message['media'] in ('voice', 'audio') and not current.get('voice_enabled') and generation_complete:
                        repo.finish(account_id, update_id, 'failed')
                        if run_id:
                            work.finish(run_id, 'failed', reason='voice_disabled')
                        continue
                    if isinstance(output, ChannelReply) and output.images:
                        try:
                            output = await respond_with_progress(transport, account, update_id, message,
                                lambda: deliver(transport, account, message, output), action='upload_photo')
                        except RequestCancelled:
                            repo.finish(account_id, update_id, 'failed')
                            if run_id:
                                work.finish(run_id, 'needs_review', reason='delivery_cancelled')
                            repo.event(account_id, 'delivery_cancelled')
                            current = repo.get_account(account_id)
                            if current and current['enabled'] and message['user_id'] in current['allowed_user_ids']:
                                notice = ('Envío cancelado. Las partes ya enviadas permanecen en Telegram; esta respuesta no se añadió al contexto.' if account['locale'] == 'es' else 'Delivery cancelled. Parts already sent remain in Telegram; this reply was not added to the conversation context.')
                                await transport.send(message['chat_id'], notice)
                            continue
                        except DeliveryRevoked:
                            repo.finish(account_id, update_id, 'failed')
                            if run_id:
                                work.finish(run_id, 'needs_review', reason='access_revoked')
                            repo.event(account_id, 'delivery_revoked')
                            continue
                    else:
                        if getattr(output, 'automation_plan_token', None):
                            await transport.send(message['chat_id'], output, reply_markup=automation_plans.keyboard(current, message, output.automation_plan_token))
                        elif not message['media'] and command(message['text']) == '/projects':
                            await transport.send(message['chat_id'], output, reply_markup=controls.project_keyboard(current, message))
                        else:
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
                except project_context.ProjectContextRevoked:
                    repo.finish(account_id, update_id, 'failed')
                    if run_id:
                        usage.finish(account_id, update_id, 'failed')
                        work.finish(run_id, 'failed', reason='project_access_changed')
                    history.reset(account_id, message['user_id'])
                    repo.event(account_id, 'project_context_revoked')
                    current = repo.get_account(account_id)
                    if current and current['enabled'] and message['user_id'] in current['allowed_user_ids']:
                        await transport.send(message['chat_id'], 'El acceso o el proyecto seleccionado cambió. Envía de nuevo tu consulta.' if account['locale'] == 'es' else 'Access or the selected project changed. Send your request again.')
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
