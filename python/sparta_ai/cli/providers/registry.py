"""
Provider registry — canonical list of supported AI providers.

Extracted from the original PROVIDER_REGISTRY dict in cli.py.
"""

from typing import Any

PROVIDER_REGISTRY: dict[str, dict[str, Any]] = {
    "anthropic":  {"env": "ANTHROPIC_API_KEY",  "vendors": ["anthropic"], "models": ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"]},
    "openai":     {"env": "OPENAI_API_KEY",     "vendors": ["openai"],    "models": ["gpt-4o", "gpt-4o-mini", "o3", "o3-mini"]},
    "google":     {"env": "GOOGLE_API_KEY",     "vendors": ["google", "google_genai", "gemini"], "models": ["gemini-2.5-pro", "gemini-2.5-flash"]},
    "ollama":     {"env": None,                  "vendors": ["ollama"],    "models": ["llama3.1", "qwen2.5", "mistral"]},
    "deepseek":   {"env": "DEEPSEEK_API_KEY",   "vendors": ["deepseek"],  "models": ["deepseek-chat", "deepseek-reasoner"]},
    "openrouter": {"env": "OPENROUTER_API_KEY",  "vendors": ["openrouter"], "models": []},
    "groq":       {"env": "GROQ_API_KEY",        "vendors": ["groq"],      "models": ["llama-3.3-70b-versatile"]},
    "mistral":    {"env": "MISTRAL_API_KEY",     "vendors": ["mistral"],   "models": ["mistral-large-latest"]},
    "lmstudio":   {"env": None,                  "vendors": ["lmstudio"],  "models": []},
    "llamacpp":   {"env": None,                  "vendors": ["llamacpp"],  "models": []},
}


def resolve_provider(provider_name: str) -> dict[str, Any] | None:
    """Return the provider info dict, or None if unknown."""
    return PROVIDER_REGISTRY.get(provider_name.lower())


def get_api_key(provider_key: str | None = None) -> str | None:
    """Resolve an API key from the explicit arg or from common env vars."""
    if provider_key:
        return provider_key
    for var in ("ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY"):
        val = __import__("os").environ.get(var)
        if val:
            return val
    return None