import asyncio
import logging
import re
import time

import httpx
from langchain_core.runnables import RunnableConfig
from langchain_core.tools import tool

from sparta_ai.tools.web_progress import dispatch_progress
from sparta_ai.tools.web_search_providers import duckduckgo_search

logger = logging.getLogger("sparta_ai.tools.web_search")

# Simple in-memory cache for identical search queries (TTL: 5 minutes)
_search_cache: dict[str, tuple[float, list[dict]]] = {}
_CACHE_TTL = 300  # seconds


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


# Realtime patterns — matched against the search query to auto-apply freshness filter
_REALTIME_PATTERNS = [
    re.compile(r"\b(qu[eé] d[ií]a|qu[eé] fecha|fecha de hoy|d[ií]a de hoy|hoy es|hoy cu[aá]l)\b", re.IGNORECASE),
    re.compile(r"\b(qu[eé] hora|hora actual|hora es)\b", re.IGNORECASE),
    re.compile(r"\b(hoy|ahora|actualmente|en este momento|right now|today|current(ly)?)\b.*\b(fecha|d[ií]a|hora|a[nñ]o|mes|semana)\b", re.IGNORECASE),
    re.compile(r"\b(precio actual|cotizaci[oó]n|tipo de cambio|dolar hoy|euro hoy)\b", re.IGNORECASE),
    re.compile(r"\b(clima|tiempo hoy|temperatura hoy|lluvia hoy)\b", re.IGNORECASE),
    re.compile(r"\b(noticias de hoy|[uú]ltimas noticias|breaking news)\b", re.IGNORECASE),
    re.compile(r"\b(qui[eé]n va ganando|qui[eé]n gana|resultado|marcador|partido[sz]? en vivo|va ganando)\b", re.IGNORECASE),
    re.compile(r"\b(deporte[s]?|f[uú]tbol|mundial|champions|liga|partido|juega[n]?|jugar[aá]n)\b.*\b(contra|vs\.?|versus)\b", re.IGNORECASE),
]


def _detect_freshness(query: str) -> str | None:
    """Detect if a query needs fresh results and return the appropriate
    DuckDuckGo freshness parameter (df) value.
    
    Returns 'd' (day), 'w' (week), or None for no filter.
    """
    lowered = query.lower().strip()
    # Strong signals for "right now" data → use day filter
    if any(p.search(lowered) for p in _REALTIME_PATTERNS):
        return "d"
    # Words suggesting recent events → week filter
    if re.search(r"\b(esta semana|this week|reciente|new|latest|nuevo|ultim[oa])\b", lowered, re.IGNORECASE):
        return "w"
    return None


async def _brave_search(query: str, count: int, api_key: str, freshness: str | None = None) -> list[dict]:
    params: dict[str, object] = {"q": query, "count": min(count, 10)}
    if freshness:
        # Brave Search uses: 'pd' (past day), 'pw' (past week), 'pm' (past month), 'py' (past year)
        brave_map = {"d": "pd", "w": "pw", "m": "pm", "y": "py"}
        params["freshness"] = brave_map.get(freshness, "pw")
    async with httpx.AsyncClient(timeout=15.0) as client:
        response = await client.get(
            "https://api.search.brave.com/res/v1/web/search",
            params=params,
            headers={
                "X-Subscription-Token": api_key,
                "Accept": "application/json",
            },
        )
        response.raise_for_status()
        data = response.json()
        return data.get("web", {}).get("results", [])


async def _duckduckgo_search_async(query: str, count: int, freshness: str | None = None) -> list[dict]:
    """Run the sync DuckDuckGo scraper in a thread to avoid blocking the loop."""
    return await asyncio.to_thread(duckduckgo_search, query, min(count, 10), freshness)


@tool
async def web_search_tool(
    query: str,
    count: int = 5,
    config: RunnableConfig | None = None,
) -> str:
    """
    Busca información actualizada en internet.
    Úsalo para obtener información actualizada, noticias, documentación,
    o cualquier dato que no esté en el conocimiento del modelo.
    Usa DuckDuckGo de forma predeterminada (sin API key).
    Si hay una API key de Brave configurada, intenta Brave primero.

    Args:
        query: Términos de búsqueda.
        count: Número de resultados (máximo 10).

    Returns:
        Resultados formateados como markdown.
    """
    from sparta_ai.config.security import get_key

    # Extract tool_call_id from RunnableConfig (set by LangGraph ToolNode)
    tool_call_id = (config.get("configurable", {}).get("tool_call_id") if config else None) or None

    api_key = get_key("brave-search")
    count = min(count, 10)

    await dispatch_progress("searching", query=query, tool_call_id=tool_call_id)

    # Check cache for identical query
    now = time.monotonic()
    cache_key = f"{query}:{count}"
    if cache_key in _search_cache:
        cached_time, cached_results = _search_cache[cache_key]
        if now - cached_time < _CACHE_TTL:
            logger.debug("Cache hit for query: %s", query)
            for i, r in enumerate(cached_results[:count], 1):
                await dispatch_progress(
                    "visiting",
                    url=r.get("url", ""),
                    title=r.get("title", "Sin título"),
                    index=i,
                    total=len(cached_results[:count]),
                    tool_call_id=tool_call_id,
                )
                if i < len(cached_results[:count]):
                    await asyncio.sleep(0.1)
            await dispatch_progress("done", tool_call_id=tool_call_id)
            return _format_results(query, cached_results, count)

    results: list[dict] = []

    # Auto-detect freshness filter for realtime queries
    freshness = _detect_freshness(query)
    if freshness:
        logger.debug("Applying freshness filter '%s' for query: %s", freshness, query)

    try:
        if api_key:
            try:
                results = await asyncio.wait_for(
                    _brave_search(query, count, api_key, freshness), timeout=20.0
                )
            except TimeoutError:
                logger.warning("Brave Search timed out, falling back to DuckDuckGo")
                results = await asyncio.wait_for(
                    _duckduckgo_search_async(query, count, freshness), timeout=15.0
                )
            except Exception as e:
                logger.warning("Brave Search failed (%s), falling back to DuckDuckGo", e)
                results = await asyncio.wait_for(
                    _duckduckgo_search_async(query, count, freshness), timeout=15.0
                )
        else:
            results = await asyncio.wait_for(
                _duckduckgo_search_async(query, count, freshness), timeout=15.0
            )

        # Emitimos cada resultado con un pequeño espaciado para que la UI
        # pueda animarlos uno por uno (como hace Claude Code), en vez de
        # recibirlos todos en el mismo tick de evento. El costo total es
        # de unos ~150ms por resultado, imperceptible frente a los 1-3s
        # que ya toma la búsqueda en sí.
        for i, r in enumerate(results[:count], 1):
            await dispatch_progress(
                "visiting",
                url=r.get("url", ""),
                title=r.get("title", "Sin título"),
                index=i,
                total=len(results[:count]),
                tool_call_id=tool_call_id,
            )
            if i < len(results[:count]):
                await asyncio.sleep(0.15)

        await dispatch_progress("done", tool_call_id=tool_call_id)

        # Store in cache for identical future queries
        _search_cache[cache_key] = (time.monotonic(), results)
        # Evict old entries
        if len(_search_cache) > 50:
            oldest = min(_search_cache, key=lambda k: _search_cache[k][0])
            del _search_cache[oldest]

        return _format_results(query, results, count)

    except TimeoutError:
        logger.error("Search timed out for query: %s", query)
        return (
            f"TIMEOUT: La búsqueda '{query}' excedió el tiempo de espera total.\n"
            "Informa al usuario. NO uses tu conocimiento de entrenamiento como sustituto."
        )
    except httpx.HTTPStatusError as e:
        logger.error("Search HTTP error: %s", e)
        code = e.response.status_code
        if code == 401 and api_key:
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
            f"ERROR HTTP {code} en la búsqueda.\n"
            f"INSTRUCCIÓN: Informa al usuario del error. NO inventes la respuesta "
            f"con tu conocimiento de entrenamiento."
        )
    except httpx.TimeoutException:
        logger.error("Search HTTP timeout")
        return (
            f"TIMEOUT: La búsqueda '{query}' excedió el tiempo de espera HTTP.\n"
            "Informa al usuario. NO uses tu conocimiento de entrenamiento como sustituto."
        )
    except Exception as e:
        logger.exception("Unexpected error in web_search_tool")
        return (
            f"ERROR inesperado buscando '{query}': {e}\n"
            "Informa al usuario. NO uses tu conocimiento de entrenamiento para esta respuesta."
        )