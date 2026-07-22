"""Shared HTTP connection pool for web tools.

Replaces per-call httpx.AsyncClient creation with a module-level client that
reuses TCP connections across web_fetch, web_search (Brave), and other HTTP
calls. This eliminates repeated DNS resolution + TLS handshakes.
"""
import httpx

_CLIENT_TIMEOUT = 15.0
_CLIENT: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    """Return the shared async HTTP client, creating it on first use."""
    global _CLIENT
    if _CLIENT is None or _CLIENT.is_closed:
        _CLIENT = httpx.AsyncClient(
            timeout=_CLIENT_TIMEOUT,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; SpartaAgent/1.0)"},
            limits=httpx.Limits(
                max_connections=20,
                max_keepalive_connections=10,
                keepalive_expiry=30.0,
            ),
        )
    return _CLIENT


async def close_pool() -> None:
    """Shut down the shared HTTP client (call on sidecar shutdown)."""
    global _CLIENT
    if _CLIENT and not _CLIENT.is_closed:
        await _CLIENT.aclose()
    _CLIENT = None
