"""Resolve and validate the user-selected workspace for a chat project."""

from __future__ import annotations

import os
from pathlib import Path
from typing import Optional


def resolve_active_workspace(project: dict) -> str:
    """Return a writable workspace without trusting UI-only permission state.

    Mutable code tools run with this directory as their process working tree.
    A read-only connection therefore stays outside their reach and uses the
    managed sandbox; browsing the connected folder goes through guarded IPC.
    """
    connected = project.get("connectedFolderPath")
    if (
        project.get("workspaceAccess") == "write"
        and isinstance(connected, str)
        and connected
        and os.path.isdir(connected)
    ):
        return os.path.realpath(connected)
    sandbox = project.get("sandboxPath")
    if not isinstance(sandbox, str) or not sandbox:
        raise ValueError("Project does not have a sandbox workspace")
    return sandbox


def validate_connectable_folder(value: Optional[str]) -> tuple[bool, Optional[str]]:
    """Validate a folder selected as a writable project workspace.

    ``None`` disconnects the folder. v1 accepts existing directories only and
    rejects filesystem roots and Sparta's own checkout.
    """
    if value is None:
        return True, None
    if not isinstance(value, str) or not value.strip():
        return False, "A connected folder must be a non-empty path or null."

    candidate = Path(value).expanduser()
    try:
        resolved = candidate.resolve(strict = True)
    except OSError:
        return False, "The selected folder does not exist or cannot be resolved."
    if not resolved.is_dir():
        return False, "The selected path is not a folder."
    if resolved.parent == resolved:
        return False, "Filesystem roots cannot be connected as project workspaces."

    # state/ -> backend-spartan/ -> desktop/ -> repository root
    sparta_root = Path(__file__).resolve().parents[3]
    try:
        resolved.relative_to(sparta_root)
    except ValueError:
        pass
    else:
        return False, "The Sparta Agent installation folder cannot be connected."
    return True, str(resolved)
