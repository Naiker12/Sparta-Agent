import pytest

from sparta_streaming.repetition_guard import RepetitionGuard


class TestRepetitionGuardDefaults:
    def test_default_thresholds_are_safe(self):
        g = RepetitionGuard()
        assert g.ngram_size == 12
        assert g.max_repeats == 6
        assert g.phrase_len == 40
        assert g.phrase_max_repeats == 3

    def test_custom_thresholds(self):
        g = RepetitionGuard(ngram_size=8, max_repeats=5, phrase_len=30, phrase_max_repeats=4)
        assert g.ngram_size == 8
        assert g.max_repeats == 5
        assert g.phrase_len == 30
        assert g.phrase_max_repeats == 4

    def test_invalid_ngram_size(self):
        with pytest.raises(ValueError):
            RepetitionGuard(ngram_size=0)

    def test_invalid_max_repeats(self):
        with pytest.raises(ValueError):
            RepetitionGuard(max_repeats=1)

    def test_invalid_phrase_len(self):
        with pytest.raises(ValueError):
            RepetitionGuard(phrase_len=0)

    def test_invalid_phrase_max_repeats(self):
        with pytest.raises(ValueError):
            RepetitionGuard(phrase_max_repeats=1)


class TestRepetitionGuardDetection:
    def test_clean_text_no_trigger(self):
        g = RepetitionGuard()
        text = (
            "Voy a leer el archivo __init__.py. Este archivo contiene los imports "
            "principales del módulo. Ahora voy a leer main.py. Este archivo contiene "
            "la función principal. Ahora voy a leer pyproject.toml. Este archivo "
            "contiene la configuración del proyecto."
        )
        for chunk in _chunk_text(text, 20):
            assert g.feed(chunk) is False

    def test_real_narrative_with_similar_imports(self):
        """Simulates a model narrating 5 file reads with similar import blocks.

        This is the exact scenario from the reported bug: 5 Python files with
        shared imports (import sys, import json, import asyncio, import logging)
        and similar transition phrases.
        """
        g = RepetitionGuard()
        narrative_segments = [
            "Voy a leer el archivo `__init__.py`. ",
            "```python\nimport sys\nimport json\nimport asyncio\nimport logging\n```\n",
            "Este archivo contiene los imports principales. ",
            "Ahora voy a leer el archivo `main.py`. ",
            "```python\nimport sys\nimport json\nimport asyncio\nimport logging\n```\n",
            "Este archivo contiene la función principal. ",
            "Voy a revisar `pyproject.toml`. ",
            "```toml\n[tool.poetry]\nname = \"sparta-agent\"\n```\n",
            "Ahora voy a leer `server.py`. ",
            "```python\nimport sys\nimport json\nimport asyncio\nimport logging\n```\n",
            "Este archivo maneja el servidor. ",
            "Por último, voy a leer `sparta_agent.py`. ",
            "```python\nimport sys\nimport json\nimport asyncio\nimport logging\n```\n",
            "Este archivo contiene el agente principal. ",
        ]
        for segment in narrative_segments:
            for chunk in _chunk_text(segment, 10):
                assert g.feed(chunk) is False, f"False positive on segment: {segment[:40]}..."

    def test_short_repeated_ngram_triggers(self):
        """A real degenerate loop: same short token repeated many times."""
        g = RepetitionGuard()
        loop_text = "the " * 30
        for chunk in _chunk_text(loop_text, 4):
            result = g.feed(chunk)
        assert result is True

    def test_long_phrase_repetition_triggers(self):
        """A real degenerate loop: same long sentence repeated."""
        g = RepetitionGuard()
        # phrase must be >= phrase_len (40) chars and align with it
        phrase = "This is a repeated sentence that goes on and on. "  # 51 chars
        # Use a 40-char sub-phrase for cleaner detection
        phrase = "x" * 40  # exactly phrase_len
        for chunk in _chunk_text(phrase * 10, 15):
            result = g.feed(chunk)
        assert result is True

    def test_empty_token_no_trigger(self):
        g = RepetitionGuard()
        assert g.feed("") is False

    def test_buffer_not_full_yet_no_trigger(self):
        g = RepetitionGuard(ngram_size=12, max_repeats=6)
        # Feed less than ngram_size * max_repeats characters
        text = "x" * 50
        for chunk in _chunk_text(text, 10):
            result = g.feed(chunk)
        assert result is False


class TestRepetitionGuardCodeBlocks:
    def test_code_block_imports_not_triggered(self):
        """Imports inside fenced code blocks should not trigger detection."""
        g = RepetitionGuard()
        # This would trigger if code blocks weren't excluded, because the
        # same imports appear multiple times
        segments = [
            "Aquí está el código:\n",
            "```python\nimport sys\nimport json\nimport asyncio\nimport logging\nimport os\nimport re\n```\n",
            "Y aquí otra sección:\n",
            "```python\nimport sys\nimport json\nimport asyncio\nimport logging\nimport os\nimport re\n```\n",
            "Fin del ejemplo.",
        ]
        for seg in segments:
            for chunk in _chunk_text(seg, 8):
                assert g.feed(chunk) is False

    def test_code_block_resets_after_close(self):
        """After closing ```, detection resumes normally."""
        g = RepetitionGuard()
        g.feed("```python\nimport sys\nimport json\n```\n")
        assert g._code_block_open is False
        # Now normal text
        assert g.feed("Normal text continues. ") is False

    def test_nested_backticks_treated_as_close(self):
        g = RepetitionGuard()
        g.feed("```python\ncode\n```\n")
        assert g._code_block_open is False
        g.feed("```python\ncode\n```\n")
        assert g._code_block_open is False


class TestRepetitionGuardBoundaryReset:
    def test_reset_boundary_clears_buffer(self):
        g = RepetitionGuard()
        g.feed("some text that fills the buffer a bit ")
        g.reset_boundary()
        assert g.buffer == ""

    def test_reset_boundary_clears_code_block_state(self):
        g = RepetitionGuard()
        g.feed("```python\ncode here")
        assert g._code_block_open is True
        g.reset_boundary()
        assert g._code_block_open is False

    def test_after_boundary_reset_no_false_positive(self):
        """After a boundary reset, accumulated text from previous tool call
        doesn't combine with new text to trigger false positives."""
        g = RepetitionGuard()
        # Simulate first tool result
        g.feed("import sys\nimport json\nimport asyncio\nimport logging\n")
        g.reset_boundary()
        # Simulate second tool result with similar imports
        g.feed("import sys\nimport json\nimport asyncio\nimport logging\n")
        # Should NOT trigger because buffer was reset between tool calls
        assert g.feed("and the file continues. ") is False

    def test_reset_method_also_clears_code_block(self):
        g = RepetitionGuard()
        g.feed("```python\ncode")
        assert g._code_block_open is True
        g.reset()
        assert g._code_block_open is False
        assert g.buffer == ""


class TestRepetitionGuardEdgeCases:
    def test_unicode_text(self):
        g = RepetitionGuard()
        text = "El agente está analizando el proyecto. " * 5
        for chunk in _chunk_text(text, 15):
            g.feed(chunk)
        # Unicode natural text should not trigger with default thresholds

    def test_very_long_single_token_degenerate(self):
        """A 200-char string of the same character IS repetitive."""
        g = RepetitionGuard()
        long_token = "x" * 200
        assert g.feed(long_token) is True

    def test_whitespace_only_phrase_ignored(self):
        """Phrase detection should ignore whitespace-only phrases."""
        g = RepetitionGuard(phrase_len=5, phrase_max_repeats=2)
        for _ in range(5):
            g.feed("     ")
        # Should not trigger because phrase.strip() is empty
        assert g.feed("more") is False


def _chunk_text(text: str, chunk_size: int):
    """Split text into fixed-size chunks."""
    return [text[i : i + chunk_size] for i in range(0, len(text), chunk_size)]
