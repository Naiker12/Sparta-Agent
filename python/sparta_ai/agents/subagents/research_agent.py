import logging
from typing import Literal

from langchain_core.tools import tool

logger = logging.getLogger("sparta_ai.subagents.research")


@tool
def research_topic(
    topic: str,
    depth: Literal["quick", "deep"] = "quick",
) -> str:
    """
    Investiga un tema usando búsqueda web y síntesis de información.
    Úsalo cuando el usuario necesita información actualizada, investigación
    detallada, o datos que no están en tu conocimiento de base.

    Args:
        topic: El tema a investigar.
        depth: 'quick' para resumen rápido, 'deep' para investigación exhaustiva.

    Returns:
        Resultado de la investigación con citas y referencias.
    """
    from sparta_ai.tools.web_search import web_search_tool

    try:
        raw = web_search_tool.invoke({"query": topic, "count": 10 if depth == "deep" else 5})
        return _synthesize(raw, topic, depth)
    except Exception as e:
        logger.error("Research failed for topic '%s': %s", topic, e)
        return f"Error investigando '{topic}': {e}"


def _build_research_agent():
    from langchain.agents import create_react_agent
    from langchain_openai import ChatOpenAI

    llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)
    tools = [web_search_tool]
    prompt = (
        "Eres un agente de investigación. Tu tarea es buscar información "
        "completa y precisa sobre el tema solicitado. Usa web_search para "
        "obtener datos actualizados. Sintetiza los resultados en un resumen "
        "coherente con citas de las fuentes."
    )
    return create_react_agent(llm, tools, prompt=prompt)


def _synthesize(raw_results: list[dict], topic: str, depth: str) -> str:
    if not raw_results:
        return f"No se encontraron resultados para '{topic}'."

    lines = [f"## Resultados de investigación: {topic}\n"]
    for i, result in enumerate(raw_results, 1):
        title = result.get("title", "Sin título")
        snippet = result.get("snippet", "")
        url = result.get("url", "")
        lines.append(f"### {i}. {title}")
        if snippet:
            lines.append(f"   {snippet}")
        if url:
            lines.append(f"   Fuente: {url}")
        lines.append("")

    if depth == "deep" and len(raw_results) > 3:
        lines.append("---")
        lines.append("**Síntesis:** Basado en los resultados encontrados, ")
        topics = set()
        for r in raw_results:
            title = r.get("title", "")
            words = title.split()[:3]
            topics.add(" ".join(words))
        if topics:
            lines.append("los temas principales cubiertos son: " + ", ".join(f"'{t}'" for t in topics if t.strip()) + ".")

    return "\n".join(lines)
