import os
import sys
import json
import asyncio
import logging
import traceback
from typing import Any

from sparta_ai.agents.sparta_agent import build_sparta_graph, SpartaState
from sparta_ai.streaming.event_bridge import stream_agent_to_electron
from sparta_ai.providers.retry_policy import retry_on_empty

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
        elif method == "skills:list_all":
            from sparta_ai.skills.skill_loader import skills_index
            _emit(request_id, "skills:list_all:response", {"skills": skills_index()})
        elif method == "mcp.test":
            await self._handle_mcp_test(request_id, params)
        elif method == "permission.respond":
            from sparta_ai.tools.permission_broker import resolve_permission
            perm_id = params.get("request_id", "")
            approved = bool(params.get("approved", False))
            remember = str(params.get("remember", "once"))
            resolve_permission(perm_id, approved, remember)
        elif method == "shutdown":
            _emit(request_id, "shutdown", {"ok": True})
            self._running = False
        else:
            _emit_error(request_id, "unknown_method", f"Unknown method: {method}")
            _emit(request_id, "stream_end", {})

    async def _handle_mcp_test(self, request_id: str | None, params: dict):
        """Test connection to an MCP server and return discovered tools."""
        config = params.get("config", {})
        server_id = config.get("id", config.get("name", "unknown"))
        timeout = int(config.get("timeout", 10))

        from sparta_ai.tools.mcp_client import RealMCPClient

        client = RealMCPClient({**config, "timeout": min(timeout, 15)})
        try:
            tools = await client.connect()
            _emit(request_id, "mcp.test.result", {
                "ok": True,
                "serverId": server_id,
                "toolCount": len(tools),
                "tools": [
                    {"name": t["name"], "description": t.get("description", ""), "inputSchema": t.get("inputSchema", {})}
                    for t in tools
                ],
            })
        except Exception as e:
            _emit(request_id, "mcp.test.result", {
                "ok": False,
                "serverId": server_id,
                "error": str(e),
            })
        finally:
            await client.disconnect()

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
        workspace_root = params.get("workspace_root") or os.environ.get("SPARTA_WORKSPACE_ROOT")
        if workspace_root:
            os.environ["SPARTA_WORKSPACE_ROOT"] = str(workspace_root)
        else:
            # Ensure stale value from previous session doesn't leak
            os.environ.pop("SPARTA_WORKSPACE_ROOT", None)
            logger.warning("No workspace_root provided — file tools will fail with explicit error")

        agent_autonomy = params.get("agent_autonomy", "ask_risky")
        agent_execute_local = params.get("agent_execute_local", True)
        security_loaded = params.get("security_loaded", True)
        sandbox_mode = params.get("sandbox_mode", "none")
        open_files = params.get("open_files", [])

        # Store open files for get_open_files_tool
        from sparta_ai.tools.terminal_tools import _set_open_files
        _set_open_files(list(open_files))

        # Apply agent policy settings
        from sparta_ai.tools.terminal_tools import set_execute_local, set_sandbox_mode
        set_execute_local(bool(agent_execute_local))
        set_sandbox_mode(sandbox_mode)

        # If security module is not loaded, degrade to read-only mode
        # Also apply autonomy policy — autonomous_readonly forces read-only regardless of Rust status
        read_only_mode = not security_loaded or agent_autonomy == "autonomous_readonly"

        # Expose autonomy level so tools can adjust permission behavior
        from sparta_ai.tools.permission_broker import set_agent_autonomy
        set_agent_autonomy(agent_autonomy)

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
        api_url: str | None,
        mode: str,
        skills: list[str],
        mcp_servers: list,
        semantic_memory: bool,
        reasoning: dict,
        web_search_enabled: bool = True,
        read_only: bool = False,
    ) -> None:
        from sparta_ai.skills.skill_loader import build_skills_context, skills_index
        from sparta_ai.memory.chroma_store import build_memory_context
        from sparta_ai.memory.context_manager import compress_if_needed
        from sparta_ai.config.providers import build_llm
        from sparta_ai.persistence.sqlite_store import get_checkpointer
        from sparta_ai.agents.message_cleanup import (
            copy_reasoning_content_for_api,
            drop_thinking_only_and_merge_users,
            reapply_reasoning_echo_for_provider,
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

        # Build active skills context (user-toggled skills only)
        # Full skill index is discoverable via skills_list_tool
        skill_context = build_skills_context(skills) if skills else ""
        memory_context = ""
        if semantic_memory and session_id:
            memory_context = await build_memory_context(messages[-1].get("content", "") if messages else "")

        from sparta_ai.tools.mcp_client import build_mcp_tools

        def _mcp_emit(event: str, data: dict) -> None:
            _emit(request_id, event, data)

        mcp_tools = await build_mcp_tools(mcp_servers, emit_fn=_mcp_emit)

        from sparta_ai.tools.memory_tools import read_memory_tool, write_memory_tool
        from sparta_ai.tools.file_tools import (
            read_file_tool, write_file_tool, inject_workspace_guidance,
            search_files_tool, patch_file_tool, delete_file_tool,
        )
        from sparta_ai.tools.skill_tools import skill_view_tool, skills_list_tool, skill_manage_tool
        from sparta_ai.tools.terminal_tools import terminal_execute_tool, terminal_execute_background_tool, terminal_check_tool, get_open_files_tool
        from sparta_ai.tools.mcp_manage_tool import mcp_manage_tool
        from sparta_ai.tools.diagnostics_tool import get_diagnostics_tool

        # Ensure tool descriptions reflect the current workspace root (may have changed since import)
        inject_workspace_guidance()

        if read_only:
            logger.warning("Security module unavailable — running in READ-ONLY mode")
            agent_tools = [
                read_memory_tool,
                read_file_tool, search_files_tool,
                skill_view_tool, skills_list_tool,
                get_diagnostics_tool,
                terminal_check_tool,
                get_open_files_tool,
            ] + mcp_tools
        else:
            agent_tools = [
                read_memory_tool, write_memory_tool,
                read_file_tool, write_file_tool, search_files_tool, patch_file_tool, delete_file_tool,
                skill_view_tool, skills_list_tool, skill_manage_tool,
                terminal_execute_tool, terminal_execute_background_tool,
                mcp_manage_tool,
                get_diagnostics_tool,
                terminal_check_tool,
                get_open_files_tool,
            ] + mcp_tools
        if web_search_enabled:
            from sparta_ai.tools.web_search import web_search_tool
            agent_tools.insert(0, web_search_tool)

        # Determine policy mode from autonomy setting
        policy_mode = "plan" if (read_only or agent_autonomy == "autonomous_readonly") else "build"

        checkpointer = await get_checkpointer()
        graph = build_sparta_graph(
            llm=llm,
            tools=agent_tools,
            skill_context=skill_context,
            memory_context=memory_context,
            checkpointer=checkpointer,
            policy_mode=policy_mode,
            vendor=vendor or provider or "openai",
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
            "force_summary": False,
            "accumulated_text": "",
            "plan": [],
            "current_step": 0,
            "plan_complete": False,
            "reflection_retries": 0,
            "suggestions": [],
        }

        await stream_agent_to_electron(
            graph, initial_state, request_id, thread_id=session_id or request_id
        )


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
