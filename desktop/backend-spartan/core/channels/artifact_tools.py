"""Narrow Telegram tools for public downloads and confirmed file delivery."""
import asyncio
import concurrent.futures
import json
import os
import re
import tempfile
import threading
from pathlib import Path

from . import attachments, files, permissions

FETCH_PUBLIC_FILE_TOOL = {'type': 'function', 'function': {
    'name': 'fetch_public_file',
    'description': 'Fetch one user-requested file from a public HTTPS URL into the sender-bound temporary outbox. Returns only an opaque ID and file metadata; it does not send the file.',
    'parameters': {'type': 'object', 'properties': {'url': {'type': 'string', 'maxLength': 4096}}, 'required': ['url'], 'additionalProperties': False},
}}

STAGE_FILE_TOOL = {'type': 'function', 'function': {
    'name': 'stage_file_for_send',
    'description': 'Stage a previously created/downloaded outbox file by outbox_id, or a relative path from the currently selected authorized project. This only prepares a sender-bound confirmation button; it never sends a file.',
    'parameters': {'type': 'object', 'properties': {
        'outbox_id': {'type': 'string', 'pattern': '^[a-f0-9]{32}$'},
        'path': {'type': 'string', 'maxLength': 1024},
    }, 'additionalProperties': False, 'anyOf': [{'required': ['outbox_id']}, {'required': ['path']}]},
}}

_DENIED_NAMES = re.compile(r'(?i)(?:^|[. _-])(?:env|credentials?|secrets?|passwords?|tokens?|api[_-]?keys?|id_rsa|id_ed25519)(?:$|[. _-])')


def _account_is_current(account, user_id):
    from storage.channels import repository as repo
    current = repo.get_account(account['id'])
    if (not current or not current.get('enabled') or user_id not in current.get('allowed_user_ids', [])):
        return None
    return current


def build_executor(account, user_id, message, *, catalog, selected_project, project_context, documents, plans, event_loop):
    """Return an allowlisted tool executor; never exposes generic shell or write tools."""
    allowed = {item['function']['name'] for item in catalog}
    def execute(name, arguments, *, cancel_event=None, **_kwargs):
        cancel_event = cancel_event or threading.Event()
        if name not in allowed or cancel_event.is_set():
            return 'Error: tool unavailable or execution cancelled'
        current = _account_is_current(account, user_id)
        if not current:
            return 'Error: Telegram access is no longer authorized'
        if name == 'fetch_public_file':
            if (not permissions.file_allowed(current, user_id, 'web_download')
                    or not permissions.file_allowed(current, user_id, 'file_send') or selected_project):
                return 'Error: public file downloads are not authorized in this context'
            future = asyncio.run_coroutine_threadsafe(files.download(None, current, message, arguments.get('url')), event_loop)
            try:
                result = future.result(timeout=65)
            except concurrent.futures.TimeoutError:
                future.cancel()
                return 'Error: file download timed out'
            except Exception as error:
                code = getattr(error, 'code', 'file_unavailable')
                return 'Error: public file could not be fetched (' + str(code) + ')'
            return json.dumps({'outbox_id': result.outbox_id, 'filename': result.filename, 'size': result.size}, ensure_ascii=False)
        if name == 'generate_document':
            if not permissions.file_allowed(current, user_id, 'file_create'):
                return 'Error: document creation is not authorized'
            from core.documents.generation import generate_document
            from utils.paths import ensure_dir, tmp_root
            root = Path(tmp_root()) / 'telegram-generated'
            ensure_dir(root)
            with tempfile.TemporaryDirectory(prefix='channel-', dir=root) as workdir:
                result = generate_document(arguments, workdir, cancel_event)
                match = re.search(r'__FILES__:(\[[^\r\n]*\])\s*$', result)
                if not match or result.startswith('Error:'):
                    return result[:1000]
                try:
                    entries = json.loads(match.group(1))
                    entry = entries[0]
                    name = entry['name']
                    if Path(name).name != name:
                        raise ValueError()
                    raw = (Path(workdir) / name).read_bytes()
                    document = attachments.stage_document(account['id'], user_id, name, raw)
                except Exception:
                    return 'Error: generated document could not be staged'
            return json.dumps({'outbox_id': document.outbox_id, 'filename': document.filename, 'size': document.size}, ensure_ascii=False)
        if name == 'stage_file_for_send':
            if not permissions.file_allowed(current, user_id, 'file_send'):
                return 'Error: file delivery permission is disabled'
            identifier = arguments.get('outbox_id')
            if bool(identifier) == bool(arguments.get('path')):
                return 'Error: provide exactly one outbox_id or project-relative path'
            if identifier:
                try:
                    document, _raw = attachments.read_staged(account['id'], user_id, identifier)
                except attachments.AttachmentError as error:
                    return 'Error: staged file unavailable (' + error.code + ')'
            else:
                if not selected_project or not project_context or not _project_is_current(account['id'], user_id, selected_project['id']):
                    return 'Error: select an authorized project and enable project context before staging a project file'
                relative = arguments.get('path')
                if not isinstance(relative, str) or _DENIED_NAMES.search(Path(relative).name):
                    return 'Error: this project file is unavailable for delivery'
                try:
                    from core.inference.automation_workspace import WorkspaceTools, workspace_binding
                    task = {'projectId': selected_project['id'], 'workspaceAccess': 'read'}
                    task['workspaceBinding'] = workspace_binding(task)
                    workspace = WorkspaceTools(task)
                    path = workspace.checked_path(relative)
                    if not path.is_file() or path.stat().st_size > attachments.MAX_FILE_BYTES:
                        raise ValueError()
                    raw = path.read_bytes()
                    document = attachments.stage_document(account['id'], user_id, path.name, raw)
                except Exception:
                    return 'Error: project file unavailable; use a supported file inside the selected project'
            if all(existing.outbox_id != document.outbox_id for existing in documents):
                documents.append(document)
            return json.dumps({'ready_for_confirmation': True, 'outbox_id': document.outbox_id,
                               'filename': document.filename, 'size': document.size,
                               'note': 'No file was sent. The sender must press the Telegram confirmation button.'}, ensure_ascii=False)
        if name in ('list_project_files', 'read_project_file'):
            if not selected_project or not project_context or not _project_is_current(account['id'], user_id, selected_project['id']):
                return 'Error: project file access is not authorized'
            from core.inference.automation_workspace import WorkspaceTools, workspace_binding
            try:
                task = {'projectId': selected_project['id'], 'workspaceAccess': 'read'}
                task['workspaceBinding'] = workspace_binding(task)
                return WorkspaceTools(task).execute(name, arguments, cancel_event=cancel_event)
            except Exception:
                return 'Error: project file access is unavailable'
        if name in ('search_public_web', 'read_public_page', 'search_reference_images'):
            from . import web, images
            try:
                if name == 'search_public_web':
                    request = web.search(web.arguments(json.dumps(arguments)))
                elif name == 'read_public_page':
                    request = web.read_page(web.page_arguments(json.dumps(arguments)))
                else:
                    request = images.search(arguments.get('query'))
                future = asyncio.run_coroutine_threadsafe(request, event_loop)
                try:
                    found = future.result(timeout=30)
                finally:
                    if not future.done(): future.cancel()
                if name == 'search_reference_images':
                    return json.dumps({'images': [item.evidence() for item in found]}, ensure_ascii=False)
                return json.dumps({'sources': found}, ensure_ascii=False)
            except Exception:
                return 'Error: public lookup unavailable or request rejected'
        if name == 'propose_automation':
            from .automation_plans import prepare
            try:
                plan = prepare(current, user_id, arguments)
                plans.append(plan)
                return json.dumps({'plan': str(plan), 'confirmation_required': True}, ensure_ascii=False)
            except Exception:
                return 'Error: schedule plan is incomplete or unauthorized; nothing was scheduled'
        return 'Error: tool unavailable'
    return execute


def _project_is_current(account_id, user_id, project_id):
    from storage.channels import projects as channel_projects
    from storage.channels.repository import get_account
    current = get_account(account_id)
    selected = channel_projects.selected(account_id, user_id)
    return bool(current and selected and selected['id'] == project_id
                and permissions.project_context_allowed(current, user_id))
