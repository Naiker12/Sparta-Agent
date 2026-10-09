import sys
from urllib.parse import urlparse, parse_qs

import pytest

from storage.channels import repository as repo, pairing, projects
from storage.studio.chat_projects import upsert_chat_project, update_chat_project
from core.channels.profile import change_name
from core.channels.profile import bind


@pytest.fixture
def account(tmp_path, monkeypatch):
    monkeypatch.setenv('UNSLOTH_STUDIO_HOME', str(tmp_path))
    for name, module in tuple(sys.modules.items()):
        if name.startswith('storage.') and hasattr(module, '_schema_ready'):
            monkeypatch.setattr(module, '_schema_ready', False)
    return repo.create_account('desktop-owner', '10', {
        'bot_username': 'example_bot', 'allowed_user_ids': [],
        'locale': 'es', 'provider_id': 'p', 'model': 'm',
    })


def captured(account, user):
    link = pairing.create(account['id'], 'desktop-owner')
    text = '/start ' + parse_qs(urlparse(link['url']).query)['start'][0]
    assert pairing.capture(account['id'], {'update_id': 1, 'message': {
        'text': text, 'from': {'id': user}, 'chat': {'id': user, 'type': 'private'},
    }})
    return link


def test_personal_approval_links_profile_and_dynamic_projects_atomically(account):
    link = captured(account, 123)
    pairing.approve(account['id'], link['id'], 'desktop-owner', purpose='self')
    saved = repo.get_account(account['id'])
    assert saved['enabled'] and saved['owner_user_id'] == saved['profile_user_id'] == '123'
    assert change_name(account['id'], '123', 'My name')
    upsert_chat_project({'id': 'new', 'name': 'Created after pairing', 'createdAt': 1, 'updatedAt': 1})
    assert projects.available(account['id'], '123') == [{'id': 'new', 'name': 'Created after pairing'}]
    assert projects.select(account['id'], '123', 'new')
    assert projects.available(account['id'], '456') == []
    update_chat_project('new', {'archived': True})
    assert projects.selected(account['id'], '123') is None
    assert not projects.select(account['id'], '123', 'new')


def test_legacy_approval_never_silently_grants_profile_or_all_projects(account):
    link = captured(account, 123)
    pairing.approve(account['id'], link['id'], 'desktop-owner')
    saved = repo.get_account(account['id'])
    assert 'owner_user_id' not in saved and 'profile_user_id' not in saved
    assert not change_name(account['id'], '123', 'Guest')
    with pytest.raises(ValueError, match='owner_required'):
        projects.grant(account['id'], 'desktop-owner', '123', [], mode='all')


def test_guest_and_second_owner_cannot_replace_personal_identity(account):
    from core.channels.profile import capability_reply
    first = captured(account, 123)
    pairing.approve(account['id'], first['id'], 'desktop-owner', purpose='self')
    second = captured(account, 456)
    with pytest.raises(ValueError, match='owner_already_linked'):
        pairing.approve(account['id'], second['id'], 'desktop-owner', purpose='self')
    assert repo.get_account(account['id'])['allowed_user_ids'] == ['123']
    assert pairing.get(account['id'], second['id'], 'desktop-owner')['status'] == 'review'
    pairing.approve(account['id'], second['id'], 'desktop-owner', purpose='guest')
    assert repo.get_account(account['id'])['profile_user_id'] == '123'
    assert not change_name(account['id'], '456', 'Guest')
    reply = capability_reply('Puedes cambiar mi nombre', repo.get_account(account['id']), '456')
    assert 'cuenta invitada' in reply and 'selecciona tu usuario' not in reply
    upsert_chat_project({'id': 'private', 'name': 'Private', 'createdAt': 1, 'updatedAt': 1})
    assert projects.available(account['id'], '123') == [{'id': 'private', 'name': 'Private'}]
    assert projects.available(account['id'], '456') == []
    assert not projects.select(account['id'], '456', 'private')
    with pytest.raises(ValueError, match='owner_required'):
        bind(account['id'], 'desktop-owner', '456')


def test_switching_to_selected_preserves_only_explicit_projects(account):
    link = captured(account, 123)
    pairing.approve(account['id'], link['id'], 'desktop-owner', purpose='self')
    upsert_chat_project({'id': 'p', 'name': 'Project', 'createdAt': 1, 'updatedAt': 1})
    assert projects.select(account['id'], '123', 'p')
    projects.grant(account['id'], 'desktop-owner', '123', [], mode='selected')
    assert projects.available(account['id'], '123') == []
    assert projects.selected(account['id'], '123') is None
    projects.grant(account['id'], 'desktop-owner', '123', [], mode='all')
    assert projects.select(account['id'], '123', 'p')


def test_revocation_removes_identity_projects_and_pending_work(account):
    from core.channels import controls
    link = captured(account, 123)
    pairing.approve(account['id'], link['id'], 'desktop-owner', purpose='self')
    upsert_chat_project({'id': 'p', 'name': 'Project', 'createdAt': 1, 'updatedAt': 1})
    projects.select(account['id'], '123', 'p')
    repo.ingest(account['id'], [{'update_id': 1}], lambda _: {'user_id': '123', 'text': 'hello', 'media': None})
    token = controls.issue(account['id'], '123', 123, '/project p')
    with pytest.raises(ValueError, match='account_not_found'):
        repo.revoke_user(account['id'], 'another-owner', '123')
    repo.revoke_user(account['id'], 'desktop-owner', '123')
    controls.revoke_user(account['id'], '123')
    assert token not in controls._pending
    saved = repo.get_account(account['id'])
    assert not saved['allowed_user_ids']
    assert not saved['enabled']
    assert saved['owner_user_id'] is None and saved['profile_user_id'] is None
    assert projects.available(account['id'], '123') == []
    assert projects.selected(account['id'], '123') is None
    assert not change_name(account['id'], '123', 'Revoked')
    assert repo.claim(account['id']) is None


def test_api_requires_ui_owner_and_explicit_personal_purpose(account, monkeypatch):
    import importlib
    from contextlib import nullcontext
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    module = importlib.import_module('routes.channels.router')
    monkeypatch.setattr(module, 'current_credential_write', lambda *_: nullcontext())
    app = FastAPI()
    app.include_router(module.router, prefix='/channels')
    app.dependency_overrides[module.ui_credential] = lambda: ('desktop-owner', None)
    link = captured(account, 123)
    base = '/channels/' + account['id']
    with TestClient(app) as client:
        assert client.post(base + '/pairings/' + link['id'] + '/approve', json={'purpose': 'admin'}).status_code == 422
        app.dependency_overrides[module.ui_credential] = lambda: ('other', None)
        assert client.post(base + '/pairings/' + link['id'] + '/approve', json={'purpose': 'self'}).status_code == 404
        app.dependency_overrides[module.ui_credential] = lambda: ('desktop-owner', None)
        assert client.post(base + '/pairings/' + link['id'] + '/approve', json={'purpose': 'self'}).status_code == 200
        assert repo.get_account(account['id'])['owner_user_id'] == '123'
        assert client.delete(base + '/users/123').status_code == 200
        assert repo.get_account(account['id'])['owner_user_id'] is None
