"""Detection and handling of OpenRouter free-tier models.

Free-tier models have aggressive rate limits and shared queues that lead to
empty responses and timeouts. This module provides proactive detection and
adjusts expectations before the request is sent.
"""
import logging

logger = logging.getLogger("sparta_ai.providers.free_tier_guard")

_FREE_TIER_SUFFIXES = (":free",)


def is_free_tier_model(model: str) -> bool:
    """Check if a model identifier belongs to a free tier."""
    return any(model.lower().endswith(suffix) for suffix in _FREE_TIER_SUFFIXES)


def get_free_tier_timeout(model: str) -> float | None:
    """Return a recommended timeout in seconds for a free-tier model.

    Free models are slower under load, so we give them more time before
    giving up compared to paid models.
    """
    if is_free_tier_model(model):
        return 90.0
    return None


def get_free_tier_warning(model: str) -> str | None:
    """Return a warning string to show the user before sending, or None."""
    if is_free_tier_model(model):
        return (
            f"El modelo gratuito '{model}' puede estar saturado. "
            "La respuesta podría tardar más de lo normal o fallar."
        )
    return None
