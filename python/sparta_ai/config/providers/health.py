"""Provider health check — fast-fail for local providers before LLM construction."""
import urllib.error
import urllib.request


def check_provider_health(provider: str, vendor: str | None = None) -> str | None:
    """Check if a local provider (Ollama, LM Studio, llama.cpp) is reachable.

    Returns a warning string if the provider appears unhealthy, or None if OK.
    For cloud providers, always returns None (no health check).
    """
    v = (vendor or provider).lower()
    base_urls = {
        "ollama": "http://localhost:11434",
        "lmstudio": "http://localhost:1234",
        "llamacpp": "http://localhost:8080",
    }
    base_url = base_urls.get(v)
    if not base_url:
        return None

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