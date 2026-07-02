"""Context compression for long conversations.

When the message history grows beyond configured thresholds, older messages are
summarized and replaced by a single system summary block. This keeps the recent
context intact while avoiding context-window errors.
"""
import logging
from typing import Any

logger = logging.getLogger("sparta_ai.memory.context")

MAX_MESSAGES_BEFORE_COMPRESS = 20
MAX_CHARS_BEFORE_COMPRESS = 40_000


async def compress_if_needed(messages: list[dict], llm: Any) -> list[dict]:
    """Compress older messages if the conversation is getting too long.

    Always preserves:
    - The first system message (if present)
    - The most recent 6 messages
    - A generated summary of the messages in between
    """
    if len(messages) <= MAX_MESSAGES_BEFORE_COMPRESS:
        return messages

    total_chars = sum(len(str(m.get("content", ""))) for m in messages)
    if total_chars <= MAX_CHARS_BEFORE_COMPRESS:
        return messages

    system_msg = messages[0] if messages and messages[0].get("role") == "system" else None
    to_compress = messages[1:-6] if system_msg else messages[:-6]
    recent = messages[-6:]

    if not to_compress:
        return messages

    summary = await _summarize(to_compress, llm)

    compressed: list[dict] = []
    if system_msg:
        compressed.append(system_msg)
    compressed.append({
        "role": "system",
        "content": f"[RESUMEN DE CONVERSACIÓN ANTERIOR]\n{summary}",
    })
    compressed.extend(recent)

    logger.debug(
        "Compressed conversation from %d messages (%d chars) to %d messages",
        len(messages), total_chars, len(compressed)
    )
    return compressed


async def _summarize(messages: list[dict], llm: Any) -> str:
    summary_prompt = (
        "Resume la siguiente conversación en 3-5 puntos clave, "
        "preservando los hechos técnicos importantes:\n\n"
        + "\n".join(
            f"{m['role'].upper()}: {str(m.get('content', ''))[:500]}"
            for m in messages[:10]
        )
    )
    try:
        response = await llm.ainvoke([{"role": "user", "content": summary_prompt}])
        return str(response.content)
    except Exception as e:
        logger.warning("Failed to compress conversation context: %s", e)
        return "(No se pudo generar el resumen del contexto anterior.)"
