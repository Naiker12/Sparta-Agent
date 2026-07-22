"""Scope rules for CONFIG_ONLY mode — whitelist of allowed actions.

This is the HARD limit (backend, non-negotiable). Every tool call is validated
against this whitelist BEFORE execution, regardless of what the LLM says.

The whitelist is the single source of truth — NOT duplicated in the system prompt.
"""
from __future__ import annotations

import logging
from enum import Enum
from typing import Any

logger = logging.getLogger("sparta_ai.security.scope_rules")


class AgentScopeMode(Enum):
    """Modo de operación del agente.

    BUILD:      all tools available (write, delete, terminal, etc.)
    PLAN:       only read/search/diagnostic tools (no destructive operations)
    CHAT:       read/search + web + memory (no write, delete, terminal)
    CONFIG_ONLY: restricted to Sparta configuration only (providers, skills, MCP)
    """
    BUILD = "build"
    PLAN = "plan"
    CHAT = "chat"
    CONFIG_ONLY = "config_only"


# ── Whitelist of allowed actions in CONFIG_ONLY mode ────────────────────
# This is the single source of truth. The system prompt is a UX aid only.
ALLOWED_ACTIONS: frozenset[str] = frozenset({
    "provider.list",
    "provider.add",
    "provider.enable",
    "provider.disable",
    "provider.set_api_key",
    "skill.list",
    "skill.add",
    "skill.enable",
    "skill.disable",
    "mcp.list",
    "mcp.add",
})

# Module paths that are allowed to expose tools in CONFIG_ONLY mode.
# Validated by module path, not by tool name (prevents disguising destructive tools).
ALLOWED_MODULE_PATHS: frozenset[str] = frozenset({
    "sparta_ai.config.providers",
    "sparta_ai.tools.skill_tools",
    "sparta_ai.tools.mcp_manage_tool",
    "sparta_ai.tools.mcp_client",
    "sparta_ai.tools.permission_broker",
    "sparta_ai.security.scope_rules",
    "sparta_ai.config.security",
})

# Module paths that are NEVER allowed in CONFIG_ONLY mode, regardless of tool name.
DENIED_MODULE_PATHS: frozenset[str] = frozenset({
    "sparta_ai.tools.terminal_tools",
    "sparta_ai.tools.patch_tools",
    "sparta_ai.tools.file_tools",
    "sparta_ai.tools.file",
    "sparta_ai.tools.code_search_tools",
    "sparta_ai.tools.plan_tool",
})


class Decision(Enum):
    """Result of a scope validation."""
    ALLOW = "allow"
    ASK = "ask"
    DENY = "deny"


def validate_action(action: str, payload: dict[str, Any] | None = None) -> Decision:
    """Validate an action against the CONFIG_ONLY whitelist.

    Args:
        action: The action string (e.g. "provider.set_api_key").
        payload: Optional payload dict for additional context.

    Returns:
        Decision.ALLOW, Decision.ASK, or Decision.DENY.

    Rules:
        - Any action outside ALLOWED_ACTIONS → DENY immediately.
        - provider.set_api_key → always ASK (never auto-allow).
        - provider.disable on the currently active provider → ASK.
        - mcp.add → always ASK.
        - skill.add from internal catalog → ALLOW; external/new → ASK.
    """
    if action not in ALLOWED_ACTIONS:
        logger.info("Scope DENY: action '%s' not in whitelist", action)
        return Decision.DENY

    # ── provider.set_api_key: always ASK ──────────────────────────────
    if action == "provider.set_api_key":
        return Decision.ASK

    # ── mcp.add: always ASK ──────────────────────────────────────────
    if action == "mcp.add":
        return Decision.ASK

    # ── provider.disable: ASK if disabling the active provider ────────
    if action == "provider.disable" and payload:
        provider_id = payload.get("provider_id", "")
        active_provider = payload.get("active_provider", "")
        if provider_id and provider_id == active_provider:
            return Decision.ASK

    # ── skill.add: ALLOW from internal catalog, ASK for external ──────
    if action == "skill.add" and payload:
        source = payload.get("source", "external")
        if source != "internal":
            return Decision.ASK

    return Decision.ALLOW


def validate_tool_module(module_path: str) -> bool:
    """Check if a tool's module path is allowed in CONFIG_ONLY mode.

    This prevents tools from disguising themselves with innocent names
    while coming from a destructive module.

    Args:
        module_path: The full Python module path (e.g. "sparta_ai.tools.file_tools").

    Returns:
        True if the module is allowed, False if denied.
    """
    # Explicitly denied modules
    for denied in DENIED_MODULE_PATHS:
        if module_path.startswith(denied):
            return False

    # Allowed modules
    for allowed in ALLOWED_MODULE_PATHS:
        if module_path.startswith(allowed):
            return True

    # Unknown modules are denied in CONFIG_ONLY mode
    return False


def get_denied_message(action: str) -> str:
    """Return a user-facing message explaining why an action was denied."""
    return (
        f"La acción '{action}' está fuera del scope de configuración. "
        f"En este modo solo puedes: listar, agregar, activar o desactivar "
        f"proveedores de IA, skills y servidores MCP. "
        f"Si necesitas hacer otra cosa, cambia al modo normal de chat/agente."
    )