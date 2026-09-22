from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Optional

MAX_CUSTOM_LLAMA_CPP_PATH_LENGTH = 4096
CUSTOM_LLAMA_CPP_PATH_SETTING_KEY = "custom_llama_cpp_path"
MANAGED_LLAMA_CPP_PATH_MARKER = "SPARTA_MANAGED_LLAMA_CPP_PATH"

_path_revision: int = 0


def llama_server_binary_name(platform: Optional[str] = None) -> str:
    target = platform or sys.platform
    return "llama-server.exe" if target == "win32" else "llama-server"


def resolve_llama_server_binary(
    root: Path | str | None = None,
    *,
    platform: Optional[str] = None,
) -> Optional[Path]:
    if root is None:
        raw = get_stored_custom_llama_cpp_path()
        if not raw:
            return None
        root = Path(raw)
    elif isinstance(root, str):
        root = Path(root)

    name = llama_server_binary_name(platform)
    candidates = [
        root / name,
        root / "build" / "bin" / name,
        root / "build" / "bin" / "Release" / name,
        root / "bin" / name,
    ]
    for c in candidates:
        if c.is_file():
            if sys.platform != "win32" and not os.access(c, os.X_OK):
                continue
            return c
    return None


def get_stored_custom_llama_cpp_path() -> Optional[str]:
    try:
        from storage.studio_db import get_app_setting
        val = get_app_setting(CUSTOM_LLAMA_CPP_PATH_SETTING_KEY, None)
        return str(val).strip() if val else None
    except Exception:
        return None


def mark_managed_llama_cpp_path(path: Path | str | None) -> bool:
    if not path:
        return False
    p_str = str(Path(path).resolve())
    env_val = os.environ.get("UNSLOTH_LLAMA_CPP_PATH")
    if env_val and str(Path(env_val).resolve()) == p_str:
        os.environ[MANAGED_LLAMA_CPP_PATH_MARKER] = "1"
        return True
    return False


def custom_llama_cpp_path_revision() -> int:
    return _path_revision


def custom_llama_cpp_path_status() -> dict:
    direct = os.environ.get("LLAMA_SERVER_PATH")
    if direct:
        p = Path(direct)
        return {
            "path": direct,
            "source": "environment",
            "editable": False,
            "available": p.is_file(),
            "resolved_binary": direct if p.is_file() else None,
            "environment_variable": "LLAMA_SERVER_PATH",
        }

    env_llama = os.environ.get("UNSLOTH_LLAMA_CPP_PATH")
    is_managed = os.environ.get(MANAGED_LLAMA_CPP_PATH_MARKER) == "1"

    stored = get_stored_custom_llama_cpp_path()
    if stored:
        resolved = resolve_llama_server_binary(Path(stored))
        return {
            "path": stored,
            "source": "studio",
            "editable": True,
            "available": resolved is not None,
            "resolved_binary": str(resolved) if resolved else None,
            "environment_variable": None,
        }

    if env_llama and not is_managed:
        resolved = resolve_llama_server_binary(Path(env_llama))
        return {
            "path": env_llama,
            "source": "environment",
            "editable": False,
            "available": resolved is not None,
            "resolved_binary": str(resolved) if resolved else None,
            "environment_variable": "UNSLOTH_LLAMA_CPP_PATH",
        }

    return {
        "path": None,
        "source": "default",
        "editable": True,
        "available": False,
        "resolved_binary": None,
        "environment_variable": None,
    }


def set_custom_llama_cpp_path(path: Optional[str]) -> Optional[Path]:
    global _path_revision
    env_llama = os.environ.get("UNSLOTH_LLAMA_CPP_PATH")
    is_managed = os.environ.get(MANAGED_LLAMA_CPP_PATH_MARKER) == "1"
    if env_llama and not is_managed:
        raise RuntimeError("Cannot change path while UNSLOTH_LLAMA_CPP_PATH is set.")

    if not path or not path.strip():
        try:
            from storage.studio_db import upsert_app_settings
            upsert_app_settings({CUSTOM_LLAMA_CPP_PATH_SETTING_KEY: None})
        except Exception:
            pass
        _path_revision += 1
        return None

    candidate = Path(path.strip())
    if not candidate.exists():
        raise ValueError(f"Directory {candidate} does not exist")

    binary = resolve_llama_server_binary(candidate)
    if not binary:
        raise ValueError(
            f"No executable {llama_server_binary_name()} was found in that folder "
            "or its build/bin directory."
        )

    resolved = candidate.resolve()
    try:
        from storage.studio_db import upsert_app_settings
        upsert_app_settings({CUSTOM_LLAMA_CPP_PATH_SETTING_KEY: str(resolved)})
    except Exception:
        pass
    _path_revision += 1
    return resolved
