import logging
from typing import Any

logger = logging.getLogger("sparta_ai.tools.mcp")


class MCPToolWrapper:
    def __init__(self, name: str, description: str, input_schema: dict, server_id: str):
        self.name = name
        self.description = description
        self.input_schema = input_schema
        self.server_id = server_id

    def invoke(self, input_data: dict) -> str:
        return f"[MCP:{self.server_id}] Tool '{self.name}' ejecutada con: {input_data}"

    async def ainvoke(self, input_data: dict) -> str:
        return self.invoke(input_data)


def build_mcp_tools(mcp_servers: list[dict]) -> list[MCPToolWrapper]:
    tools = []
    for server in mcp_servers or []:
        server_id = server.get("id", server.get("serverId", "unknown"))
        server_name = server.get("name", server_id)
        server_tools = server.get("tools", [])

        for tool_def in server_tools:
            tool_name = tool_def.get("name", "unnamed_tool")
            wrapper = MCPToolWrapper(
                name=tool_name,
                description=tool_def.get("description", f"Tool from MCP server: {server_name}"),
                input_schema=tool_def.get("inputSchema", {}),
                server_id=server_id,
            )
            tools.append(wrapper)

    if tools:
        logger.info("Loaded %d MCP tools from %d servers", len(tools), len(mcp_servers))
    return tools
