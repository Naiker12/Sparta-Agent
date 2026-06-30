import logging
from typing import Any

from langchain_core.tools import tool

from sparta_ai.tools.web_search_providers import duckduckgo_search

logger = logging.getLogger("sparta_ai.tools.web_search")


def _format_results(query: str, results: list[dict], count: int) -> str:
    if not results:
        return (
            f"No se encontraron resultados para: **{query}**\n\n"
            "NO uses tu conocimiento de entrenamiento para inventar una respuesta. "
            "Informa al usuario que no se encontraron resultados."
        )

    lines = [f"## Resultados de búsqueda: {query}\n"]
    for i, r in enumerate(results[:count], 1):
        title = r.get("title", "Sin título")
        url = r.get("url", "")
        snippet = r.get("snippet") or r.get("description", "")
        snippet = snippet[:250]
        lines.append(f"### {i}. {title}")
        if snippet:
            lines.append(f"{snippet}")
        lines.append(f"🔗 [{url}]({url})")

    return "\n\n".join(lines)


@tool
def web_search_tool(query: str, count: int = 5) -> str:
    """
    Busca información actualizada en internet.
    Úsalo para obtener información actualizada, noticias, documentación,
    o cualquier dato que no esté en el conocimiento del modelo.
    Si hay una API key de Brave configurada la usa; si no, usa DuckDuckGo.

    Args:
        query: Términos de búsqueda.
        count: Número de resultados (máximo 10).

    Returns:
        Resultados formateados como markdown.
    """
    from sparta_ai.config.security import get_key

    api_key = get_key("brave-search")
    import httpx

    try:
        if api_key:
            response = httpx.get(
                "https://api.search.brave.com/res/v1/web/search",
                params={"q": query, "count": min(count, 10), "search_lang": "es"},
                headers={
                    "X-Subscription-Token": api_key,
                    "Accept": "application/json",
                },
                timeout=15.0,
            )
            response.raise_for_status()
            data = response.json()
            results = data.get("web", {}).get("results", [])
        else:
            results = duckduckgo_search(query, min(count, 10))

        return _format_results(query, results, count)

    except httpx.HTTPStatusError as e:
        logger.error("Brave Search API error: %s", e)
        code = e.response.status_code
        if code == 401:
            return (
                "ERROR 401: La Brave API key es inválida o expiró.\n"
                "INSTRUCCIÓN: Informa al usuario que debe actualizar su key en Ajustes > Búsqueda.\n"
                "NO uses tu conocimiento de entrenamiento como sustituto para esta respuesta."
            )
        if code == 429:
            return (
                "ERROR 429: Límite de búsquedas alcanzado temporalmente.\n"
                "Informa al usuario que intente de nuevo en unos minutos."
            )
        return (
            f"ERROR HTTP {code} en Brave Search.\n"
            f"INSTRUCCIÓN: Informa al usuario del error. NO inventes la respuesta con tu conocimiento de entrenamiento."
        )
    except httpx.TimeoutException:
        logger.error("Brave Search API timeout")
        return (
            f"TIMEOUT: La búsqueda '{query}' excedió el tiempo de espera.\n"
            "Informa al usuario. NO uses tu conocimiento de entrenamiento como sustituto."
        )
    except Exception as e:
        logger.exception("Unexpected error in web_search_tool")
        return (
            f"ERROR inesperado buscando '{query}': {e}\n"
            "Informa al usuario. NO uses tu conocimiento de entrenamiento para esta respuesta."
        )

    import httpx

    try:
        response = httpx.get(
            f"https://api.search.brave.com/res/v1/web/search",
            params={"q": query, "count": min(count, 10), "search_lang": "es"},
            headers={
                "X-Subscription-Token": api_key,
                "Accept": "application/json",
            },
            timeout=15.0,
        )
        response.raise_for_status()
        data = response.json()
        results = data.get("web", {}).get("results", [])

        if not results:
            return (
                f"No se encontraron resultados para: **{query}**\n\n"
                "NO uses tu conocimiento de entrenamiento para inventar una respuesta. "
                "Informa al usuario que no se encontraron resultados."
            )

        lines = [f"## Resultados de búsqueda: {query}\n"]
        for i, r in enumerate(results[:count], 1):
            title = r.get("title", "Sin título")
            url = r.get("url", "")
            snippet = r.get("description", "")[:250]
            lines.append(f"### {i}. {title}")
            if snippet:
                lines.append(f"{snippet}")
            lines.append(f"🔗 [{url}]({url})")

        return "\n\n".join(lines)

    except httpx.HTTPStatusError as e:
        logger.error("Brave Search API error: %s", e)
        code = e.response.status_code
        if code == 401:
            return (
                "ERROR 401: La Brave API key es inválida o expiró.\n"
                "INSTRUCCIÓN: Informa al usuario que debe actualizar su key en Ajustes > Búsqueda.\n"
                "NO uses tu conocimiento de entrenamiento como sustituto para esta respuesta."
            )
        if code == 429:
            return (
                "ERROR 429: Límite de búsquedas alcanzado temporalmente.\n"
                "Informa al usuario que intente de nuevo en unos minutos."
            )
        return (
            f"ERROR HTTP {code} en Brave Search.\n"
            f"INSTRUCCIÓN: Informa al usuario del error. NO inventes la respuesta con tu conocimiento de entrenamiento."
        )
    except httpx.TimeoutException:
        logger.error("Brave Search API timeout")
        return (
            f"TIMEOUT: La búsqueda '{query}' excedió el tiempo de espera.\n"
            "Informa al usuario. NO uses tu conocimiento de entrenamiento como sustituto."
        )
    except Exception as e:
        logger.exception("Brave Search API unexpected error")
        return (
            f"ERROR inesperado buscando '{query}': {e}\n"
            "Informa al usuario. NO uses tu conocimiento de entrenamiento para esta respuesta."
        )
