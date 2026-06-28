import logging
from typing import Any

from langchain_core.tools import tool

logger = logging.getLogger("sparta_ai.tools.web_search")


@tool
def web_search_tool(query: str, count: int = 5) -> str:
    """
    Busca información actualizada en internet usando Brave Search API.
    Úsalo para obtener información actualizada, noticias, documentación,
    o cualquier dato que no esté en el conocimiento del modelo.

    Args:
        query: Términos de búsqueda.
        count: Número de resultados (máximo 10).

    Returns:
        Resultados formateados como markdown.
    """
    from sparta_ai.config.security import get_key

    api_key = get_key("brave-search")
    if not api_key:
        logger.warning("Brave Search API key not configured")
        return (
            "ERROR: Brave Search API key no configurada.\n"
            "INSTRUCCIÓN: Informa al usuario que necesita configurar la Brave API key en Ajustes > Búsqueda.\n"
            "ADVERTENCIA: NO uses tu conocimiento de entrenamiento para responder preguntas sobre fecha/hora actual, "
            "precios actuales, eventos recientes o cualquier información que requiera datos actualizados. "
            "Si el usuario pregunta por la fecha o clima, indícale que active la búsqueda web.")

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
