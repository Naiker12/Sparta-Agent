import asyncio
import json
import logging
import os
import platform
import struct

if platform.system() != "Windows":
    import fcntl
    import termios

from fastapi import FastAPI, WebSocket
from sparta_security.command_sanitizer import CommandSanitizer
from sparta_security.rate_limiter import terminal_rate_limiter

logger = logging.getLogger("sparta_ai.server_web")
_sanitizer = CommandSanitizer()

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


def register_terminal_ws(app: FastAPI, *, check_origin, check_ws_token, require_auth_frame):
    @app.websocket("/ws/terminal/{session_id}")
    async def terminal_endpoint(websocket: WebSocket, session_id: str) -> None:
        if not check_origin(websocket):
            await websocket.close(code=4403)
            return

        await websocket.accept()

        if not check_ws_token(websocket) and not await require_auth_frame(websocket):
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
