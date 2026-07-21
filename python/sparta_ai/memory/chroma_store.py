import logging
import os
import uuid
from typing import Any

import chromadb
from chromadb.config import Settings

logger = logging.getLogger("sparta_ai.memory.chroma")

_client: Any = None
_collection: Any = None
_web_cache_collection: Any = None
_folder_index_collection: Any = None
_chromadb_available: bool | None = None

_IGNORED_DIRS = {
    "node_modules", ".git", "__pycache__", ".venv", "venv", "env",
    ".next", ".nuxt", "dist", "build", ".cache", ".parcel-cache",
    "coverage", ".tox", "egg-info", ".mypy_cache", ".pytest_cache",
    ".idea", ".vscode", ".sass-cache",
}
_IGNORED_FILES = {
    ".DS_Store", "Thumbs.db", "desktop.ini", ".gitignore",
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
}
_MAX_CHUNK_CHARS = 500
_MAX_INDEX_CHARS = 1_000_000
_MAX_INDEX_FILES = 200

_DEFAULT_EMBEDDING_MODEL = "all-MiniLM-L6-v2"


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


def _is_text_file(path: str) -> bool:
    """Heuristic: return True if the file likely contains readable text."""
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
    """Walk a directory tree and return paths of text files, respecting ignore rules."""
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
    """Read a text file and return chunks with relative path metadata."""
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
        from sparta_ai.memory.embeddings import embed_text

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
        import time
        from sparta_ai.memory.embeddings import embed_texts

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
        from sparta_ai.memory.embeddings import embed_text
        from sparta_ai.memory.rerank import rerank

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


def semantic_search(query: str, k: int = 5) -> list[dict[str, Any]]:
    if not is_available():
        return []
    try:
        from sparta_ai.memory.embeddings import embed_text

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
        import time
        from sparta_ai.memory.embeddings import embed_texts

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


def search_folder_index(query: str, folder_path: str, k: int = 5) -> list[dict]:
    """Search the folder index, filtering by folder_path."""
    if not is_available():
        return []
    try:
        from sparta_ai.memory.embeddings import embed_text

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
