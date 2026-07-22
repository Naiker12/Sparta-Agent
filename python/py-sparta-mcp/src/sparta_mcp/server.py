import sys
import json
import asyncio
import logging
from typing import Any

logger = logging.getLogger("sparta_ai.server")


def _emit(request_id: str, event: str, data: dict | None = None):
    msg: dict[str, Any] = {"id": request_id, "event": event}
    if data is not None:
        msg["data"] = data
    try:
        sys.stdout.write(json.dumps(msg, ensure_ascii=False) + "\n")
        sys.stdout.flush()
    except (BrokenPipeError, OSError):
        sys.exit(0)


def _emit_error(request_id: str | None, code: str, message: str):
    _emit(request_id, "stream:error", {"error": message})


class StdioServer:
    def __init__(self):
        self._loop: asyncio.AbstractEventLoop | None = None
        self._running = False

    def run(self):
        self._bootstrap()
        self._running = True
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self._loop.run_until_complete(self._read_loop())

    def _bootstrap(self):
        try:
            from pathlib import Path
            from sparta_skills.system_skills_installer import install_system_skills
            bundled = Path(__file__).resolve().parent.parent.parent / "skills"
            install_system_skills(bundled)
        except Exception as e:
            logger.debug("System skills install skipped: %s", e)

    def shutdown(self):
        self._running = False
        from sparta_mcp.server_handlers import _active_streams
        for request_id, task in list(_active_streams.items()):
            task.cancel()
        if self._loop and not self._loop.is_closed():
            try:
                from sparta_tools.mcp_manager import mcp_manager
                self._loop.run_until_complete(mcp_manager.disconnect_all())
            except Exception:
                pass
            # Clear all caches on shutdown for a fresh start next time
            try:
                from sparta_config.providers import clear_all_caches
                clear_all_caches()
            except Exception:
                pass
            self._loop.stop()

    async def _read_loop(self):
        from sparta_mcp.server_dispatch import handle_message
        while self._running:
            line = await self._read_line()
            if line is None:
                break
            try:
                msg = json.loads(line)
            except json.JSONDecodeError as e:
                _emit_error(None, "parse_error", f"Invalid JSON: {e}")
                continue
            asyncio.create_task(handle_message(self, msg))

    async def _read_line(self) -> str | None:
        loop = self._loop or asyncio.get_event_loop()
        line = await loop.run_in_executor(None, sys.stdin.readline)
        if not line:
            return None
        return line.rstrip("\n\r")

    async def _handle_chat_stream(self, request_id: str, params: dict):
        from sparta_mcp.server_stream import handle_chat_stream
        await handle_chat_stream(self, request_id, params)

    async def _handle_chat_abort(self, params: dict):
        from sparta_mcp.server_stream import handle_chat_abort
        await handle_chat_abort(params)

    async def _handle_agent_task(self, request_id: str | None, params: dict):
        from sparta_mcp.server_stream import handle_agent_task
        await handle_agent_task(request_id, params, _emit, _emit_error)
