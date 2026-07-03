"""Skill bundles — group multiple skills under a single alias.

YAML files in ~/.sparta/skill-bundles/*.yaml:

```yaml
name: backend-dev
description: Backend feature work
skills:
  - code-review
  - test-driven-development
  - systematic-debugging
instruction: >
  Follow these skills in order: first review existing code,
  then write tests, then implement changes.
```

When a user invokes a bundle name (e.g. /backend-dev), all referenced
skills are loaded and their instructions merged.
"""
import logging
import os
from pathlib import Path
from typing import Any

try:
    import yaml
    HAS_YAML = True
except ImportError:
    HAS_YAML = False

logger = logging.getLogger("sparta_ai.skills.bundles")

_BUNDLES_DIR = Path.home() / ".sparta" / "skill-bundles"


def get_bundles_dir() -> Path:
    """Get or create the bundles directory."""
    _BUNDLES_DIR.mkdir(parents=True, exist_ok=True)
    return _BUNDLES_DIR


def list_bundles() -> list[dict[str, Any]]:
    """List all available skill bundles."""
    bundles = []
    bundles_dir = get_bundles_dir()
    if not bundles_dir.exists():
        return bundles
    for f in sorted(bundles_dir.iterdir()):
        if f.suffix.lower() in (".yaml", ".yml"):
            try:
                data = yaml.safe_load(f.read_text(encoding="utf-8")) if HAS_YAML else {}
                if data and data.get("name") and data.get("skills"):
                    bundles.append({
                        "name": data["name"],
                        "description": data.get("description", ""),
                        "skills": data["skills"],
                        "path": str(f),
                    })
            except Exception as e:
                logger.warning("Failed to load bundle %s: %s", f.name, e)
    return bundles


def get_bundle(name: str) -> dict[str, Any] | None:
    """Get a bundle by name."""
    for bundle in list_bundles():
        if bundle["name"].lower() == name.lower():
            return bundle
    return None


def create_bundle(name: str, description: str, skill_ids: list[str], instruction: str = "") -> Path:
    """Create a new skill bundle YAML file."""
    bundles_dir = get_bundles_dir()
    safe_name = "".join(c for c in name if c.isalnum() or c in "._- ").strip().lower().replace(" ", "-")
    path = bundles_dir / f"{safe_name}.yaml"
    data = {
        "name": name,
        "description": description,
        "skills": skill_ids,
    }
    if instruction:
        data["instruction"] = instruction
    content = yaml.safe_dump(data, allow_unicode=True, default_flow_style=False) if HAS_YAML else str(data)
    path.write_text(content, encoding="utf-8")
    logger.info("Created bundle: %s at %s", name, path)
    return path


def delete_bundle(name: str) -> bool:
    """Delete a skill bundle."""
    bundle = get_bundle(name)
    if not bundle:
        return False
    try:
        Path(bundle["path"]).unlink()
        logger.info("Deleted bundle: %s", name)
        return True
    except OSError as e:
        logger.warning("Failed to delete bundle %s: %s", name, e)
        return False


def build_bundle_context(bundle_name: str) -> str:
    """Build a context string from all skills in a bundle."""
    bundle = get_bundle(bundle_name)
    if not bundle:
        return f"Bundle '{bundle_name}' not found."

    from sparta_ai.skills.skill_loader import skill_view

    parts = [f"# Bundle: {bundle['name']}\n"]
    if bundle.get("description"):
        parts.append(f"_{bundle['description']}_\n")
    if bundle.get("instruction"):
        parts.append(f"\n> {bundle['instruction']}\n")

    for sid in bundle["skills"]:
        result = skill_view(sid)
        if result.get("body"):
            meta = result.get("metadata", {})
            parts.append(f"\n---\n## {meta.get('name', sid)}\n")
            parts.append(result["body"])
        else:
            parts.append(f"\n---\n## {sid}\n(Skill not found)\n")

    return "\n".join(parts)
