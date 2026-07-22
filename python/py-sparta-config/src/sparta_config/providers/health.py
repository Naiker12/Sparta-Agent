"""Provider health check — fast-fail for local and cloud providers."""
import logging
import urllib.error
import urllib.request

logger = logging.getLogger("sparta_ai.config.providers.health")


def check_provider_health(provider: str, vendor: str | None = None) -> str | None:
    """Check if a provider is reachable.

    For local providers (Ollama, LM Studio, llama.cpp), checks the /api/tags endpoint.
    For cloud providers (OpenRouter, Nvidia, Gemini), does a lightweight HTTP HEAD.
    Returns a warning string if the provider appears unhealthy, or None if OK.
    """
    v = (vendor or provider).lower()

    # ── Local providers ────────────────────────────────────────────────
    local_urls = {
        "ollama": "http://localhost:11434",
        "lmstudio": "http://localhost:1234",
        "llamacpp": "http://localhost:8080",
    }
    base_url = local_urls.get(v)
    if base_url:
        try:
            urllib.request.urlopen(f"{base_url}/api/tags", timeout=3)
            return None
        except urllib.error.URLError as e:
            return (
                f"No se pudo conectar a {v} ({base_url}). "
                f"Asegurate de que el servicio esté corriendo. "
                f"Usá /provider para cambiar de proveedor. "
                f"(Error: {e.reason})"
            )
        except Exception as e:
            return f"No se pudo verificar {v}: {e}"

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
        urllib.request.urlopen(req, timeout=5)
        return None
    except urllib.error.HTTPError as e:
        # 401/403 means the server is up but auth failed — that's fine, provider is reachable
        if e.code in (401, 403, 404):
            return None
        logger.warning("Cloud provider %s returned HTTP %d", v, e.code)
        return (
            f"El proveedor '{v}' respondió con error HTTP {e.code}. "
            "Puede estar temporalmente no disponible."
        )
    except urllib.error.URLError as e:
        logger.warning("Cloud provider %s unreachable: %s", v, e)
        return (
            f"No se pudo conectar a {v}. "
            "Verificá tu conexión a internet o intentá más tarde."
        )
    except Exception as e:
        logger.debug("Cloud health check for %s failed (non-critical): %s", v, e)
        return None