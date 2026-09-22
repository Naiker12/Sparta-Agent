from __future__ import annotations

from typing import Optional, Any


def _find_binary() -> Optional[str]:
    from utils.llama_cpp_path_settings import resolve_llama_server_binary
    res = resolve_llama_server_binary()
    return str(res) if res else None


def get_backend_status() -> dict[str, Any]:
    return {"supported": False, "reason": "not_installed"}


def _plan_llama_phase(backend: str = "cpu") -> dict[str, Any]:
    return {"skip_reason": "not_installed", "refusal": {"reason": "not_installed"}}


def _block_mtmd_sidecar(stack: Any = None) -> bool:
    return False


def _studio_custom_path_active() -> bool:
    return False
