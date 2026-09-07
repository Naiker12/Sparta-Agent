from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from auth.authentication import get_current_subject
from storage.studio.memory_tasks import delete_task, get_task, list_tasks, upsert_task

router = APIRouter()
class TaskInput(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    prompt: str = Field(min_length=1, max_length=20000)
    scheduleType: str = Field(default='interval', pattern='^(interval|once)$')
    intervalSeconds: int | None = Field(default=None, ge=60)
    runAt: int | None = None
    threadId: str | None = None
    enabled: bool = True

@router.get('')
def tasks(current_subject: str = Depends(get_current_subject)): return {'tasks': list_tasks()}

@router.post('')
def create(body: TaskInput, current_subject: str = Depends(get_current_subject)): return upsert_task(body.model_dump())

@router.get('/{task_id}')
def detail(task_id: str, current_subject: str = Depends(get_current_subject)):
    task = get_task(task_id)
    if not task: raise HTTPException(404, 'Task not found')
    return task

@router.patch('/{task_id}')
def update(task_id: str, body: TaskInput, current_subject: str = Depends(get_current_subject)): return upsert_task(body.model_dump(), task_id)

@router.delete('/{task_id}')
def remove(task_id: str, current_subject: str = Depends(get_current_subject)):
    if not delete_task(task_id): raise HTTPException(404, 'Task not found')
    return {'ok': True}
