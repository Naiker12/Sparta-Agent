"""Herramientas de exploración de repositorio para el agente de código.

Reutilizan la lógica de seguridad de file_tools.py para las mismas restricciones
(no permite salir del workspace, bloquea .env/.git/node_modules/etc.).
"""
import fnmatch
import logging
import subprocess
from pathlib import Path

from langchain_core.tools import tool

from sparta_tools.file_tools import _get_safe_path, _workspace_root

logger = logging.getLogger("sparta_ai.tools.code_search")

EXCLUDED_DIRS = {
    "node_modules",
    ".git",
    ".venv",
    "venv",
    "dist",
    "dist-electron",
    "__pycache__",
    ".next",
    ".pytest_cache",
    "build",
}


def _is_excluded(path: Path) -> bool:
    return any(part in EXCLUDED_DIRS for part in path.parts)


def fast_rglob_files(root: Path) -> list[Path]:
    files = []
    def walk(path: Path):
        try:
            for item in path.iterdir():
                if item.name.startswith(".") or item.name in EXCLUDED_DIRS:
                    continue
                if item.is_dir():
                    walk(item)
                elif item.is_file():
                    files.append(item)
        except (PermissionError, OSError):
            pass
    walk(root)
    return files


def _safe_base(path: str, tool_name: str = "list_directory_tool", preview: str = "") -> Path:
    """Resolve and validate a directory path inside the workspace."""
    if not path or path.strip() in (".", ""):
        return _workspace_root()
    resolved = _get_safe_path(path, tool_name=tool_name, preview=preview)
    if resolved.is_file():
        return resolved.parent
    return resolved


@tool
def list_directory_tool(path: str = ".", max_depth: int = 2) -> str:
    """
    Lista archivos y carpetas del workspace en forma de árbol, hasta max_depth
    niveles. Úsalo SIEMPRE antes de editar código que no has leído todavía,
    para entender la estructura del proyecto (dónde está package.json,
    pyproject.toml, src/, etc.).

    Args:
        path: Ruta relativa al workspace (default: raíz).
        max_depth: Profundidad máxima del árbol (default: 2).

    Returns:
        Árbol de archivos y carpetas como texto plano.
    """
    try:
        root = _safe_base(path)
        if not root.exists():
            return f"Error: el directorio no existe: {path}"
        if not root.is_dir():
            return f"Error: '{path}' no es un directorio."

        lines: list[str] = []

        def walk(current: Path, depth: int, prefix: str) -> None:
            if depth > max_depth:
                return
            try:
                entries = sorted(
                    current.iterdir(),
                    key=lambda e: (not e.is_dir(), e.name.lower()),
                )
            except PermissionError:
                return
            for entry in entries:
                if entry.name in EXCLUDED_DIRS or _is_excluded(entry):
                    continue
                lines.append(f"{prefix}{entry.name}{'/' if entry.is_dir() else ''}")
                if entry.is_dir():
                    walk(entry, depth + 1, prefix + "  ")

        walk(root, 0, "")
        return "\n".join(lines) or "(vacío)"
    except PermissionError as e:
        logger.warning("list_directory_tool blocked: %s", e)
        return f"Error de seguridad: {e}"
    except Exception as e:
        logger.error("list_directory_tool failed for '%s': %s", path, e)
        return f"Error al listar directorio: {e}"


@tool
def glob_search_tool(pattern: str, path: str = ".") -> str:
    """
    Busca archivos por patrón (ej. '**/*.tsx', 'src/**/test_*.py').
    Devuelve rutas relativas al workspace, excluyendo node_modules/.git/etc.

    Args:
        pattern: Patrón glob a buscar.
        path: Directorio base relativo al workspace (default: raíz).

    Returns:
        Lista de rutas relativas que coinciden, o mensaje de error.
    """
    try:
        root = _safe_base(path)
        if not root.is_dir():
            return f"Error: '{path}' no es un directorio válido en el workspace."

        matches: list[str] = []
        for p in fast_rglob_files(root):
            rel = p.relative_to(root)
            if fnmatch.fnmatch(str(rel), pattern) or fnmatch.fnmatch(p.name, pattern):
                matches.append(str(rel))
            if len(matches) >= 200:
                break

        return "\n".join(matches) or "(sin resultados)"
    except PermissionError as e:
        return f"Error de seguridad: {e}"
    except Exception as e:
        logger.error("glob_search_tool failed for '%s': %s", pattern, e)
        return f"Error en búsqueda glob: {e}"


@tool
def grep_search_tool(query: str, path: str = ".", max_results: int = 50) -> str:
    """
    Busca texto dentro de archivos del workspace (como ripgrep).
    Úsalo para encontrar dónde está definida una función, un import,
    un mensaje de error, etc. antes de modificar código.

    Args:
        query: Texto a buscar dentro de los archivos.
        path: Directorio base relativo al workspace (default: raíz).
        max_results: Máximo de coincidencias (default: 50, máx 200).

    Returns:
        Lista de coincidencias con ruta relativa, número de línea y extracto.
    """
    try:
        root = _safe_base(path)
        if not root.is_dir():
            return f"Error: '{path}' no es un directorio válido en el workspace."

        max_results = min(max_results, 200)

        # Prefer ripgrep when available; fall back to a Python scan otherwise.
        try:
            result = subprocess.run(
                [
                    "rg",
                    "--fixed-strings",
                    "--line-number",
                    "--max-count",
                    str(max_results),
                    "--hidden",
                    "--glob",
                    "!.git/**",
                    "--glob",
                    "!node_modules/**",
                    "--glob",
                    "!__pycache__/**",
                    query,
                    str(root),
                ],
                capture_output=True,
                text=True,
                timeout=15,
            )
            if result.returncode in (0, 1):
                lines = result.stdout.strip().splitlines()
                # rg returns absolute paths; convert to workspace-relative.
                rel_lines: list[str] = []
                for line in lines[:max_results]:
                    if ":" in line:
                        abs_path, rest = line.split(":", 1)
                        try:
                            rel = str(Path(abs_path).relative_to(root))
                        except ValueError:
                            rel = abs_path
                        rel_lines.append(f"{rel}:{rest}")
                    else:
                        rel_lines.append(line)
                return "\n".join(rel_lines) or "(sin resultados)"
        except FileNotFoundError:
            pass

        out: list[str] = []
        for p in fast_rglob_files(root):
            if len(out) >= max_results:
                break
            try:
                text = p.read_text(encoding="utf-8", errors="ignore")
                for i, line in enumerate(text.splitlines(), 1):
                    if query in line:
                        rel = p.relative_to(root)
                        out.append(f"{rel}:{i}: {line.strip()}")
                        if len(out) >= max_results:
                            break
            except Exception:
                continue

        return "\n".join(out) or "(sin resultados)"
    except PermissionError as e:
        return f"Error de seguridad: {e}"
    except Exception as e:
        logger.error("grep_search_tool failed for '%s': %s", query, e)
        return f"Error en búsqueda grep: {e}"


@tool
def git_status_tool(path: str = ".") -> str:
    """
    Muestra git status y el diff de cambios no confirmados del workspace.
    Úsalo para saber qué ha cambiado antes y después de editar.

    Args:
        path: Ruta relativa al workspace (default: raíz).

    Returns:
        Salida de `git status --short` y `git diff --stat`.
    """
    try:
        root = _safe_base(path)
        if not root.is_dir():
            return f"Error: '{path}' no es un directorio válido en el workspace."

        status = subprocess.run(
            ["git", "status", "--short"],
            cwd=str(root),
            capture_output=True,
            text=True,
            timeout=10,
        )
        diff_stat = subprocess.run(
            ["git", "diff", "--stat"],
            cwd=str(root),
            capture_output=True,
            text=True,
            timeout=10,
        )

        parts = []
        if status.stdout:
            parts.append(f"STATUS:\n{status.stdout.rstrip()}")
        else:
            parts.append("STATUS:\n(sin cambios)")
        if diff_stat.stdout:
            parts.append(f"\nDIFF STAT:\n{diff_stat.stdout.rstrip()}")
        if status.returncode != 0 and status.stderr:
            parts.append(f"\nERROR:\n{status.stderr.rstrip()}")
        return "\n".join(parts)
    except PermissionError as e:
        return f"Error de seguridad: {e}"
    except Exception as e:
        logger.error("git_status_tool failed for '%s': %s", path, e)
        return f"Error al consultar git: {e}"
