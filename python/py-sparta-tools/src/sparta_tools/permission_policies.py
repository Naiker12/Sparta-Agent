from __future__ import annotations

import os
from pathlib import Path

_IS_ELECTRON = os.environ.get("SPARTA_ENV", "").lower() == "electron"

_AGENT_AUTONOMY: str = "ask_risky"

_TIMEOUT_SECONDS = 120


def set_agent_autonomy(level: str) -> None:
    global _AGENT_AUTONOMY
    _AGENT_AUTONOMY = level


def get_agent_autonomy() -> str:
    return _AGENT_AUTONOMY


def _workspace_root() -> Path:
    from sparta_tools.permission_broker import _current_session
    from sparta_tools.file_tools import _get_workspace_root
    root = _get_workspace_root(_current_session.get())
    return Path(root).resolve() if root else Path.cwd().resolve()


def _is_inside_workspace(resolved: Path) -> bool:
    root = _workspace_root()
    try:
        resolved_norm = Path(os.path.normcase(str(resolved.resolve())))
        root_norm = Path(os.path.normcase(str(root.resolve())))
        return resolved_norm.is_relative_to(root_norm)
    except (ValueError, AttributeError):
        return False


def _detect_language(file_path: str) -> str:
    ext = file_path.rsplit(".", 1)[-1].lower() if "." in file_path else ""
    lang_map = {
        "ts": "typescript", "tsx": "typescript", "js": "javascript",
        "jsx": "javascript", "py": "python", "rs": "rust", "go": "go",
        "css": "css", "scss": "scss", "html": "html", "json": "json",
        "md": "markdown", "yaml": "yaml", "yml": "yaml", "toml": "toml",
    }
    return lang_map.get(ext, "")
