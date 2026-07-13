import difflib
import fnmatch
import json
import logging
import os
import re
import shutil
import sys
from datetime import datetime
from pathlib import Path

from langchain_core.tools import tool

from sparta_ai.security.rate_limiter import tool_rate_limiter
from sparta_ai.tools.permission_broker import (
    get_agent_autonomy,
    request_diff_approval,
    request_permission_sync,
)

logger = logging.getLogger("sparta_ai.tools.file")

# Per-session workspace roots — set by server.py / server_web.py before each request.
# Avoids race conditions from mutating os.environ in concurrent web requests.
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
    # Fallback to CWD — consistent with PathGuard's hierarchy:
    # session → env → cwd (never RuntimeError)
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

# Patterns originally ported from rust/sparta-security/src/sanitizer.rs (DEPRECATED in Rust).
# Python is now the SINGLE SOURCE OF TRUTH for sanitization logic.
# Do NOT modify the Rust copy — update here only.
# Block any path matching these regex patterns (case-insensitive).
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

# Path components that are never allowed (traversal, home shortcuts).
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
    """Resolve and validate a path, requesting permission if needed.

    Args:
        path:      User-provided path (relative or absolute).
        tool_name: Name of the calling tool (e.g. "read_file_tool").  When set,
                   the permission broker may request user approval for paths
                   outside the workspace in Desktop mode.
        preview:   Short preview / diff to show in the permission dialog.
        require_permission: If True, ALWAYS request user permission even for
                   paths inside the workspace. Used by delete/write tools.

    Returns:
        Resolved Path object.

    Raises:
        PermissionError: If access is denied (denylist or permission dialog).
        FileNotFoundError: If the validated path doesn't exist (from _validate_path).
    """
    raw_path = path.strip()
    candidate = Path(raw_path)
    root = _workspace_root()

    # ── Path length check (portado de Rust) ──────────────────────────
    if len(raw_path) > _MAX_PATH_LENGTH:
        raise PermissionError(
            f"Ruta excede el límite de {_MAX_PATH_LENGTH} caracteres ({len(raw_path)})."
        )

    # ── Blocked patterns check (portado de Rust sanitizer.rs) ────────
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

    # Denylist always blocks, regardless of permission (nombres exactos)
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
        # Even inside workspace, some operations (delete, always_ask) need confirmation
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
    """Move a file or empty directory to the application trash folder.

    Uses SPARTA_DATA_DIR when available; otherwise falls back to a .sparta/.trash
    folder inside the workspace. Items are grouped under a timestamped subdirectory
    to avoid name collisions and to keep the trash organized.

    Returns:
        The path where the item was moved.
    """
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


# ─────────────────────────────────────────────────────────────────────────────
# read_file_tool
# ─────────────────────────────────────────────────────────────────────────────

@tool
def read_file_tool(path: str, offset: int | None = None, limit: int | None = None) -> str:
    """
    Lee el contenido de un archivo del sistema de archivos local.

    Args:
        path: Ruta relativa al workspace permitido. Evita rutas absolutas.
        offset: Línea inicial (1-indexed, opcional).
        limit: Número máximo de líneas a leer (opcional).

    Returns:
        Contenido del archivo.
    """
    try:
        if not _check_rate_limit("read_file_tool"):
            return "Error: Demasiadas solicitudes. Espera un momento antes de leer más archivos."
        filepath = _get_safe_path(path, tool_name="read_file_tool")
        _validate_path(filepath)

        size_mb = filepath.stat().st_size / (1024 * 1024)
        if size_mb > 50:
            return f"Error: File too large ({size_mb:.1f} MB). Maximum allowed is 50 MB."
        content = filepath.read_text(encoding="utf-8")
        lines = content.split("\n")

        if offset is not None:
            start = max(0, offset - 1)
            lines = lines[start:]
        if limit is not None:
            lines = lines[:limit]

        result = "\n".join(lines)
        logger.info("File read: %s (%d lines)", filepath, len(lines))
        return result

    except FileNotFoundError as e:
        return f"Error: {e}"
    except PermissionError as e:
        logger.warning("read_file_tool blocked: %s", e)
        return f"Error de seguridad: {e}"
    except Exception as e:
        logger.error("read_file_tool failed for '%s': %s", path, e)
        return f"Error al leer archivo: {e}"


# ─────────────────────────────────────────────────────────────────────────────
# write_file_tool
# ─────────────────────────────────────────────────────────────────────────────

@tool
def write_file_tool(path: str, content: str, append: bool = False) -> str:
    """
    Escribe o crea un archivo en el sistema de archivos local.
    Si el archivo ya existe, lo sobrescribe a menos que append=True.

    Args:
        path: Ruta relativa al workspace permitido. Evita rutas absolutas.
        content: Contenido a escribir.
        append: Si es True, añade al final en vez de sobrescribir.

    Returns:
        Confirmación de la operación.
    """
    try:
        # Content size limit (portado de Rust sanitizer.rs)
        if len(content) > _MAX_CONTENT_SIZE:
            return (
                f"Error: El contenido excede el límite de 5MB "
                f"({len(content)} bytes). Reduce el tamaño del archivo."
            )

        if not _check_rate_limit("write_file_tool"):
            return "Error: Demasiadas solicitudes. Espera un momento antes de escribir más archivos."

        # Build preview: show what will be written
        preview_lines = content.split("\n")[:15]
        preview_text = "\n".join(preview_lines)
        if len(content) > 500:
            preview_text += "\n... (truncado, {len(content)} chars total)"
        # Always ask for permission when autonomy is "always_ask"
        need_permission = get_agent_autonomy() == "always_ask"
        filepath = _get_safe_path(path, tool_name="write_file_tool", preview=preview_text,
                                  require_permission=need_permission)

        # If file already exists with content (overwrite), show real diff
        if not need_permission and not append and filepath.exists() and filepath.stat().st_size > 0:
            original = filepath.read_text(encoding="utf-8")
            approved = request_diff_approval(
                file_path=str(filepath),
                original_content=original,
                new_content=content,
                language=path.rsplit(".", 1)[-1] if "." in path else "",
            )
            if not approved:
                return "Operación rechazada por el usuario: el archivo ya existe y tiene contenido."
        elif need_permission:
            # For always_ask mode, also show a diff for new files
            original = filepath.read_text(encoding="utf-8") if filepath.exists() else ""
            approved = request_diff_approval(
                file_path=str(filepath),
                original_content=original,
                new_content=content,
                language=path.rsplit(".", 1)[-1] if "." in path else "",
            )
            if not approved:
                return "Operación rechazada por el usuario."

        if append and filepath.exists():
            with open(filepath, "a", encoding="utf-8") as f:
                f.write(content)
            mode = "appended to"
        else:
            filepath.parent.mkdir(parents=True, exist_ok=True)
            filepath.write_text(content, encoding="utf-8")
            mode = "written to"

        line_count = content.count("\n") + 1
        char_count = len(content)
        logger.info("File %s: %s (%d lines, %d chars)", mode, filepath, line_count, char_count)
        _emit_file_changed(filepath)
        return f"Archivo {mode}: {filepath} ({line_count} líneas, {char_count} caracteres)."

    except PermissionError as e:
        logger.warning("write_file_tool blocked: %s", e)
        return f"Error de seguridad: {e}"
    except Exception as e:
        logger.error("write_file_tool failed for '%s': %s", path, e)
        return f"Error al escribir archivo: {e}. Informa este error al usuario; no pegues el archivo completo en el chat como respaldo."


# ─────────────────────────────────────────────────────────────────────────────
# search_files_tool  (FASE 2 — Native Desktop Tools)
# ─────────────────────────────────────────────────────────────────────────────

@tool
def search_files_tool(
    pattern: str,
    content: str | None = None,
    path: str = ".",
    max_results: int = 50,
) -> str:
    """
    Busca archivos por nombre (glob) y/o por contenido (grep) dentro del workspace.

    Args:
        pattern: Glob de nombre de archivo, ej: '*.py', 'auth*.ts', '**/*.json'.
                 Usa '*' para buscar en todos los archivos.
        content: Texto a buscar dentro de los archivos (opcional).
                 Si se omite, solo filtra por nombre.
        path:    Subdirectorio de búsqueda relativo al workspace (default: '.').
        max_results: Límite de resultados (máx 200).

    Returns:
        Lista de coincidencias con ruta relativa y, si aplica, extracto de línea.
    """
    try:
        if not _check_rate_limit("search_files_tool"):
            return "Error: Demasiadas solicitudes. Espera un momento antes de buscar."
        root = _workspace_root()
        base = _get_safe_path(path, tool_name="search_files_tool") if path != "." else root
        if not base.is_dir():
            return f"Error: '{path}' no es un directorio válido en el workspace."

        max_results = min(max_results, 200)
        matches: list[str] = []

        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [d for d in dirnames if d not in _SKIP_DIRS]

            for fname in filenames:
                name_match = fnmatch.fnmatch(fname, pattern) or pattern == "*"
                if not name_match:
                    rel = str(Path(dirpath, fname).relative_to(root))
                    name_match = fnmatch.fnmatch(rel, pattern)
                if not name_match:
                    continue

                filepath = Path(dirpath) / fname
                rel_path = str(filepath.relative_to(root))

                if content is None:
                    matches.append(rel_path)
                else:
                    try:
                        text = filepath.read_text(encoding="utf-8", errors="replace")
                        for i, line in enumerate(text.splitlines(), 1):
                            if content.lower() in line.lower():
                                snippet = line.strip()[:120]
                                matches.append(f"{rel_path}:{i}: {snippet}")
                                if len(matches) >= max_results:
                                    break
                    except (OSError, PermissionError):
                        continue

                if len(matches) >= max_results:
                    break
            if len(matches) >= max_results:
                break

        if not matches:
            if content:
                return f"No se encontraron archivos con patrón '{pattern}' que contengan '{content}'."
            return f"No se encontraron archivos con patrón '{pattern}'."

        header = f"{'Archivos encontrados' if content is None else 'Coincidencias encontradas'}: {len(matches)}"
        if len(matches) >= max_results:
            header += f" (límite de {max_results} alcanzado)"
        return header + "\n" + "\n".join(matches)

    except PermissionError as e:
        return f"Error de seguridad: {e}"
    except Exception as e:
        logger.error("search_files_tool failed: %s", e)
        return f"Error en búsqueda: {e}"


# ─────────────────────────────────────────────────────────────────────────────
# patch_file_tool  (FASE 2 — Native Desktop Tools)
# ─────────────────────────────────────────────────────────────────────────────

@tool
def patch_file_tool(path: str, old_string: str, new_string: str) -> str:
    """
    Reemplaza una cadena exacta en un archivo y devuelve el diff unificado.
    La cadena debe aparecer exactamente una vez en el archivo.

    Args:
        path:       Ruta relativa al workspace del archivo a editar.
        old_string: Texto exacto a reemplazar (debe existir una sola vez).
        new_string: Texto de reemplazo.

    Returns:
        Diff unificado del cambio aplicado, o mensaje de error.
    """
    try:
        if not _check_rate_limit("patch_file_tool"):
            return "Error: Demasiadas solicitudes. Espera un momento antes de editar más archivos."

        if len(old_string) > _MAX_CONTENT_SIZE or len(new_string) > _MAX_CONTENT_SIZE:
            return "Error: El contenido del parche excede el límite de 5MB."

        # Resolve and validate path
        raw_path = path.strip()
        root = _workspace_root()
        candidate = Path(raw_path)
        if not candidate.is_absolute():
            candidate = root / candidate
        resolved = candidate.resolve()

        # Validate blocked patterns (siempre, antes de leer)
        lower_path = str(resolved).lower()
        for pattern in BLOCKED_FILE_PATTERNS:
            if pattern.search(lower_path):
                return f"Error de seguridad: ruta bloqueada por patrón '{pattern.pattern}'."
        if resolved.name in DENYLIST_FILES:
            return f"Error de seguridad: archivo bloqueado: {resolved}"
        if ".ssh" in {part.lower() for part in resolved.parts}:
            return f"Error de seguridad: archivo bloqueado: {resolved}"

        # Check workspace containment (misma lógica que _get_safe_path)
        try:
            resolved_norm = Path(os.path.normcase(str(resolved)))
            root_norm = Path(os.path.normcase(str(root)))
            inside_workspace = resolved_norm.is_relative_to(root_norm)
        except (ValueError, AttributeError):
            inside_workspace = False
        if not inside_workspace:
            if not request_permission_sync("patch_file_tool", resolved, ""):
                return "Edición rechazada por el usuario: ruta fuera del workspace permitido."

        _validate_path(resolved)

        # Leer archivo y generar diff ANTES de pedir permiso
        original = resolved.read_text(encoding="utf-8")

        count = original.count(old_string)
        if count == 0:
            return (
                f"Error: La cadena a reemplazar no se encontró en '{path}'.\n"
                "Verifica que el texto sea exacto (incluyendo espacios e indentación)."
            )
        if count > 1:
            return (
                f"Error: La cadena aparece {count} veces en '{path}'. "
                "Incluye más contexto (líneas circundantes) para hacerla única."
            )

        patched = original.replace(old_string, new_string, 1)

        diff = difflib.unified_diff(
            original.splitlines(keepends=True),
            patched.splitlines(keepends=True),
            fromfile=f"a/{path}",
            tofile=f"b/{path}",
            lineterm="",
        )
        diff_text = "".join(diff)

        # Mostrar diff en Monaco (Editor Bridge) antes de escribir
        # Siempre usa request_diff_approval cuando hay Electron
        # (cae a preview text si no hay Electron o si timeout)
        approved = request_diff_approval(
            file_path=str(resolved),
            original_content=original,
            new_content=patched,
            language=path.rsplit(".", 1)[-1] if "." in path else "",
        )
        if not approved:
            return "Edición rechazada por el usuario."

        # Escribir solo si hay aprobación
        filepath = resolved
        filepath.write_text(patched, encoding="utf-8")

        logger.info("patch_file_tool: patched %s", filepath)
        _emit_file_changed(filepath)
        return f"Archivo editado exitosamente: {path}\n\n```diff\n{diff_text}\n```"

    except FileNotFoundError as e:
        return f"Error: {e}"
    except PermissionError as e:
        logger.warning("patch_file_tool blocked: %s", e)
        return f"Error de seguridad: {e}"
    except Exception as e:
        logger.error("patch_file_tool failed for '%s': %s", path, e)
        return f"Error al editar archivo: {e}"


# ─────────────────────────────────────────────────────────────────────────────
# delete_file_tool  (FASE 2 — Native Desktop Tools)
# ─────────────────────────────────────────────────────────────────────────────

@tool
def delete_file_tool(path: str) -> str:
    """
    Elimina un archivo o directorio vacío del workspace.
    Operación irreversible — úsala solo cuando el usuario lo haya pedido explícitamente.

    Args:
        path: Ruta relativa al workspace del archivo o directorio a eliminar.

    Returns:
        Confirmación de la operación o mensaje de error.
    """
    try:
        if not _check_rate_limit("delete_file_tool"):
            return "Error: Demasiadas solicitudes. Espera un momento antes de eliminar más archivos."

        filepath = _get_safe_path(
            path,
            tool_name="delete_file_tool",
            preview="Operación de eliminación",
            require_permission=True,
        )

        if not filepath.exists():
            return f"Error: '{path}' no existe en el workspace."

        if filepath.is_dir():
            contents = list(filepath.iterdir())
            if contents:
                return (
                    f"Error: El directorio '{path}' no está vacío ({len(contents)} elementos). "
                    "Elimina los archivos internos primero, o usa delete_file_tool sobre cada uno."
                )
            trash_path = _move_to_trash(filepath)
            logger.info("delete_file_tool: moved empty dir to trash %s -> %s", filepath, trash_path)
            _emit_file_changed(filepath.parent)
            return f"Directorio vacío movido a la papelera: {path}"
        else:
            trash_path = _move_to_trash(filepath)
            logger.info("delete_file_tool: moved file to trash %s -> %s", filepath, trash_path)
            _emit_file_changed(filepath.parent)
            return f"Archivo movido a la papelera: {path}"

    except PermissionError as e:
        logger.warning("delete_file_tool blocked: %s", e)
        return f"Error de seguridad: {e}"
    except Exception as e:
        logger.error("delete_file_tool failed for '%s': %s", path, e)
        return f"Error al eliminar: {e}"


# ─────────────────────────────────────────────────────────────────────────────
# inject_workspace_guidance — actualiza descriptions antes de cada ejecución
# ─────────────────────────────────────────────────────────────────────────────

# ─────────────────────────────────────────────────────────────────────────────
# Rate limiting helper (conecta tool_rate_limiter a las tools de archivo)
# ─────────────────────────────────────────────────────────────────────────────

def _check_rate_limit(tool_name: str) -> bool:
    """Check if this tool call passes the global tool rate limiter.

    Uses the tool name as key (coarse but effective — 30 req/s global
    across all sessions per tool type).  Returns True if allowed.
    """
    return tool_rate_limiter.check(f"file:{tool_name}")


# ─────────────────────────────────────────────────────────────────────────────
# inject_workspace_guidance — actualiza descriptions antes de cada ejecución
# ─────────────────────────────────────────────────────────────────────────────

def inject_workspace_guidance() -> None:
    """Update all tool descriptions with the current workspace root.

    Call this right before each graph execution so the LLM sees the correct
    workspace path even if SPARTA_WORKSPACE_ROOT changed since import time.
    """
    guidance = _workspace_guidance()
    read_file_tool.description = (
        f"{read_file_tool.__original_description}\n\n{guidance}"  # type: ignore[attr-defined]
    )
    write_file_tool.description = (
        f"{write_file_tool.__original_description}\n\n{guidance}\n"  # type: ignore[attr-defined]
        "Si la escritura falla, informa el error al usuario y no pegues el archivo completo en el chat."
    )
    for _t in (search_files_tool, patch_file_tool, delete_file_tool):
        _t.description = f"{_t.__original_description}\n\n{guidance}"  # type: ignore[attr-defined]


# Bootstrap: save originals once, then inject current workspace
_ALL_FILE_TOOLS = (read_file_tool, write_file_tool, search_files_tool, patch_file_tool, delete_file_tool)
for _t in _ALL_FILE_TOOLS:
    _t.__original_description = _t.description  # type: ignore[attr-defined]
inject_workspace_guidance()
