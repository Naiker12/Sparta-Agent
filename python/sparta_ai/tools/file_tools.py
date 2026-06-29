import os
import logging
from pathlib import Path
from typing import Optional

from langchain_core.tools import tool

logger = logging.getLogger("sparta_ai.tools.file")

WORKSPACE_ROOT = Path(os.environ.get("SPARTA_WORKSPACE_ROOT", Path.cwd())).resolve()
DENYLIST_FILES = {".env", "sparta-vault.json", "id_rsa", "id_ed25519", "id_ecdsa", "id_ecdsa_sk", "id_ed25519_sk"}


def _get_safe_path(path: str) -> Path:
    resolved = Path(path).resolve()
    if not str(resolved).startswith(str(WORKSPACE_ROOT)):
        raise PermissionError(f"Ruta fuera del workspace permitido: {resolved}")
    if resolved.name in DENYLIST_FILES:
        raise PermissionError(f"Acceso bloqueado a archivo sensible: {resolved}")
    if ".ssh" in resolved.parts:
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
        path: Ruta absoluta o relativa al archivo.
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
        path: Ruta absoluta o relativa al archivo.
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
        return f"Error al escribir archivo: {e}"
