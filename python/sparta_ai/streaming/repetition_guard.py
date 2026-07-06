"""Guard that cuts off LLM streaming when n-gram repetition is detected.

Free-tier models (especially OpenRouter :free) commonly enter degenerate loops
where they repeat the same text fragment indefinitely. This guard monitors the
token stream and signals abortion when a repeating pattern is detected.
"""
import logging

logger = logging.getLogger("sparta_ai.streaming.repetition_guard")


class RepetitionGuard:
    """Cuts off the stream if an n-gram or phrase repeats consecutively N+ times.

    Two detection strategies:
    1. Short n-gram (default 6-char window, 4 repeats) — catches token-level loops.
    2. Long phrase (default 24-char phrase, 3 consecutive repeats) — catches
       sentence-level degeneration common in free-tier models.

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
        ngram_size: int = 6,
        max_repeats: int = 4,
        phrase_len: int = 24,
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

    def feed(self, token: str) -> bool:
        """Feed a new token into the guard.

        Returns True if the stream should be aborted (repetition detected).
        Returns False if the stream is still clean.
        """
        if not token:
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

    def reset(self) -> None:
        self.buffer = ""
