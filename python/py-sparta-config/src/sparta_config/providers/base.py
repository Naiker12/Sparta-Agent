"""Abstract base class and shared constants for provider transports."""
from abc import ABC, abstractmethod
from typing import Any

# Chat requests are interactive. Reserving 4096 output tokens for every
# greeting/question increases provider queue time and time-to-first-token;
# agent responses are instructed to be concise, so 2048 is ample while still
# leaving room for a useful markdown answer.
DEFAULT_CHAT_MAX_TOKENS = 2048
DEFAULT_REQUEST_TIMEOUT_SECONDS = 75


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