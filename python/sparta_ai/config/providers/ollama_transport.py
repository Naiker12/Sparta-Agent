"""Ollama transport — uses ChatOllama with local model support."""
import logging
from typing import Any

from sparta_ai.config.providers.base import ProviderTransport

logger = logging.getLogger("sparta_ai.config.providers")


class OllamaTransport(ProviderTransport):
    def build_llm(
        self,
        model: str,
        api_key: str | None,
        reasoning_enabled: bool,
        reasoning_budget: int,
        **kwargs: Any,
    ) -> Any:
        from langchain_ollama import ChatOllama

        kwargs.pop("reasoning_effort", None)
        ollama_kwargs = {**kwargs, "model": model}
        ollama_kwargs.pop("streaming", None)
        ollama_kwargs.pop("max_tokens", None)
        ollama_kwargs.pop("temperature", None)
        logger.info("Building Ollama LLM: model=%s", model)
        return ChatOllama(**ollama_kwargs)