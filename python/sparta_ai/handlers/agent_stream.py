"""run_agent_stream() — main conversation streaming path."""
import asyncio
import logging
import os
from typing import Callable, Coroutine, Optional

from sparta_ai.handlers.agent_prepare import prepare_agent
from sparta_ai.handlers.workspace import get_session_workspace

logger = logging.getLogger("sparta_ai.server_handlers")


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
    connected_folder: Optional[str] = None,
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
        connected_folder=connected_folder,
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
