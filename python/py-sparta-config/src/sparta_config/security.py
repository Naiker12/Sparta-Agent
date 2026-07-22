import logging
from typing import Any

logger = logging.getLogger("sparta_ai.config.security")

_key_cache: dict[str, str] = {}


def store_key(key_id: str, value: str, vendor: str | None = None) -> None:
    _key_cache[key_id] = value
    logger.debug("Key stored in memory cache: %s (vendor=%s)", key_id[:8], vendor)


def get_key(key_id: str) -> str | None:
    return _key_cache.get(key_id)


def has_key(key_id: str) -> bool:
    return key_id in _key_cache


def remove_key(key_id: str) -> None:
    _key_cache.pop(key_id, None)
    logger.debug("Key removed from cache: %s", key_id[:8])


def clear_keys() -> None:
    _key_cache.clear()
    logger.debug("All keys cleared from cache")
