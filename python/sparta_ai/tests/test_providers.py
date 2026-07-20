import pytest
import sys
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

from sparta_ai.config.providers import OpenAICompatibleTransport, build_llm
from sparta_ai.config.providers.cache import clear_llm_cache
from sparta_ai.config.providers.registry import _get_transport

pytest.register_assert_rewrite("sparta_ai.tests.test_providers")


@pytest.fixture(autouse=True)
def _clear_llm_cache():
    """Ensure each test starts with a fresh LLM cache."""
    clear_llm_cache()
    yield
    clear_llm_cache()


@pytest.mark.parametrize(
    ("vendor", "reasoning_enabled", "reasoning_budget", "expected_temp", "expected_max"),
    [
        ("anthropic", True, 8000, 1, 12096),
        ("anthropic", True, 16000, 1, 20096),
        ("anthropic", False, 8000, 0.7, 2048),
        ("openai", True, 8000, 0.7, 2048),
        ("openai", False, 8000, 0.7, 2048),
        ("deepseek", True, 8000, 0.7, 2048),
        ("groq", False, 8000, 0.7, 2048),
    ],
)
def test_build_llm_sets_correct_temperature_and_max_tokens(
    vendor, reasoning_enabled, reasoning_budget, expected_temp, expected_max,
):
    mock_transport = MagicMock()
    # Disable cache for this unit test — we want to verify transport.build_llm
    # is called with the right kwargs, not that the cache returns a stale value.
    with patch("sparta_ai.config.providers.factory._get_transport", return_value=mock_transport), \
         patch("sparta_ai.config.providers.factory._llm_cache_get", return_value=None):
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


def test_lmstudio_uses_local_openai_compatible_base_url_without_real_key():
    chat_openai = MagicMock(return_value="llm")
    fake_module = SimpleNamespace(ChatOpenAI=chat_openai)

    with patch.dict(sys.modules, {"langchain_openai": fake_module}):
        llm = OpenAICompatibleTransport("lmstudio").build_llm(
            model="qwen/qwen3-vl-4b",
            api_key=None,
            reasoning_enabled=False,
            reasoning_budget=8000,
            base_url="http://localhost:1234",
        )

    assert llm == "llm"
    kwargs = chat_openai.call_args.kwargs
    assert kwargs["model"] == "qwen/qwen3-vl-4b"
    assert kwargs["api_key"] == "not-needed"
    assert kwargs["base_url"] == "http://localhost:1234/v1"


def test_get_transport_accepts_lmstudio():
    chat_openai = MagicMock(return_value="llm")
    fake_module = SimpleNamespace(ChatOpenAI=chat_openai)

    with patch.dict(sys.modules, {"langchain_openai": fake_module}):
        llm = build_llm(
            model="qwen/qwen3-vl-4b",
            provider="lmstudio",
            vendor="lmstudio",
            api_key=None,
            api_url="http://localhost:1234/v1",
        )

    assert llm == "llm"
    kwargs = chat_openai.call_args.kwargs
    assert kwargs["base_url"] == "http://localhost:1234/v1"
