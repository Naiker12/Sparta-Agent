"""Keep the single update consumer responsive while inference is running."""
import asyncio

from storage.channels import repository as repo
from storage.channels import pairing
from .policy import normalize_private_message
from .progress import delay, typing


class RequestCancelled(Exception):
    """The authorized sender cancelled this request, not the bot worker."""


def command(text):
    parts = text.split()
    return parts[0].split('@')[0].lower() if parts else ''


async def receive(transport, account_id, *, timeout=25):
    updates = await transport.call('getUpdates', offset=repo.offset(account_id),
                                   timeout=timeout, limit=20, allowed_updates=['message'])
    # Revalidate after long polling: a revoked sender must not enter the inbox.
    account = repo.get_account(account_id)
    if not account:
        return []
    captures = [candidate for update in updates if (candidate := pairing.capture(account_id, update))]
    accepted = []
    def normalize(update):
        message = normalize_private_message(update, account['allowed_user_ids']) if account['enabled'] and not pairing.is_link(update) else None
        if message:
            accepted.append((update['update_id'], message))
        return message
    repo.ingest(account_id, updates, normalize)
    for candidate in captures:
        prefix = 'Vuelve a Spartan para autorizar tu cuenta. Comprueba este código: ' if account['locale'] == 'es' else 'Return to Spartan to authorize your account. Check this code: '
        await transport.send(candidate['chat_id'], prefix + candidate['confirmation'])
    return accepted


async def _listen(transport, account_id, update_id, message, response):
    # Fast responses do not need an extra polling request. There is only one
    # getUpdates consumer: the worker transfers ownership here during inference.
    await delay(0.2)
    while not response.done():
        if repo.take_cancel(account_id, message['user_id'], update_id):
            response.cancel()
            raise RequestCancelled()
        received = await receive(transport, account_id, timeout=1)
        for control_id, control in received:
            if (not response.done() and control_id > update_id
                    and control['user_id'] == message['user_id']
                    and not control['media'] and command(control['text']) == '/cancel'
                    and repo.consume_control(account_id, control_id)):
                response.cancel()
                raise RequestCancelled()
        # Avoid a tight loop if Telegram immediately returns an empty result.
        await delay(0.1)


async def respond_with_progress(transport, account, update_id, message, invoke):
    async with typing(transport, message['chat_id']):
        response = asyncio.create_task(invoke())
        listener = asyncio.create_task(_listen(transport, account['id'], update_id, message, response))
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
