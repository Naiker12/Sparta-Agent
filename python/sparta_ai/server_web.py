import asyncio
import json
import logging

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from sparta_ai.agents.sparta_agent import build_sparta_graph, SpartaState
from sparta_ai.streaming.event_bridge import stream_agent_to_websocket

logger = logging.getLogger("sparta_ai.server_web")

app = FastAPI(title="Sparta AI Sidecar", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

connections: dict[str, WebSocket] = {}
_active_streams: dict[str, asyncio.Task] = {}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
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
            elif method == "ping":
                await websocket.send_text(json.dumps({"event": "pong"}))

    except WebSocketDisconnect:
        connections.pop(connection_id, None)


async def handle_chat_stream(ws: WebSocket, params: dict):
    messages = params.get("messages", [])
    model = params.get("model", "claude-sonnet-4-6")
    provider = params.get("provider", "anthropic")
    vendor = params.get("vendor", "anthropic")
    provider_key = params.get("provider_key")
    mode = params.get("mode", "chat")
    skills = params.get("skills", [])
    mcp_servers = params.get("mcp_servers", [])
    semantic_memory = params.get("semantic_memory", False)
    reasoning = params.get("reasoning", {"enabled": False, "budget": 8000})
    session_id = params.get("sessionId") or params.get("session_id", "")
    message_id = params.get("messageId") or params.get("message_id", "")

    if not provider_key:
        await ws.send_text(json.dumps({
            "type": "stream:error",
            "error": "No provider key provided",
            "sessionId": session_id,
            "messageId": message_id,
        }))
        return

    request_id = f"ws_{session_id or id(ws)}_{asyncio.get_running_loop().time()}"

    task = asyncio.create_task(
        _execute_agent_ws(
            ws=ws,
            request_id=request_id,
            session_id=session_id,
            message_id=message_id,
            messages=messages,
            model=model,
            provider=provider,
            vendor=vendor,
            provider_key=provider_key,
            mode=mode,
            skills=skills,
            mcp_servers=mcp_servers,
            semantic_memory=semantic_memory,
            reasoning=reasoning,
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
    session_id = params.get("session_id", "")
    for request_id, task in list(_active_streams.items()):
        if session_id and session_id in request_id:
            task.cancel()
            logger.info("Aborted stream for session %s", session_id)


async def _execute_agent_ws(
    ws: WebSocket,
    request_id: str,
    session_id: str,
    message_id: str,
    messages: list,
    model: str,
    provider: str,
    vendor: str,
    provider_key: str | None,
    mode: str,
    skills: list[str],
    mcp_servers: list,
    semantic_memory: bool,
    reasoning: dict,
) -> None:
    from sparta_ai.skills.skill_loader import build_skills_context
    from sparta_ai.memory.chroma_store import build_memory_context
    from sparta_ai.config.providers import build_llm

    llm = build_llm(
        model=model,
        provider=provider,
        vendor=vendor,
        api_key=provider_key,
        reasoning_enabled=reasoning.get("enabled", False),
        reasoning_budget=reasoning.get("budget", 8000),
    )

    skill_context = build_skills_context(skills) if skills else ""
    memory_context = ""
    if semantic_memory and session_id:
        memory_context = await build_memory_context(messages[-1].get("content", "") if messages else "")

    from sparta_ai.tools.mcp_bridge import build_mcp_tools
    mcp_tools = build_mcp_tools(mcp_servers)

    from sparta_ai.tools.web_search import web_search_tool
    from sparta_ai.tools.memory_tools import read_memory_tool, write_memory_tool
    from sparta_ai.tools.file_tools import read_file_tool, write_file_tool

    agent_tools = [web_search_tool, read_memory_tool, write_memory_tool, read_file_tool, write_file_tool] + mcp_tools

    graph = build_sparta_graph(
        llm=llm,
        tools=agent_tools,
        skill_context=skill_context,
        memory_context=memory_context,
    )

    initial_state: SpartaState = {
        "messages": messages,
        "session_id": session_id,
        "mode": mode,
        "active_skills": skills,
        "memory_context": memory_context,
        "thinking_tokens": 0,
        "tool_calls_this_turn": 0,
        "subagent_results": [],
        "pending_human_input": None,
        "abort_requested": False,
    }

    await stream_agent_to_websocket(graph, initial_state, ws, request_id, session_id, message_id)


@app.get("/health")
async def health():
    return {"status": "ok", "mode": "web"}


def start_web_server(host: str = "0.0.0.0", port: int = 8765):
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    start_web_server()
