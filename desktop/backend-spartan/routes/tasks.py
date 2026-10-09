from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, ValidationError
from typing import Literal
import asyncio
from auth.authentication import get_current_subject, authenticated_via_api_key
from storage.studio.memory_tasks import delete_task, get_task, list_tasks, upsert_task

router = APIRouter()
@router.get('/delivery-destination')
def delivery_destination(current_subject: str = Depends(get_current_subject)):
    from core.inference.automation_delivery import personal_destination
    account = personal_destination(current_subject)
    return {'accountId': account['id'], 'botUsername': account.get('bot_username', '')} if account else {'accountId': None}

@router.get('/runs/by-thread/{thread_id}')
def run_by_thread(thread_id: str, current_subject: str = Depends(get_current_subject)):
    from storage.studio.connection import get_connection
    conn = get_connection()
    try:
        row = conn.execute('SELECT r.id,r.status,r.output,r.error,r.thread_id AS threadId,r.started_at AS startedAt,r.finished_at AS finishedAt FROM agent_task_runs r JOIN agent_tasks t ON t.id=r.task_id WHERE r.thread_id=? AND t.owner_subject=?', (thread_id, current_subject)).fetchone()
        if not row:
            raise HTTPException(404, 'Automation execution not found')
        return dict(row)
    finally:
        conn.close()

@router.get('/notifications')
def notifications(since: int = 0, current_subject: str = Depends(get_current_subject)):
    from storage.studio.memory_tasks import task_notifications, has_active_task_run
    return {'events': task_notifications(current_subject, since), 'subject': current_subject, 'active': has_active_task_run(current_subject)}


@router.post('/runs/{run_id}/cancel')
def cancel_run(run_id: str, current_subject: str = Depends(get_current_subject)):
    from storage.studio.connection import get_connection
    from storage.studio.memory_tasks import finish_task_preview
    conn = get_connection()
    try:
        if not conn.execute('SELECT 1 FROM agent_task_runs r JOIN agent_tasks t ON t.id=r.task_id WHERE r.id=? AND t.owner_subject=?', (run_id, current_subject)).fetchone():
            raise HTTPException(404, 'Automation execution not found')
    finally:
        conn.close()
    finish_task_preview(run_id, error='Execution cancelled by user', cancelled=True)
    return {'ok': True}
class TaskInput(BaseModel):
    executionMode: Literal['text', 'agent'] = 'text'
    workspaceAccess: Literal['none', 'read', 'write'] = 'none'
    webAccess: bool = False
    title: str = Field(min_length=1, max_length=300)
    prompt: str = Field(min_length=1, max_length=20000)
    scheduleType: str = Field(default='interval', pattern='^(interval|once|weekly)$')
    timezone: str = Field(default='UTC', max_length=100)
    weekdays: list[int] = Field(default_factory=list, max_length=7)
    localTime: str = Field(default='09:00', pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    notify: bool = True
    intervalSeconds: int | None = Field(default=None, ge=60)
    runAt: int | None = None
    threadId: str | None = None
    projectId: str | None = None
    enabled: bool = False

class TaskPatch(BaseModel):
    executionMode: Literal['text', 'agent'] | None = None
    workspaceAccess: Literal['none', 'read', 'write'] | None = None
    webAccess: bool | None = None
    title: str | None = Field(default=None, min_length=1, max_length=300)
    prompt: str | None = Field(default=None, min_length=1, max_length=20000)
    scheduleType: str | None = Field(default=None, pattern='^(interval|once|weekly)$')
    timezone: str | None = Field(default=None, max_length=100)
    weekdays: list[int] | None = Field(default=None, max_length=7)
    localTime: str | None = Field(default=None, pattern=r'^([01]\d|2[0-3]):[0-5]\d$')
    notify: bool | None = None
    intervalSeconds: int | None = Field(default=None, ge=60)
    runAt: int | None = None
    threadId: str | None = None
    projectId: str | None = None
    enabled: bool | None = None

@router.get('')
def tasks(current_subject: str = Depends(get_current_subject)): return {'tasks': list_tasks(current_subject)}

@router.post('')
def create(body: TaskInput, current_subject: str = Depends(get_current_subject)):
    if body.enabled: raise HTTPException(422, 'Automatic execution is not available yet; save a draft')
    try: return upsert_task(body.model_dump(), owner_subject=current_subject)
    except ValueError as error: raise HTTPException(422, str(error)) from error

@router.get('/{task_id}')
def detail(task_id: str, current_subject: str = Depends(get_current_subject)):
    task = get_task(task_id, current_subject)
    if not task: raise HTTPException(404, 'Task not found')
    return task

@router.patch('/{task_id}')
def update(task_id: str, body: TaskPatch, current_subject: str = Depends(get_current_subject)):
    existing = get_task(task_id, current_subject)
    if not existing: raise HTTPException(404, 'Task not found')
    if body.enabled and not existing['enabled']:
        raise HTTPException(422, 'Activate the task with a configured provider and model')
    try:
        merged = TaskInput.model_validate({**existing, **body.model_dump(exclude_unset=True)})
        task = upsert_task(merged.model_dump(), task_id, current_subject)
    except (ValueError, ValidationError) as error:
        raise HTTPException(422, str(error)) from error
    if not task: raise HTTPException(404, 'Task not found')
    return task

@router.delete('/{task_id}')
def remove(task_id: str, current_subject: str = Depends(get_current_subject)):
    if not delete_task(task_id, current_subject): raise HTTPException(404, 'Task not found')
    return {'ok': True}

class PreviewInput(BaseModel):
    providerId: str = Field(min_length=1, max_length=200)
    model: str = Field(min_length=1, max_length=300)

@router.post('/{task_id}/activate')
def activate(task_id: str, body: PreviewInput, current_subject: str = Depends(get_current_subject), via_api_key: bool = Depends(authenticated_via_api_key)):
    from routes.provider_credentials import require_ui_session
    from core.inference.task_scheduler import make_client
    from storage.studio.memory_tasks import activate_task
    require_ui_session(via_api_key)
    if not get_task(task_id, current_subject): raise HTTPException(404, 'Task not found')
    try:
        make_client(body.providerId, body.model)
        return activate_task(task_id, current_subject, body.providerId, body.model)
    except LookupError as error: raise HTTPException(404, 'Task not found') from error
    except Exception as error: raise HTTPException(422, 'Check provider, credentials and future schedule') from error

@router.post('/{task_id}/preview')
async def preview(task_id: str, body: PreviewInput,
                  current_subject: str = Depends(get_current_subject),
                  via_api_key: bool = Depends(authenticated_via_api_key)):
    from routes.provider_credentials import require_ui_session, resolve_provider_api_key_or_400
    from storage.providers_db import get_provider
    from core.inference.providers import get_base_url
    from core.inference.external_provider import ExternalProviderClient
    from core.inference.task_preview import preview_task
    from storage.studio.memory_tasks import begin_task_preview, finish_task_preview
    require_ui_session(via_api_key)
    task = get_task(task_id, current_subject)
    if not task: raise HTTPException(404, 'Task not found')
    provider = get_provider(body.providerId)
    if not provider or not provider['is_enabled'] or provider['provider_type'] == 'openai_codex':
        raise HTTPException(422, 'Choose an enabled API provider; subscription connections are not supported')
    if body.model not in (provider.get('models') or provider.get('available_models') or []):
        raise HTTPException(422, 'Choose a configured model')
    key = resolve_provider_api_key_or_400(body.providerId, None)
    client = ExternalProviderClient(provider['provider_type'], provider.get('base_url') or get_base_url(provider['provider_type']), key)
    try:
        run_id = begin_task_preview(task_id, current_subject)
    except LookupError as error:
        raise HTTPException(404, 'Task not found') from error
    except ValueError as error:
        raise HTTPException(409, str(error)) from error
    try:
        output = await preview_task(client, body.model, task['prompt'])
        finish_task_preview(run_id, output=output)
    except asyncio.CancelledError:
        finish_task_preview(run_id, error='Test interrupted')
        raise
    except Exception as error:
        # Never persist raw provider exceptions: these may contain credentials.
        finish_task_preview(run_id, error='Test failed or exceeded 90 seconds; check provider configuration')
        raise HTTPException(502, 'Test failed or timed out; no external actions were performed') from error
    return get_task(task_id, current_subject)


@router.post('/{task_id}/agent-test')
async def agent_test(task_id: str, body: PreviewInput,
                     current_subject: str = Depends(get_current_subject),
                     via_api_key: bool = Depends(authenticated_via_api_key)):
    from routes.provider_credentials import require_ui_session
    from core.inference.task_scheduler import make_client
    from core.inference.automation_executor import execute_automation
    from core.inference.automation_workspace import workspace_binding
    from storage.studio.memory_tasks import begin_agent_test, finish_task_preview, _now
    from storage.studio.automation_chats import checkpoint, heartbeat
    import threading
    require_ui_session(via_api_key)
    task = get_task(task_id, current_subject)
    if not task:
        raise HTTPException(404, 'Task not found')
    if task.get('executionMode') != 'agent':
        raise HTTPException(422, 'Choose agent execution first')
    task.update(providerId=body.providerId, model=body.model)
    try:
        client = make_client(body.providerId, body.model)
        task['workspaceBinding'] = workspace_binding(task)
        run_id = begin_agent_test(task, current_subject)
    except ValueError as error:
        raise HTTPException(422, 'Check provider, folder permissions and active executions') from error
    cancel = threading.Event()
    task['runId'] = run_id
    async def watch():
        while not cancel.is_set():
            if not await asyncio.to_thread(heartbeat, run_id, _now()):
                cancel.set()
                return
            await asyncio.sleep(2)
    watcher = asyncio.create_task(watch())
    import time
    last_checkpoint = 0
    async def progress(text):
        nonlocal last_checkpoint
        now = time.monotonic()
        if now - last_checkpoint >= 0.5:
            await asyncio.to_thread(checkpoint, run_id, text, _now())
            last_checkpoint = now
    try:
        output = await execute_automation(client, task, on_progress=progress, cancel_event=cancel)
        finish_task_preview(run_id, output=output)
    except asyncio.CancelledError:
        finish_task_preview(run_id, error='Agent test interrupted')
        raise
    except Exception as error:
        finish_task_preview(run_id, error='Agent test failed; check provider and folder permissions')
        raise HTTPException(502, 'Agent test failed; partial progress is retained in its chat') from error
    finally:
        cancel.set()
        watcher.cancel()
        await asyncio.gather(watcher, return_exceptions=True)
    return get_task(task_id, current_subject)
