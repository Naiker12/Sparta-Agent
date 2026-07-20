"""Anthropic transport — uses ChatAnthropic with extended thinking support."""
import logging
from typing import Any

from sparta_ai.config.providers.base import ProviderTransport

logger = logging.getLogger("sparta_ai.config.providers")


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