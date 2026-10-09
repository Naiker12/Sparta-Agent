"""Keep the single update consumer responsive while inference is running."""
import asyncio

from storage.channels import repository as repo
from storage.channels import pairing
from .policy import normalize_private_message
from .progress import delay, typing
from . import controls
from .telegram import TelegramError


class RequestCancelled(Exception):
    """The authorized sender cancelled this request, not the bot worker."""


def command(text):
    parts = text.split()
    return parts[0].split('@')[0].lower() if parts else ''


async def receive(transport, account_id, *, timeout=25):
    updates = await transport.call('getUpdates', offset=repo.offset(account_id),
                                   timeout=timeout, limit=20, allowed_updates=['message', 'callback_query'])
    # Revalidate after long polling: a revoked sender must not enter the inbox.
    account = repo.get_account(account_id)
    if not account:
        return []
    captures = [candidate for update in updates if (candidate := pairing.capture(account_id, update))]
    accepted = []
    def normalize(update):
        message = (controls.consume(account, update) if 'callback_query' in update else normalize_private_message(update, account['allowed_user_ids'])) if account['enabled'] and not pairing.is_link(update) else None
        if message:
            accepted.append((update['update_id'], message))
        return message
    repo.ingest(account_id, updates, normalize)
    for update in updates:
        query = update.get('callback_query')
        if isinstance(query, dict) and isinstance(query.get('id'), str):
            await transport.call('answerCallbackQuery', callback_query_id=query['id'],
                text=('Solicitud recibida' if account['locale'] == 'es' else 'Request received') if any(identifier == update.get('update_id') for identifier, _ in accepted) else ('El botón ha caducado o no está disponible.' if account['locale'] == 'es' else 'This button expired or is unavailable.'))
    for candidate in captures:
        prefix = 'Vuelve a Spartan para autorizar tu cuenta. Comprueba este código: ' if account['locale'] == 'es' else 'Return to Spartan to authorize your account. Check this code: '
        await transport.send(candidate['chat_id'], prefix + candidate['confirmation'])
    return accepted


async def _listen(transport, account_id, update_id, message, response):
    # Fast responses do not need an extra polling request. There is only one
    # getUpdates consumer: the worker transfers ownership here during inference.
    await delay(0.2)
    while not response.done():
        if message['media'] in ('voice', 'audio'):
            from .voice import check_voice_access
            check_voice_access({'id': account_id}, message)
        if repo.take_cancel(account_id, message['user_id'], update_id):
            response.cancel()
            raise RequestCancelled()
        received = await receive(transport, account_id, timeout=1)
        for control_id, control in received:
            if (not response.done() and control_id > update_id
                    and control['user_id'] == message['user_id']
                    and not control['media'] and command(control['text']) == '/cancel'
                    and control.get('cancel_for', update_id) == update_id
                    and repo.consume_control(account_id, control_id)):
                response.cancel()
                raise RequestCancelled()
        # Avoid a tight loop if Telegram immediately returns an empty result.
        await delay(0.1)


async def respond_with_progress(transport, account, update_id, message, invoke, *, action='typing'):
    async with typing(transport, message['chat_id'], action=action):
        response = asyncio.create_task(invoke())
        listener = asyncio.create_task(_listen(transport, account['id'], update_id, message, response))
        async def show_cancel():
            await delay(1)
            if response.done() or not hasattr(transport, 'send_controls'):
                return None
            token = controls.issue(account['id'], message['user_id'], message['chat_id'], '/cancel', cancel_for=update_id)
            try:
                identifier = await transport.send_controls(message['chat_id'],
                    'Procesando tu consulta…' if account['locale'] == 'es' else 'Processing your request…',
                    {'inline_keyboard': [[{'text': 'Cancelar' if account['locale'] == 'es' else 'Cancel', 'callback_data': token}]]})
                return identifier, token
            except TelegramError:
                controls.revoke([token])
                return None
        cancel_button = asyncio.create_task(show_cancel())
        try:
            done, _ = await asyncio.wait((response, listener), return_when=asyncio.FIRST_COMPLETED)
            # Cancellation or transport failure takes priority over an unfinished
            # response; do not leave an unobserved provider task running.
            if listener in done:
                await listener
            return await response
        finally:
            listener.cancel()
            response.cancel()
            await asyncio.gather(listener, response, return_exceptions=True)
            # Let an in-flight control send finish so its token can be revoked.
            shown = await cancel_button
            if shown:
                identifier, token = shown
                controls.revoke([token])
                try:
                    await transport.clear_controls(message['chat_id'], identifier,
                        text='Consulta finalizada.' if account['locale'] == 'es' else 'Request finished.')
                except TelegramError:
                    pass
