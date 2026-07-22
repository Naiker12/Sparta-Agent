"""Retry policy for transient LLM provider failures.

Handles the case where a provider returns an empty response or no choices
(common with saturated OpenRouter :free models) by retrying once with
backoff before surfacing the error to the user.
"""
import asyncio
import logging
from typing import Any, Callable, TypeVar

logger = logging.getLogger("sparta_ai.providers.retry")

T = TypeVar("T")


class EmptyResponseError(Exception):
    """Raised when the provider returns a valid response with no content."""


class RateLimitError(Exception):
    """Raised on HTTP 429 or explicit rate-limit signals."""


async def retry_on_empty(
    fn: Callable[[], Any],
    max_retries: int = 1,
    delay_ms: int = 2000,
) -> Any:
    """Call fn, retrying on EmptyResponseError/RateLimitError with backoff.

    Args:
        fn: Async callable that produces an LLM response.
        max_retries: Number of retries before giving up (default 1).
        delay_ms: Base delay in ms before first retry (default 2000).

    Returns:
        The result of the successful fn call.

    Raises:
        EmptyResponseError after all retries exhausted.
    """
    last_error: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            return await fn()
        except (EmptyResponseError, RateLimitError) as e:
            last_error = e
            if attempt < max_retries:
                wait = delay_ms * (attempt + 1) / 1000
                logger.warning(
                    "Retry %d/%d after %s: %s",
                    attempt + 1, max_retries, type(e).__name__, e,
                )
                await asyncio.sleep(wait)
            else:
                logger.error(
                    "All %d retries exhausted for %s",
                    max_retries, type(e).__name__,
                )
    raise last_error  # type: ignore[misc]
