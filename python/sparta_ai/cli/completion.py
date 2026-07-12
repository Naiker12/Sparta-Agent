"""
SlashCommandCompleter — a prompt_toolkit Completer that only activates when
the user types '/' and reads from the CommandRegistry.

This is what makes the `/` menu show command descriptions like in Hermes CLI,
replacing the hardcoded WordCompleter that was used before.
"""

from __future__ import annotations

from prompt_toolkit.completion import Completer, Completion
from prompt_toolkit.document import Document

from sparta_ai.cli.commands.registry import CommandRegistry


class SlashCommandCompleter(Completer):
    """
    A completer that only provides completions when the input starts with '/'.

    Reads completions from a CommandRegistry so the menu is always in sync
    with the actual available commands.
    """

    def __init__(self, registry: CommandRegistry) -> None:
        super().__init__()
        self.registry = registry

    def get_completions(self, document: Document, complete_event) -> list[Completion]:
        text = document.text_before_cursor
        if not text.startswith("/"):
            return []

        results: list[Completion] = []
        for cmd in self.registry.all_unique():
            if cmd.name.startswith(text):
                results.append(
                    Completion(
                        cmd.name,
                        start_position=-len(text),
                        display=cmd.name,
                        display_meta=cmd.summary,
                    )
                )
        return results