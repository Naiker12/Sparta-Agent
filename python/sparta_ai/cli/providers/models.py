"""
Live model listing for AI providers.

Mirrors the frontend pattern in ``src/services/ai/transports/*.transport.ts``
where `listModels()` fetches from the vendor's API instead of using
hardcoded lists.

Each provider function returns a list of model ID strings.  If the live
fetch fails (no internet, bad key, endpoint down), a static fallback
list is returned so the CLI never crashes.
"""

from __future__ import annotations

import logging
from typing import Any

import httpx

from sparta_ai.cli.providers.catalog import load_catalog, resolve_env_key

logger = logging.getLogger("sparta_ai.cli.providers.models")

# ── Static fallback lists ─────────────────────────────────────────────
# These are used when the live fetch fails or for local-only vendors.
_FALLBACK_MODELS: dict[str, list[str]] = {
    "anthropic":  ["claude-sonnet-4-6", "claude-opus-4-6", "claude-haiku-4-5"],
    "openai":     ["gpt-4o", "gpt-4o-mini", "o3", "o3-mini"],
    "google":     ["gemini-2.5-pro", "gemini-2.5-flash"],
    "ollama":     ["llama3.1", "qwen2.5", "mistral"],
    "deepseek":   ["deepseek-chat", "deepseek-reasoner"],
    "openrouter": [],
    "groq":       ["llama-3.3-70b-versatile"],
    "mistral":    ["mistral-large-latest"],
    "lmstudio":   [],
    "llamacpp":   [],
}


async def list_models_live(vendor: str, api_key: str | None = None) -> list[str]:
    """Fetch available models for *vendor* from its live API endpoint.

    Returns a list of model ID strings.  On failure, falls back to the
    static ``_FALLBACK_MODELS`` list.
    """
    catalog = load_catalog()
    entry = catalog.get(vendor)
    if not entry:
        return _fallback(vendor)

    base_url = entry.get("base_url")
    if not base_url:
        # Vendors like Anthropic/OpenAI/Google have separate API shapes.
        return await _fetch_known_non_openai(vendor, api_key)

    # OpenAI-compatible endpoint → GET /v1/models
    return await _fetch_openai_compatible(vendor, base_url, api_key)


async def _fetch_openai_compatible(vendor: str, base_url: str, api_key: str | None) -> list[str]:
    """Fetch models via GET <base_url>/models (OpenAI-compatible shape)."""
    headers = {"Authorization": f"Bearer {api_key}"} if api_key else {}
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            url = f"{base_url.rstrip('/')}/models"
            res = await client.get(url, headers=headers)
            res.raise_for_status()
            data = res.json()
            models = [m.get("id") or m.get("name", "") for m in data.get("data", [])]
            if models:
                return models
    except Exception as exc:
        logger.debug("Live model fetch failed for %s: %s", vendor, exc)
    return _fallback(vendor)


async def _fetch_known_non_openai(vendor: str, api_key: str | None) -> list[str]:
    """Handle vendors with non-standard /v1/models endpoints (Anthropic, Google, etc.)."""
    # Anthropic — GET /v1/models (returns an "id" per model)
    if vendor == "anthropic":
        headers = {"x-api-key": api_key, "anthropic-version": "2023-06-01"} if api_key else {}
        try:
            async with httpx.AsyncClient(timeout=5) as client:
                res = await client.get("https://api.anthropic.com/v1/models", headers=headers)
                res.raise_for_status()
                data = res.json()
                models = [m["id"] for m in (data.get("data") or []) if "id" in m]
                if models:
                    return models
        except Exception as exc:
            logger.debug("Anthropic live model fetch failed: %s", exc)
        return _fallback(vendor)

    # Google — Gemini models via the AI Studio list
    if vendor == "google":
        # Google doesn't have a simple /v1/models that returns a flat list
        # in the same shape; fallback to static.
        return _fallback(vendor)

    # Ollama — GET /api/tags
    if vendor == "ollama":
        try:
            async with httpx.AsyncClient(timeout=3) as client:
                res = await client.get("http://localhost:11434/api/tags")
                res.raise_for_status()
                data = res.json()
                models = [m["name"] for m in (data.get("models") or []) if "name" in m]
                if models:
                    return models
        except Exception as exc:
            logger.debug("Ollama live model fetch failed: %s", exc)
        return _fallback(vendor)

    return _fallback(vendor)


def _fallback(vendor: str) -> list[str]:
    """Return the hardcoded fallback list for *vendor*."""
    return _FALLBACK_MODELS.get(vendor, [])