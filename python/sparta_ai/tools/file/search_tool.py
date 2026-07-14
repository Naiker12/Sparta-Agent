"""Search files tool."""
import fnmatch
import logging
import os
from pathlib import Path

from langchain_core.tools import tool

from sparta_ai.tools.file.workspace_paths import _get_safe_path, _workspace_root, _SKIP_DIRS
from sparta_ai.tools.file.rate_limit import _check_rate_limit

logger = logging.getLogger("sparta_ai.tools.file")


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
