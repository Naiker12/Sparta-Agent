"""
/model slash-command — change the active model.

Usage:  /model <name>
        /model gpt-4o
        /model claude-opus-4-6
"""

from __future__ import annotations

from rich.console import Console

from sparta_ai.cli.commands.base import Command
from sparta_ai.cli.commands.registry import CommandRegistry
from sparta_ai.cli.theme import DIM, SUCCESS, WARNING

console = Console()


async def _cmd_model(state: "SessionState", args: str) -> None:
    """Switch the active model and rebuild the graph."""
    from sparta_ai.config.providers import build_llm
    from sparta_ai.agents.sparta_agent import build_sparta_graph
    from sparta_ai.persistence.sqlite_store import get_checkpointer

    parts = args.strip().split(maxsplit=1)
    if not parts:
        console.print(f"[{WARNING}]Usage: /model <name>[/{WARNING}]")
        console.print(f"[{DIM}]Current: {state.model}[/{DIM}]")
        return

    new_model = parts[0]
    console.print(f"[{DIM}]Modelo cambiado a: {new_model}[/{DIM}]")
    try:
        llm = build_llm(
            model=new_model,
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
        state.model = new_model
        state.llm = llm
        state.graph = graph
        console.print(f"[{SUCCESS}]✓ Modelo: {new_model}[/{SUCCESS}]")
    except Exception as e:
        console.print(f"[{WARNING}]⚠ Error al cambiar modelo: {e}[/{WARNING}]")


def register_model_command(registry: CommandRegistry) -> None:
    """Register /model."""
    registry.register(Command(
        name="/model",
        aliases=["/m"],
        summary="Cambiar el modelo activo",
        help_text="Cambia el modelo del agente. Uso: /model <nombre>",
        handler=_cmd_model,
    ))