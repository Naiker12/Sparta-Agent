"""LLM factory — build_llm() and get_embedding_model() with caching."""
import logging
from typing import Any

from sparta_config.providers.base import DEFAULT_CHAT_MAX_TOKENS, DEFAULT_REQUEST_TIMEOUT_SECONDS
from sparta_config.providers.cache import _llm_cache_get, _llm_cache_set
from sparta_config.providers.health import check_provider_health
from sparta_config.providers.registry import _get_transport

logger = logging.getLogger("sparta_ai.config.providers")


def build_llm(
    model: str,
    provider: str,
    vendor: str | None = None,
    api_key: str | None = None,
    reasoning_enabled: bool = False,
    reasoning_budget: int = 8000,
    reasoning_effort: str = "medium",
    api_url: str | None = None,
    base_url: str | None = None,
    **kwargs: Any,
) -> Any:
    vendor = (vendor or provider).lower()
    resolved_base_url = base_url or api_url

    # ── Cache lookup ───────────────────────────────────────────────────
    # Reuse the LLM client when the configuration hasn't changed since the
    # last turn.  This avoids redundant DNS/TLS handshakes and SDK object
    # construction — especially valuable when switching between providers.
    from sparta_config.providers.cache import _llm_cache_key
    cache_key = _llm_cache_key(vendor, model, api_key, resolved_base_url)
    cached = _llm_cache_get(cache_key)
    if cached is not None:
        logger.debug("Reusing cached LLM client: vendor=%s model=%s", vendor, model)
        return cached

    kwargs.setdefault("streaming", True)

    if reasoning_enabled and vendor == "anthropic":
        kwargs["temperature"] = 1
        kwargs.setdefault("max_tokens", reasoning_budget + 4096)
    else:
        kwargs.setdefault("temperature", 0.7)
        kwargs.setdefault("max_tokens", DEFAULT_CHAT_MAX_TOKENS)

    # Shared HTTP guardrails. Individual transports may override these when
    # their SDK needs a more specific option.
    kwargs.setdefault("timeout", DEFAULT_REQUEST_TIMEOUT_SECONDS)
    kwargs.setdefault("max_retries", 1)

    # Free-tier models need longer timeouts — they share queues and are slower.
    from sparta_providers.free_tier_guard import get_free_tier_timeout
    free_timeout = get_free_tier_timeout(model)
    if free_timeout is not None:
        kwargs["timeout"] = free_timeout
        logger.info("Free-tier timeout override: %.0fs for %s", free_timeout, model)

    transport = _get_transport(vendor)
    if resolved_base_url:
        kwargs["base_url"] = resolved_base_url
    instance = transport.build_llm(
        model=model,
        api_key=api_key,
        reasoning_enabled=reasoning_enabled,
        reasoning_budget=reasoning_budget,
        reasoning_effort=reasoning_effort,
        **kwargs,
    )

    # Store in cache for subsequent turns
    _llm_cache_set(cache_key, instance)
    logger.debug("Cached new LLM client: vendor=%s model=%s key=%s", vendor, model, cache_key)
    return instance


def get_embedding_model(provider: str = "openai", api_key: str | None = None) -> Any:
    if provider == "openai":
        from langchain_openai import OpenAIEmbeddings
        kwargs = {"model": "text-embedding-3-small"}
        if api_key:
            kwargs["api_key"] = api_key
        return OpenAIEmbeddings(**kwargs)
    elif provider == "ollama":
        from langchain_community.embeddings import OllamaEmbeddings
        return OllamaEmbeddings(model="nomic-embed-text")
    else:
        raise ValueError(f"Unknown embedding provider: {provider}")