"""Reflection node for the Sparta agent graph.

When a tool returns an error, this node injects a reflection prompt into the
conversation so the LLM can correct course before retrying.
"""
import json
import logging
from typing import Any, Literal

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
        "tool_calls_this_turn": 0,
    }


def should_reflect(state: dict[str, Any]) -> Literal["reflection", "agent", "__end__"]:
    """Route to reflection when recent errors exist and we haven't retried too much."""
    tool_calls = state.get("tool_calls_this_turn", 0)
    if tool_calls >= 8:
        logger.warning("Tool call limit reached, ending turn")
        return "__end__"

    errors = _extract_tool_errors(state)
    retries = state.get("reflection_retries", 0)
    if errors and retries < MAX_REFLECTION_RETRIES:
        return "reflection"
    return "agent"


def _extract_tool_errors(state: dict[str, Any]) -> list[dict]:
    errors: list[dict] = []
    for m in state.get("messages", [])[-4:]:
        content = ""
        if isinstance(m, dict):
            content = str(m.get("content", ""))
            msg_type = m.get("role", "")
        else:
            content = str(getattr(m, "content", ""))
            msg_type = getattr(m, "type", "")

        is_tool = msg_type in ("tool", "ToolMessage") or isinstance(m, dict) and msg_type == "tool"
        if is_tool and "Error:" in content:
            errors.append({"content": content})
    return errors
