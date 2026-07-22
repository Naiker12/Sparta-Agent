"""Azure OpenAI transport — uses AzureChatOpenAI with deployment-based routing."""
import logging
from typing import Any

from sparta_config.providers.base import ProviderTransport

logger = logging.getLogger("sparta_ai.config.providers")


class AzureOpenAITransport(ProviderTransport):
    """Transport for Azure OpenAI deployments.

    Azure uses a different endpoint pattern than other OpenAI-compatible
    endpoints, requiring ``azure_deployment`` and ``api_version``.
    """

    def build_llm(
        self,
        model: str,
        api_key: str | None,
        reasoning_enabled: bool,
        reasoning_budget: int,
        **kwargs: Any,
    ) -> Any:
        from langchain_openai import AzureChatOpenAI

        kwargs.pop("reasoning_effort", None)
        azure_kwargs = {**kwargs, "azure_deployment": model}
        if api_key:
            azure_kwargs["api_key"] = api_key
        # These can be overridden via kwargs if the user passes them
        azure_kwargs.setdefault("api_version", "2024-08-01-preview")
        logger.info("Building Azure OpenAI LLM: deployment=%s", model)
        return AzureChatOpenAI(**azure_kwargs)