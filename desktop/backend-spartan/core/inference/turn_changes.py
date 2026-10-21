"""Bounded, persistent workspace snapshots for one assistant execution.

Snapshots never modify Git or the workspace. Restore is explicit, checks every
current file before writing, and refuses partial/concurrent/expired captures.
"""
from __future__ import annotations

import base64
from contextlib import contextmanager
from functools import wraps
import inspect
import difflib
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import stat
import tempfile
import time
import uuid

MAX_FILES = 5000
MAX_DIRS = 2000
MAX_FILE_BYTES = 512 * 1024
MAX_TOTAL_BYTES = 16 * 1024 * 1024
MAX_DIFF_LINES = 20_000
MAX_DIFF_CHARS = 160_000
ACTIVE_SECONDS = 24 * 3600
SKIP_DIRS = {".git", ".venv", ".venv-review", "venv", "node_modules", "__pycache__", ".cache", ".next", ".vite", "dist", "dist-electron", "build", "coverage"}


class ChangeConflict(ValueError):
    pass


def _identity(root):
    info = os.stat(root)
    if not stat.S_ISDIR(info.st_mode):
        raise ChangeConflict("workspace_unavailable")
    return f"{info.st_dev}:{info.st_ino}"


def _linked(info):
    return stat.S_ISLNK(info.st_mode) or bool(getattr(info, "st_file_attributes", 0) & 0x400)


def _path(root, relative):
    parts = relative.split("/")
    if not parts or any(part in {"", ".", ".."} or "\\" in part or ":" in part or "\x00" in part for part in parts):
        raise ChangeConflict("invalid_path")
    target = Path(root)
    for part in parts:
        target = target / part
        try:
            info = target.lstat()
            if _linked(info) or (stat.S_ISREG(info.st_mode) and info.st_nlink > 1):
                raise ChangeConflict("linked_path")
        except FileNotFoundError:
            pass
    return target


def _read(root, relative, *, allow_opaque=False):
    target = _path(root, relative)
    try:
        info = target.lstat()
    except FileNotFoundError:
        return None
    if not stat.S_ISREG(info.st_mode):
        raise ChangeConflict("file_changed_or_too_large")
    if info.st_size > MAX_FILE_BYTES:
        if allow_opaque:
            return {"hash": None, "data": None, "mode": stat.S_IMODE(info.st_mode), "stamp": [info.st_size, info.st_mtime_ns, info.st_dev, info.st_ino]}
        raise ChangeConflict("file_changed_or_too_large")
    with target.open("rb") as stream:
        data = stream.read(MAX_FILE_BYTES + 1)
        after = os.fstat(stream.fileno())
    if len(data) > MAX_FILE_BYTES or (info.st_dev, info.st_ino, info.st_mtime_ns, info.st_size) != (after.st_dev, after.st_ino, after.st_mtime_ns, after.st_size):
        raise ChangeConflict("file_changed_during_read")
    return {"hash": hashlib.sha256(data).hexdigest(), "data": base64.b64encode(data).decode("ascii"), "mode": stat.S_IMODE(info.st_mode)}


def snapshot(root):
    files, complete, size, visited, seen = {}, True, 0, 0, 0
    def failed(_error):
        nonlocal complete
        complete = False
    for base, dirs, names in os.walk(root, followlinks=False, onerror=failed):
        visited += 1
        if visited > MAX_DIRS:
            return files, False
        safe_dirs = []
        for name in sorted(dirs):
            if name in SKIP_DIRS:
                continue
            try:
                if not _linked((Path(base) / name).lstat()):
                    safe_dirs.append(name)
            except OSError:
                complete = False
        dirs[:] = safe_dirs
        for name in sorted(names):
            # Credential files are not copied into the review journal.
            if name == ".env" or name.startswith(".env.") or name in {".git", "credentials", "id_rsa", "id_ed25519"}:
                continue
            seen += 1
            if seen > MAX_FILES:
                return files, False
            relative = (Path(base) / name).relative_to(root).as_posix()
            try:
                value = _read(root, relative, allow_opaque=True)
                if value is None:
                    complete = False
                    continue
                if value["data"] is not None:
                    size += len(value["data"]) * 3 // 4
                    if size > MAX_TOTAL_BYTES:
                        value["data"] = None
                files[relative] = value
            except (OSError, ValueError):
                complete = False
    return files, complete


def _text(entry):
    if entry is None:
        return []
    if entry["data"] is None:
        return None
    data = base64.b64decode(entry["data"])
    if b"\0" in data:
        return None
    try:
        lines = data.decode("utf-8").splitlines(keepends=True)
        return lines if len(lines) <= MAX_DIFF_LINES else None
    except UnicodeDecodeError:
        return None


def changed_files(before, after, complete):
    files = []
    for name in sorted(before.keys() | after.keys()):
        old, new = before.get(name), after.get(name)
        if old is not None and new is not None and old.get("hash") is not None and old["hash"] == new["hash"] and old["mode"] == new["mode"]:
            continue
        if old == new:
            continue
        # An omitted file could have exceeded a capture limit, not been created
        # or deleted. Do not advertise invented additions/deletions.
        if not complete and (old is None or new is None):
            continue
        old_lines, new_lines = _text(old), _text(new)
        binary = old_lines is None or new_lines is None
        added = removed = None
        if not binary:
            added = removed = 0
            for op, i, j, a, b in difflib.SequenceMatcher(None, old_lines, new_lines).get_opcodes():
                if op in {"replace", "insert"}: added += b - a
                if op in {"replace", "delete"}: removed += j - i
        files.append({"path": name, "status": "added" if old is None else "deleted" if new is None else "modified", "additions": added, "deletions": removed, "binary": binary})
    return files


def _replace(target, entry):
    if entry is None:
        target.unlink()
        return
    target.parent.mkdir(parents=True, exist_ok=True)
    fd, temporary = tempfile.mkstemp(prefix=".sparta-restore-", dir=target.parent)
    try:
        with os.fdopen(fd, "wb") as stream:
            stream.write(base64.b64decode(entry["data"]))
        os.chmod(temporary, entry["mode"])
        os.replace(temporary, target)
    finally:
        Path(temporary).unlink(missing_ok=True)


class TurnChanges:
    def __init__(self, database, *, require_provenance=False):
        self.database = Path(database)
        self.require_provenance = require_provenance

    @contextmanager
    def _connect(self):
        self.database.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        conn = sqlite3.connect(self.database, timeout=30)
        conn.execute("CREATE TABLE IF NOT EXISTS turn_changes (id TEXT PRIMARY KEY, owner TEXT NOT NULL, thread TEXT NOT NULL, root TEXT NOT NULL, identity TEXT NOT NULL, created REAL NOT NULL, state TEXT NOT NULL, complete INTEGER NOT NULL, before_json TEXT NOT NULL, after_json TEXT, writes_json TEXT NOT NULL DEFAULT '{}')")
        conn.row_factory = sqlite3.Row
        if "writes_json" not in {column[1] for column in conn.execute("PRAGMA table_info(turn_changes)")}:
            conn.execute("ALTER TABLE turn_changes ADD COLUMN writes_json TEXT NOT NULL DEFAULT '{}'")
        try:
            with conn:
                yield conn
        finally:
            conn.close()

    def begin(self, owner, thread, root):
        root = os.path.realpath(root)
        identity = _identity(root)
        with self._connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            if self.database.stat().st_size > 512 * 1024 * 1024 or conn.execute("SELECT count(*) FROM turn_changes").fetchone()[0] >= 100:
                raise ChangeConflict("capture_storage_full")
            # Do not attribute two assistant runs writing the same folder to one
            # another. An abandoned capture expires, but remains reviewable.
            if conn.execute("SELECT 1 FROM turn_changes WHERE root=? AND state='running' AND created>?", (root, time.time() - ACTIVE_SECONDS)).fetchone():
                conn.execute("UPDATE turn_changes SET complete=0 WHERE root=? AND state='running'", (root,))
                conn.commit()
                raise ChangeConflict("workspace_busy")
            before, complete = snapshot(root)
            change_id = uuid.uuid4().hex
            conn.execute("INSERT INTO turn_changes (id,owner,thread,root,identity,created,state,complete,before_json) VALUES (?,?,?,?,?,?,?,?,?)", (change_id, owner, thread, root, identity, time.time(), "running", complete, json.dumps(before)))
        return {"id": change_id, "threadId": thread}

    def _row(self, conn, owner, thread, change_id, root):
        row = conn.execute("SELECT * FROM turn_changes WHERE id=? AND owner=? AND thread=?", (change_id, owner, thread)).fetchone()
        if row is None:
            raise KeyError("changes_not_found")
        if os.path.realpath(root) != row["root"] or _identity(root) != row["identity"]:
            raise ChangeConflict("workspace_changed")
        return row

    def finish(self, owner, thread, change_id, root):
        with self._connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            row = self._row(conn, owner, thread, change_id, root)
            if row["state"] == "running":
                after, complete = snapshot(root) if time.time() - row["created"] <= ACTIVE_SECONDS else ({}, False)
                conn.execute("UPDATE turn_changes SET after_json=?,complete=?,state='finished' WHERE id=?", (json.dumps(after), bool(row["complete"]) and complete, change_id))
        return self.review(owner, thread, change_id, root)

    def review(self, owner, thread, change_id, root, path=None):
        with self._connect() as conn:
            row = self._row(conn, owner, thread, change_id, root)
        before = json.loads(row["before_json"])
        after = json.loads(row["after_json"] or "{}")
        files = changed_files(before, after, bool(row["complete"])) if row["after_json"] is not None else []
        if path is not None:
            if not any(item["path"] == path for item in files):
                raise KeyError("file_not_in_changes")
            old, new = _text(before.get(path)), _text(after.get(path))
            if old is None or new is None:
                return {"diff": "", "binary": True, "truncated": False}
            # Counts and stored source keep line terminators. The display diff
            # gets an explicit separator even when the source has no final LF.
            diff = "\n".join(difflib.unified_diff([s.rstrip("\r\n") for s in old], [s.rstrip("\r\n") for s in new], fromfile=f"a/{path}", tofile=f"b/{path}", lineterm=""))
            return {"diff": diff[:MAX_DIFF_CHARS], "binary": False, "truncated": len(diff) > MAX_DIFF_CHARS}
        capture_complete = bool(row["complete"])
        content_available = all(entry is None or entry["data"] is not None for item in files for entry in [before.get(item["path"]), after.get(item["path"])])
        provenance_verified = not self.require_provenance or self._verified(row, before, after, files)
        can_undo = capture_complete and content_available and provenance_verified and row["state"] == "finished" and bool(files)
        if not capture_complete:
            undo_reason = "capture_incomplete"
        elif not content_available:
            undo_reason = "content_unavailable"
        elif not provenance_verified:
            undo_reason = "unverified_changes"
        elif row["state"] != "finished":
            undo_reason = "not_finished"
        elif not files:
            undo_reason = "no_changes"
        else:
            undo_reason = None
        return {"id": change_id, "threadId": thread, "state": row["state"], "complete": capture_complete, "canUndo": can_undo, "undoReason": undo_reason, "files": files}

    @staticmethod
    def _verified(row, before, after, files):
        writes = json.loads(row["writes_json"])
        return all(item["path"] in writes and writes[item["path"]].get("trusted", True) and writes[item["path"]]["before"] == _fingerprint(before.get(item["path"])) and writes[item["path"]]["after"] == _fingerprint(after.get(item["path"])) for item in files)

    @contextmanager
    def record_paths(self, root, paths):
        """Attribute direct file-tool writes; unknown command writes stay view-only.

        Instrumentation is observational: a journal failure must never convert a
        successful tool write to a tool error and cause a duplicate retry.
        """
        root = os.path.realpath(root)
        capture = None
        try:
            with self._connect() as conn:
                row = conn.execute("SELECT * FROM turn_changes WHERE root=? AND state='running' AND created>?", (root, time.time() - ACTIVE_SECONDS)).fetchone()
            if row:
                before = {name: _fingerprint(_read(root, name)) for name in paths}
                capture = (row["id"], before)
        except Exception:
            pass
        try:
            yield
        finally:
            if capture:
                key, before = capture
                try:
                    after = {name: _fingerprint(_read(root, name)) for name in paths}
                    with self._connect() as conn:
                        conn.execute("BEGIN IMMEDIATE")
                        row = conn.execute("SELECT writes_json FROM turn_changes WHERE id=? AND state='running'", (key,)).fetchone()
                        if row:
                            writes = json.loads(row["writes_json"])
                            for name in paths:
                                if before[name] == after[name]: continue
                                old = writes.get(name)
                                trusted = not old or (old.get("trusted", True) and old["after"] == before[name])
                                writes[name] = {"before": old["before"] if old else before[name], "after": after[name], "trusted": trusted}
                            conn.execute("UPDATE turn_changes SET writes_json=? WHERE id=?", (json.dumps(writes), key))
                except Exception:
                    pass

    def undo(self, owner, thread, change_id, root):
        with self._connect() as conn:
            conn.execute("BEGIN IMMEDIATE")
            row = self._row(conn, owner, thread, change_id, root)
            if row["state"] == "undone":
                return self.review(owner, thread, change_id, root)
            if row["state"] != "finished" or not row["complete"]:
                raise ChangeConflict("restore_unavailable")
            if conn.execute("SELECT 1 FROM turn_changes WHERE root=? AND state='running' AND created>?", (row["root"], time.time() - ACTIVE_SECONDS)).fetchone():
                raise ChangeConflict("workspace_busy")
            before, after = json.loads(row["before_json"]), json.loads(row["after_json"])
            files = changed_files(before, after, True)
            if self.require_provenance and not self._verified(row, before, after, files):
                raise ChangeConflict("restore_unavailable")
            if any(entry is not None and entry["data"] is None for item in files for entry in [before.get(item["path"]), after.get(item["path"]) ]):
                raise ChangeConflict("restore_unavailable")
            # Preflight the ENTIRE set before touching the first file.
            for item in files:
                if _read(root, item["path"]) != after.get(item["path"]):
                    raise ChangeConflict("files_changed_since_turn")
            applied = []
            try:
                for item in files:
                    name = item["path"]
                    # Recheck after preflight; a later outside edit must not be
                    # overwritten just because another file was being restored.
                    if _read(root, name) != after.get(name):
                        raise ChangeConflict("files_changed_since_turn")
                    _replace(_path(root, name), before.get(name))
                    applied.append(name)
            except Exception:
                for name in reversed(applied):
                    if _read(root, name) == before.get(name):
                        _replace(_path(root, name), after.get(name))
                raise
            conn.execute("UPDATE turn_changes SET state='undone' WHERE id=?", (change_id,))
        return self.review(owner, thread, change_id, root)


def _fingerprint(value):
    if value is None: return None
    return {key: value[key] for key in ("hash", "mode")}


def default_store():
    from utils.paths import studio_root
    return TurnChanges(studio_root() / "turn-changes" / "history.sqlite3", require_provenance=True)


def observe_tool_changes(function):
    """Keep file-tool provenance beside the common executor, never model prose."""
    signature = inspect.signature(function)
    @wraps(function)
    def wrapped(name, arguments, *args, **kwargs):
        if name not in {"edit_file", "write_file", "create_file", "delete_path", "rename_path"}:
            return function(name, arguments, *args, **kwargs)
        recorder = None
        try:
            values = signature.bind_partial(name, arguments, *args, **kwargs).arguments
            session_id = values.get("session_id")
            root, _access, _error = function.__globals__["_connected_workspace_for_tool"](session_id)
            if not root and name == "edit_file":
                root = function.__globals__["_get_workdir"](session_id)
            if root:
                raw_paths = [arguments.get("path")]
                if name == "rename_path": raw_paths.append(arguments.get("destination"))
                paths = []
                for raw in raw_paths:
                    if name == "edit_file":
                        absolute, error = function.__globals__["_edit_file_resolve"](raw, session_id, values.get("disable_sandbox", False))
                        if error: break
                        relative = os.path.relpath(absolute, root).replace(os.sep, "/")
                    else:
                        relative = raw.replace("\\", "/") if isinstance(raw, str) else ""
                    _path(root, relative)
                    paths.append(relative)
                if len(paths) == len(raw_paths):
                    recorder = default_store().record_paths(root, paths)
        except Exception:
            pass
        if recorder is None:
            return function(name, arguments, *args, **kwargs)
        with recorder:
            return function(name, arguments, *args, **kwargs)
    return wrapped
