"""Emitters package — transport-agnostic event payload constructors.

Each submodule returns (event_type, payload) tuples that the dispatcher
in event_bridge.py sends via the appropriate transport (stdout / WebSocket).
"""
from sparta_ai.streaming.emitters.reasoning_events import (
    thinking_completed,
    thinking_started,
    thinking_status,
    thinking_token,
)
from sparta_ai.streaming.emitters.tool_events import (
    tool_called,
    tool_error,
    tool_result,
)
from sparta_ai.streaming.emitters.search_events import (
    search_progress,
)
from sparta_ai.streaming.emitters.usage_events import (
    usage,
)
from sparta_ai.streaming.emitters.permission_events import (
    diff_proposed,
    permission_request,
)
from sparta_ai.streaming.emitters.subagent_events import (
    subagent_started,
    subagent_thinking,
    subagent_completed,
)

__all__ = [
    "thinking_started",
    "thinking_token",
    "thinking_completed",
    "thinking_status",
    "tool_called",
    "tool_result",
    "tool_error",
    "search_progress",
    "usage",
    "permission_request",
    "diff_proposed",
    "subagent_started",
    "subagent_thinking",
    "subagent_completed",
]
