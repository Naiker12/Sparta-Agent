import logging
from typing import Any

from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI
from langchain_community.llms import Ollama

logger = logging.getLogger("sparta_ai.config.providers")


def build_llm(
    model: str,
    provider: str,
    vendor: str | None = None,
    api_key: str | None = None,
    reasoning_enabled: bool = False,
    reasoning_budget: int = 8000,
    **kwargs: Any,
) -> Any:
    vendor = vendor or provider

    kwargs.setdefault("streaming", True)
    kwargs.setdefault("temperature", 0.7)
    kwargs.setdefault("max_tokens", 4096)

    if vendor == "anthropic":
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

    elif vendor == "openai" or vendor in ("groq", "mistral", "deepseek"):
        openai_kwargs = {**kwargs, "model": model}
        if api_key:
            openai_kwargs["api_key"] = api_key

        base_url_map = {
            "groq": "https://api.groq.com/openai/v1",
            "mistral": "https://api.mistral.ai/v1",
            "deepseek": "https://api.deepseek.com/v1",
        }
        if vendor in base_url_map:
            openai_kwargs["base_url"] = base_url_map[vendor]

        logger.info("Building OpenAI-compatible LLM: vendor=%s model=%s", vendor, model)
        return ChatOpenAI(**openai_kwargs)

    elif vendor == "ollama":
        ollama_kwargs = {**kwargs, "model": model}
        ollama_kwargs.pop("streaming", None)
        logger.info("Building Ollama LLM: model=%s", model)
        return Ollama(**ollama_kwargs)

    else:
        raise ValueError(f"Unknown vendor/provider: {vendor} / {provider}")


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
