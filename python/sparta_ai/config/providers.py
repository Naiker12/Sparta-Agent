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

        kwargs.pop("reasoning_effort", None)
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
            "lmstudio": "http://localhost:1234/v1",
            "llamacpp": "http://localhost:8080/v1",
            "groq": "https://api.groq.com/openai/v1",
            "mistral": "https://api.mistral.ai/v1",
            "deepseek": "https://api.deepseek.com/v1",
            "together": "https://api.together.xyz/v1",
            "fireworks": "https://api.fireworks.ai/inference/v1",
            "openrouter": "https://openrouter.ai/api/v1",
            "cohere": "https://api.cohere.ai/v1",
            "perplexity": "https://api.perplexity.ai/v1",
            "xai": "https://api.x.ai/v1",
            "nvidia": "https://integrate.api.nvidia.com/v1",
        }

    def _normalize_base_url(self, base_url: str) -> str:
        base_url = base_url.rstrip("/")
        if base_url.endswith("/v1"):
            return base_url
        return f"{base_url}/v1"

    def build_llm(
        self,
        model: str,
        api_key: str | None,
        reasoning_enabled: bool,
        reasoning_budget: int,
        **kwargs: Any,
    ) -> Any:
        from langchain_openai import ChatOpenAI

        requested_base_url = kwargs.pop("base_url", None) or kwargs.pop("api_url", None)
        openai_kwargs = {**kwargs, "model": model}
        if api_key:
            openai_kwargs["api_key"] = api_key
        elif self.vendor in ("lmstudio", "llamacpp", "custom"):
            # ChatOpenAI requires a key client-side even when local servers ignore auth.
            openai_kwargs["api_key"] = "not-needed"

        # Free-tier models need gentle penalties to avoid degenerate repetition
        from sparta_ai.providers.free_tier_guard import is_free_tier_model as _is_free
        if self.vendor == "openrouter" and _is_free(model):
            openai_kwargs.setdefault("frequency_penalty", 0.3)
            openai_kwargs.setdefault("presence_penalty", 0.3)
            openai_kwargs.setdefault("temperature", 0.7)

        base_url = requested_base_url or self._base_url_map.get(self.vendor)
        if base_url:
            openai_kwargs["base_url"] = self._normalize_base_url(str(base_url))

        if reasoning_enabled:
            # Map reasoning_effort from the frontend if provided
            reasoning_effort = kwargs.pop("reasoning_effort", "medium")
            openai_kwargs.pop("reasoning_effort", None)
            if self.vendor == "openrouter":
                extra_body = dict(openai_kwargs.get("extra_body") or {})
                reasoning: dict[str, Any] = {}
                if reasoning_effort and reasoning_effort != "none":
                    if reasoning_budget > 0:
                        reasoning["max_tokens"] = reasoning_budget
                    else:
                        reasoning["effort"] = reasoning_effort
                extra_body["reasoning"] = reasoning
                openai_kwargs["extra_body"] = extra_body
            elif self.vendor == "deepseek":
                openai_kwargs["reasoning_effort"] = reasoning_effort

        # Ensure reasoning_effort is not passed directly to ChatOpenAI (it's folded into extra_body)
        openai_kwargs.pop("reasoning_effort", None)

        if self.vendor == "openrouter":
            eb = openai_kwargs.get("extra_body", {})
            reas = eb.get("reasoning", {})
            logger.info("OpenRouter extra_body.reasoning: %s (max_tokens=%s, effort=%s)",
                       reas, reas.get("max_tokens"), reas.get("effort"))

        logger.info("Building OpenAI-compatible LLM: vendor=%s model=%s", self.vendor, model)
        return ChatOpenAI(**openai_kwargs)


class GoogleTransport(ProviderTransport):
    def build_llm(
        self,
        model: str,
        api_key: str | None,
        reasoning_enabled: bool,
        reasoning_budget: int,
        **kwargs: Any,
    ) -> Any:
        from langchain_google_genai import ChatGoogleGenerativeAI

        kwargs.pop("reasoning_effort", None)
        google_kwargs = {**kwargs, "model": model}
        if api_key:
            google_kwargs["google_api_key"] = api_key
        if reasoning_enabled:
            google_kwargs["thinking_budget"] = reasoning_budget
            google_kwargs["include_thoughts"] = True

        # ── Fast-fail on quota exhaustion ──────────────────────────────
        # Reduce retries and backoff for 429/RESOURCE_EXHAUSTED so the user
        # gets a clear message in seconds instead of ~90s of silent retries.
        google_kwargs.setdefault("max_retries", 1)
        # Disable the default exponential backoff for 429s by setting a
        # very short retry delay. The SDK's built-in retry will still try
        # once, but won't loop for a minute.
        google_kwargs.setdefault("request_retries", 1)

        logger.info("Building Google LLM: model=%s reasoning=%s", model, reasoning_enabled)
        return ChatGoogleGenerativeAI(**google_kwargs)


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

        kwargs.pop("reasoning_effort", None)
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
    if vendor in ("google", "google_genai", "gemini"):
        return GoogleTransport()
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
        "nvidia",
        "lmstudio",
        "llamacpp",
        "custom",
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
    reasoning_effort: str = "medium",
    api_url: str | None = None,
    base_url: str | None = None,
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
    resolved_base_url = base_url or api_url
    if resolved_base_url:
        kwargs["base_url"] = resolved_base_url
    return transport.build_llm(
        model=model,
        api_key=api_key,
        reasoning_enabled=reasoning_enabled,
        reasoning_budget=reasoning_budget,
        reasoning_effort=reasoning_effort,
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
