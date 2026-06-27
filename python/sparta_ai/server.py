import sys
import json
import asyncio
import logging
import traceback
from typing import Any

from sparta_ai.agents.sparta_agent import build_sparta_graph, SpartaState
from sparta_ai.streaming.event_bridge import stream_agent_to_electron

logger = logging.getLogger("sparta_ai.server")

_active_streams: dict[str, asyncio.Task] = {}


class StdioServer:
    def __init__(self):
        self._loop: asyncio.AbstractEventLoop | None = None
        self._running = False

    def run(self):
        self._running = True
        self._loop = asyncio.new_event_loop()
        asyncio.set_event_loop(self._loop)
        self._loop.run_until_complete(self._read_loop())

    def shutdown(self):
        self._running = False
        for request_id, task in list(_active_streams.items()):
            task.cancel()
        if self._loop and not self._loop.is_closed():
            self._loop.stop()

    async def _read_loop(self):
        while self._running:
            line = await self._read_line()
            if line is None:
                break
            try:
                msg = json.loads(line)
            except json.JSONDecodeError as e:
                _emit_error(None, "parse_error", f"Invalid JSON: {e}")
                continue

            asyncio.create_task(self._handle_message(msg))

    async def _read_line(self) -> str | None:
        loop = self._loop or asyncio.get_event_loop()
        line = await loop.run_in_executor(None, sys.stdin.readline)
        if not line:
            return None
        return line.rstrip("\n\r")

    async def _handle_message(self, msg: dict):
        method = msg.get("method")
        request_id = msg.get("id")
        params = msg.get("params", {})

        if method == "chat.stream":
            await self._handle_chat_stream(request_id, params)
        elif method == "chat.abort":
            await self._handle_chat_abort(params)
        elif method == "keymanager.set":
            from sparta_ai.config.security import store_key
            key_id = params.get("key_id", params.get("keyId", ""))
            value = params.get("value", "")
            vendor = params.get("vendor")
            if key_id and value:
                store_key(key_id, value, vendor)
                _emit(request_id, "keymanager.set", {"ok": True})
            else:
                _emit_error(request_id, "invalid_params", "key_id and value required")
        elif method == "keymanager.clear":
            from sparta_ai.config.security import clear_keys
            clear_keys()
            _emit(request_id, "keymanager.clear", {"ok": True})
        elif method == "shutdown":
            _emit(request_id, "shutdown", {"ok": True})
            self._running = False
        else:
            _emit_error(request_id, "unknown_method", f"Unknown method: {method}")
            _emit(request_id, "stream_end", {})

    async def _handle_chat_stream(self, request_id: str, params: dict):
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
        session_id = params.get("session_id", "")

        task = asyncio.create_task(
            self._execute_agent(
                request_id=request_id,
                session_id=session_id,
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
            _emit(request_id, "stream_end", {"cancelled": True})
        except Exception as e:
            logger.error("Agent execution failed: %s", traceback.format_exc())
            _emit_error(request_id, "internal_error", str(e))
            _emit(request_id, "stream_end", {"error": str(e)})
        finally:
            _active_streams.pop(request_id, None)

    async def _handle_chat_abort(self, params: dict):
        request_id = params.get("request_id")
        if request_id and request_id in _active_streams:
            _active_streams[request_id].cancel()
            logger.info("Aborted stream %s", request_id)

    async def _execute_agent(
        self,
        request_id: str,
        session_id: str,
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

        await stream_agent_to_electron(graph, initial_state, request_id)


def _emit(request_id: str, event: str, data: dict | None = None):
    msg: dict[str, Any] = {"id": request_id, "event": event}
    if data is not None:
        msg["data"] = data
    try:
        sys.stdout.write(json.dumps(msg, ensure_ascii=False) + "\n")
        sys.stdout.flush()
    except (BrokenPipeError, OSError):
        # Parent process closed the pipe; exit cleanly instead of crashing.
        sys.exit(0)


def _emit_error(request_id: str | None, code: str, message: str):
    _emit(request_id, "error", {"code": code, "message": message})
