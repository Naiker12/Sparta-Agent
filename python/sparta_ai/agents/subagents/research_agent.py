import json
import logging

from langchain_core.messages import BaseMessage, SystemMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import END, START, MessagesState, StateGraph
from langgraph.prebuilt import ToolNode

from sparta_ai.tools.web_search import web_search_tool

logger = logging.getLogger("sparta_ai.subagents.research")


class ResearchState(MessagesState):
    topic: str
    depth: str
    output: str


RESEARCH_PROMPT = (
    "Eres un agente de investigación. Tu tarea es buscar información "
    "completa y precisa sobre el tema solicitado. Usa web_search para "
    "obtener datos actualizados. Sintetiza los resultados en un resumen "
    "coherente con citas de las fuentes."
)


def _extract_topic_and_depth(messages: list[BaseMessage]) -> tuple[str, str]:
    """Extract research parameters from the last user/system message."""
    for msg in reversed(messages):
        content = getattr(msg, "content", "")
        if isinstance(content, str):
            try:
                parsed = json.loads(content)
                if isinstance(parsed, dict):
                    return parsed.get("topic", content), parsed.get("depth", "quick")
            except json.JSONDecodeError:
                pass
            return content, "quick"
    return "", "quick"


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
            lines.append(
                "los temas principales cubiertos son: "
                + ", ".join(f"'{t}'" for t in topics if t.strip())
                + "."
            )

    return "\n".join(lines)


@tool
async def research_topic(
    topic: str,
    depth: str = "quick",
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
    try:
        raw = await web_search_tool.ainvoke({"query": topic, "count": 10 if depth == "deep" else 5})
        return raw
    except Exception as e:
        logger.error("Research failed for topic '%s': %s", topic, e)
        return f"Error investigando '{topic}': {e}"


def build_research_graph(llm=None):
    """Return a compiled LangGraph sub-graph that streams through the parent.

    Args:
        llm: Optional LLM instance from the parent graph. If None, falls back
             to ChatOpenAI(model="gpt-4o-mini") for backward compatibility.
    """
    if llm is None:
        llm = ChatOpenAI(model="gpt-4o-mini", temperature=0.3)
    tools = [web_search_tool]
    llm_with_tools = llm.bind_tools(tools)

    async def agent_node(state: ResearchState) -> dict:
        topic, depth = _extract_topic_and_depth(state["messages"])
        system = SystemMessage(content=RESEARCH_PROMPT)
        user = f"Investiga el tema: {topic}\nProfundidad: {depth}"
        response = await llm_with_tools.ainvoke([system, *state["messages"], user])
        return {"messages": [response], "topic": topic, "depth": depth}

    async def tool_node(state: ResearchState) -> dict:
        exec_node = ToolNode(tools)
        result = await exec_node.ainvoke(state)
        return result

    def should_continue(state: ResearchState) -> str:
        last = state["messages"][-1]
        tool_calls = getattr(last, "tool_calls", [])
        if tool_calls:
            return "tools"
        return "output"

    def output_node(state: ResearchState) -> dict:
        last = state["messages"][-1]
        return {"output": getattr(last, "content", str(last))}

    graph = StateGraph(ResearchState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", tool_node)
    graph.add_node("output", output_node)

    graph.add_edge(START, "agent")
    graph.add_conditional_edges(
        "agent",
        should_continue,
        {"tools": "tools", "output": "output"},
    )
    graph.add_edge("tools", "agent")
    graph.add_edge("output", END)

    return graph.compile()
