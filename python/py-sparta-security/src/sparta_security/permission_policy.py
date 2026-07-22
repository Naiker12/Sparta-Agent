"""Defines tool permissions and mode-based scoping (BUILD vs PLAN vs CHAT vs CONFIG_ONLY).

Connects to sparta_agent.py's bind_tools() so that the available tools
change depending on the active mode:
  - BUILD:       all tools available (write, delete, terminal, etc.)
  - PLAN:        only read/search/diagnostic tools (no destructive operations)
  - CHAT:        read/search + web + memory (no write, delete, terminal)
  - CONFIG_ONLY: only provider/skill/MCP management tools (no file/terminal access)

Tools not listed here default to requires_confirmation=False.

The permission model supports three decision outcomes per tool+path:
  - ALLOW: operation proceeds without user confirmation.
  - ASK:   user is prompted to confirm (default for destructive ops).
  - DENY:  operation is blocked immediately.

Autonomy matrix (inspired by Codex's AskForApproval x SandboxMode):
  - ApprovalPolicy: controls WHEN we ask the human for permission
  - SandboxScope:   controls WHAT the process can touch without asking
  These two axes are orthogonal and combine into a 4x3 matrix.
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

# ── Autonomy matrix enums ─────────────────────────────────────

class ApprovalPolicy(Enum):
    """When to ask the human for permission.

    NEVER_ASK:  auto-approve all operations (dangerous, opt-in only)
    ASK_ON_WRITE: ask before write/delete/terminal (default for agent mode)
    ASK_ALWAYS:  ask on every sensitive tool call (chat/untrusted mode)
    """
    NEVER_ASK = "never"
    ASK_ON_WRITE = "on_write"
    ASK_ALWAYS = "always"


class SandboxScope(Enum):
    """What the process can touch without asking.

    READ_ONLY:      no writes, no terminal (chat mode default)
    WORKSPACE_WRITE: can write/delete inside workspace (agent mode default)
    FULL_ACCESS:    unrestricted terminal + filesystem (advanced opt-in)
    """
    READ_ONLY = "read_only"
    WORKSPACE_WRITE = "workspace_write"
    FULL_ACCESS = "full_access"


# Preset mappings: UI mode → (ApprovalPolicy, SandboxScope)
MODE_PRESETS: dict[str, tuple[ApprovalPolicy, SandboxScope]] = {
    "chat":        (ApprovalPolicy.ASK_ALWAYS,     SandboxScope.READ_ONLY),
    "agent":       (ApprovalPolicy.ASK_ON_WRITE,   SandboxScope.WORKSPACE_WRITE),
    "build":       (ApprovalPolicy.ASK_ON_WRITE,   SandboxScope.WORKSPACE_WRITE),
    "plan":        (ApprovalPolicy.ASK_ALWAYS,     SandboxScope.READ_ONLY),
    "config_only": (ApprovalPolicy.ASK_ALWAYS,     SandboxScope.READ_ONLY),
}

# Built-in tool classification by scope
# NOTE: LangChain 0.3+ strips "_tool" suffix from @tool-decorated functions.
# We include BOTH names for backward compat until all tools are renamed.
_READ_TOOLS = frozenset({
    "read_file", "read_file_tool",
    "read_files", "read_files_tool",
    "search_files", "search_files_tool",
    "read_memory", "read_memory_tool",
    "skill_view", "skill_view_tool",
    "skills_list", "skills_list_tool",
    "web_search", "web_search_tool",
    "create_plan",
    "get_diagnostics", "get_diagnostics_tool",
    "terminal_check", "terminal_check_tool",
    "get_open_files", "get_open_files_tool",
})

# Chat mode: read/search + web + memory, no write/delete/terminal
_CHAT_TOOLS = frozenset({
    "read_file", "read_file_tool",
    "read_files", "read_files_tool",
    "search_files", "search_files_tool",
    "read_memory", "read_memory_tool",
    "write_memory", "write_memory_tool",
    "skill_view", "skill_view_tool",
    "skills_list", "skills_list_tool",
    "web_search", "web_search_tool",
    "web_fetch", "web_fetch_tool",
    "get_diagnostics", "get_diagnostics_tool",
})

_WRITE_TOOLS = frozenset({
    "write_file", "write_file_tool",
    "patch_file", "patch_file_tool",
    "delete_file", "delete_file_tool",
    "write_memory", "write_memory_tool",
    "skill_manage", "skill_manage_tool",
})

_EXECUTE_TOOLS = frozenset({
    "terminal_execute", "terminal_execute_tool",
    "terminal_execute_background", "terminal_execute_background_tool",
})

_MANAGE_TOOLS = frozenset({
    "mcp_manage", "mcp_manage_tool",
})

# Config-only tools: provider/skill/MCP management (no file/terminal access)
_CONFIG_TOOLS = frozenset({
    "skills_list", "skills_list_tool",
    "skill_view", "skill_view_tool",
    "skill_manage", "skill_manage_tool",
    "mcp_manage", "mcp_manage_tool",
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

    Three modes (backward-compatible):
      - "build": full access — all tools available (respecting per-tool rules)
      - "plan":  read-only — only read/search tools; write/delete/terminal blocked
      - "chat":  conversational — read/search/web/memory; no write/delete/terminal

    New autonomy matrix (orthogonal axes):
      - approval: ApprovalPolicy — when to ask the human
      - sandbox:  SandboxScope   — what the process can touch

    The matrix is derived from the mode via MODE_PRESETS, but can be
    overridden via set_autonomy() for advanced users.

    Permission rules are evaluated from the beginning of the list; the last
    matching rule wins.  A catch-all "*" rule at the end sets the default.
    """

    def __init__(self, mode: str = "build"):
        self._mode = mode
        # Derive approval + sandbox from mode preset
        preset = MODE_PRESETS.get(mode, MODE_PRESETS["build"])
        self._approval = preset[0]
        self._sandbox = preset[1]
        self._rules: list[PermissionRule] = [
            # ── Config-only mode rules ──────────────────────────────────
            # These are evaluated FIRST; the last matching rule wins, so
            # config-only rules are at the top, general rules follow below.
            # For config_only mode, all non-config tools are DENY by default.
            PermissionRule("skills_list_tool", decision=PermissionDecision.ALLOW),
            PermissionRule("skills_list", decision=PermissionDecision.ALLOW),
            PermissionRule("skill_view_tool", decision=PermissionDecision.ALLOW),
            PermissionRule("skill_view", decision=PermissionDecision.ALLOW),
            PermissionRule("skill_manage_tool", decision=PermissionDecision.ALLOW),
            PermissionRule("skill_manage", decision=PermissionDecision.ALLOW),
            PermissionRule("mcp_manage_tool", decision=PermissionDecision.ASK),
            PermissionRule("mcp_manage", decision=PermissionDecision.ASK),
            # ── General rules ───────────────────────────────────────────
            # Terminal commands default to ASK (user must confirm each time)
            PermissionRule("terminal_execute_tool", decision=PermissionDecision.ASK),
            PermissionRule("terminal_execute", decision=PermissionDecision.ASK),
            PermissionRule("terminal_execute_background_tool", decision=PermissionDecision.ASK),
            PermissionRule("terminal_execute_background", decision=PermissionDecision.ASK),
            # Delete operations default to ASK even inside workspace
            PermissionRule("delete_file_tool", decision=PermissionDecision.ASK),
            PermissionRule("delete_file", decision=PermissionDecision.ASK),
            # Write/patch operations default to ALLOW inside workspace
            PermissionRule("write_file_tool", decision=PermissionDecision.ALLOW),
            PermissionRule("write_file", decision=PermissionDecision.ALLOW),
            PermissionRule("patch_file_tool", decision=PermissionDecision.ALLOW),
            PermissionRule("patch_file", decision=PermissionDecision.ALLOW),
            # Read/search tools default to ALLOW
            PermissionRule("read_file_tool", decision=PermissionDecision.ALLOW),
            PermissionRule("read_file", decision=PermissionDecision.ALLOW),
            PermissionRule("search_files_tool", decision=PermissionDecision.ALLOW),
            PermissionRule("search_files", decision=PermissionDecision.ALLOW),
            PermissionRule("skill_view_tool", decision=PermissionDecision.ALLOW),
            PermissionRule("skill_view", decision=PermissionDecision.ALLOW),
            PermissionRule("skills_list_tool", decision=PermissionDecision.ALLOW),
            PermissionRule("skills_list", decision=PermissionDecision.ALLOW),
            PermissionRule("web_search_tool", decision=PermissionDecision.ALLOW),
            PermissionRule("web_search", decision=PermissionDecision.ALLOW),
            PermissionRule("read_memory_tool", decision=PermissionDecision.ALLOW),
            PermissionRule("read_memory", decision=PermissionDecision.ALLOW),
            PermissionRule("write_memory_tool", decision=PermissionDecision.ALLOW),
            PermissionRule("write_memory", decision=PermissionDecision.ALLOW),
            PermissionRule("skill_manage_tool", decision=PermissionDecision.ALLOW),
            PermissionRule("skill_manage", decision=PermissionDecision.ALLOW),
            # MCP management defaults to ASK (installing servers is a security-sensitive action)
            PermissionRule("mcp_manage_tool", decision=PermissionDecision.ASK),
            PermissionRule("mcp_manage", decision=PermissionDecision.ASK),
            # Legacy wildcard: tools not explicitly listed default to ALLOW
            # In config_only mode, filter_tools() ensures only config tools
            # reach get_decision(), so this catch-all is safe.
            PermissionRule("*", decision=PermissionDecision.ALLOW),
        ]
        self._tools: dict[str, ToolPermission] = {
            tp.name: tp
            for tp in [
                ToolPermission("terminal_execute_tool", requires_confirmation=True),
                ToolPermission("terminal_execute", requires_confirmation=True),
                ToolPermission("terminal_execute_background_tool", requires_confirmation=True),
                ToolPermission("terminal_execute_background", requires_confirmation=True),
                ToolPermission("write_file_tool", requires_confirmation=False),
                ToolPermission("write_file", requires_confirmation=False),
                ToolPermission("patch_file_tool", requires_confirmation=False),
                ToolPermission("patch_file", requires_confirmation=False),
                ToolPermission("delete_file_tool", requires_confirmation=False),
                ToolPermission("delete_file", requires_confirmation=False),
                ToolPermission("skill_manage_tool", requires_confirmation=False),
                ToolPermission("skill_manage", requires_confirmation=False),
                ToolPermission("read_file_tool", requires_confirmation=False),
                ToolPermission("read_file", requires_confirmation=False),
                ToolPermission("web_search_tool", requires_confirmation=False),
                ToolPermission("read_memory_tool", requires_confirmation=False),
                ToolPermission("read_memory", requires_confirmation=False),
                ToolPermission("write_memory_tool", requires_confirmation=False),
                ToolPermission("write_memory", requires_confirmation=False),
                ToolPermission("skill_view_tool", requires_confirmation=False),
                ToolPermission("skill_view", requires_confirmation=False),
            ]
        }

    @property
    def mode(self) -> str:
        return self._mode

    @mode.setter
    def mode(self, value: str) -> None:
        # "agent" is a UI alias for "build" — both grant full tool access
        normalized = "build" if value == "agent" else value
        if normalized not in ("build", "plan", "chat", "config_only"):
            raise ValueError(f"Unknown policy mode: {value}")
        self._mode = normalized
        # Re-derive approval + sandbox from preset (use original value for lookup)
        preset = MODE_PRESETS.get(value, MODE_PRESETS.get(normalized, MODE_PRESETS["build"]))
        self._approval = preset[0]
        self._sandbox = preset[1]

    @property
    def approval(self) -> ApprovalPolicy:
        return self._approval

    @property
    def sandbox(self) -> SandboxScope:
        return self._sandbox

    def set_autonomy(
        self,
        approval: ApprovalPolicy | None = None,
        sandbox: SandboxScope | None = None,
    ) -> None:
        """Override approval/sandbox axes independently (for advanced users)."""
        if approval is not None:
            self._approval = approval
        if sandbox is not None:
            self._sandbox = sandbox
        logger.info(
            "Autonomy updated: approval=%s, sandbox=%s",
            self._approval.value,
            self._sandbox.value,
        )

    def get_decision(self, tool_name: str, resolved_path: Path | None = None) -> PermissionDecision:
        """Evaluate permission rules for the given tool and optional path.

        Rules are evaluated in order; the last matching rule determines the
        decision.  This enables OpenCode-style configuration:
        ``{"edit": {"*": "deny", "src/*.ts": "allow"}}``

        In CONFIG_ONLY mode, filter_tools() is called FIRST to restrict the
        available tools, then get_decision() evaluates rules against only
        those tools. This two-layer approach ensures that even if a non-config
        tool somehow reaches get_decision(), the config-only catch-all rules
        will block it.
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
        In "chat" mode, read/search/web/memory tools are allowed (no write/delete/terminal).
        In "config_only" mode, only skill/MCP management tools are allowed.
        In "build" mode, all tools pass through (respecting per-tool rules).
        """
        if not tools:
            return tools
        if self._mode == "build":
            return tools
        if self._mode == "plan":
            return [t for t in tools if getattr(t, "name", "") in _READ_TOOLS]
        if self._mode == "chat":
            return [t for t in tools if getattr(t, "name", "") in _CHAT_TOOLS]
        if self._mode == "config_only":
            return [t for t in tools if getattr(t, "name", "") in _CONFIG_TOOLS]
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


def set_autonomy(
    approval: ApprovalPolicy | None = None,
    sandbox: SandboxScope | None = None,
) -> None:
    """Override approval/sandbox axes on the global policy."""
    get_policy().set_autonomy(approval, sandbox)
