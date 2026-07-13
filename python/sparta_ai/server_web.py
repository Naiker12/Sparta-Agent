import asyncio
import json
import logging
import os
import platform
import struct
from typing import Optional

if platform.system() != "Windows":
    import fcntl
    import termios

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import tempfile
import uvicorn

from sparta_ai.streaming.event_bridge import stream_agent_to_websocket
from sparta_ai.security.command_sanitizer import CommandSanitizer
from sparta_ai.security.rate_limiter import terminal_rate_limiter

from sparta_ai.server_handlers import (
    _active_streams,
    _session_workspaces,
    handle_memory_index,
    handle_memory_search,
    handle_memory_embed,
    handle_memory_delete,
    handle_memory_count,
    handle_mcp_test,
    run_agent_stream,
)

logger = logging.getLogger("sparta_ai.server_web")
_sanitizer = CommandSanitizer()

ALLOWED_ORIGINS = frozenset({
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
})

SPARTA_WS_TOKEN = os.environ.get("SPARTA_WS_TOKEN")

TERMINAL_IDLE_TIMEOUT_USER = 1800
TERMINAL_IDLE_TIMEOUT_BG = 3600

app = FastAPI(title="Sparta AI Sidecar", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(ALLOWED_ORIGINS),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def _shutdown_mcp():
    from sparta_ai.tools.mcp_manager import mcp_manager
    await mcp_manager.disconnect_all()


def _check_origin(websocket: WebSocket) -> bool:
    origin = websocket.headers.get("origin") or websocket.headers.get("sec-websocket-origin", "")
    if not origin:
        return False
    return origin in ALLOWED_ORIGINS


def _check_ws_token(websocket: WebSocket) -> bool:
    if not SPARTA_WS_TOKEN:
        return False
    return websocket.headers.get("x-sparta-token") == SPARTA_WS_TOKEN


async def _require_auth_frame(websocket: WebSocket) -> bool:
    if not SPARTA_WS_TOKEN:
        return False
    try:
        data = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
        msg = json.loads(data)
        return msg.get("type") == "auth" and msg.get("token") == SPARTA_WS_TOKEN
    except (asyncio.TimeoutError, json.JSONDecodeError, Exception):
        return False


connections: dict[str, WebSocket] = {}


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
                result = await handle_mcp_test(params)
                await websocket.send_text(json.dumps({"type": "mcp.test.result", **result}))
            elif method == "memory.index":
                result = await handle_memory_index(params)
                await websocket.send_text(json.dumps({"type": "memory.index:response", **result}))
            elif method == "memory.search":
                result = await handle_memory_search(params)
                await websocket.send_text(json.dumps({"type": "memory.search:response", **result}))
            elif method == "memory.embed":
                result = await handle_memory_embed(params)
                await websocket.send_text(json.dumps({"type": "memory.embed:response", **result}))
            elif method == "memory.delete":
                result = await handle_memory_delete(params)
                await websocket.send_text(json.dumps({"type": "memory.delete:response", **result}))
            elif method == "memory.count":
                result = await handle_memory_count()
                await websocket.send_text(json.dumps({"type": "memory.count:response", **result}))
            elif method == "ping":
                await websocket.send_text(json.dumps({"event": "pong"}))

    except WebSocketDisconnect:
        connections.pop(connection_id, None)
        for rid, task in list(_active_streams.items()):
            if str(id(websocket)) in rid:
                task.cancel()


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

    if workspace_root:
        from sparta_ai.server_handlers import set_session_workspace
        set_session_workspace(session_id, str(workspace_root))
    else:
        from sparta_ai.tools.file_tools import clear_session_workspace
        clear_session_workspace(session_id)

    from sparta_ai.tools.permission_broker import set_current_session
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


async def _execute_agent_ws(
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
        emit_fn=emit_fn,
        stream_fn=_stream,
    )


# ── REST endpoints ───────────────────────────────────────────────────────


@app.get("/api/skills/index")
async def get_skills_index():
    from sparta_ai.skills.skill_loader import skills_index
    return {"skills": skills_index()}


@app.post("/api/memory/index")
async def memory_index(request: Request):
    body = await request.json()
    return await handle_memory_index(body)


@app.post("/api/memory/search")
async def memory_search(request: Request):
    body = await request.json()
    return await handle_memory_search(body)


@app.post("/api/memory/embed")
async def memory_embed(request: Request):
    body = await request.json()
    return await handle_memory_embed(body)


@app.post("/api/memory/delete")
async def memory_delete(request: Request):
    body = await request.json()
    return await handle_memory_delete(body)


@app.get("/api/memory/count")
async def memory_count():
    return await handle_memory_count()


@app.get("/health")
async def health():
    return {"status": "ok", "mode": "web"}


@app.post("/api/audio/transcribe")
async def transcribe_audio(file: UploadFile = File(...)):
    """Transcribe an audio file using local Whisper (faster-whisper).

    Returns { "text": "..." } on success, or 503 if the audio extra is not installed.
    """
    try:
        from sparta_ai.audio.transcriber import transcribe
    except ImportError:
        return JSONResponse(
            status_code=503,
            content={"error": "Transcripción no disponible. Instala el extra de audio: pip install -e '.[audio]'"},
        )
    suffix = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
    tmp_path = ""
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(await file.read())
            tmp_path = tmp.name
        text = transcribe(tmp_path)
        return {"text": text}
    except Exception as e:
        logger.exception("Audio transcription failed")
        return JSONResponse(status_code=500, content={"error": str(e)})
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)


# ── Terminal WebSocket ───────────────────────────────────────────────────

_terminal_procs: dict[str, tuple[asyncio.subprocess.Process, set[asyncio.Task]]] = {}
_terminal_fds: dict[str, int] = {}


def _set_pty_size(fd: int, cols: int, rows: int) -> None:
    if platform.system() == "Windows":
        return
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
    if not _check_origin(websocket):
        await websocket.close(code=4403)
        return

    await websocket.accept()

    if not _check_ws_token(websocket) and not await _require_auth_frame(websocket):
        await websocket.close(code=4403)
        return

    await websocket.send_text(json.dumps({"type": "ready"}))

    shell = _detect_shell()
    use_pty = platform.system() != "Windows"

    if use_pty:
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
                        master_fd = _terminal_fds[session_id]
                        raw = msg["data"].encode("utf-8")
                        os.write(master_fd, raw)
                    elif process.stdin:
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
