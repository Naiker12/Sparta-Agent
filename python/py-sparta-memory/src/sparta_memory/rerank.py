import logging
from typing import Any

logger = logging.getLogger("sparta_ai.memory.rerank")

# Cross-encoder ligero para reranking de pasajes. Mismo ecosistema que
# sentence-transformers, así que no agrega dependencias nuevas.
_CROSS_ENCODER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"
_model: Any = None


def _get_model() -> Any:
    global _model
    if _model is None:
        from sentence_transformers import CrossEncoder

        logger.info("Loading cross-encoder reranker: %s", _CROSS_ENCODER_MODEL)
        _model = CrossEncoder(_CROSS_ENCODER_MODEL)
    return _model


def rerank(query: str, candidates: list[dict], top_k: int | None = None) -> list[dict]:
    """Rerank candidates using a cross-encoder.

    Candidates must contain a 'content' key. The returned list is sorted by
    descending relevance score and truncated to top_k.

    Args:
        query: The search query.
        candidates: List of candidate dicts with a 'content' field.
        top_k: Maximum number of candidates to return. Defaults to all.

    Returns:
        Candidates sorted by relevance.
    """
    if not candidates:
        return []
    if top_k is None:
        top_k = len(candidates)

    try:
        model = _get_model()
        pairs = [(query, c.get("content", "")) for c in candidates]
        scores = model.predict(pairs)
        scored = sorted(
            ((float(score), candidate) for score, candidate in zip(scores, candidates)),
            key=lambda x: x[0],
            reverse=True,
        )
        return [candidate for _, candidate in scored[:top_k]]
    except Exception as e:
        logger.warning("Rerank failed, falling back to input order: %s", e)
        return candidates[:top_k]
