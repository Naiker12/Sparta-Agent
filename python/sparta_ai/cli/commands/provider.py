"""
/provider slash-command — interactive provider/key/model selection.

Usage:  /provider
"""

from __future__ import annotations

from rich.console import Console

from sparta_ai.cli.commands.base import Command
from sparta_ai.cli.commands.registry import CommandRegistry
from sparta_ai.cli.theme import SUCCESS, WARNING

console = Console()


async def _cmd_provider(state: "SessionState", args: str) -> None:
    """Run the interactive provider setup and rebuild the graph."""
    from sparta_ai.cli.providers.setup import provider_setup_flow
    from sparta_ai.config.providers import build_llm
    from sparta_ai.agents.sparta_agent import build_sparta_graph
    from sparta_ai.persistence.sqlite_store import get_checkpointer

    new_provider, new_vendor, new_model, new_key = await provider_setup_flow(
        initial_provider=state.provider,
        initial_key=state.api_key,
    )
    state.provider = new_provider
    state.vendor = new_vendor
    state.model = new_model
    if new_key:
        state.api_key = new_key

    try:
        llm = build_llm(
            model=state.model,
            provider=state.provider,
            vendor=state.vendor,
            api_key=state.api_key,
            reasoning_enabled=True,
            reasoning_budget=8000,
        )
        checkpointer = await get_checkpointer()
        graph = build_sparta_graph(
            llm=llm,
            tools=state.tools,
            skill_context=state.skill_context,
            memory_context="",
            checkpointer=checkpointer,
        )
        state.llm = llm
        state.graph = graph
        console.print(
            f"[{SUCCESS}]✓ Provider: {state.provider} ({state.vendor}) — "
            f"Modelo: {state.model}[/{SUCCESS}]"
        )
    except Exception as e:
        console.print(f"[{WARNING}]⚠ Error al conectar: {e}[/{WARNING}]")
        state.graph = None


def register_provider_command(registry: CommandRegistry) -> None:
    """Register /provider."""
    registry.register(Command(
        name="/provider",
        aliases=["/p"],
        summary="Cambiar de proveedor / API key",
        help_text="Abre el selector interactivo de proveedor, modelo y API key.",
        handler=_cmd_provider,
    ))