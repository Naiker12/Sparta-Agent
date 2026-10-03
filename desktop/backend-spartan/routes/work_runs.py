"""Authenticated work ledger API. Worker operations are not exposed to clients."""
from collections.abc import Callable
from typing import TypeVar

from fastapi import APIRouter, Depends, HTTPException, Query

from auth.authentication import get_current_subject
from core.work_requests import CreateWorkRequest, WorkAction
from storage.work_runs_db import WorkConflictError, WorkRunRepository
from core.prompt_queue_contracts import SaveQueueCheckpoint
from storage.prompt_queues_db import PromptQueueRepository

router = APIRouter()
T = TypeVar("T")


def repository() -> WorkRunRepository:
    return WorkRunRepository()


def queue_repository() -> PromptQueueRepository:
    return PromptQueueRepository()


def _execute(operation: Callable[[], T]) -> T:
    try:
        return operation()
    except KeyError as exc:
        raise HTTPException(404, "Work run not found") from exc
    except WorkConflictError as exc:
        raise HTTPException(409, str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc


@router.post("")
def create(body: CreateWorkRequest, subject: str = Depends(get_current_subject),
           repo: WorkRunRepository = Depends(repository)):
    return _execute(lambda: repo.create(subject, body.requestKey, body.request.model_dump()))


@router.get("")
def list_runs(limit: int = Query(default=100, ge=1, le=500),
              subject: str = Depends(get_current_subject),
              repo: WorkRunRepository = Depends(repository)):
    return {"runs": repo.list(subject, limit)}


@router.get("/overview")
def overview(limit: int = Query(default=100, ge=1, le=200), offset: int = Query(default=0, ge=0),
             subject: str = Depends(get_current_subject),
             repo: PromptQueueRepository = Depends(queue_repository)):
    return repo.overview(subject, limit, offset)


@router.get("/prompt-queues")
def list_queues(threadId: str = Query(min_length=1, max_length=200),
                subject: str = Depends(get_current_subject),
                repo: PromptQueueRepository = Depends(queue_repository)):
    return {"queues": repo.list_for_thread(subject, threadId)}


@router.put("/prompt-queues/{queue_id}")
def save_queue(queue_id: str, body: SaveQueueCheckpoint,
               subject: str = Depends(get_current_subject),
               repo: PromptQueueRepository = Depends(queue_repository)):
    if not 1 <= len(queue_id) <= 200:
        raise HTTPException(422, "Invalid queue id")
    return _execute(lambda: repo.save(subject, queue_id, body.expectedRevision, body.checkpoint))


@router.get("/{run_id}")
def detail(run_id: str, subject: str = Depends(get_current_subject),
           repo: WorkRunRepository = Depends(repository)):
    return _execute(lambda: repo.get(subject, run_id))


@router.get("/{run_id}/events")
def events(run_id: str, after: int = Query(default=0, ge=0),
           subject: str = Depends(get_current_subject),
           repo: WorkRunRepository = Depends(repository)):
    return {"events": _execute(lambda: repo.events(subject, run_id, after))}


@router.post("/{run_id}/actions")
def action(run_id: str, body: WorkAction, subject: str = Depends(get_current_subject),
           repo: WorkRunRepository = Depends(repository)):
    run = _execute(lambda: repo.get(subject, run_id))
    if run["source_kind"] != "manual":
        raise HTTPException(409, "Chat work is controlled from its conversation")
    return _execute(lambda: repo.transition(subject, run_id, body.expectedRevision, body.action))
