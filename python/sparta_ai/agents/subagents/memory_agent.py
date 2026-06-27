import json
import logging
from typing import TypedDict

from langchain_core.messages import BaseMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, START, END, MessagesState

from sparta_ai.memory.chroma_store import semantic_search
from sparta_ai.memory.graph_memory import query_graph

logger = logging.getLogger("sparta_ai.subagents.memory")


class MemoryState(MessagesState):
    query: str
    limit: int
    output: str


def _extract_query_args(messages: list[BaseMessage]) -> tuple[str, int]:
    """Extract memory query parameters from the last user/system message."""
    for msg in reversed(messages):
        content = getattr(msg, "content", "")
        if isinstance(content, str):
            try:
                parsed = json.loads(content)
                if isinstance(parsed, dict):
                    return parsed.get("query", content), parsed.get("limit", 5)
            except json.JSONDecodeError:
                pass
            return content, 5
    return "", 5


def _recall(query: str, limit: int) -> str:
    vector_results = semantic_search(query, k=limit)
    graph_results = query_graph(query)

    parts = []

    if vector_results:
        parts.append("=== Memoria Semántica ===")
        for r in vector_results:
            content = r.get("content", r.get("document", ""))
            score = r.get("score", r.get("similarity", 0))
            parts.append(f"- [{score:.2f}] {content[:200]}")

    if graph_results:
        parts.append("\n=== Grafo de Conocimiento ===")
        for r in graph_results:
            parts.append(f"- {r}")

    if not parts:
        return f"No se encontraron recuerdos relacionados con '{query}'."

    return "\n".join(parts)


@tool
def recall_memories(
    query: str,
    limit: int = 5,
) -> str:
    """
    Recupera información de la memoria semántica y el grafo de conocimiento.
    Úsalo cuando necesites recordar información de conversaciones anteriores
    o hechos almacenados sobre el usuario o el proyecto.

    Args:
        query: La consulta o tema a buscar en la memoria.
        limit: Número máximo de resultados a recuperar.

    Returns:
        Información relevante recuperada de la memoria.
    """
    try:
        return _recall(query, limit)
    except Exception as e:
        logger.error("Memory recall failed for '%s': %s", query, e)
        return f"Error recuperando memoria: {e}"


def build_memory_graph():
    """Return a compiled LangGraph sub-graph that streams through the parent."""

    async def recall_node(state: MemoryState) -> dict:
        query, limit = _extract_query_args(state["messages"])
        result = _recall(query, limit)
        return {"output": result, "query": query, "limit": limit}

    graph = StateGraph(MemoryState)
    graph.add_node("recall", recall_node)
    graph.add_edge(START, "recall")
    graph.add_edge("recall", END)

    return graph.compile()
