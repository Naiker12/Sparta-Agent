"""Delete file tool."""
import logging

from langchain_core.tools import tool

from sparta_ai.tools.file.workspace_paths import _get_safe_path, _move_to_trash, _emit_file_changed
from sparta_ai.tools.file.rate_limit import _check_rate_limit

logger = logging.getLogger("sparta_ai.tools.file")


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
