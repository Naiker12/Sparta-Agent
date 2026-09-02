"""Validation for a workspace capability bound to one chat thread."""

from __future__ import annotations

import os


def resolve_thread_workspace(binding: dict | None) -> str | None:
    """Return the canonical root only when the saved folder is still the same."""
    if not binding:
        return None
    raw_path = binding.get("canonicalPath")
    if not isinstance(raw_path, str) or not raw_path:
        return None
    try:
        canonical = os.path.realpath(raw_path)
        stat = os.stat(canonical)
    except OSError:
        return None
    expected = binding.get("filesystemIdentity")
    actual = f"{stat.st_dev}:{stat.st_ino}"
    if isinstance(expected, str) and expected and expected != actual:
        return None
    return canonical if os.path.isdir(canonical) else None


def resolve_writable_thread_workspace(binding: dict | None) -> str | None:
    """Return a root for the generic code runner only with full write access.

    `write_no_delete` is deliberately excluded: that runner cannot prove an
    arbitrary command will not delete a file.
    """
    if not binding or binding.get("access") != "write":
        return None
    return resolve_thread_workspace(binding)
