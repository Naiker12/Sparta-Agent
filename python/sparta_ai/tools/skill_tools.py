"""LangChain tools for skill progressive disclosure and management.

- skills_list_tool: list available skills with descriptions.
- skill_view_tool: load the full SKILL.md body (level 2 disclosure).
- skill_manage_tool: create, edit, patch, rename, and delete skills.
"""
import json
import logging
import os
import shutil
from pathlib import Path
from typing import Any

from langchain_core.tools import tool

from sparta_ai.skills.skill_loader import (
    skill_view as _skill_view_impl,
    skills_index as _skills_index,
    clear_skill_cache,
    _LIB_DIR,
    _user_skills_dir,
)

logger = logging.getLogger("sparta_ai.tools.skills")


@tool
def skills_list_tool(category: str = "") -> str:
    """List all available skills. Optionally filter by category.

    Returns skill names, descriptions, and categories so you can decide
    which skill to load via skill_view_tool.

    Args:
        category: Optional category to filter by (e.g. "Coding", "Research", "Writing").
                 Empty string returns all skills.
    """
    all_skills = _skills_index()
    if category:
        filtered = [s for s in all_skills if s.get("category", "").lower() == category.lower()]
    else:
        filtered = all_skills

    if not filtered:
        return "No skills found." if not category else f"No skills found in category '{category}'."

    # Group by category
    by_cat: dict[str, list[dict]] = {}
    for s in filtered:
        cat = s.get("category", "Other")
        by_cat.setdefault(cat, []).append(s)

    lines = [f"Available skills ({len(filtered)} total):\n"]
    for cat in sorted(by_cat):
        skills = by_cat[cat]
        lines.append(f"\n{'─' * 40}")
        lines.append(f"  {cat} ({len(skills)}):")
        lines.append(f"{'─' * 40}")
        for s in skills:
            tags = ""
            if s.get("tags"):
                tag_list = s["tags"]
                if isinstance(tag_list, list):
                    tags = f" [{', '.join(tag_list[:3])}]"
            featured = " ★" if s.get("featured") else ""
            lines.append(f"  \u2022 {s['id']}{featured}: {s.get('name', s['id'])}")
            desc = s.get("description", "")
            if desc:
                lines.append(f"    {desc[:120]}{'...' if len(desc) > 120 else ''}{tags}")

    return "\n".join(lines)


@tool
def skill_view_tool(skill_id: str) -> str:
    """Load the complete content of a skill by its ID.

    Use this when you need to read the full instructions, examples,
    or configuration of a skill you found via skills_list_tool.

    The returned content should be treated as an activated instruction set.
    Follow its guidance for the current task.

    Args:
        skill_id: The id of the skill to load (e.g. "bug-finder", "summarizer").
    """
    result = _skill_view_impl(skill_id)
    if not result.get("body"):
        return f"Skill '{skill_id}' not found or has no body content."
    meta = result.get("metadata", {})
    header = f"# {meta.get('name', skill_id)}\n\n"
    header += f"_{meta.get('description', '')}_\n\n"
    header += f"- **Version:** {meta.get('version', '?')}  \n"
    header += f"- **Author:** {meta.get('author', '?')}  \n"
    header += f"- **Category:** {meta.get('category', '?')}  \n"
    header += f"- **Tags:** {', '.join(meta.get('tags', []) or [])}\n\n"
    header += "---\n\n"
    return header + result["body"]


def _get_skill_dir(skill_id: str) -> Path | None:
    """Find the directory where a skill's SKILL.md lives."""
    usr = _user_skills_dir()
    if usr:
        for cat_dir in usr.iterdir():
            if cat_dir.is_dir() and not cat_dir.name.startswith("."):
                p = cat_dir / skill_id
                if (p / "SKILL.md").exists():
                    return p
    for cat_dir in _LIB_DIR.iterdir():
        if cat_dir.is_dir() and not cat_dir.name.startswith("."):
            p = cat_dir / skill_id
            if (p / "SKILL.md").exists():
                return p
    return None


def _get_writable_skill_dir(skill_id: str) -> Path:
    """Return the user skills dir, creating category dirs as needed."""
    usr = _user_skills_dir()
    if not usr:
        usr = Path.home() / ".sparta" / "skills"
        usr.mkdir(parents=True, exist_ok=True)
        os.environ["SPARTA_USER_SKILLS_DIR"] = str(usr)
    # Determine category: reuse existing or default to "user"
    cat_dir = usr / "user"
    existing = _get_skill_dir(skill_id)
    if existing:
        cat_dir = existing.parent
    cat_dir.mkdir(parents=True, exist_ok=True)
    return cat_dir / skill_id


def _build_skill_md(name: str, description: str, body: str, category: str = "User", tags: list[str] | None = None) -> str:
    """Build a SKILL.md string with frontmatter."""
    tid = name.lower().replace(" ", "-").replace("_", "-")
    tag_str = ""
    if tags:
        tag_str = "\ntags: [" + ", ".join(tags) + "]"
    return (
        f"---\n"
        f"id: {tid}\n"
        f"name: {name}\n"
        f"description: \"{description}\"\n"
        f"version: 1.0.0\n"
        f"author: Sparta Agent (user-created)\n"
        f"category: {category}\n"
        f"source: user{tag_str}\n"
        f"---\n\n"
        f"{body}"
    )


def _sanitize_skill_name(name: str) -> str:
    """Ensure skill name is safe for filesystem."""
    safe = "".join(c for c in name if c.isalnum() or c in "_- ")
    safe = safe.strip().strip(".") or "unnamed-skill"
    # Prevent path traversal via leading dots
    while safe.startswith("."):
        safe = safe[1:]
    return safe.strip() or "unnamed-skill"


@tool
def skill_manage_tool(action: str, name: str, description: str = "", body: str = "", category: str = "User", tags: str = "") -> str:
    """Create, edit, or delete skills.

    Use this to save reusable workflows as skills. The agent can autonomously
    create new skills based on patterns it discovers during conversations.

    Args:
        action: One of "create", "edit", "patch", "delete", "list".
        name: Skill name (used as ID after sanitization).
        description: Short description for "create" and "edit".
        body: Full SKILL.md body content for "create" and "edit".
        category: Category for "create" (default: "User").
        tags: Comma-separated tags for "create" (e.g. "coding,automation").
    """
    safe_name = _sanitize_skill_name(name)
    skill_id = safe_name.lower().replace(" ", "-")

    if action == "list":
        return skills_list_tool()

    if action == "create":
        if not body:
            return "Error: 'body' is required for create action."
        skill_dir = _get_writable_skill_dir(skill_id)
        skill_dir.mkdir(parents=True, exist_ok=True)
        md_path = skill_dir / "SKILL.md"
        if md_path.exists():
            return f"Skill '{skill_id}' already exists. Use action='edit' to modify it."
        tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
        content = _build_skill_md(safe_name, description, body, category, tag_list)
        md_path.write_text(content, encoding="utf-8")
        clear_skill_cache()
        logger.info("Skill created: %s at %s", skill_id, md_path)
        return f"Skill '{skill_id}' created successfully."

    if action == "edit":
        skill_dir = _get_skill_dir(skill_id)
        if not skill_dir:
            return f"Skill '{skill_id}' not found. Use action='create' first."
        md_path = skill_dir / "SKILL.md"
        if not body:
            return "Error: 'body' is required for edit action."
        tag_list = [t.strip() for t in tags.split(",") if t.strip()] if tags else []
        content = _build_skill_md(safe_name, description if description else skill_id, body, category, tag_list)
        md_path.write_text(content, encoding="utf-8")
        clear_skill_cache()
        logger.info("Skill edited: %s", skill_id)
        return f"Skill '{skill_id}' updated successfully."

    if action == "patch":
        skill_dir = _get_skill_dir(skill_id)
        if not skill_dir:
            return f"Skill '{skill_id}' not found. Use action='create' first."
        md_path = skill_dir / "SKILL.md"
        existing_text = md_path.read_text(encoding="utf-8")
        if body:
            # Replace body between frontmatter and end
            import re as _re
            pat = _re.compile(r"^(---\s*\n.*?\n---\s*\n)", re.DOTALL)
            m = pat.match(existing_text)
            if m:
                new_text = m.group(1) + body.strip() + "\n"
            else:
                new_text = existing_text + "\n" + body.strip() + "\n"
            md_path.write_text(new_text, encoding="utf-8")
        clear_skill_cache()
        logger.info("Skill patched: %s", skill_id)
        return f"Skill '{skill_id}' patched successfully."

    if action == "delete":
        skill_dir = _get_skill_dir(skill_id)
        if not skill_dir:
            return f"Skill '{skill_id}' not found."
        shutil.rmtree(skill_dir)
        clear_skill_cache()
        logger.info("Skill deleted: %s", skill_id)
        return f"Skill '{skill_id}' deleted successfully."

    return f"Unknown action '{action}'. Use: create, edit, patch, delete, or list."
