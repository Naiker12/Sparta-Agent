import asyncio
import logging
from typing import Any

import httpx
from langchain_core.callbacks.manager import adispatch_custom_event
from langchain_core.tools import tool

from sparta_ai.tools.web_search_providers import duckduckgo_search

logger = logging.getLogger("sparta_ai.tools.web_search")


def _format_results(query: str, results: list[dict], count: int) -> str:
    if not results:
        return (
            f"No se encontraron resultados para: {query}\n\n"
            "NO uses tu conocimiento de entrenamiento para inventar una respuesta. "
            "Informa al usuario que no se encontraron resultados."
        )

    lines = [
        f"[Búsqueda web completada: {len(results[:count])} resultados para '{query}']",
        "IMPORTANTE: El usuario ya ve las URLs y títulos en la interfaz. NO repitas la lista de resultados.",
        "Usa esta información para responder DIRECTAMENTE la pregunta del usuario.\n",
    ]
    for i, r in enumerate(results[:count], 1):
        title = r.get("title", "Sin título")
        source = r.get("url", "").split("/")[2] if "/" in r.get("url", "") else ""
        snippet = r.get("snippet") or r.get("description", "")
        snippet = snippet[:300]
        lines.append(f"{i}. [{source}] {title}")
        if snippet:
            lines.append(f"   {snippet}")

    return "\n".join(lines)


async def _brave_search(query: str, count: int, api_key: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            "https://api.search.brave.com/res/v1/web/search",
            params={"q": query, "count": min(count, 10), "search_lang": "es"},
            headers={
                "X-Subscription-Token": api_key,
                "Accept": "application/json",
            },
        )
        response.raise_for_status()
        data = response.json()
        return data.get("web", {}).get("results", [])


async def _duckduckgo_search_async(query: str, count: int) -> list[dict]:
    """Run the sync DuckDuckGo scraper in a thread to avoid blocking the loop."""
    return await asyncio.to_thread(duckduckgo_search, query, min(count, 10))


async def _dispatch_progress(stage: str, **kwargs: Any) -> None:
    """Emit a progress event that the event bridge forwards to the UI."""
    try:
        await adispatch_custom_event(
            "tool_progress",
            {"stage": stage, **kwargs},
        )
    except Exception:
        # If there is no active callback context (e.g. sync test invocation),
        # swallow the error so the tool still returns useful results.
        logger.debug("Could not dispatch tool_progress event (no callback context)")


@tool
async def web_search_tool(query: str, count: int = 5) -> str:
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
    count = min(count, 10)

    await _dispatch_progress("searching", query=query)

    try:
        if api_key:
            results = await _brave_search(query, count, api_key)
        else:
            results = await _duckduckgo_search_async(query, count)

        for i, r in enumerate(results[:count], 1):
            await _dispatch_progress(
                "visiting",
                url=r.get("url", ""),
                title=r.get("title", "Sin título"),
                index=i,
                total=len(results[:count]),
            )
            # Small staggered delay so the UI shows each result appearing
            # one by one with smooth animation (real-time feel)
            await asyncio.sleep(0.15)

        await _dispatch_progress("done")
        return _format_results(query, results, count)

    except httpx.HTTPStatusError as e:
        logger.error("Brave Search API error: %s", e)
        code = e.response.status_code
        if code == 401:
            return (
                "ERROR 401: La Brave API key es inválida o expiró.\n"
                "INSTRUCCIÓN: Informa al usuario que debe actualizar su key en "
                "Ajustes > Búsqueda.\n"
                "NO uses tu conocimiento de entrenamiento como sustituto para esta respuesta."
            )
        if code == 429:
            return (
                "ERROR 429: Límite de búsquedas alcanzado temporalmente.\n"
                "Informa al usuario que intente de nuevo en unos minutos."
            )
        return (
            f"ERROR HTTP {code} en Brave Search.\n"
            f"INSTRUCCIÓN: Informa al usuario del error. NO inventes la respuesta "
            f"con tu conocimiento de entrenamiento."
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
