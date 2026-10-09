import sqlite3
from concurrent.futures import ThreadPoolExecutor

import pytest
from storage.studio import chat_projects


@pytest.fixture
def database(tmp_path, monkeypatch):
    db = tmp_path / "projects.db"
    def connection():
        conn = sqlite3.connect(db, timeout=5)
        conn.row_factory = sqlite3.Row
        return conn
    with connection() as conn:
        conn.execute("CREATE TABLE chat_projects(id TEXT PRIMARY KEY, name TEXT, instructions TEXT, root_path TEXT, connected_folder_path TEXT, workspace_access TEXT, archived INTEGER, created_at INTEGER, updated_at INTEGER)")
        conn.executemany("INSERT INTO chat_projects VALUES(?, ?, '', ?, NULL, 'read', 0, 1, 1)", [(key, key, str(tmp_path / key)) for key in ("one", "two")])
    monkeypatch.setattr(chat_projects, "get_connection", connection)
    monkeypatch.setattr(chat_projects, "_ensure_project_workspace", lambda path: path)
    folder = tmp_path / "repo"
    folder.mkdir()
    return folder


def test_duplicate_folder_rejected_for_patch_and_save(database):
    folder = str(database)
    chat_projects.update_chat_project("one", {"connectedFolderPath": folder, "archived": True})
    with pytest.raises(chat_projects.DuplicateProjectFolderError):
        chat_projects.update_chat_project("two", {"connectedFolderPath": str(database / ".." / "repo")})
    with pytest.raises(chat_projects.DuplicateProjectFolderError):
        chat_projects.upsert_chat_project({"id": "two", "name": "two", "connectedFolderPath": folder, "createdAt": 1, "updatedAt": 1})
    assert chat_projects.update_chat_project("one", {"connectedFolderPath": folder})["connectedFolderPath"] == folder
    chat_projects.update_chat_project("one", {"connectedFolderPath": None})
    assert chat_projects.update_chat_project("two", {"connectedFolderPath": folder})["connectedFolderPath"] == folder


def test_concurrent_connections_have_one_owner(database):
    def connect(key):
        try:
            chat_projects.update_chat_project(key, {"connectedFolderPath": str(database)})
            return "connected"
        except chat_projects.DuplicateProjectFolderError:
            return "duplicate"
    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(connect, ("one", "two"))) == ["connected", "duplicate"]
