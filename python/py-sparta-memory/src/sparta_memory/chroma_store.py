import logging
from typing import Any

import chromadb
from chromadb.config import Settings

logger = logging.getLogger("sparta_ai.memory.chroma")

_client: Any = None
_collection: Any = None
_web_cache_collection: Any = None
_folder_index_collection: Any = None
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


def _get_web_cache_collection() -> Any:
    global _web_cache_collection
    if _web_cache_collection is None:
        client = _get_client()
        try:
            _web_cache_collection = client.get_collection("sparta_web_cache")
            logger.info("ChromaDB collection 'sparta_web_cache' loaded")
        except ValueError:
            _web_cache_collection = client.create_collection("sparta_web_cache")
            logger.info("ChromaDB collection 'sparta_web_cache' created")
    return _web_cache_collection


def _get_folder_index_collection() -> Any:
    global _folder_index_collection
    if _folder_index_collection is None:
        client = _get_client()
        try:
            _folder_index_collection = client.get_collection("sparta_folder_index")
            logger.info("ChromaDB collection 'sparta_folder_index' loaded")
        except ValueError:
            _folder_index_collection = client.create_collection("sparta_folder_index")
            logger.info("ChromaDB collection 'sparta_folder_index' created")
    return _folder_index_collection


async def build_memory_context(query: str, k: int = 5) -> str:
    if not is_available():
        return ""
    from sparta_memory.chroma_store_query import semantic_search
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


async def build_folder_context(folder_path: str, query: str, k: int = 5) -> str:
    """Index a folder's text files and return relevant context for the system prompt.

    Steps:
      1. Clear any previous index for this folder.
      2. Walk the directory tree, chunk text files.
      3. Embed and store in ChromaDB.
      4. Search for chunks relevant to the user's query.
      5. Format and return results.
    """
    if not is_available() or not folder_path:
        return ""

    try:
        from sparta_memory.chroma_store_write import (
            _chunk_file,
            _walk_folder,
            clear_folder_index,
            index_folder_chunks,
        )
        from sparta_memory.chroma_store_query import search_folder_index

        clear_folder_index(folder_path)

        files = _walk_folder(folder_path)
        if not files:
            return ""

        all_chunks: list[dict] = []
        for fpath in files:
            all_chunks.extend(_chunk_file(fpath, folder_path))
        if not all_chunks:
            return ""

        indexed = index_folder_chunks(folder_path, all_chunks)
        if indexed == 0:
            return ""

        results = search_folder_index(query, folder_path, k=k)
        if not results:
            return ""

        lines = [f"Carpeta conectada: {folder_path}"]
        seen_paths: set[str] = set()
        for r in results:
            content = r.get("content", "")
            path = r.get("path", "")
            score = r.get("score", 0)
            if score >= 0.4 and content:
                prefix = f"[{path}] " if path and path not in seen_paths else ""
                lines.append(f"- {prefix}{content[:200]}")
                if path:
                    seen_paths.add(path)
        return "\n".join(lines)

    except Exception as e:
        logger.error("Failed to build folder context for %s: %s", folder_path, e)
        return ""


def ensure_ready() -> bool:
    ready = is_available()
    if ready:
        try:
            collection = _get_collection()
            data = collection.get(include=["metadatas"])
            models = {
                meta.get("embedding_model")
                for meta in (data.get("metadatas") or [])
                if meta and meta.get("embedding_model")
            }
            if len(models) > 1:
                logger.warning(
                    "Detected mixed embedding models in sparta_memory: %s. "
                    "This can corrupt semantic search results. Consider reindexing.",
                    models,
                )
        except Exception as e:
            logger.debug("Could not check embedding model consistency: %s", e)
    return ready


# Backward-compatibility re-exports: functions were split into query/write submodules
# but existing code imports them from sparta_memory.chroma_store.
from sparta_memory.chroma_store_write import *  # noqa: F401,F403,E402
from sparta_memory.chroma_store_query import *  # noqa: F401,F403,E402
