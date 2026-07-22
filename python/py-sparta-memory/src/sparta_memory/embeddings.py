import logging
from typing import Any

logger = logging.getLogger("sparta_ai.memory.embeddings")

# Modelo local, sin dependencia de red ni API key. Usa sentence-transformers,
# que suele venir como dependencia transitiva de chromadb. La dimensionalidad
# es 384, compatible con la colección existente creada por Chroma con su
# default (all-MiniLM-L6-v2).
_DEFAULT_MODEL = "all-MiniLM-L6-v2"
_model: Any = None


def _get_model():
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        logger.info("Loading embedding model: %s", _DEFAULT_MODEL)
        _model = SentenceTransformer(_DEFAULT_MODEL)
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Return a list of embedding vectors for the input texts."""
    if not texts:
        return []
    model = _get_model()
    return model.encode(texts, normalize_embeddings=True).tolist()


def embed_text(text: str) -> list[float]:
    """Return a single embedding vector for the input text."""
    return embed_texts([text])[0]
