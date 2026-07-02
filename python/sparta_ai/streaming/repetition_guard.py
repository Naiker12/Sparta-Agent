"""Guard that cuts off LLM streaming when n-gram repetition is detected.

Free-tier models (especially OpenRouter :free) commonly enter degenerate loops
where they repeat the same text fragment indefinitely. This guard monitors the
token stream and signals abortion when a repeating pattern is detected.
"""
import logging

logger = logging.getLogger("sparta_ai.streaming.repetition_guard")


class RepetitionGuard:
    """Cuts off the stream if an n-gram repeats consecutively N+ times.

    Usage:
        guard = RepetitionGuard(ngram_size=6, max_repeats=4)
        for token in stream:
            if guard.feed(token):
                logger.warning("Repetition detected, aborting stream")
                break
            yield token
    """

    def __init__(self, ngram_size: int = 6, max_repeats: int = 4):
        if ngram_size < 1:
            raise ValueError("ngram_size must be >= 1")
        if max_repeats < 2:
            raise ValueError("max_repeats must be >= 2")
        self.ngram_size = ngram_size
        self.max_repeats = max_repeats
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
        tail = self.buffer[-(self.ngram_size * self.max_repeats) :]
        ngram = tail[-self.ngram_size :]
        if not ngram:
            return False
        return tail.count(ngram) >= self.max_repeats

    def reset(self) -> None:
        self.buffer = ""
