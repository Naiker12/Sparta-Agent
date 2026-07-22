"""Read file tools — read_file_tool and read_files_tool."""
import logging

from langchain_core.tools import tool

from sparta_tools.file.workspace_paths import _get_safe_path, _validate_path
from sparta_tools.file.rate_limit import _check_rate_limit

logger = logging.getLogger("sparta_ai.tools.file")


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


@tool
def read_files_tool(paths: list[str]) -> str:
    """
    Lee el contenido de varios archivos del sistema de archivos local en una sola invocación.

    Úsalo cuando necesités leer múltiples archivos relacionados para entender
    un proyecto o responder una pregunta. Es más eficiente que llamar
    read_file_tool varias veces.

    Args:
        paths: Lista de rutas relativas al workspace permitido.

    Returns:
        Contenido de todos los archivos concatenados con separadores claros.
    """
    try:
        if not _check_rate_limit("read_files_tool"):
            return "Error: Demasiadas solicitudes. Espera un momento antes de leer más archivos."
        if not paths:
            return "Error: Se requiere al menos una ruta."
        if len(paths) > 20:
            return "Error: Máximo 20 archivos por llamada."

        results = []
        for p in paths:
            try:
                filepath = _get_safe_path(p, tool_name="read_files_tool")
                _validate_path(filepath)
                size_mb = filepath.stat().st_size / (1024 * 1024)
                if size_mb > 50:
                    results.append(f"### {p}\n\nError: File too large ({size_mb:.1f} MB). Maximum allowed is 50 MB.")
                    continue
                content = filepath.read_text(encoding="utf-8")
                results.append(f"### {p}\n\n{content}")
            except FileNotFoundError as e:
                results.append(f"### {p}\n\nError: {e}")
            except PermissionError as e:
                logger.warning("read_files_tool blocked: %s", e)
                results.append(f"### {p}\n\nError de seguridad: {e}")
            except Exception as e:
                logger.error("read_files_tool failed for '%s': %s", p, e)
                results.append(f"### {p}\n\nError al leer archivo: {e}")

        logger.info("Files read: %d paths", len(paths))
        return "\n\n".join(results)

    except Exception as e:
        logger.error("read_files_tool failed: %s", e)
        return f"Error al leer archivos: {e}"
