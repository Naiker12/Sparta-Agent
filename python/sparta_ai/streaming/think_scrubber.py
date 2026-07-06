import re

_OPEN_RE = re.compile(r"<(think|thinking|reasoning)>", re.IGNORECASE)
_CLOSE_RE = re.compile(r"</(think|thinking|reasoning)>", re.IGNORECASE)
_PARTIAL_OPEN_RE = re.compile(r"<[a-zA-Z]*$")
_PARTIAL_CLOSE_RE = re.compile(r"</[a-zA-Z]*$")

_BLOCK_BOUNDARY_RE = re.compile(r"(^|\n\s*)(<(?:think|thinking|reasoning)>)", re.IGNORECASE)
_RESPONSE_TAG_RE = re.compile(r"</?(response)>", re.IGNORECASE)


class StreamingThinkScrubber:
    """Improved think scrubber with proper block-boundary rules and partial tag handling.

    Block-boundary rules (from Hermes Agent best practices):
    - Open tags are ONLY recognized at line boundaries (start of stream, after newline,
      or when only whitespace precedes the tag on the current line).
    - Closed pairs <tag>X</tag> are ALWAYS suppressed, even mid-line.
    - Partial tags split between chunks are retained in a buffer until the next chunk.

    This prevents false positives like "use <think> in your code" from being suppressed.
    """

    def __init__(self):
        self.reset()

    def reset(self):
        self._in_block = False
        self._buf = ""
        self._reasoning_emitted = False

    def feed(self, text: str) -> tuple[str, str]:
        """Process a text delta, return (visible_text, reasoning_text).

        The reasoning text is only returned once per block to avoid flooding the
        frontend with repeated emissions. Returns ('', '') when nothing to emit.
        """
        self._buf += text
        visible, reasoning = "", ""

        while self._buf:
            if not self._in_block:
                m = _BLOCK_BOUNDARY_RE.search(self._buf)
                if m:
                    before = self._buf[: m.start(2)]
                    if before.strip() == "" or m.group(1).strip() == "":
                        visible += before
                        tag = m.group(2).lower()
                        self._buf = self._buf[m.end(2):]
                        self._in_block = True
                        self._reasoning_emitted = False

                        close = _CLOSE_RE.search(self._buf)
                        if close:
                            reasoning += self._buf[: close.start()]
                            self._buf = self._buf[close.end():]
                            self._in_block = False
                            self._reasoning_emitted = True
                        continue

                # Detect and strip <response> / </response> tags
                m_resp = _RESPONSE_TAG_RE.search(self._buf)
                if m_resp:
                    visible += self._buf[: m_resp.start()]
                    self._buf = self._buf[m_resp.end():]
                    continue

                # Also detect closed pairs mid-line (always suppress)
                closed_pair = re.search(
                    r"<(think|thinking|reasoning)>.*?</\1>", self._buf, re.IGNORECASE
                )
                if closed_pair:
                    visible += self._buf[: closed_pair.start()]
                    self._buf = self._buf[closed_pair.end():]
                    continue

                # Partial open tag at buffer end: retain
                tail_match = _PARTIAL_OPEN_RE.search(self._buf)
                if tail_match and tail_match.end() == len(self._buf):
                    if tail_match.start() > 0:
                        visible += self._buf[: tail_match.start()]
                        self._buf = self._buf[tail_match.start():]
                    break

                visible += self._buf
                self._buf = ""
            else:
                close = _CLOSE_RE.search(self._buf)
                if close:
                    new_reasoning = self._buf[: close.start()]
                    if new_reasoning:
                        reasoning += new_reasoning
                        self._reasoning_emitted = True
                    self._buf = self._buf[close.end():]
                    self._in_block = False

                    after = self._buf
                    self._buf = ""
                    next_open = _BLOCK_BOUNDARY_RE.search(after)
                    if next_open and after[: next_open.start(2)].strip() == "":
                        self._buf = after
                    else:
                        visible += after
                    continue

                tail_match = _PARTIAL_CLOSE_RE.search(self._buf)
                if tail_match and tail_match.end() == len(self._buf):
                    if tail_match.start() > 0:
                        reasoning += self._buf[: tail_match.start()]
                        self._reasoning_emitted = True
                        self._buf = self._buf[tail_match.start():]
                    break

                reasoning += self._buf
                self._reasoning_emitted = True
                self._buf = ""

        return visible, reasoning

    def flush(self) -> str:
        """Release any buffered content as visible text at stream end."""
        if self._in_block:
            leftover, self._buf = self._buf, ""
            self._in_block = False
            self._reasoning_emitted = False
            return leftover
        leftover, self._buf = self._buf, ""
        self._in_block = False
        return leftover
