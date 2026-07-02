import os
import logging
from pathlib import Path
from typing import Optional

from langchain_core.tools import tool

logger = logging.getLogger("sparta_ai.tools.file")

def _workspace_root() -> Path:
    root = os.environ.get("SPARTA_WORKSPACE_ROOT")
    if root:
        return Path(root).resolve()
    logger.warning(
        "SPARTA_WORKSPACE_ROOT no está definida. Usando CWD: %s. "
        "Las herramientas de archivo pueden rechazar rutas del usuario.",
        Path.cwd(),
    )
    return Path.cwd().resolve()

DENYLIST_FILES = {".env", "sparta-vault.json", "id_rsa", "id_ed25519", "id_ecdsa", "id_ecdsa_sk", "id_ed25519_sk"}


def _get_safe_path(path: str) -> Path:
    raw_path = path.strip()
    candidate = Path(raw_path)
    root = _workspace_root()

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
        inside_workspace = os.path.commonpath([str(root), str(resolved)]) == str(root)
    except ValueError:
        inside_workspace = False

    if not inside_workspace:
        guidance = (
            f"Workspace permitido: {root}. Usa rutas relativas al workspace, "
            "por ejemplo 'src/authController.js'. No uses rutas absolutas como /tmp/... ni C:\\..."
        )
        raise PermissionError(
            f"Ruta fuera del workspace permitido: {resolved}. {guidance}"
        )
    if resolved.name in DENYLIST_FILES:
        raise PermissionError(f"Acceso bloqueado a archivo sensible: {resolved}")
    if ".ssh" in {part.lower() for part in resolved.parts}:
        raise PermissionError(f"Acceso bloqueado a archivo sensible: {resolved}")
    return resolved


def _validate_path(path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(f"El archivo no existe: {path}")
    if not path.is_file():
        raise ValueError(f"La ruta no es un archivo: {path}")


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
        filepath = _get_safe_path(path)
        _validate_path(filepath)

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
        filepath = _get_safe_path(path)

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
        return f"Archivo {mode}: {filepath} ({line_count} líneas, {char_count} caracteres)."

    except PermissionError as e:
        logger.warning("write_file_tool blocked: %s", e)
        return f"Error de seguridad: {e}"
    except Exception as e:
        logger.error("write_file_tool failed for '%s': %s", path, e)
        return f"Error al escribir archivo: {e}. Informa este error al usuario; no pegues el archivo completo en el chat como respaldo."


def _workspace_guidance() -> str:
    root = _workspace_root()
    return (
        f"Workspace permitido: {root}. Usa rutas relativas al workspace, "
        "por ejemplo 'src/authController.js'. No uses rutas absolutas como /tmp/... ni C:\\..."
    )

# Description is set dynamically before each agent run via inject_workspace_guidance().
# The static defaults at import time use whatever SPARTA_WORKSPACE_ROOT is set to then.


def inject_workspace_guidance() -> None:
    """Update tool descriptions with current workspace root.

    Call this right before each graph execution so the LLM sees the correct
    workspace path even if SPARTA_WORKSPACE_ROOT changed since import time.
    """
    guidance = _workspace_guidance()
    read_file_tool.description = f"{getattr(read_file_tool, '__original_description', '')}\n\n{guidance}"
    write_file_tool.description = (
        f"{getattr(write_file_tool, '__original_description', '')}\n\n{guidance}\n"
        "Si la escritura falla, informa el error al usuario y no pegues el archivo completo en el chat."
    )


# Save original descriptions without workspace guidance
read_file_tool.__original_description = read_file_tool.description
write_file_tool.__original_description = write_file_tool.description
inject_workspace_guidance()
