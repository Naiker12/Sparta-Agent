"""Project-scoped filesystem API for a project's connected local folder."""

from __future__ import annotations

import os
import shutil
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

from auth.authentication import get_current_subject
from state.project_files import (
    ProjectWorkspacePathError,
    connected_workspace,
    display_path,
    resolve_project_path,
)
from storage.studio_db import get_chat_project

router = APIRouter()
_MAX_TEXT_BYTES = 2 * 1024 * 1024
_IGNORED_NAMES = frozenset({".git", "node_modules", "dist", "build", ".next", "__pycache__"})


class FileContentPayload(BaseModel):
    path: str = Field(min_length = 1, max_length = 4096)
    content: str = Field(max_length = _MAX_TEXT_BYTES)


class CreatePathPayload(BaseModel):
    path: str = Field(min_length = 1, max_length = 4096)
    type: Literal["file", "directory"]


class MovePathPayload(BaseModel):
    path: str = Field(min_length = 1, max_length = 4096)
    destination: str = Field(min_length = 1, max_length = 4096)


def _root(project_id: str) -> str:
    project = get_chat_project(project_id)
    if project is None:
        raise HTTPException(status_code = 404, detail = f"Project {project_id} not found")
    try:
        return connected_workspace(project)
    except RuntimeError as exc:
        raise HTTPException(status_code = 409, detail = str(exc)) from exc


def _path(root: str, value: str, *, allow_root: bool = False) -> str:
    try:
        return resolve_project_path(root, value, allow_root = allow_root)
    except ProjectWorkspacePathError as exc:
        raise HTTPException(status_code = 400, detail = str(exc)) from exc


@router.get("/projects/{project_id}/files/tree")
def list_tree(project_id: str, path: str = Query(""), current_subject: str = Depends(get_current_subject)):
    root = _root(project_id)
    folder = _path(root, path, allow_root = True)
    if not os.path.isdir(folder):
        raise HTTPException(status_code = 404, detail = "Directory not found")
    nodes = []
    try:
        for entry in os.scandir(folder):
            if entry.name in _IGNORED_NAMES:
                continue
            target = _path(root, os.path.relpath(entry.path, root), allow_root = True)
            nodes.append({"name": entry.name, "path": display_path(root, target), "type": "directory" if entry.is_dir(follow_symlinks = False) else "file"})
    except OSError as exc:
        raise HTTPException(status_code = 500, detail = "Could not list directory") from exc
    nodes.sort(key = lambda node: (node["type"] != "directory", node["name"].casefold()))
    return {"path": display_path(root, folder), "nodes": nodes}


@router.get("/projects/{project_id}/files/content")
def read_content(project_id: str, path: str, current_subject: str = Depends(get_current_subject)):
    root = _root(project_id)
    target = _path(root, path)
    if not os.path.isfile(target):
        raise HTTPException(status_code = 404, detail = "File not found")
    if os.path.getsize(target) > _MAX_TEXT_BYTES:
        raise HTTPException(status_code = 413, detail = "File is too large to open in the workspace editor")
    try:
        with open(target, "r", encoding = "utf-8", newline = "") as file:
            return {"path": display_path(root, target), "content": file.read()}
    except UnicodeDecodeError as exc:
        raise HTTPException(status_code = 415, detail = "Only UTF-8 text files can be opened") from exc


@router.put("/projects/{project_id}/files/content")
def write_content(project_id: str, payload: FileContentPayload, current_subject: str = Depends(get_current_subject)):
    root = _root(project_id)
    target = _path(root, payload.path)
    if os.path.isdir(target):
        raise HTTPException(status_code = 400, detail = "Cannot write a directory")
    created = not os.path.exists(target)
    os.makedirs(os.path.dirname(target), exist_ok = True)
    if _path(root, target) != target:
        raise HTTPException(status_code = 400, detail = "Destination escaped the connected folder")
    with open(target, "w", encoding = "utf-8", newline = "") as file:
        file.write(payload.content)
    return {"path": display_path(root, target), "created": created}


@router.post("/projects/{project_id}/files", status_code = 201)
def create_path(project_id: str, payload: CreatePathPayload, current_subject: str = Depends(get_current_subject)):
    root = _root(project_id)
    target = _path(root, payload.path)
    if os.path.lexists(target):
        raise HTTPException(status_code = 409, detail = "Path already exists")
    os.makedirs(os.path.dirname(target), exist_ok = True)
    if payload.type == "directory":
        os.mkdir(target)
    else:
        with open(target, "x", encoding = "utf-8"):
            pass
    return {"path": display_path(root, target), "type": payload.type}


@router.patch("/projects/{project_id}/files")
def move_path(project_id: str, payload: MovePathPayload, current_subject: str = Depends(get_current_subject)):
    root = _root(project_id)
    source = _path(root, payload.path)
    destination = _path(root, payload.destination)
    if not os.path.lexists(source):
        raise HTTPException(status_code = 404, detail = "Source path not found")
    if os.path.lexists(destination):
        raise HTTPException(status_code = 409, detail = "Destination already exists")
    os.makedirs(os.path.dirname(destination), exist_ok = True)
    os.replace(source, destination)
    return {"path": display_path(root, destination)}


@router.delete("/projects/{project_id}/files")
def delete_path(project_id: str, path: str, current_subject: str = Depends(get_current_subject)):
    root = _root(project_id)
    target = _path(root, path)
    if not os.path.lexists(target):
        raise HTTPException(status_code = 404, detail = "Path not found")
    if os.path.isdir(target) and not os.path.islink(target):
        shutil.rmtree(target)
    else:
        os.unlink(target)
    return {"path": display_path(root, target), "deleted": True}
