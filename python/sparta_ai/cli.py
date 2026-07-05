"""Sparta CLI — REPL with LangGraph agent via prompt_toolkit + Rich."""

import asyncio
import json
import logging
import os
import sys
from typing import Any

import typer
from rich.console import Console
from rich.live import Live
from rich.markdown import Markdown
from rich.panel import Panel
from rich.syntax import Syntax
from rich.text import Text

from sparta_ai.tools.terminal_tools import set_execute_local

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
app = typer.Typer(name="sparta", help="Sparta Agent CLI — REPL with LangGraph agent", no_args_is_help=True)

DEFAULT_MODEL = "claude-sonnet-4-6"
DEFAULT_PROVIDER = "anthropic"
DEFAULT_VENDOR = "anthropic"
HISTORY_FILE = os.path.expanduser("~/.sparta_cli_history")


def _get_api_key(provider_key: str | None) -> str | None:
    if provider_key:
        return provider_key
    for var in ("ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY"):
        val = os.environ.get(var)
        if val:
            return val
    return None


def _block_text(block: dict) -> str:
    if isinstance(block, dict):
        if block.get("type") == "text":
            return block.get("text", "")
        if block.get("type") in ("thinking", "reasoning"):
            return block.get("text") or block.get("thinking", "") or block.get("reasoning", "") or ""
        if "text" in block:
            return str(block["text"])
    return ""


async def _stream_to_cli(graph: Any, initial_state: dict, thread_id: str) -> None:
    config = {"configurable": {"thread_id": thread_id}}
    buffer = ""
    thinking_text = ""
    tool_name = ""
    tool_input = ""

    with Live(console=console, refresh_per_second=10, vertical_overflow="visible") as live:
        try:
            async for event in graph.astream_events(initial_state, config, version="v2"):
                kind = event.get("event", "")
                data: dict = event.get("data", {})
                name: str = event.get("name", "")

                if kind == "on_chat_model_stream":
                    chunk = data.get("chunk")
                    if chunk is None:
                        continue
                    content = getattr(chunk, "content", "")
                    if isinstance(content, list):
                        for block in content:
                            if isinstance(block, dict):
                                if block.get("type") in ("thinking", "reasoning"):
                                    t = _block_text(block)
                                    if t:
                                        thinking_text += t
                                elif block.get("type") == "text":
                                    t = _block_text(block)
                                    if t:
                                        buffer += t
                    elif isinstance(content, str) and content:
                        buffer += content

                elif kind == "on_tool_start":
                    inp = data.get("input", {})
                    tool_name = name
                    tool_input = json.dumps(inp, indent=2, ensure_ascii=False) if isinstance(inp, dict) else str(inp)

                elif kind == "on_tool_end":
                    output = data.get("output", "")
                    if tool_name:
                        out_str = str(output)
                        content = Syntax(out_str[:2000], "text", word_wrap=True) if len(out_str) < 2000 else Text(out_str[:2000] + "...")
                        live.update(Panel(content, title=f"[bold]{tool_name}[/bold]", border_style="dim cyan", padding=(0, 1)))
                        await asyncio.sleep(0.05)
                    tool_name = ""
                    tool_input = ""

                elif kind == "on_tool_error":
                    err = data.get("error", "Unknown error")
                    live.update(Panel(f"[red]{err}[/red]", title="[red]Tool Error[/red]"))
                    await asyncio.sleep(0.05)

                renderables = []
                if thinking_text:
                    renderables.append(Text(f"── {thinking_text}", style="dim italic"))
                if buffer:
                    renderables.append(Markdown(buffer))
                if tool_name:
                    inp_body = Syntax(tool_input, "json", word_wrap=True) if tool_input.startswith("{") else Text(tool_input)
                    renderables.append(Panel(inp_body, title=f"[cyan]{tool_name}[/cyan]", border_style="dim"))

                if renderables:
                    border = "cyan" if tool_name else "green"
                    live.update(Panel(*renderables, border_style=border))
                else:
                    live.update(Text("⏳ pensando...", style="dim"))

        except Exception as e:
            live.update(Panel(f"[red]Error: {e}[/red]", title="Stream Error"))

    if buffer:
        console.print(Markdown(buffer))
    elif thinking_text and not buffer:
        console.print(Text(f"(solo razonamiento, sin respuesta visible)\n{thinking_text}", style="dim"))


async def _run_repl(
    model: str, provider: str, vendor: str, api_key: str,
    skills: list[str], semantic_memory: bool, web_search: bool, mode: str,
) -> None:
    from sparta_ai.agents.sparta_agent import build_sparta_graph
    from sparta_ai.config.providers import build_llm
    from sparta_ai.persistence.sqlite_store import get_checkpointer
    from sparta_ai.skills.skill_loader import build_skills_context
    from sparta_ai.tools.file_tools import read_file_tool, write_file_tool
    from sparta_ai.tools.memory_tools import read_memory_tool, write_memory_tool
    from sparta_ai.tools.skill_tools import skill_view_tool, skills_list_tool, skill_manage_tool
    from sparta_ai.tools.terminal_tools import terminal_execute_tool, terminal_execute_background_tool
    from sparta_ai.tools.web_search import web_search_tool

    skill_context = build_skills_context(skills) if skills else ""
    llm = build_llm(model=model, provider=provider, vendor=vendor, api_key=api_key, reasoning_enabled=True, reasoning_budget=8000)

    tools = [
        read_memory_tool, write_memory_tool, read_file_tool, write_file_tool,
        skill_view_tool, skills_list_tool, skill_manage_tool,
        terminal_execute_tool, terminal_execute_background_tool,
    ]
    if web_search:
        tools.insert(0, web_search_tool)

    checkpointer = await get_checkpointer()
    graph = build_sparta_graph(llm=llm, tools=tools, skill_context=skill_context, memory_context="", checkpointer=checkpointer)

    session_id = f"cli-{os.urandom(4).hex()}"
    messages: list[dict] = []

    console.print(Panel.fit(
        "[bold green]Sparta CLI[/bold green]\n"
        f"Modelo: {model} | Provider: {provider}\n"
        "Comandos: /exit /clear /model <name> /help",
        border_style="green",
    ))

    try:
        from prompt_toolkit import PromptSession
        from prompt_toolkit.history import FileHistory
        from prompt_toolkit.auto_suggest import AutoSuggestFromHistory
        from prompt_toolkit.completion import WordCompleter
        psession = PromptSession(
            history=FileHistory(HISTORY_FILE),
            auto_suggest=AutoSuggestFromHistory(),
            completer=WordCompleter([
                "/exit", "/clear", "/model", "/help",
                "ls", "cd", "cat", "echo", "git", "npm", "python",
            ], ignore_case=True),
        )
        use_prompt_toolkit = True
    except ImportError:
        psession = None
        use_prompt_toolkit = False

    while True:
        try:
            if use_prompt_toolkit and psession:
                user_input = await psession.prompt_async("╰─> ")
            else:
                user_input = await asyncio.get_event_loop().run_in_executor(None, lambda: input("> "))
        except (EOFError, KeyboardInterrupt):
            console.print("\n[yellow]Adiós[/yellow]")
            break

        if not user_input or not user_input.strip():
            continue

        cmd = user_input.strip().lower()
        if cmd == "/exit":
            break
        elif cmd == "/clear":
            console.clear()
            continue
        elif cmd.startswith("/model"):
            parts = user_input.split(maxsplit=1)
            if len(parts) > 1:
                model = parts[1]
                console.print(f"[dim]Modelo cambiado a: {model}[/dim]")
                llm = build_llm(model=model, provider=provider, vendor=vendor, api_key=api_key, reasoning_enabled=True, reasoning_budget=8000)
                graph = build_sparta_graph(llm=llm, tools=tools, skill_context=skill_context, memory_context="", checkpointer=checkpointer)
            continue
        elif cmd == "/help":
            console.print(Panel.fit(
                "[bold]Comandos:[/bold]\n  /exit           Salir\n"
                "  /clear          Limpiar pantalla\n"
                "  /model <name>   Cambiar modelo\n"
                "  /help           Esta ayuda\n\n"
                "Cualquier otro texto se envía al agente.",
                border_style="yellow",
            ))
            continue

        messages.append({"role": "user", "content": user_input})
        initial_state = {
            "messages": messages,
            "session_id": session_id,
            "mode": mode,
            "active_skills": skills,
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
        await _stream_to_cli(graph, initial_state, thread_id=session_id)
        messages.append({"role": "assistant", "content": "(respuesta mostrada arriba)"})


@app.command()
def repl(
    model: str = typer.Option(DEFAULT_MODEL, "--model", "-m", help="Model name"),
    provider: str = typer.Option(DEFAULT_PROVIDER, "--provider", "-p", help="Provider"),
    vendor: str = typer.Option(DEFAULT_VENDOR, "--vendor", "-v", help="Vendor"),
    provider_key: str = typer.Option(None, "--key", "-k", help="API key (or env var)"),
    skills: list[str] = typer.Option([], "--skill", help="Active skill IDs"),
    semantic_memory: bool = typer.Option(False, "--memory", help="Enable semantic memory"),
    web_search: bool = typer.Option(True, "--web/--no-web", help="Enable web search"),
    mode: str = typer.Option("chat", "--mode", help="Agent mode (chat|architect|auto)"),
):
    """Start an interactive REPL session with the Sparta agent."""
    api_key = _get_api_key(provider_key)
    if not api_key:
        console.print("[red]Error: No API key found. Set ANTHROPIC_API_KEY / OPENAI_API_KEY / GOOGLE_API_KEY or pass --key[/red]")
        raise typer.Exit(1)

    set_execute_local(True)
    asyncio.run(_run_repl(model, provider, vendor, api_key, skills, semantic_memory, web_search, mode))


def main() -> None:
    app()


if __name__ == "__main__":
    main()
