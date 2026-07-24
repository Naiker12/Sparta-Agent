"""OpenAI-compatible transport — handles all vendors using the OpenAI SDK format.

Covers: openai, groq, mistral, deepseek, together, fireworks, openrouter,
cohere, perplexity, xai, nvidia, lmstudio, llamacpp, custom.
"""
import logging
from typing import Any

from sparta_config.providers.base import ProviderTransport, DEFAULT_REQUEST_TIMEOUT_SECONDS

logger = logging.getLogger("sparta_ai.config.providers")


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
        if "/v1" in base_url:
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
        # Avoid the SDK's multi-retry exponential backoff turning a transient
        # upstream stall into minutes of an apparently frozen chat.
        openai_kwargs.setdefault("max_retries", 1)
        openai_kwargs.setdefault("timeout", DEFAULT_REQUEST_TIMEOUT_SECONDS)
        if api_key:
            openai_kwargs["api_key"] = api_key
        elif self.vendor in ("lmstudio", "llamacpp", "custom"):
            # ChatOpenAI requires a key client-side even when local servers ignore auth.
            openai_kwargs["api_key"] = "not-needed"

        # Free-tier models need gentle penalties to avoid degenerate repetition
        from sparta_providers.free_tier_guard import is_free_tier_model as _is_free
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