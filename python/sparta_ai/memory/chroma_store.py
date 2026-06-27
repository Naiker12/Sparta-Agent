import logging
import uuid
from typing import Any

import chromadb
from chromadb.config import Settings

logger = logging.getLogger("sparta_ai.memory.chroma")

_client: Any = None
_collection: Any = None
_embeddings_provider: str = "openai"
_chromadb_available: bool | None = None


def is_available() -> bool:
    """Check whether ChromaDB is reachable at localhost:8000."""
    global _chromadb_available
    if _chromadb_available is not None:
        return _chromadb_available

    try:
        client = chromadb.HttpClient(
            host="localhost",
            port=8000,
            settings=Settings(anonymized_telemetry=False),
        )
        client.heartbeat()
        _chromadb_available = True
        logger.info("ChromaDB is available at localhost:8000")
    except Exception as e:
        _chromadb_available = False
        logger.warning("ChromaDB not available at localhost:8000: %s. Semantic memory will be disabled.", e)
    return _chromadb_available


def _get_client() -> Any:
    global _client
    if _client is None:
        _client = chromadb.HttpClient(
            host="localhost",
            port=8000,
            settings=Settings(anonymized_telemetry=False),
        )
        logger.info("ChromaDB client connected to localhost:8000")
    return _client


def _get_collection() -> Any:
    global _collection
    if _collection is None:
        client = _get_client()
        try:
            _collection = client.get_collection("sparta_memory")
            logger.info("ChromaDB collection 'sparta_memory' loaded")
        except ValueError:
            _collection = client.create_collection("sparta_memory")
            logger.info("ChromaDB collection 'sparta_memory' created")
    return _collection


def set_embedding_provider(provider: str) -> None:
    global _embeddings_provider
    _embeddings_provider = provider
    logger.info("Embedding provider set to: %s", provider)


def index_entry(entry: dict) -> str | None:
    if not is_available():
        return None
    try:
        collection = _get_collection()
        entry_id = entry.get("id", str(uuid.uuid4()))
        content = entry.get("content", "")
        metadata = {
            "memory_type": entry.get("memory_type", "general"),
            "tags": ",".join(entry.get("tags", [])),
            "timestamp": entry.get("timestamp", 0),
        }
        collection.add(
            ids=[entry_id],
            documents=[content],
            metadatas=[metadata],
        )
        logger.debug("Indexed entry %s in ChromaDB", entry_id[:8])
        return entry_id
    except Exception as e:
        logger.error("Failed to index entry in ChromaDB: %s", e)
        return None


def semantic_search(query: str, k: int = 5) -> list[dict[str, Any]]:
    if not is_available():
        return []
    try:
        collection = _get_collection()
        results = collection.query(
            query_texts=[query],
            n_results=min(k, 10),
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


async def build_memory_context(query: str, k: int = 5) -> str:
    if not is_available():
        return ""
    results = semantic_search(query, k=k)
    if not results:
        return ""

    lines = ["Información relevante de memoria semántica:"]
    for r in results:
        content = r.get("content", "")
        score = r.get("score", 0)
        if score >= 0.5 and content:
            lines.append(f"- {content[:300]}")
    return "\n".join(lines)


def count_entries() -> int:
    if not is_available():
        return 0
    try:
        collection = _get_collection()
        return collection.count()
    except Exception as e:
        logger.error("Failed to count entries: %s", e)
        return 0


def delete_entry(entry_id: str) -> None:
    if not is_available():
        return
    try:
        collection = _get_collection()
        collection.delete(ids=[entry_id])
        logger.info("Deleted entry %s from ChromaDB", entry_id[:8])
    except Exception as e:
        logger.error("Failed to delete entry %s: %s", entry_id[:8], e)


def ensure_ready() -> bool:
    return is_available()
