"""Unified path validation for file tools.

Replaces ad-hoc path checks scattered across file_tools.py with a single
source of truth. Validates that requested paths stay within the workspace
root and are not in the denylist.
"""
import logging
import os
from pathlib import Path

logger = logging.getLogger("sparta_ai.security.path")


class SecurityError(Exception):
    """Raised when a path validation fails."""


class PathGuard:
    """Validates file paths against workspace root and denylist."""

    def __init__(self, workspace_root: Path | str | None = None):
        root_env = os.environ.get("SPARTA_WORKSPACE_ROOT")
        if workspace_root is not None:
            self._root = Path(workspace_root).resolve()
        elif root_env:
            self._root = Path(root_env).resolve()
        else:
            self._root = Path.cwd().resolve()
            logger.warning(
                "SPARTA_WORKSPACE_ROOT no está definida. Usando CWD: %s. "
                "Las herramientas de archivo pueden rechazar rutas del usuario.",
                self._root,
            )

        self._denylist = {
            ".env",
            "sparta-vault.json",
            "id_rsa",
            "id_ed25519",
            "id_ecdsa",
            "id_ecdsa_sk",
            "id_ed25519_sk",
        }

    @property
    def root(self) -> Path:
        return self._root

    def validate(self, requested_path: str) -> Path:
        """Validate and return the resolved path.

        Raises SecurityError if the path is outside the workspace or on the
        denylist.
        """
        raw = requested_path.strip()
        candidate = Path(raw)

        # Normalize leading slash on Windows
        if os.name == "nt" and raw.startswith(("/", "\\")) and not raw.startswith(("//", "\\\\")) and not (len(raw) >= 3 and raw[1:3] == ":\\"):
            candidate = Path(raw.lstrip("/\\"))

        if not candidate.is_absolute():
            candidate = self._root / candidate

        resolved = candidate.resolve()

        try:
            inside = os.path.commonpath([str(self._root), str(resolved)]) == str(self._root)
        except ValueError:
            inside = False

        if not inside:
            raise SecurityError(
                f"Ruta fuera del workspace permitido: {resolved}. "
                f"Workspace permitido: {self._root}. "
                "Usa rutas relativas al workspace, por ejemplo 'src/authController.js'."
            )

        if resolved.name in self._denylist:
            raise SecurityError(f"Acceso bloqueado a archivo sensible: {resolved}")

        if ".ssh" in {part.lower() for part in resolved.parts}:
            raise SecurityError(f"Acceso bloqueado a archivo sensible: {resolved}")

        return resolved
