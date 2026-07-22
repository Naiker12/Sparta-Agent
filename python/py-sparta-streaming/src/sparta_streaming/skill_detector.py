"""Skill detection utilities used by streaming event dispatchers."""
import logging
from typing import Any

logger = logging.getLogger("sparta_ai.streaming.skill_detector")


def detect_skill(
    thinking_text: str,
    active_skills: list[str],
    stream_state: dict[str, Any],
) -> dict[str, Any] | None:
    """Detect if the LLM is activating a skill.

    Returns the detected skill dict or None. Updates the stream state to avoid
    re-emitting the same skill repeatedly.
    """
    if not active_skills or not thinking_text.strip():
        return None
    try:
        from sparta_skills.skill_loader import skills_index
        from sparta_skills.skills_guard import detect_skill_in_thought

        detected = detect_skill_in_thought(thinking_text, active_skills, skills_index())
        if detected and detected["id"] != stream_state.get("last_detected_skill"):
            stream_state["last_detected_skill"] = detected["id"]
            return detected
    except ImportError:
        pass
    return None


def build_skill_payload(detected: dict[str, Any], base_payload: dict[str, Any]) -> dict[str, Any]:
    """Build a normalized skill:activated payload."""
    return {
        **base_payload,
        "skillId": detected["id"],
        "skillName": detected.get("name", detected["id"]),
        "skillIcon": detected.get("icon", "\U0001f4e6"),
        "skillCategory": detected.get("category", ""),
    }
