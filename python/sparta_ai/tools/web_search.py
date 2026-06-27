import logging
from typing import Any

from langchain_core.tools import tool

logger = logging.getLogger("sparta_ai.tools.web_search")


@tool
def web_search_tool(query: str, count: int = 5) -> list[dict[str, Any]]:
    """
    Busca información en la web usando Brave Search API.
    Úsalo para obtener información actualizada, noticias, documentación,
    o cualquier dato que no esté en el conocimiento del modelo.

    Args:
        query: Términos de búsqueda.
        count: Número de resultados (máximo 10).

    Returns:
        Lista de resultados con título, snippet y URL.
    """
    from sparta_ai.config.security import get_key

    api_key = get_key("brave-search")
    if not api_key:
        logger.warning("Brave Search API key not configured")
        return [{"title": "Error", "snippet": "Brave Search API key no configurada. Ve a Configuración > Búsqueda.", "url": ""}]

    import httpx

    try:
        response = httpx.get(
            f"https://api.search.brave.com/res/v1/web/search",
            params={"q": query, "count": min(count, 10)},
            headers={
                "X-Subscription-Token": api_key,
                "Accept": "application/json",
            },
            timeout=15.0,
        )
        response.raise_for_status()
        data = response.json()
        results = data.get("web", {}).get("results", [])
        return [
            {
                "title": r.get("title", ""),
                "snippet": r.get("description", ""),
                "url": r.get("url", ""),
            }
            for r in results
        ]
    except httpx.HTTPStatusError as e:
        logger.error("Brave Search API error: %s", e)
        return [{"title": "Error HTTP", "snippet": f"Error {e.response.status_code} en Brave Search: {e.response.text}", "url": ""}]
    except httpx.TimeoutException:
        logger.error("Brave Search API timeout")
        return [{"title": "Timeout", "snippet": "La búsqueda web excedió el tiempo de espera.", "url": ""}]
    except Exception as e:
        logger.exception("Brave Search API unexpected error")
        return [{"title": "Error", "snippet": f"Error inesperado: {e}", "url": ""}]
