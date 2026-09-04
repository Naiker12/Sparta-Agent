"""Sandbox file serving router.

Extracted from monolithic routes/inference.py to preserve SRP and clean architecture.
"""
from __future__ import annotations

import logging
import os
import re as _re
from pathlib import Path
from typing import Optional
from urllib.parse import quote as _urlquote

from fastapi import APIRouter, HTTPException, Request, Response, status
from fastapi.responses import StreamingResponse

from auth import get_current_subject

logger = logging.getLogger(__name__)

router = APIRouter()

async def _authenticate_header_or_query(request: Request, token: Optional[str]) -> str:
    auth_header = request.headers.get("authorization")
    if auth_header and auth_header.lower().startswith("bearer "):
        jwt_token = auth_header[7:]
    elif token:
        jwt_token = token
    else:
        raise HTTPException(
            status_code = status.HTTP_401_UNAUTHORIZED,
            detail = "Missing authentication token",
        )
    from fastapi.security import HTTPAuthorizationCredentials

    creds = HTTPAuthorizationCredentials(scheme = "Bearer", credentials = jwt_token)
    return await get_current_subject(creds)


# =====================================================================
# Sandbox file serving  (/sandbox/{session_id}/{filename})
# =====================================================================

_SANDBOX_MEDIA_TYPES = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
}


def _sandbox_dir_for(session_id: str, create: bool = True) -> str:
    """The session's sandbox directory.

    ``create=False`` resolves the path without materialising it, so a read-only
    request cannot leave a directory behind for every id it is asked about.
    """
    from core.inference.tools import get_sandbox_workdir, resolve_sandbox_workdir

    resolver = get_sandbox_workdir if create else resolve_sandbox_workdir
    return os.path.realpath(resolver(session_id))


# A tool may write into a subdirectory, so a single segment is not enough. Taken
# from the snapshot walk rather than restated, so the card can never advertise a
# file this route would then refuse.
from core.inference.tools import (
    _INTERNAL_SANDBOX_FILES,
    _MAX_SANDBOX_PATH_SEGMENTS,
    _MAX_SNAPSHOT_DIRS,
    _MAX_SNAPSHOT_FILES,
    _servable_segment,
)


def _contained_sandbox_path(session_id: str, filename: str) -> tuple[str, str]:
    """(sandbox_dir, absolute path) for a user-supplied relative path.

    Character allowlist per segment and realpath containment as the image route
    has always done, factored out so the two callers cannot drift. Containment
    is decided by the resolved path, never by the string, so a symlink pointing
    out of the sandbox is refused like any other escape.
    """
    parts = [part for part in filename.replace("\\", "/").split("/") if part not in ("", ".")]
    if not parts or len(parts) > _MAX_SANDBOX_PATH_SEGMENTS:
        raise HTTPException(status_code = 404, detail = "Not found")
    for part in parts:
        # os.path.join would let an absolute segment (or a Windows drive) throw
        # the prefix away; realpath containment catches it, this is the guard in front.
        if part == ".." or os.path.isabs(part) or os.path.splitdrive(part)[0]:
            raise HTTPException(status_code = 404, detail = "Not found")
        if not _re.fullmatch(r"[^/\\\x00-\x1f]{1,255}", part):
            raise HTTPException(status_code = 404, detail = "Not found")
    sandbox_dir = _sandbox_dir_for(session_id, create = False)
    file_path = os.path.realpath(os.path.join(sandbox_dir, *parts))
    if file_path != sandbox_dir and not file_path.startswith(sandbox_dir + os.sep):
        raise HTTPException(
            status_code = status.HTTP_403_FORBIDDEN,
            detail = "Access denied",
        )
    return sandbox_dir, file_path


def _sandbox_listing_names(sandbox_dir: str) -> "list[str]":
    """Relative paths of the files in a sandbox, subdirectories included.

    Bounded the same way the snapshot walk is, so a chat that unpacked an
    archive cannot turn a listing into a filesystem crawl.
    """
    names: "list[str]" = []
    visited = 0
    for base, dirs, entries in os.walk(sandbox_dir):
        visited += 1
        if visited > _MAX_SNAPSHOT_DIRS:
            return names
        depth = base[len(sandbox_dir) :].count(os.sep)
        # depth 0 is the sandbox itself, whose files are one segment.
        # Segments the route would refuse are dropped here too, so the two walks agree.
        dirs[:] = (
            []
            if depth >= _MAX_SANDBOX_PATH_SEGMENTS - 1
            else [d for d in sorted(dirs) if not d.startswith(".") and _servable_segment(d)]
        )
        for entry in sorted(entries):
            # Mirrors the snapshot, dotfiles included, and like it hides the
            # bookkeeping only where we write it.
            if base == sandbox_dir and entry in _INTERNAL_SANDBOX_FILES:
                continue
            if not _servable_segment(entry):
                continue
            path = os.path.join(base, entry)
            try:
                if not os.path.isfile(path) or os.path.islink(path):
                    continue
            except OSError:
                continue
            names.append(os.path.relpath(path, sandbox_dir).replace(os.sep, "/"))
            if len(names) >= _MAX_SNAPSHOT_FILES:
                return names
    return names


def _sandbox_listing(sandbox_dir: str) -> "list[dict]":
    """Name, size and mtime for everything this chat's tools left behind."""
    files = []
    if not os.path.isdir(sandbox_dir):
        return files
    for name in _sandbox_listing_names(sandbox_dir):
        path = os.path.join(sandbox_dir, name)
        try:
            stat = os.stat(path)
        except OSError:
            continue
        files.append(
            {
                "name": name,
                "size": stat.st_size,
                "modified": int(stat.st_mtime),
                "inline": os.path.splitext(name)[1].lower() in _SANDBOX_MEDIA_TYPES,
            }
        )
    return files


@router.get("/sandbox/{session_id}")
async def list_sandbox_files(
    session_id: str,
    request: Request,
    token: Optional[str] = None,
    session: Optional[str] = None,
):
    """Where this chat's files are, and what is in there.

    The path answers "where did my file go"; before this the only way to find
    one was to search the filesystem by hand.
    """
    await _authenticate_header_or_query(request, token)

    from starlette.concurrency import run_in_threadpool

    def _resolve_and_list() -> "tuple[str, list[dict]]":
        # The query form carries an id a path segment cannot: an API client can
        # use one with a slash in it, and ASGI decodes %2F before route matching.
        sandbox_dir = _sandbox_dir_for(session or session_id, create = False)
        if not os.path.isdir(sandbox_dir):
            # Right after an upgrade the background move can rename the legacy
            # tree into place between resolving and walking it. One more resolve
            # finds it at the destination rather than showing an empty chat.
            sandbox_dir = _sandbox_dir_for(session or session_id, create = False)
        return sandbox_dir, _sandbox_listing(sandbox_dir)

    # Resolving scans the root for a marked directory and may read the legacy
    # root too, so it belongs in the worker with the walk: on a slow or network
    # filesystem either one would hold the event loop for every other request.
    sandbox_dir, files = await run_in_threadpool(_resolve_and_list)
    return {"path": sandbox_dir, "files": files}


@router.post("/sandbox/{session_id}/reveal")
async def reveal_sandbox_dir(
    session_id: str,
    request: Request,
    token: Optional[str] = None,
    session: Optional[str] = None,
):
    """Open this chat's sandbox directory in the OS file manager.

    The file manager is the backend host's, so this only means anything when the
    backend runs on the user's own machine, which is the desktop app.
    """
    await _authenticate_header_or_query(request, token)

    from starlette.concurrency import run_in_threadpool

    def _resolve_existing() -> "str | None":
        sandbox_dir = _sandbox_dir_for(session or session_id, create = False)
        if not os.path.isdir(sandbox_dir):
            # One more resolve, as the listing does: the legacy move can rename
            # the tree into place between resolving it and looking.
            sandbox_dir = _sandbox_dir_for(session or session_id, create = False)
        return sandbox_dir if os.path.isdir(sandbox_dir) else None

    # Resolving scans the sandbox root, so it stays off the event loop.
    sandbox_dir = await run_in_threadpool(_resolve_existing)
    if sandbox_dir is None:
        raise HTTPException(status_code = 404, detail = "This chat has no folder yet")

    from pathlib import Path

    from utils.paths.path_utils import reveal_in_file_manager

    try:
        # expect_dir: a sandbox is always a directory, and a running tool can
        # replace its own with a file, which would take the file branch and show
        # the parent, here the root holding every other chat's sandbox.
        await run_in_threadpool(reveal_in_file_manager, Path(sandbox_dir), expect_dir = True)
    except FileNotFoundError:
        # Two things raise this: the sandbox going between resolve and open, and
        # Popen not finding the file manager at all. Only the first is "no
        # folder"; the second reported that way hides a missing xdg-open.
        if os.path.isdir(sandbox_dir):
            logger.error(f"Failed to reveal sandbox {sandbox_dir}", exc_info = True)
            raise HTTPException(status_code = 500, detail = "Failed to open file manager")
        raise HTTPException(status_code = 404, detail = "This chat has no folder yet")
    except Exception:
        logger.error(f"Failed to reveal sandbox {sandbox_dir}", exc_info = True)
        raise HTTPException(status_code = 500, detail = "Failed to open file manager")
    return {"status": "ok", "path": sandbox_dir}


@router.api_route("/sandbox/{session_id}/{filename:path}", methods = ["GET", "HEAD"])
async def serve_sandbox_file(
    session_id: str,
    filename: str,
    request: Request,
    token: Optional[str] = None,
    session: Optional[str] = None,
):
    """
    Serve a file a tool call created in this chat's sandbox.

    Images keep their real media type and render inline. Everything else is an
    opaque attachment: the model picks these filenames, so an inline text/html
    or image/svg+xml would be same-origin script execution. nosniff plus a
    Content-Disposition filename is what makes serving them safe.

    Accepts auth via an Authorization header or a query token. Studio uses an
    authenticated fetch and object URL; query auth remains for older clients.
    """
    # ── Authentication (header or query param) ──────────────────
    await _authenticate_header_or_query(request, token)

    # ── Filename sanitization + path containment ────────────────
    import stat as _stat

    from starlette.concurrency import run_in_threadpool

    safe_filename = os.path.basename(filename)

    # In a worker like the listing: resolving the sandbox touches the
    # filesystem, and so does the open below.
    def _open_checked() -> "tuple[int, int]":
        _dir, path = _contained_sandbox_path(session or session_id, filename)
        if not os.path.isfile(path):
            # As in the listing: the legacy move can rename the tree out from
            # under a path resolved a moment ago, and the file is at the new one.
            _dir, path = _contained_sandbox_path(session or session_id, filename)
        try:
            # O_NOFOLLOW: tool code runs in this directory and can put a link
            # here between the check and the open.
            handle = os.open(path, os.O_RDONLY | getattr(os, "O_NOFOLLOW", 0))
        except OSError:
            raise HTTPException(status_code = 404, detail = "Not found") from None
        try:
            info = os.fstat(handle)
            # The descriptor is what gets read, so it is what the containment
            # check has to be about: resolved again, and the same file, or a
            # parent swapped for a link would be served from outside the root.
            _dir, again = _contained_sandbox_path(session or session_id, filename)
            checked = os.stat(again)
            if not _stat.S_ISREG(info.st_mode) or (checked.st_dev, checked.st_ino) != (
                info.st_dev,
                info.st_ino,
            ):
                raise HTTPException(status_code = 404, detail = "Not found")
        except BaseException:
            os.close(handle)
            raise
        return handle, info.st_size

    handle, size = await run_in_threadpool(_open_checked)
    head_only = getattr(request, "method", "GET").upper() == "HEAD"
    if head_only:
        # FastAPI does not add HEAD to a GET route, and the client asks with one
        # to refresh the session and settle whether the file is still there.
        # Nothing is read: the artifact can be gigabytes.
        os.close(handle)

    ext = os.path.splitext(safe_filename)[1].lower()
    media_type = _SANDBOX_MEDIA_TYPES.get(ext)
    headers = {
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
    }
    if media_type is None:
        media_type = "application/octet-stream"
        # RFC 5987: ASCII fallback plus UTF-8 form, so "ventas año.csv" saves.
        ascii_name = safe_filename.encode("ascii", "replace").decode("ascii").replace('"', "_")
        quoted = _urlquote(safe_filename)
        headers["Content-Disposition"] = (
            f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quoted}"
        )

    headers["Content-Length"] = str(size)
    if head_only:
        return Response(status_code = 200, media_type = media_type, headers = headers)

    def _read():
        # Exactly the length in the header: another call can still append to
        # this file, and a body longer than Content-Length is cut off or
        # refused by the client rather than simply carrying the extra.
        remaining = size
        with os.fdopen(handle, "rb") as opened:
            while remaining > 0:
                chunk = opened.read(min(64 * 1024, remaining))
                if not chunk:
                    return
                remaining -= len(chunk)
                yield chunk

    return StreamingResponse(_read(), media_type = media_type, headers = headers)


