"""Usage / token accounting event emitters for streaming.

Constructs payloads for:
  - usage — input/output token counts after model call completes
"""
from typing import Any


def usage(
    base_payload: dict[str, Any],
    input_tokens: int,
    output_tokens: int,
) -> tuple[str, dict[str, Any]]:
    return (
        "usage",
        {**base_payload, "input_tokens": input_tokens, "output_tokens": output_tokens},
    )
