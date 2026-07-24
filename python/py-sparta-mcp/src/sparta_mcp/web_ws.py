import asyncio
import json
import logging
import os
import platform
from typing import Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from sparta_security.command_sanitizer import CommandSanitizer
from sparta_security.scope_rules import (
    validate_action,
    get_denied_message,
    Decision as ScopeDecision,
)
from sparta_mcp.server_handlers import (
    _active_streams,
    handle_memory_index,
    handle_memory_search,
    handle_memory_embed,
    handle_memory_delete,
    handle_memory_count,
    handle_mcp_test,
)
from sparta_mcp.web_stream import handle_chat_stream, handle_abort

logger = logging.getLogger("sparta_ai.server_web")
_sanitizer = CommandSanitizer()


async def _send_ws(websocket, data):
    await websocket.send_text(json.dumps(data))


async def _scope_check_ws(websocket, method, params=None):
    payload = params if params else None
    decision = validate_action(method, payload)
    if decision == ScopeDecision.DENY:
        await _send_ws(websocket, {"type": "stream:error", "error": get_denied_message(method)})
        return False
    return True


def register_ws(app: FastAPI, *, check_origin, check_ws_token, require_auth_frame, connections):
    @app.websocket("/ws")
    async def websocket_endpoint(websocket: WebSocket):
        if not check_origin(websocket):
            await websocket.close(code=4403)
            return

        await websocket.accept()

        if not check_ws_token(websocket) and not await require_auth_frame(websocket):
            await websocket.close(code=4403)
            return

        connection_id = str(id(websocket))
        connections[connection_id] = websocket

        try:
            while True:
                data = await websocket.receive_text()
                message = json.loads(data)
                method = message.get("method")
                params = message.get("params", {})

                if method == "chat.stream":
                    await handle_chat_stream(websocket, params)
                elif method == "chat.abort":
                    await handle_abort(params)
                elif method == "skills:list_all":
                    from sparta_skills.skill_loader import skills_index
                    await _send_ws(websocket, {
                        "type": "skills:list_all:response",
                        "skills": skills_index(),
                    })
                elif method == "mcp.test":
                    result = await handle_mcp_test(params)
                    await _send_ws(websocket, {"type": "mcp.test.result", **result})
                elif method == "memory.index":
                    result = await handle_memory_index(params)
                    await _send_ws(websocket, {"type": "memory.index:response", **result})
                elif method == "memory.search":
                    result = await handle_memory_search(params)
                    await _send_ws(websocket, {"type": "memory.search:response", **result})
                elif method == "memory.embed":
                    result = await handle_memory_embed(params)
                    await _send_ws(websocket, {"type": "memory.embed:response", **result})
                elif method == "memory.delete":
                    result = await handle_memory_delete(params)
                    await _send_ws(websocket, {"type": "memory.delete:response", **result})
                elif method == "memory.count":
                    result = await handle_memory_count()
                    await _send_ws(websocket, {"type": "memory.count:response", **result})
                elif method == "skill.list":
                    from sparta_skills.skill_loader import skills_index
                    await _send_ws(websocket, {
                        "type": "skill.list:response",
                        "skills": skills_index(),
                    })
                elif method == "skill.view":
                    from sparta_skills.skill_loader import skill_view as _skill_view
                    result = _skill_view(params.get("skill_id", ""))
                    await _send_ws(websocket, {"type": "skill.view:response", **result})
                elif method == "skill.add":
                    if not await _scope_check_ws(websocket, method, {"source": params.get("source", "external")}):
                        return
                    await _send_ws(websocket, {"type": "skill.add:response", "ok": True})
                elif method == "skill.enable":
                    if not await _scope_check_ws(websocket, method):
                        return
                    await _send_ws(websocket, {"type": "skill.enable:response", "ok": True, "skill_id": params.get("skill_id", "")})
                elif method == "skill.disable":
                    if not await _scope_check_ws(websocket, method):
                        return
                    await _send_ws(websocket, {"type": "skill.disable:response", "ok": True, "skill_id": params.get("skill_id", "")})
                elif method == "mcp.list":
                    from sparta_tools.mcp_manage_tool import _load_configured as _load_mcp_servers
                    configured = _load_mcp_servers()
                    await _send_ws(websocket, {"type": "mcp.list:response", "servers": configured})
                elif method == "mcp.add":
                    if not await _scope_check_ws(websocket, method):
                        return
                    from sparta_tools.mcp_manage_tool import _load_catalog, _load_configured, _save_configured, _emit_mcp_event
                    server_id = params.get("server_id", "")
                    catalog = _load_catalog()
                    if server_id not in catalog:
                        await _send_ws(websocket, {"type": "stream:error", "error": f"'{server_id}' no está en el catálogo curado."})
                        return
                    entry = catalog[server_id]
                    config = {"type": entry.get("type", "stdio"), "enabled": True}
                    if entry.get("type") == "stdio":
                        config["command"] = entry["command"]
                        config["args"] = entry.get("args", [])
                    elif entry.get("type") == "http":
                        config["url"] = entry["url"]
                    configured = _load_configured()
                    configured[server_id] = config
                    _save_configured(configured)
                    _emit_mcp_event("mcp:server_added", {"serverId": server_id, "config": config})
                    await _send_ws(websocket, {"type": "mcp.add:response", "ok": True, "server_id": server_id})
                elif method == "provider.list":
                    await _send_ws(websocket, {"type": "provider.list:response", "providers": []})
                elif method == "provider.add":
                    if not await _scope_check_ws(websocket, method):
                        return
                    await _send_ws(websocket, {"type": "provider.add:response", "ok": True})
                elif method == "provider.enable":
                    if not await _scope_check_ws(websocket, method):
                        return
                    await _send_ws(websocket, {"type": "provider.enable:response", "ok": True})
                elif method == "provider.disable":
                    if not await _scope_check_ws(websocket, method, {"provider_id": params.get("provider_id", "")}):
                        return
                    await _send_ws(websocket, {"type": "provider.disable:response", "ok": True})
                elif method == "provider.set_api_key":
                    if not await _scope_check_ws(websocket, method):
                        return
                    provider_id = params.get("provider_id", "")
                    key_value = params.get("api_key", "")
                    if key_value:
                        from sparta_config.security import store_key
                        store_key(f"provider:{provider_id}:api_key", key_value, vendor=provider_id)
                        logger.info("API key stored for provider: %s", provider_id)
                        await _send_ws(websocket, {"type": "provider.set_api_key:response", "ok": True, "provider_id": provider_id})
                    else:
                        await _send_ws(websocket, {"type": "stream:error", "error": "api_key is required"})
                elif method == "ping":
                    await _send_ws(websocket, {"event": "pong"})

        except WebSocketDisconnect:
            connections.pop(connection_id, None)
            for rid, task in list(_active_streams.items()):
                if str(id(websocket)) in rid:
                    task.cancel()
