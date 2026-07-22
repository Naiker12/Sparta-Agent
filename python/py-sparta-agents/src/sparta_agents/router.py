import re
from typing import Literal

Intent = Literal["chat", "agent", "memory_query", "code_task", "research"]


def classify_intent(
    message: str,
    active_skills: list[str] | None = None,
    web_search_available: bool = False,
) -> Intent:
    lowered = message.lower().strip()

    code_patterns = [
        r"\b(code|script|programa|implementa|crea un archivo|escribe un script)\b",
        r"```\w*",
        r"\b(refactor(iza|izar)?|debug|test(ea|ear)?|compile|run|execute|npm|pip|git)\b",
    ]
    research_patterns = [
        r"\b(busca|investiga|encuentra|googlea|averigua|research|search for|buscar)\b",
        r"\b(últimas noticias|latest|news about|qué pasó|what happened)\b",
        r"\b(en internet|en la web|en google|online)\b",
    ]
    # Queries that genuinely need web search (weather, prices, news, sports)
    # NOTE: Pure date/time questions ("qué día es hoy", "qué hora es") are NOT here —
    # the system prompt injects datetime.now() so the agent answers directly.
    realtime_patterns = [
        r"\b(precio actual|cotizaci[oó]n|tipo de cambio|dolar hoy|euro hoy)\b",
        r"\b(clima|tiempo (hace|actual)|temperatura (hoy|actual)|lluvia (hoy|actual))\b",
        r"\b(noticias de hoy|[uú]ltimas noticias|breaking news)\b",
        r"\b(qui[eé]n va ganando|qui[eé]n gana|resultado|marcador|partido[sz]? en vivo|va ganando)\b",
        r"\b(deporte[s]?|f[uú]tbol|mundial|champions|liga|partido|juega[n]?|jugar[aá]n)\b.*\b(contra|vs\.?|versus)\b",
    ]
    memory_patterns = [
        r"\b(recuérdame|qué dije|acerca de|qué sabes de|remember|what did I)\b",
        r"\b(memoria|memory|recuerda|olvida)\b",
    ]

    if any(re.search(p, lowered) for p in code_patterns):
        return "code_task"
    if any(re.search(p, lowered) for p in research_patterns):
        return "research"
    # Real-time queries: force research intent only when web_search is available
    if web_search_available and any(re.search(p, lowered) for p in realtime_patterns):
        return "research"
    if any(re.search(p, lowered) for p in memory_patterns):
        return "memory_query"

    active_skills_set = set(s or "" for s in (active_skills or []))
    if "coding" in active_skills_set or "development" in active_skills_set:
        return "agent"
    if "research" in active_skills_set:
        return "research"

    return "chat"
