import re

_OPEN_RE = re.compile(r"<(think|thinking|reasoning)>", re.IGNORECASE)
_CLOSE_RE = re.compile(r"</(think|thinking|reasoning)>", re.IGNORECASE)


class StreamingThinkScrubber:
    """Separa tags <think>...</think> inline del content, delta por delta.

    Muchos modelos gratuitos de OpenRouter (y otros proveedores open) no emiten
    reasoning en campos estructurados ni en content blocks tipados; en cambio
    escriben el razonamiento directamente dentro del texto como tags
    ``<think>`` / ``<thinking>`` / ``<reasoning>``. Esta clase consume los
    deltas de texto en tiempo real y devuelve dos flujos separados:
    texto visible y texto de razonamiento.

    Reconoce tags de apertura solo cuando están al inicio de una línea (o al
    inicio del stream), y retiene posibles tags partidos entre chunks para no
    perderlos ni emitirlos como texto visible.
    """

    def __init__(self):
        self.reset()

    def reset(self):
        self._in_block = False
        self._buf = ""

    def feed(self, text: str) -> tuple[str, str]:
        """Devuelve (visible_text, reasoning_text) para este delta."""
        self._buf += text
        visible, reasoning = "", ""

        while self._buf:
            if not self._in_block:
                m = _OPEN_RE.search(self._buf)
                if m and self._buf[: m.start()].strip() == "":
                    visible += self._buf[: m.start()]
                    self._buf = self._buf[m.end() :]
                    self._in_block = True
                    continue

                # Podría ser un tag partido al final del buffer: retenerlo.
                tail_match = re.search(r"<[a-zA-Z]*$", self._buf)
                if tail_match:
                    if tail_match.start() > 0:
                        visible += self._buf[: tail_match.start()]
                        self._buf = self._buf[tail_match.start() :]
                    break

                visible += self._buf
                self._buf = ""
            else:
                m = _CLOSE_RE.search(self._buf)
                if m:
                    reasoning += self._buf[: m.start()]
                    self._buf = self._buf[m.end() :]
                    self._in_block = False
                    continue

                # Podría ser un cierre partido al final del buffer: retenerlo.
                tail_match = re.search(r"</[a-zA-Z]*$", self._buf)
                if tail_match:
                    if tail_match.start() > 0:
                        reasoning += self._buf[: tail_match.start()]
                        self._buf = self._buf[tail_match.start() :]
                    break

                reasoning += self._buf
                self._buf = ""

        return visible, reasoning

    def flush(self) -> str:
        """Al terminar el stream, suelta lo que haya quedado retenido como visible."""
        leftover, self._buf = self._buf, ""
        self._in_block = False
        return leftover
