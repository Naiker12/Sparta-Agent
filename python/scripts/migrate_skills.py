"""Migrate 12 builtin .skill.json → skills_library/ SKILL.md format."""
import json
import shutil
from pathlib import Path

SKILLS_SRC = Path("D:/sparta-agent/public/skills")
SKILLS_DST = Path("D:/sparta-agent/python/sparta_ai/skills_library")

CATEGORY_MAP = {
    "Coding": "coding",
    "Analysis": "analysis",
    "Writing": "writing",
    "Research": "research",
    "Automation": "automation",
}

def make_frontmatter(data):
    tags = ", ".join(data.get("tags", []))
    return f"""---
name: {data['name']}
id: {data['id']}
description: "{data['description']}"
version: {data.get('version', '1.0.0')}
author: {data.get('author', 'Sparta Team')}
icon: {data.get('icon', '📦')}
category: {data.get('category', 'Coding')}
tags: [{tags}]
source: builtin
featured: {str(data.get('featured', False)).lower()}
---
"""

def migrate():
    if SKILLS_DST.exists():
        shutil.rmtree(SKILLS_DST)

    # Create category folders + .gitkeep
    for folder in CATEGORY_MAP.values():
        (SKILLS_DST / folder).mkdir(parents=True, exist_ok=True)
        (SKILLS_DST / folder / ".gitkeep").write_text("", encoding="utf-8")

    skills_index = []
    for json_file in sorted(SKILLS_SRC.glob("*.skill.json")):
        data = json.loads(json_file.read_text(encoding="utf-8"))
        cat = CATEGORY_MAP.get(data.get("category", "Coding"), "coding")
        skill_id = data["id"]
        dest_dir = SKILLS_DST / cat / skill_id
        dest_dir.mkdir(parents=True, exist_ok=True)

        prompt = data.get("prompt", "")
        front = make_frontmatter(data)

        # Write SKILL.md
        (dest_dir / "SKILL.md").write_text(front + "\n" + prompt + "\n", encoding="utf-8")

        skills_index.append({
            "id": skill_id,
            "name": data["name"],
            "description": data["description"],
            "category": data.get("category", "Coding"),
            "tags": data.get("tags", []),
            "icon": data.get("icon", "📦"),
            "version": data.get("version", "1.0.0"),
            "author": data.get("author", "Sparta Team"),
            "source": "builtin",
            "featured": data.get("featured", False),
        })

        print(f"  OK {skill_id} -> {cat}/{skill_id}/SKILL.md")

    # Write .manifest.json
    manifest = {"version": "1.0.0", "skills": skills_index}
    (SKILLS_DST / ".manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"\nOK Migrated {len(skills_index)} skills -> {SKILLS_DST}")

if __name__ == "__main__":
    migrate()
