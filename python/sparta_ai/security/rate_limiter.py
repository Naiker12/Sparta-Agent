"""Per-session rate limiter for terminal commands and tool calls."""

import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field

logger = logging.getLogger("sparta_ai.security.rate_limiter")


@dataclass
class Bucket:
    tokens: float
    last_refill: float


class RateLimiter:
    """Token-bucket rate limiter, keyed by session or origin.

    Each key gets ``capacity`` tokens that refill at ``refill_rate``
    tokens/second.  A token is consumed on every call to ``check()``.
    """

    def __init__(self, capacity: float = 10, refill_rate: float = 2.0):
        self._capacity = capacity
        self._refill_rate = refill_rate
        self._buckets: dict[str, Bucket] = {}
        self._total_blocked = 0

    def _refill(self, key: str) -> None:
        now = time.monotonic()
        b = self._buckets.get(key)
        if b is None:
            self._buckets[key] = Bucket(tokens=self._capacity, last_refill=now)
            return
        elapsed = now - b.last_refill
        b.tokens = min(self._capacity, b.tokens + elapsed * self._refill_rate)
        b.last_refill = now

    def check(self, key: str, cost: float = 1.0) -> bool:
        """Return True if the request passes, False if rate-limited."""
        self._refill(key)
        b = self._buckets[key]
        if b.tokens >= cost:
            b.tokens -= cost
            return True
        self._total_blocked += 1
        logger.warning("Rate limited key=%s (blocked=%d)", key[:40], self._total_blocked)
        return False

    def remaining(self, key: str) -> float:
        """Return remaining tokens for a key (approximate)."""
        self._refill(key)
        return self._buckets.get(key, Bucket(0, 0)).tokens

    def reset(self, key: str) -> None:
        self._buckets.pop(key, None)


# Global singleton — shared across all security modules.
terminal_rate_limiter = RateLimiter(capacity=15, refill_rate=3.0)
tool_rate_limiter = RateLimiter(capacity=30, refill_rate=5.0)
