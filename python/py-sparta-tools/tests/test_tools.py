"""Tests for Sparta AI tools: file_tools, mcp_client, web_search."""
from __future__ import annotations

import sys
import tempfile
from pathlib import Path

import pytest

from sparta_tools.file_tools import (
    delete_file_tool,
    patch_file_tool,
    read_file_tool,
    search_files_tool,
    write_file_tool,
)
from sparta_tools.web_search import web_search_tool


# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _ws(monkeypatch, tmpdir: str) -> Path:
    """Set SPARTA_WORKSPACE_ROOT to tmpdir and return the Path."""
    monkeypatch.setenv("SPARTA_WORKSPACE_ROOT", tmpdir)
    return Path(tmpdir).resolve()


# ─────────────────────────────────────────────────────────────────────────────
# read_file_tool / write_file_tool
# ─────────────────────────────────────────────────────────────────────────────

class TestFileTools:
    @pytest.fixture(autouse=True)
    def _mock_diff_approval(self, monkeypatch):
        """Mock diff approval to return True in non-Electron env."""
        monkeypatch.setattr("sparta_tools.file.write_tools.request_diff_approval", lambda **kw: True)
        monkeypatch.setattr("sparta_tools.file.write_tools.request_permission_sync", lambda *a, **kw: True)

    def test_write_and_read_file(self, monkeypatch):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = _ws(monkeypatch, tmpdir)
            result = write_file_tool.invoke({"path": "test.txt", "content": "Hello, Sparta!"})
            assert "test.txt" in result
            assert (root / "test.txt").exists()

            content = read_file_tool.invoke({"path": "test.txt"})
            assert content == "Hello, Sparta!"

    def test_read_nonexistent_file(self, monkeypatch):
        with tempfile.TemporaryDirectory() as tmpdir:
            _ws(monkeypatch, tmpdir)
            result = read_file_tool.invoke({"path": "missing.txt"})
            assert "Error" in result

    def test_write_append(self, monkeypatch):
        with tempfile.TemporaryDirectory() as tmpdir:
            _ws(monkeypatch, tmpdir)
            write_file_tool.invoke({"path": "append.txt", "content": "Line 1\n"})
            write_file_tool.invoke({"path": "append.txt", "content": "Line 2\n", "append": True})
            content = read_file_tool.invoke({"path": "append.txt"})
            assert "Line 1" in content
            assert "Line 2" in content

    def test_read_with_offset_and_limit(self, monkeypatch):
        with tempfile.TemporaryDirectory() as tmpdir:
            _ws(monkeypatch, tmpdir)
            lines = "\n".join(f"line{i}" for i in range(1, 11))
            write_file_tool.invoke({"path": "paged.txt", "content": lines})
            result = read_file_tool.invoke({"path": "paged.txt", "offset": 3, "limit": 3})
            assert "line3" in result
            assert "line5" in result
            assert "line6" not in result

    def test_write_creates_parent_dirs(self, monkeypatch):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = _ws(monkeypatch, tmpdir)
            result = write_file_tool.invoke({"path": "a/b/c/deep.txt", "content": "deep"})
            assert (root / "a" / "b" / "c" / "deep.txt").exists()
            assert "deep.txt" in result

    def test_path_outside_workspace_is_blocked(self, monkeypatch):
        with tempfile.TemporaryDirectory() as tmpdir:
            _ws(monkeypatch, tmpdir)
            result = read_file_tool.invoke({"path": "/etc/passwd"})
            assert "Error" in result or "seguridad" in result.lower()

    def test_denylist_blocks_env_file(self, monkeypatch):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = _ws(monkeypatch, tmpdir)
            (root / ".env").write_text("SECRET=123", encoding="utf-8")
            result = read_file_tool.invoke({"path": ".env"})
            assert "Error" in result or "seguridad" in result.lower()


# ─────────────────────────────────────────────────────────────────────────────
# search_files_tool
# ─────────────────────────────────────────────────────────────────────────────

class TestSearchFilesTool:
    def _populate(self, root: Path) -> None:
        (root / "src").mkdir()
        (root / "src" / "auth.ts").write_text("export function login() {}\nexport function logout() {}", encoding="utf-8")
        (root / "src" / "user.ts").write_text("export class User {}", encoding="utf-8")
        (root / "README.md").write_text("# Sparta\nlogin docs here", encoding="utf-8")

    def test_search_by_name_glob(self, monkeypatch):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = _ws(monkeypatch, tmpdir)
            self._populate(root)
            result = search_files_tool.invoke({"pattern": "*.ts"})
            assert "auth.ts" in result
            assert "user.ts" in result
            assert "README.md" not in result

    def test_search_by_content(self, monkeypatch):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = _ws(monkeypatch, tmpdir)
            self._populate(root)
            result = search_files_tool.invoke({"pattern": "*", "content": "login"})
            assert "auth.ts" in result
            assert "README.md" in result
            assert "user.ts" not in result

    def test_search_no_results(self, monkeypatch):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = _ws(monkeypatch, tmpdir)
            self._populate(root)
            result = search_files_tool.invoke({"pattern": "*.go"})
            assert "No se encontraron" in result

    def test_search_respects_max_results(self, monkeypatch):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = _ws(monkeypatch, tmpdir)
            for i in range(10):
                (root / f"file{i}.txt").write_text("needle", encoding="utf-8")
            result = search_files_tool.invoke({"pattern": "*.txt", "content": "needle", "max_results": 3})
            # At most 3 match lines + header
            lines = [l for l in result.splitlines() if "file" in l]
            assert len(lines) <= 3

    def test_search_content_case_insensitive(self, monkeypatch):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = _ws(monkeypatch, tmpdir)
            (root / "notes.txt").write_text("The LOGIN function handles auth", encoding="utf-8")
            result = search_files_tool.invoke({"pattern": "*.txt", "content": "login"})
            assert "notes.txt" in result

    def test_search_outside_workspace_blocked(self, monkeypatch):
        with tempfile.TemporaryDirectory() as tmpdir:
            _ws(monkeypatch, tmpdir)
            result = search_files_tool.invoke({"pattern": "*", "path": "/etc"})
            assert "Error" in result or "seguridad" in result.lower()


# ─────────────────────────────────────────────────────────────────────────────
# patch_file_tool
# ─────────────────────────────────────────────────────────────────────────────

class TestPatchFileTool:
    @pytest.fixture(autouse=True)
    def _mock_diff_approval(self, monkeypatch):
        """Mock diff approval to return True in non-Electron env."""
        monkeypatch.setattr("sparta_tools.file.write_tools.request_diff_approval", lambda **kw: True)
        monkeypatch.setattr("sparta_tools.file.write_tools.request_permission_sync", lambda *a, **kw: True)

    def test_patch_applies_and_returns_diff(self, monkeypatch):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = _ws(monkeypatch, tmpdir)
            (root / "hello.py").write_text("def greet():\n    print('hello')\n", encoding="utf-8")
            result = patch_file_tool.invoke({
                "path": "hello.py",
                "old_string": "print('hello')",
                "new_string": "print('hello, world')",
            })
            assert "hello.py" in result
            assert "diff" in result.lower() or "---" in result
            content = (root / "hello.py").read_text(encoding="utf-8")
            assert "hello, world" in content
            assert "print('hello')" not in content

    def test_patch_not_found_returns_error(self, monkeypatch):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = _ws(monkeypatch, tmpdir)
            (root / "code.py").write_text("x = 1\n", encoding="utf-8")
            result = patch_file_tool.invoke({
                "path": "code.py",
                "old_string": "y = 2",
                "new_string": "y = 99",
            })
            assert "Error" in result
            assert "no se encontró" in result.lower() or "encontr" in result.lower()

    def test_patch_ambiguous_returns_error(self, monkeypatch):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = _ws(monkeypatch, tmpdir)
            (root / "dup.py").write_text("x = 1\nx = 1\n", encoding="utf-8")
            result = patch_file_tool.invoke({
                "path": "dup.py",
                "old_string": "x = 1",
                "new_string": "x = 2",
            })
            assert "Error" in result
            assert "2" in result  # "aparece 2 veces"

    def test_patch_nonexistent_file(self, monkeypatch):
        with tempfile.TemporaryDirectory() as tmpdir:
            _ws(monkeypatch, tmpdir)
            result = patch_file_tool.invoke({
                "path": "ghost.py",
                "old_string": "foo",
                "new_string": "bar",
            })
            assert "Error" in result

    def test_patch_outside_workspace_blocked(self, monkeypatch):
        with tempfile.TemporaryDirectory() as tmpdir:
            _ws(monkeypatch, tmpdir)
            result = patch_file_tool.invoke({
                "path": "/etc/hosts",
                "old_string": "localhost",
                "new_string": "remotehost",
            })
            assert "Error" in result or "seguridad" in result.lower()


# ─────────────────────────────────────────────────────────────────────────────
# delete_file_tool
# ─────────────────────────────────────────────────────────────────────────────

class TestDeleteFileTool:
    @pytest.fixture(autouse=True)
    def _mock_permission(self, monkeypatch):
        """Mock permission to return True in non-Electron env."""
        monkeypatch.setattr("sparta_tools.file.workspace_paths.request_permission_sync", lambda *a, **kw: True)

    def test_delete_file(self, monkeypatch):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = _ws(monkeypatch, tmpdir)
            target = root / "gone.txt"
            target.write_text("bye", encoding="utf-8")
            result = delete_file_tool.invoke({"path": "gone.txt"})
            assert "papelera" in result.lower() or "eliminado" in result.lower() or "deleted" in result.lower()
            assert not target.exists()

    def test_delete_empty_directory(self, monkeypatch):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = _ws(monkeypatch, tmpdir)
            empty_dir = root / "emptydir"
            empty_dir.mkdir()
            result = delete_file_tool.invoke({"path": "emptydir"})
            assert "papelera" in result.lower() or "eliminado" in result.lower() or "deleted" in result.lower()
            assert not empty_dir.exists()

    def test_delete_nonempty_directory_blocked(self, monkeypatch):
        with tempfile.TemporaryDirectory() as tmpdir:
            root = _ws(monkeypatch, tmpdir)
            d = root / "filled"
            d.mkdir()
            (d / "file.txt").write_text("data", encoding="utf-8")
            result = delete_file_tool.invoke({"path": "filled"})
            assert "Error" in result
            assert d.exists()  # must not be deleted

    def test_delete_nonexistent_returns_error(self, monkeypatch):
        with tempfile.TemporaryDirectory() as tmpdir:
            _ws(monkeypatch, tmpdir)
            result = delete_file_tool.invoke({"path": "phantom.txt"})
            assert "Error" in result

    def test_delete_outside_workspace_blocked(self, monkeypatch):
        with tempfile.TemporaryDirectory() as tmpdir:
            _ws(monkeypatch, tmpdir)
            result = delete_file_tool.invoke({"path": "/tmp/something"})
            assert "Error" in result or "seguridad" in result.lower()


# ─────────────────────────────────────────────────────────────────────────────
# RealMCPClient — comportamiento cuando mcp SDK no está instalado
# ─────────────────────────────────────────────────────────────────────────────

class TestRealMCPClient:
    """Tests that run without requiring a live MCP server."""

    def test_connect_fails_gracefully_without_sdk(self, monkeypatch):
        """If the mcp package is missing, connect() raises RuntimeError with install hint."""
        import builtins
        real_import = builtins.__import__

        def _block_mcp(name, *args, **kwargs):
            if name == "mcp" or name.startswith("mcp."):
                raise ModuleNotFoundError(f"No module named '{name}'")
            return real_import(name, *args, **kwargs)

        monkeypatch.setattr(builtins, "__import__", _block_mcp)

        from sparta_tools.mcp_client import RealMCPClient
        client = RealMCPClient({"id": "test", "type": "stdio", "command": "npx", "args": []})

        import asyncio
        with pytest.raises(RuntimeError, match="pip install mcp"):
            asyncio.get_event_loop().run_until_complete(client.connect())

    def test_build_mcp_tools_skips_disabled_servers(self):
        """build_mcp_tools returns empty list when all servers are disabled."""
        from sparta_tools.mcp_client import build_mcp_tools
        import asyncio

        configs = [
            {"id": "server1", "type": "stdio", "command": "npx", "args": [], "enabled": False},
            {"id": "server2", "type": "http", "url": "http://localhost:8080", "enabled": False},
        ]
        result = asyncio.get_event_loop().run_until_complete(build_mcp_tools(configs))
        assert result == []

    def test_build_mcp_tools_empty_config(self):
        """build_mcp_tools returns empty list for empty config, no exception."""
        from sparta_tools.mcp_client import build_mcp_tools
        import asyncio

        result = asyncio.get_event_loop().run_until_complete(build_mcp_tools([]))
        assert result == []

    def test_apply_tool_filter_include(self):
        """include whitelist takes precedence over exclude."""
        from sparta_tools.mcp_client import _apply_tool_filter

        tools = [{"name": "read"}, {"name": "write"}, {"name": "delete"}]
        result = _apply_tool_filter(tools, include=["read", "write"], exclude=["write"])
        names = [t["name"] for t in result]
        assert names == ["read", "write"]

    def test_apply_tool_filter_exclude(self):
        """exclude blacklist works when include is empty."""
        from sparta_tools.mcp_client import _apply_tool_filter

        tools = [{"name": "read"}, {"name": "write"}, {"name": "delete"}]
        result = _apply_tool_filter(tools, include=[], exclude=["delete"])
        names = [t["name"] for t in result]
        assert "delete" not in names
        assert "read" in names and "write" in names

    def test_apply_tool_filter_no_filter(self):
        """No include/exclude returns all tools."""
        from sparta_tools.mcp_client import _apply_tool_filter

        tools = [{"name": "a"}, {"name": "b"}]
        assert _apply_tool_filter(tools, include=[], exclude=[]) == tools

    def test_call_tool_raises_when_not_connected(self):
        """call_tool raises RuntimeError when called before connect()."""
        from sparta_tools.mcp_client import RealMCPClient
        import asyncio

        client = RealMCPClient({"id": "x", "type": "stdio", "command": "npx", "args": []})
        with pytest.raises(RuntimeError, match="not connected|no está conectado|x"):
            asyncio.get_event_loop().run_until_complete(
                client.call_tool("some_tool", {"arg": "val"})
            )


# ─────────────────────────────────────────────────────────────────────────────
# web_search_tool
# ─────────────────────────────────────────────────────────────────────────────

class TestWebSearchTool:
    @pytest.fixture(autouse=True)
    def _disable_brave(self, monkeypatch):
        monkeypatch.setattr("sparta_config.security.get_key", lambda key: "")

    @pytest.mark.asyncio
    async def test_search_no_key(self, monkeypatch):
        def _fake_duckduckgo_search(query: str, count: int, freshness: str | None = None) -> list[dict]:
            return [
                {
                    "title": f"Result for {query}",
                    "url": "https://example.com",
                    "snippet": "A fake snippet",
                }
            ]

        monkeypatch.setattr("sparta_tools.web_search.duckduckgo_search", _fake_duckduckgo_search)
        result = await web_search_tool.ainvoke({"query": "test", "count": 1})
        assert isinstance(result, str)
        assert "A fake snippet" in result

    @pytest.mark.asyncio
    async def test_search_no_results(self, monkeypatch):
        monkeypatch.setattr("sparta_tools.web_search.duckduckgo_search", lambda q, c, f=None: [])
        result = await web_search_tool.ainvoke({"query": "xyzxyzxyz", "count": 1})
        assert isinstance(result, str)
        assert "No se encontraron resultados" in result
