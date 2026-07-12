"""
Base Command dataclass for Sparta CLI.

Every slash-command (e.g. `/model`, `/provider`, `/help`) is an instance
of this class. New commands are registered in a CommandRegistry.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Callable, Awaitable, TYPE_CHECKING

if TYPE_CHECKING:
    from sparta_ai.cli.session.state import SessionState


@dataclass
class Command:
    """A single slash-command known to the REPL.

    Attributes:
        name: Primary name including the leading slash, e.g. "/model".
        aliases: Alternative names (e.g. ["/m"] for "/model").
        summary: One-line description shown in the `/` completion menu.
        help_text: Full help text shown on `/help <command>`.
        handler: Async callable that receives the current SessionState and
                 the raw argument string after the command name.
    """

    name: str
    aliases: list[str] = field(default_factory=list)
    summary: str = ""
    help_text: str = ""
    handler: Callable[["SessionState", str], Awaitable[None]] | None = None

    async def execute(self, state: SessionState, args: str = "") -> None:
        """Invoke the handler, if set."""
        if self.handler is not None:
            await self.handler(state, args)