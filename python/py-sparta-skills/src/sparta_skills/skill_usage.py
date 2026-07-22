"""Skill usage telemetry — tracks view/use/patch counts per skill.

Persisted to ~/.sparta/skills/.skill_usage.json with atomic writes.
"""
import json
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger("sparta_ai.skills.usage")

_USAGE_FILE = Path.home() / ".sparta" / "skills" / ".skill_usage.json"


def _load_usage() -> dict[str, Any]:
    """Load usage data from disk."""
    try:
        if _USAGE_FILE.exists():
            return json.loads(_USAGE_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError) as e:
        logger.warning("Failed to load skill usage: %s", e)
    return {}


def _save_usage(data: dict[str, Any]) -> None:
    """Save usage data atomically."""
    try:
        _USAGE_FILE.parent.mkdir(parents=True, exist_ok=True)
        tmp = _USAGE_FILE.with_suffix(".tmp")
        tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        tmp.replace(_USAGE_FILE)
    except OSError as e:
        logger.warning("Failed to save skill usage: %s", e)


def get_usage(skill_id: str) -> dict[str, Any]:
    """Get usage stats for a skill."""
    data = _load_usage()
    return data.get(skill_id, {
        "view_count": 0,
        "use_count": 0,
        "patch_count": 0,
        "created_at": None,
        "last_used_at": None,
    })


def bump_view(skill_id: str) -> None:
    """Increment view count for a skill."""
    data = _load_usage()
    entry = data.setdefault(skill_id, {})
    entry["view_count"] = entry.get("view_count", 0) + 1
    entry["last_used_at"] = __import__("datetime").datetime.now().isoformat()
    _save_usage(data)


def bump_use(skill_id: str) -> None:
    """Increment use count for a skill."""
    data = _load_usage()
    entry = data.setdefault(skill_id, {})
    entry["use_count"] = entry.get("use_count", 0) + 1
    entry["last_used_at"] = __import__("datetime").datetime.now().isoformat()
    if "created_at" not in entry:
        entry["created_at"] = entry["last_used_at"]
    _save_usage(data)


def bump_patch(skill_id: str) -> None:
    """Increment patch count for a skill."""
    data = _load_usage()
    entry = data.setdefault(skill_id, {})
    entry["patch_count"] = entry.get("patch_count", 0) + 1
    entry["last_used_at"] = __import__("datetime").datetime.now().isoformat()
    _save_usage(data)


def get_all_usage() -> dict[str, dict[str, Any]]:
    """Get usage stats for all skills."""
    return _load_usage()


def get_most_used(limit: int = 5) -> list[tuple[str, int]]:
    """Get the most-used skills by use_count."""
    data = _load_usage()
    sorted_skills = sorted(
        data.items(),
        key=lambda x: x[1].get("use_count", 0),
        reverse=True,
    )
    return [(sid, stats.get("use_count", 0)) for sid, stats in sorted_skills[:limit]]


def get_stale_skills(days: int = 30) -> list[str]:
    """Get skills not used in N days."""
    from datetime import datetime, timedelta
    data = _load_usage()
    cutoff = datetime.now() - timedelta(days=days)
    stale = []
    for sid, stats in data.items():
        last = stats.get("last_used_at")
        if last:
            try:
                if datetime.fromisoformat(last) < cutoff:
                    stale.append(sid)
            except (ValueError, TypeError):
                pass
    return stale
