"""Defines what each tool can do without human confirmation.

This is the permission policy layer that decides whether a tool call
requires `interrupt_before` (human-in-the-loop) or can proceed
autonomously.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field

logger = logging.getLogger("sparta_ai.security.permissions")


@dataclass
class ToolPermission:
    """Permission settings for a single tool."""

    name: str
    requires_confirmation: bool = False
    max_calls_per_turn: int = 10


class PermissionPolicy:
    """Central policy for tool permissions.

    Tools not listed here default to:
      - requires_confirmation = False
      - max_calls_per_turn = 10
    """

    def __init__(self):
        self._tools: dict[str, ToolPermission] = {
            tp.name: tp
            for tp in [
                ToolPermission("terminal_execute_tool", requires_confirmation=True),
                ToolPermission("write_file_tool", requires_confirmation=False),
                ToolPermission("read_file_tool", requires_confirmation=False),
                ToolPermission("web_search_tool", requires_confirmation=False),
                ToolPermission("read_memory_tool", requires_confirmation=False),
                ToolPermission("write_memory_tool", requires_confirmation=False),
                ToolPermission("skill_view_tool", requires_confirmation=False),
            ]
        }

    def requires_confirmation(self, tool_name: str) -> bool:
        tp = self._tools.get(tool_name)
        return tp.requires_confirmation if tp else False

    def max_calls(self, tool_name: str) -> int:
        tp = self._tools.get(tool_name)
        return tp.max_calls_per_turn if tp else 10
