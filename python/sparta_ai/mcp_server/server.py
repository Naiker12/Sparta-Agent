"""Run Sparta as an MCP server over stdio.

Exposes a curated, safe subset of Sparta's tools (read-only file ops,
memory search, diagnostics) for consumption by external MCP clients
(Claude Desktop, other agents, IDEs).

Activated via ``sparta --mcp-server`` or a toggle in Settings.
Apagado por defecto.
"""

import asyncio
import json
import logging
import os
import sys
from typing import Any

logger = logging.getLogger("sparta_ai.mcp_server")

try:
    from mcp.server import Server
    from mcp.server.stdio import stdio_server
    from mcp.types import TextContent, Tool

    _MCP_AVAILABLE = True
except ImportError:
    _MCP_AVAILABLE = False


async def run_stdio_server() -> None:
    """Start the MCP server over stdio transport."""
    if not _MCP_AVAILABLE:
        print(
            "Error: el paquete 'mcp' no está instalado. "
            "Instalalo con: pip install mcp",
            file=sys.stderr,
        )
        raise SystemExit(1)

    server = Server("sparta-agent")

    @server.list_tools()
    async def list_tools() -> list[Tool]:
        """Return the curated tool list."""
        return [
            Tool(
                name="sparta_read_file",
                description=(
                    "Lee el contenido de un archivo en el workspace de Sparta. "
                    "Args: path (str), offset (int, opcional), limit (int, opcional)."
                ),
                inputSchema={
                    "type": "object",
                    "properties": {
                        "path": {
                            "type": "string",
                            "description": "Ruta relativa al workspace",
                        },
                        "offset": {
                            "type": "integer",
                            "description": "Línea inicial (1-indexed)",
                        },
                        "limit": {
                            "type": "integer",
                            "description": "Máximo de líneas",
                        },
                    },
                    "required": ["path"],
                },
            ),
            Tool(
                name="sparta_search_files",
                description=(
                    "Busca archivos por nombre (glob) y/o contenido (grep). "
                    "Args: pattern (str), content (str, opcional), "
                    "path (str, default '.')."
                ),
                inputSchema={
                    "type": "object",
                    "properties": {
                        "pattern": {
                            "type": "string",
                            "description": "Glob de nombre, ej: '*.py'",
                        },
                        "content": {
                            "type": "string",
                            "description": "Texto a buscar dentro",
                        },
                        "path": {
                            "type": "string",
                            "description": "Subdirectorio relativo",
                        },
                    },
                    "required": ["pattern"],
                },
            ),
            Tool(
                name="sparta_memory_search",
                description=(
                    "Busca en la memoria semántica de Sparta (ChromaDB). "
                    "Args: query (str), k (int, opcional, default 5)."
                ),
                inputSchema={
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "Texto de búsqueda",
                        },
                        "k": {
                            "type": "integer",
                            "description": "Número de resultados",
                        },
                    },
                    "required": ["query"],
                },
            ),
            Tool(
                name="sparta_get_diagnostics",
                description=(
                    "Obtiene diagnósticos del workspace de Sparta "
                    "(errores, warnings). Sin argumentos."
                ),
                inputSchema={"type": "object", "properties": {}},
            ),
        ]

    @server.call_tool()
    async def call_tool(
        name: str, arguments: dict[str, Any]
    ) -> list[TextContent]:
        """Dispatch tool calls to Sparta's internal tools."""
        workspace = os.environ.get("SPARTA_WORKSPACE_ROOT", "")

        if name == "sparta_read_file":
            return await _handle_read_file(workspace, arguments)
        elif name == "sparta_search_files":
            return await _handle_search_files(workspace, arguments)
        elif name == "sparta_memory_search":
            return await _handle_memory_search(arguments)
        elif name == "sparta_get_diagnostics":
            return await _handle_diagnostics(workspace)
        else:
            return [TextContent(type="text", text=f"Unknown tool: {name}")]

    async with stdio_server() as (read_stream, write_stream):
        logger.info("sparta mcp_server: starting stdio server")
        await server.run(
            read_stream, write_stream, server.create_initialization_options()
        )


# ── Tool implementations ──────────────────────────────────────────────


async def _handle_read_file(
    workspace: str, args: dict
) -> list[TextContent]:
    try:
        from sparta_ai.tools.file_tools import read_file_tool

        result = await asyncio.to_thread(read_file_tool.invoke, args)
        return [TextContent(type="text", text=str(result))]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {e}")]


async def _handle_search_files(
    workspace: str, args: dict
) -> list[TextContent]:
    try:
        from sparta_ai.tools.file_tools import search_files_tool

        result = await asyncio.to_thread(search_files_tool.invoke, args)
        return [TextContent(type="text", text=str(result))]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {e}")]


async def _handle_memory_search(args: dict) -> list[TextContent]:
    try:
        from sparta_ai.memory.chroma_store import semantic_search

        query = args.get("query", "")
        k = int(args.get("k", 5))
        results = await asyncio.to_thread(semantic_search, query, k=k)
        return [
            TextContent(
                type="text",
                text=json.dumps(results, ensure_ascii=False, indent=2),
            )
        ]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {e}")]


async def _handle_diagnostics(workspace: str) -> list[TextContent]:
    try:
        from sparta_ai.tools.diagnostics_tool import get_diagnostics_tool

        result = await asyncio.to_thread(get_diagnostics_tool.invoke, {})
        return [TextContent(type="text", text=str(result))]
    except Exception as e:
        return [TextContent(type="text", text=f"Error: {e}")]
