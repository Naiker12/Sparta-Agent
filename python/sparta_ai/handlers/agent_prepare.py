"""prepare_agent() — the core preparation pipeline for the main agent."""
import asyncio
import logging
import os
import time as _time
from typing import Callable, Coroutine, Optional

from sparta_ai.handlers.tool_assembly import _assemble_agent_tools, _build_project_context
from sparta_ai.handlers.workspace import get_session_workspace

logger = logging.getLogger("sparta_ai.server_handlers")


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
    """Build LLM, tools, graph and initial state. Returns (graph, initial_state).

    The preparation pipeline is parallelized: after building the LLM (which
    is fast), context compression, memory retrieval, skill loading, workspace
    scanning, MCP tool discovery and checkpointer init all run concurrently
    via ``asyncio.gather``.  This reduces prepare latency from ~500ms to
    ~50ms when the I/O tasks dominate.
    """
    from sparta_ai.skills.skill_loader import build_skills_context
    from sparta_ai.memory.chroma_store import build_memory_context
    from sparta_ai.memory.context_manager import compress_if_needed_non_blocking
    from sparta_ai.config.providers import build_llm
    from sparta_ai.persistence.sqlite_store import get_checkpointer
    from sparta_ai.agents.message_cleanup import single_pass_cleanup

    t0 = _time.perf_counter()
    t_phase = _time.perf_counter()

    # ── 0. Health check for local providers (fast-fail) ────────────────
    from sparta_ai.config.providers import check_provider_health as _check_health
    health_warning = _check_health(provider, vendor=vendor)
    if health_warning:
        logger.warning("Provider health check failed: %s", health_warning)
        raise RuntimeError(
            f"El proveedor no responde. {health_warning}"
        )
    health_ms = (_time.perf_counter() - t_phase) * 1000

    t_phase = _time.perf_counter()

    # ── 1. Build LLM (fast, synchronous, needed by compression) ────────
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
    build_ms = (_time.perf_counter() - t_phase) * 1000

    # ── 2. Single-pass message cleanup (Algoritmo C) ───────────────────
    api_messages = single_pass_cleanup(messages, vendor or provider)

    # ── 3. Resolve workspace root (shared by multiple tasks) ────────────
    workspace_root = os.environ.get("SPARTA_WORKSPACE_ROOT", "")
    if session_id:
        workspace_root = get_session_workspace(session_id) or workspace_root

    # ── 4. Parallel preparation (Algoritmo B) ──────────────────────────
    last_user_msg = messages[-1].get("content", "") if messages else ""

    async def _compress():
        return await compress_if_needed_non_blocking(api_messages, llm, session_id)

    async def _memory():
        if semantic_memory and session_id:
            return await build_memory_context(last_user_msg)
        return ""

    def _skills():
        return build_skills_context(skills) if skills else ""

    def _project():
        if workspace_root:
            return _build_project_context(workspace_root)
        return ""

    async def _mcp():
        if read_only or policy_mode == "chat":
            return []
        if not mcp_servers:
            return []
        from sparta_ai.tools.mcp_manager import mcp_manager
        return await mcp_manager.get_tools(session_id, mcp_servers, emit_fn=emit_fn, workspace_root=workspace_root)

    async def _checkpointer():
        return await get_checkpointer()

    (
        compressed_messages,
        memory_context,
        skill_context,
        project_context,
        mcp_tools,
        checkpointer,
    ) = await asyncio.gather(
        _compress(),
        _memory(),
        asyncio.to_thread(_skills),
        asyncio.to_thread(_project),
        _mcp(),
        _checkpointer(),
    )

    t_prep = (_time.perf_counter() - t0) * 1000
    logger.info(
        "prepare_agent parallel phase: %.1fms [vendor=%s model=%s health=%.1fms build=%.1fms]",
        t_prep, vendor or provider, model, health_ms, build_ms,
    )

    # ── 5. Assemble tools (depends on mcp_tools) ───────────────────────
    agent_tools = _assemble_agent_tools(read_only, web_search_enabled, mcp_tools, session_id=session_id)

    # ── 6. Emit SessionStart hook ──────────────────────────────────────
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

    # ── 7. Build graph and initial state ───────────────────────────────
    from sparta_ai.agents.sparta_agent import build_sparta_graph
    from sparta_ai.handlers.agent_state import _build_initial_state

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
        compressed_messages, session_id, mode, skills, memory_context,
        project_context=project_context,
    )

    # ── 8. Emit cold-start notice for local providers ──────────────────
    if emit_fn and (vendor or provider) in ("lmstudio", "ollama", "llamacpp", "custom"):
        await emit_fn("stream:notice", {
            "code": "provider:cold_start",
            "vendor": vendor or provider,
            "model": model,
            "message": (
                f"Cargando {model} en {vendor or provider}... "
                "Si el modelo no está cargado en memoria, la primera respuesta "
                "puede demorar mientras se carga en VRAM/RAM."
            ),
        })

    t_total = (_time.perf_counter() - t0) * 1000
    logger.info("prepare_agent total: %.1fms", t_total)

    return graph, initial_state
