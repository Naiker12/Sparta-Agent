"""Skill loader with two-level progressive disclosure.

Level 1 — skills_index(): lightweight manifest shown in system prompt.
Level 2 — skill_view(): full SKILL.md body loaded on demand as a tool.

Sources (searched in order):
  1. $SPARTA_USER_SKILLS_DIR  — user-installed (runtime, persistent)
  2. skills_library/          — builtins shipped with sidecar
  3. public/skills/           — legacy .skill.json (backward compat)
"""
import json
import logging
import os
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

logger = logging.getLogger("sparta_ai.skills")

# ── Path resolution ────────────────────────────────────────────
_LIB_DIR = Path(__file__).resolve().parent.parent / "skills_library"
_LEGACY_DIR = Path(__file__).resolve().parent.parent.parent.parent / "public" / "skills"

def _user_skills_dir() -> Path | None:
    env = os.environ.get("SPARTA_USER_SKILLS_DIR")
    if env:
        p = Path(env)
        if p.is_dir():
            return p
    return None


# ── Frontmatter parser (no deps) ───────────────────────────────
_FM_RE = re.compile(r"^---\s*\n(.*?)\n---", re.DOTALL)

def _parse_frontmatter(text: str) -> tuple[dict[str, Any], str]:
    """Return (metadata_dict, body) from a SKILL.md string."""
    m = _FM_RE.match(text)
    if not m:
        return {}, text.strip()
    raw = m.group(1)
    body = text[m.end():].strip()
    meta: dict[str, Any] = {}
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


# ── Manifest (lightweight index) ───────────────────────────────
def _load_manifest(skills_dir: Path) -> list[dict[str, Any]]:
    manifest_path = skills_dir / ".manifest.json"
    if manifest_path.exists():
        try:
            data = json.loads(manifest_path.read_text(encoding="utf-8"))
            return data.get("skills", [])
        except (json.JSONDecodeError, OSError) as e:
            logger.warning("Invalid manifest in %s: %s", skills_dir, e)
    return []


def _scan_skills_dir(skills_dir: Path) -> list[dict[str, Any]]:
    """Fallback: walk category/*/SKILL.md and build index on the fly."""
    skills: list[dict[str, Any]] = []
    if not skills_dir.exists():
        return skills
    for cat_dir in skills_dir.iterdir():
        if not cat_dir.is_dir() or cat_dir.name.startswith("."):
            continue
        for skill_dir in sorted(cat_dir.iterdir()):
            skill_md = skill_dir / "SKILL.md"
            if not skill_md.exists():
                continue
            meta, body = _parse_frontmatter(skill_md.read_text(encoding="utf-8"))
            if meta.get("id"):
                skills.append({
                    "id": meta["id"],
                    "name": meta.get("name", meta["id"]),
                    "description": meta.get("description", ""),
                    "category": meta.get("category", cat_dir.name.title()),
                    "tags": meta.get("tags", []),
                    "icon": meta.get("icon", "📦"),
                    "version": meta.get("version", "1.0.0"),
                    "author": meta.get("author", "Sparta Team"),
                    "source": meta.get("source", "builtin"),
                    "featured": meta.get("featured", False),
                })
    return skills


def _build_full_index() -> list[dict[str, Any]]:
    """Merge manifests from all sources, dedup by id (user wins)."""
    seen: set[str] = set()
    result: list[dict[str, Any]] = []

    sources = []
    usr = _user_skills_dir()
    if usr:
        sources.append(("user", usr))
    sources.append(("builtin", _LIB_DIR))
    # Legacy: scan public/skills/*.skill.json
    if _LEGACY_DIR.exists():
        sources.append(("legacy", _LEGACY_DIR))

    for source_label, src_dir in sources:
        if source_label == "legacy":
            items = _scan_legacy_skills()
        else:
            items = _load_manifest(src_dir) or _scan_skills_dir(src_dir)
        for item in items:
            sid = item.get("id")
            if sid and sid not in seen:
                item["_source"] = source_label
                seen.add(sid)
                result.append(item)
    return result


def _scan_legacy_skills() -> list[dict[str, Any]]:
    """Scan public/skills/*.skill.json for backward compatibility."""
    skills: list[dict[str, Any]] = []
    if not _LEGACY_DIR.exists():
        return skills
    for path in sorted(_LEGACY_DIR.glob("*.skill.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            skills.append({
                "id": data.get("id", path.stem.replace(".skill", "")),
                "name": data.get("name", path.stem),
                "description": data.get("description", ""),
                "category": data.get("category", "Coding"),
                "tags": data.get("tags", []),
                "icon": data.get("icon", "📦"),
                "version": data.get("version", "1.0.0"),
                "author": data.get("author", "Sparta Team"),
                "source": "legacy",
                "featured": data.get("featured", False),
            })
        except (json.JSONDecodeError, OSError) as e:
            logger.warning("Invalid legacy skill %s: %s", path.name, e)
    return skills


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
    # Determine which SKILL.md to load
    candidates: list[Path] = []

    usr = _user_skills_dir()
    if usr:
        candidates.append(usr / skill_id / "SKILL.md")
        # Also search in category subdirs
        for cat_dir in usr.iterdir():
            if cat_dir.is_dir() and not cat_dir.name.startswith("."):
                candidates.append(cat_dir / skill_id / "SKILL.md")

    candidates.append(_LIB_DIR / skill_id / "SKILL.md")
    # Search in category subdirs in lib
    if _LIB_DIR.exists():
        for cat_dir in _LIB_DIR.iterdir():
            if cat_dir.is_dir() and not cat_dir.name.startswith("."):
                candidates.append(cat_dir / skill_id / "SKILL.md")

    # Legacy fallback
    candidates.append(_LEGACY_DIR / f"{skill_id}.skill.json")
    candidates.append(_LEGACY_DIR / f"{skill_id}.json")

    for path in candidates:
        if path.exists():
            try:
                text = path.read_text(encoding="utf-8")
                if path.suffix == ".json":
                    data = json.loads(text)
                    body = data.get("prompt", data.get("instruction", ""))
                    meta = {
                        "id": data.get("id", skill_id),
                        "name": data.get("name", skill_id),
                        "description": data.get("description", ""),
                        "category": data.get("category", "Coding"),
                        "tags": data.get("tags", []),
                        "icon": data.get("icon", "📦"),
                        "version": data.get("version", "1.0.0"),
                        "author": data.get("author", "Sparta Team"),
                        "source": "legacy",
                    }
                    return {"metadata": meta, "body": body, "source_path": str(path)}
                meta, body = _parse_frontmatter(text)
                meta.setdefault("id", skill_id)
                meta.setdefault("name", skill_id)
                meta.setdefault("source", "builtin")
                return {"metadata": meta, "body": body, "source_path": str(path)}
            except (json.JSONDecodeError, OSError) as e:
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
    logger.info("Skill cache cleared")
