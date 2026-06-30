import pytest

from sparta_ai.streaming.think_scrubber import StreamingThinkScrubber


class TestStreamingThinkScrubber:
    def test_simple_think_block(self):
        scrubber = StreamingThinkScrubber()
        v, r = scrubber.feed("<think>reasoning here</think>visible answer")
        assert r == "reasoning here"
        assert v == "visible answer"

    def test_split_open_tag_across_chunks(self):
        scrubber = StreamingThinkScrubber()
        v1, r1 = scrubber.feed("<thin")
        assert v1 == ""
        assert r1 == ""
        v2, r2 = scrubber.feed("king>inside</think>out")
        assert r2 == "inside"
        assert v2 == "out"

    def test_close_tag_split_across_chunks(self):
        scrubber = StreamingThinkScrubber()
        v1, r1 = scrubber.feed("<think>inside</thi")
        assert r1 == "inside"
        assert v1 == ""
        v2, r2 = scrubber.feed("nk>visible")
        assert r2 == ""
        assert v2 == "visible"

    def test_no_tag_passes_through(self):
        scrubber = StreamingThinkScrubber()
        v, r = scrubber.feed("just normal content")
        assert v == "just normal content"
        assert r == ""

    def test_think_tag_mid_line_not_detected(self):
        scrubber = StreamingThinkScrubber()
        v, r = scrubber.feed("some text <think> not a think block")
        assert "<think> not a think block" in v
        assert r == ""

    def test_flush_releases_retained_partial_tag(self):
        scrubber = StreamingThinkScrubber()
        scrubber.feed("<thi")
        assert scrubber.flush() == "<thi"

    @pytest.mark.parametrize("tag", ["think", "thinking", "reasoning"])
    def test_accepts_all_tag_variants(self, tag):
        scrubber = StreamingThinkScrubber()
        v, r = scrubber.feed(f"<{tag}>secret</{tag}>public")
        assert r == "secret"
        assert v == "public"
