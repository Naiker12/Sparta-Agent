import json
import logging
from functools import lru_cache
from pathlib import Path
from typing import Any

logger = logging.getLogger("sparta_ai.skills")

SKILLS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "public" / "skills"


@lru_cache(maxsize=50)
def load_skill(skill_id: str) -> dict[str, Any]:
    skill_paths = [
        SKILLS_DIR / f"{skill_id}.skill.json",
        SKILLS_DIR / f"{skill_id}.json",
    ]

    for path in skill_paths:
        if path.exists():
            try:
                data = json.loads(path.read_text(encoding="utf-8"))
                logger.info("Skill loaded: %s (%s)", skill_id, path)
                return {
                    "name": data.get("name", skill_id),
                    "description": data.get("description", ""),
                    "system_addition": data.get("systemPrompt", data.get("system_prompt", "")),
                    "tools": data.get("tools", []),
                    "examples": data.get("examples", []),
                }
            except (json.JSONDecodeError, OSError) as e:
                logger.warning("Failed to load skill '%s': %s", skill_id, e)

    logger.warning("Skill not found: %s (searched: %s)", skill_id, SKILLS_DIR)
    return {
        "name": skill_id,
        "description": "",
        "system_addition": "",
        "tools": [],
        "examples": [],
    }


def build_skills_context(active_skill_ids: list[str]) -> str:
    if not active_skill_ids:
        return ""

    blocks = []
    for skill_id in active_skill_ids:
        skill = load_skill(skill_id)
        system_text = skill.get("system_addition", "")
        if system_text:
            blocks.append(f'<skill name="{skill["name"]}">\n{system_text}\n</skill>')

    return "\n\n".join(blocks)


def list_available_skills() -> list[dict[str, Any]]:
    if not SKILLS_DIR.exists():
        logger.warning("Skills directory not found: %s", SKILLS_DIR)
        return []

    skills = []
    for path in sorted(SKILLS_DIR.glob("*.skill.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
            skills.append({
                "id": path.stem.replace(".skill", ""),
                "name": data.get("name", path.stem),
                "description": data.get("description", ""),
            })
        except (json.JSONDecodeError, OSError) as e:
            logger.warning("Invalid skill file %s: %s", path.name, e)

    return skills


def clear_skill_cache() -> None:
    load_skill.cache_clear()
    logger.info("Skill cache cleared")
