"""Shared business logic for both server.py (stdio) and server_web.py (WebSocket).

Both transports delegate here for:
- memory.* operations
- MCP test
- Agent execution (LLM setup, tool assembly, graph build, state creation)
- Agent sub-task execution
"""

import asyncio
import json
import logging
import os
import re
import time
from typing import Any, Callable, Coroutine, Optional

from sparta_ai.agents.sparta_agent import build_sparta_graph, SpartaState

logger = logging.getLogger("sparta_ai.server_handlers")

_active_streams: dict[str, asyncio.Task] = {}
_session_workspaces: dict[str, str] = {}


# ── Workspace helpers ────────────────────────────────────────────────────


def set_session_workspace(session_id: str, root: str) -> None:
    _session_workspaces[session_id] = root
    from sparta_ai.tools.file_tools import set_session_workspace as _set_ws
    _set_ws(session_id, root)


def get_session_workspace(session_id: str) -> str:
    return _session_workspaces.get(session_id, "")


# ── Memory handlers ─────────────────────────────────────────────────────


async def handle_memory_index(params: dict) -> dict:
    from sparta_ai.memory.chroma_store import index_entry
    entry = params.get("entry", {})
    try:
        entry_id = index_entry(entry)
        return {"ok": bool(entry_id), "id": entry_id}
    except Exception as e:
        logger.error("memory.index failed: %s", e)
        return {"ok": False, "error": str(e)}


async def handle_memory_search(params: dict) -> dict:
    from sparta_ai.memory.chroma_store import semantic_search
    query = params.get("query", "")
    k = int(params.get("k", 5))
    try:
        results = semantic_search(query, k=k)
        return {"ok": True, "results": results}
    except Exception as e:
        logger.error("memory.search failed: %s", e)
        return {"ok": False, "error": str(e)}


async def handle_memory_embed(params: dict) -> dict:
    from sparta_ai.memory.embeddings import embed_text, embed_texts
    texts = params.get("texts", [])
    single = params.get("text")
    try:
        if single is not None:
            return {"ok": True, "embedding": embed_text(single)}
        if isinstance(texts, list) and texts:
            return {"ok": True, "embeddings": embed_texts(texts)}
        return {"ok": False, "error": "text or texts required"}
    except Exception as e:
        logger.error("memory.embed failed: %s", e)
        return {"ok": False, "error": str(e)}


async def handle_memory_delete(params: dict) -> dict:
    from sparta_ai.memory.chroma_store import delete_entry
    entry_id = params.get("entry_id", "")
    try:
        delete_entry(entry_id)
        return {"ok": True}
    except Exception as e:
        logger.error("memory.delete failed: %s", e)
        return {"ok": False, "error": str(e)}


async def handle_memory_count() -> dict:
    from sparta_ai.memory.chroma_store import count_entries
    try:
        return {"ok": True, "count": count_entries()}
    except Exception as e:
        logger.error("memory.count failed: %s", e)
        return {"ok": False, "error": str(e)}


# ── MCP test handler ────────────────────────────────────────────────────


async def handle_mcp_test(params: dict) -> dict:
    config = params.get("config", {})
    server_id = config.get("id", config.get("name", "unknown"))
    timeout = int(config.get("timeout", 10))
    from sparta_ai.tools.mcp_client import RealMCPClient
    client = RealMCPClient({**config, "timeout": min(timeout, 15)})
    try:
        tools = await client.connect()
        return {
            "ok": True,
            "serverId": server_id,
            "toolCount": len(tools),
            "tools": [
                {"name": t["name"], "description": t.get("description", ""), "inputSchema": t.get("inputSchema", {})}
                for t in tools
            ],
        }
    except Exception as e:
        return {"ok": False, "serverId": server_id, "error": str(e)}
    finally:
        await client.disconnect()


# ── Tool assembly ────────────────────────────────────────────────────────


def _wrap_tools_with_hooks(tools: list, workspace_root: str) -> list:
    """Wrap tools with lifecycle hooks if ``sparta.hooks.json`` exists.

    For each tool, if there are ``PreToolUse`` / ``PostToolUse`` hooks whose
    ``matcher`` matches the tool name, the original tool is wrapped so that
    hooks run before/after invocation.  If no hooks config exists or no hooks
    match, the tool is returned as-is (zero overhead).
    """
    from sparta_ai.hooks.registry import load_hooks
    from sparta_ai.hooks.runner import run_hooks
    from sparta_ai.hooks.events import PRE_TOOL_USE, POST_TOOL_USE

    hooks_config = load_hooks(workspace_root)
    if not hooks_config:
        return tools

    pre_hooks = hooks_config.get(PRE_TOOL_USE, [])
    post_hooks = hooks_config.get(POST_TOOL_USE, [])
    if not pre_hooks and not post_hooks:
        return tools

    wrapped = []
    for t in tools:
        tool_name = getattr(t, "name", "") or ""

        # Check if any hook matches this tool
        has_pre = any(h.get("matcher", "") and tool_name for h in pre_hooks)
        has_post = any(h.get("matcher", "") and tool_name for h in post_hooks)
        if not has_pre and not has_post:
            wrapped.append(t)
            continue

        original_invoke = t.invoke
        original_ainvoke = t.ainvoke if hasattr(t, "ainvoke") else None

        def _make_sync_wrapper(tool_obj, tn):
            def _sync_wrapper(input_data):
                allowed, output = run_hooks(
                    pre_hooks, PRE_TOOL_USE, tool_name=tn,
                    tool_input=str(input_data)[:200], workspace_root=workspace_root,
                )
                if not allowed:
                    return f"Hook bloqueó la ejecución de '{tn}': {output}"
                result = original_invoke(input_data)
                run_hooks(
                    post_hooks, POST_TOOL_USE, tool_name=tn,
                    tool_input=str(input_data)[:200], workspace_root=workspace_root,
                )
                return result
            return _sync_wrapper

        def _make_async_wrapper(tool_obj, tn, orig_async):
            async def _async_wrapper(input_data):
                allowed, output = await asyncio.to_thread(
                    run_hooks, pre_hooks, PRE_TOOL_USE, tn, str(input_data)[:200], workspace_root,
                )
                if not allowed:
                    return f"Hook bloqueó la ejecución de '{tn}': {output}"
                result = await orig_async(input_data)
                await asyncio.to_thread(
                    run_hooks, post_hooks, POST_TOOL_USE, tn, str(input_data)[:200], workspace_root,
                )
                return result
            return _async_wrapper

        t.invoke = _make_sync_wrapper(t, tool_name)
        if original_ainvoke:
            t.ainvoke = _make_async_wrapper(t, tool_name, original_ainvoke)
        wrapped.append(t)

    return wrapped


def _assemble_agent_tools(
    read_only: bool,
    web_search_enabled: bool,
    mcp_tools: list,
    session_id: str = "",
) -> list:
    from sparta_ai.tools.memory_tools import read_memory_tool, write_memory_tool
    from sparta_ai.tools.file_tools import (
        read_file_tool, write_file_tool, search_files_tool,
        patch_file_tool, delete_file_tool, inject_workspace_guidance,
    )
    from sparta_ai.tools.patch_tools import apply_patch_tool
    from sparta_ai.tools.skill_tools import skill_view_tool, skills_list_tool, skill_manage_tool
    from sparta_ai.tools.terminal_tools import (
        terminal_execute_tool, terminal_execute_background_tool, terminal_check_tool, get_open_files_tool,
    )
    from sparta_ai.tools.mcp_manage_tool import mcp_manage_tool
    from sparta_ai.tools.diagnostics_tool import get_diagnostics_tool

    inject_workspace_guidance()

    # apply_patch_tool lives in patch_tools.py; inject workspace guidance here
    # to avoid circular imports between file_tools.py and patch_tools.py.
    try:
        from sparta_ai.tools.file_tools import _workspace_guidance as _ws_guidance
        _guidance = _ws_guidance()
    except RuntimeError:
        _guidance = ""
    if _guidance:
        apply_patch_tool.description = (
            f"{apply_patch_tool.description}\n\n{_guidance}"
        )

    if read_only:
        tools = [
            read_memory_tool,
            read_file_tool, search_files_tool,
            skill_view_tool, skills_list_tool,
            get_diagnostics_tool,
            terminal_check_tool,
            get_open_files_tool,
        ]
    else:
        tools = [
            read_memory_tool, write_memory_tool,
            read_file_tool, write_file_tool, search_files_tool, patch_file_tool, delete_file_tool,
            apply_patch_tool,
            skill_view_tool, skills_list_tool, skill_manage_tool,
            terminal_execute_tool, terminal_execute_background_tool,
            mcp_manage_tool,
            get_diagnostics_tool,
            terminal_check_tool,
            get_open_files_tool,
        ]

    tools.extend(mcp_tools)

    if web_search_enabled:
        from sparta_ai.tools.web_search import web_search_tool
        from sparta_ai.tools.web_fetch import web_fetch_tool
        tools.insert(0, web_search_tool)
        tools.insert(1, web_fetch_tool)

    # Wrap tools with lifecycle hooks if configured
    workspace_root = os.environ.get("SPARTA_WORKSPACE_ROOT", "")
    if session_id:
        workspace_root = get_session_workspace(session_id) or workspace_root
    if workspace_root:
        tools = _wrap_tools_with_hooks(tools, workspace_root)

    return tools


def _build_initial_state(
    compressed_messages: list,
    session_id: str,
    mode: str,
    skills: list[str],
    memory_context: str,
) -> SpartaState:
    return {
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


# ── Agent execution ──────────────────────────────────────────────────────


async def prepare_agent(
    *,
    messages: list,
    model: str,
    provider: str,
    vendor: str,
    provider_key: Optional[str],
    api_url: Optional[str],
    session_id: str,
    mode: str,
    skills: list[str],
    mcp_servers: list,
    semantic_memory: bool,
    reasoning: dict,
    web_search_enabled: bool,
    read_only: bool,
    policy_mode: str = "build",
    emit_fn: Optional[Callable[[str, dict], Coroutine]] = None,
) -> tuple:
    """Build LLM, tools, graph and initial state. Returns (graph, initial_state)."""
    from sparta_ai.skills.skill_loader import build_skills_context
    from sparta_ai.memory.chroma_store import build_memory_context
    from sparta_ai.memory.context_manager import compress_if_needed
    from sparta_ai.config.providers import build_llm
    from sparta_ai.persistence.sqlite_store import get_checkpointer
    from sparta_ai.agents.message_cleanup import (
        copy_reasoning_content_for_api,
        drop_thinking_only_and_merge_users,
        format_reasoning_for_provider,
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

    api_messages = drop_thinking_only_and_merge_users(messages)
    api_messages = copy_reasoning_content_for_api(api_messages, vendor or provider)
    api_messages = format_reasoning_for_provider(api_messages, vendor or provider)
    compressed_messages = await compress_if_needed(api_messages, llm)

    skill_context = build_skills_context(skills) if skills else ""
    memory_context = ""
    if semantic_memory and session_id:
        memory_context = await build_memory_context(
            messages[-1].get("content", "") if messages else ""
        )

    from sparta_ai.tools.mcp_manager import mcp_manager
    mcp_tools = await mcp_manager.get_tools(session_id, mcp_servers, emit_fn=emit_fn)

    agent_tools = _assemble_agent_tools(read_only, web_search_enabled, mcp_tools, session_id=session_id)

    # Emit SessionStart hook
    workspace_root = os.environ.get("SPARTA_WORKSPACE_ROOT", "")
    if session_id:
        workspace_root = get_session_workspace(session_id) or workspace_root
    if workspace_root:
        from sparta_ai.hooks.registry import load_hooks
        from sparta_ai.hooks.runner import run_hooks
        from sparta_ai.hooks.events import SESSION_START
        hooks_config = load_hooks(workspace_root)
        if hooks_config:
            await asyncio.to_thread(
                run_hooks, hooks_config.get(SESSION_START, []), SESSION_START,
                workspace_root=workspace_root,
            )

    checkpointer = await get_checkpointer()
    graph = build_sparta_graph(
        llm=llm,
        tools=agent_tools,
        skill_context=skill_context,
        memory_context=memory_context,
        checkpointer=checkpointer,
        policy_mode=policy_mode,
        vendor=vendor or provider or "openai",
        model=model,
    )

    initial_state = _build_initial_state(
        compressed_messages, session_id, mode, skills, memory_context
    )

    return graph, initial_state


async def run_agent_stream(
    *,
    request_id: str,
    session_id: str,
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
    web_search_enabled: bool,
    read_only: bool,
    policy_mode: str,
    open_files: list[str] = None,
    agent_autonomy: str = "ask_risky",
    agent_execute_local: bool = True,
    sandbox_mode: str = "none",
    security_loaded: bool = True,
    emit_fn: Callable[[str, dict], Coroutine] = None,
    stream_fn: Callable[..., Coroutine] = None,
) -> None:
    """Prepare + run agent, calling stream_fn(graph, initial_state, ...)."""
    from sparta_ai.tools.permission_broker import set_agent_autonomy as _set_autonomy, set_current_session as _set_session

    _set_session(session_id)
    _set_autonomy(agent_autonomy)

    if open_files is not None:
        from sparta_ai.tools.terminal_tools import _set_open_files
        _set_open_files(list(open_files))

    if agent_execute_local is not None:
        from sparta_ai.tools.terminal_tools import set_execute_local, set_sandbox_mode
        set_execute_local(bool(agent_execute_local))
        set_sandbox_mode(sandbox_mode)

    graph, initial_state = await prepare_agent(
        messages=messages,
        model=model,
        provider=provider,
        vendor=vendor,
        provider_key=provider_key,
        api_url=api_url,
        session_id=session_id,
        mode=mode,
        skills=skills,
        mcp_servers=mcp_servers,
        semantic_memory=semantic_memory,
        reasoning=reasoning,
        web_search_enabled=web_search_enabled,
        read_only=read_only,
        policy_mode=policy_mode,
        emit_fn=emit_fn,
    )

    await stream_fn(graph, initial_state)

    # Emit SessionStop hook
    workspace_root = os.environ.get("SPARTA_WORKSPACE_ROOT", "")
    if session_id:
        workspace_root = get_session_workspace(session_id) or workspace_root
    if workspace_root:
        from sparta_ai.hooks.registry import load_hooks
        from sparta_ai.hooks.runner import run_hooks
        from sparta_ai.hooks.events import SESSION_STOP
        hooks_config = load_hooks(workspace_root)
        if hooks_config:
            await asyncio.to_thread(
                run_hooks, hooks_config.get(SESSION_STOP, []), SESSION_STOP,
                workspace_root=workspace_root,
            )


# ── Agent sub-task execution ─────────────────────────────────────────────


async def run_agent_task(
    *,
    request_id: Optional[str],
    task_id: str,
    agent_id: str,
    task_description: str,
    system_prompt: str,
    allowed_tools: list[str],
    model: str,
    provider: str,
    vendor: str,
    provider_key: Optional[str],
    api_url: Optional[str],
    workspace_root: str,
    agent_autonomy: str,
    max_turns: int,
    emit_fn: Callable[[Optional[str], str, dict], None],
) -> None:
    """Run a sub-agent task with its own LLM loop, streaming steps back via emit_fn."""
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
        from sparta_ai.tools.patch_tools import apply_patch_tool
        from sparta_ai.tools.terminal_tools import terminal_execute_tool, terminal_check_tool
        from sparta_ai.tools.memory_tools import read_memory_tool
        from sparta_ai.tools.diagnostics_tool import get_diagnostics_tool

        all_tools_map = {
            "read_file": read_file_tool, "write_file": write_file_tool,
            "search_files": search_files_tool, "patch_file": patch_file_tool,
            "apply_patch": apply_patch_tool,
            "delete_file": delete_file_tool,
            "terminal_execute": terminal_execute_tool, "terminal_check": terminal_check_tool,
            "read_memory": read_memory_tool, "get_diagnostics": get_diagnostics_tool,
        }

        active_tools = [all_tools_map[t] for t in allowed_tools if t in all_tools_map]

        messages = [{"role": "user", "content": task_description}]
        accumulated = ""

        for turn in range(max_turns):
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

            from langchain_core.messages import HumanMessage
            response_msg = await llm.ainvoke([HumanMessage(content=prompt)])
            response = response_msg.content if hasattr(response_msg, "content") else str(response_msg)
            messages.append({"role": "assistant", "content": response})

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
                emit_fn(request_id, "agent:step", {
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

                    t0 = time.monotonic()
                    tool_result = await tool_fn.ainvoke(tinput) if hasattr(tool_fn, "ainvoke") else tool_fn.invoke(tinput)
                    duration_ms = int((time.monotonic() - t0) * 1000)

                    emit_fn(request_id, "agent:step", {
                        "task_id": task_id,
                        "agent_id": agent_id,
                        "step_id": step_id,
                        "tool_name": tname,
                        "status": "completed",
                        "duration_ms": duration_ms,
                    })

                    messages.append({"role": "user", "content": f"Resultado de {tname} ({duration_ms}ms): {tool_result}"})
                except Exception as e:
                    emit_fn(request_id, "agent:step", {
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

        emit_fn(request_id, "agent:completed", {
            "task_id": task_id,
            "agent_id": agent_id,
            "result": accumulated,
        })

    finally:
        if workspace_root:
            _session_workspaces.pop(task_id, None)
            from sparta_ai.tools.file_tools import clear_session_workspace
            clear_session_workspace(task_id)
