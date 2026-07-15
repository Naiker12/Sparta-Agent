"""Context compression for long conversations.

When the message history grows beyond configured thresholds, older messages are
summarized and replaced by a single system summary block. This keeps the recent
context intact while avoiding context-window errors.

Algoritmo D: Non-blocking compression — compression runs in background via
asyncio.create_task so the agent can respond immediately with the full history.
Once the summary is ready, subsequent calls use it.
"""
import asyncio
import logging
from typing import Any

logger = logging.getLogger("sparta_ai.memory.context")

MAX_MESSAGES_BEFORE_COMPRESS = 20
MAX_CHARS_BEFORE_COMPRESS = 40_000

_active_summaries: dict[str, str] = {}


async def compress_if_needed_non_blocking(
    messages: list[dict], llm: Any, session_id: str = "default"
) -> list[dict]:
    """Non-blocking context compression.

    If compression is needed, spawns a background task to summarize and returns
    immediately with the original messages. On subsequent calls, if a summary
    is ready it is injected as a system message replacing old messages.

    Args:
        messages: Full conversation history.
        llm: LLM instance for summarization.
        session_id: Session identifier for per-session summary storage.

    Returns:
        Messages list (original or with summary injected).
    """
    summary = _active_summaries.get(session_id)
    if summary:
        messages = _inject_summary(messages, summary)

    if len(messages) <= MAX_MESSAGES_BEFORE_COMPRESS:
        return messages

    total_chars = sum(len(str(m.get("content", ""))) for m in messages)
    if total_chars <= MAX_CHARS_BEFORE_COMPRESS:
        return messages

    if session_id not in _active_summaries:
        asyncio.create_task(
            _execute_background_summarize(messages, llm, session_id)
        )

    return messages


def _inject_summary(messages: list[dict], summary: str) -> list[dict]:
    """Replace old messages with a summary, keeping system + recent 6."""
    system_msg = messages[0] if messages and messages[0].get("role") == "system" else None
    recent = messages[-6:]

    compressed: list[dict] = []
    if system_msg:
        compressed.append(system_msg)
    compressed.append({
        "role": "system",
        "content": f"[RESUMEN DE CONVERSACIÓN ANTERIOR]\n{summary}",
    })
    compressed.extend(recent)
    return compressed


async def _execute_background_summarize(
    messages: list[dict], llm: Any, session_id: str
) -> None:
    """Background task: summarize old messages and store result."""
    try:
        system_msg = messages[0] if messages and messages[0].get("role") == "system" else None
        to_compress = messages[1:-6] if system_msg else messages[:-6]
        if not to_compress:
            return
        summary = await _summarize(to_compress, llm)
        _active_summaries[session_id] = summary
        logger.info(
            "Background compression complete for session %s: %d messages summarized",
            session_id, len(to_compress),
        )
    except Exception as e:
        logger.warning("Background compression failed for session %s: %s", session_id, e)


def clear_summary(session_id: str) -> None:
    """Clear stored summary for a session (e.g. on new conversation)."""
    _active_summaries.pop(session_id, None)


async def compress_if_needed(messages: list[dict], llm: Any) -> list[dict]:
    """Synchronous compression fallback (legacy API).

    Compresses older messages if the conversation is getting too long.
    Always preserves the first system message and the most recent 6 messages.
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
