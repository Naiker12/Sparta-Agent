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
