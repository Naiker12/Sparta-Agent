"""Fachada del paquete de proveedores.

Mantiene el mismo import path que antes: `from sparta_config.providers import X`.
Cualquier código que importe de `sparta_ai.config.providers` sigue funcionando
sin cambios, incluyendo:

- `server.py` / `server_web.py` (via `server_handlers.py`)
- `tests/test_providers.py` (parchea `_get_transport` directamente)
"""
from sparta_config.providers.anthropic_transport import AnthropicTransport
from sparta_config.providers.azure_transport import AzureOpenAITransport
from sparta_config.providers.base import (
    DEFAULT_CHAT_MAX_TOKENS,
    DEFAULT_REQUEST_TIMEOUT_SECONDS,
    ProviderTransport,
)
from sparta_config.providers.cache import clear_llm_cache
from sparta_config.providers.factory import build_llm, get_embedding_model
from sparta_config.providers.health import check_provider_health
from sparta_config.providers.ollama_transport import OllamaTransport
from sparta_config.providers.openai_compatible import OpenAICompatibleTransport
from sparta_config.providers.registry import _get_transport

__all__ = [
    "ProviderTransport",
    "AnthropicTransport",
    "OpenAICompatibleTransport",
    "AzureOpenAITransport",
    "GoogleTransport",
    "OllamaTransport",
    "_get_transport",
    "check_provider_health",
    "build_llm",
    "get_embedding_model",
    "clear_llm_cache",
    "clear_all_caches",
    "DEFAULT_CHAT_MAX_TOKENS",
    "DEFAULT_REQUEST_TIMEOUT_SECONDS",
]


def clear_all_caches() -> None:
    """Clear ALL in-memory caches: LLM clients, API keys, search results, HTTP pool.

    Call this on sidecar restart or when the user wants a fresh start.
    """
    import logging
    logger = logging.getLogger("sparta_ai.config.providers")

    # 1. LLM client cache (frees SDK objects + underlying httpx connections)
    clear_llm_cache()
    logger.info("Cleared LLM client cache")

    # 2. API key cache
    try:
        from sparta_config.security import clear_keys
        clear_keys()
        logger.info("Cleared API key cache")
    except Exception:
        pass

    # 3. Web search result cache
    try:
        from sparta_tools.web_search import clear_search_cache
        clear_search_cache()
        logger.info("Cleared web search cache")
    except Exception:
        pass

    # 4. HTTP connection pool (closes all TCP connections)
    try:
        import asyncio
        from sparta_tools.http_pool import close_pool
        loop = asyncio.get_event_loop()
        if loop.is_running():
            loop.create_task(close_pool())
        else:
            loop.run_until_complete(close_pool())
        logger.info("Closed HTTP connection pool")
    except Exception:
        pass

    logger.info("All caches cleared")