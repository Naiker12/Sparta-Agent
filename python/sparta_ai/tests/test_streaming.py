import json
from unittest.mock import MagicMock, patch

import pytest

from sparta_ai.streaming.event_bridge import _emit, stream_agent_to_electron


class TestEventBridge:
    @pytest.mark.asyncio
    async def test_stream_basic_events(self):
        mock_graph = MagicMock()
        mock_graph.astream_events.return_value = _mock_event_stream(
            [
                {"event": "on_chat_model_start", "data": {}, "name": ""},
                {
                    "event": "on_chat_model_stream",
                    "data": {"chunk": _mock_chunk("Hello")},
                    "name": "",
                },
                {
                    "event": "on_chat_model_end",
                    "data": {"output": _mock_output(10, 20)},
                    "name": "",
                },
                {"event": "on_chain_end", "data": {}, "name": "agent"},
            ]
        )

        with patch("sparta_ai.streaming.event_bridge._emit") as mock_emit:
            await stream_agent_to_electron(mock_graph, {}, "req_001")
            assert mock_emit.call_count >= 3

    @pytest.mark.asyncio
    async def test_stream_thinking_tokens(self):
        mock_graph = MagicMock()
        thinking_block = [{"type": "thinking", "thinking": "Let me think..."}]
        mock_graph.astream_events.return_value = _mock_event_stream(
            [
                {
                    "event": "on_chat_model_stream",
                    "data": {"chunk": _mock_chunk(thinking_block)},
                    "name": "",
                },
                {"event": "on_chain_end", "data": {}, "name": "agent"},
            ]
        )

        with patch("sparta_ai.streaming.event_bridge._emit") as mock_emit:
            await stream_agent_to_electron(mock_graph, {}, "req_001")
            thinking_calls = [c for c in mock_emit.call_args_list if c[0][1] == "thinking:token"]
            assert len(thinking_calls) > 0

    @pytest.mark.asyncio
    async def test_stream_reasoning_content_from_metadata(self):
        """OpenAI-compatible providers (DeepSeek/OpenRouter) expose reasoning in metadata."""
        mock_graph = MagicMock()
        chunk = _mock_chunk("Answer part")
        chunk.additional_kwargs = {"reasoning_content": "Step one..."}
        mock_graph.astream_events.return_value = _mock_event_stream(
            [
                {"event": "on_chat_model_stream", "data": {"chunk": chunk}, "name": ""},
                {"event": "on_chain_end", "data": {}, "name": "agent"},
            ]
        )

        with patch("sparta_ai.streaming.event_bridge._emit") as mock_emit:
            await stream_agent_to_electron(mock_graph, {}, "req_001")
            events = [c[0][1] for c in mock_emit.call_args_list]
            assert "thinking:started" in events
            assert "thinking:token" in events
            # When reasoning comes from metadata, the same chunk's content string
            # is skipped to avoid emitting duplicated text.
            assert "stream:token" not in events

    @pytest.mark.asyncio
    async def test_stream_tool_events(self):
        mock_graph = MagicMock()
        mock_graph.astream_events.return_value = _mock_event_stream(
            [
                {
                    "event": "on_tool_start",
                    "data": {"input": {"query": "test"}},
                    "name": "web_search",
                },
                {
                    "event": "on_tool_end",
                    "data": {"output": "result", "run_time_ms": 150},
                    "name": "web_search",
                },
                {"event": "on_chain_end", "data": {}, "name": "agent"},
            ]
        )

        with patch("sparta_ai.streaming.event_bridge._emit") as mock_emit:
            await stream_agent_to_electron(mock_graph, {}, "req_001")
            events = [c[0][1] for c in mock_emit.call_args_list]
            assert "tool:called" in events
            assert "tool:result" in events

    @pytest.mark.asyncio
    async def test_stream_inline_think_tags(self):
        """Models without structured reasoning emit <think> tags inside content."""
        mock_graph = MagicMock()
        mock_graph.astream_events.return_value = _mock_event_stream(
            [
                {
                    "event": "on_chat_model_stream",
                    "data": {"chunk": _mock_chunk("<think>Let me reason")},
                    "name": "",
                },
                {
                    "event": "on_chat_model_stream",
                    "data": {"chunk": _mock_chunk("ing...</think>Answer")},
                    "name": "",
                },
                {
                    "event": "on_chat_model_end",
                    "data": {"output": _mock_output(10, 20)},
                    "name": "",
                },
                {"event": "on_chain_end", "data": {}, "name": "agent"},
            ]
        )

        with patch("sparta_ai.streaming.event_bridge._emit") as mock_emit:
            await stream_agent_to_electron(mock_graph, {}, "req_001")
            events = [c[0][1] for c in mock_emit.call_args_list]
            assert events.count("thinking:started") == 1
            thinking_tokens = [
                c[0][2].get("token", "")
                for c in mock_emit.call_args_list
                if c[0][1] == "thinking:token"
            ]
            assert "".join(thinking_tokens) == "Let me reasoning..."
            content_tokens = [
                c[0][2].get("token", "")
                for c in mock_emit.call_args_list
                if c[0][1] == "stream:token"
            ]
            assert "".join(content_tokens) == "Answer"
            assert "thinking:completed" in events

    @pytest.mark.asyncio
    async def test_stream_error_handling(self):
        mock_graph = MagicMock()
        mock_graph.astream_events.side_effect = RuntimeError("Stream failed")

        with patch("sparta_ai.streaming.event_bridge._emit") as mock_emit:
            await stream_agent_to_electron(mock_graph, {}, "req_001")
            error_calls = [c for c in mock_emit.call_args_list if c[0][1] == "error"]
            assert len(error_calls) > 0

    def test_emit_format(self):
        with patch("sys.stdout.write") as mock_write, patch("sys.stdout.flush"):
            _emit("req_001", "stream_token", {"token": "Hello"})
            written = mock_write.call_args[0][0]
            msg = json.loads(written)
            assert msg["id"] == "req_001"
            assert msg["event"] == "stream_token"
            assert msg["data"]["token"] == "Hello"


def _mock_event_stream(events: list):
    async def gen():
        for e in events:
            yield e

    return gen()


def _mock_chunk(content):
    chunk = MagicMock()
    chunk.content = content
    return chunk


def _mock_output(input_tokens, output_tokens):
    output = MagicMock()
    output.usage_metadata = MagicMock()
    output.usage_metadata.input_tokens = input_tokens
    output.usage_metadata.output_tokens = output_tokens
    return output
