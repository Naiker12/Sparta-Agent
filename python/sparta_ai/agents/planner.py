"""Planner node for the Sparta agent graph.

Generates a structured plan before executing tools for complex tasks. The plan
is stored in the graph state and guides the agent's execution.
"""
import json
import logging
from typing import Any

from langchain_core.output_parsers import JsonOutputParser
from langchain_core.prompts import PromptTemplate

logger = logging.getLogger("sparta_ai.agents.planner")

PLAN_PROMPT = """Eres un planificador de tareas. Dado el mensaje del usuario y las tools disponibles,
genera un plan en JSON con esta estructura:
{{
  "needs_planning": true/false,
  "steps": [
    {{"id": 1, "action": "descripción", "tool": "tool_name o null", "depends_on": []}}
  ],
  "estimated_steps": N
}}

Solo genera plan si la tarea requiere múltiples pasos o tools.
Para preguntas simples, devuelve needs_planning: false.

TOOLS DISPONIBLES: {tools}
TAREA: {task}

Responde ÚNICAMENTE con el JSON válido, sin markdown ni explicaciones."""


async def planner_node(state: dict[str, Any], llm: Any) -> dict:
    """Generate a structured plan before executing tools."""
    last_user_msg = _get_last_user_message(state)
    mode = state.get("mode", "chat")

    if not last_user_msg or mode != "agent":
        return {}

    # Skip planning for short, simple questions.
    if len(last_user_msg.split()) < 10:
        return {}

    try:
        plan = await _generate_plan(last_user_msg, state, llm)
    except Exception as e:
        logger.warning("Planner failed: %s", e)
        return {}

    if plan.get("needs_planning") and plan.get("steps"):
        return {
            "plan": [s["action"] for s in plan["steps"]],
            "current_step": 0,
            "plan_complete": False,
        }
    return {}


def _get_last_user_message(state: dict[str, Any]) -> str:
    for m in reversed(state.get("messages", [])):
        if isinstance(m, dict) and m.get("role") == "user":
            return str(m.get("content", ""))
        if hasattr(m, "type") and m.type == "human":
            return str(getattr(m, "content", ""))
    return ""


async def _generate_plan(task: str, state: dict[str, Any], llm: Any) -> dict:
    tool_names = _extract_tool_names(state)
    prompt_text = PLAN_PROMPT.format(tools=", ".join(tool_names), task=task)

    # Use a simple prompt-based call rather than structured output to avoid
    # extra dependencies and keep the node lightweight.
    response = await llm.ainvoke([{"role": "user", "content": prompt_text}])
    raw = str(response.content)

    # Try to extract JSON from the response.
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("```", 2)[-1]
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
    cleaned = cleaned.strip()

    plan = json.loads(cleaned)
    if not isinstance(plan, dict):
        return {}
    return plan


def _extract_tool_names(state: dict[str, Any]) -> list[str]:
    """Return tool names from the last assistant message's tool_calls, if any."""
    names: set[str] = set()
    for m in reversed(state.get("messages", [])):
        tool_calls = getattr(m, "tool_calls", None) or []
        for tc in tool_calls:
            name = tc.get("name") if isinstance(tc, dict) else getattr(tc, "name", None)
            if name:
                names.add(str(name))
    return sorted(names)
