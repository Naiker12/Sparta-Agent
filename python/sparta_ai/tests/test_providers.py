import pytest
from unittest.mock import MagicMock, patch

from sparta_ai.config.providers import build_llm


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
