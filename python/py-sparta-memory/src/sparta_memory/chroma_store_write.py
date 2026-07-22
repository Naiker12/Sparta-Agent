import logging
import os
import time
import uuid

from sparta_memory.chroma_store import (
    _get_collection,
    _get_folder_index_collection,
    _get_web_cache_collection,
    is_available,
)
from sparta_memory.chroma_store_schema import (
    _DEFAULT_EMBEDDING_MODEL,
    _IGNORED_DIRS,
    _IGNORED_FILES,
    _MAX_CHUNK_CHARS,
    _MAX_INDEX_CHARS,
    _MAX_INDEX_FILES,
)

logger = logging.getLogger("sparta_ai.memory.chroma")


def _is_text_file(path: str) -> bool:
    ext = os.path.splitext(path)[1].lower()
    text_exts = {
        ".py", ".js", ".ts", ".tsx", ".jsx", ".json", ".yaml", ".yml",
        ".toml", ".cfg", ".ini", ".env", ".sh", ".bash", ".zsh",
        ".md", ".txt", ".rst", ".html", ".css", ".scss", ".less",
        ".vue", ".svelte", ".astro", ".sql", ".graphql", ".gql",
        ".rs", ".go", ".java", ".kt", ".kts", ".scala", ".rb",
        ".php", ".c", ".cpp", ".h", ".hpp", ".cs", ".swift",
        ".r", ".R", ".lua", ".perl", ".pl", ".ex", ".exs",
        ".hs", ".elm", ".dart", ".zig", ".nim", ".cr",
        ".dockerfile", ".tf", ".hcl", ".gradle", ".xml",
        ".csv", ".tsv", ".log", ".diff", ".patch",
    }
    if ext in text_exts:
        return True
    basename = os.path.basename(path).lower()
    known_names = {
        "makefile", "dockerfile", "docker-compose.yml",
        "readme", "license", "changelog", "authors",
        ".env", ".editorconfig", ".prettierrc", ".eslintrc",
        "gemfile", "rakefile", "podfile", "procfile",
        "requirements.txt", "setup.cfg", "pyproject.toml",
    }
    if basename in known_names:
        return True
    return False


def _walk_folder(path: str) -> list[str]:
    files: list[str] = []
    for root, dirs, filenames in os.walk(path):
        dirs[:] = [d for d in dirs if d not in _IGNORED_DIRS]
        for fname in filenames:
            if fname in _IGNORED_FILES or fname.startswith("."):
                continue
            fpath = os.path.join(root, fname)
            if _is_text_file(fpath):
                files.append(fpath)
        if len(files) >= _MAX_INDEX_FILES:
            break
    return files[:_MAX_INDEX_FILES]


def _chunk_file(path: str, root: str) -> list[dict]:
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read(_MAX_INDEX_CHARS)
    except (OSError, UnicodeDecodeError):
        return []

    if not content.strip():
        return []

    rel = os.path.relpath(path, root).replace("\\", "/")
    chunks: list[dict] = []
    for i in range(0, len(content), _MAX_CHUNK_CHARS):
        chunk = content[i : i + _MAX_CHUNK_CHARS]
        if chunk.strip():
            chunks.append({"content": chunk, "path": rel})
    return chunks


def index_entry(entry: dict) -> str | None:
    if not is_available():
        return None
    try:
        from sparta_memory.embeddings import embed_text

        collection = _get_collection()
        entry_id = entry.get("id", str(uuid.uuid4()))
        content = entry.get("content", "")
        embedding = embed_text(content)
        metadata = {
            "memory_type": entry.get("memory_type", "general"),
            "tags": ",".join(entry.get("tags", [])),
            "timestamp": entry.get("timestamp", 0),
            "embedding_model": _DEFAULT_EMBEDDING_MODEL,
        }
        collection.add(
            ids=[entry_id],
            embeddings=[embedding],
            documents=[content],
            metadatas=[metadata],
        )
        logger.debug("Indexed entry %s in ChromaDB", entry_id[:8])
        return entry_id
    except Exception as e:
        logger.error("Failed to index entry in ChromaDB: %s", e)
        return None


def index_web_chunks(url: str, topic: str, chunks: list[str]) -> int:
    """Index chunks from a fetched web page into the sparta_web_cache collection."""
    if not is_available() or not chunks:
        return 0
    try:
        from sparta_memory.embeddings import embed_texts

        collection = _get_web_cache_collection()
        embeddings = embed_texts(chunks)
        ids = [str(uuid.uuid4()) for _ in chunks]
        metadatas = [
            {
                "url": url,
                "topic": topic,
                "chunk_index": i,
                "indexed_at": time.time(),
                "embedding_model": _DEFAULT_EMBEDDING_MODEL,
            }
            for i in range(len(chunks))
        ]
        collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=chunks,
            metadatas=metadatas,
        )
        logger.debug("Indexed %d chunks from %s in web cache", len(chunks), url)
        return len(chunks)
    except Exception as e:
        logger.error("Failed to index web chunks: %s", e)
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


def clear_folder_index(folder_path: str) -> None:
    """Delete all chunks previously indexed for a specific folder path."""
    if not is_available():
        return
    try:
        collection = _get_folder_index_collection()
        existing = collection.get(
            where={"folder": folder_path},
            include=["metadatas"],
        )
        ids = existing.get("ids", [])
        if ids:
            collection.delete(ids=ids)
            logger.debug("Cleared %d chunks for folder %s", len(ids), folder_path)
    except Exception as e:
        logger.error("Failed to clear folder index for %s: %s", folder_path, e)


def index_folder_chunks(folder_path: str, chunks: list[dict]) -> int:
    """Index file chunks into the sparta_folder_index collection.

    Each chunk dict must have ``content`` (text) and ``path`` (relative path).
    """
    if not is_available() or not chunks:
        return 0
    try:
        from sparta_memory.embeddings import embed_texts

        collection = _get_folder_index_collection()
        texts = [c["content"] for c in chunks]
        embeddings = embed_texts(texts)
        ids = [str(uuid.uuid4()) for _ in chunks]
        metadatas = [
            {
                "folder": folder_path,
                "path": c.get("path", ""),
                "indexed_at": time.time(),
                "embedding_model": _DEFAULT_EMBEDDING_MODEL,
            }
            for c in chunks
        ]
        collection.add(
            ids=ids,
            embeddings=embeddings,
            documents=texts,
            metadatas=metadatas,
        )
        logger.debug("Indexed %d chunks for folder %s", len(chunks), folder_path)
        return len(chunks)
    except Exception as e:
        logger.error("Failed to index folder chunks for %s: %s", folder_path, e)
        return 0
