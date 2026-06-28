"""LangChain tools for skill progressive disclosure.

- skill_view_tool: called by the agent to load the full SKILL.md body.
"""
from typing import Any

from langchain_core.tools import tool

from sparta_ai.skills.skill_loader import skill_view as _skill_view_impl


@tool
def skill_view_tool(skill_id: str) -> str:
    """Load the complete content of a skill by its ID.

    Use this when you need to read the full instructions, examples,
    or configuration of a skill whose name/description you already
    saw in <available_skills>.

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
