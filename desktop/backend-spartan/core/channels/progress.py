"""Best-effort native typing status, scoped to one active provider request."""
import asyncio
from contextlib import asynccontextmanager

from .telegram import TelegramError


async def delay(seconds):
    try:
        await asyncio.wait_for(asyncio.Event().wait(), timeout=seconds)
    except TimeoutError:
        pass


async def _typing(transport, chat_id, interval):
    while True:
        pause = interval
        try:
            await asyncio.wait_for(transport.action(chat_id, 'typing'), timeout=10)
        except TelegramError as error:
            if error.code == 'credentials_error':
                return
            pause = max(interval, error.retry_after)
        except Exception:
            # The optional status must never discard the provider response.
            return
        await delay(pause)


@asynccontextmanager
async def typing(transport, chat_id, *, interval=4):
    task = asyncio.create_task(_typing(transport, chat_id, interval))
    try:
        yield
    finally:
        task.cancel()
        await asyncio.gather(task, return_exceptions=True)
