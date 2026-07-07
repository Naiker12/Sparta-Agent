"""Shared helper functions for event dispatch.

This module provides pure helper functions used by event_bridge.py.
The EventDispatcher class was removed — use the unified dispatch in
event_bridge.py instead.
"""
from typing import Any


def _extract_namespace(event: dict) -> str:
    """Return the LangGraph namespace (e.g. ['agent', 'subagent_coordinator', 'agent'])."""
    metadata = event.get("metadata", {})
    ns = metadata.get("langgraph_node") or metadata.get("checkpoint_ns") or ""
    if isinstance(ns, list):
        return "/".join(str(p) for p in ns)
    return str(ns)


def _is_reasoning_block(block: Any) -> bool:
    """Detect typed content blocks that represent model reasoning/thinking."""
    if not isinstance(block, dict):
        return False
    block_type = block.get("type", "")
    return block_type in ("thinking", "reasoning")


def _is_text_block(block: Any) -> bool:
    if not isinstance(block, dict):
        return False
    return block.get("type", "") == "text"


def _block_text(block: dict) -> str:
    """Return the textual content of a typed block."""
    for key in ("thinking", "reasoning", "text", "content"):
        val = block.get(key)
        if isinstance(val, str):
            return val
    return ""


def _extract_reasoning_content(chunk: Any) -> str:
    """Extract reasoning content from providers that put it outside content blocks
    (e.g. DeepSeek / OpenRouter / Qwen via OpenAI-compatible APIs)."""
    for attr in ("additional_kwargs", "response_metadata"):
        meta = getattr(chunk, attr, None)
        if isinstance(meta, dict):
            for key in ("reasoning_content", "reasoning"):
                val = meta.get(key)
                if isinstance(val, str) and val:
                    return val
    return ""
