"""Backward-compatibility shim for ``sparta_ai.config.providers``.

All implementation now lives in the ``providers/`` subpackage.
This module re-exports the public API so existing imports keep working.
"""
from sparta_ai.config.providers import (  # noqa: F401
    AnthropicTransport,
    AzureOpenAITransport,
    DEFAULT_CHAT_MAX_TOKENS,
    DEFAULT_REQUEST_TIMEOUT_SECONDS,
    GoogleTransport,
    OllamaTransport,
    OpenAICompatibleTransport,
    ProviderTransport,
    _get_transport,
    build_llm,
    check_provider_health,
    clear_llm_cache,
    get_embedding_model,
)
