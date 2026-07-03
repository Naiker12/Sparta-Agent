"""Skill curator — automatic lifecycle management for agent-created skills.

Lifecycle: active → stale (30d no use) → archived (90d no use).

Only agent-created skills (source=user, provenance=agent) are processed.
Builtin, hub-installed, and pinned skills are never touched.
Never deletes — only archives (recoverable).
"""
import json
import logging
import os
import shutil
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

logger = logging.getLogger("sparta_ai.skills.curator")

CURATOR_DIR = Path.home() / ".sparta" / "curator"
STATE_FILE = CURATOR_DIR / "state.json"

# Default thresholds (configurable)
STALE_AFTER_DAYS = 30
ARCHIVE_AFTER_DAYS = 90
MIN_IDLE_HOURS = 2

PROTECTED_BUILTIN_SKILLS = {"plan"}


def _load_state() -> dict[str, Any]:
    try:
        if STATE_FILE.exists():
            return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        pass
    return {"last_run": None, "stats": {"archived": 0, "stale": 0, "skipped": 0}}


def _save_state(state: dict[str, Any]) -> None:
    CURATOR_DIR.mkdir(parents=True, exist_ok=True)
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2, ensure_ascii=False), encoding="utf-8")
    tmp.replace(STATE_FILE)


def _get_skills_dir() -> Path:
    env = os.environ.get("SPARTA_USER_SKILLS_DIR")
    if env:
        return Path(env)
    return Path.home() / ".sparta" / "skills"


def _load_usage() -> dict[str, Any]:
    usage_file = _get_skills_dir() / ".skill_usage.json"
    try:
        if usage_file.exists():
            return json.loads(usage_file.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        pass
    return {}


def run_curator(dry_run: bool = False) -> dict[str, Any]:
    """Run the curator pass. Returns stats dict.

    Args:
        dry_run: If True, log actions without actually moving files.
    """
    skills_dir = _get_skills_dir()
    if not skills_dir.exists():
        return {"error": "Skills directory not found"}

    usage = _load_usage()
    now = datetime.now()
    stale_after = timedelta(days=STALE_AFTER_DAYS)
    archive_after = timedelta(days=ARCHIVE_AFTER_DAYS)

    archive_dir = skills_dir / ".archived"
    stats = {"archived": 0, "stale": 0, "skipped": 0, "errors": []}

    for cat_dir in sorted(skills_dir.iterdir()):
        if not cat_dir.is_dir() or cat_dir.name.startswith("."):
            continue
        for skill_dir in sorted(cat_dir.iterdir()):
            md_path = skill_dir / "SKILL.md"
            if not md_path.exists():
                continue

            sid = skill_dir.name

            # Never touch protected builtins
            if sid in PROTECTED_BUILTIN_SKILLS:
                stats["skipped"] += 1
                continue

            # Read frontmatter to check source
            try:
                text = md_path.read_text(encoding="utf-8")
                source = "builtin"
                for line in text.split("\n"):
                    if line.startswith("source:"):
                        source = line.split(":", 1)[1].strip().strip('"').strip("'")
                        break
            except OSError:
                stats["errors"].append(f"Cannot read {sid}")
                continue

            # Only process user-created skills
            if source not in ("user",):
                stats["skipped"] += 1
                continue

            # Check last used date
            skill_usage = usage.get(sid, {})
            last_used_str = skill_usage.get("last_used_at")
            if not last_used_str:
                # Never used → use file modification time
                try:
                    mtime = datetime.fromtimestamp(md_path.stat().st_mtime)
                    last_used = mtime
                except OSError:
                    stats["errors"].append(f"Cannot stat {sid}")
                    continue
            else:
                try:
                    last_used = datetime.fromisoformat(last_used_str)
                except (ValueError, TypeError):
                    stats["errors"].append(f"Invalid date for {sid}")
                    continue

            age = now - last_used

            if age > archive_after:
                # Archive
                target = archive_dir / cat_dir.name / skill_dir.name
                if dry_run:
                    logger.info("[DRY RUN] Would archive: %s", sid)
                else:
                    target.parent.mkdir(parents=True, exist_ok=True)
                    shutil.move(str(skill_dir), str(target))
                    logger.info("Archived skill: %s (age: %d days)", sid, age.days)
                stats["archived"] += 1

            elif age > stale_after:
                # Mark as stale (write marker file, don't move)
                marker = skill_dir / ".stale"
                if not dry_run:
                    marker.write_text(
                        f"Marked stale on {now.isoformat()}\n"
                        f"Last used: {last_used_str or 'unknown'}\n"
                        f"Age: {age.days} days\n",
                        encoding="utf-8",
                    )
                    logger.info("Marked stale: %s (age: %d days)", sid, age.days)
                stats["stale"] += 1
            else:
                stats["skipped"] += 1

    state = _load_state()
    state["last_run"] = now.isoformat()
    state["stats"] = stats
    _save_state(state)

    return stats


def get_status() -> dict[str, Any]:
    """Get curator status."""
    state = _load_state()
    archive_dir = _get_skills_dir() / ".archived"
    archived_count = sum(
        1 for cat in archive_dir.iterdir() if cat.is_dir()
        for _ in cat.iterdir()
    ) if archive_dir.exists() else 0

    stale_count = 0
    skills_dir = _get_skills_dir()
    if skills_dir.exists():
        for cat_dir in skills_dir.iterdir():
            if not cat_dir.is_dir() or cat_dir.name.startswith("."):
                continue
            for skill_dir in cat_dir.iterdir():
                if (skill_dir / ".stale").exists():
                    stale_count += 1

    return {
        "last_run": state.get("last_run"),
        "archived": state.get("stats", {}).get("archived", 0) + archived_count,
        "stale": stale_count,
        "archive_dir": str(archive_dir) if archive_dir.exists() else None,
    }


def list_archived() -> list[dict[str, str]]:
    """List all archived skills."""
    archive_dir = _get_skills_dir() / ".archived"
    if not archive_dir.exists():
        return []
    result = []
    for cat_dir in sorted(archive_dir.iterdir()):
        if not cat_dir.is_dir():
            continue
        for skill_dir in sorted(cat_dir.iterdir()):
            md_path = skill_dir / "SKILL.md"
            if md_path.exists():
                result.append({
                    "id": skill_dir.name,
                    "category": cat_dir.name,
                    "path": str(skill_dir),
                })
    return result


def restore_skill(skill_id: str) -> bool:
    """Restore an archived skill back to active."""
    archive_dir = _get_skills_dir() / ".archived"
    if not archive_dir.exists():
        return False
    for cat_dir in archive_dir.iterdir():
        if not cat_dir.is_dir():
            continue
        skill_dir = cat_dir / skill_id
        if skill_dir.exists() and (skill_dir / "SKILL.md").exists():
            target = _get_skills_dir() / cat_dir.name / skill_id
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(skill_dir), str(target))
            # Remove stale marker if present
            marker = target / ".stale"
            if marker.exists():
                marker.unlink()
            logger.info("Restored skill: %s", skill_id)
            return True
    return False
