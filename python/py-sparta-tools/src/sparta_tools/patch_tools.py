"""Atomic multi-file patch tool.

Apply coordinated edits across multiple files in a single call.
If ANY edit fails validation, NONE are written (dry-run first).
"""

import difflib
import logging
from pathlib import Path

from langchain_core.tools import tool

from sparta_tools.file_tools import (
    _MAX_CONTENT_SIZE,
    BLOCKED_FILE_PATTERNS,
    DENYLIST_FILES,
    _check_rate_limit,
    _emit_file_changed,
    _validate_path,
)
from sparta_tools.permission_broker import request_diff_approval

logger = logging.getLogger("sparta_ai.tools.patch")


def _validate_edit(
    edit: dict, root: Path
) -> tuple[Path, str, str, str | None]:
    """Validate a single edit dict. Returns (resolved, original, patched, error_msg)."""
    path = edit.get("path", "")
    old_string = edit.get("old_string", "")
    new_string = edit.get("new_string", "")

    if not path:
        return Path(), "", "", "Falta 'path' en un edit."
    if not old_string:
        return Path(), "", "", f"Falta 'old_string' en edit para '{path}'."

    raw_path = path.strip()
    candidate = Path(raw_path)
    if not candidate.is_absolute():
        candidate = root / candidate
    resolved = candidate.resolve()

    lower_path = str(resolved).lower()
    for pattern in BLOCKED_FILE_PATTERNS:
        if pattern.search(lower_path):
            return (
                Path(), "", "",
                f"Error de seguridad: ruta bloqueada por patrón '{pattern.pattern}'."
            )
    if resolved.name in DENYLIST_FILES:
        return Path(), "", "", f"Error de seguridad: archivo bloqueado: {resolved}"
    if ".ssh" in {part.lower() for part in resolved.parts}:
        return Path(), "", "", f"Error de seguridad: archivo bloqueado: {resolved}"

    try:
        _validate_path(resolved)
    except (FileNotFoundError, ValueError) as e:
        return Path(), "", "", str(e)

    original = resolved.read_text(encoding="utf-8")

    if len(old_string) > _MAX_CONTENT_SIZE or len(new_string) > _MAX_CONTENT_SIZE:
        return Path(), "", "", "Error: el contenido del parche excede el límite de 5MB."

    count = original.count(old_string)
    if count == 0:
        return Path(), "", "", (
            f"Error: la cadena a reemplazar no se encontró en '{path}'.\n"
            "Verifica que el texto sea exacto (incluyendo espacios e indentación)."
        )
    if count > 1:
        return Path(), "", "", (
            f"Error: la cadena aparece {count} veces en '{path}'. "
            "Incluye más contexto para hacerla única."
        )

    patched = original.replace(old_string, new_string, 1)
    return resolved, original, patched, None


@tool
def apply_patch_tool(edits: list[dict]) -> str:
    """
    Aplica múltiples ediciones de forma atómica en varios archivos.

    Si CUALQUIERA falla (old_string no encontrado, ambiguo, o el archivo no
    existe), no aplica NINGUNO — primero valida todo, luego escribe todo.

    Args:
        edits: Lista de diccionarios, cada uno con:
            - path: Ruta relativa al workspace del archivo.
            - old_string: Texto exacto a reemplazar (debe existir una sola vez).
            - new_string: Texto de reemplazo.

    Returns:
        Diffs unificados de todos los cambios aplicados, o mensaje de error.
    """
    try:
        if not _check_rate_limit("apply_patch_tool"):
            return "Error: Demasiadas solicitudes. Espera un momento."

        if not edits:
            return "Error: se requiere al menos un edit."

        from sparta_tools.file_tools import _workspace_root
        root = _workspace_root()

        validated: list[tuple[Path, str, str, str]] = []
        errors: list[str] = []

        for i, edit in enumerate(edits):
            if not isinstance(edit, dict):
                errors.append(f"Edit #{i}: no es un diccionario válido.")
                continue
            resolved, original, patched, err = _validate_edit(edit, root)
            if err:
                errors.append(f"Edit #{i} ({edit.get('path', '?')}): {err}")
            else:
                validated.append((resolved, original, patched, edit.get("path", "")))

        if errors:
            return "No se aplicó ningún cambio. Errores:\n" + "\n".join(errors)

        # --- Dry-run passed: apply all edits ---
        diffs: list[str] = []
        written: list[Path] = []

        for resolved, original, patched, rel_path in validated:
            approved = request_diff_approval(
                file_path=str(resolved),
                original_content=original,
                new_content=patched,
                language=rel_path.rsplit(".", 1)[-1] if "." in rel_path else "",
            )
            if not approved:
                # Rollback any already-written files
                for wp, wo in zip(written, [v[1] for v in validated[:len(written)]]):
                    wp.write_text(wo, encoding="utf-8")
                return "Edición rechazada por el usuario. No se aplicó ningún cambio."

            resolved.write_text(patched, encoding="utf-8")
            written.append(resolved)

            diff = difflib.unified_diff(
                original.splitlines(keepends=True),
                patched.splitlines(keepends=True),
                fromfile=f"a/{rel_path}",
                tofile=f"b/{rel_path}",
                lineterm="",
            )
            diffs.append(f"### {rel_path}\n```diff\n{''.join(diff)}\n```")
            _emit_file_changed(resolved)

        logger.info("apply_patch_tool: patched %d files", len(written))
        return f"Archivos editados exitosamente ({len(written)}):\n\n" + "\n\n".join(diffs)

    except Exception as e:
        logger.error("apply_patch_tool failed: %s", e)
        return f"Error al aplicar parche atómico: {e}"
