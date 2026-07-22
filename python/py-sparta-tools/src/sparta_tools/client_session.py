from __future__ import annotations

import logging
from typing import Any

logger = logging.getLogger("sparta_ai.tools.mcp_client")


def _apply_tool_filter(
    tools: list[dict],
    include: list[str],
    exclude: list[str],
) -> list[dict]:
    if include:
        return [t for t in tools if t["name"] in include]
    if exclude:
        return [t for t in tools if t["name"] not in exclude]
    return tools


async def init_session(read_stream: Any, write_stream: Any):
    try:
        from mcp import ClientSession
    except ImportError:
        raise RuntimeError(
            "El paquete 'mcp' no está instalado. "
            "Ejecuta: pip install mcp>=1.0"
        )

    session = ClientSession(read_stream, write_stream)
    return session


async def list_server_tools(session: Any, tool_filter: dict, server_id: str) -> tuple[list[dict], list[dict]]:
    await session.initialize()

    tools_result = await session.list_tools()
    raw_tools = [
        {
            "name": t.name,
            "description": t.description or "",
            "inputSchema": t.inputSchema or {},
        }
        for t in (tools_result.tools or [])
    ]

    include = tool_filter.get("include", [])
    exclude = tool_filter.get("exclude", [])
    filtered = _apply_tool_filter(raw_tools, include, exclude)

    logger.info(
        "MCP server '%s' connected: %d tools discovered (%d after filter)",
        server_id, len(raw_tools), len(filtered),
    )
    return raw_tools, filtered
