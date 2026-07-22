"""Semantic skill router — auto-suggests skills based on user message context.

Reuses the same ChromaDB + sentence-transformers infrastructure as
``chroma_store.py`` for memory semantics, but indexes skill descriptions
instead of memory entries.

Three categories of skill activation at all times:
  1. **Pinned** — user toggled on manually (always sent).
  2. **Auto-suggested** — detected relevant by this router (per-message).
  3. **Discoverable** — available via skills_list_tool / skill_view_tool.
"""
import logging
from typing import Any

logger = logging.getLogger("sparta_ai.skills.router")

_SKILLS_COLLECTION = "sparta_skills_semantic"
_collection: Any = None
_indexed_ids: set[str] = set()


def _get_collection() -> Any:
    """Lazy-init ChromaDB collection for skill descriptions."""
    global _collection
    if _collection is not None:
        return _collection
    try:
        from sparta_memory.chroma_store import _get_client, is_available
        if not is_available():
            return None
        client = _get_client()
        try:
            _collection = client.get_collection(_SKILLS_COLLECTION)
        except ValueError:
            _collection = client.create_collection(
                _SKILLS_COLLECTION,
                metadata={"hnsw:space": "cosine"},
            )
            logger.info("Created ChromaDB collection '%s'", _SKILLS_COLLECTION)
    except Exception as e:
        logger.warning("ChromaDB unavailable for skill routing: %s", e)
        return None
    return _collection


def sync_skills_index() -> int:
    """Re-index all skill descriptions into ChromaDB.

    Called once at boot and again whenever skills are installed/uninstalled
    (via ``clear_skill_cache()``). Returns the number of skills indexed.
    """
    global _indexed_ids
    collection = _get_collection()
    if collection is None:
        return 0

    try:
        from sparta_skills.skill_loader import skills_index
        from sparta_memory.embeddings import embed_texts

        index = skills_index()
        current_ids = {s["id"] for s in index}

        # Remove skills that no longer exist
        stale_ids = list(_indexed_ids - current_ids)
        if stale_ids:
            try:
                collection.delete(ids=stale_ids)
                logger.debug("Removed %d stale skills from semantic index", len(stale_ids))
            except Exception:
                pass

        # Upsert all current skills
        skills_to_index = [s for s in index if s["id"] not in _indexed_ids or True]
        if not skills_to_index:
            _indexed_ids = current_ids
            return len(current_ids)

        ids = [s["id"] for s in skills_to_index]
        # Build text to embed: "name: description" — short, semantically rich
        texts = [
            f"{s.get('name', s['id'])}: {s.get('description', '')}"
            for s in skills_to_index
        ]
        embeddings = embed_texts(texts)
        metadatas = [
            {
                "name": s.get("name", s["id"]),
                "category": s.get("category", ""),
                "tags": ",".join(s.get("tags", [])),
            }
            for s in skills_to_index
        ]
        collection.upsert(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas,
        )
        _indexed_ids = current_ids
        logger.info("Synced %d skills into semantic index", len(ids))
        return len(ids)
    except Exception as e:
        logger.error("Failed to sync skills index: %s", e)
        return 0


def _semantic_search_skills(query: str, k: int = 5) -> list[dict[str, Any]]:
    """Search skill descriptions by semantic similarity to the query."""
    collection = _get_collection()
    if collection is None:
        return []
    try:
        from sparta_memory.embeddings import embed_text

        results = collection.query(
            query_embeddings=[embed_text(query)],
            n_results=min(k, 10),
            include=["documents", "metadatas", "distances"],
        )
        ids = results.get("ids", [[]])[0]
        distances = results.get("distances", [[]])[0]
        metadatas = results.get("metadatas", [[]])[0]

        entries = []
        for i in range(len(ids)):
            score = 1.0 - (distances[i] if i < len(distances) else 0.0)
            entries.append({
                "id": ids[i],
                "score": score,
                "metadata": metadatas[i] if i < len(metadatas) else {},
            })
        return entries
    except Exception as e:
        logger.error("Skill semantic search failed: %s", e)
        return []


async def select_relevant_skills(
    message: str,
    pinned_skill_ids: list[str] | None = None,
    k: int = 3,
    min_score: float = 0.55,
) -> tuple[list[str], list[str]]:
    """Return ``(pinned, suggested)`` skill ID lists for the current message.

    - *pinned* are always included (from user's manual toggles).
    - *suggested* are up to *k* skills whose descriptions are semantically
      similar to the user's message, with a score >= *min_score*.
    - Skills already in *pinned* are excluded from *suggested*.
    - If ChromaDB is unavailable, returns ``(pinned, [])`` — graceful degradation.
    """
    pinned = list(pinned_skill_ids or [])
    if not message.strip():
        return pinned, []

    # Ensure index is populated (idempotent if already synced)
    sync_skills_index()

    results = _semantic_search_skills(message, k=k + len(pinned))
    pinned_set = set(pinned)

    suggested: list[str] = []
    for r in results:
        sid = r["id"]
        score = r["score"]
        if sid in pinned_set:
            continue
        if score < min_score:
            continue
        suggested.append(sid)
        if len(suggested) >= k:
            break

    if suggested:
        logger.debug(
            "Auto-suggested %d skills for message '%s': %s (scores: %s)",
            len(suggested), message[:60], suggested,
            [f"{r['score']:.2f}" for r in results if r["id"] in suggested],
        )

    return pinned, suggested


def invalidate_cache() -> None:
    """Reset the local ID tracking so next sync re-indexes everything."""
    global _indexed_ids, _collection
    _indexed_ids = set()
    _collection = None
    logger.debug("Skill router cache invalidated")
