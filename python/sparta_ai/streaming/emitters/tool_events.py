"""Tool lifecycle event emitters for streaming.

Constructs payloads for:
  - tool:called  — tool invocation started
  - tool:result  — tool completed successfully
  - tool:error   — tool raised an exception
"""
from typing import Any


def tool_called(
    base_payload: dict[str, Any],
    name: str,
    tool_input: Any,
    tool_call_id: str,
) -> tuple[str, dict[str, Any]]:
    return (
        "tool:called",
        {**base_payload, "name": name, "input": tool_input, "tool_call_id": tool_call_id},
    )


def tool_result(
    base_payload: dict[str, Any],
    name: str,
    output: str,
    duration_ms: int,
    tool_call_id: str,
) -> tuple[str, dict[str, Any]]:
    return (
        "tool:result",
        {
            **base_payload,
            "name": name,
            "output": output,
            "duration_ms": duration_ms,
            "tool_call_id": tool_call_id,
        },
    )


def tool_error(
    base_payload: dict[str, Any],
    name: str,
    error: str,
    tool_call_id: str,
) -> tuple[str, dict[str, Any]]:
    return (
        "tool:error",
        {**base_payload, "name": name, "error": error, "tool_call_id": tool_call_id},
    )
