import asyncio
import json
import logging
import os
import platform
import time

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from sparta_ai.agents.sparta_agent import build_sparta_graph, SpartaState
from sparta_ai.streaming.event_bridge import stream_agent_to_websocket
from sparta_ai.security.command_sanitizer import CommandSanitizer
from sparta_ai.security.rate_limiter import terminal_rate_limiter


logger = logging.getLogger("sparta_ai.server_web")
_sanitizer = CommandSanitizer()

# Known origins allowed to connect to WebSocket endpoints.
ALLOWED_ORIGINS = frozenset({
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
})

TERMINAL_IDLE_TIMEOUT_USER = 1800   # 30 min
TERMINAL_IDLE_TIMEOUT_BG = 3600     # 60 min

app = FastAPI(title="Sparta AI Sidecar", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(ALLOWED_ORIGINS),
    allow_methods=["*"],
    allow_headers=["*"],
)


def _check_origin(websocket: WebSocket) -> bool:
    """Reject WebSocket connections from unknown origins."""
    origin = websocket.headers.get("origin") or websocket.headers.get("sec-websocket-origin", "")
    if not origin:
        return True  # server-side connections without origin header
    return origin in ALLOWED_ORIGINS

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
            elif method == "skills:list_all":
                from sparta_ai.skills.skill_loader import skills_index
                await websocket.send_text(json.dumps({
                    "type": "skills:list_all:response",
                    "skills": skills_index(),
                }))
            elif method == "ping":
                await websocket.send_text(json.dumps({"event": "pong"}))

    except WebSocketDisconnect:
        connections.pop(connection_id, None)
        for rid, task in list(_active_streams.items()):
            if str(id(websocket)) in rid:
                task.cancel()
                logger.info("Cancelled stream %s on disconnect", rid)


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
    web_search_enabled = params.get("web_search_enabled", True)
    session_id = params.get("sessionId") or params.get("session_id", "")
    message_id = params.get("messageId") or params.get("message_id", "")
    workspace_root = params.get("workspace_root") or params.get("workspaceRoot") or os.environ.get("SPARTA_WORKSPACE_ROOT")
    if workspace_root:
        os.environ["SPARTA_WORKSPACE_ROOT"] = str(workspace_root)

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
            web_search_enabled=web_search_enabled,
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
    web_search_enabled: bool = True,
) -> None:
    from sparta_ai.skills.skill_loader import build_skills_context, skills_index
    from sparta_ai.memory.chroma_store import build_memory_context
    from sparta_ai.memory.context_manager import compress_if_needed
    from sparta_ai.config.providers import build_llm
    from sparta_ai.persistence.sqlite_store import get_checkpointer
    from sparta_ai.agents.message_cleanup import (
        copy_reasoning_content_for_api,
        drop_thinking_only_and_merge_users,
    )

    llm = build_llm(
        model=model,
        provider=provider,
        vendor=vendor,
        api_key=provider_key,
        reasoning_enabled=reasoning.get("enabled", False),
        reasoning_budget=reasoning.get("budget", 8000),
        reasoning_effort=reasoning.get("effort", "medium"),
    )

    # Clean messages for API safety: drop thinking-only turns + sanitize reasoning fields
    api_messages = drop_thinking_only_and_merge_users(messages)
    api_messages = copy_reasoning_content_for_api(api_messages, vendor or provider)
    compressed_messages = await compress_if_needed(api_messages, llm)

    # Active skills context only (full index discoverable via skills_list_tool)
    skill_context = build_skills_context(skills) if skills else ""
    memory_context = ""
    if semantic_memory and session_id:
        memory_context = await build_memory_context(messages[-1].get("content", "") if messages else "")

    from sparta_ai.tools.mcp_bridge import build_mcp_tools
    mcp_tools = build_mcp_tools(mcp_servers)

    from sparta_ai.tools.memory_tools import read_memory_tool, write_memory_tool
    from sparta_ai.tools.file_tools import read_file_tool, write_file_tool
    from sparta_ai.tools.skill_tools import skill_view_tool, skills_list_tool, skill_manage_tool
    from sparta_ai.tools.terminal_tools import terminal_execute_tool, terminal_execute_background_tool

    agent_tools = [read_memory_tool, write_memory_tool, read_file_tool, write_file_tool, skill_view_tool, skills_list_tool, skill_manage_tool, terminal_execute_tool, terminal_execute_background_tool] + mcp_tools
    if web_search_enabled:
        from sparta_ai.tools.web_search import web_search_tool
        agent_tools.insert(0, web_search_tool)

    checkpointer = await get_checkpointer()
    graph = build_sparta_graph(
        llm=llm,
        tools=agent_tools,
        skill_context=skill_context,
        memory_context=memory_context,
        checkpointer=checkpointer,
    )

    initial_state: SpartaState = {
        "messages": compressed_messages,
        "session_id": session_id,
        "mode": mode,
        "active_skills": skills,
        "memory_context": memory_context,
        "thinking_tokens": 0,
        "tool_calls_this_turn": 0,
        "subagent_results": [],
        "pending_human_input": None,
        "abort_requested": False,
        "plan": [],
        "current_step": 0,
        "plan_complete": False,
        "reflection_retries": 0,
    }

    await stream_agent_to_websocket(
        graph, initial_state, ws, request_id, session_id, message_id,
        thread_id=session_id or request_id,
    )


@app.get("/api/skills/index")
async def get_skills_index():
    from sparta_ai.skills.skill_loader import skills_index
    return {"skills": skills_index()}


@app.get("/health")
async def health():
    return {"status": "ok", "mode": "web"}


_terminal_procs: dict[str, tuple[asyncio.subprocess.Process, set[asyncio.Task]]] = {}


def _detect_shell() -> str:
    if platform.system() == "Windows":
        return os.environ.get("COMSPEC", "cmd.exe")
    return os.environ.get("SHELL", "/bin/bash")


@app.websocket("/ws/terminal/{session_id}")
async def terminal_endpoint(websocket: WebSocket, session_id: str) -> None:
    await websocket.accept()
    shell = _detect_shell()

    process = await asyncio.create_subprocess_exec(
        shell,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
        env={**os.environ, "SPARTA_TERMINAL": "1", "TERM": "xterm-256color"},
    )
    tasks: set[asyncio.Task] = set()
    _terminal_procs[session_id] = (process, tasks)

    async def read_stdout() -> None:
        try:
            while process.stdout and not process.stdout.at_eof():
                chunk = await process.stdout.read(4096)
                if not chunk:
                    break
                await websocket.send_text(json.dumps({
                    "type": "output",
                    "data": chunk.decode("utf-8", errors="replace"),
                }))
        except Exception:
            pass
        finally:
            for t in tasks:
                t.cancel()

    async def read_ws() -> None:
        try:
            while True:
                data = await websocket.receive_text()
                msg = json.loads(data)
                t = msg.get("type")
                if t == "input" and process.stdin:
                    process.stdin.write(msg["data"].encode("utf-8"))
                    await process.stdin.drain()
                elif t == "resize":
                    pass  # no PTY — resize is a no-op for pipe-based shells
        except Exception:
            pass

    t_out = asyncio.create_task(read_stdout())
    t_in = asyncio.create_task(read_ws())
    tasks.update([t_out, t_in])

    try:
        await asyncio.wait([t_out, t_in], return_when=asyncio.FIRST_COMPLETED)
    finally:
        t_out.cancel()
        t_in.cancel()
        if process.returncode is None:
            process.kill()
            await process.wait()
        _terminal_procs.pop(session_id, None)
        exit_code = process.returncode or 0
        try:
            await websocket.send_text(json.dumps({"type": "exit", "code": exit_code}))
        except Exception:
            pass


def start_web_server(host: str = "0.0.0.0", port: int = 8765):
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    start_web_server()
