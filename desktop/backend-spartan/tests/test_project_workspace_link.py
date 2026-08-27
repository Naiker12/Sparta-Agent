from pathlib import Path

from state.project_workspace_link import (
    resolve_active_workspace,
    validate_connectable_folder,
)


def test_resolve_active_workspace_prefers_existing_connected_folder(tmp_path):
    connected = tmp_path / "connected"
    sandbox = tmp_path / "sandbox"
    connected.mkdir()
    sandbox.mkdir()

    assert resolve_active_workspace(
        {"connectedFolderPath": str(connected), "sandboxPath": str(sandbox)}
    ) == str(connected.resolve())


def test_resolve_active_workspace_falls_back_to_sandbox(tmp_path):
    sandbox = tmp_path / "sandbox"
    sandbox.mkdir()

    assert resolve_active_workspace(
        {"connectedFolderPath": str(tmp_path / "missing"), "sandboxPath": str(sandbox)}
    ) == str(sandbox)


def test_validate_connectable_folder_rejects_roots_and_files(tmp_path):
    file_path = tmp_path / "file.txt"
    file_path.write_text("x", encoding = "utf-8")

    assert validate_connectable_folder(None) == (True, None)
    assert validate_connectable_folder(str(file_path))[0] is False
    assert validate_connectable_folder(str(Path(tmp_path.anchor)))[0] is False


def test_project_session_uses_connected_folder(tmp_path, monkeypatch):
    monkeypatch.setenv("UNSLOTH_STUDIO_HOME", str(tmp_path))
    monkeypatch.setenv("UNSLOTH_STUDIO_PROJECTS_HOME", str(tmp_path / "Projects"))

    from core.inference import tools
    from storage import studio_db

    studio_db._schema_ready = False
    project = studio_db.upsert_chat_project(
        {"id": "project-1", "name": "Project", "createdAt": 1, "updatedAt": 1}
    )
    connected = tmp_path / "existing-codebase"
    connected.mkdir()
    studio_db.update_chat_project(
        project["id"], {"connectedFolderPath": str(connected)}
    )
    tools._workdirs.clear()

    assert tools.get_sandbox_workdir(
        f"{tools._PROJECT_SESSION_PREFIX}{project['id']}"
    ) == str(connected.resolve())
