"""Subagent lifecycle event emitters for streaming.

Constructs payloads for:
  - subagent:started   — subagent delegation began
  - subagent:thinking  — subagent processing (status update)
  - subagent:completed — subagent finished (success or failure)
"""
from typing import Any


def subagent_started(
    base_payload: dict[str, Any],
    subagent_name: str,
    task_summary: str,
) -> tuple[str, dict[str, Any]]:
    return (
        "subagent:started",
        {
            **base_payload,
            "subagentName": subagent_name,
            "taskSummary": task_summary,
        },
    )


def subagent_thinking(
    base_payload: dict[str, Any],
    subagent_name: str,
    status_text: str,
) -> tuple[str, dict[str, Any]]:
    return (
        "subagent:thinking",
        {
            **base_payload,
            "subagentName": subagent_name,
            "statusText": status_text,
        },
    )


def subagent_completed(
    base_payload: dict[str, Any],
    subagent_name: str,
    duration_ms: int,
    success: bool,
) -> tuple[str, dict[str, Any]]:
    return (
        "subagent:completed",
        {
            **base_payload,
            "subagentName": subagent_name,
            "durationMs": duration_ms,
            "success": success,
        },
    )
