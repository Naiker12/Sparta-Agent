"""MCP Connection Manager — persistent connection pool for MCP servers.

Replaces the per-turn ``build_mcp_tools()`` pattern which leaked connections:
every user message created new ``RealMCPClient`` instances, connected them,
and never called ``disconnect()`` — resulting in N orphaned ``npx`` processes
after N turns.

This module maintains a pool of live clients keyed by (session_id, server_id).
Connections are reused when the server config hasn't changed between turns,
and explicitly cleaned up when a session ends or the sidecar shuts down.

Includes a **circuit breaker** per server: when ``connect()`` fails, the
failure is cached with a timestamp so that subsequent turns do NOT retry
the broken server until a cooldown expires (default 60s) or the config
changes.

Usage::

    from sparta_ai.tools.mcp_manager import mcp_manager

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

from sparta_ai.tools.mcp_client import RealMCPClient, _make_langchain_tool

logger = logging.getLogger("sparta_ai.tools.mcp_manager")

# How long (seconds) to wait before retrying a server whose connection
# previously failed.  Prevents the per-turn retry storm documented in Doc 26.
_MCP_CIRCUIT_BREAKER_COOLDOWN = 60


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
        "tools": config.get("tools", {}),
        "env_vault_refs": config.get("env_vault_refs", []),
        "headers_vault_refs": config.get("headers_vault_refs", []),
    }
    raw = json.dumps(significant, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()[:16]


class _ServerSlot:
    """Internal bookkeeping for one MCP server within a session."""

    __slots__ = ("client", "config_hash", "tool_defs", "langchain_tools", "broken_since")

    def __init__(self, client: RealMCPClient, config_hash: str, tool_defs: list[dict], langchain_tools: list):
        self.client = client
        self.config_hash = config_hash
        self.tool_defs = tool_defs
        self.langchain_tools = langchain_tools
        self.broken_since: float | None = None  # timestamp when connect() last failed


class MCPConnectionManager:
    """Pool of live MCP clients keyed by (session_id, server_id).

    - ``get_tools()`` reuses connections when config is unchanged.
    - ``disconnect_session()`` tears down all clients for a session.
    - ``disconnect_all()`` is the global shutdown hook.
    """

    def __init__(self) -> None:
        # session_id -> {server_id -> _ServerSlot}
        self._sessions: dict[str, dict[str, _ServerSlot]] = {}

    async def get_tools(
        self,
        session_id: str,
        servers_config: list[dict],
        emit_fn: Callable[[str, dict], Any] | None = None,
    ) -> list:
        """Return LangChain StructuredTools for the given servers.

        Reuses live connections when the config hash matches.  Only
        reconnects servers whose config actually changed.  Disabled
        servers are silently skipped (and disconnected if previously
        connected).

        **Circuit breaker**: if a server's ``connect()`` failed previously
        and less than ``_MCP_CIRCUIT_BREAKER_COOLDOWN`` seconds have passed,
        we skip the retry entirely and emit an ``mcp:error`` event with a
        clear message.  The breaker resets when:
        (a) the cooldown expires,
        (b) the server config changes (new ``config_hash``), or
        (c) the user re-enables the server via the UI.
        """
        if not servers_config:
            return []

        session_slots = self._sessions.setdefault(session_id, {})
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
                        await self._safe_emit(emit_fn, "mcp:disconnected", {"serverId": server_id})
                continue

            new_hash = _config_hash(cfg)
            existing = session_slots.get(server_id)

            if existing and existing.config_hash == new_hash:
                # ── Circuit breaker check ──────────────────────────────
                if existing.broken_since is not None:
                    elapsed = time.monotonic() - existing.broken_since
                    if elapsed < _MCP_CIRCUIT_BREAKER_COOLDOWN:
                        # Still in cooldown — skip retry.
                        remaining = int(_MCP_CIRCUIT_BREAKER_COOLDOWN - elapsed)
                        logger.warning(
                            "MCP: skipping '%s' — circuit breaker active (%ds remaining)",
                            server_id, remaining,
                        )
                        if emit_fn:
                            await self._safe_emit(emit_fn, "mcp:error", {
                                "serverId": server_id,
                                "error": (
                                    f"Servidor aún no disponible "
                                    f"(reintentando en {remaining}s). "
                                    f"Edita la configuración para reintentar ahora."
                                ),
                            })
                        continue
                    else:
                        # Cooldown expired — reset breaker and retry.
                        logger.info("MCP: circuit breaker reset for '%s'", server_id)
                        existing.broken_since = None
                        # Fall through to reconnect below — need to drop the
                        # stale slot and reconnect, since the old client is
                        # still broken.
                        await self._disconnect_slot(existing, server_id)
                        existing = None  # force reconnect

                else:
                    # Config unchanged — reuse live connection.
                    logger.debug("MCP: reusing connection for '%s' (session %s)", server_id, session_id)
                    langchain_tools.extend(existing.langchain_tools)
                    continue

            # Config changed or first connection — disconnect old, connect new.
            if existing:
                await self._disconnect_slot(existing, server_id)

            client = RealMCPClient(cfg)
            try:
                tool_defs = await client.connect()
            except Exception as e:
                logger.error("MCP: failed to connect '%s': %s", server_id, e)

                # ── Record the failure timestamp (circuit breaker) ────
                # Create a broken slot so we remember the failure for next turn.
                broken_slot = _ServerSlot(client, new_hash, [], [])
                broken_slot.broken_since = time.monotonic()
                session_slots[server_id] = broken_slot

                if emit_fn:
                    await self._safe_emit(emit_fn, "mcp:error", {"serverId": server_id, "error": str(e)})
                continue

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
                await self._safe_emit(emit_fn, "mcp:connected", {
                    "serverId": server_id,
                    "toolCount": len(tool_defs),
                })
                if tool_defs:
                    await self._safe_emit(emit_fn, "mcp:tool_discovered", {
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
                await self._safe_emit(emit_fn, "mcp:disconnected", {"serverId": server_id})

        if langchain_tools:
            logger.info(
                "MCP: %d tools from %d servers (session %s)",
                len(langchain_tools), len(active_ids), session_id,
            )

        return langchain_tools

    async def disconnect_session(self, session_id: str) -> None:
        """Disconnect all MCP clients for a session."""
        session_slots = self._sessions.pop(session_id, {})
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
    async def _safe_emit(emit_fn: Callable, event: str, data: dict) -> None:
        """Emit an event, supporting both sync and async callbacks."""
        try:
            result = emit_fn(event, data)
            if result is not None:
                # If it's a coroutine (async callback), await it.
                import asyncio
                if asyncio.iscoroutine(result):
                    await result
        except Exception as e:
            logger.debug("MCP: failed to emit '%s': %s", event, e)


# Module-level singleton — one manager per sidecar process.
mcp_manager = MCPConnectionManager()