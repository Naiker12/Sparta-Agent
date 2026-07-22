"""Permission / diff-proposal event emitters for streaming.

Constructs payloads for (planned, not yet emitted from event_bridge):
  - permission:request     — agent requests permission to run a tool
  - editor:diff_proposed   — agent proposes a file diff for user review
"""
from typing import Any


def permission_request(
    base_payload: dict[str, Any],
    **kwargs: Any,
) -> tuple[str, dict[str, Any]]:
    return ("permission:request", {**base_payload, **kwargs})


def diff_proposed(
    base_payload: dict[str, Any],
    **kwargs: Any,
) -> tuple[str, dict[str, Any]]:
    return ("editor:diff_proposed", {**base_payload, **kwargs})
