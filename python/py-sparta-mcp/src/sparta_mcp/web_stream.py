import asyncio
import json
import logging
from typing import Optional

from fastapi import WebSocket

from sparta_streaming.event_bridge import stream_agent_to_websocket
from sparta_mcp.server_handlers import (
    _active_streams,
    set_session_workspace,
    run_agent_stream,
)

logger = logging.getLogger("sparta_ai.server_web")


async def handle_chat_stream(ws: WebSocket, params: dict):
    messages = params.get("messages", [])
    model = params.get("model", "claude-sonnet-4-6")
    provider = params.get("provider", "anthropic")
    vendor = params.get("vendor", "anthropic")
    provider_key = params.get("provider_key")
    api_url = params.get("api_url")
    is_local = bool(params.get("is_local", False))
    mode = params.get("mode", "chat")
    skills = params.get("skills", [])
    mcp_servers = params.get("mcp_servers", [])
    semantic_memory = params.get("semantic_memory", False)
    reasoning = params.get("reasoning", {"enabled": False, "budget": 8000})
    web_search_enabled = params.get("web_search_enabled", True)
    session_id = params.get("sessionId") or params.get("session_id", "")
    message_id = params.get("messageId") or params.get("message_id", "")
    workspace_root = params.get("workspace_root") or params.get("workspaceRoot")
    connected_folder = params.get("connected_folder") or params.get("connectedFolder")

    if workspace_root:
        set_session_workspace(session_id, str(workspace_root))
    else:
        from sparta_tools.file_tools import clear_session_workspace
        clear_session_workspace(session_id)

    from sparta_tools.permission_broker import set_current_session
    set_current_session(session_id)

    if not provider_key and not (is_local or vendor in {"ollama", "lmstudio", "llamacpp", "custom"}):
        await ws.send_text(json.dumps({
            "type": "stream:error",
            "error": "No provider key provided",
            "sessionId": session_id,
            "messageId": message_id,
        }))
        return

    request_id = f"ws_{session_id or id(ws)}_{asyncio.get_running_loop().time()}"

    async def _mcp_emit(event: str, data: dict) -> None:
        try:
            await ws.send_text(json.dumps({"type": event, **data}))
        except Exception:
            pass

    task = asyncio.create_task(
        execute_agent_ws(
            ws=ws,
            request_id=request_id,
            session_id=session_id,
            message_id=message_id,
            messages=messages,
            model=model,
            provider=provider,
            vendor=vendor,
            provider_key=provider_key,
            api_url=api_url,
            mode=mode,
            skills=skills,
            mcp_servers=mcp_servers,
            semantic_memory=semantic_memory,
            reasoning=reasoning,
            web_search_enabled=web_search_enabled,
            connected_folder=connected_folder,
            emit_fn=_mcp_emit,
        )
    )
    _active_streams[request_id] = task

    try:
        await task
    except asyncio.CancelledError:
        await ws.send_text(json.dumps({
            "type": "stream:aborted",
            "sessionId": session_id,
            "messageId": message_id,
        }))
    except Exception as e:
        logger.exception("Agent execution failed")
        await ws.send_text(json.dumps({
            "type": "stream:error",
            "error": str(e),
            "sessionId": session_id,
            "messageId": message_id,
        }))
    finally:
        _active_streams.pop(request_id, None)


async def handle_abort(params: dict):
    session_id = params.get("session_id") or params.get("sessionId", "")
    for request_id, task in list(_active_streams.items()):
        if session_id and session_id in request_id:
            task.cancel()


async def execute_agent_ws(
    ws: WebSocket,
    request_id: str,
    session_id: str,
    message_id: str,
    messages: list,
    model: str,
    provider: str,
    vendor: str,
    provider_key: Optional[str],
    api_url: Optional[str],
    mode: str,
    skills: list[str],
    mcp_servers: list,
    semantic_memory: bool,
    reasoning: dict,
    web_search_enabled: bool = True,
    connected_folder: Optional[str] = None,
    emit_fn=None,
) -> None:
    async def _stream(graph, initial_state):
        await stream_agent_to_websocket(
            graph, initial_state, ws, request_id, session_id, message_id,
            thread_id=session_id or request_id,
        )

    await run_agent_stream(
        request_id=request_id,
        session_id=session_id,
        messages=messages,
        model=model,
        provider=provider,
        vendor=vendor,
        provider_key=provider_key,
        api_url=api_url,
        mode=mode,
        skills=skills,
        mcp_servers=mcp_servers,
        semantic_memory=semantic_memory,
        reasoning=reasoning,
        web_search_enabled=web_search_enabled,
        read_only=False,
        policy_mode="build",
        connected_folder=connected_folder,
        emit_fn=emit_fn,
        stream_fn=_stream,
    )
