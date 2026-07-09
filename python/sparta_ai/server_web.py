import asyncio
import fcntl
import json
import logging
import os
import platform
import pty
import signal
import struct
import termios
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

# Secret token shared between the sidecar and the frontend. Must be set before
# accepting any terminal WebSocket connection. In Electron the main process
# generates it and injects it into both the Python sidecar (env var) and the
# renderer (contextBridge). In web mode it is provided by whoever starts the
# sidecar and must reach the browser via build-time env or host injection.
SPARTA_WS_TOKEN = os.environ.get("SPARTA_WS_TOKEN")

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
        # Non-browser clients (curl, websocat, scripts) can bypass origin checks
        # trivially, so we never trust a missing Origin header.
        return False
    return origin in ALLOWED_ORIGINS


def _check_ws_token(websocket: WebSocket) -> bool:
    """Validate the shared token sent via custom header."""
    if not SPARTA_WS_TOKEN:
        return False
    return websocket.headers.get("x-sparta-token") == SPARTA_WS_TOKEN


async def _require_auth_frame(websocket: WebSocket) -> bool:
    """Wait for a valid auth frame as the first client message.

    Browsers cannot send custom headers on WebSocket connections, so the token
    is delivered as the first message: ``{"type": "auth", "token": "..."}``.
    """
    if not SPARTA_WS_TOKEN:
        return False
    try:
        data = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
        msg = json.loads(data)
        return msg.get("type") == "auth" and msg.get("token") == SPARTA_WS_TOKEN
    except (asyncio.TimeoutError, json.JSONDecodeError, Exception):
        return False

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
            elif method == "mcp.test":
                config = params.get("config", {})
                server_id = config.get("id", config.get("name", "unknown"))
                timeout = int(config.get("timeout", 10))
                from sparta_ai.tools.mcp_client import RealMCPClient
                client = RealMCPClient({**config, "timeout": min(timeout, 15)})
                try:
                    tools = await client.connect()
                    await websocket.send_text(json.dumps({
                        "type": "mcp.test.result",
                        "ok": True,
                        "serverId": server_id,
                        "toolCount": len(tools),
                        "tools": [{"name": t["name"], "description": t.get("description", "")} for t in tools],
                    }))
                except Exception as e:
                    await websocket.send_text(json.dumps({
                        "type": "mcp.test.result",
                        "ok": False,
                        "serverId": server_id,
                        "error": str(e),
                    }))
                finally:
                    await client.disconnect()
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
    workspace_root = params.get("workspace_root") or params.get("workspaceRoot") or os.environ.get("SPARTA_WORKSPACE_ROOT")
    if workspace_root:
        os.environ["SPARTA_WORKSPACE_ROOT"] = str(workspace_root)

    if not provider_key and not (is_local or vendor in {"ollama", "lmstudio", "llamacpp", "custom"}):
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
            api_url=api_url,
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
    api_url: str | None,
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
        api_url=api_url,
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

    from sparta_ai.tools.mcp_client import build_mcp_tools

    async def _mcp_emit_ws(event: str, data: dict) -> None:
        try:
            await ws.send_text(json.dumps({"type": event, **data}))
        except Exception:
            pass

    mcp_tools = await build_mcp_tools(mcp_servers, emit_fn=_mcp_emit_ws)

    from sparta_ai.tools.memory_tools import read_memory_tool, write_memory_tool
    from sparta_ai.tools.file_tools import (
        read_file_tool, write_file_tool,
        search_files_tool, patch_file_tool, delete_file_tool,
    )
    from sparta_ai.tools.skill_tools import skill_view_tool, skills_list_tool, skill_manage_tool
    from sparta_ai.tools.terminal_tools import terminal_execute_tool, terminal_execute_background_tool
    from sparta_ai.tools.mcp_manage_tool import mcp_manage_tool

    agent_tools = [
        read_memory_tool, write_memory_tool,
        read_file_tool, write_file_tool, search_files_tool, patch_file_tool, delete_file_tool,
        skill_view_tool, skills_list_tool, skill_manage_tool,
        terminal_execute_tool, terminal_execute_background_tool,
        mcp_manage_tool,
    ] + mcp_tools
    if web_search_enabled:
        from sparta_ai.tools.web_search import web_search_tool
        from sparta_ai.tools.web_fetch import web_fetch_tool
        agent_tools.insert(0, web_search_tool)
        agent_tools.insert(1, web_fetch_tool)

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
        "suggestions": [],
    }

    await stream_agent_to_websocket(
        graph, initial_state, ws, request_id, session_id, message_id,
        thread_id=session_id or request_id,
    )


@app.get("/api/skills/index")
async def get_skills_index():
    from sparta_ai.skills.skill_loader import skills_index
    return {"skills": skills_index()}


@app.post("/api/memory/index")
async def memory_index(request: Request):
    from sparta_ai.memory.chroma_store import index_entry
    body = await request.json()
    entry = body.get("entry", {})
    try:
        entry_id = index_entry(entry)
        return {"ok": bool(entry_id), "id": entry_id}
    except Exception as e:
        logger.error("memory.index failed: %s", e)
        return {"ok": False, "error": str(e)}


@app.post("/api/memory/search")
async def memory_search(request: Request):
    from sparta_ai.memory.chroma_store import semantic_search
    body = await request.json()
    query = body.get("query", "")
    k = int(body.get("k", 5))
    try:
        results = semantic_search(query, k=k)
        return {"ok": True, "results": results}
    except Exception as e:
        logger.error("memory.search failed: %s", e)
        return {"ok": False, "error": str(e)}


@app.post("/api/memory/embed")
async def memory_embed(request: Request):
    from sparta_ai.memory.embeddings import embed_text, embed_texts
    body = await request.json()
    texts = body.get("texts", [])
    single = body.get("text")
    try:
        if single is not None:
            return {"ok": True, "embedding": embed_text(single)}
        if isinstance(texts, list) and texts:
            return {"ok": True, "embeddings": embed_texts(texts)}
        return {"ok": False, "error": "text or texts required"}
    except Exception as e:
        logger.error("memory.embed failed: %s", e)
        return {"ok": False, "error": str(e)}


@app.post("/api/memory/delete")
async def memory_delete(request: Request):
    from sparta_ai.memory.chroma_store import delete_entry
    body = await request.json()
    entry_id = body.get("entry_id", "")
    try:
        delete_entry(entry_id)
        return {"ok": True}
    except Exception as e:
        logger.error("memory.delete failed: %s", e)
        return {"ok": False, "error": str(e)}


@app.get("/api/memory/count")
async def memory_count():
    from sparta_ai.memory.chroma_store import count_entries
    try:
        return {"ok": True, "count": count_entries()}
    except Exception as e:
        logger.error("memory.count failed: %s", e)
        return {"ok": False, "error": str(e)}


@app.get("/health")
async def health():
    return {"status": "ok", "mode": "web"}


_terminal_procs: dict[str, tuple[asyncio.subprocess.Process, set[asyncio.Task]]] = {}
_terminal_fds: dict[str, int] = {}


def _set_pty_size(fd: int, cols: int, rows: int) -> None:
    """Set the terminal size on a PTY master fd."""
    try:
        winsize = struct.pack("HHHH", rows, cols, 0, 0)
        fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
    except (OSError, TypeError):
        pass


def _detect_shell() -> str:
    if platform.system() == "Windows":
        return os.environ.get("COMSPEC", "cmd.exe")
    return os.environ.get("SHELL", "/bin/bash")


@app.websocket("/ws/terminal/{session_id}")
async def terminal_endpoint(websocket: WebSocket, session_id: str) -> None:
    # Reject unknown origins before accepting the socket.
    if not _check_origin(websocket):
        await websocket.close(code=4403)
        return

    await websocket.accept()

    # Token auth: header (server/non-browser clients) or first-message auth
    # frame (browsers, which cannot set custom WebSocket headers).
    if not _check_ws_token(websocket) and not await _require_auth_frame(websocket):
        await websocket.close(code=4403)
        return

    # Handshake complete — tell the client it can start sending terminal input.
    await websocket.send_text(json.dumps({"type": "ready"}))

    shell = _detect_shell()
    use_pty = platform.system() != "Windows"

    if use_pty:
        # Create a real PTY for job control, interactive programs, etc.
        master_fd, slave_fd = os.openpty()
        _set_pty_size(master_fd, 80, 24)
        process = await asyncio.create_subprocess_exec(
            shell,
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            env={**os.environ, "SPARTA_TERMINAL": "1", "TERM": "xterm-256color"},
            close_fds=True,
            start_new_session=True,
        )
        # Close slave fd in parent — shell owns it
        os.close(slave_fd)
        _terminal_fds[session_id] = master_fd
    else:
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
            if use_pty and session_id in _terminal_fds:
                master_fd = _terminal_fds[session_id]
                loop = asyncio.get_event_loop()
                while process.returncode is None:
                    chunk = await loop.run_in_executor(None, os.read, master_fd, 4096)
                    if not chunk:
                        break
                    await websocket.send_text(json.dumps({
                        "type": "output",
                        "data": chunk.decode("utf-8", errors="replace"),
                    }))
            else:
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

    _line_buffer = ""

    async def read_ws() -> None:
        nonlocal _line_buffer
        try:
            while True:
                data = await websocket.receive_text()
                msg = json.loads(data)
                t = msg.get("type")
                if t == "input":
                    if not terminal_rate_limiter.check(session_id):
                        await websocket.send_text(json.dumps({
                            "type": "output",
                            "data": "\r\n[rate limit excedido]\r\n",
                        }))
                        continue
                    if use_pty and session_id in _terminal_fds:
                        # PTY: write raw bytes directly (preserves escape sequences)
                        master_fd = _terminal_fds[session_id]
                        raw = msg["data"].encode("utf-8")
                        os.write(master_fd, raw)
                    elif process.stdin:
                        # Pipe: sanitize complete lines
                        _line_buffer += msg["data"]
                        while "\n" in _line_buffer or "\r" in _line_buffer:
                            line, _, _line_buffer = _line_buffer.partition("\n")
                            line = line.rstrip("\r")
                            sanitized = _sanitizer.sanitize(line)
                            if sanitized is None:
                                await websocket.send_text(json.dumps({
                                    "type": "output",
                                    "data": "\r\n[bloqueado por el sanitizador de seguridad]\r\n",
                                }))
                                continue
                            process.stdin.write((sanitized + "\n").encode("utf-8"))
                        await process.stdin.drain()
                elif t == "resize":
                    if use_pty and session_id in _terminal_fds:
                        cols = msg.get("cols", 80)
                        rows = msg.get("rows", 24)
                        _set_pty_size(_terminal_fds[session_id], cols, rows)
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
        if session_id in _terminal_fds:
            try:
                os.close(_terminal_fds.pop(session_id))
            except OSError:
                pass
        exit_code = process.returncode or 0
        try:
            await websocket.send_text(json.dumps({"type": "exit", "code": exit_code}))
        except Exception:
            pass


def start_web_server(host: str = "127.0.0.1", port: int = 8765):
    if not SPARTA_WS_TOKEN:
        logger.warning(
            "SPARTA_WS_TOKEN is not set; the terminal WebSocket endpoint will reject "
            "all connections. Set the environment variable before starting the server."
        )
    uvicorn.run(app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    start_web_server()
