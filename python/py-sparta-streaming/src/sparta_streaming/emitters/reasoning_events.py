"""Reasoning event emitters for streaming.

Constructs payloads for thinking lifecycle events:
  - thinking:started   — model began reasoning
  - thinking:token     — incremental reasoning content
  - thinking:completed — reasoning finished
  - thinking:status    — status text (e.g. "Analyzing task…")
"""
from typing import Any


def thinking_started(base_payload: dict[str, Any], origin: str = "native") -> tuple[str, dict[str, Any]]:
    return ("thinking:started", {**base_payload, "origin": origin})


def thinking_token(base_payload: dict[str, Any], token: str, origin: str = "native") -> tuple[str, dict[str, Any]]:
    return ("thinking:token", {**base_payload, "token": token, "origin": origin})


def thinking_completed(base_payload: dict[str, Any], tokens_used: int) -> tuple[str, dict[str, Any]]:
    return ("thinking:completed", {**base_payload, "tokens_used": tokens_used})


def thinking_status(base_payload: dict[str, Any], text: str) -> tuple[str, dict[str, Any]]:
    return ("thinking:status", {**base_payload, "text": text})
