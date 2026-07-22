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
    ".mjs":   ["npx", "eslint"],
    ".cjs":   ["npx", "eslint"],
    ".py":    ["python", "-m", "pylint", "--output-format=text"],
    ".rs":    ["cargo", "check", "--message-format=short"],
    ".go":    ["go", "vet"],
    ".css":   ["npx", "stylelint"],
    ".scss":  ["npx", "stylelint"],
    ".sass":  ["npx", "stylelint"],
}

_EXTENSION_PATTERNS: dict[str, list[re.Pattern]] = {
    "eslint":   [re.compile(r"^(.+?):(\d+):(\d+):\s+(.+?)\s+(.+)$")],
    "tsc":      [re.compile(r"^(.+)\((\d+),(\d+)\):\s+(error|warning)\s+(.+)$")],
    "pylint":   [re.compile(r"^(.+):(\d+):(\d+):\s+([WE CFR]+\d+):\s+(.+)$")],
    "cargo":    [re.compile(r"^(.+):(\d+):(\d+):\s+(error|warning)\[.*\]\s+(.+)$")],
    "ruff":     [re.compile(r"^(.+):(\d+):(\d+):\s+(\d+)\s+(.+)$")],
    "mypy":     [re.compile(r"^(.+):(\d+):(\d+):\s+(error|warning|note):\s+(.+)$")],
    "stylelint":[re.compile(r"^(.+):(\d+):(\d+):\s+\u2716\s+(.+)$")],
}

_IGNORED_DIRS = {"node_modules", ".git", ".venv", "__pycache__", "dist", "build", ".next", "target"}


def _workspace_root() -> Path | None:
    root = os.environ.get("SPARTA_WORKSPACE_ROOT")
    return Path(root).resolve() if root else None


def _detect_command(file_path: str) -> tuple[str | None, list[str]]:
    ext = Path(file_path).suffix.lower()
    parent = Path(file_path).parent

    base_cmd = _DIAGNOSTIC_COMMANDS.get(ext)
    if base_cmd:
        return ext, base_cmd

    # Fallbacks por deteccion de config
    if (parent / "tsconfig.json").exists() or (parent / "jsconfig.json").exists():
        return ".ts", ["npx", "tsc", "--noEmit", "--pretty"]
    if (parent / "pyproject.toml").exists():
        # Prefer ruff if configured, fallback to pylint
        pyproject = parent / "pyproject.toml"
        if "ruff" in pyproject.read_text():
            return ".py", ["python", "-m", "ruff", "check"]
        return ".py", ["python", "-m", "pylint", "--output-format=text"]
    if list(parent.glob("*.sln")) or list(parent.glob("*.csproj")):
        return ".cs", ["dotnet", "build", "--no-restore"]
    if (parent / ".eslintrc.js").exists() or (parent / ".eslintrc.json").exists() or (parent / "eslint.config.js").exists():
        return ".js", ["npx", "eslint"]
    return None, []


def _try_fallback(cmd_base: list[str], target: Path, root: Path) -> str | None:
    """Try running a diagnostic, return None if tool not found."""
    try:
        result = subprocess.run(
            cmd_base + [str(target)],
            capture_output=True, text=True, timeout=30,
            cwd=str(root),
        )
        combined = (result.stdout or "") + ("\n" + result.stderr if result.stderr else "")
        return combined.strip() or None
    except FileNotFoundError:
        return None
    except subprocess.TimeoutExpired:
        return None


def _parse_output(output: str, ext: str | None, raw_cmd: list[str]) -> list[dict]:
    results: list[dict] = []
    cmd_name = Path(raw_cmd[0]).name if raw_cmd else ""

    # Detect linter from command
    linter_key = ""
    if "ruff" in cmd_name:
        linter_key = "ruff"
    elif "mypy" in cmd_name:
        linter_key = "mypy"
    elif "stylelint" in cmd_name:
        linter_key = "stylelint"
    elif "eslint" in cmd_name:
        linter_key = "eslint"
    elif "tsc" in cmd_name:
        linter_key = "tsc"
    elif "pylint" in cmd_name:
        linter_key = "pylint"
    elif "cargo" in cmd_name or "rustc" in cmd_name:
        linter_key = "cargo"
    elif ext in (".ts", ".tsx"):
        linter_key = "tsc"
    elif ext in (".js", ".jsx", ".mjs", ".cjs"):
        linter_key = "eslint"
    elif ext == ".py":
        linter_key = "pylint"
    elif ext == ".rs":
        linter_key = "cargo"

    patterns = _EXTENSION_PATTERNS.get(linter_key, [])
    for line in output.splitlines():
        for pat in patterns:
            m = pat.match(line.strip())
            if m:
                file = m.group(1)
                line_num = int(m.group(2))
                col = int(m.group(3))
                severity = "error" if "error" in m.group(4).lower() else \
                           "warning" if "warning" in m.group(4).lower() else "info"
                msg = m.group(5).strip() if m.lastindex >= 5 else m.group(4).strip()
                results.append({
                    "file": file, "line": line_num, "column": col,
                    "severity": severity, "message": msg,
                })
                break
    return results


@tool
def get_diagnostics_tool(path: str) -> str:
    """Ejecuta lint o type-check sobre un archivo y devuelve errores estructurados.

    Detecta automáticamente el lenguaje por extensión:
      .ts/.tsx → tsc --noEmit         .js/.jsx → eslint
      .py      → pylint (o ruff)      .rs      → cargo check
      .go      → go vet               .css/.scss → stylelint

    Args:
        path: Ruta del archivo a analizar (relativa al workspace).

    Returns:
        Lista de errores/advertencias con archivo, línea, columna y mensaje.
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
        return f"No hay diagnóstico disponible para '{path}'."

    logger.info("Running diagnostics on %s: %s", target, " ".join(cmd))
    try:
        result = subprocess.run(
            cmd + [str(target)],
            capture_output=True, text=True, timeout=60,
            cwd=str(root),
        )
    except FileNotFoundError:
        # Try fallback linters
        fallbacks = {
            ".py": [["python", "-m", "ruff", "check"], ["python", "-m", "mypy", "--show-error-codes"]],
            ".js": [["npx", "oxlint"], ["npx", "eslint"]],
            ".ts": [["npx", "oxlint"], ["npx", "eslint"]],
        }
        for fb_cmd in fallbacks.get(ext or "", []):
            fb_result = _try_fallback(fb_cmd, target, root)
            if fb_result:
                parsed = _parse_output(fb_result, ext, fb_cmd)
                return _format_result(path, parsed, fb_result)
        return f"Error: El comando '{cmd[0]}' no está instalado."
    except subprocess.TimeoutExpired:
        return f"Error: El diagnóstico excedió el límite de 60s."

    combined = (result.stdout or "") + ("\n" + result.stderr if result.stderr else "")
    if not combined.strip():
        return f"No se encontraron errores de diagnóstico en '{path}'."

    parsed = _parse_output(combined, ext, cmd)
    if not parsed:
        return combined.strip()[:3000]

    return _format_result(path, parsed, combined)


def _format_result(path: str, parsed: list[dict], raw: str = "") -> str:
    errors = [p for p in parsed if p["severity"] == "error"]
    warnings = [p for p in parsed if p["severity"] in ("warning", "info")]
    lines = [f"Diagnóstico de {path}: {len(errors)} errores, {len(warnings)} advertencias"]
    for p in parsed[:50]:
        icon = "🔴" if p["severity"] == "error" else "🟡"
        lines.append(f"  {icon} {p['file']}:{p['line']}:{p['column']} — {p['message']}")
    if len(parsed) > 50:
        lines.append(f"  ... y {len(parsed) - 50} más")
    return "\n".join(lines)
