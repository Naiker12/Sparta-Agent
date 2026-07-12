"""Sparta CLI — REPL with LangGraph agent via prompt_toolkit + Rich."""

import asyncio
import json
import logging
import os
import shutil
import sys
import time
from typing import Any

import typer
from rich.console import Console
from rich.live import Live
from rich.markdown import Markdown
from rich.panel import Panel
from rich.table import Table
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

SPARTA_LOGO = """[#CD7F32]  _____ _             _   _____                _           [/]
[#CD7F32] / ____| |           | | |  __ \\              | |          [/]
[#FFBF00]| (___ | |__  _   _ _| | | |__) |_ _ _ __   __| | ___ _ __ [/]
[#FFBF00] \\___ \\| '_ \\| | | | __| |  _  / _` | '_ \\ / _` |/ _ \\ '__|[/]
[#FFD700] ____) | | | | |_| | |_| | | \\ \\ (_| | | | | (_| |  __/ |   [/]
[#FFD700]|_____/|_| |_|\\__, |\\__|_|_|  \\ \\__,_|_| |_|\\__,_|\\___|_|   [/]
[#FFD700]              __/ |             _/ |                         [/]
[#CD7F32]             |___/             |__/                          [/]"""


def _build_welcome_banner(model: str, provider: str, session_id: str,
                          tool_count: int, cwd: str) -> Panel:
    """Build a rich welcome banner with logo, model info, and tool summary."""
    term_width = shutil.get_terminal_size().columns

    parts = []

    if term_width >= 65:
        parts.append(SPARTA_LOGO)
        parts.append("")

    model_short = model.split("/")[-1] if "/" in model else model
    if len(model_short) > 28:
        model_short = model_short[:25] + "..."

    info = Table.grid(padding=(0, 4))
    info.add_column("left", justify="left", no_wrap=True)
    info.add_column("right", justify="left", no_wrap=True)
    info.add_column("right2", justify="left", no_wrap=True)

    left = (
        f"[bold #FFD700]{model_short}[/]\n"
        f"[#B8860B]{cwd}[/]\n"
        f"[dim #8B8682]Provider: {provider}[/]\n"
        f"[dim #8B8682]Session: {session_id}[/]"
    )
    mid = (
        f"[bold #FFD700]Tools[/]\n"
        f"[#B8860B]{tool_count} available[/]\n"
        f"\n"
        f"[bold #FFD700]Commands[/]"
    )
    right = (
        f"\n"
        f"\n"
        f"\n"
        f"[#B8860B]/help /model /provider /clear /exit[/]"
    )

    info.add_row(left, mid, right)
    parts.append(info)

    footer = Table.grid(padding=(0, 0))
    footer.add_column("f", justify="center")
    footer.add_row("[dim #8B8682]Alt+Enter newline · /help commands · /provider config[/]")
    parts.append("")
    parts.append(footer)

    from rich.console import Group
    inner = Group(*parts)

    return Panel(
        inner,
        title=f"[bold #FFD700]Sparta Agent[/] [dim #B8860B]v0.1.0[/]",
        border_style="#CD7F32",
        padding=(0, 2),
    )

PROVIDER_REGISTRY: dict[str, dict[str, Any]] = {
    "anthropic":  {"env": "ANTHROPIC_API_KEY",  "vendors": ["anthropic"], "models": ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"]},
    "openai":     {"env": "OPENAI_API_KEY",     "vendors": ["openai"],    "models": ["gpt-4o", "gpt-4o-mini", "o3", "o3-mini"]},
    "google":     {"env": "GOOGLE_API_KEY",     "vendors": ["google", "google_genai", "gemini"], "models": ["gemini-2.5-pro", "gemini-2.5-flash"]},
    "ollama":     {"env": None,                  "vendors": ["ollama"],    "models": ["llama3.1", "qwen2.5", "mistral"]},
    "deepseek":   {"env": "DEEPSEEK_API_KEY",   "vendors": ["deepseek"],  "models": ["deepseek-chat", "deepseek-reasoner"]},
    "openrouter": {"env": "OPENROUTER_API_KEY",  "vendors": ["openrouter"], "models": []},
    "groq":       {"env": "GROQ_API_KEY",        "vendors": ["groq"],      "models": ["llama-3.3-70b-versatile"]},
    "mistral":    {"env": "MISTRAL_API_KEY",     "vendors": ["mistral"],   "models": ["mistral-large-latest"]},
    "lmstudio":   {"env": None,                  "vendors": ["lmstudio"],  "models": []},
    "llamacpp":   {"env": None,                  "vendors": ["llamacpp"],  "models": []},
}


def _get_api_key(provider_key: str | None) -> str | None:
    if provider_key:
        return provider_key
    for var in ("ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY"):
        val = os.environ.get(var)
        if val:
            return val
    return None


async def _configure_provider(
    initial_provider: str | None = None,
    initial_key: str | None = None,
) -> tuple[str, str, str, str | None]:
    """Interactive provider configuration. Returns (provider, vendor, model, api_key)."""
    from prompt_toolkit import PromptSession
    from prompt_toolkit.completion import WordCompleter

    psession = PromptSession(completer=WordCompleter(list(PROVIDER_REGISTRY.keys()), ignore_case=True))

    providers = list(PROVIDER_REGISTRY.keys())

    table = Table(title="Providers Disponibles", border_style="#CD7F32", title_style="bold #FFD700")
    table.add_column("#", style="bold #FFD700", width=3)
    table.add_column("Provider", style="bold")
    table.add_column("Estado", justify="left")
    table.add_column("Modelos", style="dim")

    for i, name in enumerate(providers, 1):
        info = PROVIDER_REGISTRY[name]
        has_key = bool(info["env"] and os.environ.get(info["env"]))
        local = info["env"] is None
        if has_key:
            status = "[green]✓ configurado[/]"
        elif local:
            status = "[dim]local (sin key)[/]"
        else:
            status = "[yellow]sin key[/]"
        models = ", ".join(info["models"][:2]) if info["models"] else "custom"
        if len(info["models"]) > 2:
            models += f" +{len(info['models']) - 2}"
        table.add_row(str(i), name, status, models)

    console.print()
    console.print(table)
    console.print()

    while True:
        try:
            raw = await psession.prompt_async("[#FFD700]Provider#[/] > ")
        except (EOFError, KeyboardInterrupt):
            console.print("\n[yellow]Cancelado[/yellow]")
            raise typer.Exit(0)

        raw = raw.strip()
        if not raw:
            continue

        if raw.isdigit() and 1 <= int(raw) <= len(providers):
            selected = providers[int(raw) - 1]
            break
        if raw.lower() in PROVIDER_REGISTRY:
            selected = raw.lower()
            break
        console.print(f"[red]Opción inválida: {raw}[/red]")

    info = PROVIDER_REGISTRY[selected]
    vendor = info["vendors"][0]
    models = info["models"]
    model = models[0] if models else "default"

    api_key = initial_key
    if info["env"]:
        env_val = os.environ.get(info["env"])
        if env_val:
            api_key = env_val
            console.print(f"[green]✓ {info['env']} encontrado en entorno[/green]")
        else:
            console.print(f"[yellow]No se encontró {info['env']}[/yellow]")
            try:
                key_input = await psession.prompt_async("API Key> ", is_password=True)
            except (EOFError, KeyboardInterrupt):
                console.print("\n[yellow]Cancelado[/yellow]")
                raise typer.Exit(0)
            api_key = key_input.strip() if key_input else None

    if models and len(models) > 1:
        model_table = Table(title=f"Modelos — {selected}", border_style="#CD7F32", title_style="bold #FFD700")
        model_table.add_column("#", style="bold #FFD700", width=3)
        model_table.add_column("Modelo", style="bold")
        for i, m in enumerate(models, 1):
            model_table.add_row(str(i), m)
        console.print()
        console.print(model_table)
        console.print()
        try:
            model_raw = await psession.prompt_async(f"Modelo #{1}> ")
        except (EOFError, KeyboardInterrupt):
            model_raw = ""
        model_raw = model_raw.strip()
        if model_raw.isdigit() and 1 <= int(model_raw) <= len(models):
            model = models[int(model_raw) - 1]
        elif model_raw and model_raw in models:
            model = model_raw

    console.print(f"\n[green]✓ Provider: {selected} | Vendor: {vendor} | Modelo: {model}[/green]\n")
    return selected, vendor, model, api_key


def _block_text(block: dict) -> str:
    if isinstance(block, dict):
        if block.get("type") == "text":
            return block.get("text", "")
        if block.get("type") in ("thinking", "reasoning"):
            return block.get("text") or block.get("thinking", "") or block.get("reasoning", "") or ""
        if "text" in block:
            return str(block["text"])
    return ""


async def _stream_to_cli(graph: Any, initial_state: dict, thread_id: str) -> dict:
    """Stream agent response to CLI. Returns timing/token metadata."""
    config = {"configurable": {"thread_id": thread_id}}
    buffer = ""
    thinking_text = ""
    tool_name = ""
    tool_input = ""
    tool_count = 0
    start_time = time.time()

    with Live(console=console, refresh_per_second=12, vertical_overflow="visible") as live:
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
                    tool_count += 1

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
                    renderables.append(Text(f"── {thinking_text[-200:]}", style="dim italic"))
                if buffer:
                    renderables.append(Markdown(buffer))
                if tool_name:
                    inp_body = Syntax(tool_input, "json", word_wrap=True) if tool_input.startswith("{") else Text(tool_input)
                    renderables.append(Panel(inp_body, title=f"[cyan]{tool_name}[/cyan]", border_style="dim"))

                if renderables:
                    border = "cyan" if tool_name else "green"
                    live.update(Panel(*renderables, border_style=border))
                else:
                    elapsed = time.time() - start_time
                    live.update(Text(f"⏳ pensando... ({elapsed:.0f}s)", style="dim"))

        except Exception as e:
            live.update(Panel(f"[red]Error: {e}[/red]", title="Stream Error"))

    elapsed = time.time() - start_time

    if buffer:
        console.print(Markdown(buffer))
    elif thinking_text and not buffer:
        console.print(Text(f"(solo razonamiento, sin respuesta visible)\n{thinking_text}", style="dim"))

    if tool_count > 0 or elapsed > 1.0:
        status_parts = []
        if elapsed >= 1.0:
            mins, secs = divmod(int(elapsed), 60)
            status_parts.append(f"{mins}m {secs}s" if mins else f"{secs}s")
        if tool_count:
            status_parts.append(f"{tool_count} tool{'s' if tool_count != 1 else ''}")
        console.print(Text(f"  {' · '.join(status_parts)}", style="dim"))

    return {"elapsed": elapsed, "tool_count": tool_count, "has_response": bool(buffer)}


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

    tools = [
        read_memory_tool, write_memory_tool, read_file_tool, write_file_tool,
        skill_view_tool, skills_list_tool, skill_manage_tool,
        terminal_execute_tool, terminal_execute_background_tool,
    ]
    if web_search:
        tools.insert(0, web_search_tool)

    checkpointer = await get_checkpointer()

    llm = None
    graph = None
    try:
        llm = build_llm(model=model, provider=provider, vendor=vendor, api_key=api_key, reasoning_enabled=True, reasoning_budget=8000)
        graph = build_sparta_graph(llm=llm, tools=tools, skill_context=skill_context, memory_context="", checkpointer=checkpointer)
    except Exception as e:
        console.print(f"[yellow]⚠ No se pudo inicializar el provider: {e}[/yellow]")
        console.print("[dim]Usá /provider para configurar un provider válido.[/dim]")

    session_id = f"cli-{os.urandom(4).hex()}"
    messages: list[dict] = []
    turn_count = 0

    banner = _build_welcome_banner(model, provider, session_id, len(tools), os.getcwd())
    console.print()
    console.print(banner)
    if graph is None:
        console.print("[yellow]⚠ Provider no disponible. Usá /provider para configurar.[/yellow]")
    console.print()

    try:
        from prompt_toolkit import PromptSession
        from prompt_toolkit.history import FileHistory
        from prompt_toolkit.auto_suggest import AutoSuggestFromHistory
        from prompt_toolkit.completion import WordCompleter
        from prompt_toolkit.key_binding import KeyBindings

        kb = KeyBindings()

        @kb.add("escape", "enter")
        def _alt_enter(event):
            event.app.current_buffer.insert_text("\n")

        @kb.add("c-j")
        def _ctrl_j(event):
            event.app.current_buffer.insert_text("\n")

        psession = PromptSession(
            history=FileHistory(HISTORY_FILE),
            auto_suggest=AutoSuggestFromHistory(),
            completer=WordCompleter([
                "/exit", "/clear", "/model", "/provider", "/help",
                "ls", "cd", "cat", "echo", "git", "npm", "python",
            ], ignore_case=True),
            key_bindings=kb,
            multiline=True,
        )
        use_prompt_toolkit = True
    except ImportError:
        psession = None
        use_prompt_toolkit = False

    while True:
        try:
            if use_prompt_toolkit and psession:
                prompt_text = f"[{provider}:{model.split('/')[-1]}] > "
                user_input = await psession.prompt_async(prompt_text)
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
                try:
                    llm = build_llm(model=model, provider=provider, vendor=vendor, api_key=api_key, reasoning_enabled=True, reasoning_budget=8000)
                    graph = build_sparta_graph(llm=llm, tools=tools, skill_context=skill_context, memory_context="", checkpointer=checkpointer)
                except Exception as e:
                    console.print(f"[yellow]⚠ Error al cambiar modelo: {e}[/yellow]")
            continue
        elif cmd == "/provider":
            new_provider, new_vendor, new_model, new_key = await _configure_provider(
                initial_provider=provider, initial_key=api_key,
            )
            provider, vendor, model = new_provider, new_vendor, new_model
            if new_key:
                api_key = new_key
            try:
                llm = build_llm(model=model, provider=provider, vendor=vendor, api_key=api_key, reasoning_enabled=True, reasoning_budget=8000)
                graph = build_sparta_graph(llm=llm, tools=tools, skill_context=skill_context, memory_context="", checkpointer=checkpointer)
                console.print(f"[green]✓ Provider: {provider} ({vendor}) — Modelo: {model}[/green]")
            except Exception as e:
                console.print(f"[yellow]⚠ Error al conectar: {e}[/yellow]")
                graph = None
            continue
        elif cmd == "/help":
            console.print(Panel.fit(
                "[bold]Comandos:[/bold]\n"
                "  /exit             Salir\n"
                "  /clear            Limpiar pantalla\n"
                "  /model <name>     Cambiar modelo\n"
                "  /provider         Cambiar provider/key\n"
                "  /help             Esta ayuda\n\n"
                "Alt+Enter o Ctrl+Enter para nueva línea.\n"
                "Cualquier otro texto se envía al agente.",
                border_style="yellow",
            ))
            continue

        turn_count += 1

        if graph is None:
            console.print("[yellow]⚠ No hay provider configurado. Usá /provider para configurar uno.[/yellow]")
            continue

        console.print(f"[dim]▸ turn {turn_count}[/]", end="")

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
        result = await _stream_to_cli(graph, initial_state, thread_id=session_id)
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
        console.print("[yellow]⚠ No API key found. Using ollama (local). Use /provider to change.[/yellow]")
        provider = "ollama"
        vendor = "ollama"
        model = "llama3.1"
    else:
        if provider not in PROVIDER_REGISTRY:
            vendor = provider
        if model == DEFAULT_MODEL and provider != "anthropic":
            reg = PROVIDER_REGISTRY.get(provider, {})
            model = reg["models"][0] if reg.get("models") else DEFAULT_MODEL

    # In CLI local mode the agent executes commands directly with the user's
    # privileges on their own machine. We intentionally skip the user
    # confirmation step (is_safe) that Desktop/Web require, because running a
    # command here is equivalent to the user typing it themselves in their shell.
    # The blocklist sanitization (sanitize) is still applied.
    set_execute_local(True)
    asyncio.run(_run_repl(model, provider, vendor, api_key, skills, semantic_memory, web_search, mode))


def main() -> None:
    app()


if __name__ == "__main__":
    main()
