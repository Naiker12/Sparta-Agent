"""LLM client cache — reuses ChatOpenAI/ChatAnthropic/etc. instances across turns.

Keyed by (vendor, model, api_key_hash, base_url, reasoning_params) to avoid redundant DNS resolution,
TLS handshakes, and SDK object construction on every user message.

Uses an OrderedDict for O(1) LRU eviction (most-recently-used moves to end).
"""
import hashlib
from collections import OrderedDict
from typing import Any

_llm_cache: OrderedDict[str, Any] = OrderedDict()
_LLM_CACHE_MAX = 16  # enough for a handful of provider switches per session


def _llm_cache_key(
    vendor: str,
    model: str,
    api_key: str | None,
    base_url: str | None,
    reasoning_enabled: bool = False,
    reasoning_budget: int = 0,
) -> str:
    """Deterministic cache key for an LLM client instance."""
    key_parts = [vendor, model]
    if api_key:
        key_parts.append(hashlib.sha256(api_key.encode()).hexdigest()[:16])
    if base_url:
        key_parts.append(base_url.rstrip("/"))
    if reasoning_enabled:
        key_parts.append(f"think:{reasoning_budget}")
    return ":".join(key_parts)


def _llm_cache_get(key: str) -> Any | None:
    if key in _llm_cache:
        # Move to end (most recently used)
        _llm_cache.move_to_end(key)
        return _llm_cache[key]
    return None


def _llm_cache_set(key: str, instance: Any) -> None:
    if key in _llm_cache:
        _llm_cache.move_to_end(key)
    else:
        if len(_llm_cache) >= _LLM_CACHE_MAX:
            # LRU eviction: remove the least recently used (first item)
            _llm_cache.popitem(last=False)
        _llm_cache[key] = instance


def clear_llm_cache() -> None:
    """Clear the LLM client cache (e.g. on sidecar restart or config change)."""
    _llm_cache.clear()
