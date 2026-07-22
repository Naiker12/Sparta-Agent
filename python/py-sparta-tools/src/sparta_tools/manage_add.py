import json
import logging
from typing import Any

from sparta_tools.mcp_manage_tool import (
    _load_catalog,
    _load_configured,
    _save_configured,
    _emit_mcp_event,
    _store_mcp_secret,
    _connect_and_emit,
)
from sparta_tools.mcp_client import resolve_arg_placeholders

logger = logging.getLogger("sparta_ai.tools.mcp_manage")


def handle_install(server_id: str, env: dict[str, str] | None = None,
                   extra_args: list[str] | None = None) -> str:
    from sparta_tools.permission_broker import request_permission_sync_generic

    catalog = _load_catalog()
    if server_id not in catalog:
        available = ", ".join(sorted(catalog.keys())) if catalog else "(vacio)"
        return (
            f"Error: '{server_id}' no esta en el catalogo curado. "
            f"Servidores disponibles: {available}. "
            f"Para instalar un servidor no listado, agregalo manualmente desde "
            f"la UI de MCP en la aplicacion."
        )

    entry = catalog[server_id]
    config: dict[str, Any] = {"type": entry.get("type", "stdio"), "enabled": True}

    if entry.get("type") == "stdio":
        config["command"] = entry["command"]
        args = list(entry.get("args", []))
        needs_extra = any(
            ("${DIR}" in a or "${DATABASE_URL}" in a or "${DB_PATH}" in a) for a in args
        )
        if needs_extra and not extra_args:
            return (
                f"Error: El servidor '{server_id}' requiere un argumento "
                f"adicional (ej: ruta de directorio, URL de base de datos). "
                f"Proporcionalo via el parametro extra_args."
            )
        config["args"] = resolve_arg_placeholders(args, override=extra_args[0] if extra_args else None)

    elif entry.get("type") == "http":
        config["url"] = entry["url"]
        if entry.get("headers_required"):
            headers = {}
            missing_headers = []
            for h in entry["headers_required"]:
                if env and h in env:
                    headers[h] = env[h]
                else:
                    missing_headers.append(h)
            if missing_headers:
                labels = entry.get("header_labels", {})
                hints = "; ".join(f"{h}: {labels.get(h, 'valor requerido')}" for h in missing_headers)
                return f"Error: Faltan headers requeridos para '{server_id}': {', '.join(missing_headers)}. {hints}"
            config["headers"] = headers

    env_required = entry.get("env_required", [])
    if env_required:
        missing_env = [v for v in env_required if not (env and env.get(v))]
        if missing_env:
            labels = entry.get("env_labels", {})
            hints = "; ".join(f"{v}: {labels.get(v, 'valor requerido')}" for v in missing_env)
            return (
                f"Error: Faltan variables de entorno requeridas para "
                f"'{server_id}': {', '.join(missing_env)}. {hints}. "
                f"Pregunta al usuario por estos valores antes de continuar."
            )
        config["env"] = {k: env[k] for k in env_required}

    if env:
        for k, v in env.items():
            if k not in config.get("env", {}):
                config.setdefault("env", {})[k] = v

    preview_parts = [f"Tipo: {config.get('type', 'stdio')}"]
    if config.get("command"):
        preview_parts.append(f"Comando: {config['command']} {' '.join(config.get('args', []))}")
    if config.get("url"):
        preview_parts.append(f"URL: {config['url']}")
    if config.get("env"):
        safe_env = {k: "***" for k in config["env"]}
        preview_parts.append(f"Env: {json.dumps(safe_env)}")
    preview = "\n".join(preview_parts)

    allowed = request_permission_sync_generic(kind="mcp_install", subject=server_id, tool_name="mcp_manage_tool", preview=preview)
    if not allowed:
        return f"Instalacion de '{server_id}' cancelada por el usuario. Dilé que puede instalarlo manualmente desde la UI de MCP."

    env_vault_refs: list[str] = []
    env_plain = config.pop("env", {}) or {}
    for var_name, value in env_plain.items():
        if isinstance(value, str) and value:
            _store_mcp_secret(server_id, var_name, value)
            env_vault_refs.append(var_name)
    if env_vault_refs:
        config["env_vault_refs"] = env_vault_refs

    headers_vault_refs: list[str] = []
    headers_plain = config.pop("headers", {}) or {}
    for hdr_name, value in headers_plain.items():
        if isinstance(value, str) and value:
            _store_mcp_secret(server_id, hdr_name, value)
            headers_vault_refs.append(hdr_name)
    if headers_vault_refs:
        config["headers_vault_refs"] = headers_vault_refs

    configured = _load_configured()
    configured[server_id] = config
    _save_configured(configured)

    _emit_mcp_event("mcp:server_added", {
        "serverId": server_id,
        "config": {
            "id": server_id,
            "name": entry.get("name", server_id),
            "type": config.get("type", "stdio"),
            "command": config.get("command"),
            "args": config.get("args"),
            "env_vault_refs": env_vault_refs,
            "headers_vault_refs": headers_vault_refs,
            "url": config.get("url"),
            "enabled": True,
        },
    })

    try:
        _connect_and_emit(server_id, config)
    except Exception as e:
        logger.warning("MCP connect after install failed for '%s': %s", server_id, e)
        return (
            f"Configuracion de '{server_id}' guardada en sparta.mcp.json, "
            f"pero la conexion fallo: {e}. "
            f"Puedes revisar la configuracion y reintentar desde la UI."
        )

    env_summary = ", ".join(config.get("env", {}).keys()) if config.get("env") else "ninguna"
    return (
        f"Servidor MCP '{server_id}' instalado y conectado exitosamente.\n"
        f"  Tipo: {config.get('type', 'stdio')}\n"
        f"  Variables de entorno: {env_summary}\n"
        f"  Las herramientas del servidor ya estan disponibles para el agente."
    )
