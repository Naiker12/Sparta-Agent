import logging
from typing import Any

from sparta_memory.chroma_store import (
    _get_collection,
    _get_folder_index_collection,
    _get_web_cache_collection,
    is_available,
)

logger = logging.getLogger("sparta_ai.memory.chroma")


def count_entries() -> int:
    if not is_available():
        return 0
    try:
        collection = _get_collection()
        return collection.count()
    except Exception as e:
        logger.error("Failed to count entries: %s", e)
        return 0


def semantic_search(query: str, k: int = 5) -> list[dict[str, Any]]:
    if not is_available():
        return []
    try:
        from sparta_memory.embeddings import embed_text

        collection = _get_collection()
        results = collection.query(
            query_embeddings=[embed_text(query)],
            n_results=min(k, 10),
            include=["documents", "metadatas", "distances"],
        )

        ids = results.get("ids", [[]])[0]
        documents = results.get("documents", [[]])[0]
        distances = results.get("distances", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]

        entries = []
        for i in range(len(ids)):
            score = 1.0 - (distances[i] if i < len(distances) else 0.0)
            entries.append({
                "id": ids[i],
                "content": documents[i] if i < len(documents) else "",
                "score": score,
                "metadata": metadatas[i] if i < len(metadatas) else {},
            })

        logger.debug("Semantic search for '%s': %d results", query[:50], len(entries))
        return entries

    except Exception as e:
        logger.error("Semantic search failed: %s", e)
        return []


def search_web_cache(query: str, k: int = 5, max_age_seconds: int = 86400 * 3) -> list[dict]:
    """Search the web research cache, ignoring entries older than max_age_seconds.

    Retrieval is two-stage:
      1. Vector search returns a candidate set (k * 2).
      2. Cross-encoder reranker re-orders the candidates and returns the top k.
    """
    if not is_available():
        return []
    try:
        import time
        from sparta_memory.embeddings import embed_text
        from sparta_memory.rerank import rerank

        collection = _get_web_cache_collection()
        results = collection.query(
            query_embeddings=[embed_text(query)],
            n_results=min(k * 3, 30),
            include=["documents", "metadatas", "distances"],
        )

        ids = results.get("ids", [[]])[0]
        documents = results.get("documents", [[]])[0]
        distances = results.get("distances", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]

        now = time.time()
        candidates: list[dict] = []
        for i in range(len(ids)):
            meta = metadatas[i] if i < len(metadatas) else {}
            if now - meta.get("indexed_at", 0) > max_age_seconds:
                continue
            score = 1.0 - (distances[i] if i < len(distances) else 0.0)
            candidates.append({
                "id": ids[i],
                "content": documents[i] if i < len(documents) else "",
                "url": meta.get("url"),
                "topic": meta.get("topic"),
                "score": score,
            })

        reranked = rerank(query, candidates, top_k=k)
        logger.debug(
            "Web cache search for '%s': %d candidates, %d reranked results",
            query[:50], len(candidates), len(reranked),
        )
        return reranked
    except Exception as e:
        logger.error("Web cache search failed: %s", e)
        return []


def search_folder_index(query: str, folder_path: str, k: int = 5) -> list[dict]:
    """Search the folder index, filtering by folder_path."""
    if not is_available():
        return []
    try:
        from sparta_memory.embeddings import embed_text

        collection = _get_folder_index_collection()
        results = collection.query(
            query_embeddings=[embed_text(query)],
            n_results=min(k, 10),
            where={"folder": folder_path},
            include=["documents", "metadatas", "distances"],
        )

        ids = results.get("ids", [[]])[0]
        documents = results.get("documents", [[]])[0]
        distances = results.get("distances", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]

        entries = []
        for i in range(len(ids)):
            score = 1.0 - (distances[i] if i < len(distances) else 0.0)
            meta = metadatas[i] if i < len(metadatas) else {}
            entries.append({
                "id": ids[i],
                "content": documents[i] if i < len(documents) else "",
                "path": meta.get("path", ""),
                "score": score,
            })
        return entries

    except Exception as e:
        logger.error("Folder index search failed for %s: %s", folder_path, e)
        return []
