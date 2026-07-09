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
_session_workspaces: dict[str, str] = {}


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
        elif method == "memory.index":
            await self._handle_memory_index(request_id, params)
        elif method == "memory.search":
            await self._handle_memory_search(request_id, params)
        elif method == "memory.embed":
            await self._handle_memory_embed(request_id, params)
        elif method == "memory.delete":
            await self._handle_memory_delete(request_id, params)
        elif method == "memory.count":
            await self._handle_memory_count(request_id)
        elif method == "shutdown":
            _emit(request_id, "shutdown", {"ok": True})
            self._running = False
        elif method == "agent.task":
            await self._handle_agent_task(request_id, params)
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
        workspace_root = params.get("workspace_root")
        if workspace_root:
            _session_workspaces[session_id] = str(workspace_root)
        else:
            _session_workspaces.pop(session_id, None)
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

        # Scope permissions to this session so cache doesn't leak between users
        from sparta_ai.tools.permission_broker import set_agent_autonomy, set_current_session
        set_current_session(session_id)
        set_agent_autonomy(agent_autonomy)

        # Determine policy mode from autonomy setting
        policy_mode = "plan" if (read_only_mode or agent_autonomy == "autonomous_readonly") else "build"

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

    async def _handle_agent_task(self, request_id: str | None, params: dict):
        """Run a sub-agent task with its own LLM loop, streaming steps back via _emit."""
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

        task = asyncio.create_task(
            self._execute_agent_task(
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

    async def _execute_agent_task(
        self,
        request_id: str | None,
        task_id: str,
        agent_id: str,
        task_description: str,
        system_prompt: str,
        allowed_tools: list[str],
        model: str,
        provider: str,
        vendor: str,
        provider_key: str | None,
        api_url: str | None,
        workspace_root: str,
        agent_autonomy: str,
        max_turns: int,
    ) -> None:
        from sparta_ai.config.providers import build_llm
        from sparta_ai.tools.permission_broker import set_agent_autonomy
        set_agent_autonomy(agent_autonomy)

        if workspace_root:
            _session_workspaces[task_id] = workspace_root
            from sparta_ai.tools.file_tools import set_session_workspace
            set_session_workspace(task_id, workspace_root)

        try:
            llm = build_llm(model=model, provider=provider, vendor=vendor, api_key=provider_key, api_url=api_url)

            from sparta_ai.tools.file_tools import (
                read_file_tool, write_file_tool, search_files_tool, patch_file_tool, delete_file_tool,
            )
            from sparta_ai.tools.terminal_tools import terminal_execute_tool, terminal_check_tool
            from sparta_ai.tools.memory_tools import read_memory_tool
            from sparta_ai.tools.diagnostics_tool import get_diagnostics_tool

            all_tools_map = {
                "read_file": read_file_tool, "write_file": write_file_tool,
                "search_files": search_files_tool, "patch_file": patch_file_tool,
                "delete_file": delete_file_tool,
                "terminal_execute": terminal_execute_tool, "terminal_check": terminal_check_tool,
                "read_memory": read_memory_tool, "get_diagnostics": get_diagnostics_tool,
            }

            active_tools = [all_tools_map[t] for t in allowed_tools if t in all_tools_map]

            messages = [{"role": "user", "content": task_description}]
            accumulated = ""

            for turn in range(max_turns):
                tool_names = [t.name for t in active_tools]
                tool_descs = "\n".join(f"- {t.name}: {t.description}" for t in active_tools)

                prompt = (
                    f"{system_prompt}\n\n"
                    f"## Herramientas disponibles\n"
                    f"Puedes usar las siguientes herramientas. Cuando necesites usar una, responde con:\n"
                    f"<tool_use>\n<tool_name>nombre</tool_name>\n<tool_input>{{json}}</tool_input>\n</tool_use>\n\n"
                    f"{tool_descs}\n\n"
                    f"## Conversación\n"
                )
                for msg in messages:
                    prompt += f"\n{msg['role'].upper()}: {msg['content']}"
                prompt += "\n\nASSISTANT: "

                from langchain_core.messages import HumanMessage, SystemMessage
                response_msg = await llm.ainvoke([HumanMessage(content=prompt)])
                response = response_msg.content if hasattr(response_msg, "content") else str(response_msg)
                messages.append({"role": "assistant", "content": response})

                import re
                tool_blocks = re.findall(
                    r"<tool_use>\s*<tool_name>([\w-]+)</tool_name>\s*<tool_input>([\s\S]*?)</tool_input>\s*</tool_use>",
                    response,
                )

                if not tool_blocks:
                    result_match = re.search(r"<result>([\s\S]*?)</result>", response)
                    accumulated = result_match.group(1).strip() if result_match else response.strip()
                    break

                for idx, (tname, tinput_str) in enumerate(tool_blocks):
                    step_id = f"step-{turn}-{tname.lower()}-{idx}"
                    _emit(request_id, "agent:step", {
                        "task_id": task_id,
                        "agent_id": agent_id,
                        "step_id": step_id,
                        "tool_name": tname,
                        "status": "running",
                    })

                    try:
                        try:
                            tinput = json.loads(tinput_str)
                        except json.JSONDecodeError:
                            tinput = tinput_str

                        tool_fn = all_tools_map.get(tname)
                        if not tool_fn:
                            raise ValueError(f"Tool '{tname}' not in allowed tools")

                        import time
                        t0 = time.monotonic()
                        tool_result = await tool_fn.ainvoke(tinput) if hasattr(tool_fn, "ainvoke") else tool_fn.invoke(tinput)
                        duration_ms = int((time.monotonic() - t0) * 1000)

                        _emit(request_id, "agent:step", {
                            "task_id": task_id,
                            "agent_id": agent_id,
                            "step_id": step_id,
                            "tool_name": tname,
                            "status": "completed",
                            "duration_ms": duration_ms,
                        })

                        messages.append({"role": "user", "content": f"Resultado de {tname} ({duration_ms}ms): {tool_result}"})
                    except Exception as e:
                        _emit(request_id, "agent:step", {
                            "task_id": task_id,
                            "agent_id": agent_id,
                            "step_id": step_id,
                            "tool_name": tname,
                            "status": "error",
                            "error": str(e),
                        })
                        messages.append({"role": "user", "content": f"Resultado de {tname}: ERROR: {e}"})

            if turn >= max_turns - 1:
                accumulated = "Límite de turnos alcanzado.\n" + accumulated

            _emit(request_id, "agent:completed", {
                "task_id": task_id,
                "agent_id": agent_id,
                "result": accumulated,
            })

        finally:
            if workspace_root:
                if prev is not None:
                    os.environ["SPARTA_WORKSPACE_ROOT"] = prev
                else:
                    os.environ.pop("SPARTA_WORKSPACE_ROOT", None)
            _session_workspaces.pop(task_id, None)

    async def _handle_memory_index(self, request_id: str | None, params: dict):
        from sparta_ai.memory.chroma_store import index_entry
        entry = params.get("entry", {})
        try:
            entry_id = index_entry(entry)
            _emit(request_id, "memory.index:response", {"ok": bool(entry_id), "id": entry_id})
        except Exception as e:
            logger.error("memory.index failed: %s", e)
            _emit(request_id, "memory.index:response", {"ok": False, "error": str(e)})

    async def _handle_memory_search(self, request_id: str | None, params: dict):
        from sparta_ai.memory.chroma_store import semantic_search
        query = params.get("query", "")
        k = int(params.get("k", 5))
        try:
            results = semantic_search(query, k=k)
            _emit(request_id, "memory.search:response", {"ok": True, "results": results})
        except Exception as e:
            logger.error("memory.search failed: %s", e)
            _emit(request_id, "memory.search:response", {"ok": False, "error": str(e)})

    async def _handle_memory_embed(self, request_id: str | None, params: dict):
        from sparta_ai.memory.embeddings import embed_text, embed_texts
        texts = params.get("texts", [])
        single = params.get("text")
        try:
            if single is not None:
                vector = embed_text(single)
                _emit(request_id, "memory.embed:response", {"ok": True, "embedding": vector})
            elif isinstance(texts, list) and texts:
                vectors = embed_texts(texts)
                _emit(request_id, "memory.embed:response", {"ok": True, "embeddings": vectors})
            else:
                _emit(request_id, "memory.embed:response", {"ok": False, "error": "text or texts required"})
        except Exception as e:
            logger.error("memory.embed failed: %s", e)
            _emit(request_id, "memory.embed:response", {"ok": False, "error": str(e)})

    async def _handle_memory_delete(self, request_id: str | None, params: dict):
        from sparta_ai.memory.chroma_store import delete_entry
        entry_id = params.get("entry_id", "")
        try:
            delete_entry(entry_id)
            _emit(request_id, "memory.delete:response", {"ok": True})
        except Exception as e:
            logger.error("memory.delete failed: %s", e)
            _emit(request_id, "memory.delete:response", {"ok": False, "error": str(e)})

    async def _handle_memory_count(self, request_id: str | None):
        from sparta_ai.memory.chroma_store import count_entries
        try:
            count = count_entries()
            _emit(request_id, "memory.count:response", {"ok": True, "count": count})
        except Exception as e:
            logger.error("memory.count failed: %s", e)
            _emit(request_id, "memory.count:response", {"ok": False, "error": str(e)})

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
        policy_mode: str = "build",
    ) -> None:
        from sparta_ai.skills.skill_loader import build_skills_context, skills_index
        from sparta_ai.memory.chroma_store import build_memory_context
        from sparta_ai.memory.context_manager import compress_if_needed
        from sparta_ai.config.providers import build_llm
        from sparta_ai.persistence.sqlite_store import get_checkpointer
        from sparta_ai.agents.message_cleanup import (
            copy_reasoning_content_for_api,
            drop_thinking_only_and_merge_users,
            format_reasoning_for_provider,
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

        # Scope workspace root to this session's execution window
        workspace = _session_workspaces.get(session_id, "")
        if workspace:
            from sparta_ai.tools.file_tools import set_session_workspace
            set_session_workspace(session_id, workspace)
        try:
            # Clean messages for API safety: drop thinking-only turns + sanitize reasoning fields
            api_messages = drop_thinking_only_and_merge_users(messages)
            api_messages = copy_reasoning_content_for_api(api_messages, vendor or provider)
            api_messages = format_reasoning_for_provider(api_messages, vendor or provider)
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
        finally:
            # Restore previous workspace root so concurrent sessions aren't affected
            if workspace:
                if prev_workspace is not None:
                    os.environ["SPARTA_WORKSPACE_ROOT"] = prev_workspace
                else:
                    os.environ.pop("SPARTA_WORKSPACE_ROOT", None)


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
