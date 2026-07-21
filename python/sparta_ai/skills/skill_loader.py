"""Skill loader with two-level progressive disclosure.

Level 1 — skills_index(): lightweight manifest shown in system prompt.
Level 2 — skill_view(): full SKILL.md body loaded on demand as a tool.

Sources (searched in order, dedup by id — first match wins):
  1. $SPARTA_USER_SKILLS_DIR  — user-installed (runtime, persistent, override)
  2. ~/.sparta/skills/.system  — auto-installed from bundled bundle (fingerprint-synced)
  3. <project-root>/skills/    — builtins shipped with repo + npx skills installs
"""
import logging
import os
import re
import sys
from functools import lru_cache
from pathlib import Path
from typing import Any

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

logger = logging.getLogger("sparta_ai.skills")

# Platform detection for skill gating
_CURRENT_PLATFORM = (
    "windows" if sys.platform.startswith("win")
    else "macos" if sys.platform == "darwin"
    else "linux"
)

_SUPPORTED_PLATFORMS = {"windows", "macos", "linux"}

# ── Path resolution ────────────────────────────────────────────
# <project-root>/skills/  (same level as package.json)
_LIB_DIR = Path(__file__).resolve().parent.parent.parent.parent / "skills"


def _user_skills_dir() -> Path | None:
    env = os.environ.get("SPARTA_USER_SKILLS_DIR")
    if env:
        p = Path(env)
        if p.is_dir():
            return p
    return None


def _system_skills_dir() -> Path:
    """Return ~/.sparta/skills/.system (auto-synced system skills)."""
    return Path.home() / ".sparta" / "skills" / ".system"


# ── Frontmatter parser (YAML preferred, regex fallback) ────────
_FM_RE = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)


def _parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    """Return (metadata_dict, body) from a SKILL.md string."""
    m = _FM_RE.match(text)
    if not m:
        return {}, text.strip()
    raw = m.group(1)
    body = text[m.end():].strip()
    meta: dict[str, Any] = {}

    if HAS_YAML:
        try:
            meta = yaml.safe_load(raw) or {}
            return meta, body
        except yaml.YAMLError:
            logger.debug("YAML parse failed, falling back to regex parser")

    # Fallback regex parser (no dependencies)
    for line in raw.splitlines():
        line = line.strip()
        if ":" in line:
            key, _, val = line.partition(":")
            key = key.strip()
            val = val.strip().strip('"').strip("'")
            if val.lower() in ("true", "false"):
                val = val.lower() == "true"
            meta[key] = val
    # Parse tags from bracketed list: [tag1, tag2]
    tags_str = meta.get("tags", "")
    if isinstance(tags_str, str) and tags_str.startswith("["):
        meta["tags"] = [t.strip().strip("'\"") for t in tags_str.strip("[]").split(",") if t.strip()]
    elif isinstance(tags_str, str) and tags_str:
        meta["tags"] = [tags_str]
    return meta, body


# ── Scan /skills/<category>/<name>/SKILL.md ────────────────────
def _scan_skills_dir(skills_dir: Path) -> list[dict[str, Any]]:
    """Walk category/*/SKILL.md and build index on the fly."""
    skills: list[dict[str, Any]] = []
    if not skills_dir.exists():
        return skills
    for cat_dir in sorted(skills_dir.iterdir()):
        if not cat_dir.is_dir() or cat_dir.name.startswith("."):
            continue
        category = cat_dir.name
        for skill_dir in sorted(cat_dir.iterdir()):
            skill_md = skill_dir / "SKILL.md"
            if not skill_md.exists():
                continue
            meta, body = _parse_frontmatter(skill_md.read_text(encoding="utf-8"))
            sid = meta.get("id") or skill_dir.name

            # Platform gating: skip skills not compatible with current OS
            platforms = meta.get("platforms")
            if platforms:
                if isinstance(platforms, str):
                    platforms = [p.strip().lower() for p in platforms.split(",")]
                if isinstance(platforms, list):
                    if _CURRENT_PLATFORM not in [p.lower() for p in platforms]:
                        continue

            skills.append({
                "id": sid,
                "name": meta.get("name", sid),
                "description": meta.get("description", ""),
                "category": meta.get("category", category.title()),
                "tags": meta.get("tags", []),
                "icon": meta.get("icon", "\U0001f4e6"),
                "version": meta.get("version", "1.0.0"),
                "author": meta.get("author", "Sparta Team"),
                "source": meta.get("source", "builtin"),
                "featured": meta.get("featured", False),
                "platforms": meta.get("platforms", ""),
            })
    return skills


def _build_full_index() -> list[dict[str, Any]]:
    """Merge manifests from all sources, dedup by id (user wins).

    Precedence:
      1. User-installed (override)
      2. System-installed (auto-synced, fingerprint-verified)
      3. Builtin + npx-installed (project root)
    """
    seen: set[str] = set()
    result: list[dict[str, Any]] = []

    # User-installed skills (override builtins with same id)
    usr = _user_skills_dir()
    if usr:
        for item in _scan_skills_dir(usr):
            sid = item.get("id")
            if sid and sid not in seen:
                item["_source"] = "user"
                seen.add(sid)
                result.append(item)

    # System-installed skills (auto-synced from bundled bundle)
    sys_dir = _system_skills_dir()
    for item in _scan_skills_dir(sys_dir):
        sid = item.get("id")
        if sid and sid not in seen:
            item["_source"] = "system"
            seen.add(sid)
            result.append(item)

    # Builtin + npx-installed skills (project root /skills/)
    for item in _scan_skills_dir(_LIB_DIR):
        sid = item.get("id")
        if sid and sid not in seen:
            item["_source"] = "builtin"
            seen.add(sid)
            result.append(item)

    return result


# ── Public API ──────────────────────────────────────────────────

@lru_cache(maxsize=1)
def skills_index() -> list[dict[str, Any]]:
    """Return lightweight manifest of all available skills.
    Intended to be included verbatim in the system prompt so the LLM
    knows what skills exist without loading their full content.
    """
    return _build_full_index()


def skill_view(skill_id: str) -> dict[str, Any]:
    """Return full SKILL.md content for a given skill.
    Level 2 of progressive disclosure — called on demand via agent tool.
    """
    candidates: list[Path] = []

    # User dir first (overrides builtins)
    usr = _user_skills_dir()
    if usr:
        for cat_dir in usr.iterdir():
            if cat_dir.is_dir() and not cat_dir.name.startswith("."):
                candidates.append(cat_dir / skill_id / "SKILL.md")

    # Then system-installed skills
    sys_dir = _system_skills_dir()
    if sys_dir.exists():
        for cat_dir in sys_dir.iterdir():
            if cat_dir.is_dir() and not cat_dir.name.startswith("."):
                candidates.append(cat_dir / skill_id / "SKILL.md")

    # Then project root /skills/
    for cat_dir in _LIB_DIR.iterdir():
        if cat_dir.is_dir() and not cat_dir.name.startswith("."):
            candidates.append(cat_dir / skill_id / "SKILL.md")

    for path in candidates:
        if path.exists():
            try:
                text = path.read_text(encoding="utf-8")
                meta, body = _parse_frontmatter(text)
                meta.setdefault("id", skill_id)
                meta.setdefault("name", skill_id)
                meta.setdefault("source", "builtin")
                return {"metadata": meta, "body": body, "source_path": str(path)}
            except OSError as e:
                logger.warning("Failed to load skill view '%s': %s", path, e)

    logger.warning("Skill view not found: %s", skill_id)
    return {"metadata": {"id": skill_id, "name": skill_id}, "body": "", "source_path": ""}


def build_skills_context(active_skill_ids: list[str]) -> str:
    """Build XML context block for the system prompt.
    Uses only the lightweight meta from skills_index() — NOT full body.
    Full body is loaded on demand via skill_view() agent tool.
    """
    if not active_skill_ids:
        return ""
    index = {s["id"]: s for s in skills_index()}
    blocks = []
    for sid in active_skill_ids:
        skill = index.get(sid)
        if not skill:
            logger.debug("Active skill not found in index: %s", sid)
            continue
        blocks.append(
            f'<skill id="{sid}" name="{skill["name"]}" category="{skill.get("category","")}">\n'
            f'  {skill["description"]}\n'
            f'</skill>'
        )
    if not blocks:
        return ""
    return "<active_skills>\n" + "\n".join(blocks) + "\n</active_skills>"


def list_available_skills() -> list[dict[str, Any]]:
    """Return list of available skills (backward-compat wrapper)."""
    return [
        {"id": s["id"], "name": s["name"], "description": s["description"]}
        for s in skills_index()
    ]


def clear_skill_cache() -> None:
    skills_index.cache_clear()
    try:
        from sparta_ai.skills.skill_router import invalidate_cache
        invalidate_cache()
    except ImportError:
        pass
    logger.info("Skill cache cleared")
