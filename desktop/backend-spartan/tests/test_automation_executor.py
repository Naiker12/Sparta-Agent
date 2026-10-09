import asyncio
import json
import threading

import pytest

from core.inference import automation_workspace as workspace
from core.inference.automation_executor import execute_automation


@pytest.fixture
def task(tmp_path, monkeypatch):
    project = {'id': 'project', 'connectedFolderPath': str(tmp_path), 'workspaceAccess': 'write', 'instructions': 'Use Spanish'}
    monkeypatch.setattr(workspace, 'get_chat_project', lambda _: project)
    from storage.studio import chat_projects, memory_tasks
    monkeypatch.setattr(chat_projects, 'get_chat_project', lambda _: project)
    task = {'id': 'task', 'ownerSubject': 'owner', 'projectId': 'project', 'workspaceAccess': 'write',
            'executionMode': 'agent', 'webAccess': False, 'model': 'model', 'prompt': 'Create a report'}
    task['workspaceBinding'] = workspace.workspace_binding(task)
    monkeypatch.setattr(memory_tasks, 'get_task', lambda *_: task.copy())
    return task


def test_actual_file_tools_read_create_and_refuse_overwrite(task, tmp_path):
    tools = workspace.WorkspaceTools(task)
    cancel = threading.Event()
    created = tools.execute('write_project_file', {'path': 'report.md', 'content': '# Report'}, cancel_event=cancel)
    assert json.loads(created)['created'] == 'report.md'
    assert tmp_path.joinpath('report.md').read_text() == '# Report'
    read = tools.execute('read_project_file', {'path': 'report.md'}, cancel_event=cancel)
    assert '# Report' in json.loads(read)['text']
    assert tools.execute('write_project_file', {'path': 'report.md', 'content': 'Replacement'}, cancel_event=cancel).startswith('Error:')
    assert tmp_path.joinpath('report.md').read_text() == '# Report'


@pytest.mark.parametrize('path', ['../outside.md', 'C:\\outside.md', 'report.md:stream', '/outside.md'])
def test_scoped_paths_cannot_escape(task, path):
    with pytest.raises(ValueError):
        workspace.WorkspaceTools(task).checked_path(path)


def test_permission_revocation_is_checked_before_each_file_operation(task, tmp_path, monkeypatch):
    tools = workspace.WorkspaceTools(task)
    monkeypatch.setattr(workspace, 'get_chat_project', lambda _: {'connectedFolderPath': str(tmp_path), 'workspaceAccess': 'read'})
    result = tools.execute('write_project_file', {'path': 'report.md', 'content': 'Denied'}, cancel_event=threading.Event())
    assert result.startswith('Error:')
    assert not tmp_path.joinpath('report.md').exists()


def test_read_only_tools_cannot_write(task, tmp_path):
    task['workspaceAccess'] = 'read'
    task['workspaceBinding'] = workspace.workspace_binding(task)
    tools = workspace.WorkspaceTools(task)
    assert tools.execute('write_project_file', {'path': 'report.md', 'content': 'Denied'}, cancel_event=threading.Event()).startswith('Error:')
    assert not tmp_path.joinpath('report.md').exists()
    assert 'write_project_file' not in {tool['function']['name'] for tool in workspace.file_catalog('read')}


def test_agent_uses_shared_loop_and_creates_real_report(task, tmp_path):
    class Client:
        def __init__(self): self.requests = []
        async def stream_chat_completion(self, **kwargs):
            self.requests.append(kwargs)
            assert kwargs['enabled_tools'] == []
            if len(self.requests) == 1:
                names = {tool['function']['name'] for tool in kwargs['tools']}
                assert names == {'list_project_files', 'read_project_file', 'write_project_file'}
                yield 'data: ' + json.dumps({'choices': [{'delta': {'tool_calls': [{'index': 0, 'id': 'call1', 'type': 'function', 'function': {'name': 'write_project_file', 'arguments': json.dumps({'path': 'report.md', 'content': '# Real report'})}}]}, 'finish_reason': 'tool_calls'}]})
            else:
                assert any(message.get('role') == 'tool' and 'created' in message.get('content', '') for message in kwargs['messages'])
                yield 'data: ' + json.dumps({'choices': [{'delta': {'content': 'Informe creado: report.md'}, 'finish_reason': 'stop'}]})
            yield 'data: [DONE]'
    progress = []
    async def checkpoint(text): progress.append(text)
    result = asyncio.run(execute_automation(Client(), task, on_progress=checkpoint))
    assert tmp_path.joinpath('report.md').read_text() == '# Real report'
    assert 'Informe creado' in result and 'write_project_file' in result
    assert any('en ejecución' in text for text in progress)


def test_empty_tool_scope_never_exposes_shell_or_files(task):
    task.update(workspaceAccess='none', workspaceBinding=None)
    class Client:
        async def stream_chat_completion(self, **kwargs):
            assert not kwargs['tools'] and kwargs['tool_choice'] == 'none'
            yield 'data: ' + json.dumps({'choices': [{'delta': {'content': 'No file access granted'}, 'finish_reason': 'stop'}]})
            yield 'data: [DONE]'
    assert 'No file access' in asyncio.run(execute_automation(Client(), task))


def test_cancellation_closes_a_stalled_provider(task):
    from core.inference.automation_executor import AutomationStopped
    closed = []
    class Client:
        async def stream_chat_completion(self, **kwargs):
            try:
                await asyncio.sleep(10)
                yield 'data: [DONE]'
            finally:
                closed.append(True)
    async def run():
        cancel = threading.Event()
        execution = asyncio.create_task(execute_automation(Client(), task, cancel_event=cancel))
        await asyncio.sleep(0.02)
        cancel.set()
        with pytest.raises(AutomationStopped):
            await asyncio.wait_for(execution, timeout=1)
    asyncio.run(run())
    assert closed == [True]


def test_linked_file_is_rejected(task, tmp_path):
    original = tmp_path / 'original.md'
    original.write_text('Private')
    linked = tmp_path / 'linked.md'
    import os
    os.link(original, linked)
    with pytest.raises(ValueError):
        workspace.WorkspaceTools(task).checked_path('linked.md')


def test_public_web_tool_feeds_sources_back_to_provider(task, monkeypatch):
    from core.channels import web
    task.update(workspaceAccess='none', workspaceBinding=None, webAccess=True)
    looked_up = []
    async def search(query):
        looked_up.append(query)
        return [{'title': 'Public evidence', 'url': 'https://example.com/reference', 'snippet': 'Verified evidence'}]
    monkeypatch.setattr(web, 'search', search)
    class Client:
        calls = 0
        async def stream_chat_completion(self, **kwargs):
            self.calls += 1
            if self.calls == 1:
                assert {tool['function']['name'] for tool in kwargs['tools']} == {'search_public_web', 'read_public_page'}
                yield 'data: ' + json.dumps({'choices': [{'delta': {'tool_calls': [{'index': 0, 'id': 'search', 'type': 'function', 'function': {'name': 'search_public_web', 'arguments': '{"query":"public astronomy news"}'}}]}, 'finish_reason': 'tool_calls'}]})
            else:
                assert any(message.get('role') == 'tool' and 'Verified evidence' in message.get('content', '') for message in kwargs['messages'])
                yield 'data: ' + json.dumps({'choices': [{'delta': {'content': 'Source: https://example.com/reference'}, 'finish_reason': 'stop'}]})
            yield 'data: [DONE]'
    result = asyncio.run(execute_automation(Client(), task))
    assert looked_up == ['public astronomy news'] and 'Public evidence' in result
