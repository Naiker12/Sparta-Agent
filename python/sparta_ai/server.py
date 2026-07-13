import sys
import json
import asyncio
import logging
import traceback
from typing import Any

from sparta_ai.streaming.event_bridge import stream_agent_to_electron

logger = logging.getLogger("sparta_ai.server")

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
    run_agent_task,
    set_session_workspace,
)


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
    _emit(request_id, "error", {"code": code, "message": message})


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
        # Flush MCP connections before stopping the loop.
        if self._loop and not self._loop.is_closed():
            try:
                from sparta_ai.tools.mcp_manager import mcp_manager
                self._loop.run_until_complete(mcp_manager.disconnect_all())
            except Exception:
                pass
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
        elif method == "skills:list_all":
            from sparta_ai.skills.skill_loader import skills_index
            _emit(request_id, "skills:list_all:response", {"skills": skills_index()})
        elif method == "mcp.test":
            result = await handle_mcp_test(params)
            _emit(request_id, "mcp.test.result", result)
        elif method == "permission.respond":
            from sparta_ai.tools.permission_broker import resolve_permission
            perm_id = params.get("request_id", "")
            approved = bool(params.get("approved", False))
            remember = str(params.get("remember", "once"))
            resolve_permission(perm_id, approved, remember)
        elif method == "memory.index":
            result = await handle_memory_index(params)
            _emit(request_id, "memory.index:response", result)
        elif method == "memory.search":
            result = await handle_memory_search(params)
            _emit(request_id, "memory.search:response", result)
        elif method == "memory.embed":
            result = await handle_memory_embed(params)
            _emit(request_id, "memory.embed:response", result)
        elif method == "memory.delete":
            result = await handle_memory_delete(params)
            _emit(request_id, "memory.delete:response", result)
        elif method == "memory.count":
            result = await handle_memory_count()
            _emit(request_id, "memory.count:response", result)
        elif method == "shutdown":
            _emit(request_id, "shutdown", {"ok": True})
            self._running = False
        elif method == "agent.task":
            await self._handle_agent_task(request_id, params)
        else:
            _emit_error(request_id, "unknown_method", f"Unknown method: {method}")
            _emit(request_id, "stream_end", {})

    async def _handle_chat_stream(self, request_id: str, params: dict):
        messages = params.get("messages", [])
        model = params.get("model", "claude-sonnet-4-6")
        provider = params.get("provider", "anthropic")
        vendor = params.get("vendor", "anthropic")
        provider_key = params.get("provider_key")
        api_url = params.get("api_url")
        mode = params.get("mode", "chat")
        skills = params.get("skills", [])
        mcp_servers = params.get("mcp_servers", [])
        semantic_memory = params.get("semantic_memory", False)
        reasoning = params.get("reasoning", {"enabled": False, "budget": 8000})
        web_search_enabled = params.get("web_search_enabled", True)
        session_id = params.get("session_id", "")
        workspace_root = params.get("workspace_root")
        if workspace_root:
            set_session_workspace(session_id, str(workspace_root))
            _emit(request_id, "workspace:connected", {"root": str(workspace_root)})
        else:
            _session_workspaces.pop(session_id, None)

        agent_autonomy = params.get("agent_autonomy", "ask_risky")
        agent_execute_local = params.get("agent_execute_local", True)
        security_loaded = params.get("security_loaded", True)
        sandbox_mode = params.get("sandbox_mode", "none")
        open_files = params.get("open_files", [])

        from sparta_ai.tools.terminal_tools import _set_open_files, set_execute_local, set_sandbox_mode
        _set_open_files(list(open_files))
        set_execute_local(bool(agent_execute_local))
        set_sandbox_mode(sandbox_mode)

        read_only_mode = not security_loaded or agent_autonomy == "autonomous_readonly"
        policy_mode = "plan" if (read_only_mode or agent_autonomy == "autonomous_readonly") else "build"

        async def _mcp_emit(event: str, data: dict) -> None:
            _emit(request_id, event, data)

        task = asyncio.create_task(
            self._execute_agent(
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
                read_only=read_only_mode,
                policy_mode=policy_mode,
                open_files=open_files,
                agent_autonomy=agent_autonomy,
                agent_execute_local=agent_execute_local,
                sandbox_mode=sandbox_mode,
                security_loaded=security_loaded,
                emit_fn=_mcp_emit,
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

    async def _execute_agent(
        self,
        request_id: str,
        session_id: str,
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
        web_search_enabled: bool,
        read_only: bool,
        policy_mode: str,
        open_files: list[str],
        agent_autonomy: str,
        agent_execute_local: bool,
        sandbox_mode: str,
        security_loaded: bool,
        emit_fn,
    ) -> None:
        async def _stream(graph, initial_state):
            await stream_agent_to_electron(
                graph, initial_state, request_id, thread_id=session_id or request_id,
                model=model,
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
            read_only=read_only,
            policy_mode=policy_mode,
            open_files=open_files,
            agent_autonomy=agent_autonomy,
            agent_execute_local=agent_execute_local,
            sandbox_mode=sandbox_mode,
            security_loaded=security_loaded,
            emit_fn=emit_fn,
            stream_fn=_stream,
        )

    async def _handle_agent_task(self, request_id: str | None, params: dict):
        task_id = params.get("task_id", "")
        agent_id = params.get("agent_id", "")
        task_description = params.get("task_description", "")
        system_prompt = params.get("system_prompt", "Eres un agente útil. Completa la tarea.")
        allowed_tools = params.get("allowed_tools", [])
        model = params.get("model", "claude-sonnet-4-6")
        provider = params.get("provider", "anthropic")
        vendor = params.get("vendor", "anthropic")
        provider_key = params.get("provider_key")
        api_url = params.get("api_url")
        workspace_root = params.get("workspace_root", "")
        agent_autonomy = params.get("agent_autonomy", "ask_risky")
        max_turns = int(params.get("max_turns", 10))

        def _emit_task(rid, event, data):
            _emit(rid, event, data)

        task = asyncio.create_task(
            run_agent_task(
                request_id=request_id,
                task_id=task_id,
                agent_id=agent_id,
                task_description=task_description,
                system_prompt=system_prompt,
                allowed_tools=allowed_tools,
                model=model,
                provider=provider,
                vendor=vendor,
                provider_key=provider_key,
                api_url=api_url,
                workspace_root=workspace_root,
                agent_autonomy=agent_autonomy,
                max_turns=max_turns,
                emit_fn=_emit_task,
            )
        )
        _active_streams[f"agent:{task_id}"] = task
        try:
            await task
        except asyncio.CancelledError:
            _emit(request_id, "agent:step", {"task_id": task_id, "step": "cancelled", "status": "error"})
        except Exception as e:
            logger.error("Agent task failed: %s", traceback.format_exc())
            _emit_error(request_id, "internal_error", str(e))
        finally:
            _active_streams.pop(f"agent:{task_id}", None)
