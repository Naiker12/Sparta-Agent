from __future__ import annotations
import httpx
from typing import Optional

_client: Optional[httpx.AsyncClient] = None


def nonstreaming_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(timeout=120.0)
    return _client


async def aclose():
    global _client
    if _client is not None and not _client.is_closed:
        await _client.aclose()
    _client = None
