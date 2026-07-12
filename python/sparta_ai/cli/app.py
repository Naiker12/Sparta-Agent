"""
Typer app entry point for Sparta CLI.

Usage:
    python -m sparta_ai.cli                   # show help
    python -m sparta_ai.cli --model gpt-4o    # start REPL with options
"""

from __future__ import annotations

import asyncio
import logging
import os
import sys
from typing import Optional

import typer

from rich.console import Console

from sparta_ai.cli.session.state import SessionState
from sparta_ai.cli.repl import run_repl
from sparta_ai.cli.providers.catalog import load_catalog, resolve_env_key
from sparta_ai.cli.theme import SUCCESS, WARNING

try:
    sys.stdout.reconfigure(encoding="utf-8", line_buffering=True)
except Exception:
    pass

logging.basicConfig(
    level=logging.WARNING,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    stream=sys.stderr,
)

console = Console()

DEFAULT_MODEL = "claude-sonnet-4-6"
DEFAULT_PROVIDER = "anthropic"
DEFAULT_VENDOR = "anthropic"


def _build_tools_only(skills: list[str], web_search: bool) -> tuple[list, str]:
    """Build tools list + skill context WITHOUT touching the LLM/graph.

    Used when there's no provider yet, so the banner can still show real counts
    and /provider doesn't need to rebuild everything from scratch.
    """
    from sparta_ai.skills.skill_loader import build_skills_context
    from sparta_ai.tools.file_tools import read_file_tool, write_file_tool
    from sparta_ai.tools.memory_tools import read_memory_tool, write_memory_tool
    from sparta_ai.tools.skill_tools import (
        skill_view_tool, skills_list_tool, skill_manage_tool,
    )
    from sparta_ai.tools.terminal_tools import (
        terminal_execute_tool, terminal_execute_background_tool,
    )
    from sparta_ai.tools.web_search import web_search_tool

    skill_context = build_skills_context(skills) if skills else ""
    tools = [
        read_memory_tool, write_memory_tool, read_file_tool, write_file_tool,
        skill_view_tool, skills_list_tool, skill_manage_tool,
        terminal_execute_tool, terminal_execute_background_tool,
    ]
    if web_search:
        tools.insert(0, web_search_tool)
    return tools, skill_context


def repl(
    model: str = typer.Option(DEFAULT_MODEL, "--model", "-m", help="Model name"),
    provider: str = typer.Option(DEFAULT_PROVIDER, "--provider", "-p", help="Provider"),
    vendor: str = typer.Option(DEFAULT_VENDOR, "--vendor", "-v", help="Vendor"),
    provider_key: Optional[str] = typer.Option(None, "--key", "-k", help="API key (or env var)"),
    skills: list[str] = typer.Option([], "--skill", help="Active skill IDs"),
    semantic_memory: bool = typer.Option(False, "--memory", help="Enable semantic memory"),
    web_search: bool = typer.Option(True, "--web/--no-web", help="Enable web search"),
    mode: str = typer.Option("chat", "--mode", help="Agent mode (chat|architect|auto)"),
) -> None:
    """Start an interactive REPL session with the Sparta agent."""
    api_key = resolve_env_key(provider) or provider_key

    if not api_key:
        # No API key → neutral state. No auto-fallback to Ollama.
        # No provider is assumed; the user chooses explicitly via /provider.
        tools, skill_context = _build_tools_only(skills, web_search)
        state = SessionState(
            model=model,
            provider="",
            vendor="",
            api_key=None,
            graph=None,
            llm=None,
            tools=tools,
            skill_context=skill_context,
            session_id=f"cli-{os.urandom(4).hex()}",
            mode=mode,
            skills=skills,
            semantic_memory=semantic_memory,
            web_search=web_search,
            tool_count=len(tools),
            skills_count=len(skills),
            mcp_count=0,
        )
        asyncio.run(run_repl(state, provider_warning=None))
        return

    # API key present → normal flow (no automatic health check at startup)
    catalog = load_catalog()
    if provider not in catalog:
        vendor = provider

    state = _build_initial_state(
        model=model,
        provider=provider,
        vendor=vendor,
        api_key=api_key,
        skills=skills,
        semantic_memory=semantic_memory,
        web_search=web_search,
        mode=mode,
    )

    from sparta_ai.tools.terminal_tools import set_execute_local
    set_execute_local(True)

    provider_warning = None
    if state.graph is None:
        provider_warning = (
            f"No se pudo inicializar el provider '{provider}'. "
            "Usá /provider para configurar uno válido."
        )

    asyncio.run(run_repl(state, provider_warning=provider_warning))


def _build_initial_state(
    model: str,
    provider: str,
    vendor: str,
    api_key: str | None,
    skills: list[str],
    semantic_memory: bool,
    web_search: bool,
    mode: str,
) -> SessionState:
    """Build the initial SessionState with tools, graph, etc."""
    from sparta_ai.agents.sparta_agent import build_sparta_graph
    from sparta_ai.config.providers import build_llm
    from sparta_ai.persistence.sqlite_store import get_checkpointer

    tools, skill_context = _build_tools_only(skills, web_search)

    llm = None
    graph = None
    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        checkpointer = loop.run_until_complete(get_checkpointer())
        llm = build_llm(
            model=model,
            provider=provider,
            vendor=vendor,
            api_key=api_key,
            reasoning_enabled=True,
            reasoning_budget=8000,
        )
        graph = build_sparta_graph(
            llm=llm,
            tools=tools,
            skill_context=skill_context,
            memory_context="",
            checkpointer=checkpointer,
        )
        loop.close()
    except Exception as e:
        console.print(
            f"[{WARNING}]⚠ No se pudo inicializar el provider: {e}[/{WARNING}]"
        )

    return SessionState(
        model=model,
        provider=provider,
        vendor=vendor,
        api_key=api_key,
        graph=graph,
        llm=llm,
        tools=tools,
        skill_context=skill_context,
        session_id=f"cli-{os.urandom(4).hex()}",
        mode=mode,
        skills=skills,
        semantic_memory=semantic_memory,
        web_search=web_search,
        tool_count=len(tools),
        skills_count=len(skills),
        mcp_count=0,
    )


def main() -> None:
    typer.run(repl)


if __name__ == "__main__":
    main()
