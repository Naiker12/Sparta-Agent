import asyncio
import traceback
import logging

from sparta_streaming.event_bridge import stream_agent_to_electron
from sparta_mcp.server_handlers import (
    _active_streams,
    _session_workspaces,
    set_session_workspace,
    run_agent_stream,
    run_agent_task,
)

logger = logging.getLogger("sparta_ai.server")


async def handle_chat_stream(server, request_id: str, params: dict):
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
        server._emit(request_id, "workspace:connected", {"root": str(workspace_root)})
    else:
        _session_workspaces.pop(session_id, None)

    agent_autonomy = params.get("agent_autonomy", "ask_risky")
    agent_execute_local = params.get("agent_execute_local", True)
    security_loaded = params.get("security_loaded", True)
    sandbox_mode = params.get("sandbox_mode", "none")
    open_files = params.get("open_files", [])

    from sparta_tools.terminal_tools import (
        _set_open_files,
        set_execute_local,
        set_sandbox_mode,
    )
    _set_open_files(list(open_files))
    set_execute_local(bool(agent_execute_local))
    set_sandbox_mode(sandbox_mode)

    read_only_mode = (
        not security_loaded
        or agent_autonomy == "autonomous_readonly"
    )
    policy_mode = (
        "plan" if read_only_mode else "build"
    )

    from sparta_security.permission_policy import (
        MODE_PRESETS,
        set_autonomy,
    )
    mode_preset = MODE_PRESETS.get(
        mode, MODE_PRESETS.get(policy_mode, MODE_PRESETS["build"])
    )
    set_autonomy(approval=mode_preset[0], sandbox=mode_preset[1])

    async def _mcp_emit(event: str, data: dict) -> None:
        server._emit(request_id, event, data)

    task = asyncio.create_task(
        execute_agent(
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
        server._emit(request_id, "stream:aborted", {"cancelled": True})
    except Exception as e:
        logger.error("Agent execution failed: %s", traceback.format_exc())
        server._emit_error(request_id, "internal_error", str(e))
        server._emit(request_id, "stream:completed", {})
    finally:
        _active_streams.pop(request_id, None)


async def handle_chat_abort(params: dict):
    request_id = params.get("request_id")
    if request_id and request_id in _active_streams:
        _active_streams[request_id].cancel()


async def execute_agent(
    request_id: str,
    session_id: str,
    messages: list,
    model: str,
    provider: str,
    vendor: str,
    provider_key,
    api_url,
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


async def handle_agent_task(request_id, params, emit, emit_error):
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
        emit(rid, event, data)

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
        emit(request_id, "agent:step", {"task_id": task_id, "step": "cancelled", "status": "error"})
    except Exception as e:
        logger.error("Agent task failed: %s", traceback.format_exc())
        emit_error(request_id, "internal_error", str(e))
    finally:
        _active_streams.pop(f"agent:{task_id}", None)
