"""MCP Connection Manager — persistent connection pool for MCP servers.

Replaces the per-turn ``build_mcp_tools()`` pattern which leaked connections:
every user message created new ``RealMCPClient`` instances, connected them,
and never called ``disconnect()`` — resulting in N orphaned ``npx`` processes
after N turns.

This module maintains a pool of live clients keyed by (session_id, server_id).
Connections are reused when the server config hasn't changed between turns,
and explicitly cleaned up when a session ends or the sidecar shuts down.

Usage::

    from sparta_tools.mcp_manager import mcp_manager

    # During agent preparation (per turn):
    tools = await mcp_manager.get_tools(session_id, servers_config, emit_fn)

    # On session close:
    await mcp_manager.disconnect_session(session_id)

    # On sidecar shutdown:
    await mcp_manager.disconnect_all()
"""
from __future__ import annotations

import hashlib
import json
import logging
import time
from typing import Any, Callable

from sparta_tools.mcp_client import RealMCPClient, _make_langchain_tool

logger = logging.getLogger("sparta_ai.tools.mcp_manager")

# How long a server that failed to connect stays "broken" (skipped on every
# turn) before Sparta tries it again on its own. Editing the server's config
# always forces an immediate retry regardless of this cooldown, since that
# changes the config hash the breaker is keyed on.
_BROKEN_COOLDOWN_SECONDS = 60


def _config_hash(config: dict) -> str:
    """Deterministic hash of the fields that affect connection identity.

    Ignores volatile fields like ``enabled`` (handled separately) and
    ``name`` (cosmetic).  Focuses on what the transport needs.
    """
    significant = {
        "id": config.get("id", ""),
        "type": config.get("type", "stdio"),
        "command": config.get("command", ""),
        "args": config.get("args", []),
        "env": config.get("env", {}),
        "url": config.get("url", ""),
        "headers": config.get("headers", {}),
        "timeout": config.get("timeout", 30),
        "connect_timeout": config.get("connect_timeout"),
        "tools": config.get("tools", {}),
        "env_vault_refs": config.get("env_vault_refs", []),
        "headers_vault_refs": config.get("headers_vault_refs", []),
    }
    raw = json.dumps(significant, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


class _ServerSlot:
    """Internal bookkeeping for one MCP server within a session."""

    __slots__ = ("client", "config_hash", "tool_defs", "langchain_tools")

    def __init__(self, client: RealMCPClient, config_hash: str, tool_defs: list[dict], langchain_tools: list):
        self.client = client
        self.config_hash = config_hash
        self.tool_defs = tool_defs
        self.langchain_tools = langchain_tools


class _BrokenState:
    """Marks a server as failed so `get_tools()` skips it for a cooldown
    window instead of re-attempting (and re-hanging on) a broken connection
    on every single chat turn."""

    __slots__ = ("config_hash", "failed_at", "error")

    def __init__(self, config_hash: str, error: str):
        self.config_hash = config_hash
        self.failed_at = time.monotonic()
        self.error = error


class MCPConnectionManager:
    """Pool of live MCP clients keyed by (session_id, server_id).

    - ``get_tools()`` reuses connections when config is unchanged.
    - ``disconnect_session()`` tears down all clients for a session.
    - ``disconnect_all()`` is the global shutdown hook.
    """

    def __init__(self) -> None:
        # session_id -> {server_id -> _ServerSlot}
        self._sessions: dict[str, dict[str, _ServerSlot]] = {}
        # session_id -> {server_id -> _BrokenState}
        self._broken: dict[str, dict[str, _BrokenState]] = {}

    async def get_tools(
        self,
        session_id: str,
        servers_config: list[dict],
        emit_fn: Callable[[str, dict], Any] | None = None,
        workspace_root: str = "",
    ) -> list:
        """Return LangChain StructuredTools for the given servers.

        Reuses live connections when the config hash matches.  Only
        reconnects servers whose config actually changed.  Disabled
        servers are silently skipped (and disconnected if previously
        connected).
        """
        if not servers_config:
            return []

        session_slots = self._sessions.setdefault(session_id, {})
        broken_slots = self._broken.setdefault(session_id, {})
        langchain_tools: list = []

        # Track which server IDs are in this turn's config so we can
        # disconnect any that were removed.
        active_ids: set[str] = set()

        for cfg in servers_config:
            server_id: str = cfg.get("id", cfg.get("name", "?"))
            active_ids.add(server_id)

            if not cfg.get("enabled", True):
                # Server disabled — disconnect if it was alive, skip.
                if server_id in session_slots:
                    await self._disconnect_slot(session_slots.pop(server_id), server_id)
                    if emit_fn:
                        self._safe_emit(emit_fn, "mcp:disconnected", {"serverId": server_id})
                broken_slots.pop(server_id, None)
                continue

            new_hash = _config_hash(cfg)
            existing = session_slots.get(server_id)

            if existing and existing.config_hash == new_hash:
                # Config unchanged — reuse live connection.
                logger.debug("MCP: reusing connection for '%s' (session %s)", server_id, session_id)
                langchain_tools.extend(existing.langchain_tools)
                continue

            # ── Circuit breaker: skip servers that just failed with this
            # exact config instead of re-attempting (and possibly re-hanging
            # on) a broken connection on every single chat turn. ──
            broken = broken_slots.get(server_id)
            if broken and broken.config_hash == new_hash:
                elapsed = time.monotonic() - broken.failed_at
                if elapsed < _BROKEN_COOLDOWN_SECONDS:
                    logger.debug(
                        "MCP: skipping '%s' — failed %.0fs ago, cooldown %ds remaining",
                        server_id, elapsed, _BROKEN_COOLDOWN_SECONDS - elapsed,
                    )
                    continue
                logger.info("MCP: retrying '%s' after cooldown", server_id)

            # Config changed or first connection — disconnect old, connect new.
            if existing:
                await self._disconnect_slot(existing, server_id)

            client = RealMCPClient(cfg)
            try:
                tool_defs = await client.connect(workspace_root=workspace_root)
            except Exception as e:
                logger.error("MCP: failed to connect '%s': %s", server_id, e)
                broken_slots[server_id] = _BrokenState(new_hash, str(e))
                if emit_fn:
                    self._safe_emit(emit_fn, "mcp:error", {"serverId": server_id, "error": str(e)})
                continue

            # Connected successfully — clear any previous broken marker.
            broken_slots.pop(server_id, None)

            # Build LangChain tools for this server.
            lc_tools = []
            for tool_def in tool_defs:
                try:
                    lc_tools.append(_make_langchain_tool(client, tool_def))
                except Exception as e:
                    logger.error("MCP: failed to wrap tool '%s.%s': %s", server_id, tool_def.get("name"), e)

            session_slots[server_id] = _ServerSlot(client, new_hash, tool_defs, lc_tools)
            langchain_tools.extend(lc_tools)

            # Emit connection events to the frontend.
            if emit_fn:
                self._safe_emit(emit_fn, "mcp:connected", {
                    "serverId": server_id,
                    "toolCount": len(tool_defs),
                })
                if tool_defs:
                    self._safe_emit(emit_fn, "mcp:tool_discovered", {
                        "serverId": server_id,
                        "tools": [
                            {
                                "name": t["name"],
                                "description": t.get("description", ""),
                                "inputSchema": t.get("inputSchema", {}),
                            }
                            for t in tool_defs
                        ],
                    })

        # Disconnect servers that were in the session but not in this turn's config.
        orphaned = set(session_slots.keys()) - active_ids
        for server_id in orphaned:
            await self._disconnect_slot(session_slots.pop(server_id), server_id)
            if emit_fn:
                self._safe_emit(emit_fn, "mcp:disconnected", {"serverId": server_id})
        for server_id in set(broken_slots.keys()) - active_ids:
            broken_slots.pop(server_id, None)

        if langchain_tools:
            logger.info(
                "MCP: %d tools from %d servers (session %s)",
                len(langchain_tools), len(active_ids), session_id,
            )

        return langchain_tools

    async def disconnect_session(self, session_id: str) -> None:
        """Disconnect all MCP clients for a session."""
        session_slots = self._sessions.pop(session_id, {})
        self._broken.pop(session_id, None)
        for server_id, slot in session_slots.items():
            await self._disconnect_slot(slot, server_id)
        if session_slots:
            logger.info("MCP: disconnected %d servers for session %s", len(session_slots), session_id)

    async def disconnect_all(self) -> None:
        """Disconnect all MCP clients across all sessions (sidecar shutdown)."""
        session_count = len(self._sessions)
        server_count = sum(len(slots) for slots in self._sessions.values())
        for session_id, session_slots in list(self._sessions.items()):
            for server_id, slot in session_slots.items():
                await self._disconnect_slot(slot, server_id)
        self._sessions.clear()
        self._broken.clear()
        if server_count:
            logger.info("MCP: disconnected %d servers across %d sessions (shutdown)", server_count, session_count)

    # ── Internal helpers ─────────────────────────────────────────────────

    @staticmethod
    async def _disconnect_slot(slot: _ServerSlot, server_id: str) -> None:
        try:
            await slot.client.disconnect()
        except Exception as e:
            logger.debug("MCP: error disconnecting '%s': %s", server_id, e)

    @staticmethod
    def _safe_emit(emit_fn: Callable, event: str, data: dict) -> None:
        try:
            emit_fn(event, data)
        except Exception as e:
            logger.debug("MCP: failed to emit '%s': %s", event, e)


# Module-level singleton — one manager per sidecar process.
mcp_manager = MCPConnectionManager()
