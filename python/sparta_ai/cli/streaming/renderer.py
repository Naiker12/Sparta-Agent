"""
Stream renderer — manages Rich Live display of LangGraph streaming events.

Extracted and refactored from _stream_to_cli in cli.py.
"""

import asyncio
import json
import time
from typing import Any

from rich.console import Console
from rich.live import Live
from rich.markdown import Markdown
from rich.panel import Panel
from rich.syntax import Syntax
from rich.text import Text

from sparta_ai.cli.streaming.blocks import block_text
from sparta_ai.cli.theme import ACCENT_DIM, MUTED, DIM, WARNING

console = Console()


class StreamRenderer:
    """Render agent streaming output to the CLI using Rich Live."""

    def __init__(self, refresh_per_second: float = 12):
        self.buffer = ""
        self.thinking_text = ""
        self.tool_name = ""
        self.tool_input = ""
        self.tool_count = 0
        self.start_time: float = 0.0
        self._refresh = refresh_per_second

    async def stream(self, graph: Any, initial_state: dict, thread_id: str) -> dict:
        """Stream agent response to CLI. Returns timing/token metadata."""
        config = {"configurable": {"thread_id": thread_id}}
        self.buffer = ""
        self.thinking_text = ""
        self.tool_name = ""
        self.tool_input = ""
        self.tool_count = 0
        self.start_time = time.time()

        with Live(console=console, refresh_per_second=self._refresh, vertical_overflow="visible") as live:
            try:
                async for event in graph.astream_events(initial_state, config, version="v2"):
                    kind = event.get("event", "")
                    data: dict = event.get("data", {})
                    name: str = event.get("name", "")

                    if kind == "on_chat_model_stream":
                        self._handle_model_stream(data)

                    elif kind == "on_tool_start":
                        inp = data.get("input", {})
                        self.tool_name = name
                        self.tool_input = (
                            json.dumps(inp, indent=2, ensure_ascii=False)
                            if isinstance(inp, dict)
                            else str(inp)
                        )
                        self.tool_count += 1

                    elif kind == "on_tool_end":
                        self._handle_tool_end(data, live)

                    elif kind == "on_tool_error":
                        err = data.get("error", "Unknown error")
                        live.update(Panel(f"[{WARNING}]{err}[/{WARNING}]", title=f"[{WARNING}]Tool Error[/{WARNING}]"))
                        await asyncio.sleep(0.05)

                    self._refresh_live(live)

            except Exception as e:
                live.update(Panel(f"[{WARNING}]Error: {e}[/{WARNING}]", title="Stream Error"))

        elapsed = time.time() - self.start_time

        return {
            "elapsed": elapsed,
            "tool_count": self.tool_count,
            "has_response": bool(self.buffer),
        }

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _handle_model_stream(self, data: dict) -> None:
        chunk = data.get("chunk")
        if chunk is None:
            return
        content = getattr(chunk, "content", "")
        if isinstance(content, list):
            for block in content:
                if isinstance(block, dict):
                    bt = block.get("type")
                    t = block_text(block)
                    if not t:
                        continue
                    if bt in ("thinking", "reasoning"):
                        self.thinking_text += t
                    elif bt == "text":
                        self.buffer += t
        elif isinstance(content, str) and content:
            self.buffer += content

    async def _handle_tool_end(self, data: dict, live: Live) -> None:
        output = data.get("output", "")
        if self.tool_name:
            out_str = str(output)
            if len(out_str) < 2000:
                content: Any = Syntax(out_str, "text", word_wrap=True)
            else:
                content = Text(out_str[:2000] + "...")
            live.update(
                Panel(
                    content,
                    title=f"[bold]{self.tool_name}[/bold]",
                    border_style=f"dim {ACCENT_DIM}",
                    padding=(0, 1),
                )
            )
            await asyncio.sleep(0.05)
        self.tool_name = ""
        self.tool_input = ""

    def _refresh_live(self, live: Live) -> None:
        renderables = []
        if self.thinking_text:
            renderables.append(Text(f"── {self.thinking_text[-200:]}", style=f"dim {MUTED} italic"))
        if self.buffer:
            renderables.append(Markdown(self.buffer))
        if self.tool_name:
            inp_body = (
                Syntax(self.tool_input, "json", word_wrap=True)
                if self.tool_input.startswith("{")
                else Text(self.tool_input)
            )
            renderables.append(
                Panel(inp_body, title=f"[{ACCENT_DIM}]{self.tool_name}[/{ACCENT_DIM}]", border_style=DIM)
            )

        if renderables:
            border = ACCENT_DIM if self.tool_name else "green"
            live.update(Panel(*renderables, border_style=border))
        else:
            elapsed = time.time() - self.start_time
            live.update(Text(f"⏳ pensando... ({elapsed:.0f}s)", style=DIM))