"""Application-lifetime scheduler; missed occurrences are coalesced."""
import asyncio
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo


def next_occurrence(task, now):
    if task['scheduleType'] == 'once':
        return None
    if task['scheduleType'] == 'interval':
        return now + task['intervalSeconds'] * 1000
    zone = ZoneInfo(task['timezone'])
    local = datetime.fromtimestamp(now / 1000, timezone.utc).astimezone(zone)
    hour, minute = map(int, task['localTime'].split(':'))
    for offset in range(8):
        day = local.date() + timedelta(days=offset)
        if day.weekday() not in task['weekdays']:
            continue
        candidate = datetime(day.year, day.month, day.day, hour, minute, tzinfo=zone)
        # Skip nonexistent DST wall times; choose first occurrence for ambiguous times.
        instant = candidate.astimezone(timezone.utc)
        if instant.astimezone(zone).replace(tzinfo=None) != candidate.replace(tzinfo=None):
            continue
        stamp = int(instant.timestamp() * 1000)
        if stamp > now:
            return stamp
    raise ValueError('No upcoming occurrence')


def make_client(provider_id, model):
    from storage.providers_db import get_provider
    from storage.credential_secrets import resolve_provider_api_key
    from core.inference.providers import get_base_url
    from core.inference.external_provider import ExternalProviderClient
    provider = get_provider(provider_id)
    if not provider or not provider['is_enabled'] or provider['provider_type'] == 'openai_codex':
        raise ValueError('Choose an enabled API provider')
    if model not in (provider.get('models') or provider.get('available_models') or []):
        raise ValueError('Choose a configured model')
    key = resolve_provider_api_key(provider_id, None)
    return ExternalProviderClient(provider['provider_type'], provider.get('base_url') or get_base_url(provider['provider_type']), key)


async def scheduler_loop():
    from core.inference.automation_delivery import delivery_loop
    worker = asyncio.create_task(delivery_loop())
    try:
        await _scheduler_loop()
    finally:
        worker.cancel()
        try:
            await worker
        except asyncio.CancelledError:
            pass


async def _scheduler_loop():
    from storage.studio.memory_tasks import claim_due_task
    active = set()
    try:
        while True:
            try:
                # A long agent run must not prevent other due tasks from starting.
                while len(active) < 3:
                    claimed = await asyncio.to_thread(claim_due_task)
                    if not claimed:
                        break
                    worker = asyncio.create_task(execute_claimed(*claimed))
                    active.add(worker)
                    def completed(finished):
                        active.discard(finished)
                        if not finished.cancelled():
                            finished.exception()  # Retrieve a terminal storage error without exposing it.
                    worker.add_done_callback(completed)
            except asyncio.CancelledError:
                raise
            except Exception:
                # A transient database failure must not kill scheduling.
                pass
            await asyncio.sleep(5)
    finally:
        pending = list(active)
        for worker in pending:
            worker.cancel()
        await asyncio.gather(*pending, return_exceptions=True)


async def execute_claimed(task, run_id):
    import threading
    import time
    from storage.studio.memory_tasks import finish_task_preview, _now
    from storage.studio.automation_chats import checkpoint, heartbeat
    from core.inference.automation_executor import execute_automation, AutomationStopped
    task = {**task, 'runId': run_id}
    cancel = threading.Event()
    async def watch_execution():
        try:
            while not cancel.is_set():
                if not await asyncio.to_thread(heartbeat, run_id, _now()):
                    cancel.set()
                    return
                await asyncio.sleep(2)
        except Exception:
            cancel.set()
    watcher = asyncio.create_task(watch_execution())
    try:
        client = make_client(task['providerId'], task['model'])
        last_checkpoint = 0
        async def progress(text):
            nonlocal last_checkpoint
            now = time.monotonic()
            if now - last_checkpoint >= 0.5:
                await asyncio.to_thread(checkpoint, run_id, text, _now())
                last_checkpoint = now
        output = await execute_automation(client, task, on_progress=progress, cancel_event=cancel)
        finish_task_preview(run_id, output=output)
    except AutomationStopped:
        finish_task_preview(run_id, error='Execution cancelled or chat unavailable')
    except asyncio.CancelledError:
        finish_task_preview(run_id, error='Execution interrupted at shutdown')
        raise
    except Exception:
        finish_task_preview(run_id, error='Scheduled execution failed; check provider, capabilities and project folder permissions')
    finally:
        cancel.set()
        watcher.cancel()
        await asyncio.gather(watcher, return_exceptions=True)
