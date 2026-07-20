"""Write and patch file tools."""
import difflib
import logging
import os
from pathlib import Path

from langchain_core.tools import tool

from sparta_ai.tools.file.workspace_paths import (
    _get_safe_path,
    _validate_path,
    _workspace_root,
    _emit_file_changed,
    _MAX_CONTENT_SIZE,
    BLOCKED_FILE_PATTERNS,
    DENYLIST_FILES,
)
from sparta_ai.tools.file.rate_limit import _check_rate_limit
from sparta_ai.tools.permission_broker import (
    get_agent_autonomy,
    request_diff_approval,
    request_permission_sync,
)

logger = logging.getLogger("sparta_ai.tools.file")


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
        if len(content) > _MAX_CONTENT_SIZE:
            return (
                f"Error: El contenido excede el límite de 5MB "
                f"({len(content)} bytes). Reduce el tamaño del archivo."
            )

        if not _check_rate_limit("write_file_tool"):
            return "Error: Demasiadas solicitudes. Espera un momento antes de escribir más archivos."

        preview_lines = content.split("\n")[:15]
        preview_text = "\n".join(preview_lines)
        if len(content) > 500:
            preview_text += "\n... (truncado, {len(content)} chars total)"
        need_permission = get_agent_autonomy() == "always_ask"
        filepath = _get_safe_path(path, tool_name="write_file_tool", preview=preview_text,
                                  require_permission=need_permission)

        file_exists = filepath.exists() and filepath.stat().st_size > 0

        # Every mutation is reviewed.  In particular, appending to an
        # existing file must not become an approval bypass.
        if not file_exists:
            approved = request_diff_approval(
                file_path=str(filepath),
                original_content="",
                new_content=content,
                language=path.rsplit(".", 1)[-1] if "." in path else "",
            )
            if not approved:
                return (
                    "ACCESO DENEGADO por el usuario. "
                    "NO reintentes esta operación por ningún medio alternativo. "
                    "NO vuelvas a pedir permiso para esta misma ruta. "
                    "Informa al usuario y sigue con otra tarea."
                )
        else:
            original = filepath.read_text(encoding="utf-8")
            approved = request_diff_approval(
                file_path=str(filepath),
                original_content=original,
                new_content=original + content if append else content,
                language=path.rsplit(".", 1)[-1] if "." in path else "",
            )
            if not approved:
                return (
                    "ACCESO DENEGADO por el usuario. "
                    "NO reintentes esta operación por ningún medio alternativo. "
                    "NO vuelvas a pedir permiso para esta misma ruta. "
                    "Informa al usuario y sigue con otra tarea."
                )
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

        raw_path = path.strip()
        root = _workspace_root()
        candidate = Path(raw_path)
        if not candidate.is_absolute():
            candidate = root / candidate
        resolved = candidate.resolve()

        lower_path = str(resolved).lower()
        for pattern in BLOCKED_FILE_PATTERNS:
            if pattern.search(lower_path):
                return f"Error de seguridad: ruta bloqueada por patrón '{pattern.pattern}'."
        if resolved.name in DENYLIST_FILES:
            return f"Error de seguridad: archivo bloqueado: {resolved}"
        if ".ssh" in {part.lower() for part in resolved.parts}:
            return f"Error de seguridad: archivo bloqueado: {resolved}"

        try:
            resolved_norm = Path(os.path.normcase(str(resolved)))
            root_norm = Path(os.path.normcase(str(root)))
            inside_workspace = resolved_norm.is_relative_to(root_norm)
        except (ValueError, AttributeError):
            inside_workspace = False
        if not inside_workspace:
            if not request_permission_sync("patch_file_tool", resolved, ""):
                return (
                    "ACCESO DENEGADO por el usuario. "
                    "NO reintentes esta operación por ningún medio alternativo. "
                    "Informa al usuario y sigue con otra tarea."
                )

        _validate_path(resolved)

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

        approved = request_diff_approval(
            file_path=str(resolved),
            original_content=original,
            new_content=patched,
            language=path.rsplit(".", 1)[-1] if "." in path else "",
        )
        if not approved:
            return (
                "ACCESO DENEGADO por el usuario. "
                "NO reintentes esta operación por ningún medio alternativo. "
                "Informa al usuario y sigue con otra tarea."
            )

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
