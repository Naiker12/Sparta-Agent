"""
Welcome banner builder for Sparta CLI (v2 redesign).

Clean, minimal layout inspired by OpenCode:
  - Title line (no ASCII logo by default)
  - Session info panel (compact, 2 columns)
  - Tools/Skills panel (2 columns, grouped by category)
  - Summary line: "N tools · M skills · /help para comandos"
  - Welcome message
  - Optional provider warning panel

All text output uses ``console.print()`` with inline markup — never ``Text()``
with raw markup strings (see v2 spec section 6.1).
"""

from __future__ import annotations

import shutil
from typing import Any

from rich.console import Group
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.rule import Rule

from sparta_ai.cli.theme import ACCENT, ACCENT_DIM, MUTED, OK, WARNING
from sparta_ai.cli.logo import SPARTA_LOGO
from sparta_ai.cli.providers.catalog import count_configured, vendor_count
from sparta_ai.skills.skill_loader import skills_index

VERSION = "0.1.1"

# ── Tool categorization ──────────────────────────────────────────────

TOOL_CATEGORIES: dict[str, list[str]] = {
    "file": ["read_file_tool", "write_file_tool"],
    "memory": ["read_memory_tool", "write_memory_tool"],
    "skills": ["skill_view_tool", "skills_list_tool", "skill_manage_tool"],
    "terminal": ["terminal_execute_tool", "terminal_execute_background_tool"],
    "web": ["web_search_tool"],
}

CATEGORY_LABELS: dict[str, str] = {
    "file": "file",
    "memory": "memory",
    "skills": "skills",
    "terminal": "terminal",
    "web": "web",
}


def _group_tools_by_category(tools: list[Any]) -> list[tuple[str, list[str]]]:
    """Group tool objects by category. Returns [(label, [short_names]), ...]."""
    name_to_cat: dict[str, str] = {}
    for cat, names in TOOL_CATEGORIES.items():
        for n in names:
            name_to_cat[n] = cat

    grouped: dict[str, list[str]] = {}
    for t in tools:
        tname = getattr(t, "name", str(t))
        cat = name_to_cat.get(tname, "other")
        grouped.setdefault(cat, []).append(tname)

    result: list[tuple[str, list[str]]] = []
    for cat in sorted(TOOL_CATEGORIES.keys(), key=lambda c: list(TOOL_CATEGORIES.keys()).index(c)):
        names = grouped.pop(cat, None)
        if names:
            short_names = [n.replace("_tool", "").replace("_", "-") for n in names]
            result.append((CATEGORY_LABELS.get(cat, cat), short_names))
    for cat, names in sorted(grouped.items()):
        result.append((cat, names))
    return result


def _group_skills_by_category(max_per_category: int = 3) -> list[tuple[str, list[str], int]]:
    """Load all skills and group by category.

    Returns [(category, [name, ...], total_count)] where the list is truncated
    to *max_per_category* and total_count is the full count for that category.
    """
    all_skills = skills_index()
    grouped: dict[str, list[str]] = {}
    for s in all_skills:
        cat = s.get("category", "other").lower()
        name = s.get("name", s.get("id", "?"))
        grouped.setdefault(cat, []).append(name)

    result: list[tuple[str, list[str], int]] = []
    for cat in sorted(grouped.keys()):
        names = grouped[cat]
        display = names[:max_per_category]
        result.append((cat, display, len(names)))
    return result


# ── Public builders ───────────────────────────────────────────────────

def print_title(console) -> None:
    """Print the Sparta title line (replaces the ASCII logo as default)."""
    console.print(
        Rule(
            f"[bold {ACCENT}]Sparta Agent[/] [dim {ACCENT_DIM}]v{VERSION}[/]",
            style=ACCENT_DIM,
        )
    )


def print_welcome_banner(
    console,
    model: str,
    provider: str,
    session_id: str,
    tool_count: int,
    cwd: str,
    *,
    tools: list[Any] | None = None,
    skills_count: int = 0,
    mcp_count: int = 0,
    provider_warning: str | None = None,
) -> None:
    """Print the full welcome display: title + session panel + tools/skills + welcome msg.

    All output goes through ``console.print()`` with inline Rich markup.
    No ``Text()`` objects with raw markup strings (see v2 spec 6.1).
    """
    # ── 1. Title line ────────────────────────────────────────────────
    print_title(console)
    console.print()

    # ── 2. Session panel ─────────────────────────────────────────────
    _print_session_panel(console, model, provider, cwd, session_id)

    # ── 3. Tools / Skills panel ──────────────────────────────────────
    _print_tools_skills_panel(console, tools or [], tool_count)

    # ── 4. Summary line ──────────────────────────────────────────────
    total_skills = skills_count if skills_count > 0 else len(skills_index())
    console.print(
        f"[bold {ACCENT}]{tool_count} tools[/] · "
        f"[bold {ACCENT}]{total_skills} skills[/] · "
        f"[dim {MUTED}]/help para comandos[/]"
    )
    console.print()

    # ── 5. Welcome message ───────────────────────────────────────────
    console.print(f"[bold {ACCENT}]Escribí tu mensaje. /help para ver comandos.[/]")
    console.print()

    # ── 6. Provider warning (if any) ─────────────────────────────────
    if provider_warning:
        console.print(
            Panel(
                f"[{WARNING}]⚠ {provider_warning}[/{WARNING}]",
                border_style=WARNING,
                padding=(0, 1),
            )
        )
        console.print()


def _print_session_panel(console, model: str, provider: str, cwd: str, session_id: str) -> None:
    """Print a compact 2-column session info panel."""
    model_short = model.split("/")[-1] if "/" in model else model
    if len(model_short) > 28:
        model_short = model_short[:25] + "..."

    configured = count_configured()
    total = vendor_count()

    table = Table.grid(padding=(0, 4))
    table.add_column("left", justify="left", no_wrap=True)
    table.add_column("right", justify="left", no_wrap=True)

    left = (
        f"[bold {ACCENT}]{model_short}[/] · [dim {MUTED}]{provider}[/]\n"
        f"[dim {MUTED}]Session {session_id}[/]"
    )
    right = (
        f"[dim {MUTED}]{cwd}[/]\n"
        f"[{OK}]{configured}[/] de {total} providers con key"
    )
    table.add_row(left, right)

    console.print(
        Panel(
            table,
            title=f"[dim {ACCENT_DIM}]Sesión[/]",
            border_style=ACCENT_DIM,
            padding=(0, 2),
        )
    )
    console.print()


def _print_tools_skills_panel(console, tools: list[Any], tool_count: int) -> None:
    """Print a 2-column panel: Tools (grouped) | Skills (grouped)."""
    table = Table.grid(padding=(0, 4))
    table.add_column("tools_col", justify="left", no_wrap=True, ratio=1)
    table.add_column("skills_col", justify="left", no_wrap=True, ratio=1)

    # ── Tools column ─────────────────────────────────────────────────
    tool_lines = [f"[bold {ACCENT}]Tools ({tool_count})[/]"]
    if tools:
        grouped = _group_tools_by_category(tools)
        for cat_name, tnames in grouped:
            tool_lines.append(
                f"  [dim {MUTED}]{cat_name}[/]  {', '.join(tnames)}"
            )
    else:
        tool_lines.append(f"  [dim {MUTED}]{tool_count} available[/]")

    # ── Skills column ────────────────────────────────────────────────
    skill_groups = _group_skills_by_category(max_per_category=3)
    total_skills = sum(t for _, _, t in skill_groups)
    skill_lines = [f"[bold {ACCENT}]Skills ({total_skills})[/]"]
    if skill_groups:
        for cat_name, snames, total in skill_groups:
            display = ", ".join(snames)
            if total > 3:
                display += f" [dim {MUTED}]+{total - 3}[/]"
            skill_lines.append(f"  [dim {MUTED}]{cat_name}[/]  {display}")
    else:
        skill_lines.append(f"  [dim {MUTED}]No skills loaded[/]")

    table.add_row("\n".join(tool_lines), "\n".join(skill_lines))

    console.print(
        Panel(
            table,
            border_style=ACCENT_DIM,
            padding=(0, 2),
        )
    )
    console.print()


def build_provider_warning(reason: str) -> Panel:
    """Build a persistent warning panel about provider issues."""
    return Panel(
        f"[{WARNING}]⚠ {reason}[/{WARNING}]",
        border_style=WARNING,
        title="⚠ Provider",
        padding=(0, 1),
    )