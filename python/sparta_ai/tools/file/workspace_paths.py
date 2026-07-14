"""Workspace path resolution, validation, and security constants."""
import logging
import os
import re
import shutil
import sys
import json
from datetime import datetime
from pathlib import Path

from sparta_ai.tools.permission_broker import (
    request_permission_sync,
)

logger = logging.getLogger("sparta_ai.tools.file")

# Per-session workspace roots — set by server.py / server_web.py before each request.
_SESSION_WORKSPACES: dict[str, str] = {}


def set_session_workspace(session_id: str, workspace_root: str) -> None:
    """Register a workspace root for a specific session."""
    if workspace_root:
        _SESSION_WORKSPACES[session_id] = workspace_root


def clear_session_workspace(session_id: str) -> None:
    """Remove a session's workspace root."""
    _SESSION_WORKSPACES.pop(session_id, None)


def _get_workspace_root(session_id: str = "") -> str | None:
    """Resolve workspace root: session-local first, then environ, then None."""
    if session_id and session_id in _SESSION_WORKSPACES:
        return _SESSION_WORKSPACES[session_id]
    return os.environ.get("SPARTA_WORKSPACE_ROOT")


def _workspace_root() -> Path:
    root = _get_workspace_root()
    if root:
        return Path(root).resolve()
    cwd = Path.cwd().resolve()
    logger.warning(
        "SPARTA_WORKSPACE_ROOT no está definida para esta sesión. "
        "Usando CWD como workspace: %s",
        cwd,
    )
    return cwd


DENYLIST_FILES = {
    ".env", "sparta-vault.json",
    "id_rsa", "id_ed25519", "id_ecdsa", "id_ecdsa_sk", "id_ed25519_sk",
}

BLOCKED_FILE_PATTERNS: list[re.Pattern] = [
    re.compile(p, re.IGNORECASE) for p in [
        r"\.env$",
        r"\.pem$",
        r"\.key$",
        r"\.cert$",
        r"sparta-vault\.json$",
        r"node_modules[/\\]",
        r"\.git[/\\]",
        r"\.venv[/\\]",
    ]
]

BLOCKED_PATH_COMPONENTS: set[str] = {
    "..", "~", "$HOME", "%USERPROFILE%",
}

_MAX_PATH_LENGTH = 512
_MAX_CONTENT_SIZE = 5 * 1024 * 1024  # 5MB

_SKIP_DIRS = {
    ".git", ".venv", "__pycache__", "node_modules",
    ".pytest_cache", "dist", "build", ".next",
}


def _emit_file_changed(file_path: Path) -> None:
    """Emit a file:changed event so the frontend can refresh the file tree."""
    try:
        msg = {"event": "file:changed", "data": {"path": str(file_path)}}
        sys.stdout.write(json.dumps(msg, ensure_ascii=False) + "\n")
        sys.stdout.flush()
    except (BrokenPipeError, OSError):
        pass


def _get_safe_path(
    path: str,
    tool_name: str | None = None,
    preview: str = "",
    require_permission: bool = False,
) -> Path:
    """Resolve and validate a path, requesting permission if needed."""
    raw_path = path.strip()
    candidate = Path(raw_path)
    root = _workspace_root()

    if len(raw_path) > _MAX_PATH_LENGTH:
        raise PermissionError(
            f"Ruta excede el límite de {_MAX_PATH_LENGTH} caracteres ({len(raw_path)})."
        )

    lower_path = raw_path.lower()
    for pattern in BLOCKED_FILE_PATTERNS:
        if pattern.search(lower_path):
            raise PermissionError(
                f"Acceso bloqueado: la ruta coincide con patrón bloqueado '{pattern.pattern}'."
            )
    for component in BLOCKED_PATH_COMPONENTS:
        if component in lower_path:
            raise PermissionError(
                f"Acceso bloqueado: la ruta contiene '{component}'."
            )

    if (
        os.name == "nt"
        and raw_path.startswith(("/", "\\"))
        and not raw_path.startswith(("//", "\\\\"))
        and not (len(raw_path) >= 3 and raw_path[1:3] == ":\\")
    ):
        candidate = Path(raw_path.lstrip("/\\"))

    if not candidate.is_absolute():
        candidate = root / candidate

    resolved = candidate.resolve()
    try:
        resolved_norm = Path(os.path.normcase(str(resolved)))
        root_norm = Path(os.path.normcase(str(root)))
        inside_workspace = resolved_norm.is_relative_to(root_norm)
    except (ValueError, AttributeError):
        inside_workspace = False

    if resolved.name in DENYLIST_FILES:
        raise PermissionError(f"Acceso bloqueado a archivo sensible: {resolved}")
    if ".ssh" in {part.lower() for part in resolved.parts}:
        raise PermissionError(f"Acceso bloqueado a archivo sensible: {resolved}")

    if not inside_workspace:
        if tool_name is not None and request_permission_sync(tool_name, resolved, preview):
            pass
        else:
            guidance = (
                f"Workspace permitido: {root}. Usa rutas relativas al workspace, "
                "por ejemplo 'src/authController.js'. No uses rutas absolutas como /tmp/... ni C:\\..."
            )
            raise PermissionError(
                f"Ruta fuera del workspace permitido: {resolved}. {guidance}"
            )
    elif require_permission:
        if tool_name is not None:
            allowed = request_permission_sync(tool_name, resolved, preview, force=True)
            if not allowed:
                raise PermissionError(
                    f"Operación rechazada por el usuario: {resolved}"
                )

    return resolved


def _validate_path(path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(f"El archivo no existe: {path}")
    if not path.is_file():
        raise ValueError(f"La ruta no es un archivo: {path}")


def _workspace_guidance() -> str:
    root = _workspace_root()
    return (
        f"Workspace permitido: {root}. Usa rutas relativas al workspace, "
        "por ejemplo 'src/authController.js'. No uses rutas absolutas como /tmp/... ni C:\\..."
    )


def _move_to_trash(path: Path) -> Path:
    """Move a file or empty directory to the application trash folder."""
    data_dir = os.environ.get("SPARTA_DATA_DIR")
    if data_dir:
        trash_root = Path(data_dir).resolve() / ".trash"
    else:
        trash_root = _workspace_root() / ".sparta" / ".trash"
    trash_root.mkdir(parents=True, exist_ok=True)

    ts = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
    dest = trash_root / ts / path.name
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(path), str(dest))
    return dest
