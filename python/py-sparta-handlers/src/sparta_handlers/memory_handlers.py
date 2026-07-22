"""Memory.* JSON-RPC handlers."""
import logging

logger = logging.getLogger("sparta_ai.server_handlers")


async def handle_memory_index(params: dict) -> dict:
    from sparta_memory.chroma_store import index_entry
    entry = params.get("entry", {})
    try:
        entry_id = index_entry(entry)
        return {"ok": bool(entry_id), "id": entry_id}
    except Exception as e:
        logger.error("memory.index failed: %s", e)
        return {"ok": False, "error": str(e)}


async def handle_memory_search(params: dict) -> dict:
    from sparta_memory.chroma_store import semantic_search
    query = params.get("query", "")
    k = int(params.get("k", 5))
    try:
        results = semantic_search(query, k=k)
        return {"ok": True, "results": results}
    except Exception as e:
        logger.error("memory.search failed: %s", e)
        return {"ok": False, "error": str(e)}


async def handle_memory_embed(params: dict) -> dict:
    from sparta_memory.embeddings import embed_text, embed_texts
    texts = params.get("texts", [])
    single = params.get("text")
    try:
        if single is not None:
            return {"ok": True, "embedding": embed_text(single)}
        if isinstance(texts, list) and texts:
            return {"ok": True, "embeddings": embed_texts(texts)}
        return {"ok": False, "error": "text or texts required"}
    except Exception as e:
        logger.error("memory.embed failed: %s", e)
        return {"ok": False, "error": str(e)}


async def handle_memory_delete(params: dict) -> dict:
    from sparta_memory.chroma_store import delete_entry
    entry_id = params.get("entry_id", "")
    try:
        delete_entry(entry_id)
        return {"ok": True}
    except Exception as e:
        logger.error("memory.delete failed: %s", e)
        return {"ok": False, "error": str(e)}


async def handle_memory_count() -> dict:
    from sparta_memory.chroma_store import count_entries
    try:
        return {"ok": True, "count": count_entries()}
    except Exception as e:
        logger.error("memory.count failed: %s", e)
        return {"ok": False, "error": str(e)}
