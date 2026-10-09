import asyncio
import json

import pytest
from storage.studio import connection, memory_tasks
from storage.studio.automation_chats import checkpoint
from storage.studio.chat_messages import list_chat_messages, sync_chat_messages, upsert_chat_message
from storage.studio.chat_threads import get_chat_thread


@pytest.fixture
def database(tmp_path, monkeypatch):
    monkeypatch.setenv('UNSLOTH_STUDIO_HOME', str(tmp_path))
    monkeypatch.setenv('UNSLOTH_STUDIO_PROJECTS_HOME', str(tmp_path / 'projects'))
    monkeypatch.setattr(connection, '_schema_ready', False)
    monkeypatch.setattr(memory_tasks, '_now', lambda: 1000)
    conn = connection.get_connection()
    conn.close()


def claim(monkeypatch, project_id=None):
    task = memory_tasks.upsert_task({'title': 'Daily review', 'prompt': 'Summarize the instructions', 'scheduleType': 'interval', 'intervalSeconds': 60, 'enabled': False, 'projectId': project_id}, owner_subject='owner')
    memory_tasks.activate_task(task['id'], 'owner', 'provider', 'model')
    monkeypatch.setattr(memory_tasks, '_now', lambda: 62000)
    return memory_tasks.claim_due_task()


def test_claim_creates_chat_and_checkpoints_survive_stale_client_sync(database, monkeypatch):
    task, run_id = claim(monkeypatch)
    assert memory_tasks.claim_due_task() is None
    run = memory_tasks.get_task(task['id'], 'owner')['runs'][0]
    assert get_chat_thread(run['threadId'])['title'] == 'Daily review'
    initial = list_chat_messages(run['threadId'])
    assert [item['role'] for item in initial] == ['user', 'assistant']
    checkpoint(run_id, 'Live progress', 63000)
    sync_chat_messages(run['threadId'], initial, prune_missing=True)
    sync_chat_messages(run['threadId'], [], prune_missing=True)
    messages = list_chat_messages(run['threadId'])
    assert len(messages) == 2
    assert messages[1]['content'][0]['text'] == 'Live progress'
    memory_tasks.finish_task_preview(run_id, output='Final result')
    assert list_chat_messages(run['threadId'])[1]['content'][0]['text'] == 'Final result'


def test_every_occurrence_has_its_own_chat_and_owned_events(database, monkeypatch):
    task, first = claim(monkeypatch)
    memory_tasks.finish_task_preview(first, output='First')
    monkeypatch.setattr(memory_tasks, '_now', lambda: 123000)
    _, second = memory_tasks.claim_due_task()
    runs = memory_tasks.get_task(task['id'], 'owner')['runs']
    assert len({run['threadId'] for run in runs}) == 2
    events = memory_tasks.task_notifications('owner', 0)
    assert len({event['id'] for event in events}) == 3
    assert memory_tasks.task_notifications('other-owner', 0) == []
    assert memory_tasks.get_task(task['id'], 'other-owner') is None


def test_edit_keeps_activation_configuration(database, monkeypatch):
    task, run_id = claim(monkeypatch)
    existing = memory_tasks.get_task(task['id'], 'owner')
    edited = memory_tasks.upsert_task({**existing, 'title': 'Renamed'}, task['id'], 'owner')
    assert edited['providerId'] == 'provider'
    assert edited['model'] == 'model'
    assert edited['automaticConsent'] is True


def test_api_edit_preserves_active_task_and_rejects_bypassing_activation(database, monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from auth.authentication import get_current_subject
    from routes.tasks import router
    task, _ = claim(monkeypatch)
    due = memory_tasks.get_task(task['id'], 'owner')['nextRunAt']
    app = FastAPI()
    app.include_router(router, prefix='/api/tasks')
    app.dependency_overrides[get_current_subject] = lambda: 'owner'
    with TestClient(app) as client:
        response = client.patch('/api/tasks/' + task['id'], json={'title': 'Edited'})
        assert response.status_code == 200
        assert response.json()['enabled'] is True
        assert response.json()['nextRunAt'] == due
        assert client.patch('/api/tasks/' + task['id'], json={'enabled': False}).status_code == 200
        assert client.patch('/api/tasks/' + task['id'], json={'enabled': True}).status_code == 422


def test_failure_retains_checkpoint_in_chat(database, monkeypatch):
    task, run_id = claim(monkeypatch)
    thread_id = memory_tasks.get_task(task['id'], 'owner')['runs'][0]['threadId']
    checkpoint(run_id, 'Partial output', 63000)
    memory_tasks.finish_task_preview(run_id, error='Provider unavailable')
    text = list_chat_messages(thread_id)[1]['content'][0]['text']
    assert 'Partial output' in text and 'Provider unavailable' in text
    with pytest.raises(ValueError):
        checkpoint(run_id, 'Late output', 64000)


def test_project_run_is_linked_to_existing_project(database, monkeypatch):
    from storage.studio.chat_projects import upsert_chat_project
    project = upsert_chat_project({'id': 'project', 'name': 'Project', 'createdAt': 1000, 'updatedAt': 1000, 'instructions': 'Use Spanish'})
    task, run_id = claim(monkeypatch, project['id'])
    thread = get_chat_thread(memory_tasks.get_task(task['id'], 'owner')['runs'][0]['threadId'])
    assert thread['projectId'] == project['id']


def test_preview_publishes_incremental_text_without_enabling_tools():
    from core.inference.task_preview import preview_task
    class Client:
        async def stream_chat_completion(self, **kwargs):
            assert kwargs['tools'] == [] and kwargs['enabled_tools'] == []
            assert 'Use Spanish' in kwargs['messages'][0]['content']
            for text in ['First', ' second']:
                yield 'data: ' + json.dumps({'choices': [{'delta': {'content': text}}]})
    values = []
    async def progress(text): values.append(text)
    output = asyncio.run(preview_task(Client(), 'model', 'Prompt', on_progress=progress, project_instructions='Use Spanish'))
    assert values == ['First', 'First second']
    assert output == 'First second'


def test_heartbeat_prevents_duplicate_execution(database, monkeypatch):
    task, run_id = claim(monkeypatch)
    checkpoint(run_id, 'Still working', 200000)
    monkeypatch.setattr(memory_tasks, '_now', lambda: 250000)
    assert memory_tasks.claim_due_task() is None
    assert memory_tasks.get_task(task['id'], 'owner')['runs'][0]['status'] == 'running'


def test_run_api_is_scoped_to_owner(database, monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from auth.authentication import get_current_subject
    from routes.tasks import router
    task, run_id = claim(monkeypatch)
    thread_id = memory_tasks.get_task(task['id'], 'owner')['runs'][0]['threadId']
    app = FastAPI()
    app.include_router(router, prefix='/api/tasks')
    app.dependency_overrides[get_current_subject] = lambda: 'owner'
    with TestClient(app) as client:
        assert client.get('/api/tasks/runs/by-thread/' + thread_id).json()['status'] == 'running'
        app.dependency_overrides[get_current_subject] = lambda: 'other'
        assert client.get('/api/tasks/runs/by-thread/' + thread_id).status_code == 404


def test_cancel_is_owned_terminal_and_keeps_partial_progress(database, monkeypatch):
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from auth.authentication import get_current_subject
    from routes.tasks import router
    from storage.studio.automation_chats import heartbeat
    task, run_id = claim(monkeypatch)
    checkpoint(run_id, 'Partial work', 63000)
    app = FastAPI()
    app.include_router(router, prefix='/api/tasks')
    app.dependency_overrides[get_current_subject] = lambda: 'other'
    with TestClient(app) as client:
        assert client.post('/api/tasks/runs/' + run_id + '/cancel').status_code == 404
        app.dependency_overrides[get_current_subject] = lambda: 'owner'
        assert client.post('/api/tasks/runs/' + run_id + '/cancel').status_code == 200
    assert not heartbeat(run_id, 64000)
    memory_tasks.finish_task_preview(run_id, output='Late completion')
    run = memory_tasks.get_task(task['id'], 'owner')['runs'][0]
    assert run['status'] == 'cancelled' and run['output'] == 'Partial work'
    assert 'cancelled' in list_chat_messages(run['threadId'])[1]['content'][0]['text']


def test_capability_changes_pause_instead_of_expanding_activation(database, monkeypatch):
    task, _ = claim(monkeypatch)
    current = memory_tasks.get_task(task['id'], 'owner')
    updated = memory_tasks.upsert_task({**current, 'executionMode': 'agent', 'webAccess': True}, task['id'], 'owner')
    assert updated['enabled'] is False
    assert updated['automaticConsent'] is False
    assert updated['nextRunAt'] is None
    assert 'workspaceBinding' not in updated


def test_manual_agent_test_creates_chat_without_moving_schedule(database, monkeypatch):
    draft = memory_tasks.upsert_task({'title': 'Test', 'prompt': 'Work', 'scheduleType': 'interval', 'intervalSeconds': 60, 'executionMode': 'agent'}, owner_subject='owner')
    draft.update(providerId='provider', model='model')
    run_id = memory_tasks.begin_agent_test(draft, 'owner')
    current = memory_tasks.get_task(draft['id'], 'owner')
    assert current['nextRunAt'] is None and current['enabled'] is False
    assert current['runs'][0]['threadId'] == 'automation-' + run_id


def test_idle_heartbeat_preserves_lease_without_changing_partial_text(database, monkeypatch):
    from storage.studio.automation_chats import heartbeat
    task, run_id = claim(monkeypatch)
    checkpoint(run_id, 'Previous text', 63000)
    assert heartbeat(run_id, 250000)
    monkeypatch.setattr(memory_tasks, '_now', lambda: 260000)
    assert memory_tasks.claim_due_task() is None
    assert memory_tasks.get_task(task['id'], 'owner')['runs'][0]['output'] == 'Previous text'


def test_scheduled_agent_creates_report_and_saves_actual_result_in_chat(database, monkeypatch):
    from pathlib import Path
    from storage.studio.chat_projects import upsert_chat_project
    from core.inference import task_scheduler
    project = upsert_chat_project({'id': 'project', 'name': 'Project', 'createdAt': 1000, 'updatedAt': 1000})
    task = memory_tasks.upsert_task({'title': 'Report', 'prompt': 'Create a report', 'scheduleType': 'interval',
                                   'intervalSeconds': 60, 'projectId': project['id'], 'executionMode': 'agent',
                                   'workspaceAccess': 'write'}, owner_subject='owner')
    memory_tasks.activate_task(task['id'], 'owner', 'provider', 'model')
    monkeypatch.setattr(memory_tasks, '_now', lambda: 62000)
    claimed, run_id = memory_tasks.claim_due_task()
    class Client:
        calls = 0
        async def stream_chat_completion(self, **kwargs):
            self.calls += 1
            if self.calls == 1:
                yield 'data: ' + json.dumps({'choices': [{'delta': {'tool_calls': [{'index': 0, 'id': 'report', 'type': 'function', 'function': {'name': 'write_project_file', 'arguments': json.dumps({'path': 'report.md', 'content': '# Scheduled report'})}}]}, 'finish_reason': 'tool_calls'}]})
            else:
                yield 'data: ' + json.dumps({'choices': [{'delta': {'content': 'Created report.md'}, 'finish_reason': 'stop'}]})
            yield 'data: [DONE]'
    monkeypatch.setattr(task_scheduler, 'make_client', lambda *_: Client())
    asyncio.run(task_scheduler.execute_claimed(claimed, run_id))
    assert Path(project['sandboxPath'], 'report.md').read_text() == '# Scheduled report'
    run = memory_tasks.get_task(task['id'], 'owner')['runs'][0]
    assert run['status'] == 'completed'
    text = list_chat_messages(run['threadId'])[1]['content'][0]['text']
    assert 'Created report.md' in text and 'write_project_file' in text
