"""Reflection node for the Sparta agent graph.

When a tool returns an error, this node injects a reflection prompt into the
conversation so the LLM can correct course before retrying.
"""
import json
import logging
from typing import Any, Literal

# Import lazily to avoid circular dependency (sparta_agent → reflection → sparta_agent)
def _get_max_tool_calls() -> int:
    from sparta_ai.agents.sparta_agent import MAX_TOOL_CALLS_PER_TURN
    return MAX_TOOL_CALLS_PER_TURN

logger = logging.getLogger("sparta_ai.agents.reflection")

REFLECTION_PROMPT = """Analiza el siguiente error de una herramienta y decide cómo proceder:

{errors}

Instrucciones:
- Si el error se puede corregir (ruta incorrecta, parámetro equivocado, etc.), indica la corrección exacta.
- Si el error es permanente, informa al usuario con una explicación clara.
- Si existe una alternativa (otra herramienta u otra estrategia), descríbela.

Responde directamente al usuario con tu análisis y próximos pasos."""

MAX_REFLECTION_RETRIES = 3


async def reflection_node(state: dict[str, Any]) -> dict:
    """Analyze recent tool errors and inject a reflection message."""
    errors = _extract_tool_errors(state)
    if not errors:
        return {}

    reflection_text = REFLECTION_PROMPT.format(
        errors=json.dumps(errors, ensure_ascii=False, indent=2)
    )
    return {
        "messages": [{"role": "system", "content": reflection_text}],
        "reflection_retries": state.get("reflection_retries", 0) + 1,
    }


def should_reflect(state: dict[str, Any]) -> Literal["reflection", "agent", "__end__"]:
    """Route to reflection when recent errors exist and we haven't retried too much."""
    tool_calls = state.get("tool_calls_this_turn", 0)
    if tool_calls >= _get_max_tool_calls():
        logger.warning("Tool call limit reached, routing to agent for final synthesis")
        return "agent"

    errors = _extract_tool_errors(state)
    retries = state.get("reflection_retries", 0)
    if errors and retries < MAX_REFLECTION_RETRIES:
        return "reflection"
    return "agent"


def _extract_tool_errors(state: dict[str, Any]) -> list[dict]:
    errors: list[dict] = []
    for m in state.get("messages", [])[-4:]:
        content = ""
        status = ""
        if isinstance(m, dict):
            content = str(m.get("content", ""))
            msg_type = m.get("role", "")
            status = str(m.get("status", ""))
        else:
            content = str(getattr(m, "content", ""))
            msg_type = getattr(m, "type", "")
            status = getattr(m, "status", "")

        is_tool = msg_type in ("tool", "ToolMessage") or isinstance(m, dict) and msg_type == "tool"
        # Use structured status field (preferred) with "Error:" fallback for backward compatibility
        is_error = status == "error" or (is_tool and "Error:" in content)
        if is_tool and is_error:
            errors.append({"content": content, "status": status or "error"})
    return errors
