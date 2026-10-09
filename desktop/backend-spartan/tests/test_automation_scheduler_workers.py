import asyncio

from core.inference import task_scheduler
from storage.studio import memory_tasks


def test_long_execution_does_not_block_other_due_tasks_and_shutdown_stops_workers(monkeypatch):
    claims, started, stopped = [], [], []
    async def scenario():
        all_started = asyncio.Event()
        def claim():
            index = len(claims)
            claims.append(index)
            return {'id': str(index)}, str(index)
        async def execute(task, run_id):
            started.append(run_id)
            if len(started) == 3:
                all_started.set()
            try:
                await asyncio.Future()
            finally:
                stopped.append(run_id)
        monkeypatch.setattr(memory_tasks, 'claim_due_task', claim)
        monkeypatch.setattr(task_scheduler, 'execute_claimed', execute)
        scheduler = asyncio.create_task(task_scheduler._scheduler_loop())
        await asyncio.wait_for(all_started.wait(), timeout=2)
        assert len(claims) == 3
        scheduler.cancel()
        try:
            await scheduler
        except asyncio.CancelledError:
            pass
    asyncio.run(scenario())
    assert sorted(stopped) == sorted(started) == ['0', '1', '2']
