"""Helper functions, cleanup tasks, and conversion routines for chat routes."""

import base64
import logging
from typing import Optional

from fastapi import HTTPException, Request
from pydantic import ValidationError

from loggers import get_logger
from storage.studio_db import (
    get_chat_project,
    get_chat_thread,
)
from routes.chat.schemas import (
    ChatThread,
    ChatThreadSettings,
)

logger = get_logger(__name__)

def thread_from_row(row: dict) -> ChatThread:
    """Build a ChatThread from a DATABASE row, tolerating a snapshot it cannot read.

    `settings` is the first strictly validated nested model Studio builds out of the
    database rather than off the wire, and a stored snapshot outlives the build that
    wrote it: a newer Studio adding a seventeenth setting, widening an enum or
    raising a bound writes a blob this one rejects. Refusing it here 500s the chat on
    open and takes the entire history export with it, since the export validates
    every thread. `_json_loads` already shrugs off JSON that will not parse; JSON
    that parses but postdates this build deserves the same treatment.

    Only the read is forgiving. The wire contract stays strict in both directions, so
    a client still cannot invent a setting, and the row itself is left untouched,
    which means upgrading again restores whatever this build had to drop.
    """
    settings = row.get("settings")
    if isinstance(settings, dict):
        row = {**row, "settings": readable_thread_settings(settings)}
    elif settings is not None:
        row = {**row, "settings": None}
    return ChatThread(**row)


def readable_thread_settings(settings: dict) -> Optional[dict]:
    """The part of a stored snapshot this build can validate, or None if none of it is."""
    known = {k: v for k, v in settings.items() if k in ChatThreadSettings.model_fields}
    # Drop exactly the fields pydantic names and retry: a version gap usually
    # carries several at once, so removing one guess at a time gives up too early.
    for _ in range(len(known) + 1):
        try:
            ChatThreadSettings.model_validate(known)
            return known
        except ValidationError as exc:
            bad = {str(e["loc"][0]) for e in exc.errors() if e.get("loc")}
            if not bad or not bad & set(known):
                return None
            known = {k: v for k, v in known.items() if k not in bad}
    return None


def _unreadable_thread_settings(stored: dict) -> dict:
    """The part of a stored snapshot this build cannot validate, and so must not delete.

    An older Studio opening a database a newer one wrote drops the fields it cannot read.
    A blind replacement would make that loss permanent instead of temporary, so a write
    carries forward everything the writer could not have known about: unknown keys, and
    known keys holding values this build rejects.
    """
    readable = readable_thread_settings(stored) or {}
    return {k: v for k, v in stored.items() if k not in readable}


def _settings_write_from_patch(patch: dict) -> Optional[dict]:
    """Take `settings` / `settingsPatch` out of `patch` and describe the write they ask for.

    `settings` replaces the snapshot, `settingsPatch` applies only the fields it names,
    for a client that knows what changed but not what else the row holds. The result is
    handed to storage rather than executed here: the read, the merge and the guarded
    metadata write all have to be one transaction, or two tabs each build a replacement
    from the same stale row, or a rejected precondition returns 409 having already
    committed the settings.
    """
    replace = "settings" in patch
    merge = "settingsPatch" in patch
    seq = patch.pop("settingsSeq", None)
    writer = patch.pop("settingsWriter", None)
    if not (replace or merge):
        return None
    incoming = patch.pop("settingsPatch", None)
    if merge:
        # A merge is the more specific instruction; sending both is a client bug.
        patch.pop("settings", None)
    else:
        incoming = patch.pop("settings")
    if incoming is None:
        # Clearing is the one instruction that means the whole column. A merge of
        # nothing is not an instruction at all, so it leaves the row alone.
        if replace and not merge:
            return {"clear": True, "seq": seq, "writer": writer}
        return None
    return {
        "merge": incoming if merge else None,
        "replace": None if merge else incoming,
        "seq": seq,
        "writer": writer,
        "keep_unreadable": _unreadable_thread_settings,
    }




def _missing_project_error(project_id: Optional[str]) -> HTTPException:
    """The row references a project that is gone, whether the check or the write noticed it."""
    return HTTPException(status_code = 404, detail = f"Project {project_id} not found")


def _missing_thread_error(thread_id: str) -> HTTPException:
    return HTTPException(status_code = 404, detail = f"Thread {thread_id} not found")


def _deleted_thread_error(thread_id: str) -> HTTPException:
    return HTTPException(status_code = 410, detail = f"Thread {thread_id} was deleted")




def _cancel_deleted_research_runs(request: Request, run_ids: list[str]) -> None:
    """Signal workers for active runs captured by the deletion transaction."""
    supervisor = getattr(request.app.state, "research_supervisor", None)
    if supervisor is None:
        return
    for run_id in run_ids:
        try:
            supervisor.cancel(run_id)
        except Exception:  # noqa: BLE001 - cancellation is best-effort after commit
            logger.warning(
                "chat_history.cancel_deleted_research_failed run_id=%s",
                run_id,
                exc_info = True,
            )


def _cancel_active_research(request: Request, thread_ids: list[str]) -> None:
    """Compatibility path for callers that must cancel runs before deleting their rows."""
    if not thread_ids:
        return
    try:
        from storage import research_runs_db
    except Exception:  # noqa: BLE001 - research storage optional/unavailable
        return
    supervisor = getattr(request.app.state, "research_supervisor", None)
    for thread_id in thread_ids:
        try:
            active = research_runs_db.list_active(thread_id)
        except Exception:  # noqa: BLE001
            continue
        for run in active:
            try:
                status = research_runs_db.request_cancel(run["id"])
                if supervisor is not None and status == "cancelling":
                    supervisor.cancel(run["id"])
            except Exception:  # noqa: BLE001
                logger.warning(
                    "chat_history.cancel_active_research_failed run_id=%s",
                    run.get("id"),
                    exc_info = True,
                )


def _cancel_research_runs(request: Request, run_ids: list[str]) -> None:
    """Stop these research runs by id. Best effort, like every cleanup here."""
    if not run_ids:
        return
    try:
        from storage import research_runs_db
    except Exception:  # noqa: BLE001 - research storage optional/unavailable
        return
    supervisor = getattr(request.app.state, "research_supervisor", None)
    for run_id in run_ids:
        # The row is usually already gone here, which makes request_cancel raise:
        # the supervisor is what actually stops the worker, so it is told first
        # and the status update is the best-effort half.
        if supervisor is not None:
            try:
                supervisor.cancel(run_id)
            except Exception:  # noqa: BLE001
                logger.warning("Could not signal research run %s", run_id, exc_info = True)
        try:
            research_runs_db.request_cancel(run_id)
        except Exception:  # noqa: BLE001
            pass  # no row to update, which is the ordinary case after a delete


def _cancel_active_generations(thread_ids: list[str]) -> None:
    """Stop any generation still running for these threads.

    The sandbox goes with the thread, but a request that has not reached the
    executor yet would dispatch its tool call afterwards, recreate the folder,
    and write files no chat can reach. The in-flight guard only covers calls
    already inside the executor. Best effort: this must never break a delete.
    """
    if not thread_ids:
        return
    try:
        from state import active_generations
    except Exception:  # noqa: BLE001 - never block a delete on this
        return
    for thread_id in thread_ids:
        try:
            active_generations.cancel_thread(thread_id)
        except Exception:  # noqa: BLE001
            continue




async def _remove_sandboxes(thread_ids, delete_files: bool) -> "tuple[int, list[str]]":
    """Drop each thread's sandbox off the event loop. Never raises.

    Returns how many went and which ids still have files. The chat is the only
    way to those files, so a caller that never offered the choice can offer it
    once it knows there was something to keep.
    """
    from starlette.concurrency import run_in_threadpool

    def _remove() -> "tuple[int, list[str]]":
        from core.inference.tools import (
            record_kept_sandbox,
            remove_session_sandbox,
            sandbox_removal_deferred,
            session_sandbox_has_files,
        )
        from storage.studio_db import sandbox_is_referenced_elsewhere

        removed, kept = 0, []
        for thread_id in thread_ids:
            # The row went first, and another tab can upsert the same id in the
            # meantime. That chat is alive, with a tool call possibly running in
            # here, so its folder is not this delete's to take.
            if get_chat_thread(thread_id) is not None:
                continue
            # A fork clones the message content, cards and all, so the source
            # chat's files are still on screen in a chat the user kept.
            if delete_files and sandbox_is_referenced_elsewhere(thread_id):
                if session_sandbox_has_files(thread_id):
                    kept.append(thread_id)
                    # The user asked for these files and the chat is gone, so
                    # nothing comes back to that folder: written down, and the
                    # collection below takes it once the last fork goes too.
                    record_kept_sandbox(thread_id)
                continue
            # Again, next to the removal: the reference scan above reads
            # every message, and another tab can recreate the chat while it runs.
            if get_chat_thread(thread_id) is not None:
                continue
            if remove_session_sandbox(thread_id, delete_files = delete_files):
                removed += 1
            # A removal that had to wait for a running tool call is reported as
            # kept: that call can still write a file, and this is the only
            # answer the caller gets.
            elif sandbox_removal_deferred(thread_id) or session_sandbox_has_files(thread_id):
                kept.append(thread_id)
        return removed, kept

    try:
        result = await run_in_threadpool(_remove)
    except Exception:
        logger.warning("chat_history.sandbox_cleanup_failed", exc_info = True)
        return 0, []
    # Whatever this delete asked for: the last chat referencing a workspace the
    # user already asked to delete can go through the plain path, and only the
    # records marked pending are ever collected.
    from core.inference.tools import collect_orphaned_project_workspaces

    await run_in_threadpool(collect_orphaned_project_workspaces)
    return result




def _decode_attachment_base64(payload: str) -> bytes:
    """Strict base64 decode of a stored payload.

    Normalizes first: strips whitespace, fixes padding, accepts the URL-safe
    alphabet. validate=False would silently drop bad characters and serve
    corrupted bytes instead of failing, so raise 422 on anything else.
    """
    import base64

    normalized = "".join(payload.split())
    altchars = b"-_" if ("-" in normalized or "_" in normalized) else None
    normalized += "=" * (-len(normalized) % 4)
    try:
        return base64.b64decode(normalized, altchars = altchars, validate = True)
    except Exception as exc:  # noqa: BLE001 - corrupt stored payload
        raise HTTPException(status_code = 422, detail = "Attachment data is corrupt") from exc


_AUDIO_FORMAT_MEDIA_TYPES = {
    "mp3": "audio/mpeg",
    "wav": "audio/wav",
    "ogg": "audio/ogg",
    "flac": "audio/flac",
}


def _safe_image_media_type(media_type: str) -> str:
    """Clamp a data-URL media type to something inert to render.

    Imported chats store image parts verbatim, so the embedded type can be
    text/html or image/svg+xml; echoing those would execute markup with the
    app origin when opened. Anything not a plain raster type downloads as
    bytes instead.
    """
    lowered = media_type.strip().lower()
    if lowered.startswith("image/") and lowered != "image/svg+xml":
        return lowered
    return "application/octet-stream"




def _delete_project_rag_sources(project_id: str) -> None:
    """Retire an ownerless project scope and reap it when RAG is available."""
    from storage import rag_db
    from core.rag import folder_sync, store as rag_store

    scope = rag_store.project_scope(project_id)
    # a project id is reusable, and the tombstone outlives the scope, so retiring one that
    # another client already recreated would permanently disable RAG for the new project
    with folder_sync.scope_lock(scope):
        checked_at = folder_sync.now_iso()
        if get_chat_project(project_id) is not None:
            return
        folder_sync.retire_scope(scope, checked_at)
    if rag_db.rag_available():
        folder_sync.delete_retired_scope(scope)



