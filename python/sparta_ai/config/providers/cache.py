"""LLM client cache — reuses ChatOpenAI/ChatAnthropic/etc. instances across turns.

Keyed by (vendor, model, api_key_hash, base_url) to avoid redundant DNS resolution,
TLS handshakes, and SDK object construction on every user message.
"""
import hashlib
from typing import Any

_llm_cache: dict[str, Any] = {}
_LLM_CACHE_MAX = 16  # enough for a handful of provider switches per session


def _llm_cache_key(
    vendor: str,
    model: str,
    api_key: str | None,
    base_url: str | None,
) -> str:
    """Deterministic cache key for an LLM client instance."""
    key_parts = [vendor, model]
    if api_key:
        key_parts.append(hashlib.sha256(api_key.encode()).hexdigest()[:16])
    if base_url:
        key_parts.append(base_url.rstrip("/"))
    return ":".join(key_parts)


def _llm_cache_get(key: str) -> Any | None:
    return _llm_cache.get(key)


def _llm_cache_set(key: str, instance: Any) -> None:
    if len(_llm_cache) >= _LLM_CACHE_MAX:
        # Simple LRU eviction: remove the first (oldest) entry
        oldest = next(iter(_llm_cache))
        _llm_cache.pop(oldest)
    _llm_cache[key] = instance


def clear_llm_cache() -> None:
    """Clear the LLM client cache (e.g. on sidecar restart or config change)."""
    _llm_cache.clear()