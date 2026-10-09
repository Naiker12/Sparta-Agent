import asyncio
import pytest
from storage.studio import connection, memory_tasks
from core.inference import automation_delivery as delivery


@pytest.fixture
def db(tmp_path, monkeypatch):
    monkeypatch.setenv('UNSLOTH_STUDIO_HOME', str(tmp_path))
    monkeypatch.setattr(connection, '_schema_ready', False)
    monkeypatch.setattr(memory_tasks, '_now', lambda: 1000)
    account = {'id': 'bot', 'enabled': True, 'owner_user_id': '123', 'allowed_user_ids': ['123'], 'locale': 'es'}
    monkeypatch.setattr(delivery.repository, 'accounts', lambda owner: [account] if owner == 'owner' else [])
    monkeypatch.setattr(delivery.repository, 'get_account', lambda account_id, owner: account if account_id == 'bot' and owner == 'owner' else None)
    monkeypatch.setattr(delivery, 'get_secret', lambda *args: 'fake-test-token')
    sent = []
    class Transport:
        def __init__(self, token): assert token == 'fake-test-token'
        async def send(self, user_id, text): sent.append((user_id, text))
        async def close(self): pass
    monkeypatch.setattr(delivery, 'Telegram', Transport)
    task = memory_tasks.upsert_task({'title': 'Review', 'prompt': 'Summarize', 'scheduleType': 'interval', 'intervalSeconds': 60}, owner_subject='owner')
    memory_tasks.activate_task(task['id'], 'owner', 'provider', 'model')
    monkeypatch.setattr(memory_tasks, '_now', lambda: 62000)
    task, run_id = memory_tasks.claim_due_task()
    return account, sent, task, run_id


def test_start_and_finish_are_delivered_once_to_same_owner(db):
    account, sent, task, run_id = db
    asyncio.run(delivery.flush())
    asyncio.run(delivery.flush())
    memory_tasks.finish_task_preview(run_id, output='Private result')
    asyncio.run(delivery.flush())
    asyncio.run(delivery.flush())
    assert len(sent) == 2
    assert all(user_id == 123 for user_id, _ in sent)
    assert 'Comienza' in sent[0][1] and 'completada' in sent[1][1]
    assert 'Private result' not in sent[1][1]
    run = memory_tasks.get_task(task['id'], 'owner')['runs'][0]
    assert run['status'] == 'completed'
    assert all(item['status'] == 'delivered' for item in run['deliveries'])


def test_revoked_destination_blocks_delivery_without_failing_work(db):
    account, sent, task, run_id = db
    account['allowed_user_ids'] = []
    asyncio.run(delivery.flush())
    memory_tasks.finish_task_preview(run_id, output='Done')
    asyncio.run(delivery.flush())
    assert sent == []
    run = memory_tasks.get_task(task['id'], 'owner')['runs'][0]
    assert run['status'] == 'completed'
    assert all(item['status'] == 'blocked' for item in run['deliveries'])


def test_ambiguous_transport_error_is_not_retried(db, monkeypatch):
    account, sent, task, run_id = db
    class Failed:
        def __init__(self, token): pass
        async def send(self, *args): raise delivery.TelegramError()
        async def close(self): pass
    monkeypatch.setattr(delivery, 'Telegram', Failed)
    asyncio.run(delivery.flush())
    asyncio.run(delivery.flush())
    assert memory_tasks.get_task(task['id'], 'owner')['runs'][0]['deliveries'][0]['status'] == 'unknown'


def test_ambiguous_or_foreign_accounts_are_never_chosen(db, monkeypatch):
    account, *_ = db
    assert delivery.personal_destination('other') is None
    monkeypatch.setattr(delivery.repository, 'accounts', lambda owner: [account, {**account, 'id': 'second'}])
    assert delivery.personal_destination('owner') is None


def test_completion_queued_before_delivery_still_announces_start_first(db):
    account, sent, task, run_id = db
    memory_tasks.finish_task_preview(run_id, output='Done')
    asyncio.run(delivery.flush())
    asyncio.run(delivery.flush())
    assert len(sent) == 2
    assert 'Comienza' in sent[0][1] and 'completada' in sent[1][1]


def test_rate_limit_waits_and_rechecks_authorization(db, monkeypatch):
    account, sent, task, run_id = db
    class Limited:
        def __init__(self, token): pass
        async def send(self, *args): raise delivery.TelegramError('rate_limited', 5)
        async def close(self): pass
    monkeypatch.setattr(delivery, 'Telegram', Limited)
    asyncio.run(delivery.flush())
    queued = memory_tasks.get_task(task['id'], 'owner')['runs'][0]['deliveries'][0]
    assert queued['status'] == 'pending' and queued['attempts'] == 1
    asyncio.run(delivery.flush())
    assert memory_tasks.get_task(task['id'], 'owner')['runs'][0]['deliveries'][0]['attempts'] == 1
    account['enabled'] = False
    monkeypatch.setattr(memory_tasks, '_now', lambda: 68000)
    asyncio.run(delivery.flush())
    assert memory_tasks.get_task(task['id'], 'owner')['runs'][0]['deliveries'][0]['status'] == 'blocked'
