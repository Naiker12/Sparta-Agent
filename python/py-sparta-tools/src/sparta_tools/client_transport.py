from __future__ import annotations

import os
import platform
import re
import logging

logger = logging.getLogger("sparta_ai.tools.mcp_client")

_ARG_PLACEHOLDERS = ("${DIR}", "${DATABASE_URL}", "${DB_PATH}")


def _resolve_vault_refs(server_id: str, refs: list[str]) -> dict[str, str]:
    from sparta_config.security import get_key
    resolved = {}
    for ref in refs:
        vault_key = f"mcp:{server_id}:{ref}"
        val = get_key(vault_key)
        if val:
            resolved[ref] = val
        else:
            logger.warning(
                "Vault ref '%s' not found for server '%s' — skipping",
                ref, server_id,
            )
    return resolved


def resolve_arg_placeholders(args: list[str], override: str | None = None) -> list[str]:
    if not args:
        return args
    workspace = override or os.environ.get("SPARTA_WORKSPACE_ROOT") or os.getcwd()
    if platform.system() == "Windows":
        workspace = workspace.replace("\\", "/")
    resolved: list[str] = []
    for a in args:
        if any(p in a for p in _ARG_PLACEHOLDERS):
            a = a.replace("${DIR}", workspace).replace("${DATABASE_URL}", workspace).replace("${DB_PATH}", workspace)
        resolved.append(a)
    return resolved


def _resolve_env(raw_env: dict[str, str] | None) -> dict[str, str]:
    safe_vars = {
        k: v for k, v in os.environ.items()
        if k in {"PATH", "HOME", "USER", "USERNAME", "TEMP", "TMP", "SHELL", "COMSPEC", "TERM", "LANG"}
    }
    merged = {**safe_vars}
    if raw_env:
        merged.update(raw_env)
    return merged


def create_stdio_transport(
    config: dict, server_id: str, workspace_root: str = "",
):
    from mcp.client.stdio import stdio_client, StdioServerParameters

    command = config.get("command", "")
    args = resolve_arg_placeholders(config.get("args", []), override=workspace_root or None)
    env = _resolve_env(config.get("env"))

    if platform.system() == "Windows":
        env["PROMPT"] = "$E"

    if not command:
        raise ValueError(f"MCP server '{server_id}' requires 'command' for stdio type.")

    if platform.system() == "Windows":
        base = command.rsplit("/", 1)[-1].rsplit("\\", 1)[-1]
        if base in ("npx", "npm", "pnpm", "yarn") and not command.endswith(".cmd"):
            command = command + ".cmd"

    unresolved = [a for a in args if re.search(r"\$\{[A-Z_]+\}", a)]
    if unresolved:
        raise ValueError(
            f"MCP server '{server_id}' tiene variables de template sin resolver: "
            f"{unresolved}. Configura el servidor con argumentos reales desde "
            f"la UI de MCP."
        )

    params = StdioServerParameters(
        command=command,
        args=args,
        env=env,
        encoding_error_handler="replace",
    )
    return stdio_client(params)


def create_http_transport(config: dict):
    from mcp.client.streamable_http import streamablehttp_client

    server_id = config.get("id", config.get("name", "unknown"))
    url = config.get("url", "")
    headers = config.get("headers", {})
    if not url:
        raise ValueError(f"MCP server '{server_id}' requires 'url' for http type.")
    return streamablehttp_client(url, headers=headers)
