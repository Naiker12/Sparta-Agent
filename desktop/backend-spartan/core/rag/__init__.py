
"""RAG core package. Import submodules lazily; keep this free of top-level
submodule imports to avoid pulling in heavy deps."""

__all__ = [
    "config",
    "parsers",
    "chunking",
    "embeddings",
    "store",
    "retrieval",
    "tool",
    "ingestion",
]
