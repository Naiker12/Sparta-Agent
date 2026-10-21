import os

import pytest

from core.inference import turn_changes as changes


@pytest.fixture
def setup(tmp_path):
    root = tmp_path / "workspace"
    root.mkdir()
    return changes.TurnChanges(tmp_path / "journal" / "changes.sqlite3"), root


def begin(store, root):
    return store.begin("owner", "thread", root)["id"]


def finish(store, root, key):
    return store.finish("owner", "thread", key, root)


def test_counts_net_changes_and_preserves_preexisting_dirty_content(setup):
    store, root = setup
    (root / "existing.txt").write_bytes(b"user's unsaved work\nold\n")
    key = begin(store, root)
    (root / "existing.txt").write_bytes(b"user's unsaved work\nintermediate\n")
    (root / "existing.txt").write_bytes(b"user's unsaved work\nnew\nextra\n")
    summary = finish(store, root, key)
    assert summary["files"] == [{"path": "existing.txt", "status": "modified", "additions": 2, "deletions": 1, "binary": False}]
    assert summary["canUndo"]
    store.undo("owner", "thread", key, root)
    assert (root / "existing.txt").read_bytes() == b"user's unsaved work\nold\n"


def test_undo_creation_deletion_and_rename_without_git(setup):
    store, root = setup
    (root / "deleted.txt").write_bytes(b"deleted\r\n")
    (root / "old.txt").write_bytes(b"moved")
    key = begin(store, root)
    (root / "deleted.txt").unlink()
    (root / "old.txt").rename(root / "new.txt")
    (root / "created.txt").write_bytes(b"new")
    result = finish(store, root, key)
    assert len(result["files"]) == 4
    assert store.undo("owner", "thread", key, root)["state"] == "undone"
    assert (root / "deleted.txt").read_bytes() == b"deleted\r\n"
    assert (root / "old.txt").read_bytes() == b"moved"
    assert not (root / "created.txt").exists()
    assert not (root / "new.txt").exists()
    # Repeated clicks are idempotent.
    assert store.undo("owner", "thread", key, root)["state"] == "undone"


def test_no_net_change_or_read_only_command_has_no_card_files(setup):
    store, root = setup
    (root / "a").write_text("original")
    key = begin(store, root)
    (root / "a").write_text("temporary")
    (root / "a").write_text("original")
    assert finish(store, root, key)["files"] == []


def test_later_edit_blocks_entire_undo_before_first_write(setup):
    store, root = setup
    (root / "a").write_text("old a")
    (root / "b").write_text("old b")
    key = begin(store, root)
    (root / "a").write_text("new a")
    (root / "b").write_text("new b")
    finish(store, root, key)
    (root / "b").write_text("later user edit")
    with pytest.raises(changes.ChangeConflict, match="files_changed_since_turn"):
        store.undo("owner", "thread", key, root)
    assert (root / "a").read_text() == "new a"
    assert (root / "b").read_text() == "later user edit"


def test_new_file_with_later_content_is_never_deleted(setup):
    store, root = setup
    key = begin(store, root)
    (root / "new").write_text("generated")
    finish(store, root, key)
    (root / "new").write_text("later")
    with pytest.raises(changes.ChangeConflict):
        store.undo("owner", "thread", key, root)
    assert (root / "new").read_text() == "later"


def test_journal_survives_process_store_recreation_and_diff_is_historical(setup):
    store, root = setup
    (root / "one").write_text("old")
    key = begin(store, root)
    (root / "one").write_text("new")
    finish(store, root, key)
    (root / "one").write_text("something later")
    reopened = changes.TurnChanges(store.database)
    diff = reopened.review("owner", "thread", key, root, "one")["diff"]
    assert "-old\n+new" in diff
    assert "something later" not in diff


def test_owner_thread_and_workspace_are_checked(setup, tmp_path):
    store, root = setup
    key = begin(store, root)
    with pytest.raises(KeyError): store.review("different owner", "thread", key, root)
    with pytest.raises(KeyError): store.review("owner", "different thread", key, root)
    other = tmp_path / "other"
    other.mkdir()
    with pytest.raises(changes.ChangeConflict): store.review("owner", "thread", key, other)


def test_partial_capture_disables_undo(setup, monkeypatch):
    store, root = setup
    for name in ["a", "b"]: (root / name).write_text("before")
    monkeypatch.setattr(changes, "MAX_FILES", 1)
    key = begin(store, root)
    (root / "a").write_text("after")
    result = finish(store, root, key)
    assert result["files"][0]["path"] == "a"
    assert not result["complete"] and not result["canUndo"]
    assert result["undoReason"] == "capture_incomplete"
    with pytest.raises(changes.ChangeConflict): store.undo("owner", "thread", key, root)


def test_unchanged_large_file_does_not_disable_small_file_undo(setup, monkeypatch):
    store, root = setup
    monkeypatch.setattr(changes, "MAX_FILE_BYTES", 16)
    (root / "large.bin").write_bytes(b"x" * 32)
    (root / "small").write_text("before")
    key = begin(store, root)
    (root / "small").write_text("after")
    assert finish(store, root, key)["canUndo"]
    store.undo("owner", "thread", key, root)
    assert (root / "small").read_text() == "before"
    assert (root / "large.bin").read_bytes() == b"x" * 32


def test_modified_oversized_file_is_reported_without_fake_line_counts(setup, monkeypatch):
    store, root = setup
    monkeypatch.setattr(changes, "MAX_FILE_BYTES", 16)
    (root / "large").write_bytes(b"x" * 32)
    key = begin(store, root)
    (root / "large").write_bytes(b"y" * 64)
    result = finish(store, root, key)
    assert result["files"][0]["binary"]
    assert result["files"][0]["additions"] is None
    assert result["complete"] and result["undoReason"] == "content_unavailable"
    assert not result["canUndo"]


def test_binary_bytes_can_be_restored_but_not_displayed_as_text(setup):
    store, root = setup
    (root / "blob").write_bytes(b"\x00\xffold")
    key = begin(store, root)
    (root / "blob").write_bytes(b"\x00\xffnew")
    result = finish(store, root, key)
    assert result["files"][0]["binary"] and result["canUndo"]
    store.undo("owner", "thread", key, root)
    assert (root / "blob").read_bytes() == b"\x00\xffold"


def test_concurrent_capture_is_rejected_and_original_is_marked_partial(setup):
    store, root = setup
    key = begin(store, root)
    with pytest.raises(changes.ChangeConflict, match="workspace_busy"):
        store.begin("owner", "other-thread", root)
    assert not finish(store, root, key)["complete"]


def test_git_and_credentials_are_not_stored(setup):
    store, root = setup
    (root / ".git").mkdir()
    (root / ".git" / "config").write_text("secret")
    (root / ".env").write_text("secret")
    (root / ".gitignore").write_text("node_modules")
    key = begin(store, root)
    with store._connect() as conn:
        raw = conn.execute("SELECT before_json FROM turn_changes WHERE id=?", (key,)).fetchone()[0]
    assert ".gitignore" in raw
    assert "config" not in raw and ".env" not in raw


def test_undo_failure_rolls_back_files_already_restored(setup, monkeypatch):
    store, root = setup
    for name in ["a", "b"]: (root / name).write_text("before")
    key = begin(store, root)
    for name in ["a", "b"]: (root / name).write_text("after")
    finish(store, root, key)
    replace = changes._replace
    def failing(target, value):
        if target.name == "b": raise OSError("disk failure")
        return replace(target, value)
    monkeypatch.setattr(changes, "_replace", failing)
    with pytest.raises(OSError): store.undo("owner", "thread", key, root)
    assert (root / "a").read_text() == "after"
    assert (root / "b").read_text() == "after"


def test_symlink_or_hardlink_swap_cannot_restore_outside_file(setup, tmp_path):
    store, root = setup
    target = root / "a"
    target.write_text("before")
    key = begin(store, root)
    target.write_text("after")
    finish(store, root, key)
    outside = tmp_path / "outside"
    outside.write_text("after")
    target.unlink()
    os.link(outside, target)
    with pytest.raises(changes.ChangeConflict): store.undo("owner", "thread", key, root)
    assert outside.read_text() == "after"


def test_python_and_terminal_writes_are_detected_at_the_workspace_boundary(setup):
    import subprocess
    import sys
    store, root = setup
    key = begin(store, root)
    subprocess.run([sys.executable, "-c", "from pathlib import Path; Path('script.txt').write_text('from command')"], cwd=root, check=True)
    assert finish(store, root, key)["files"][0]["path"] == "script.txt"


@pytest.mark.parametrize("external_when", ["before", "between", "after", "only"])
def test_external_writes_cannot_be_undone_as_assistant_changes(setup, external_when):
    store, root = setup
    store.require_provenance = True
    target = root / "a"
    target.write_text("original")
    key = begin(store, root)
    if external_when in {"before", "only"}: target.write_text("external")
    if external_when != "only":
        with store.record_paths(root, ["a"]): target.write_text("assistant")
    if external_when == "between":
        target.write_text("external")
        with store.record_paths(root, ["a"]): target.write_text("assistant again")
    if external_when == "after": target.write_text("external")
    result = finish(store, root, key)
    assert result["files"] and result["complete"] and not result["canUndo"]
    assert result["undoReason"] == "unverified_changes"
    expected = target.read_bytes()
    with pytest.raises(changes.ChangeConflict, match="restore_unavailable"):
        store.undo("owner", "thread", key, root)
    assert target.read_bytes() == expected


def test_real_executor_records_direct_edits_and_renames(setup, monkeypatch):
    from core.inference import tools
    store, root = setup
    store.require_provenance = True
    monkeypatch.setattr(changes, "default_store", lambda: store)
    monkeypatch.setattr(tools, "_connected_workspace_for_tool", lambda session: (str(root), "write", ""))
    monkeypatch.setattr(tools, "_get_workdir", lambda session=None: str(root))
    target = root / "a.py"
    target.write_text("value = 1\n")
    key = begin(store, root)
    result = tools.execute_tool("edit_file", {"path": "a.py", "old_string": "1", "new_string": "2"}, session_id="thread")
    assert not result.startswith("Error:")
    result = tools.execute_tool("rename_path", {"path": "a.py", "destination": "b.py"}, session_id="thread")
    assert not result.startswith("Error:")
    assert finish(store, root, key)["canUndo"]
    store.undo("owner", "thread", key, root)
    assert target.read_text() == "value = 1\n" and not (root / "b.py").exists()


def test_observer_failure_does_not_break_tool_write(setup, monkeypatch):
    from core.inference import tools
    _, root = setup
    monkeypatch.setattr(tools, "_get_workdir", lambda session=None: str(root))
    def broken(): raise RuntimeError("journal unavailable")
    monkeypatch.setattr(changes, "default_store", broken)
    target = root / "a.py"
    target.write_text("value = 1")
    result = tools.execute_tool("edit_file", {"path": "a.py", "old_string": "1", "new_string": "2"}, session_id="thread")
    assert not result.startswith("Error:") and target.read_text() == "value = 2"
