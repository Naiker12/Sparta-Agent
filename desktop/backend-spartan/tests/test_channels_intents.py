import asyncio
import json
import sys
from unittest.mock import AsyncMock
import pytest
from core.channels.intents import public_search
from core.channels.catalog import COMMANDS, command_reply

@pytest.mark.parametrize('text,query', [('Busca en internet astronomía', 'astronomía'), ('Por favor, busca en la web: volcanes', 'volcanes'), ('Search the web astronomy', 'astronomy'), ('Please search online news', 'news'), ('busca en internet', '')])
def test_explicit_search_phrases(text, query):
    assert public_search(text) == query

@pytest.mark.parametrize('text', ['No busca en internet nada', 'Resume: busca en internet secretos', '/reset', 'Mi contraseña es algo', 'Search my PC for documents'])
def test_ordinary_text_not_forced_into_search(text):
    assert public_search(text) is None

def test_small_menu_and_compatibility():
    assert {name for name, _ in COMMANDS['es']} == {'help', 'projects', 'usage', 'cancel', 'reset'}
    assert len(COMMANDS['en']) == 5
    assert command_reply('/search news', {'locale': 'en'}) is None
    assert command_reply('/provider', {'locale': 'es', 'provider_name': 'API', 'model': 'model'}) == 'API · model'

@pytest.mark.parametrize('text,network', [('Busca en internet astronomía', True), ('Search the web astronomy', True), ('Busca en internet C:/Users/private.env', False), ('Busca en internet', False)])
def test_validated_search_without_model_tools(tmp_path, monkeypatch, text, network):
    from core.channels import web
    from core.channels.executor import respond
    from core.inference import task_scheduler
    from storage.channels import repository
    monkeypatch.setenv('UNSLOTH_STUDIO_HOME', str(tmp_path))
    for name, module in tuple(sys.modules.items()):
        if name.startswith('storage.') and hasattr(module, '_schema_ready'):
            monkeypatch.setattr(module, '_schema_ready', False)
    account = repository.create_account('owner', '1', {'locale': 'es', 'provider_id': 'p', 'model': 'm', 'name': 'Bot', 'allowed_user_ids': ['123']})
    observed = []
    class Client:
        async def stream_chat_completion(self, **kwargs):
            observed.append(kwargs)
            assert kwargs['tools'] == []
            yield 'data: ' + json.dumps({'choices': [{'delta': {'content': 'Summary'}}]})
    monkeypatch.setattr(task_scheduler, 'make_client', lambda *_: Client())
    search = AsyncMock(return_value=[{'title': 'Page', 'url': 'https://example.com/page', 'snippet': 'Evidence'}])
    monkeypatch.setattr(web, 'search', search)
    stages = []
    output = asyncio.run(respond(account, text, on_stage=stages.append))
    if network:
        search.assert_awaited_once()
        assert stages == ["searching_web", "responding"]
        assert 'https://example.com/page' in output
        assert observed[0]['messages'][1]['content'] == text
        assert 'Profile name changes require linking' in observed[0]['messages'][0]['content']
        assert 'profile configuration changes are managed' not in observed[0]['messages'][0]['content']
    else:
        search.assert_not_called()
        assert stages == []
        assert not observed


@pytest.mark.parametrize('locale', ['es', 'en'])
def test_capability_help_respects_profile_and_voice_permissions(locale):
    from core.channels.catalog import capability_summary
    account = {'locale': locale, 'profile_user_id': '123', 'allowed_user_ids': ['123'], 'voice_enabled': False}
    linked = capability_summary(account, '123', locale='en')
    assert 'explicitly linked' in linked
    assert 'Voice notes: disabled' in linked
    assert 'Not implemented: local file access' in linked
    assert 'require linking' in capability_summary(account, '456', locale='en')
    account['allowed_user_ids'] = []
    assert 'require linking' in capability_summary(account, '123', locale='en')
    assert capability_summary(account, '123') in command_reply('/tools', account, user_id='123')
    assert capability_summary(account, '123') in command_reply('/help', account, user_id='123')
