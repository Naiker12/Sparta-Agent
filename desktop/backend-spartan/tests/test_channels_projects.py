import json
import sys

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from storage.channels import repository as repo, projects, work
from storage.studio.chat_projects import upsert_chat_project, update_chat_project
from core.channels.catalog import command_reply
from routes.channels.router import router, ui_credential


@pytest.fixture
def saved(tmp_path, monkeypatch):
    monkeypatch.setenv('UNSLOTH_STUDIO_HOME', str(tmp_path))
    for name, module in tuple(sys.modules.items()):
        if name.startswith('storage.') and hasattr(module, '_schema_ready'):
            monkeypatch.setattr(module, '_schema_ready', False)
    account = repo.create_account('owner', '1', {'name': 'Bot', 'allowed_user_ids': ['123', '456'], 'locale': 'es', 'provider_id': 'p', 'model': 'm'})
    repo.set_enabled(account['id'], 'owner', True)
    upsert_chat_project({'id': 'p1', 'name': 'Private project', 'createdAt': 1, 'updatedAt': 1})
    return repo.get_account(account['id'])


def test_projects_are_hidden_by_default_and_grants_are_per_sender(saved):
    assert projects.available(saved['id'], '123') == []
    projects.grant(saved['id'], 'owner', '123', ['p1'])
    assert projects.available(saved['id'], '123') == [{'id': 'p1', 'name': 'Private project'}]
    assert projects.available(saved['id'], '456') == []
    assert not projects.select(saved['id'], '456', 'p1')


def test_owner_and_sender_validation(saved):
    for owner, user, ids, code in [('other', '123', ['p1'], 'account_not_found'), ('owner', '999', ['p1'], 'user_not_authorized'), ('owner', '123', ['missing'], 'project_not_found')]:
        with pytest.raises(ValueError, match=code):
            projects.grant(saved['id'], owner, user, ids)


def test_revoking_or_archiving_selection_removes_project(saved):
    projects.grant(saved['id'], 'owner', '123', ['p1'])
    assert projects.select(saved['id'], '123', 'p1')
    projects.grant(saved['id'], 'owner', '123', [])
    assert projects.selected(saved['id'], '123') is None
    projects.grant(saved['id'], 'owner', '123', ['p1'])
    projects.select(saved['id'], '123', 'p1')
    update_chat_project('p1', {'archived': True})
    assert projects.available(saved['id'], '123') == []
    assert projects.selected(saved['id'], '123') is None


def test_commands_and_work_metadata_do_not_expose_paths_or_instructions(saved):
    projects.grant(saved['id'], 'owner', '123', ['p1'])
    reply = command_reply('/projects', saved, user_id='123')
    assert '/project p1' in reply
    assert 'Private project' not in command_reply('/projects', saved, user_id='456')
    assert 'Private project' in command_reply('/project p1', saved, user_id='123')
    run = work.start(saved['id'], 1, {'user_id': '123', 'text': 'Hello', 'media': None})
    with repo.connection() as db:
        value = json.loads(db.execute('SELECT request_json FROM work_runs WHERE id=?', (run,)).fetchone()[0])
    assert value['projectId'] == 'p1'
    assert 'rootPath' not in value and 'instructions' not in value
    assert projects.select(saved['id'], '123', None)
    assert projects.selected(saved['id'], '123') is None


def test_grants_route_requires_owner_and_returns_only_names(saved):
    app = FastAPI()
    app.include_router(router, prefix='/channels')
    app.dependency_overrides[ui_credential] = lambda: ('other', None)
    with TestClient(app) as client:
        assert client.get('/channels/' + saved['id'] + '/projects').status_code == 404
    app.dependency_overrides[ui_credential] = lambda: ('owner', None)
    with TestClient(app) as client:
        value = client.get('/channels/' + saved['id'] + '/projects').json()
    assert value['projects'] == [{'id': 'p1', 'name': 'Private project'}]


def test_route_cannot_grant_project_to_another_owner_or_unpaired_user(saved, monkeypatch):
    from contextlib import nullcontext
    import importlib
    module = importlib.import_module('routes.channels.router')
    monkeypatch.setattr(module, 'current_credential_write', lambda *_: nullcontext())
    app = FastAPI()
    app.include_router(router, prefix='/channels')
    app.dependency_overrides[ui_credential] = lambda: ('other', None)
    path = '/channels/' + saved['id'] + '/projects'
    with TestClient(app) as client:
        assert client.put(path, json={'user_id': '123', 'project_ids': ['p1']}).status_code == 404
        app.dependency_overrides[ui_credential] = lambda: ('owner', None)
        assert client.put(path, json={'user_id': '999', 'project_ids': ['p1']}).status_code == 422
        assert client.put(path, json={'user_id': '123', 'project_ids': ['p1']}).status_code == 200
        assert client.put(path, json={'user_id': '123', 'project_ids': [], 'path': 'C:/'}).status_code == 422
    assert projects.available(saved['id'], '123') == [{'id': 'p1', 'name': 'Private project'}]


def test_switch_resets_context_only_on_actual_change(saved, monkeypatch):
    from storage.channels import history
    calls = []
    monkeypatch.setattr(history, 'reset', lambda *args: calls.append(args))
    projects.grant(saved['id'], 'owner', '123', ['p1'])
    command_reply('/project p1', saved, user_id='123')
    command_reply('/project p1', saved, user_id='123')
    command_reply('/project missing', saved, user_id='123')
    assert len(calls) == 1
    command_reply('/project off', saved, user_id='123')
    assert len(calls) == 2


def test_activity_stage_cannot_update_other_channel_or_finished_work(saved):
    run = work.start(saved['id'], 88, {'user_id': '123', 'text': 'Hello', 'media': None})
    work.set_stage(run, saved['id'], 'transcribing')
    work.set_stage(run, 'other-channel', 'responding')
    with repo.connection() as db:
        row = db.execute('SELECT request_json,revision FROM work_runs WHERE id=?', (run,)).fetchone()
        assert json.loads(row['request_json'])['activityStage'] == 'transcribing'
        revision = row['revision']
    work.finish(run, 'cancelled')
    work.set_stage(run, saved['id'], 'responding')
    with repo.connection() as db:
        row = db.execute('SELECT request_json,revision FROM work_runs WHERE id=?', (run,)).fetchone()
        assert json.loads(row['request_json'])['activityStage'] == 'transcribing'
        assert row['revision'] == revision + 1
