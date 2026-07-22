"""Guard that cuts off LLM streaming when n-gram repetition is detected.

Free-tier models (especially OpenRouter :free) commonly enter degenerate loops
where they repeat the same text fragment indefinitely. This guard monitors the
token stream and signals abortion when a repeating pattern is detected.
"""
import logging
import re

logger = logging.getLogger("sparta_ai.streaming.repetition_guard")

_CODE_BLOCK_RE = re.compile(r"```[\s\S]*?```", re.DOTALL)


class RepetitionGuard:
    """Cuts off the stream if an n-gram or phrase repeats consecutively N+ times.

    Two detection strategies:
    1. Short n-gram (default 12-char window, 6 repeats) — catches token-level loops.
    2. Long phrase (default 40-char phrase, 3 consecutive repeats) — catches
       sentence-level degeneration common in free-tier models.

    The buffer is reset on tool call boundaries (``reset_boundary``) so that
    text from distinct file reads or tool outputs does not accumulate and
    trigger false positives.

    Usage:
        guard = RepetitionGuard()
        for token in stream:
            if guard.feed(token):
                logger.warning("Repetition detected, aborting stream")
                break
            yield token
    """

    def __init__(
        self,
        ngram_size: int = 12,
        max_repeats: int = 6,
        phrase_len: int = 40,
        phrase_max_repeats: int = 3,
    ):
        if ngram_size < 1:
            raise ValueError("ngram_size must be >= 1")
        if max_repeats < 2:
            raise ValueError("max_repeats must be >= 2")
        if phrase_len < 1:
            raise ValueError("phrase_len must be >= 1")
        if phrase_max_repeats < 2:
            raise ValueError("phrase_max_repeats must be >= 2")
        self.ngram_size = ngram_size
        self.max_repeats = max_repeats
        self.phrase_len = phrase_len
        self.phrase_max_repeats = phrase_max_repeats
        self.buffer = ""
        self._code_block_open = False

    def feed(self, token: str) -> bool:
        """Feed a new token into the guard.

        Returns True if the stream should be aborted (repetition detected).
        Returns False if the stream is still clean.
        """
        if not token:
            return False

        # Track fenced code blocks (```).  Count opening/closing fence
        # lines in this token so that a token containing both open and
        # close (e.g. a complete short code block) is handled correctly.
        backtick_lines = sum(
            1 for line in token.split("\n") if line.strip().startswith("```")
        )
        if backtick_lines % 2 == 1:
            self._code_block_open = not self._code_block_open

        if self._code_block_open:
            # Still accumulate so the buffer stays coherent for later,
            # but skip the repetition check while inside a code block.
            self.buffer += token
            return False

        self.buffer += token
        return self._check()

    def _check(self) -> bool:
        if len(self.buffer) < self.ngram_size * self.max_repeats:
            return False

        # Strategy 1: short n-gram detection (token-level loops)
        tail = self.buffer[-(self.ngram_size * self.max_repeats) :]
        ngram = tail[-self.ngram_size :]
        if ngram and tail.count(ngram) >= self.max_repeats:
            return True

        # Strategy 2: long phrase detection (sentence-level degeneration)
        needed = self.phrase_len * self.phrase_max_repeats
        if len(self.buffer) >= needed:
            window = self.buffer[-needed:]
            phrase = window[-self.phrase_len :]
            if phrase.strip() and window.count(phrase) >= self.phrase_max_repeats:
                return True

        return False

    def reset_boundary(self) -> None:
        """Reset the buffer at a tool call boundary.

        Call this when the model finishes narrating and starts executing or
        has just finished reading a tool result.  This prevents text from
        distinct tool outputs (e.g. multiple file reads with similar imports)
        from accumulating into a single buffer and triggering false positives.
        """
        self.buffer = ""
        self._code_block_open = False

    def reset(self) -> None:
        self.buffer = ""
        self._code_block_open = False
