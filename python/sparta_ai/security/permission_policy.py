"""Defines tool permissions and mode-based scoping (BUILD vs PLAN).

Connects to sparta_agent.py's bind_tools() so that the available tools
change depending on the active mode:
  - BUILD:  all tools available (write, delete, terminal, etc.)
  - PLAN:   only read/search/diagnostic tools (no destructive operations)

Tools not listed here default to requires_confirmation=False.

The permission model supports three decision outcomes per tool+path:
  - ALLOW: operation proceeds without user confirmation.
  - ASK:   user is prompted to confirm (default for destructive ops).
  - DENY:  operation is blocked immediately.
"""
from __future__ import annotations

import fnmatch
import logging
import os
import re
from dataclasses import dataclass
from enum import Enum
from pathlib import Path

logger = logging.getLogger("sparta_ai.security.permissions")

# Built-in tool classification by scope
_READ_TOOLS = frozenset({
    "read_file_tool", "search_files_tool",
    "read_memory_tool",
    "skill_view_tool", "skills_list_tool",
    "web_search_tool", "web_search",
    "create_plan",
    "get_diagnostics_tool",
    "terminal_check_tool",
    "get_open_files_tool",
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


class PermissionDecision(Enum):
    ALLOW = "allow"
    ASK = "ask"
    DENY = "deny"


@dataclass
class PermissionRule:
    """A single permission rule matching a tool name (fnmatch) and optional path pattern.

    Rules are evaluated from most specific to least specific; the last
    matching rule wins.  A wildcard tool name "*" matches all tools.
    """
    tool_pattern: str
    decision: PermissionDecision = PermissionDecision.ASK
    path_pattern: str | None = None
    _path_re: re.Pattern | None = None

    def __post_init__(self):
        if self.path_pattern:
            self._path_re = re.compile(fnmatch.translate(self.path_pattern), re.IGNORECASE)

    def matches(self, tool_name: str, resolved_path: Path | None = None) -> bool:
        if not fnmatch.fnmatch(tool_name, self.tool_pattern):
            return False
        if self.path_pattern and resolved_path is not None:
            return bool(
                self._path_re
                and self._path_re.search(os.path.normcase(str(resolved_path)))
            )
        return self.path_pattern is None


@dataclass
class ToolPermission:
    """Permission settings for a single tool (legacy — kept for backward compat)."""
    name: str
    requires_confirmation: bool = False
    max_calls_per_turn: int = 10


class PermissionPolicy:
    """Central policy for tool permissions and mode scoping.

    Two modes:
      - "build": full access — all tools available (respecting per-tool rules)
      - "plan":  read-only — only read/search tools; write/delete/terminal blocked

    Permission rules are evaluated from the beginning of the list; the last
    matching rule wins.  A catch-all "*" rule at the end sets the default.
    """

    def __init__(self, mode: str = "build"):
        self._mode = mode
        self._rules: list[PermissionRule] = [
            # Terminal commands default to ASK (user must confirm each time)
            PermissionRule("terminal_execute_tool", decision=PermissionDecision.ASK),
            PermissionRule("terminal_execute_background_tool", decision=PermissionDecision.ASK),
            # Delete operations default to ASK even inside workspace
            PermissionRule("delete_file_tool", decision=PermissionDecision.ASK),
            # Write/patch operations default to ALLOW inside workspace
            PermissionRule("write_file_tool", decision=PermissionDecision.ALLOW),
            PermissionRule("patch_file_tool", decision=PermissionDecision.ALLOW),
            # Read/search tools default to ALLOW
            PermissionRule("read_file_tool", decision=PermissionDecision.ALLOW),
            PermissionRule("search_files_tool", decision=PermissionDecision.ALLOW),
            PermissionRule("skill_view_tool", decision=PermissionDecision.ALLOW),
            PermissionRule("skills_list_tool", decision=PermissionDecision.ALLOW),
            PermissionRule("web_search_tool", decision=PermissionDecision.ALLOW),
            PermissionRule("web_search", decision=PermissionDecision.ALLOW),
            PermissionRule("read_memory_tool", decision=PermissionDecision.ALLOW),
            PermissionRule("write_memory_tool", decision=PermissionDecision.ALLOW),
            PermissionRule("skill_manage_tool", decision=PermissionDecision.ALLOW),
            # MCP management defaults to ASK (installing servers is a security-sensitive action)
            PermissionRule("mcp_manage_tool", decision=PermissionDecision.ASK),
            # Legacy wildcard: tools not explicitly listed default to ALLOW
            PermissionRule("*", decision=PermissionDecision.ALLOW),
        ]
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

    def get_decision(self, tool_name: str, resolved_path: Path | None = None) -> PermissionDecision:
        """Evaluate permission rules for the given tool and optional path.

        Rules are evaluated in order; the last matching rule determines the
        decision.  This enables OpenCode-style configuration:
        ``{"edit": {"*": "deny", "src/*.ts": "allow"}}``
        """
        decision = PermissionDecision.ALLOW  # default if no rules match
        for rule in self._rules:
            if rule.matches(tool_name, resolved_path):
                decision = rule.decision
                # Continue: last matching rule wins
        return decision

    def requires_confirmation(self, tool_name: str) -> bool:
        tp = self._tools.get(tool_name)
        return tp.requires_confirmation if tp else False

    def max_calls(self, tool_name: str) -> int:
        tp = self._tools.get(tool_name)
        return tp.max_calls_per_turn if tp else 10

    def filter_tools(self, tools: list) -> list:
        """Filter a tool list according to the current policy mode.

        In "plan" mode, only read/search/diagnostic tools are allowed.
        In "build" mode, all tools pass through (respecting per-tool rules).
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
