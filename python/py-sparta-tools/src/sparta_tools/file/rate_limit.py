"""Rate limiting helper for file tools."""
from sparta_security.rate_limiter import tool_rate_limiter


def _check_rate_limit(tool_name: str) -> bool:
    """Check if this tool call passes the global tool rate limiter.

    Uses the tool name as key (coarse but effective — 30 req/s global
    across all sessions per tool type).  Returns True if allowed.
    """
    return tool_rate_limiter.check(f"file:{tool_name}")
