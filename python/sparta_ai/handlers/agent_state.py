"""Build the initial SpartaState dict for the agent graph."""
from sparta_ai.agents.sparta_agent import SpartaState


def _build_initial_state(
    compressed_messages: list,
    session_id: str,
    mode: str,
    skills: list[str],
    memory_context: str,
    project_context: str = "",
) -> SpartaState:
    return {
        "messages": compressed_messages,
        "session_id": session_id,
        "mode": mode,
        "active_skills": skills,
        "memory_context": memory_context,
        "project_context": project_context,
        "thinking_tokens": 0,
        "tool_calls_this_turn": 0,
        "subagent_results": [],
        "pending_human_input": None,
        "abort_requested": False,
        "force_summary": False,
        "accumulated_text": "",
        "plan": [],
        "current_step": 0,
        "plan_complete": False,
        "reflection_retries": 0,
        "suggestions": [],
    }
