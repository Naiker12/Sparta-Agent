"""Safe filesystem operations rooted at a connected chat-project folder."""

from __future__ import annotations

import os
from pathlib import Path


class ProjectWorkspacePathError(ValueError):
    """A requested relative path is invalid or escapes the project workspace."""


def connected_workspace(project: dict) -> str:
    """Return a canonical connected root; never fall back to the managed sandbox."""
    raw = project.get("connectedFolderPath")
    if not isinstance(raw, str) or not raw.strip():
        raise RuntimeError("This project does not have a connected folder.")
    try:
        root = os.path.realpath(raw)
    except OSError as exc:
        raise RuntimeError("The connected folder cannot be resolved.") from exc
    if not os.path.isdir(root):
        raise RuntimeError("The connected folder is no longer available.")
    return root


def resolve_project_path(root: str, relative_path: str, *, allow_root: bool = False) -> str:
    """Resolve a user path without following a new path through a symlink.

    Existing ancestors are canonicalised first, so ``link/new.txt`` cannot create
    a file outside the workspace when ``link`` is a junction or symlink.
    """
    if not isinstance(relative_path, str):
        raise ProjectWorkspacePathError("path must be a string")
    if os.path.isabs(relative_path):
        raise ProjectWorkspacePathError("path must be relative to the project folder")
    candidate = os.path.abspath(os.path.join(root, relative_path))
    ancestor = candidate
    while not os.path.lexists(ancestor):
        parent = os.path.dirname(ancestor)
        if parent == ancestor:
            raise ProjectWorkspacePathError("path cannot be resolved")
        ancestor = parent
    canonical_ancestor = os.path.realpath(ancestor)
    resolved = os.path.normpath(os.path.join(canonical_ancestor, os.path.relpath(candidate, ancestor)))
    canonical_root = os.path.realpath(root)
    if resolved != canonical_root and not resolved.startswith(canonical_root + os.sep):
        raise ProjectWorkspacePathError("path is outside the connected folder")
    if resolved == canonical_root and not allow_root:
        raise ProjectWorkspacePathError("the project root cannot be modified")
    return resolved


def display_path(root: str, path: str) -> str:
    """Return a portable, non-absolute path for API/tool responses."""
    return Path(os.path.relpath(path, root)).as_posix() if path != root else ""
