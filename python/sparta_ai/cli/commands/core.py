"""
Core slash-commands: /exit, /clear, /help.

These used to live as individual elif branches in the REPL loop.
"""

from __future__ import annotations

from rich.console import Console
from rich.panel import Panel

from sparta_ai.cli.commands.base import Command
from sparta_ai.cli.commands.registry import CommandRegistry
from sparta_ai.cli.theme import WARNING

console = Console()


async def _cmd_exit(state: "SessionState", args: str) -> None:
    """Exit the REPL."""
    # Signal the REPL loop by raising a special exception. The loop
    # catches this to break out cleanly.
    raise SystemExit(0)


async def _cmd_clear(state: "SessionState", args: str) -> None:
    """Clear the terminal screen."""
    console.clear()


async def _cmd_help(state: "SessionState", args: str) -> None:
    """Show the help panel."""
    from sparta_ai.cli.commands.registry import CommandRegistry

    # If the registry is available via the state (set during REPL init), use it.
    # Otherwise show the static help.
    console.print(Panel.fit(
        "[bold]Comandos:[/bold]\n"
        "  /exit             Salir\n"
        "  /clear            Limpiar pantalla\n"
        "  /model <name>     Cambiar modelo\n"
        "  /provider         Cambiar provider/key\n"
        "  /help             Esta ayuda\n\n"
        "Alt+Enter o Ctrl+Enter para nueva línea.\n"
        "Cualquier otro texto se envía al agente.",
        border_style=WARNING,
    ))


def register_core_commands(registry: CommandRegistry) -> None:
    """Register /exit, /clear, /help."""
    registry.register(Command(
        name="/exit",
        aliases=["/quit"],
        summary="Salir del REPL",
        help_text="Termina la sesión interactiva.",
        handler=_cmd_exit,
    ))
    registry.register(Command(
        name="/clear",
        summary="Limpiar la pantalla",
        help_text="Borra el contenido de la terminal.",
        handler=_cmd_clear,
    ))
    registry.register(Command(
        name="/help",
        aliases=["/?"],
        summary="Ver todos los comandos",
        help_text="Muestra la lista completa de comandos disponibles.",
        handler=_cmd_help,
    ))