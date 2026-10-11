import asyncio
import json
import time
import pytest
from core.inference.automation_proposals import propose_automation, validate_proposal
from core.channels import automation_plans, controls, executor
from storage.studio import connection, memory_tasks

PLAN = {'title': 'Daily research', 'prompt': 'Research public news and summarize sources', 'scheduleType': 'weekly', 'timezone': 'America/Bogota', 'weekdays': [0,1,2,3,4], 'localTime': '09:00', 'webAccess': True}
ACCOUNT = {'id': 'channel', 'owner': 'owner', 'owner_user_id': '123', 'allowed_user_ids': ['123','456'], 'enabled': True, 'locale': 'es', 'provider_id': 'provider', 'model': 'saved-model'}

@pytest.fixture(autouse=True)
def isolated(tmp_path, monkeypatch):
    monkeypatch.setenv('UNSLOTH_STUDIO_HOME', str(tmp_path))
    monkeypatch.setenv('UNSLOTH_STUDIO_PROJECTS_HOME', str(tmp_path / 'projects'))
    monkeypatch.setattr(connection, '_schema_ready', False)
    automation_plans._plans.clear()
    controls._pending.clear()
    connection.get_connection().close()
    from core.inference import task_scheduler
    monkeypatch.setattr(task_scheduler, 'make_client', lambda *_: object())

def test_proposal_is_data_only_and_cannot_expand_capabilities():
    result = json.loads(propose_automation({**PLAN, 'enabled': True, 'workspaceAccess': 'write', 'projectId': 'private'}))
    assert result['kind'] == 'automation_proposal'
    assert result['plan']['enabled'] is False
    assert result['plan']['workspaceAccess'] == 'none'
    assert result['plan']['projectId'] is None
    assert memory_tasks.list_tasks('owner') == []

@pytest.mark.parametrize('change', [{'timezone':'Invalid/Zone'}, {'weekdays':[]}, {'prompt':' '}, {'scheduleType':'interval','intervalSeconds':None}, {'scheduleType':'once','runAt':1}])
def test_incomplete_plan_never_schedules(change):
    result = json.loads(propose_automation({**PLAN, **change}))
    assert result['scheduled'] is False
    assert memory_tasks.list_tasks('owner') == []

def test_channel_confirm_is_bound_to_owner_and_single_use():
    reply = automation_plans.prepare(ACCOUNT, '123', PLAN)
    token = reply.automation_plan_token
    assert memory_tasks.list_tasks('owner') == []
    denied = automation_plans.resolve(ACCOUNT, {'user_id':'456','text':'/schedule_confirm '+token})
    assert 'autorizado' in denied
    assert memory_tasks.list_tasks('owner') == []
    assert 'programada' in automation_plans.resolve(ACCOUNT, {'user_id':'123','text':'/schedule_confirm '+token})
    tasks = memory_tasks.list_tasks('owner')
    assert len(tasks) == 1 and tasks[0]['enabled']
    assert tasks[0]['model'] == 'saved-model'
    assert tasks[0]['webAccess'] and tasks[0]['workspaceAccess'] == 'none'
    automation_plans.resolve(ACCOUNT, {'user_id':'123','text':'/schedule_confirm '+token})
    assert len(memory_tasks.list_tasks('owner')) == 1

@pytest.mark.parametrize('action', ['cancel', 'expire', 'revoke'])
def test_cancel_expire_revoke_prevent_activation(action):
    token = automation_plans.prepare(ACCOUNT, '123', PLAN).automation_plan_token
    account = dict(ACCOUNT)
    if action == 'expire': automation_plans._plans[token]['expires'] = 0
    if action == 'revoke': account['enabled'] = False
    automation_plans.resolve(account, {'user_id':'123','text':('/schedule_cancel ' if action=='cancel' else '/schedule_confirm ')+token})
    assert memory_tasks.list_tasks('owner') == []

def test_keyboard_uses_existing_sender_bound_controls():
    message = {'user_id':'123','chat_id':123}
    token = automation_plans.prepare(ACCOUNT, '123', PLAN).automation_plan_token
    keyboard = automation_plans.keyboard(ACCOUNT, message, token)
    value = keyboard['inline_keyboard'][0][0]['callback_data']
    update = {'callback_query':{'data':value,'from':{'id':123},'message':{'chat':{'id':123,'type':'private'}}}}
    approved = controls.consume(ACCOUNT, update)
    assert approved['text'] == '/schedule_confirm '+token
    assert controls.consume(ACCOUNT, update) is None

def test_model_change_and_replaced_plan_require_new_confirmation():
    first = automation_plans.prepare(ACCOUNT, '123', PLAN).automation_plan_token
    second = automation_plans.prepare(ACCOUNT, '123', PLAN).automation_plan_token
    automation_plans.resolve(ACCOUNT, {'user_id':'123','text':'/schedule_confirm '+first})
    automation_plans.resolve({**ACCOUNT, 'model':'new-model'}, {'user_id':'123','text':'/schedule_confirm '+second})
    assert memory_tasks.list_tasks('owner') == []

@pytest.mark.parametrize('request_text', ['Programa una investigación diaria a las nueve en America/Bogota', 'A las nueve en America/Bogota'])
def test_channel_model_returns_plan_without_activating(monkeypatch, request_text):
    from core.inference import task_scheduler
    class Client:
        async def stream_chat_completion(self, **kwargs):
            assert any(tool['function']['name']=='propose_automation' for tool in kwargs['tools'])
            yield 'data: '+json.dumps({'choices':[{'delta':{'tool_calls':[{'index':0,'id':'plan','function':{'name':'propose_automation','arguments':json.dumps(PLAN)}}]}}]})
    monkeypatch.setattr(task_scheduler, 'make_client', lambda *_: Client())
    monkeypatch.setattr(executor.project_context, 'load', lambda *_: ([None, False], None))
    monkeypatch.setattr(executor.project_context, 'check', lambda *_: None)
    from storage.channels import history
    monkeypatch.setattr(history, 'messages', lambda *_, **__: [{'role':'user','content':'Programa una investigación diaria'}])
    reply = asyncio.run(executor.respond(ACCOUNT, request_text, user_id='123'))
    assert reply.automation_plan_token
    assert memory_tasks.list_tasks('owner') == []

def test_channel_incomplete_plan_requests_details_without_claiming_activation(monkeypatch):
    from core.inference import task_scheduler
    class Client:
        async def stream_chat_completion(self, **kwargs):
            if kwargs['tools']:
                yield 'data: '+json.dumps({'choices':[{'delta':{'tool_calls':[{'index':0,'id':'plan','function':{'name':'propose_automation','arguments':json.dumps({**PLAN,'weekdays':[]})}}]}}]})
            else:
                assert 'Nothing was scheduled' in kwargs['messages'][-1]['content']
                yield 'data: '+json.dumps({'choices':[{'delta':{'content':'¿Qué días quieres programar la tarea?'}}]})
    monkeypatch.setattr(task_scheduler, 'make_client', lambda *_: Client())
    monkeypatch.setattr(executor.project_context, 'load', lambda *_: ([None, False], None))
    monkeypatch.setattr(executor.project_context, 'check', lambda *_: None)
    from storage.channels import history
    monkeypatch.setattr(history, 'messages', lambda *_, **__: [])
    reply = asyncio.run(executor.respond(ACCOUNT, 'Programa una investigación', user_id='123'))
    assert 'días' in reply
    assert not getattr(reply, 'automation_plan_token', None)
    assert memory_tasks.list_tasks('owner') == []
