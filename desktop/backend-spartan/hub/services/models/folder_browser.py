# Minimal hub services models folder_browser stub
from typing import Any, List, Set
from pathlib import Path


def _build_browse_allowlist() -> Set[Path]:
    return set()


def _is_path_inside_allowlist(path: Any, allowlist: Any) -> bool:
    return True
