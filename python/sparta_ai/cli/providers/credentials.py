"""
Credential management for Sparta CLI.

Uses the OS keychain (via ``keyring``) so API keys persist between
sessions without requiring the user to type them every time.

This is separate from Electron's ``safeStorage`` vault because a standalone
Python process cannot decrypt Electron-encrypted blobs.  The pattern here
is what Hermes CLI uses for credential rotation.

Environment variables always take precedence over the keychain:
    - If ``ANTHROPIC_API_KEY`` is set, use that.
    - Otherwise check the keychain for ``sparta-cli / ANTHROPIC_API_KEY``.
"""

from __future__ import annotations

import logging
import os
from typing import Optional

from sparta_ai.cli.providers.catalog import load_catalog

logger = logging.getLogger("sparta_ai.cli.providers.credentials")

SERVICE_NAME = "sparta-cli"

# In-memory cache: already-resolved keys so we don't hit the keychain
# on every prompt_toolkit redraw.
_key_cache: dict[str, str | None] = {}


def get_key(vendor: str) -> str | None:
    """Resolve an API key for *vendor*.

    Priority:
        1. Environment variable (from catalog entry ``env``)
        2. OS keychain (``keyring``)
        3. ``None``
    """
    # 1. Check cache first (avoids hitting env/keychain on every call)
    if vendor in _key_cache:
        return _key_cache[vendor]

    catalog = load_catalog()
    entry = catalog.get(vendor)
    if not entry:
        return None

    env_var: str | None = entry.get("env")
    if not env_var:
        # Local vendors (ollama, lmstudio, llamacpp, custom) don't need keys.
        _key_cache[vendor] = None
        return None

    # 2. Environment variable (highest priority)
    env_val = os.environ.get(env_var)
    if env_val:
        _key_cache[vendor] = env_val
        return env_val

    # 3. OS keychain
    try:
        import keyring
        key_val = keyring.get_password(SERVICE_NAME, env_var)
        if key_val:
            _key_cache[vendor] = key_val
            return key_val
    except ImportError:
        logger.debug("keyring not installed; skipping OS keychain lookup")
    except Exception as exc:
        logger.debug("keyring lookup failed for %s: %s", env_var, exc)

    _key_cache[vendor] = None
    return None


def save_key(vendor: str, key_value: str) -> None:
    """Persist an API key for *vendor* in the OS keychain.

    Does *not* set the environment variable — that's the user's responsibility
    if they want to override the keychain.
    """
    catalog = load_catalog()
    entry = catalog.get(vendor)
    if not entry:
        raise ValueError(f"Unknown vendor: {vendor}")

    env_var = entry.get("env")
    if not env_var:
        raise ValueError(f"Vendor {vendor} does not use an API key (local)")

    try:
        import keyring
        keyring.set_password(SERVICE_NAME, env_var, key_value)
        _key_cache[vendor] = key_value
        logger.info("Saved key for %s (%s) to OS keychain", vendor, env_var)
    except ImportError:
        raise RuntimeError(
            "Cannot save key: `keyring` package is not installed.\n"
            "Install it with: pip install keyring"
        )


def delete_key(vendor: str) -> None:
    """Remove a stored API key for *vendor* from the OS keychain."""
    catalog = load_catalog()
    entry = catalog.get(vendor)
    if not entry:
        return
    env_var = entry.get("env")
    if not env_var:
        return

    try:
        import keyring
        keyring.delete_password(SERVICE_NAME, env_var)
    except keyring.errors.PasswordDeleteError:
        pass  # Key didn't exist — fine.
    except ImportError:
        pass
    _key_cache.pop(vendor, None)


def clear_cache() -> None:
    """Reset the in-memory key cache (e.g. after env var changes)."""
    _key_cache.clear()