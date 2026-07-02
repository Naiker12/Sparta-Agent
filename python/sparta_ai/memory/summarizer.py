"""Conversation summarization for long context windows.

When the conversation history exceeds configured thresholds, older messages
are summarized and replaced by a single compact summary block. Recent messages
are preserved verbatim.
"""
import logging
from typing import Any

logger = logging.getLogger("sparta_ai.memory.summarizer")

MAX_MESSAGES_BEFORE_SUMMARY = 20
MAX_CHARS_BEFORE_SUMMARY = 40_000
KEEP_LAST_N = 6


def estimate_tokens(text: str) -> int:
    """Rough token estimation: ~4 chars per token."""
    return len(text) // 4


class ConversationSummarizer:
    """Compresses long conversation histories by summarizing old messages."""

    def __init__(
        self,
        max_messages: int = MAX_MESSAGES_BEFORE_SUMMARY,
        max_chars: int = MAX_CHARS_BEFORE_SUMMARY,
        keep_last: int = KEEP_LAST_N,
    ):
        self.max_messages = max_messages
        self.max_chars = max_chars
        self.keep_last = keep_last

    async def maybe_compress(
        self, messages: list[dict], llm: Any | None = None
    ) -> list[dict]:
        """Compress messages if thresholds are exceeded.

        Args:
            messages: The full message history.
            llm: Language model to use for summarization. If None, only
                 truncation is performed (no summary generation).

        Returns:
            Compressed message list.
        """
        if len(messages) <= self.max_messages:
            return messages

        total_chars = sum(len(str(m.get("content", ""))) for m in messages)
        if total_chars <= self.max_chars:
            return messages

        system_msg = messages[0] if messages and messages[0].get("role") == "system" else None
        to_compress = messages[1:-self.keep_last] if system_msg else messages[:-self.keep_last]
        recent = messages[-self.keep_last:]

        if not to_compress:
            return messages

        if llm is not None:
            summary = await self._summarize(to_compress, llm)
        else:
            summary = f"({len(to_compress)} mensajes anteriores omitidos por compresión de contexto)"

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
            len(messages), total_chars, len(compressed),
        )
        return compressed

    async def _summarize(self, messages: list[dict], llm: Any) -> str:
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
