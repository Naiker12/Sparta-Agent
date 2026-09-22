from __future__ import annotations

from pathlib import Path
from typing import Optional, Any


def read_install_marker(path: str | Path | None = None) -> Optional[dict]:
    return None


def check_prebuilt_freshness(binary: Optional[str] = None) -> dict[str, Any]:
    return {"stale": False, "behind": False}
