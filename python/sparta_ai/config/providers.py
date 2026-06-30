"""Provider transport layer for LLM construction.

Mirrors the JS pattern in src/services/ai/transports/{anthropic,openai,ollama}.transport.ts:
each provider only knows its own message/API format, while streaming, retries and prompt
 caching live in the agent core.
"""
import logging
from abc import ABC, abstractmethod
from typing import Any

logger = logging.getLogger("sparta_ai.config.providers")


class ProviderTransport(ABC):
    """Abstract provider transport."""

    @abstractmethod
    def build_llm(
        self,
        model: str,
        api_key: str | None,
        reasoning_enabled: bool,
        reasoning_budget: int,
        **kwargs: Any,
    ) -> Any:
        """Build and return a LangChain chat model instance."""
        ...


class AnthropicTransport(ProviderTransport):
    def build_llm(
        self,
        model: str,
        api_key: str | None,
        reasoning_enabled: bool,
        reasoning_budget: int,
        **kwargs: Any,
    ) -> Any:
        from langchain_anthropic import ChatAnthropic

        anthropic_kwargs = {**kwargs, "model": model}
        if api_key:
            anthropic_kwargs["api_key"] = api_key
        if reasoning_enabled:
            anthropic_kwargs["thinking"] = {
                "type": "enabled",
                "budget_tokens": reasoning_budget,
            }
        logger.info("Building Anthropic LLM: model=%s reasoning=%s", model, reasoning_enabled)
        return ChatAnthropic(**anthropic_kwargs)


class OpenAICompatibleTransport(ProviderTransport):
    """Transport for OpenAI-compatible endpoints."""

    def __init__(self, vendor: str):
        self.vendor = vendor
        self._base_url_map = {
            "groq": "https://api.groq.com/openai/v1",
            "mistral": "https://api.mistral.ai/v1",
            "deepseek": "https://api.deepseek.com/v1",
            "together": "https://api.together.xyz/v1",
            "fireworks": "https://api.fireworks.ai/inference/v1",
            "openrouter": "https://openrouter.ai/api/v1",
            "cohere": "https://api.cohere.ai/v1",
            "perplexity": "https://api.perplexity.ai/v1",
            "xai": "https://api.x.ai/v1",
        }

    def build_llm(
        self,
        model: str,
        api_key: str | None,
        reasoning_enabled: bool,
        reasoning_budget: int,
        **kwargs: Any,
    ) -> Any:
        from langchain_openai import ChatOpenAI

        openai_kwargs = {**kwargs, "model": model}
        if api_key:
            openai_kwargs["api_key"] = api_key

        base_url = self._base_url_map.get(self.vendor)
        if base_url:
            openai_kwargs["base_url"] = base_url

        if reasoning_enabled:
            # OpenAI-compatible providers may expose reasoning via model-specific kwargs.
            # We leave the budget in kwargs so callers can act on it if supported.
            openai_kwargs.setdefault("reasoning_effort", "medium")

        logger.info("Building OpenAI-compatible LLM: vendor=%s model=%s", self.vendor, model)
        return ChatOpenAI(**openai_kwargs)


class OllamaTransport(ProviderTransport):
    def build_llm(
        self,
        model: str,
        api_key: str | None,
        reasoning_enabled: bool,
        reasoning_budget: int,
        **kwargs: Any,
    ) -> Any:
        from langchain_community.llms import Ollama

        ollama_kwargs = {**kwargs, "model": model}
        ollama_kwargs.pop("streaming", None)
        # Ollama does not use API keys in the same way; ignore reasoning kwargs.
        logger.info("Building Ollama LLM: model=%s", model)
        return Ollama(**ollama_kwargs)


def _get_transport(vendor: str) -> ProviderTransport:
    vendor = vendor.lower()
    if vendor == "anthropic":
        return AnthropicTransport()
    if vendor == "ollama":
        return OllamaTransport()
    if vendor in (
        "openai",
        "groq",
        "mistral",
        "deepseek",
        "together",
        "fireworks",
        "openrouter",
        "cohere",
        "perplexity",
        "xai",
    ):
        return OpenAICompatibleTransport(vendor)
    raise ValueError(f"Unknown vendor/provider: {vendor}")


def build_llm(
    model: str,
    provider: str,
    vendor: str | None = None,
    api_key: str | None = None,
    reasoning_enabled: bool = False,
    reasoning_budget: int = 8000,
    **kwargs: Any,
) -> Any:
    vendor = (vendor or provider).lower()

    kwargs.setdefault("streaming", True)

    if reasoning_enabled and vendor == "anthropic":
        kwargs["temperature"] = 1
        kwargs.setdefault("max_tokens", reasoning_budget + 4096)
    else:
        kwargs.setdefault("temperature", 0.7)
        kwargs.setdefault("max_tokens", 4096)

    transport = _get_transport(vendor)
    return transport.build_llm(
        model=model,
        api_key=api_key,
        reasoning_enabled=reasoning_enabled,
        reasoning_budget=reasoning_budget,
        **kwargs,
    )


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
