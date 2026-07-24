"""Google/Gemini transport — uses ChatGoogleGenerativeAI with thinking support."""
import logging
from typing import Any

from sparta_config.providers.base import ProviderTransport

logger = logging.getLogger("sparta_ai.config.providers")


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
        clean_model = model.replace("google/", "").replace("gemini/", "")
        google_kwargs = {**kwargs, "model": clean_model}
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