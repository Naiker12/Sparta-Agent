"""Ollama transport — uses ChatOllama with local model support."""
import logging
from typing import Any

from sparta_config.providers.base import ProviderTransport

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
        base_url = kwargs.pop("base_url", None) or kwargs.pop("api_url", None)
        if base_url:
            base_url = str(base_url).rstrip("/")
            if base_url.endswith("/v1"):
                base_url = base_url[:-3]

        temp = kwargs.pop("temperature", 0.7)
        max_toks = kwargs.pop("max_tokens", None)

        ollama_kwargs: dict[str, Any] = {
            "model": model,
            "num_ctx": kwargs.pop("num_ctx", 8192),
        }
        if base_url:
            ollama_kwargs["base_url"] = base_url
        if temp is not None:
            ollama_kwargs["temperature"] = temp
        if max_toks:
            ollama_kwargs["num_predict"] = max_toks

        # Pass any remaining client kwargs
        for k, v in kwargs.items():
            if k not in ("streaming", "timeout", "max_retries"):
                ollama_kwargs[k] = v

        logger.info("Building Ollama LLM: model=%s base_url=%s", model, base_url or "http://localhost:11434")
        return ChatOllama(**ollama_kwargs)