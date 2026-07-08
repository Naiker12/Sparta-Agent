"""Defines tool permissions and mode-based scoping (BUILD vs PLAN).

Connects to sparta_agent.py's bind_tools() so that the available tools
change depending on the active mode:
  - BUILD:  all tools available (write, delete, terminal, etc.)
  - PLAN:   only read/search/diagnostic tools (no destructive operations)

Tools not listed here default to requires_confirmation=False.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

logger = logging.getLogger("sparta_ai.security.permissions")

# Built-in tool classification by scope
_READ_TOOLS = frozenset({
    "read_file_tool", "search_files_tool",
    "read_memory_tool",
    "skill_view_tool", "skills_list_tool",
    "web_search_tool", "web_search",
    "create_plan",
})

_WRITE_TOOLS = frozenset({
    "write_file_tool", "patch_file_tool", "delete_file_tool",
    "write_memory_tool",
    "skill_manage_tool",
})

_EXECUTE_TOOLS = frozenset({
    "terminal_execute_tool", "terminal_execute_background_tool",
})

_MANAGE_TOOLS = frozenset({
    "mcp_manage_tool",
})

_ALL_TOOLS = _READ_TOOLS | _WRITE_TOOLS | _EXECUTE_TOOLS | _MANAGE_TOOLS


@dataclass
class ToolPermission:
    """Permission settings for a single tool."""
    name: str
    requires_confirmation: bool = False
    max_calls_per_turn: int = 10


class PermissionPolicy:
    """Central policy for tool permissions and mode scoping.

    Two modes:
      - "build": full access — all tools available (respecting per-tool confirmation)
      - "plan":  read-only — only read/search tools; write/delete/terminal blocked

    Tools not listed in _tools default to requires_confirmation=False.
    """

    def __init__(self, mode: str = "build"):
        self._mode = mode
        self._tools: dict[str, ToolPermission] = {
            tp.name: tp
            for tp in [
                ToolPermission("terminal_execute_tool", requires_confirmation=True),
                ToolPermission("terminal_execute_background_tool", requires_confirmation=True),
                ToolPermission("write_file_tool", requires_confirmation=False),
                ToolPermission("patch_file_tool", requires_confirmation=False),
                ToolPermission("delete_file_tool", requires_confirmation=False),
                ToolPermission("skill_manage_tool", requires_confirmation=False),
                ToolPermission("read_file_tool", requires_confirmation=False),
                ToolPermission("web_search_tool", requires_confirmation=False),
                ToolPermission("read_memory_tool", requires_confirmation=False),
                ToolPermission("write_memory_tool", requires_confirmation=False),
                ToolPermission("skill_view_tool", requires_confirmation=False),
            ]
        }

    @property
    def mode(self) -> str:
        return self._mode

    @mode.setter
    def mode(self, value: str) -> None:
        if value not in ("build", "plan"):
            raise ValueError(f"Unknown policy mode: {value}")
        self._mode = value

    def requires_confirmation(self, tool_name: str) -> bool:
        tp = self._tools.get(tool_name)
        return tp.requires_confirmation if tp else False

    def max_calls(self, tool_name: str) -> int:
        tp = self._tools.get(tool_name)
        return tp.max_calls_per_turn if tp else 10

    def filter_tools(self, tools: list) -> list:
        """Filter a tool list according to the current policy mode.

        In "plan" mode, only read/search/diagnostic tools are allowed.
        In "build" mode, all tools pass through (respecting per-tool confirmation).
        """
        if not tools:
            return tools
        if self._mode == "build":
            return tools
        if self._mode == "plan":
            return [t for t in tools if getattr(t, "name", "") in _READ_TOOLS]
        return tools


# Singleton for use across the application
_POLICY: PermissionPolicy | None = None


def get_policy() -> PermissionPolicy:
    global _POLICY
    if _POLICY is None:
        _POLICY = PermissionPolicy()
    return _POLICY


def set_policy_mode(mode: str) -> None:
    get_policy().mode = mode
    logger.info("Permission policy set to '%s' mode", mode)
