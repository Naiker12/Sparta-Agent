"""Provider health check — fast-fail for local and cloud providers with caching."""
import logging
import time
import urllib.error
import urllib.request

logger = logging.getLogger("sparta_ai.config.providers.health")

_health_cache: dict[str, tuple[float, str | None]] = {}
CACHE_TTL_SECONDS = 120.0


def check_provider_health(provider: str, vendor: str | None = None, api_url: str | None = None) -> str | None:
    """Check if a provider is reachable.

    Caches results for 120 seconds to prevent blocking the asyncio event loop
    with synchronous HTTP requests on every user turn.
    """
    v = (vendor or provider).lower()
    cache_key = f"{v}:{api_url or ''}"
    now = time.time()

    cached = _health_cache.get(cache_key)
    if cached and (now - cached[0] < CACHE_TTL_SECONDS):
        return cached[1]

    result = _perform_health_check(v, api_url)
    _health_cache[cache_key] = (now, result)
    return result


def _perform_health_check(v: str, api_url: str | None) -> str | None:
    # ── Local providers ────────────────────────────────────────────────
    local_urls = {
        "ollama": "http://localhost:11434",
        "lmstudio": "http://localhost:1234",
        "llamacpp": "http://localhost:8080",
        "local": "http://localhost:11434",
    }
    base_url = api_url.rstrip("/") if api_url else local_urls.get(v)
    if base_url:
        for path in ("/v1/models", "/api/tags", "/"):
            try:
                urllib.request.urlopen(f"{base_url}{path}", timeout=1.5)
                return None
            except urllib.error.HTTPError as e:
                if e.code in (400, 401, 403, 404, 405):
                    return None
            except Exception:
                continue

        return (
            f"No se pudo conectar al servidor local {v} ({base_url}). "
            f"Asegúrate de que el servicio esté ejecutándose."
        )

    # ── Cloud providers ────────────────────────────────────────────────
    cloud_endpoints = {
        "openrouter": "https://openrouter.ai/api/v1/models",
        "nvidia": "https://integrate.api.nvidia.com/v1/models",
        "google": "https://generativelanguage.googleapis.com/",
        "gemini": "https://generativelanguage.googleapis.com/",
        "anthropic": "https://api.anthropic.com/",
        "openai": "https://api.openai.com/v1/models",
        "groq": "https://api.groq.com/openai/v1/models",
        "deepseek": "https://api.deepseek.com/v1/models",
        "mistral": "https://api.mistral.ai/v1/models",
    }
    endpoint = cloud_endpoints.get(v)
    if not endpoint:
        return None

    try:
        req = urllib.request.Request(endpoint, method="HEAD")
        req.add_header("User-Agent", "SpartaAgent/1.0")
        urllib.request.urlopen(req, timeout=2.0)
        return None
    except urllib.error.HTTPError as e:
        if e.code in (400, 401, 403, 404, 405):
            return None
        logger.warning("Cloud provider %s returned HTTP %d", v, e.code)
        return None
    except Exception as e:
        logger.debug("Cloud health check for %s skipped: %s", v, e)
        return None