"""Load and validate ``sparta.hooks.json`` from the workspace root."""

import json
import logging
from pathlib import Path

from sparta_hooks.events import SUPPORTED_EVENTS

logger = logging.getLogger("sparta_ai.hooks.registry")

_HOOKS_FILENAME = "sparta.hooks.json"
_cached_hooks: dict | None = None
_cached_workspace: str | None = None


def load_hooks(workspace_root: str) -> dict | None:
    """Load and cache the hooks config from the workspace root.

    Returns ``None`` when no file exists or the format is invalid.
    """
    global _cached_hooks, _cached_workspace

    if _cached_workspace == workspace_root and _cached_hooks is not None:
        return _cached_hooks

    hooks_path = Path(workspace_root) / _HOOKS_FILENAME
    if not hooks_path.is_file():
        _cached_hooks = None
        _cached_workspace = workspace_root
        return None

    try:
        raw = hooks_path.read_text(encoding="utf-8")
        data = json.loads(raw)
        if not isinstance(data, dict):
            logger.warning("hooks: %s is not a JSON object — ignoring", hooks_path)
            _cached_hooks = None
            _cached_workspace = workspace_root
            return None

        # Validate event names
        for key in data:
            if key not in SUPPORTED_EVENTS:
                logger.warning("hooks: unknown event '%s' in %s — will be ignored", key, hooks_path)

        _cached_hooks = data
        _cached_workspace = workspace_root
        total = sum(len(v) for v in data.values() if isinstance(v, list))
        logger.info("hooks: loaded %d hook(s) from %s", total, hooks_path)
        return data

    except Exception as exc:
        logger.error("hooks: failed to load %s: %s", hooks_path, exc)
        _cached_hooks = None
        _cached_workspace = workspace_root
        return None


def invalidate_cache() -> None:
    """Force a reload on the next ``load_hooks()`` call."""
    global _cached_hooks, _cached_workspace
    _cached_hooks = None
    _cached_workspace = None
