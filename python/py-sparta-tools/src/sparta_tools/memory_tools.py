import logging
from typing import Any

from langchain_core.tools import tool

logger = logging.getLogger("sparta_ai.tools.memory")


@tool
def read_memory_tool(query: str, k: int = 5) -> str:
    """
    Recupera entradas de la memoria semántica relevantes a una consulta.
    Úsalo para recordar información de conversaciones anteriores,
    datos del usuario, o hechos previamente almacenados.

    Args:
        query: Texto de búsqueda para encontrar memorias relevantes.
        k: Número de resultados a retornar (máximo 10).

    Returns:
        Entradas de memoria formateadas como texto.
    """
    from sparta_memory.chroma_store import semantic_search

    try:
        results = semantic_search(query, k=min(k, 10))
        if not results:
            return f"No se encontraron memorias para: '{query}'."

        lines = [f"--- Memorias relevantes para: '{query}' ---"]
        for i, r in enumerate(results, 1):
            content = r.get("content", r.get("document", ""))
            score = r.get("score", r.get("similarity", 0))
            lines.append(f"{i}. [similitud: {score:.3f}] {content}")
        return "\n".join(lines)

    except Exception as e:
        logger.error("read_memory_tool failed: %s", e)
        return f"Error al leer memoria: {e}"


@tool
def write_memory_tool(
    content: str,
    memory_type: str = "general",
    tags: list[str] | None = None,
) -> str:
    """
    Almacena una nueva entrada en la memoria semántica.
    Úsalo cuando el usuario comparta información importante que deba
    ser recordada en el futuro.

    Args:
        content: El contenido de la memoria a almacenar.
        memory_type: Tipo de memoria (general, fact, preference, project).
        tags: Lista opcional de etiquetas para categorizar.

    Returns:
        Confirmación del almacenamiento.
    """
    from sparta_memory.chroma_store import index_entry

    try:
        entry = {
            "content": content,
            "memory_type": memory_type or "general",
            "tags": tags or [],
            "timestamp": __import__("time").time(),
        }
        entry_id = index_entry(entry)
        logger.info("Memory stored: id=%s type=%s", entry_id, memory_type)
        return f"Memoria almacenada correctamente (id: {entry_id})."

    except Exception as e:
        logger.error("write_memory_tool failed: %s", e)
        return f"Error al almacenar memoria: {e}"
