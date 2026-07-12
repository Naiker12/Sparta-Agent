"""
Interactive provider configuration flow.

Extracted from _configure_provider in cli.py.
Now uses ``providers.catalog.json`` (via ``load_catalog``) instead of the
old hardcoded ``PROVIDER_REGISTRY`` dict.

When available, fetches models live from the vendor API instead of using
static lists.
"""

from __future__ import annotations

import os
from typing import Any

import typer
from rich.console import Console
from rich.table import Table

from sparta_ai.cli.theme import BRONZE, GOLD, GOLD_MUTED, MUTED, SUCCESS, WARNING, ERROR
from sparta_ai.cli.providers.catalog import load_catalog, resolve_env_key
from sparta_ai.cli.providers.models import list_models_live
from sparta_ai.cli.providers.credentials import get_key, save_key

console = Console()


async def provider_setup_flow(
    initial_provider: str | None = None,
    initial_key: str | None = None,
) -> tuple[str, str, str, str | None]:
    """Interactive provider configuration. Returns (provider, vendor, model, api_key).

    Uses the unified catalog so all 18 vendors from the JSON file are shown.
    Models are fetched live from the vendor API when possible.
    """
    from prompt_toolkit import PromptSession
    from prompt_toolkit.completion import WordCompleter

    catalog = load_catalog()
    vendors = list(catalog.keys())

    psession = PromptSession(completer=WordCompleter(vendors, ignore_case=True))

    table = Table(title="Providers Disponibles", border_style=BRONZE, title_style=f"bold {GOLD}")
    table.add_column("#", style=f"bold {GOLD}", width=3)
    table.add_column("Provider", style="bold")
    table.add_column("Tipo", justify="left")
    table.add_column("Estado", justify="left")

    for i, vendor in enumerate(vendors, 1):
        entry = catalog[vendor]
        has_key = bool(resolve_env_key(vendor))
        local = entry["kind"] == "local"
        if has_key:
            status = f"[{SUCCESS}]✓ configurado[/]"
        elif local:
            status = f"[dim]local[/]"
        else:
            status = f"[{WARNING}]sin key[/]"
        table.add_row(
            str(i),
            entry["label"],
            entry["kind"],
            status,
        )

    console.print()
    console.print(table)
    console.print()

    # ── Select vendor ───────────────────────────────────────────────
    while True:
        try:
            raw = await psession.prompt_async(f"[{GOLD}]Provider#[/] > ")
        except (EOFError, KeyboardInterrupt):
            console.print(f"\n[{WARNING}]Cancelado[/{WARNING}]")
            raise typer.Exit(0)

        raw = raw.strip()
        if not raw:
            continue

        if raw.isdigit() and 1 <= int(raw) <= len(vendors):
            selected = vendors[int(raw) - 1]
            break
        if raw.lower() in catalog:
            selected = raw.lower()
            break
        console.print(f"[{ERROR}]Opción inválida: {raw}[/{ERROR}]")

    entry = catalog[selected]
    vendor = selected
    # TODO: azure needs endpoint/version, not just a key
    # For now we use the vendor name as-is; config/providers.py handles it.

    # ── API key ─────────────────────────────────────────────────────
    api_key = initial_key
    if entry["kind"] == "cloud" and entry.get("env"):
        # Try env var first, then keychain, then prompt
        env_var = entry["env"]
        env_val = os.environ.get(env_var)
        if env_val:
            api_key = env_val
            console.print(f"[{SUCCESS}]✓ {env_var} encontrado en entorno[/{SUCCESS}]")
        else:
            keychain_val = get_key(vendor)
            if keychain_val:
                api_key = keychain_val
                console.print(f"[{SUCCESS}]✓ Key recuperada del keychain del SO[/{SUCCESS}]")
            else:
                console.print(f"[{WARNING}]No se encontró {env_var}[/{WARNING}]")
                try:
                    key_input = await psession.prompt_async("API Key> ", is_password=True)
                except (EOFError, KeyboardInterrupt):
                    console.print(f"\n[{WARNING}]Cancelado[/{WARNING}]")
                    raise typer.Exit(0)
                api_key = key_input.strip() if key_input else None

                if api_key:
                    try:
                        save_key(vendor, api_key)
                        console.print(
                            f"[{SUCCESS}]✓ Key guardada en keychain del SO[/{SUCCESS}]"
                        )
                    except Exception:
                        # keyring not installed — that's fine, just use it
                        # for this session.
                        pass

    # ── Live or static model list ────────────────────────────────────
    models = await list_models_live(vendor, api_key)

    if not models:
        # Fallback static list from the catalog is empty for local/unlisted
        models = ["default"]

    model = models[0] if models else "default"

    if len(models) > 1:
        model_table = Table(
            title=f"Modelos — {entry['label']}",
            border_style=BRONZE,
            title_style=f"bold {GOLD}",
        )
        model_table.add_column("#", style=f"bold {GOLD}", width=3)
        model_table.add_column("Modelo", style="bold")
        for i, m in enumerate(models, 1):
            model_table.add_row(str(i), m)
        console.print()
        console.print(model_table)
        console.print()

        try:
            model_raw = await psession.prompt_async(f"Modelo #{1}> ")
        except (EOFError, KeyboardInterrupt):
            model_raw = ""
        model_raw = model_raw.strip()
        if model_raw.isdigit() and 1 <= int(model_raw) <= len(models):
            model = models[int(model_raw) - 1]
        elif model_raw and model_raw in models:
            model = model_raw

    console.print(
        f"\n[{SUCCESS}]✓ Provider: {selected} | Vendor: {vendor} | Modelo: {model}[/{SUCCESS}]\n"
    )
    return selected, vendor, model, api_key