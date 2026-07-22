"""Tests for permission_broker and mcp_manage_tool.

These modules guard the most sensitive operations:
  - permission_broker: decides what gets approved/denied
  - mcp_manage_tool:  decides what gets installed
"""
from __future__ import annotations

import io
import json
import os
import sys
import tempfile
from pathlib import Path
from unittest.mock import patch

import pytest


# ─────────────────────────────────────────────────────────────────────────────
# permission_broker tests
# ─────────────────────────────────────────────────────────────────────────────

class TestPermissionBroker:
    """Tests for request_permission_sync and request_permission_sync_generic."""

    def test_sync_inside_workspace_always_allowed(self, monkeypatch):
        """Paths inside the workspace are always allowed without dialog."""
        with tempfile.TemporaryDirectory() as tmpdir:
            monkeypatch.setenv("SPARTA_WORKSPACE_ROOT", tmpdir)
            # Import after setting env so the module sees it
            from sparta_tools.permission_broker import request_permission_sync
            from pathlib import Path as P
            allowed = request_permission_sync("read_file_tool", P(tmpdir).resolve())
            assert allowed is True

    def test_sync_outside_workspace_non_electron_denied(self, monkeypatch):
        """Outside-workspace access in non-Electron mode is always denied."""
        monkeypatch.setenv("SPARTA_ENV", "web")
        from sparta_tools.permission_broker import request_permission_sync
        allowed = request_permission_sync(
            "write_file_tool",
            Path("/tmp/some_outside_file.txt"),
        )
        assert allowed is False

    def test_generic_non_electron_denied(self, monkeypatch):
        """Generic permission (e.g. mcp_install) in non-Electron is denied."""
        monkeypatch.setenv("SPARTA_ENV", "web")
        from sparta_tools.permission_broker import request_permission_sync_generic
        allowed = request_permission_sync_generic(
            kind="mcp_install",
            subject="github",
            tool_name="mcp_manage_tool",
            preview="npx -y @modelcontextprotocol/server-github",
        )
        assert allowed is False

    def test_resolve_permission_unknown_id_returns_false(self):
        """resolve_permission with a bogus id returns False."""
        from sparta_tools.permission_broker import resolve_permission
        result = resolve_permission("non-existent-id", True, "once")
        assert result is False

    def test_clear_session_cache_does_not_raise(self):
        """clear_session_cache runs without error."""
        from sparta_tools.permission_broker import clear_session_cache
        clear_session_cache()  # should not raise


# ─────────────────────────────────────────────────────────────────────────────
# mcp_manage_tool tests (no disk writes, no network)
# ─────────────────────────────────────────────────────────────────────────────

class TestMcpManageTool:
    """Tests for mcp_manage_tool — never touches disk or network."""

    @pytest.fixture(autouse=True)
    def _no_env(self, monkeypatch):
        """Prevent any side effects (vault push, disk writes, events)."""
        monkeypatch.setenv("SPARTA_ENV", "web")
        # Block actual stdout emission
        monkeypatch.setattr("sys.stdout", io.StringIO())

    def test_list_catalog_returns_servers(self):
        """list_catalog returns the curated servers without errors."""
        from sparta_tools.mcp_manage_tool import mcp_manage_tool
        result = mcp_manage_tool.invoke({"action": "list_catalog"})
        assert "github" in result
        assert "filesystem" in result
        assert "notion" in result

    def test_list_configured_when_empty(self):
        """list_configured returns 'no hay servidores' when config file missing."""
        from sparta_tools.mcp_manage_tool import mcp_manage_tool
        result = mcp_manage_tool.invoke({"action": "list_configured"})
        assert "no hay" in result.lower()

    def test_install_invalid_server_rejected(self):
        """install with a server_id not in the catalog is rejected."""
        from sparta_tools.mcp_manage_tool import mcp_manage_tool
        result = mcp_manage_tool.invoke({
            "action": "install",
            "server_id": "nonexistent-server-xyz",
        })
        assert "Error" in result
        assert "no esta en el catalogo" in result.lower()
        assert "github" in result.lower()  # hints available ones

    def test_install_missing_env_rejected(self):
        """install without required env vars is rejected with hints."""
        from sparta_tools.mcp_manage_tool import mcp_manage_tool
        result = mcp_manage_tool.invoke({
            "action": "install",
            "server_id": "github",
            "env": {},  # no GITHUB_TOKEN
        })
        assert "Error" in result
        assert "GITHUB_TOKEN" in result

    def test_install_without_permission_rejected(self, monkeypatch):
        """install that fails permission dialog does NOT write to disk."""
        # Mock permission to return False
        monkeypatch.setattr(
            "sparta_ai.tools.mcp_manage_tool.request_permission_sync_generic",
            lambda **kw: False,
        )
        from sparta_tools.mcp_manage_tool import mcp_manage_tool
        # Ensure we don't actually emit events
        with patch("sparta_ai.tools.mcp_manage_tool._emit_mcp_event"):
            result = mcp_manage_tool.invoke({
                "action": "install",
                "server_id": "github",
                "env": {"GITHUB_TOKEN": "ghp_test123"},
            })
        assert "cancelada" in result.lower() or "cancelada" in result

        # Verify no file was written
        from sparta_tools.mcp_manage_tool import _MCP_CONFIG_PATH
        assert not _MCP_CONFIG_PATH.exists()

    def test_action_unknown_returns_error(self):
        """An unrecognized action returns an error with valid actions listed."""
        from sparta_tools.mcp_manage_tool import mcp_manage_tool
        result = mcp_manage_tool.invoke({"action": "fly_to_the_moon"})
        assert "Error" in result
        assert "list_catalog" in result

    def test_remove_without_server_id_returns_error(self):
        """remove requires a server_id."""
        from sparta_tools.mcp_manage_tool import mcp_manage_tool
        result = mcp_manage_tool.invoke({"action": "remove"})
        assert "Error" in result
        assert "server_id" in result.lower()

    def test_enable_without_server_id_returns_error(self):
        """enable requires a server_id."""
        from sparta_tools.mcp_manage_tool import mcp_manage_tool
        result = mcp_manage_tool.invoke({"action": "enable"})
        assert "Error" in result

    def test_vault_key_convention(self):
        """_mcp_vault_key follows the mcp:{serverId}:{VarName} convention."""
        from sparta_tools.mcp_manage_tool import _mcp_vault_key
        assert _mcp_vault_key("github", "GITHUB_TOKEN") == "mcp:github:GITHUB_TOKEN"
        assert _mcp_vault_key("filesystem", "DIR") == "mcp:filesystem:DIR"
