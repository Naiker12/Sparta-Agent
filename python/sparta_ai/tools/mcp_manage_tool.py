"""Tool de agente para gestionar servidores MCP (instalar, listar, remover).

Sigue el mismo patron que skill_manage_tool: el agente puede sugerir
instalaciones pero siempre requiere confirmacion del usuario via dialogo.

El agente SOLO puede instalar servidores listados en sparta_mcp_catalog.json
(el catalogo curado). No puede inventar comandos arbitrarios.
"""
from __future__ import annotations

import json
import logging
import os
import shutil
from pathlib import Path
from typing import Any

from langchain_core.tools import tool

from sparta_ai.tools.permission_broker import request_permission_sync_generic

logger = logging.getLogger("sparta_ai.tools.mcp")

_CATALOG_PATH = Path(__file__).resolve().parent.parent.parent.parent / "sparta_mcp_catalog.json"
_MCP_CONFIG_PATH = Path(os.environ.get("SPARTA_WORKSPACE_ROOT", Path.cwd())) / "sparta.mcp.json"


# ─────────────────────────────────────────────────────────────────────────────
# Internal helpers
# ─────────────────────────────────────────────────────────────────────────────

def _load_catalog() -> dict:
    """Load the curated MCP catalog."""
    if not _CATALOG_PATH.exists():
        return {}
    try:
        raw = json.loads(_CATALOG_PATH.read_text(encoding="utf-8"))
        return raw.get("servers", {})
    except (json.JSONDecodeError, OSError) as e:
        logger.error("Failed to load MCP catalog: %s", e)
        return {}


def _load_configured() -> dict:
    """Load the user's sparta.mcp.json config."""
    if not _MCP_CONFIG_PATH.exists():
        return {}
    try:
        raw = json.loads(_MCP_CONFIG_PATH.read_text(encoding="utf-8"))
        return raw.get("mcpServers", {})
    except (json.JSONDecodeError, OSError) as e:
        logger.error("Failed to load MCP config: %s", e)
        return {}


def _save_configured(servers: dict) -> None:
    """Write the user's sparta.mcp.json config."""
    _MCP_CONFIG_PATH.parent.mkdir(parents=True, exist_ok=True)
    content = json.dumps({"mcpServers": servers}, indent=2, ensure_ascii=False)
    _MCP_CONFIG_PATH.write_text(content, encoding="utf-8")


def _format_catalog_for_llm(catalog: dict) -> str:
    """Format the catalog as a readable string for the LLM."""
    if not catalog:
        return "No hay servidores disponibles en el catalogo."
    lines = ["Servidores MCP disponibles en el catalogo:\n"]
    for sid, entry in sorted(catalog.items()):
        env_needed = entry.get("env_required", [])
        env_str = f"  Requiere env: {', '.join(env_needed)}" if env_needed else ""
        lines.append(f"  \u2022 {sid} ({entry.get('name', sid)}): {entry.get('description', '')}")
        if env_str:
            lines.append(env_str)
        if entry.get("notes"):
            lines.append(f"    Nota: {entry['notes']}")
    return "\n".join(lines)


def _format_configured_for_llm(configured: dict) -> str:
    """Format the configured servers as a readable string for the LLM."""
    if not configured:
        return "No hay servidores MCP configurados actualmente."
    lines = ["Servidores MCP configurados:\n"]
    for sid, cfg in sorted(configured.items()):
        enabled = "activado" if cfg.get("enabled", True) else "desactivado"
        svr_type = cfg.get("type", "stdio")
        lines.append(f"  \u2022 {sid} ({svr_type}) — {enabled}")
        if cfg.get("command"):
            lines.append(f"    Comando: {cfg['command']} {' '.join(cfg.get('args', []))}")
        if cfg.get("url"):
            lines.append(f"    URL: {cfg['url']}")
    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# mcp_manage_tool
# ─────────────────────────────────────────────────────────────────────────────


@tool
def mcp_manage_tool(
    action: str,
    server_id: str = "",
    env: dict[str, str] | None = None,
    extra_args: list[str] | None = None,
) -> str:
    """Gestiona servidores MCP: instalar, listar, configurar.

    actions:
      - list_catalog:   Muestra los servidores disponibles en el catalogo curado
                        (los unicos que se pueden instalar via tool).
      - list_configured: Muestra los servidores ya configurados en sparta.mcp.json.
      - install:        Instala un servidor del catalogo. REQUIERE permiso del
                        usuario (dialogo). Solo acepta server_id del catalogo.
                        Proporciona env vars requeridas via el parametro env.
      - remove:         Elimina un servidor de sparta.mcp.json.
      - enable:         Activa un servidor existente sin borrar su config.
      - disable:        Desactiva un servidor sin borrar su config.

    Args:
        action:     Accion a ejecutar (list_catalog | list_configured | install |
                    remove | enable | disable).
        server_id:  Identificador del servidor (requerido para install/remove/enable/disable).
        env:        Dict de variables de entorno para el servidor (solo install).
        extra_args: Argumentos adicionales para servidores que los requieran
                    (ej: filesystem necesita un directorio).

    Returns:
        Mensaje descriptivo del resultado.
    """
    try:
        action = action.lower().strip()

        # ── LIST CATALOG ────────────────────────────────────────────────
        if action == "list_catalog":
            catalog = _load_catalog()
            return _format_catalog_for_llm(catalog)

        # ── LIST CONFIGURED ─────────────────────────────────────────────
        if action == "list_configured":
            configured = _load_configured()
            return _format_configured_for_llm(configured)

        # ── INSTALL ─────────────────────────────────────────────────────
        if action == "install":
            if not server_id:
                return "Error: server_id es requerido para install."

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
            config: dict[str, Any] = {
                "type": entry.get("type", "stdio"),
                "enabled": True,
            }

            # Preparar el comando / URL
            if entry.get("type") == "stdio":
                config["command"] = entry["command"]
                args = list(entry.get("args", []))
                # Resolver argumentos con plantillas ${...}
                resolved_args: list[str] = []
                needs_extra = False
                for a in args:
                    if "${DIR}" in a or "${DATABASE_URL}" in a or "${DB_PATH}" in a:
                        if extra_args:
                            resolved_args.append(a.replace("${DIR}", extra_args[0])
                                                  .replace("${DATABASE_URL}", extra_args[0])
                                                  .replace("${DB_PATH}", extra_args[0]))
                        else:
                            needs_extra = True
                            resolved_args.append(a)
                    else:
                        resolved_args.append(a)
                config["args"] = resolved_args

                if needs_extra and not extra_args:
                    return (
                        f"Error: El servidor '{server_id}' requiere un argumento "
                        f"adicional (ej: ruta de directorio, URL de base de datos). "
                        f"Proporcionalo via el parametro extra_args."
                    )

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
                        hints = "; ".join(
                            f"{h}: {labels.get(h, 'valor requerido')}"
                            for h in missing_headers
                        )
                        return (
                            f"Error: Faltan headers requeridos para '{server_id}': "
                            f"{', '.join(missing_headers)}. {hints}"
                        )
                    config["headers"] = headers

            # Procesar variables de entorno requeridas
            env_required = entry.get("env_required", [])
            if env_required:
                missing_env = [v for v in env_required if not (env and env.get(v))]
                if missing_env:
                    labels = entry.get("env_labels", {})
                    hints = "; ".join(
                        f"{v}: {labels.get(v, 'valor requerido')}"
                        for v in missing_env
                    )
                    return (
                        f"Error: Faltan variables de entorno requeridas para "
                        f"'{server_id}': {', '.join(missing_env)}. {hints}. "
                        f"Pregunta al usuario por estos valores antes de continuar."
                    )
                config["env"] = {k: env[k] for k in env_required}

            # Si hay env adicional (no requerido), tambien incluirlo
            if env:
                for k, v in env.items():
                    if k not in config.get("env", {}):
                        config.setdefault("env", {})[k] = v

            # ── Permission dialog ──────────────────────────────────────
            preview_parts = [f"Tipo: {config.get('type', 'stdio')}"]
            if config.get("command"):
                preview_parts.append(
                    f"Comando: {config['command']} {' '.join(config.get('args', []))}"
                )
            if config.get("url"):
                preview_parts.append(f"URL: {config['url']}")
            if config.get("env"):
                safe_env = {k: "***" for k in config["env"]}
                preview_parts.append(f"Env: {json.dumps(safe_env)}")
            preview = "\n".join(preview_parts)

            allowed = request_permission_sync_generic(
                kind="mcp_install",
                subject=server_id,
                tool_name="mcp_manage_tool",
                preview=preview,
            )
            if not allowed:
                return (
                    f"Instalacion de '{server_id}' cancelada por el usuario. "
                    f"Dile que puede instalarlo manualmente desde la UI de MCP."
                )

            # ── Write config ────────────────────────────────────────────
            configured = _load_configured()
            configured[server_id] = config
            _save_configured(configured)

            # ── Emit event to frontend (para actualizar store) ──────────
            _emit_mcp_event("mcp:server_added", {
                "serverId": server_id,
                "config": {
                    "id": server_id,
                    "name": entry.get("name", server_id),
                    "type": config.get("type", "stdio"),
                    "command": config.get("command"),
                    "args": config.get("args"),
                    "env": config.get("env"),
                    "url": config.get("url"),
                    "headers": config.get("headers"),
                    "enabled": True,
                },
            })

            # ── Connect ─────────────────────────────────────────────────
            # Reutiliza RealMCPClient para conectar y emitir eventos
            try:
                _connect_and_emit(server_id, config)
            except Exception as e:
                logger.warning("MCP connect after install failed for '%s': %s", server_id, e)
                return (
                    f"Configuracion de '{server_id}' guardada en sparta.mcp.json, "
                    f"pero la conexion fallo: {e}. "
                    f"Puedes revisar la configuracion y reintentar desde la UI."
                )

            # ── Build result for LLM ────────────────────────────────────
            env_summary = ", ".join(config.get("env", {}).keys()) if config.get("env") else "ninguna"
            return (
                f"Servidor MCP '{server_id}' instalado y conectado exitosamente.\n"
                f"  Tipo: {config.get('type', 'stdio')}\n"
                f"  Variables de entorno: {env_summary}\n"
                f"  Las herramientas del servidor ya estan disponibles para el agente."
            )

        # ── REMOVE ──────────────────────────────────────────────────────
        if action == "remove":
            if not server_id:
                return "Error: server_id es requerido para remove."

            configured = _load_configured()
            if server_id not in configured:
                return f"Error: '{server_id}' no esta configurado."

            del configured[server_id]
            _save_configured(configured)

            _emit_mcp_event("mcp:server_removed", {"serverId": server_id})
            return f"Servidor '{server_id}' eliminado de sparta.mcp.json."

        # ── ENABLE / DISABLE ───────────────────────────────────────────
        if action in ("enable", "disable"):
            if not server_id:
                return f"Error: server_id es requerido para {action}."

            configured = _load_configured()
            if server_id not in configured:
                return f"Error: '{server_id}' no esta configurado."

            configured[server_id]["enabled"] = (action == "enable")
            _save_configured(configured)

            _emit_mcp_event(
                "mcp:connected" if action == "enable" else "mcp:disconnected",
                {"serverId": server_id},
            )
            return f"Servidor '{server_id}' {action}d."

        return (
            f"Error: Accion '{action}' no reconocida. "
            f"Acciones validas: list_catalog, list_configured, install, remove, enable, disable."
        )

    except Exception as e:
        logger.error("mcp_manage_tool failed: %s", e)
        return f"Error al gestionar servidor MCP: {e}"


# ─────────────────────────────────────────────────────────────────────────────
# Connect + emit helpers
# ─────────────────────────────────────────────────────────────────────────────

def _emit_mcp_event(event: str, data: dict) -> None:
    """Emit an MCP event on stdout (same channel as streaming tokens).

    The Electron main process (chat.ipc.ts) catches these and forwards
    them to the renderer so the frontend store can update.
    """
    import sys
    msg = json.dumps({"event": event, "data": data}, ensure_ascii=False)
    try:
        sys.stdout.write(msg + "\n")
        sys.stdout.flush()
    except (BrokenPipeError, OSError):
        pass


def _connect_and_emit(server_id: str, config: dict) -> None:
    """Connect to the MCP server and emit discovery events.

    This is called synchronously from the sync @tool, so we use
    asyncio.run() since this runs in a ToolNode executor thread (no
    conflicting event loop).
    """
    import asyncio
    asyncio.run(_async_connect_and_emit(server_id, config))


async def _async_connect_and_emit(server_id: str, config: dict) -> None:
    """Async implementation of MCP connection with event emission."""
    from sparta_ai.tools.mcp_client import RealMCPClient

    def _mcp_emit(event: str, data: dict) -> None:
        _emit_mcp_event(event, {**data, "serverId": server_id})

    client = RealMCPClient({**config, "id": server_id, "timeout": 15})
    try:
        tools = await client.connect()
        _emit_mcp_event("mcp:connected", {
            "serverId": server_id,
            "toolCount": len(tools),
        })
        if tools:
            _emit_mcp_event("mcp:tool_discovered", {
                "serverId": server_id,
                "tools": [
                    {"name": t["name"], "description": t.get("description", ""), "inputSchema": t.get("inputSchema", {})}
                    for t in tools
                ],
            })
    except Exception as e:
        _emit_mcp_event("mcp:error", {
            "serverId": server_id,
            "error": str(e),
        })
        raise
    finally:
        await client.disconnect()
