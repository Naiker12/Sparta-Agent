"""Redacts secrets from text before it is persisted to logs or memory.

Prevents API keys, tokens, and other sensitive data from leaking into
persistent storage or debug output.
"""
import logging
import re

logger = logging.getLogger("sparta_ai.security.secrets")

REDACTION_PATTERNS: list[re.Pattern] = [
    # OpenAI / Anthropic / OpenRouter keys
    re.compile(r"sk-[A-Za-z0-9]{20,}", re.IGNORECASE),
    re.compile(r"sk-ant-[A-Za-z0-9]{20,}"),
    # JWT-like tokens
    re.compile(r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}"),
    # Bearer tokens
    re.compile(r"(?:Bearer|bearer)\s+[A-Za-z0-9._-]{20,}"),
    # GitHub tokens
    re.compile(r"gh[ps]_[A-Za-z0-9]{36,}"),
    # Generic "key" or "secret" followed by a value
    re.compile(r'(?i)(?:api[_-]?key|apikey|secret|password|token)\s*[:=]\s*["\']?[A-Za-z0-9_\-]{16,}["\']?'),
    # Private keys (inline PEM)
    re.compile(r"-----BEGIN\s+(?:RSA|EC|DSA|OPENSSH|PRIVATE)\s+KEY-----"),
]

REDACTED = "[REDACTED]"


def redact_secrets(text: str) -> str:
    """Replace all known secret patterns with [REDACTED].

    Args:
        text: The text to scan for secrets.

    Returns:
        The text with any detected secrets replaced.
    """
    result = text
    for pattern in REDACTION_PATTERNS:
        result = pattern.sub(REDACTED, result)
    return result
