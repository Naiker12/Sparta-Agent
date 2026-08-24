
"""Pure-Python service layer for MCP server CRUD, consumed by the LLM
tool dispatcher in ``tools.py``.

Every public function returns a **plain string** (JSON or human-readable
error) and never raises ``HTTPException``. The REST routes in
``routes/mcp_servers.py`` delegate to the same validation helpers but
translate errors to HTTP status codes.
"""

from __future__ import annotations

import asyncio
import json
import uuid
from typing import Any, Optional
from urllib.parse import urlparse

from loggers import get_logger

from core.inference.mcp_client import (
    TOOL_CACHE_INVALIDATING_FIELDS,
    cache_tools,
    close_stdio_sessions,
    invalidate_tool_cache,
    is_stdio,
    list_tools_async,
    parse_server_headers,
    parse_stdio_command,
    probe_timeout,
    stdio_mcp_disabled_reason,
    stdio_mcp_enabled,
)
from storage import mcp_servers_db
from utils.utils import safe_curated_detail

logger = get_logger(__name__)


# ── Shared validation helpers ───────────────────────────────────────
# Called by both the REST routes (which translate errors into
# HTTPException) and the tool functions (which return error strings).


def _looks_like_command(value: str) -> bool:
    """Whitespace is a one-way signal: a URL can't hold an unencoded space, so
    a value with whitespace is definitely a command."""
    return any(ch.isspace() for ch in value)


def validate_url(url: str) -> tuple[str, str | None]:
    """Validate and normalise an MCP server address.

    Returns ``(validated_url, None)`` on success, or ``("", error_message)``
    on failure. Same logic as the old ``routes.mcp_servers._validate_url``
    but without raising ``HTTPException``.
    """
    trimmed = (url or "").strip()
    if not trimmed:
        return "", "url must not be empty"
    if stdio_mcp_enabled() and is_stdio(trimmed):
        try:
            parts = parse_stdio_command(trimmed)
        except ValueError:
            return "", "Invalid command. Check quoting and try again."
        if not parts or not parts[0].strip():
            return "", "command must not be empty"
        if "://" in parts[0]:
            return "", (
                "Enter an http(s):// URL, or a local command whose "
                "first token is an executable (not a URL)."
            )
        return trimmed, None
    parsed = urlparse(trimmed)
    if parsed.scheme not in ("http", "https"):
        if _looks_like_command(trimmed):
            return "", stdio_mcp_disabled_reason()
        return "", (
            "MCP server address must start with http:// or https:// "
            "(for example https://example.com/mcp)."
        )
    if not parsed.netloc:
        return "", "url is missing a host"
    return trimmed, None


def normalize_headers(headers: dict[str, str] | None) -> dict[str, str] | None:
    """Trim header names, drop empties, coerce values to str; None if empty."""
    if not headers:
        return None
    out: dict[str, str] = {}
    for raw_key, value in headers.items():
        key = str(raw_key).strip()
        if key:
            out[key] = str(value)
    return out or None


# ── Tool-facing functions ───────────────────────────────────────────
# Each returns a str suitable as a tool result for the model.


def list_servers_for_model() -> str:
    """Return a JSON array of configured MCP servers (no secrets)."""
    rows = mcp_servers_db.list_servers()
    servers = []
    for row in rows:
        servers.append({
            "id": row["id"],
            "display_name": row["display_name"],
            "url": row["url"],
            "is_enabled": bool(row["is_enabled"]),
            "use_oauth": bool(row.get("use_oauth")),
        })
    if not servers:
        return "No MCP servers configured."
    return json.dumps(servers, indent=2)


def add_server_for_model(arguments: dict) -> str:
    """Register a new MCP server and attempt an immediate probe."""
    display_name = (arguments.get("display_name") or "").strip()
    if not display_name:
        return "Error: display_name must not be empty."
    address = (arguments.get("address") or "").strip()
    url, error = validate_url(address)
    if error:
        return f"Error: {error}"

    # Deduplication: reject if a server with the same name+address exists.
    existing = mcp_servers_db.list_servers()
    for row in existing:
        if row["display_name"] == display_name and row["url"] == url:
            return (
                f"Error: a server named '{display_name}' with address "
                f"'{url}' already exists (id={row['id']}). "
                "Use update_mcp_server to change it."
            )

    raw_headers = arguments.get("headers")
    headers = normalize_headers(raw_headers) if isinstance(raw_headers, dict) else None
    is_enabled = arguments.get("is_enabled", True)
    # OAuth is HTTP-only; force it off for stdio commands.
    use_oauth = False

    server_id = uuid.uuid4().hex[:16]
    try:
        mcp_servers_db.create_server(
            id=server_id,
            display_name=display_name,
            url=url,
            headers_json=json.dumps(headers) if headers else None,
            is_enabled=is_enabled,
            use_oauth=use_oauth,
        )
    except Exception as exc:
        logger.error("mcp_server_actions.add_failed", error=str(exc), exc_info=True)
        return f"Error creating server: {safe_curated_detail(exc)}"

    # Attempt an immediate probe to warm the cache and report tool count.
    probe_result = _probe_server(url, headers, use_oauth, server_id=server_id)
    parts = [f"Server '{display_name}' added (id={server_id})."]
    if probe_result:
        parts.append(probe_result)
    return " ".join(parts)


def update_server_for_model(arguments: dict) -> str:
    """Update an existing MCP server's configuration."""
    server_id = (arguments.get("server_id") or "").strip()
    if not server_id:
        return "Error: server_id is required."
    old = mcp_servers_db.get_server(server_id)
    if not old:
        return f"Error: MCP server '{server_id}' not found."

    changes: dict = {}
    if "display_name" in arguments and arguments["display_name"] is not None:
        name = (arguments["display_name"] or "").strip()
        if not name:
            return "Error: display_name must not be empty."
        changes["display_name"] = name
    if "address" in arguments and arguments["address"] is not None:
        url, error = validate_url(arguments["address"])
        if error:
            return f"Error: {error}"
        changes["url"] = url
    if "headers" in arguments and arguments["headers"] is not None:
        headers = normalize_headers(arguments["headers"])
        changes["headers_json"] = json.dumps(headers) if headers else None
    if "is_enabled" in arguments and arguments["is_enabled"] is not None:
        changes["is_enabled"] = bool(arguments["is_enabled"])

    if not changes:
        return "Error: no fields to update. Provide at least one of: display_name, address, headers, is_enabled."

    # stdio is OAuth-less: drop a stale OAuth flag when switching to a command.
    if "url" in changes and is_stdio(changes["url"]):
        changes["use_oauth"] = False
    # Drop headers on transport-type switch if no new headers provided.
    if (
        "url" in changes
        and is_stdio(changes["url"]) != is_stdio(old["url"])
        and "headers_json" not in changes
    ):
        changes["headers_json"] = None

    try:
        mcp_servers_db.update_server(server_id, changes)
    except Exception as exc:
        logger.error("mcp_server_actions.update_failed", error=str(exc), exc_info=True)
        return f"Error updating server: {safe_curated_detail(exc)}"

    # Invalidate tool cache and close sessions when relevant fields change.
    if any(changes.get(k) != old.get(k) for k in changes.keys() & TOOL_CACHE_INVALIDATING_FIELDS):
        invalidate_tool_cache(server_id)
        try:
            close_stdio_sessions(old["url"], parse_server_headers(old))
        except Exception:
            pass  # Best-effort cleanup

    display = changes.get("display_name", old["display_name"])
    changed_fields = ", ".join(changes.keys())
    return f"Server '{display}' (id={server_id}) updated. Changed: {changed_fields}."


def delete_server_for_model(arguments: dict) -> str:
    """Remove an MCP server."""
    server_id = (arguments.get("server_id") or "").strip()
    if not server_id:
        return "Error: server_id is required."
    old = mcp_servers_db.get_server(server_id)
    if not old:
        return f"Error: MCP server '{server_id}' not found."

    display = old.get("display_name") or server_id
    try:
        mcp_servers_db.delete_server(server_id)
    except Exception as exc:
        logger.error("mcp_server_actions.delete_failed", error=str(exc), exc_info=True)
        return f"Error deleting server: {safe_curated_detail(exc)}"

    invalidate_tool_cache(server_id)
    try:
        close_stdio_sessions(old["url"], parse_server_headers(old))
    except Exception:
        pass  # Best-effort cleanup

    return f"Server '{display}' (id={server_id}) deleted."


def test_server_for_model(arguments: dict) -> str:
    """Probe an MCP server address without saving it."""
    address = (arguments.get("address") or "").strip()
    url, error = validate_url(address)
    if error:
        return f"Error: {error}"
    raw_headers = arguments.get("headers")
    headers = normalize_headers(raw_headers) if isinstance(raw_headers, dict) else None
    return _probe_server(url, headers, use_oauth=False) or "Error: probe returned no result."


# ── Internal helpers ────────────────────────────────────────────────


def _probe_server(
    url: str,
    headers: dict | None,
    use_oauth: bool,
    server_id: str | None = None,
) -> str:
    """Run a connection probe, optionally cache tools, and return summary."""
    try:
        tools = asyncio.run(
            list_tools_async(
                url=url,
                headers=headers,
                timeout=probe_timeout(url, use_oauth),
                use_oauth=use_oauth,
            )
        )
        if server_id:
            cache_tools(server_id, tools)
        return f"Probe: connected, {len(tools)} tool(s) found."
    except RuntimeError:
        # If there's already an event loop running (common in FastAPI), use
        # to_thread instead.
        try:
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
                future = pool.submit(
                    asyncio.run,
                    list_tools_async(
                        url=url,
                        headers=headers,
                        timeout=probe_timeout(url, use_oauth),
                        use_oauth=use_oauth,
                    ),
                )
                tools = future.result(timeout=probe_timeout(url, use_oauth) + 5)
            if server_id:
                cache_tools(server_id, tools)
            return f"Probe: connected, {len(tools)} tool(s) found."
        except Exception as exc:
            logger.error("mcp_server_actions.probe_failed", error=str(exc), exc_info=True)
            return f"Probe failed: {safe_curated_detail(exc)}"
    except Exception as exc:
        logger.error("mcp_server_actions.probe_failed", error=str(exc), exc_info=True)
        return f"Probe failed: {safe_curated_detail(exc)}"
