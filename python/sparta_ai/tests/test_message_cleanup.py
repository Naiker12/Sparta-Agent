"""Tests for message cleanup utilities."""

import pytest

from sparta_ai.agents.message_cleanup import (
    copy_reasoning_content_for_api,
    drop_thinking_only_and_merge_users,
    format_reasoning_for_provider,
)


class TestDropThinkingOnlyAndMergeUsers:
    def test_drops_thinking_only_assistant_turn(self):
        messages = [
            {"role": "user", "content": "hola"},
            {"role": "assistant", "content": "", "reasoning_content": "pensando"},
            {"role": "user", "content": "seguimos"},
        ]
        result = drop_thinking_only_and_merge_users(messages)
        # The thinking-only assistant turn is dropped and the adjacent user turns are merged.
        assert len(result) == 1
        assert result[0]["role"] == "user"
        assert "hola" in result[0]["content"]
        assert "seguimos" in result[0]["content"]

    def test_keeps_assistant_with_content(self):
        messages = [
            {"role": "user", "content": "hola"},
            {"role": "assistant", "content": "respuesta", "reasoning_content": "pensando"},
        ]
        result = drop_thinking_only_and_merge_users(messages)
        assert len(result) == 2
        assert result[1]["role"] == "assistant"


class TestCopyReasoningContentForApi:
    def test_anthropic_keeps_reasoning_content(self):
        messages = [
            {"role": "assistant", "content": "respuesta", "reasoning": "razonamiento"},
        ]
        result = copy_reasoning_content_for_api(messages, "anthropic")
        assert result[0]["reasoning_content"] == "razonamiento"

    def test_deepseek_requires_reasoning_content(self):
        messages = [
            {"role": "assistant", "content": "respuesta"},
        ]
        result = copy_reasoning_content_for_api(messages, "deepseek")
        assert result[0]["reasoning_content"] == " "

    def test_mistral_removes_reasoning_content(self):
        messages = [
            {"role": "assistant", "content": "respuesta", "reasoning_content": "razonamiento"},
        ]
        result = copy_reasoning_content_for_api(messages, "mistral")
        assert "reasoning_content" not in result[0]


class TestFormatReasoningForProvider:
    def test_anthropic_converts_to_content_blocks(self):
        messages = [
            {"role": "user", "content": "hola"},
            {"role": "assistant", "content": "respuesta", "reasoning_content": "razonamiento previo"},
        ]
        result = format_reasoning_for_provider(messages, "anthropic")
        assistant = result[1]
        assert assistant["content"] == [
            {"type": "thinking", "thinking": "razonamiento previo"},
            {"type": "text", "text": "respuesta"},
        ]
        assert "reasoning_content" not in assistant
        assert "reasoning" not in assistant

    def test_deepseek_keeps_reasoning_content(self):
        messages = [
            {"role": "assistant", "content": "respuesta", "reasoning_content": "razonamiento"},
        ]
        result = format_reasoning_for_provider(messages, "deepseek")
        assert result[0]["reasoning_content"] == "razonamiento"

    def test_mistral_removes_reasoning(self):
        messages = [
            {"role": "assistant", "content": "respuesta", "reasoning_content": "razonamiento"},
        ]
        result = format_reasoning_for_provider(messages, "mistral")
        assert result[0]["content"] == "respuesta"
        assert "reasoning_content" not in result[0]

    def test_user_messages_unchanged(self):
        messages = [
            {"role": "user", "content": "hola", "reasoning_content": "no debería pasar nada"},
        ]
        result = format_reasoning_for_provider(messages, "anthropic")
        assert result[0]["content"] == "hola"
