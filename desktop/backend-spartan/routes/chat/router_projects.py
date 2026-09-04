"""FastAPI route handlers for chat projects and workspace bindings."""

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from auth.authentication import get_current_subject
from loggers import get_logger
from state.project_workspace_link import validate_connectable_folder
from storage.studio_db import (
    ProjectWorkspaceError,
    delete_chat_project,
    ensure_chat_project_workspace,
    get_chat_project,
    list_chat_projects,
    update_chat_project,
    upsert_chat_project,
)
from utils.utils import log_and_http_error
from routes.chat.schemas import (
    ChatProject,
    ChatProjectDeleted,
    ChatProjectListResponse,
    ChatProjectPatch,
    ChatProjectWorkspacePatch,
)
from routes.chat.helpers import (
    _cancel_active_generations,
    _cancel_research_runs,
    _delete_project_rag_sources,
    _remove_sandboxes,
)

logger = get_logger(__name__)
router = APIRouter()

@router.get("/projects", response_model = ChatProjectListResponse)
def list_projects(
    include_archived: bool = Query(False), current_subject: str = Depends(get_current_subject)
):
    return ChatProjectListResponse(
        projects = [
            ChatProject(**(ensure_chat_project_workspace(project["id"]) or project))
            for project in list_chat_projects(include_archived = include_archived)
        ]
    )


@router.post("/projects", response_model = ChatProject)
def save_project(payload: ChatProject, current_subject: str = Depends(get_current_subject)):
    try:
        return ChatProject(**upsert_chat_project(payload.model_dump()))
    except ProjectWorkspaceError as exc:
        # A project is the only thing Studio writes to Documents, so a folder it
        # cannot create there fails here and nowhere else. Only this error, and
        # only its own path: the same upsert also opens the database, which
        # lives somewhere else entirely.
        raise log_and_http_error(
            exc,
            500,
            f"Could not create the project folder {exc.path}. Check that the "
            "folder is writable, or set UNSLOTH_STUDIO_PROJECTS_HOME to another "
            "location.",
            event = "chat_history.create_project_workspace_failed",
            log = logger,
        ) from exc


@router.get("/projects/{project_id}", response_model = ChatProject)
def get_project(project_id: str, current_subject: str = Depends(get_current_subject)):
    project = ensure_chat_project_workspace(project_id)
    if project is None:
        raise HTTPException(
            status_code = 404,
            detail = f"Project {project_id} not found",
        )
    return ChatProject(**project)


@router.patch("/projects/{project_id}", response_model = ChatProject)
def patch_project(
    project_id: str,
    payload: ChatProjectPatch,
    current_subject: str = Depends(get_current_subject),
):
    patch = payload.model_dump(exclude_unset = True)
    for field in ("name", "archived", "createdAt", "updatedAt"):
        if field in patch and patch[field] is None:
            raise HTTPException(status_code = 400, detail = f"{field} cannot be null")
    project = update_chat_project(project_id, patch)
    if project is not None:
        project = ensure_chat_project_workspace(project_id)
    if project is None:
        raise HTTPException(
            status_code = 404,
            detail = f"Project {project_id} not found",
        )
    return ChatProject(**project)


@router.patch("/projects/{project_id}/workspace", response_model = ChatProject)
def patch_project_workspace(
    project_id: str,
    payload: ChatProjectWorkspacePatch,
    current_subject: str = Depends(get_current_subject),
):
    valid, normalized_path = validate_connectable_folder(payload.connectedFolderPath)
    if not valid:
        raise HTTPException(status_code = 400, detail = normalized_path)
    if payload.workspaceAccess not in {"read", "write"}:
        raise HTTPException(status_code = 400, detail = "Invalid workspace access")
    project = update_chat_project(project_id, {"connectedFolderPath": normalized_path, "workspaceAccess": payload.workspaceAccess})
    if project is None:
        raise HTTPException(status_code = 404, detail = f"Project {project_id} not found")
    return ChatProject(**project)



@router.delete("/projects/{project_id}", response_model = ChatProjectDeleted)
async def delete_project(
    project_id: str,
    request: Request,
    delete_files: bool = Query(False),
    current_subject: str = Depends(get_current_subject),
):
    from starlette.concurrency import run_in_threadpool

    # Rows first, files last: a member chat can still be running a tool in the
    # workspace, and its cwd disappearing mid-call either kills the call or
    # leaves what it writes next in a directory no project owns.
    try:
        project = await run_in_threadpool(
            lambda: delete_chat_project(project_id, delete_files = False)
        )
    except Exception:
        # the row transaction may still have committed, and an ownerless scope has to be
        # retired by someone; periodic reconciliation is the fallback if this also fails
        try:
            if await run_in_threadpool(get_chat_project, project_id) is None:
                await run_in_threadpool(_delete_project_rag_sources, project_id)
        except Exception:  # noqa: BLE001 - preserve the original deletion error
            logger.warning(
                "failed to delete RAG sources for committed project %s", project_id, exc_info = True
            )
        raise
    if project is None:
        raise HTTPException(
            status_code = 404,
            detail = f"Project {project_id} not found",
        )
    # before any workspace work: the row is already gone, so a later failure must not
    # leave the scope owned by nothing
    try:
        await run_in_threadpool(_delete_project_rag_sources, project_id)
    except Exception:  # noqa: BLE001 - source cleanup must not block project deletion
        logger.warning("failed to delete RAG sources for project %s", project_id, exc_info = True)
    # The transaction is the only authority on membership and it runs first, so
    # a chat moved in just before is deleted and one moved out survives. An
    # earlier listing would stop a chat that is still there.
    member_ids = list(project.get("memberIds") or [])
    # By run id: the rows are gone by now, so there is nothing left to look up.
    _cancel_research_runs(request, list(project.get("activeResearchRunIds") or []))
    _cancel_active_generations(member_ids)
    if project.get("sandboxPath"):
        from core.inference.tools import (
            finish_workspace_delete_when_idle,
            forget_orphaned_project,
            forget_orphaned_project_if_gone,
            live_project_owns,
            project_session_id,
            record_orphaned_project,
            wait_for_sessions_idle,
        )
        from storage.studio_db import (
            delete_project_workspace,
            sandbox_is_referenced_elsewhere,
        )

        # Cancelling only asks: a call already in the executor still has its
        # cwd in there, and removing it strands what it writes next. The shared
        # id first, since a call in a project runs as `project-<id>`.
        shared = project_session_id(project_id)
        idle = (
            await run_in_threadpool(wait_for_sessions_idle, [shared, *member_ids])
            if delete_files
            else True
        )
        # A chat forked out of the project still shows cards for the shared
        # workspace, and the fork is not one of the ids deleted here.
        referenced = await run_in_threadpool(sandbox_is_referenced_elsewhere, shared, None)
        # The row went first, so another client can create a project with this
        # id in the window. It resolves to the same default path, and a tool
        # call of its own may be writing in there right now.
        recreated = await run_in_threadpool(get_chat_project, project_id) is not None
        if not delete_files:
            # The files stay, so the only job here is making them reachable: the
            # row that held a custom path is gone, and a fork's cards still name
            # this session.
            await run_in_threadpool(
                record_orphaned_project,
                project_id,
                project["sandboxPath"],
                False,
                project.get("rootPath"),
            )
        elif recreated:
            logger.warning(
                "Kept project workspace %s: a project was created with that id",
                project_id,
            )
        elif not idle:
            # Still running after the wait. Removing a live tool call's working
            # directory is worse than keeping files the user asked to delete,
            # and the record below means the next delete can still collect them.
            logger.warning(
                "Kept project workspace %s: a tool call was still running in it",
                project_id,
            )
        elif referenced:
            logger.info(
                "Kept project workspace %s: a surviving chat still shows its files",
                project_id,
            )
        if delete_files and idle and not referenced and not recreated:
            # Written down first: the delete can decline an unexpected path or
            # stop at a locked file, and the row that knew where this workspace
            # lives has already gone. The record is the only way back to it.
            await run_in_threadpool(
                record_orphaned_project,
                project_id,
                project["sandboxPath"],
                True,
                project.get("rootPath"),
            )
            # Once more, next to the delete itself: the record write above is
            # an await, and a project created in that window resolves to this
            # same path.
            if await run_in_threadpool(get_chat_project, project_id) is not None:
                logger.warning(
                    "Kept project workspace %s: a project was created with that id",
                    project_id,
                )
                # Only when the new row is about these folders: the default
                # root carries the project's name, so a project remade under
                # this id can sit elsewhere and the old one would be stranded.
                if await run_in_threadpool(
                    live_project_owns,
                    project_id,
                    project["sandboxPath"],
                    project.get("rootPath"),
                ):
                    await run_in_threadpool(forget_orphaned_project, project_id)
            else:
                await run_in_threadpool(delete_project_workspace, project)
                await run_in_threadpool(
                    forget_orphaned_project_if_gone,
                    project_id,
                    project["sandboxPath"],
                    project.get("rootPath"),
                )
        elif delete_files and not recreated:
            # Written down so it can be resolved and later collected: the row
            # that knew where it lives is gone. The root too, since the deferred
            # delete removes what the immediate one would; not for a live id.
            await run_in_threadpool(
                record_orphaned_project,
                project_id,
                project["sandboxPath"],
                True,
                project.get("rootPath"),
            )
            if not idle:
                # Nothing else would come back to it: the collection otherwise
                # waits for some later delete that may never happen.
                finish_workspace_delete_when_idle(project_id)
    # Each member chat had its own sandbox for anything it wrote before joining
    # the project, and deleting the project removes the only records of them.
    _, sandboxes_kept = await _remove_sandboxes(member_ids, delete_files)
    # Those folders are reachable from nothing now, so the caller is told which
    # ones survived and can offer the delete once.
    return ChatProjectDeleted(**project, sandboxes_kept = sandboxes_kept)


