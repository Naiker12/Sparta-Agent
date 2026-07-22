from __future__ import annotations

import asyncio
import json
import logging
import sys
import threading
import uuid
from contextvars import ContextVar
from pathlib import Path
from typing import Any

from sparta_security.permission_policy import PermissionDecision, get_policy

from sparta_tools.permission_policies import (
    _IS_ELECTRON,
    _TIMEOUT_SECONDS,
    _detect_language,
    _is_inside_workspace,
    get_agent_autonomy,
    set_agent_autonomy,
)

logger = logging.getLogger("sparta_ai.tools.permission_broker")

_session_cache: dict[str, dict[tuple[str, str], bool]] = {}

_current_session: ContextVar[str] = ContextVar("_current_session", default="")

_pending: dict[str, asyncio.Future[bool]] = {}
_pending_sync: dict[str, threading.Event] = {}
_pending_sync_results: dict[str, tuple[bool, str]] = {}


def _emit_permission_request(
    request_id: str,
    tool_name: str,
    subject: str,
    preview: str,
    kind: str = "file_access",
) -> None:
    """Emit a permission:request event on stdout (same channel as stream tokens).

    Args:
        request_id:  Unique id for this request.
        tool_name:   Name of the tool requesting access (e.g. "write_file_tool").
        subject:     What is being accessed — path for ``file_access``, server_id for ``mcp_install``.
        preview:     Short description shown to the user.
        kind:        Nature of the permission: ``file_access`` (default) or ``mcp_install``.
    """
    msg: dict[str, Any] = {
        "event": "permission:request",
        "data": {
            "request_id": request_id,
            "tool": tool_name,
            "path": subject,
            "preview": preview,
            "kind": kind,
        },
    }
    try:
        sys.stdout.write(json.dumps(msg, ensure_ascii=False) + "\n")
        sys.stdout.flush()
    except (BrokenPipeError, OSError):
        sys.exit(0)


async def request_permission(
    tool_name: str,
    resolved_path: Path,
    preview: str = "",
    request_id: str = "",
    force: bool = False,
) -> bool:
    """Check or request permission for an out-of-workspace path.

    Args:
        tool_name:     Name of the tool requesting access (e.g. "write_file_tool").
        resolved_path: Absolute resolved path the tool wants to access.
        preview:       Short description or diff preview shown to the user.
        request_id:    Optional parent request_id for scoping the session cache.
        force:         If True, request user confirmation even inside workspace.

    Returns:
        True if access is granted, False if denied.
    """
    decision = get_policy().get_decision(tool_name, resolved_path)
    if decision == PermissionDecision.DENY:
        logger.info("Permission DENY by policy: %s → %s", tool_name, resolved_path)
        return False

    if _is_inside_workspace(resolved_path) and not force and decision == PermissionDecision.ALLOW:
        return True

    sid = _current_session.get()
    cache_key = (tool_name, str(resolved_path))
    session_cache = _session_cache.get(sid, {})
    if cache_key in session_cache:
        logger.debug("Permission cache hit for %s %s", tool_name, resolved_path)
        return session_cache[cache_key]

    if not _IS_ELECTRON:
        logger.warning(
            "Out-of-workspace access denied (non-Electron env): %s → %s",
            tool_name, resolved_path,
        )
        return False

    perm_id = str(uuid.uuid4())
    loop = asyncio.get_event_loop()
    future: asyncio.Future[bool] = loop.create_future()
    _pending[perm_id] = future

    _emit_permission_request(perm_id, tool_name, str(resolved_path), preview)
    logger.info("Permission requested: %s for %s (id=%s)", tool_name, resolved_path, perm_id)

    try:
        approved = await asyncio.wait_for(asyncio.shield(future), timeout=_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        logger.warning("Permission request timed out (id=%s) — denying", perm_id)
        approved = False
    finally:
        _pending.pop(perm_id, None)

    if approved:
        if sid not in _session_cache:
            _session_cache[sid] = {}
        _session_cache[sid][cache_key] = True
        logger.info("Permission granted (session): %s → %s", tool_name, resolved_path)
    else:
        logger.info("Permission denied: %s → %s", tool_name, resolved_path)

    return approved


def request_permission_sync(
    tool_name: str,
    resolved_path: Path,
    preview: str = "",
    force: bool = False,
) -> bool:
    """Sync version of request_permission for sync @tool functions.

    Uses threading.Event for cross-thread signal instead of asyncio.Future.
    Designed to be called from ToolNode executor threads.

    Args:
        tool_name:     Name of the tool requesting access.
        resolved_path: Absolute resolved path to access.
        preview:       Short description or diff preview.
        force:         If True, request user confirmation even when the path
                       is inside the workspace. Used by destructive tools such
                       as delete_file_tool.

    Returns:
        True if access is granted, False if denied.
    """
    decision = get_policy().get_decision(tool_name, resolved_path)
    if decision == PermissionDecision.DENY:
        logger.info("Permission DENY by policy: %s → %s", tool_name, resolved_path)
        return False

    if _is_inside_workspace(resolved_path) and not force and decision == PermissionDecision.ALLOW:
        return True

    sid = _current_session.get()
    cache_key = (tool_name, str(resolved_path))
    session_cache = _session_cache.get(sid, {})
    if cache_key in session_cache:
        logger.debug("Permission cache hit (sync) for %s %s", tool_name, resolved_path)
        return session_cache[cache_key]

    if not _IS_ELECTRON:
        logger.warning(
            "Out-of-workspace access denied (non-Electron sync): %s → %s",
            tool_name, resolved_path,
        )
        return False

    perm_id = str(uuid.uuid4())
    event = threading.Event()
    _pending_sync[perm_id] = event

    _emit_permission_request(perm_id, tool_name, str(resolved_path), preview)
    logger.info("Permission requested (sync): %s for %s (id=%s)", tool_name, resolved_path, perm_id)

    triggered = event.wait(timeout=_TIMEOUT_SECONDS)
    if not triggered:
        logger.warning("Permission request timed out (sync id=%s) — denying", perm_id)
        approved = False
        remember = "once"
    else:
        approved, remember = _pending_sync_results.pop(perm_id, (False, "once"))

    _pending_sync.pop(perm_id, None)

    if approved and remember == "session":
        if sid not in _session_cache:
            _session_cache[sid] = {}
        _session_cache[sid][cache_key] = True
        logger.info("Permission granted (sync, session cached): %s → %s", tool_name, resolved_path)
    elif approved:
        logger.info("Permission granted (sync, once): %s → %s", tool_name, resolved_path)
    else:
        logger.info("Permission denied (sync): %s → %s", tool_name, resolved_path)

    return approved


def resolve_permission(perm_id: str, approved: bool, remember: str = "once") -> bool:
    """Resolve a pending permission request.

    Called by server.py when it receives a ``permission.respond`` message
    from Electron main process.  Handles both async (asyncio.Future) and
    sync (threading.Event) callers.

    Args:
        perm_id:  The request_id from the permission:request event.
        approved: Whether the user approved (True) or denied (False).
        remember: Cache policy sent by the dialog:
                  "once"    — do NOT cache, this approval is single-use.
                  "session" — cache for the current session.

    Returns:
        True if a matching pending request was found and resolved,
        False if the id is unknown (already resolved or bogus).
    """
    sync_event = _pending_sync.get(perm_id)
    if sync_event is not None:
        _pending_sync_results[perm_id] = (approved, remember)
        sync_event.set()
        return True

    future = _pending.get(perm_id)
    if future is not None:
        if not future.done():
            future.set_result(approved)
        # NOTE: async path always caches in request_permission.
        # The remember parameter is tracked but the async path uses
        # session caching for v1.  Future work: pass remember through
        # to request_permission for proper once-vs-session handling.
        return True

    logger.warning("resolve_permission: unknown id=%s", perm_id)
    return False


def request_permission_sync_generic(
    kind: str,
    subject: str,
    tool_name: str = "",
    preview: str = "",
) -> bool:
    """Request permission for a generic action not based on a file path.

    Unlike ``request_permission_sync``, this function:
      - Does NOT check ``_is_inside_workspace`` (the concept doesn't apply).
      - Does NOT cache approvals (every request is presented to the user).
      - Always requires user confirmation in Desktop mode.

    Args:
        kind:      Nature of the action (e.g. ``"mcp_install"``).
        subject:   What the action is about (e.g. ``"github"`` for an MCP server id).
        tool_name: Name of the tool requesting access.
        preview:   Short description shown in the dialog (e.g. the command to run).

    Returns:
        True if the user approved, False otherwise.
    """
    if not _IS_ELECTRON:
        logger.warning(
            "Permission denied (non-Electron, kind=%s): %s",
            kind, subject,
        )
        return False

    perm_id = str(uuid.uuid4())
    event = threading.Event()
    _pending_sync[perm_id] = event

    _emit_permission_request(
        request_id=perm_id,
        tool_name=tool_name,
        subject=subject,
        preview=preview,
        kind=kind,
    )
    logger.info("Permission requested (sync, kind=%s): %s (id=%s)", kind, subject, perm_id)

    triggered = event.wait(timeout=_TIMEOUT_SECONDS)
    if not triggered:
        logger.warning("Permission request timed out (kind=%s, id=%s) — denying", kind, perm_id)
        approved = False
    else:
        # For generic permissions, remember is always "once" — no caching
        approved, _remember = _pending_sync_results.pop(perm_id, (False, "once"))

    _pending_sync.pop(perm_id, None)

    if approved:
        logger.info("Permission granted (kind=%s): %s", kind, subject)
    else:
        logger.info("Permission denied (kind=%s): %s", kind, subject)

    return approved


def request_diff_approval(
    file_path: str,
    original_content: str,
    new_content: str,
    language: str = "",
) -> bool:
    """Ask the user to approve a code change via Monaco DiffEditor.

    Emits an editor:diff_proposed event and waits for the user to accept
    or reject the change in the DiffEditor dialog.

    Args:
        file_path: Path to the file being changed.
        original_content: The current file content.
        new_content: The proposed new content.
        language: Language identifier for syntax highlighting.

    Returns:
        True if the user approved, False if rejected.
    """
    if not _IS_ELECTRON:
        logger.warning("Diff approval denied (non-Electron env): %s", file_path)
        return False

    perm_id = str(uuid.uuid4())
    event = threading.Event()
    _pending_sync[perm_id] = event

    msg = {
        "event": "editor:diff_proposed",
        "data": {
            "request_id": perm_id,
            "file_path": file_path,
            "original_content": original_content,
            "new_content": new_content,
            "language": language or _detect_language(file_path),
        },
    }
    try:
        sys.stdout.write(json.dumps(msg, ensure_ascii=False) + "\n")
        sys.stdout.flush()
    except (BrokenPipeError, OSError):
        sys.exit(0)

    logger.info("Diff proposed for %s (id=%s)", file_path, perm_id)

    triggered = event.wait(timeout=_TIMEOUT_SECONDS)
    if not triggered:
        logger.warning("Diff approval timed out (id=%s) — denying", perm_id)
        approved = False
    else:
        approved, _remember = _pending_sync_results.pop(perm_id, (False, "once"))

    _pending_sync.pop(perm_id, None)

    if approved:
        logger.info("Diff approved: %s", file_path)
    else:
        logger.info("Diff rejected: %s", file_path)

    return approved


def clear_session_cache(session_id: str | None = None) -> None:
    if session_id:
        _session_cache.pop(session_id, None)
    else:
        _session_cache.clear()


def set_current_session(session_id: str) -> None:
    _current_session.set(session_id)
