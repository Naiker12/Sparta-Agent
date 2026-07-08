import logging
import os
import re
import subprocess
from pathlib import Path
from langchain_core.tools import tool

logger = logging.getLogger("sparta_ai.tools.diagnostics")

_DIAGNOSTIC_COMMANDS: dict[str, list[str]] = {
    ".ts":    ["npx", "tsc", "--noEmit", "--pretty"],
    ".tsx":   ["npx", "tsc", "--noEmit", "--pretty"],
    ".js":    ["npx", "eslint"],
    ".jsx":   ["npx", "eslint"],
    ".py":    ["python", "-m", "pylint", "--output-format=text"],
    ".rs":    ["cargo", "check", "--message-format=short"],
    ".go":    ["go", "vet"],
}

_EXTENSION_PATTERNS: dict[str, list[re.Pattern]] = {
    "eslint": [re.compile(r"^(.+?):(\d+):(\d+):\s+(.+?)\s+(.+)$")],
    "tsc":    [re.compile(r"^(.+)\((\d+),(\d+)\):\s+(error|warning)\s+(.+)$")],
    "pylint": [re.compile(r"^(.+):(\d+):(\d+):\s+([WE CFR]+\d+):\s+(.+)$")],
    "cargo":  [re.compile(r"^(.+):(\d+):(\d+):\s+(error|warning)\[.*\]\s+(.+)$")],
}

_IGNORED_DIRS = {"node_modules", ".git", ".venv", "__pycache__", "dist", "build", ".next", "target"}


def _workspace_root() -> Path | None:
    root = os.environ.get("SPARTA_WORKSPACE_ROOT")
    return Path(root).resolve() if root else None


def _detect_command(file_path: str) -> tuple[str | None, list[str]]:
    ext = Path(file_path).suffix.lower()
    base_cmd = _DIAGNOSTIC_COMMANDS.get(ext)
    if not base_cmd:
        parent = Path(file_path).parent
        if (parent / "tsconfig.json").exists() or (parent / "jsconfig.json").exists():
            base_cmd = ["npx", "tsc", "--noEmit", "--pretty"]
        elif list(parent.glob("*.sln")) or list(parent.glob("*.csproj")):
            base_cmd = ["dotnet", "build", "--no-restore"]
        else:
            return None, []
    return ext, base_cmd


def _parse_output(output: str, ext: str | None) -> list[dict]:
    results: list[dict] = []
    patterns = _EXTENSION_PATTERNS.get(
        "eslint" if ext in (".js", ".jsx", ".ts", ".tsx") else
        "tsc" if ext in (".ts", ".tsx") else
        "pylint" if ext == ".py" else
        "cargo" if ext == ".rs" else "",
        [],
    )
    for line in output.splitlines():
        for pat in patterns:
            m = pat.match(line)
            if m:
                results.append({
                    "file": m.group(1),
                    "line": int(m.group(2)),
                    "column": int(m.group(3)),
                    "severity": "error" if "error" in m.group(4).lower() else "warning",
                    "message": m.group(5).strip(),
                })
                break
    return results


@tool
def get_diagnostics_tool(path: str) -> str:
    """Ejecuta lint o type-check sobre un archivo y devuelve errores estructurados.

    Detecta automáticamente el lenguaje por extensión:
      .ts/.tsx → tsc --noEmit
      .js/.jsx → eslint
      .py      → pylint
      .rs      → cargo check
      .go      → go vet

    Args:
        path: Ruta del archivo a analizar (relativa al workspace).

    Returns:
        Lista de errores/advertencias con archivo, línea, columna y mensaje.
        Vacío si no hay errores o si el lenguaje no tiene diagnóstico disponible.
    """
    root = _workspace_root()
    if not root:
        return "Error: No hay un proyecto vinculado. Selecciona una carpeta de proyecto."

    target = root / path if not Path(path).is_absolute() else Path(path)
    if not target.exists():
        return f"Error: El archivo '{path}' no existe."
    if target.is_dir():
        return f"Error: '{path}' es un directorio, no un archivo."

    ext, cmd = _detect_command(str(target))
    if not cmd:
        return f"No hay diagnóstico disponible para archivos {ext or 'con esta extensión'}."

    logger.info("Running diagnostics on %s: %s", target, " ".join(cmd))
    try:
        result = subprocess.run(
            cmd + [str(target)],
            capture_output=True, text=True, timeout=60,
            cwd=str(root),
        )
    except FileNotFoundError:
        return f"Error: El comando '{cmd[0]}' no está instalado en el sistema."
    except subprocess.TimeoutExpired:
        return f"Error: El diagnóstico excedió el límite de 60s."

    combined = (result.stdout or "") + ("\n" + result.stderr if result.stderr else "")
    if not combined.strip():
        return "No se encontraron errores de diagnóstico."

    parsed = _parse_output(combined, ext)
    if not parsed:
        return combined.strip()[:2000]

    lines = [f"Diagnóstico de {path}: ({len(parsed)} problemas encontrados)"]
    for p in parsed[:50]:
        sev = "🔴" if p["severity"] == "error" else "🟡"
        lines.append(f"  {sev} {p['file']}:{p['line']}:{p['column']} — {p['message']}")
    if len(parsed) > 50:
        lines.append(f"  ... y {len(parsed) - 50} más")
    return "\n".join(lines)
