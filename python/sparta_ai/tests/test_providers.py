import pytest
import sys
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from sparta_ai.config.providers import OpenAICompatibleTransport, build_llm


@pytest.mark.parametrize(
    ("vendor", "reasoning_enabled", "reasoning_budget", "expected_temp", "expected_max"),
    [
        ("anthropic", True, 8000, 1, 12096),
        ("anthropic", True, 16000, 1, 20096),
        ("anthropic", False, 8000, 0.7, 4096),
        ("openai", True, 8000, 0.7, 4096),
        ("openai", False, 8000, 0.7, 4096),
        ("deepseek", True, 8000, 0.7, 4096),
        ("groq", False, 8000, 0.7, 4096),
    ],
)
def test_build_llm_sets_correct_temperature_and_max_tokens(
    vendor, reasoning_enabled, reasoning_budget, expected_temp, expected_max,
):
    mock_transport = MagicMock()
    with patch("sparta_ai.config.providers._get_transport", return_value=mock_transport):
        build_llm(
            model="test-model",
            provider=vendor,
            reasoning_enabled=reasoning_enabled,
            reasoning_budget=reasoning_budget,
            api_key="sk-test",
        )

    args, kwargs = mock_transport.build_llm.call_args
    assert kwargs["model"] == "test-model"
    assert kwargs["api_key"] == "sk-test"
    assert kwargs["reasoning_enabled"] == reasoning_enabled
    assert kwargs["reasoning_budget"] == reasoning_budget

    assert kwargs.get("temperature") == expected_temp, (
        f"vendor={vendor} reasoning={reasoning_enabled}: "
        f"expected temperature={expected_temp}, got {kwargs.get('temperature')}"
    )
    assert kwargs.get("max_tokens") == expected_max, (
        f"vendor={vendor} reasoning={reasoning_enabled}: "
        f"expected max_tokens={expected_max}, got {kwargs.get('max_tokens')}"
    )
    assert kwargs.get("streaming") is True


def test_openrouter_reasoning_uses_extra_body():
    chat_openai = MagicMock(return_value="llm")
    fake_module = SimpleNamespace(ChatOpenAI=chat_openai)

    with patch.dict(sys.modules, {"langchain_openai": fake_module}):
        llm = OpenAICompatibleTransport("openrouter").build_llm(
            model="google/gemini-2.5-flash:free",
            api_key="sk-test",
            reasoning_enabled=True,
            reasoning_budget=2048,
            extra_body={"provider": {"allow_fallbacks": True}},
        )

    assert llm == "llm"
    kwargs = chat_openai.call_args.kwargs
    assert kwargs["base_url"] == "https://openrouter.ai/api/v1"
    assert kwargs["extra_body"]["provider"] == {"allow_fallbacks": True}
    assert kwargs["extra_body"]["reasoning"] == {"max_tokens": 2048}
    # When budget > 0, only max_tokens is set (effort is implied by max_tokens).
    # OpenRouter rejects the request if both max_tokens and effort are specified.
