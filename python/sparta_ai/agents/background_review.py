"""Background skill review — autonomous skill creation/improvement.

After N tool-call iterations, the system reviews the conversation transcript
and may create or update skills based on discovered patterns, corrections,
and reusable workflows.

Inspired by Hermes Agent's background_review.py + curator.py.
"""
import json
import logging
import os
from pathlib import Path
from typing import Any

logger = logging.getLogger("sparta_ai.agents.background_review")

# How many tool-call iterations before nudging the agent to review
SKILL_NUDGE_INTERVAL = 10

# Minimum conversation length to trigger review
MIN_MESSAGES_FOR_REVIEW = 6


def should_review(iterations_since_last_review: int, total_messages: int) -> bool:
    """Check if background review should be triggered."""
    if total_messages < MIN_MESSAGES_FOR_REVIEW:
        return False
    return iterations_since_last_review >= SKILL_NUDGE_INTERVAL


def build_review_prompt(messages: list[dict], existing_skills: list[dict]) -> str:
    """Build a prompt for the LLM to review the conversation and suggest skill improvements.

    The LLM should output JSON with skill creation/update suggestions.
    """
    # Get last N messages for review context
    recent = messages[-20:] if len(messages) > 20 else messages
    transcript = "\n".join(
        f"{m.get('role', '?')}: {m.get('content', '')[:200]}"
        for m in recent
        if isinstance(m, dict) and m.get("content")
    )

    existing_list = "\n".join(
        f"  - {s.get('id', '?')}: {s.get('name', '?')} ({s.get('description', '')})"
        for s in existing_skills
    )

    return f"""Review the recent conversation transcript below and identify if any
reusable pattern, workflow, or correction deserves to be saved as a new skill
or if an existing skill should be updated.

Current skills:
{existing_list or '  (none)'}

Recent conversation:
---START TRANSCRIPT---
{transcript}
---END TRANSCRIPT---

Respond in JSON format ONLY:
{{
  "should_create": null or {{
    "name": "short-name",
    "description": "brief description",
    "category": "Coding|Research|Writing|General|Workflow|Automation",
    "body": "Full skill instructions in markdown following the patterns observed"
  }},
  "should_update": null or {{
    "id": "existing-skill-id",
    "patch_body": "New or additional instructions to append"
  }},
  "reasoning": "Why this skill would be useful"
}}"""


def parse_review_response(response_text: str) -> dict:
    """Parse the LLM response, extracting JSON if wrapped in markdown."""
    text = response_text.strip()
    # Remove ```json ... ``` wrappers
    if text.startswith("```"):
        lines = text.split("\n")
        if lines[0].strip().startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        text = "\n".join(lines)
    try:
        return json.loads(text)
    except json.JSONDecodeError as e:
        logger.warning("Failed to parse review response: %s", e)
        return {}


async def execute_review(
    llm: Any,
    messages: list[dict],
    existing_skills: list[dict],
) -> dict:
    """Run background review using the LLM.

    Returns the parsed review result with skill creation/update suggestions.
    """
    prompt = build_review_prompt(messages, existing_skills)
    try:
        response = await llm.ainvoke([
            {"role": "system", "content": "You are a skill review assistant. Analyze conversations and suggest skill improvements. Output ONLY valid JSON."},
            {"role": "user", "content": prompt},
        ])
        result_text = response.content if hasattr(response, "content") else str(response)
        return parse_review_response(result_text)
    except Exception as e:
        logger.error("Background review failed: %s", e)
        return {}


def apply_review_result(result: dict, skills_dir: Path) -> list[str]:
    """Apply the review result: create or update skills.

    Returns a list of actions taken (for logging).
    """
    actions: list[str] = []

    create = result.get("should_create")
    if create and create.get("name") and create.get("body"):
        name = create["name"]
        sid = name.lower().replace(" ", "-").replace("_", "-")
        desc = create.get("description", "")
        category = create.get("category", "General")
        body = create["body"]

        cat_dir = skills_dir / category.lower().replace(" ", "-")
        cat_dir.mkdir(parents=True, exist_ok=True)
        md_path = cat_dir / sid / "SKILL.md"
        if md_path.exists():
            actions.append(f"SKIP {sid}: already exists")
            continue

        md_path.parent.mkdir(parents=True, exist_ok=True)
        content = (
            f"---\n"
            f"id: {sid}\n"
            f"name: {name}\n"
            f"description: \"{desc}\"\n"
            f"version: 1.0.0\n"
            f"author: Sparta Agent (auto-created)\n"
            f"category: {category}\n"
            f"source: user\n"
            f"---\n\n"
            f"{body}\n"
        )
        md_path.write_text(content, encoding="utf-8")
        actions.append(f"CREATED {sid}")
        logger.info("Background review created skill: %s at %s", sid, md_path)

    update = result.get("should_update")
    if update and update.get("id") and update.get("patch_body"):
        sid = update["id"]
        patch = update["patch_body"]

        # Find the skill file
        for cat_dir in skills_dir.iterdir():
            if not cat_dir.is_dir():
                continue
            md_path = cat_dir / sid / "SKILL.md"
            if md_path.exists():
                existing = md_path.read_text(encoding="utf-8")
                # Append patch before any existing "---" at end
                if existing.endswith("\n"):
                    new_content = existing + "\n\n## Auto-generated additions\n\n" + patch + "\n"
                else:
                    new_content = existing + "\n\n## Auto-generated additions\n\n" + patch + "\n"
                md_path.write_text(new_content, encoding="utf-8")
                actions.append(f"PATCHED {sid}")
                logger.info("Background review patched skill: %s", sid)
                break
        else:
            actions.append(f"SKIP {sid}: not found for update")

    return actions


def clear_skill_cache() -> None:
    """Clear the skills_index cache after modifications."""
    try:
        from sparta_ai.skills.skill_loader import clear_skill_cache as _clear
        _clear()
    except ImportError:
        pass
