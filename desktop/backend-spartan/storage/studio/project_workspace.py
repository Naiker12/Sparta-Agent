"""Project workspace directories, sandboxes, and safety checks."""

import json
import logging
import os
import platform
import re
import shutil
import sqlite3
from pathlib import Path
from typing import Optional

from utils.paths import ensure_dir, project_workspaces_root
from utils.paths.external_media import is_linux_run_media_path
from utils.paths.sensitive import (
    contains_sensitive_path_component as _shared_contains_sensitive_path_component,
)
from storage.studio.connection import get_connection
from storage.studio.exceptions import ProjectWorkspaceError

logger = logging.getLogger(__name__)

_PROJECT_WORKSPACE_SUBDIRS = ("sandbox",)

def _denied_path_prefixes() -> list[str]:
    """Platform-aware denylist of system directories."""
    system = platform.system()
    if system == "Linux":
        return ["/proc", "/sys", "/dev", "/etc", "/boot", "/run"]
    if system == "Darwin":
        # macOS realpath() resolves /etc -> /private/etc etc; include /private variants.
        return [
            "/System",
            "/Library",
            "/dev",
            "/etc",
            "/private/etc",
            "/tmp",
            "/private/tmp",
            "/var",
            "/private/var",
        ]
    if system == "Windows":
        win = os.environ.get("SystemRoot", r"C:\Windows")
        pf = os.environ.get("ProgramFiles", r"C:\Program Files")
        pf86 = os.environ.get("ProgramFiles(x86)", r"C:\Program Files (x86)")
        return [os.path.normcase(p) for p in [win, pf, pf86]]
    return []


def is_denied_system_path(path: str) -> bool:
    """True if *path* is, or descends from, a denied system directory.

    Mirrors the denylist add_scan_folder() enforces at registration so the
    browser refuses /etc, /proc, C:\\Windows, etc. even when the allowlist holds
    a broad root (a Windows drive root C:\\ or a legacy-registered / root). The
    /run carve-out keeps Linux removable-media mounts browseable. Expects an
    already-resolved (realpath) path so symlinks cannot escape into a denied subtree.
    """
    is_win = platform.system() == "Windows"
    check = os.path.normcase(path) if is_win else path
    for prefix in _denied_path_prefixes():
        if check == prefix or check.startswith(prefix + os.sep):
            if prefix == "/run" and is_linux_run_media_path(check):
                continue
            return True
    return False


def _contains_sensitive_path_component(path: str) -> bool:
    return _shared_contains_sensitive_path_component(path)


def contains_sensitive_path_component(path: str) -> bool:
    return _contains_sensitive_path_component(path)



def _project_slug(name: str) -> str:
    slug = re.sub(r"[^A-Za-z0-9._-]+", "-", name.strip()).strip(".-_")
    return slug[:48] or "project"


def _default_project_root(project: dict) -> str:
    project_id = str(project["id"])
    suffix = re.sub(r"[^A-Za-z0-9_-]+", "-", project_id)[:8].strip("-_") or "project"
    folder_name = f"{_project_slug(str(project.get('name') or 'Project'))}-{suffix}"
    return str(project_workspaces_root() / folder_name)


class ProjectWorkspaceError(OSError):
    """Raised when a project's workspace folder cannot be created.

    Tagged, and carrying the folder, so a caller can name it. The same upsert
    also touches the database directory, and that is a different path with a
    different fix.
    """

    def __init__(self, path: str, cause: OSError):
        super().__init__(str(cause))
        self.path = path


def _ensure_project_workspace(root_path: str) -> str:
    root = Path(root_path).expanduser()
    try:
        root_resolved = ensure_dir(root).resolve()
        for subdir in _PROJECT_WORKSPACE_SUBDIRS:
            ensure_dir(root_resolved / subdir)
    except OSError as exc:
        raise ProjectWorkspaceError(str(root), exc) from exc
    return str(root_resolved)


def sandbox_is_referenced_elsewhere(
    session_id: str, exclude_thread_id: "str | None" = None
) -> bool:
    """Whether a surviving chat still shows file cards for this sandbox.

    Forking clones the message content verbatim, so the fork's cards keep the
    source chat's session id. Deleting the source's files would leave those
    cards downloading nothing, in a chat the user did not delete.
    """
    if not session_id:
        return False
    conn = get_connection()
    try:
        # The LIKE only narrows, on the id as JSON writes it, so a quote or a
        # backslash is still found. Every hit is parsed and the id has to be a
        # sessionId value: a short one is a substring of ordinary prose.
        escaped = json.dumps(session_id)[1:-1]
        rows = conn.execute(
            """
            SELECT content_json FROM chat_messages
            WHERE (? IS NULL OR thread_id != ?) AND content_json LIKE ? ESCAPE '\\'
            """,
            (exclude_thread_id, exclude_thread_id, f"%{_like_escape(escaped)}%"),
        )
        for row in rows:
            if _mentions_session(row["content_json"], session_id):
                return True
        return False
    except sqlite3.Error:
        # A locked database is not an answer, and every caller reads False as
        # "nothing shows these files any more" before deleting them. Kept, so
        # the worst case is a folder collected on the next delete.
        logger.warning("Could not check references for sandbox %s; keeping it", session_id)
        return True
    finally:
        conn.close()


def _mentions_session(content_json: str, session_id: str) -> bool:
    """Whether this message's content names *session_id* as a sandbox."""
    try:
        content = json.loads(content_json)
    except (TypeError, ValueError):
        return False
    stack = [content]
    while stack:
        node = stack.pop()
        if isinstance(node, dict):
            if node.get("sessionId") == session_id:
                return True
            stack.extend(node.values())
        elif isinstance(node, list):
            stack.extend(node)
    return False


def _like_escape(value: str) -> str:
    for char in ("\\", "%", "_"):
        value = value.replace(char, "\\" + char)
    return value


def delete_project_workspace(project: dict) -> None:
    """Remove a deleted project's workspace directory.

    Separate from the row delete so the caller can stop the tool calls running
    in there first: pulling the working directory out from under a live
    subprocess is how a half-written file ends up outside any project.
    """
    _delete_project_workspace(project)


def _delete_project_workspace(project: dict) -> None:
    root_path = project.get("rootPath")
    if not root_path:
        return
    root = Path(root_path).expanduser()
    try:
        root_resolved = root.resolve(strict = False)
    except (OSError, RuntimeError, ValueError):
        logger.warning("Skipping project workspace delete for invalid path %r", root_path)
        return

    project_id = str(project["id"])
    suffix = re.sub(r"[^A-Za-z0-9_-]+", "-", project_id)[:8].strip("-_") or "project"
    if not root_resolved.name.endswith(f"-{suffix}"):
        logger.warning(
            "Skipping project workspace delete for unexpected project path %s",
            root_resolved,
        )
        return
    if root_resolved.parent == root_resolved or root_resolved == Path.home().resolve():
        logger.warning(
            "Skipping project workspace delete for unsafe project path %s",
            root_resolved,
        )
        return
    check = (
        os.path.normcase(str(root_resolved))
        if platform.system() == "Windows"
        else str(root_resolved)
    )
    for prefix in _denied_path_prefixes():
        if check == prefix or check.startswith(prefix + os.sep):
            logger.warning(
                "Skipping project workspace delete under denied path %s",
                root_resolved,
            )
            return
    if not root_resolved.exists():
        return
    if root_resolved.is_symlink() or not root_resolved.is_dir():
        logger.warning(
            "Skipping project workspace delete for non-directory path %s",
            root_resolved,
        )
        return
    shutil.rmtree(root_resolved)


def delete_chat_project_workspace(project: dict) -> None:
    """Backward-compatible name for callers predating sandbox-aware cleanup."""
    delete_project_workspace(project)


