"""Fachada del paquete de proveedores.

Mantiene el mismo import path que antes: `from sparta_ai.config.providers import X`.
Cualquier código que importe de `sparta_ai.config.providers` sigue funcionando
sin cambios, incluyendo:

- `server.py` / `server_web.py` (via `server_handlers.py`)
- `tests/test_providers.py` (parchea `_get_transport` directamente)
"""
from sparta_ai.config.providers.anthropic_transport import AnthropicTransport
from sparta_ai.config.providers.azure_transport import AzureOpenAITransport
from sparta_ai.config.providers.base import (
    DEFAULT_CHAT_MAX_TOKENS,
    DEFAULT_REQUEST_TIMEOUT_SECONDS,
    ProviderTransport,
)
from sparta_ai.config.providers.cache import clear_llm_cache
from sparta_ai.config.providers.factory import build_llm, get_embedding_model
from sparta_ai.config.providers.health import check_provider_health
from sparta_ai.config.providers.ollama_transport import OllamaTransport
from sparta_ai.config.providers.openai_compatible import OpenAICompatibleTransport
from sparta_ai.config.providers.registry import _get_transport

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
    "DEFAULT_CHAT_MAX_TOKENS",
    "DEFAULT_REQUEST_TIMEOUT_SECONDS",
]