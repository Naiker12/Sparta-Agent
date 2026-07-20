"""MCP test handler — verifies MCP server connectivity."""


async def handle_mcp_test(params: dict) -> dict:
    config = params.get("config", {})
    server_id = config.get("id", config.get("name", "unknown"))
    timeout = int(config.get("timeout", 10))
    from sparta_ai.tools.mcp_client import RealMCPClient
    client = RealMCPClient({**config, "timeout": min(timeout, 15)})
    try:
        tools = await client.connect()
        return {
            "ok": True,
            "serverId": server_id,
            "toolCount": len(tools),
            "tools": [
                {"name": t["name"], "description": t.get("description", ""), "inputSchema": t.get("inputSchema", {})}
                for t in tools
            ],
        }
    except Exception as e:
        return {"ok": False, "serverId": server_id, "error": str(e)}
    finally:
        await client.disconnect()
