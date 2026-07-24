"""Detection and handling of OpenRouter free-tier and shared-queue models.

Free-tier and community models have rate limits and shared queues that lead to
delayed responses and timeouts. This module provides proactive detection and
adjusts expectations before the request is sent.
"""
import logging

logger = logging.getLogger("sparta_ai.providers.free_tier_guard")

# Specific patterns for free/shared queue models — NOT all paid OpenRouter models!
_FREE_TIER_PATTERNS = (":free", "z-ai/", "free/", ":community", "openrouter/free")


def is_free_tier_model(model: str) -> bool:
    """Check if a model identifier belongs to a free or shared-queue tier."""
    m = model.lower()
    return any(pat in m for pat in _FREE_TIER_PATTERNS)


def get_free_tier_timeout(model: str) -> float | None:
    """Return a recommended timeout in seconds for a free-tier model.

    Free models are slower under load, so we give them more time before
    giving up compared to paid models.
    """
    if is_free_tier_model(model):
        return 120.0
    return None


def get_free_tier_warning(model: str) -> str | None:
    """Return a warning string to show the user before sending, or None."""
    if is_free_tier_model(model):
        return (
            f"El modelo gratuito/compartido '{model}' puede estar en cola. "
            "La respuesta podría tardar más de lo normal en iniciar."
        )
    return None
