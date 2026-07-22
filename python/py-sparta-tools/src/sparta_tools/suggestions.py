"""Contextual follow-up suggestion generation using the LLM."""

import asyncio
import json
import logging
from typing import Any

logger = logging.getLogger("sparta_ai.tools.suggestions")

_SUGGESTION_PROMPT = """Eres un asistente que genera preguntas de seguimiento relevantes.

Basado en la conversación:
USUARIO: {user_query}
ASISTENTE: {llm_response}

Genera EXACTAMENTE 3 preguntas cortas de seguimiento en el MISMO IDIOMA que el usuario usó.

Reglas:
- Preguntas naturales y conversacionales, no genéricas
- Deben invitar a profundizar, aclarar o explorar temas relacionados
- Máximo 12 palabras cada una
- NO uses viñetas ni números — solo el array JSON

Responde ÚNICAMENTE con un array JSON plano, nada más:
["Pregunta 1?", "Pregunta 2?", "Pregunta 3?"]"""


async def generate_suggestions(
    llm: Any,
    user_query: str,
    llm_response: str,
) -> list[str]:
    """Generate 3 contextual follow-up suggestions using the LLM."""
    if not user_query or not llm_response:
        return []

    prompt = _SUGGESTION_PROMPT.format(
        user_query=user_query[:600],
        llm_response=llm_response[:1500],
    )

    messages: list[dict] = [
        {"role": "system", "content": "Eres un asistente útil que genera preguntas de seguimiento."},
        {"role": "user", "content": prompt},
    ]

    try:
        # Add timeout to prevent hanging on slow/unresponsive models
        response = await asyncio.wait_for(llm.ainvoke(messages), timeout=10.0)
        content = response.content if hasattr(response, "content") else str(response)
        content = content.strip()
        if content.startswith("```"):
            content = content.split("\n", 1)[-1]
            content = content.rsplit("\n", 1)[0] if "\n" in content else content
            content = content.strip().removeprefix("```json").removesuffix("```").strip()
        suggestions = json.loads(content)
        if isinstance(suggestions, list) and len(suggestions) >= 2:
            return [str(s).strip() for s in suggestions[:3]]
    except asyncio.TimeoutError:
        logger.warning("suggestion generation timed out after 10s")
    except json.JSONDecodeError as e:
        logger.warning("suggestion generation returned invalid JSON: %s", e)
    except Exception as e:
        logger.warning("suggestion generation failed: %s", e)

    return []
