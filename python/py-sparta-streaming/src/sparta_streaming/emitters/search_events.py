"""Search progress event emitters for streaming.

Constructs payloads for:
  - search:progress — web search stage updates (searching/visiting/reading/done)
"""
from typing import Any


def search_progress(
    base_payload: dict[str, Any],
    data: dict[str, Any],
) -> tuple[str, dict[str, Any]]:
    return ("search:progress", {**base_payload, **data})
