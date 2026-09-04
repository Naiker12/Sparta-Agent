"""Chat projects storage, workspace resolution, and cascade deletions."""

import os
import sqlite3
from typing import Optional

from storage.studio.connection import (
    get_connection,
    _CONTENDED_BUSY_TIMEOUT_SECONDS,
)
from storage.studio.chat_attachments import (
    _ensure_chat_attachment_inventory_current,
    _mark_chat_attachment_inventory_clean,
)
from storage.studio.chat_threads import (
    _ACTIVE_RESEARCH_RUN_STATUSES,
    _reparent_surviving_forks,
    _tombstone_chat_threads,
)
from storage.studio.project_workspace import (
    _default_project_root,
    _delete_project_workspace,
    _ensure_project_workspace,
)


def _chat_project_from_row(row: sqlite3.Row) -> dict:
    data = dict(row)
    root_path = data.get("root_path")
    return {
        "id": data["id"],
        "name": data["name"],
        "instructions": data.get("instructions") or "",
        "rootPath": root_path or None,
        "sandboxPath": os.path.join(root_path, "sandbox") if root_path else None,
        "connectedFolderPath": data.get("connected_folder_path") or None,
        "workspaceAccess": data.get("workspace_access") or "read",
        "archived": bool(data["archived"]),
        "createdAt": data["created_at"],
        "updatedAt": data["updated_at"],
    }



def upsert_chat_project(project: dict) -> dict:
    existing = get_chat_project(project["id"])
    root_path = existing.get("rootPath") if existing else None
    connected_folder_path = project.get("connectedFolderPath")
    if connected_folder_path is None and existing:
        connected_folder_path = existing.get("connectedFolderPath")
    workspace_access = project.get("workspaceAccess")
    if workspace_access is None and existing:
        workspace_access = existing.get("workspaceAccess")
    if workspace_access not in {"read", "write"}:
        workspace_access = "read"
    if not root_path:
        root_path = _default_project_root(project)
    root_path = _ensure_project_workspace(root_path)
    conn = get_connection()
    try:
        conn.execute(
            """
            INSERT INTO chat_projects
                (id, name, instructions, root_path, connected_folder_path, workspace_access, archived, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                instructions = excluded.instructions,
                root_path = COALESCE(chat_projects.root_path, excluded.root_path),
                connected_folder_path = excluded.connected_folder_path,
                workspace_access = excluded.workspace_access,
                archived = excluded.archived,
                created_at = excluded.created_at,
                updated_at = excluded.updated_at
            """,
            (
                project["id"],
                project["name"],
                project.get("instructions") or "",
                root_path,
                connected_folder_path,
                workspace_access,
                1 if project.get("archived") else 0,
                int(project["createdAt"]),
                int(project["updatedAt"]),
            ),
        )
        conn.commit()
        return get_chat_project(project["id"]) or project
    finally:
        conn.close()


def update_chat_project(id: str, patch: dict) -> Optional[dict]:
    allowed = {
        "name": ("name", patch.get("name")),
        "instructions": ("instructions", patch.get("instructions")),
        "archived": ("archived", 1 if patch.get("archived") else 0),
        "createdAt": ("created_at", patch.get("createdAt")),
        "updatedAt": ("updated_at", patch.get("updatedAt")),
        "connectedFolderPath": ("connected_folder_path", patch.get("connectedFolderPath")),
        "workspaceAccess": ("workspace_access", patch.get("workspaceAccess")),
    }
    assignments = []
    values = []
    for key, (column, value) in allowed.items():
        if key in patch:
            assignments.append(f"{column} = ?")
            values.append(value)
    if not assignments:
        return get_chat_project(id)

    conn = get_connection()
    try:
        conn.execute(
            f"UPDATE chat_projects SET {', '.join(assignments)} WHERE id = ?",
            (*values, id),
        )
        conn.commit()
        row = conn.execute("SELECT * FROM chat_projects WHERE id = ?", (id,)).fetchone()
        return _chat_project_from_row(row) if row is not None else None
    finally:
        conn.close()


def ensure_chat_project_workspace(id: str) -> Optional[dict]:
    project = get_chat_project(id)
    if project is None:
        return None
    root_path = project.get("rootPath") or _default_project_root(project)
    root_path = _ensure_project_workspace(root_path)
    # a delete running in another threadpool worker can drop the row at any point before the
    # directory is created, so confirm the project outlived the create rather than trusting a
    # pre-create snapshot. Removing the directory here is not this function's call: only the
    # delete path knows whether the user asked to keep the files, and the row may have had a
    # populated workspace already. An empty directory left behind is the cheaper outcome.
    project = get_chat_project(id)
    if project is None:
        return None
    if project.get("rootPath") == root_path:
        return project
    conn = get_connection()
    try:
        conn.execute(
            "UPDATE chat_projects SET root_path = ? WHERE id = ?",
            (root_path, id),
        )
        conn.commit()
    finally:
        conn.close()
    return get_chat_project(id)


def get_chat_project(id: str) -> Optional[dict]:
    conn = get_connection()
    try:
        row = conn.execute("SELECT * FROM chat_projects WHERE id = ?", (id,)).fetchone()
        return _chat_project_from_row(row) if row is not None else None
    finally:
        conn.close()


def list_chat_projects(include_archived: bool = False) -> list[dict]:
    conn = get_connection()
    try:
        where = "" if include_archived else "WHERE archived = 0"
        rows = conn.execute(
            f"SELECT * FROM chat_projects {where} ORDER BY updated_at DESC"
        ).fetchall()
        return [_chat_project_from_row(row) for row in rows]
    finally:
        conn.close()


def delete_chat_project(id: str, delete_files: bool = False) -> Optional[dict]:
    conn = get_connection(_CONTENDED_BUSY_TIMEOUT_SECONDS)
    try:
        conn.execute("BEGIN IMMEDIATE")
        _ensure_chat_attachment_inventory_current(conn)
        row = conn.execute("SELECT * FROM chat_projects WHERE id = ?", (id,)).fetchone()
        if row is None:
            conn.rollback()
            return None
        project = _chat_project_from_row(row)
        thread_ids = {
            thread["id"]
            for thread in conn.execute(
                "SELECT id FROM chat_threads WHERE project_id = ?",
                (id,),
            )
        }
        # Read before the cascade removes them: afterwards nothing can tell the
        # supervisor which runs to stop, and a worker keeps doing model, web and
        # RAG work for a project that is gone.
        active_runs = (
            [
                row["id"]
                for row in conn.execute(
                    "SELECT id FROM research_runs WHERE thread_id IN ({}) "
                    "AND status IN ({}) AND lease_owner IS NOT NULL "
                    "ORDER BY created_at, id".format(
                        ",".join("?" for _ in thread_ids) or "NULL",
                        ",".join("?" for _ in _ACTIVE_RESEARCH_RUN_STATUSES),
                    ),
                    (*tuple(sorted(thread_ids)), *_ACTIVE_RESEARCH_RUN_STATUSES),
                )
            ]
            if thread_ids
            else []
        )
        _reparent_surviving_forks(conn, thread_ids)
        # Fence the exact membership selected by this transaction so a late writer cannot
        # recreate a project member after the project and its workspace are gone.
        _tombstone_chat_threads(conn, thread_ids)
        conn.execute("DELETE FROM chat_threads WHERE project_id = ?", (id,))
        conn.execute("DELETE FROM chat_projects WHERE id = ?", (id,))
        _mark_chat_attachment_inventory_clean(conn)
        conn.commit()
        if delete_files:
            _delete_project_workspace(project)
        # The membership this transaction actually deleted, which is not the
        # caller's earlier listing when a chat was moved in between the two.
        project = dict(project)
        project["memberIds"] = sorted(thread_ids)
        project["activeResearchRunIds"] = active_runs
        return project
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def delete_chat_project_with_active_research_runs(id: str) -> tuple[Optional[dict], list[str]]:
    project = delete_chat_project(id, delete_files = False)
    if project is None:
        return None, []
    return project, list(project.get("activeResearchRunIds") or [])



