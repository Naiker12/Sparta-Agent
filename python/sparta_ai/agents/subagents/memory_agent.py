import logging
from langchain_core.tools import tool

logger = logging.getLogger("sparta_ai.subagents.memory")


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
    from sparta_ai.memory.chroma_store import semantic_search
    from sparta_ai.memory.graph_memory import query_graph

    try:
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

    except Exception as e:
        logger.error("Memory recall failed for '%s': %s", query, e)
        return f"Error recuperando memoria: {e}"
