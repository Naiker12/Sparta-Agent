"""
Provider configuration subpackage for Sparta CLI.

Uses the unified ``providers.catalog.json`` as the single source of truth,
replacing the old hardcoded PROVIDER_REGISTRY dict.
"""

from sparta_ai.cli.providers.catalog import load_catalog, resolve_env_key, count_configured, count_local, vendor_count
from sparta_ai.cli.providers.setup import provider_setup_flow
from sparta_ai.cli.providers.models import list_models_live
from sparta_ai.cli.providers.credentials import get_key, save_key, delete_key

__all__ = [
    "load_catalog",
    "resolve_env_key",
    "count_configured",
    "count_local",
    "vendor_count",
    "provider_setup_flow",
    "list_models_live",
    "get_key",
    "save_key",
    "delete_key",
]