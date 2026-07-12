"""
REPL loop — the core interactive session (v2 redesign).

Design principles (OpenCode + Hermes):
  - Minimal, clean layout with single gold accent
  - Every turn is a clearly delimited block with header + footer
  - No ``end=""`` before ``Live()`` — that caused the "first char eaten" bug
  - No ``Text()`` with raw markup strings — always ``console.print()`` with inline markup
  - Bottom toolbar via ``prompt_toolkit`` ``HTML()`` (not Rich markup)
  - Provider warning is persistent (shown every turn when graph is None)
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime

from rich.console import Console
from rich.rule import Rule

from sparta_ai.cli.banner import print_welcome_banner, build_provider_warning
from sparta_ai.cli.commands import build_registry, CommandRegistry
from sparta_ai.cli.completion import SlashCommandCompleter
from sparta_ai.cli.session.state import SessionState
from sparta_ai.cli.streaming.renderer import StreamRenderer
from sparta_ai.cli.theme import ACCENT, ACCENT_DIM, MUTED, WARNING, DIM

console = Console()

HISTORY_FILE = os.path.expanduser("~/.sparta_cli_history")


async def run_repl(
    state: SessionState,
    *,
    provider_warning: str | None = None,
) -> None:
    """Main REPL loop. Uses a CommandRegistry for slash-commands."""

    # ── 0. Track last turn timing ────────────────────────────────────
    last_turn_elapsed: float = 0.0
    last_turn_tool_count: int = 0

    # ── 1. Build the command registry ──────────────────────────────
    registry = build_registry()
    _attach_registry_to_help(state, registry)

    # ── 2. Set up prompt_toolkit with bottom toolbar ───────────────
    use_prompt_toolkit = False
    psession = None
    try:
        from prompt_toolkit import PromptSession
        from prompt_toolkit.history import FileHistory
        from prompt_toolkit.auto_suggest import AutoSuggestFromHistory
        from prompt_toolkit.key_binding import KeyBindings
        from prompt_toolkit.completion import CompleteStyle
        from prompt_toolkit.formatted_text import HTML

        kb = KeyBindings()

        @kb.add("escape", "enter")
        def _alt_enter(event):
            event.app.current_buffer.insert_text("\n")

        @kb.add("c-j")
        def _ctrl_j(event):
            event.app.current_buffer.insert_text("\n")

        def _bottom_toolbar():
            """Render the persistent bottom status bar.

            Uses ``prompt_toolkit.formatted_text.HTML`` — NOT Rich markup.
            Rich's ``[bold ...]`` would show as raw text here (see v2 spec 6.4).
            """
            model_short = state.model_short()
            provider_label = state.provider

            parts = [f"<b>{provider_label}:{model_short}</b>"]
            if state.turn_count > 0:
                parts.append(f"turno {state.turn_count}")
            if last_turn_elapsed > 0:
                mins, secs = divmod(int(last_turn_elapsed), 60)
                elapsed_str = f"{mins}m {secs}s" if mins else f"{secs}s"
                parts.append(elapsed_str)
            if last_turn_tool_count > 0:
                tc = last_turn_tool_count
                parts.append(f"{tc} tool{'s' if tc != 1 else ''}")
            if state.graph is None:
                parts.append('<ansired>⚠ sin provider</ansired>')
            parts.append("/help")
            return HTML("  " + " · ".join(parts))

        psession = PromptSession(
            history=FileHistory(HISTORY_FILE),
            auto_suggest=AutoSuggestFromHistory(),
            completer=SlashCommandCompleter(registry),
            complete_while_typing=True,
            complete_style=CompleteStyle.MULTI_COLUMN,
            key_bindings=kb,
            multiline=True,
            bottom_toolbar=_bottom_toolbar,
        )
        use_prompt_toolkit = True
    except ImportError:
        psession = None
        use_prompt_toolkit = False

    # ── 3. Show welcome banner ─────────────────────────────────────
    print_welcome_banner(
        console,
        model=state.model,
        provider=state.provider,
        session_id=state.session_id,
        tool_count=state.tool_count,
        cwd=os.getcwd(),
        tools=state.tools,
        skills_count=state.skills_count,
        mcp_count=state.mcp_count,
        provider_warning=provider_warning,
    )

    # ── 4. Main loop ───────────────────────────────────────────────
    renderer = StreamRenderer()

    while True:
        try:
            if use_prompt_toolkit and psession:
                user_input = await psession.prompt_async("› ")
            else:
                user_input = await asyncio.get_event_loop().run_in_executor(
                    None, lambda: input("> ")
                )
        except SystemExit:
            console.print(f"\n[{WARNING}]Adiós[/{WARNING}]")
            break
        except (EOFError, KeyboardInterrupt):
            console.print(f"\n[{WARNING}]Adiós[/{WARNING}]")
            break

        if not user_input or not user_input.strip():
            continue

        # ── 4a. Slash-command dispatch ─────────────────────────────
        cmd = registry.resolve(user_input)
        if cmd is not None:
            try:
                args_part = _extract_args(user_input, cmd.name)
                await cmd.execute(state, args_part)
            except SystemExit:
                break
            except Exception as e:
                console.print(f"[red]Error ejecutando {cmd.name}: {e}[/red]")
            continue

        # ── 4b. Agent turn ─────────────────────────────────────────
        # Do NOT increment turn_count if graph is None (v2 spec 5.3)
        if state.graph is None:
            warning = build_provider_warning(
                "No hay provider configurado. Usá /provider para configurar uno."
            )
            console.print(warning)
            console.print()
            continue

        state.turn_count += 1

        # ── Echo user message (v2 spec 5.2) ────────────────────────
        # Uses console.print() with inline markup — NO Text() with raw markup (v2 6.1)
        ts = datetime.now().strftime("%H:%M:%S")
        console.print()
        console.print(Rule(style=ACCENT_DIM))
        console.print(f"[bold {ACCENT}]tú[/]           [dim {MUTED}]{ts}[/]")
        console.print(f"[dim]{user_input}[/]")
        console.print()

        # ── Build initial state and stream ─────────────────────────
        state.messages.append({"role": "user", "content": user_input})
        initial_state = {
            "messages": state.messages,
            "session_id": state.session_id,
            "mode": state.mode,
            "active_skills": state.skills,
            "memory_context": "",
            "thinking_tokens": 0,
            "tool_calls_this_turn": 0,
            "subagent_results": [],
            "pending_human_input": None,
            "abort_requested": False,
            "plan": [],
            "current_step": 0,
            "plan_complete": False,
            "reflection_retries": 0,
        }

        # ── Agent header (v2 spec 5.4) ─────────────────────────────
        model_short = state.model_short()
        console.print(f"[bold cyan]sparta · {model_short}[/]")

        # ── Stream the response (v2 spec 5.5) ──────────────────────
        # Live() starts on a clean new line — no end="" before it (v2 6.2)
        result = await renderer.stream(
            state.graph, initial_state, thread_id=state.session_id
        )

        # ── Update timing for toolbar ──────────────────────────────
        last_turn_elapsed = result.get("elapsed", 0.0)
        last_turn_tool_count = result.get("tool_count", 0)

        # ── Closing summary (v2 spec 5.6) ──────────────────────────
        elapsed = last_turn_elapsed
        tc = last_turn_tool_count
        mins, secs = divmod(int(elapsed), 60)
        elapsed_str = f"{mins}m {secs}s" if mins else f"{secs}s"

        summary = f"[dim]sparta · {model_short}[/]   [dim {MUTED}]{elapsed_str}[/]"
        if tc > 0:
            summary += f" · [dim {MUTED}]{tc} tool{'s' if tc != 1 else ''}[/]"
        console.print(summary)

        # ── Turn separator (v2 spec 5.7) ───────────────────────────
        console.print(Rule(style=ACCENT_DIM))
        console.print()

        state.messages.append(
            {"role": "assistant", "content": "(respuesta mostrada arriba)"}
        )


def _extract_args(raw_input: str, cmd_name: str) -> str:
    """Return everything after the command name in *raw_input*."""
    prefix = cmd_name
    rest = raw_input.strip()
    if rest.startswith(prefix):
        rest = rest[len(prefix) :].strip()
    return rest


def _attach_registry_to_help(state: SessionState, registry: CommandRegistry) -> None:
    """Stash the registry on the state so /help can build a dynamic list."""
    state._registry = registry  # type: ignore[attr-defined]