"""Transport registry — factory function that maps vendor names to transports."""
from sparta_ai.config.providers.anthropic_transport import AnthropicTransport
from sparta_ai.config.providers.azure_transport import AzureOpenAITransport
from sparta_ai.config.providers.base import ProviderTransport
from sparta_ai.config.providers.google_transport import GoogleTransport
from sparta_ai.config.providers.ollama_transport import OllamaTransport
from sparta_ai.config.providers.openai_compatible import OpenAICompatibleTransport


def _get_transport(vendor: str) -> ProviderTransport:
    vendor = vendor.lower()
    if vendor == "anthropic":
        return AnthropicTransport()
    if vendor == "ollama":
        return OllamaTransport()
    if vendor in ("google", "google_genai", "gemini"):
        return GoogleTransport()
    if vendor == "azure":
        return AzureOpenAITransport()
    if vendor in (
        "openai",
        "groq",
        "mistral",
        "deepseek",
        "together",
        "fireworks",
        "openrouter",
        "cohere",
        "perplexity",
        "xai",
        "nvidia",
        "lmstudio",
        "llamacpp",
        "custom",
    ):
        return OpenAICompatibleTransport(vendor)
    raise ValueError(f"Unknown vendor/provider: {vendor}")