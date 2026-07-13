"""Emulated reasoning for models without native API reasoning support.

For models that don't expose a separate reasoning/thinking channel via API
(Llama, Mistral, local models via Ollama/LMStudio), this module provides:

1. A system prompt suffix that instructs the model to wrap its reasoning in
   think/thinking/reasoning tags.
2. A function to extract and strip those tags from the model's output,
   returning the reasoning separately so the frontend can display it in a
   ThinkingBlock just like native reasoning.
3. A compiled regex for detecting tag boundaries (coordinated with
   ``StreamingThinkScrubber`` in ``think_scrubber.py``).

Usage in the agent graph::

    from sparta_ai.agents.emulated_reasoning import (
        append_reasoning_prompt,
        extract_thinking,
        needs_emulated_reasoning,
    )

    # When building the system prompt for a non-reasoning model:
    system_prompt = append_reasoning_prompt(base_system_prompt)

    # After receiving the full response:
    reasoning, visible = extract_thinking(raw_response)
"""
import re

# ── Prompt engineering ───────────────────────────────────────────────────

_REASONING_INSTRUCTION = """<reasoning_mode>
Antes de responder, razoná internamente sobre la tarea. Describí tu análisis,
las opciones que evaluás, y por qué elegís una estrategia sobre otra.

Usá EXCLUSIVAMENTE estos tags para envolver tu razonamiento:

<think>
[tu razonamiento completo acá]
</think>

Después del tag de cierre </think>, escribí tu respuesta final visible
para el usuario. NO repitas en la respuesta visible lo que ya dijiste
dentro de <think>.

Ejemplo de formato correcto:

<think>
El usuario quiere agregar autenticación. Evalúo tres opciones:
1. JWT simple — rápido pero sin refresh token
2. Session-based — más seguro pero requiere Redis
3. OAuth2 — estándar pero overkill para este caso
Elijo JWT simple porque el proyecto es pequeño y no maneja datos sensibles.
</think>

Para agregar autenticación con JWT, voy a crear los siguientes archivos...
</reasoning_mode>"""

# Maximum character length for the emulated thinking block.
# If the extracted reasoning exceeds this, it gets truncated to avoid
# overwhelming the UI with low-quality model rambling.
MAX_REASONING_CHARS = 8_000


# ── Tag detection regex (coordinated with think_scrubber.py) ─────────────

_OPEN_TAG_RE = re.compile(r"<(?:think(?:ing|reasoning)?)>", re.IGNORECASE)
_CLOSE_TAG_RE = re.compile(r"</(?:think(?:ing|reasoning)?)>", re.IGNORECASE)


# ── Public API ───────────────────────────────────────────────────────────

def needs_emulated_reasoning(vendor: str | None, model_id: str) -> bool:
    """Determine if a model needs emulated reasoning via prompt engineering.

    Returns True for vendors/models that don't natively expose reasoning
    content through the API (i.e., the reasoning_content / thinking fields
    will always be empty).
    """
    if not vendor:
        return True

    v = vendor.lower()

    # Vendors that expose native reasoning
    if v in ("anthropic",):
        return False  # Claude 3.7+/4.x have extended thinking
    if v in ("openai",) and any(m in model_id.lower() for m in ("o1", "o3", "o4", "gpt-5")):
        return False
    if v in ("google",) and "gemini-2.5" in model_id.lower():
        return False
    if v in ("deepseek",) and any(m in model_id.lower() for m in ("r1", "v3")):
        return False

    # Everything else: Ollama, LMStudio, custom, Mistral, Groq, etc.
    return True


def append_reasoning_prompt(base_system: str) -> str:
    """Append the emulated-reasoning instruction to a system prompt.

    If the system prompt already contains the instruction (idempotency
    check), returns it unchanged.
    """
    if "<think>" in base_system or "<thinking>" in base_system:
        return base_system
    return f"{base_system}\n\n{_REASONING_INSTRUCTION}"


def extract_thinking(content: str) -> tuple[str, str]:
    """Extract emulated thinking tags from model output.

    Returns:
        (reasoning, visible) where:
        - reasoning: the text inside think/thinking/reasoning tags
        - visible: the content with all thinking tags stripped

    Handles multiple blocks, nested content, and partial/unclosed tags.
    If no tags are found, returns ('', content) unchanged.
    """
    if not content or not _OPEN_TAG_RE.search(content):
        return ("", content)

    reasoning_parts: list[str] = []
    result = content

    for match in list(_OPEN_TAG_RE.finditer(content)):
        start = match.end()
        close = _CLOSE_TAG_RE.search(content, start)
        if close:
            block = content[start:close.start()].strip()
            if block:
                reasoning_parts.append(block)
            # Remove the entire block including tags from visible output
            result = result.replace(content[match.start():close.end()], "", 1)
        else:
            # Unclosed tag — treat everything after the open tag as reasoning
            block = content[start:].strip()
            if block:
                reasoning_parts.append(block)
            result = result[:match.start()]

    reasoning = "\n\n".join(reasoning_parts)

    # Truncate overly long reasoning to keep the UI responsive
    if len(reasoning) > MAX_REASONING_CHARS:
        reasoning = reasoning[:MAX_REASONING_CHARS] + "\n…(razonamiento truncado)"

    visible = result.strip()

    return (reasoning, visible)
