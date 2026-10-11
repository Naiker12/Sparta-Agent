"""Creation, manual testing and due execution must have distinct durable states."""
import asyncio
import json

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from auth.authentication import get_current_subject, authenticated_via_api_key
from core.inference import task_scheduler
from routes.tasks import router
from storage.studio import connection, memory_tasks
from storage.studio.chat_messages import list_chat_messages


@pytest.fixture
def database(tmp_path, monkeypatch):
    monkeypatch.setenv('UNSLOTH_STUDIO_HOME', str(tmp_path))
    monkeypatch.setenv('UNSLOTH_STUDIO_PROJECTS_HOME', str(tmp_path / 'projects'))
    monkeypatch.setattr(connection, '_schema_ready', False)
    monkeypatch.setattr(memory_tasks, '_now', lambda: 1000)
    connection.get_connection().close()


def draft(**changes):
    return memory_tasks.upsert_task({'title': 'Scheduled report', 'prompt': 'Summarize',
        'scheduleType': 'interval', 'intervalSeconds': 60, 'executionMode': 'agent', **changes}, owner_subject='owner')


def test_create_test_activate_and_execute_without_reopening_the_page(database, monkeypatch):
    requests = []
    class Client:
        async def stream_chat_completion(self, **kwargs):
            requests.append(kwargs['model'])
            yield 'data: ' + json.dumps({'choices': [{'delta': {'content': 'Real scheduled result'}, 'finish_reason': 'stop'}]})
            yield 'data: [DONE]'
    monkeypatch.setattr(task_scheduler, 'make_client', lambda *_: Client())
    app = FastAPI()
    app.include_router(router, prefix='/api/tasks')
    app.dependency_overrides[get_current_subject] = lambda: 'owner'
    app.dependency_overrides[authenticated_via_api_key] = lambda: False
    with TestClient(app) as client:
        created = client.post('/api/tasks', json={'title': 'Scheduled report', 'prompt': 'Summarize',
            'scheduleType': 'interval', 'intervalSeconds': 60, 'executionMode': 'agent'}).json()
        url = '/api/tasks/' + created['id']
        selection = {'providerId': 'saved-provider', 'model': 'saved-model'}
        assert client.post(url + '/agent-test', json=selection).status_code == 200
        tested = client.get(url).json()
        assert tested['enabled'] is False and tested['nextRunAt'] is None
        assert not tested.get('automaticConsent')
        assert client.post(url + '/activate', json=selection).status_code == 200
        monkeypatch.setattr(memory_tasks, '_now', lambda: 62000)
        task, run_id = memory_tasks.claim_due_task()
        assert task['providerId'] == 'saved-provider' and task['model'] == 'saved-model'
        asyncio.run(task_scheduler.execute_claimed(task, run_id))
        completed = client.get(url).json()
        run = next(run for run in completed['runs'] if run['id'] == run_id)
        assert run['status'] == 'completed'
        assert list_chat_messages(run['threadId'])[1]['content'][0]['text'] == 'Real scheduled result'
        assert requests == ['saved-model', 'saved-model']
        assert completed['nextRunAt'] == 122000


def test_legacy_enabled_task_is_paused_with_reason_instead_of_silently_skipped(database, monkeypatch):
    task = draft(enabled=True)
    monkeypatch.setattr(memory_tasks, '_now', lambda: 62000)
    assert memory_tasks.claim_due_task() is None
    current = memory_tasks.get_task(task['id'], 'owner')
    assert current['enabled'] is False and current['nextRunAt'] is None
    assert 'confirm schedule activation' in current['lastError']
    assert current['runs'] == []


def test_bad_weekly_task_does_not_block_another_due_automation(database, monkeypatch):
    bad = draft(scheduleType='weekly', timezone='UTC', localTime='09:00', weekdays=[0])
    good = draft()
    for task in (bad, good):
        memory_tasks.activate_task(task['id'], 'owner', 'provider', 'model')
    conn = connection.get_connection()
    config = {'timezone': 'invalid/timezone', 'weekdays': [0], 'localTime': '09:00',
        'executionMode': 'agent', 'providerId': 'provider', 'model': 'model', 'automaticConsent': True}
    conn.execute('UPDATE agent_tasks SET next_run_at=2000,schedule_config=? WHERE id=?', (json.dumps(config), bad['id']))
    conn.commit()
    conn.close()
    monkeypatch.setattr(memory_tasks, '_now', lambda: 62000)
    claimed, _ = memory_tasks.claim_due_task()
    assert claimed['id'] == good['id']
    current = memory_tasks.get_task(bad['id'], 'owner')
    assert current['enabled'] is False and 'timezone' in current['lastError']


def test_changing_active_model_preserves_pending_occurrence_and_clears_error(database, monkeypatch):
    task = draft()
    active = memory_tasks.activate_task(task['id'], 'owner', 'provider', 'first-model')
    monkeypatch.setattr(memory_tasks, '_now', lambda: 62000)
    changed = memory_tasks.activate_task(task['id'], 'owner', 'provider', 'second-model')
    assert changed['nextRunAt'] == active['nextRunAt'] == 61000
    claimed, _ = memory_tasks.claim_due_task()
    assert claimed['model'] == 'second-model'


def test_provider_failure_is_visible_in_task_list_and_success_clears_it(database, monkeypatch):
    task = draft()
    memory_tasks.activate_task(task['id'], 'owner', 'provider', 'model')
    monkeypatch.setattr(memory_tasks, '_now', lambda: 62000)
    _, run_id = memory_tasks.claim_due_task()
    memory_tasks.finish_task_preview(run_id, error='Provider unavailable')
    listed = memory_tasks.list_tasks('owner')[0]
    assert listed['lastError'] == 'Provider unavailable' and listed['status'] == 'failed'
    monkeypatch.setattr(memory_tasks, '_now', lambda: 123000)
    _, retry = memory_tasks.claim_due_task()
    memory_tasks.finish_task_preview(retry, output='Recovered')
    assert memory_tasks.list_tasks('owner')[0]['lastError'] is None


def test_restart_coalesces_missed_intervals_and_once_is_not_claimed_twice(database, monkeypatch):
    recurring = draft()
    memory_tasks.activate_task(recurring['id'], 'owner', 'provider', 'model')
    once = draft(scheduleType='once', runAt=5000)
    memory_tasks.activate_task(once['id'], 'owner', 'provider', 'model')
    monkeypatch.setattr(memory_tasks, '_now', lambda: 600000)
    claimed, run = memory_tasks.claim_due_task()
    assert claimed['id'] == once['id']
    memory_tasks.finish_task_preview(run, output='Once')
    claimed, run = memory_tasks.claim_due_task()
    assert claimed['id'] == recurring['id']
    memory_tasks.finish_task_preview(run, output='Recurring')
    assert memory_tasks.claim_due_task() is None
    assert memory_tasks.get_task(recurring['id'], 'owner')['nextRunAt'] == 660000
