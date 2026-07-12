"""
Command registry — the central switchboard for slash-commands.

Replaces the giant if/elif chain that used to live in _run_repl.
"""

from __future__ import annotations

from typing import List, Optional

from sparta_ai.cli.commands.base import Command


class CommandRegistry:
    """Maps command names and aliases to Command instances."""

    def __init__(self) -> None:
        self._commands: dict[str, Command] = {}

    def register(self, command: Command) -> None:
        """Register a Command under its primary name and all aliases."""
        self._commands[command.name] = command
        for alias in command.aliases:
            self._commands[alias] = command

    def resolve(self, raw_input: str) -> Command | None:
        """
        Extract the command name from *raw_input* and look it up.

        Returns None when the input is not a known command (caller should
        treat it as an agent prompt).
        """
        name = raw_input.strip().split(maxsplit=1)[0]
        return self._commands.get(name)

    def all_unique(self) -> list[Command]:
        """Return deduplicated list of all registered commands."""
        seen: set[str] = set()
        result: list[Command] = []
        for cmd in self._commands.values():
            if cmd.name not in seen:
                seen.add(cmd.name)
                result.append(cmd)
        return result

    def all_names(self) -> list[str]:
        """Return all registered names + aliases (for the WordCompleter fallback)."""
        return list(self._commands.keys())

    def has_command(self, raw_input: str) -> bool:
        name = raw_input.strip().split(maxsplit=1)[0]
        return name in self._commands