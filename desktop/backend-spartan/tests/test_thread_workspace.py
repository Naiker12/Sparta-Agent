from state.thread_workspace import (
    resolve_thread_workspace,
    resolve_writable_thread_workspace,
)


def test_write_binding_resolves_only_when_its_identity_still_matches(tmp_path):
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    stat = workspace.stat()
    binding = {
        "canonicalPath": str(workspace),
        "filesystemIdentity": f"{stat.st_dev}:{stat.st_ino}",
        "access": "write",
    }

    assert resolve_writable_thread_workspace(binding) == str(workspace.resolve())
    binding["filesystemIdentity"] = "not-the-same-folder"
    assert resolve_writable_thread_workspace(binding) is None


def test_read_and_no_delete_bindings_never_grant_the_generic_runner_a_root(tmp_path):
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    base = {"canonicalPath": str(workspace), "filesystemIdentity": None}

    assert resolve_thread_workspace({**base, "access": "read"}) == str(workspace.resolve())
    assert resolve_writable_thread_workspace({**base, "access": "read"}) is None
    assert resolve_writable_thread_workspace({**base, "access": "write_no_delete"}) is None
