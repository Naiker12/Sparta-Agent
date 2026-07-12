"""
Unified provider catalog — single source of truth for all AI vendors.

Reads from ``providers.catalog.json`` at the repo root so that both the
Python CLI and the TypeScript frontend share the same provider list.

Usage::

    from sparta_ai.cli.providers.catalog import load_catalog, resolve_env_key

    catalog = load_catalog()
    for vendor, entry in catalog.items():
        print(vendor, entry["label"], entry["kind"])
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from functools import lru_cache
from typing import Any

# Resolve the repo root: providers.catalog.json lives at the project root.
_REPO_ROOT = Path(__file__).resolve().parents[4]  # python/sparta_ai/cli/providers/ -> 4 levels up
CATALOG_PATH = _REPO_ROOT / "providers.catalog.json"


def _default_catalog() -> dict[str, dict[str, Any]]:
    """Fallback catalog in case the JSON file cannot be read.

    Mirrors the 10 providers from the original PROVIDER_REGISTRY so that
    the CLI never crashes if the file is missing.
    """
    return {
        "anthropic":  {"label": "Anthropic",         "kind": "cloud", "env": "ANTHROPIC_API_KEY",  "base_url": None},
        "openai":     {"label": "OpenAI",             "kind": "cloud", "env": "OPENAI_API_KEY",     "base_url": None},
        "google":     {"label": "Google",             "kind": "cloud", "env": "GOOGLE_API_KEY",     "base_url": None},
        "ollama":     {"label": "Ollama",             "kind": "local", "env": None,                 "base_url": "http://localhost:11434"},
        "deepseek":   {"label": "DeepSeek",           "kind": "cloud", "env": "DEEPSEEK_API_KEY",   "base_url": "https://api.deepseek.com/v1"},
        "openrouter": {"label": "OpenRouter",         "kind": "cloud", "env": "OPENROUTER_API_KEY", "base_url": "https://openrouter.ai/api/v1"},
        "groq":       {"label": "Groq",               "kind": "cloud", "env": "GROQ_API_KEY",       "base_url": "https://api.groq.com/openai/v1"},
        "mistral":    {"label": "Mistral",            "kind": "cloud", "env": "MISTRAL_API_KEY",    "base_url": "https://api.mistral.ai/v1"},
        "lmstudio":   {"label": "LM Studio",          "kind": "local", "env": None,                 "base_url": "http://localhost:1234/v1"},
        "llamacpp":   {"label": "llama.cpp",          "kind": "local", "env": None,                 "base_url": "http://localhost:8080/v1"},
    }


@lru_cache(maxsize=1)
def load_catalog() -> dict[str, dict[str, Any]]:
    """Load the provider catalog from JSON, with a fallback dict."""
    try:
        if CATALOG_PATH.is_file():
            return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
    except Exception:
        pass
    return _default_catalog()


def resolve_env_key(vendor: str) -> str | None:
    """Return the API key for *vendor* from its configured env var, or None."""
    catalog = load_catalog()
    entry = catalog.get(vendor)
    if not entry or not entry.get("env"):
        return None
    return os.environ.get(entry["env"])


def count_configured() -> int:
    """Count how many cloud vendors have a configured API key."""
    catalog = load_catalog()
    count = 0
    for vid, entry in catalog.items():
        if entry["kind"] != "cloud":
            continue
        env_var = entry.get("env")
        if env_var and os.environ.get(env_var):
            count += 1
    return count


def count_local() -> int:
    """Count how many local (no-key) vendors are in the catalog."""
    return sum(1 for e in load_catalog().values() if e.get("kind") == "local")


def vendor_count() -> int:
    """Total configured + local vendors (all that exist in the catalog)."""
    return len(load_catalog())