import base64
import os
import tempfile
import logging
from typing import Any

from sparta_security.scope_rules import (
    validate_action,
    get_denied_message,
    Decision as ScopeDecision,
)
from sparta_mcp.server_handlers import (
    _active_streams,
    _session_workspaces,
    handle_memory_index,
    handle_memory_search,
    handle_memory_embed,
    handle_memory_delete,
    handle_memory_count,
    handle_mcp_test,
)

logger = logging.getLogger("sparta_ai.server")


def _scope_check(request_id, method, params=None, emit_fn=None, emit_error_fn=None):
    decision = validate_action(method, params)
    if decision == ScopeDecision.DENY:
        emit_error_fn(request_id, "scope_denied", get_denied_message(method))
        return False
    return True


async def handle_message(server, msg: dict):
    method = msg.get("method")
    request_id = msg.get("id")
    params = msg.get("params", {})
    emit = server._emit
    emit_error = server._emit_error

    if method == "chat.stream":
        await server._handle_chat_stream(request_id, params)
    elif method == "chat.abort":
        await server._handle_chat_abort(params)
    elif method == "keymanager.set":
        _handle_keymanager_set(request_id, params, emit, emit_error)
    elif method == "keymanager.clear":
        _handle_keymanager_clear(request_id, emit)
    elif method in ("skills:list_all", "skill.list"):
        _handle_skills_list(request_id, method, emit)
    elif method == "skill.view":
        _handle_skill_view(request_id, params, emit)
    elif method == "skill.add":
        if not _scope_check(request_id, method, {"source": params.get("source", "external")}, emit, emit_error):
            return
        result = _add_skill(params)
        emit(request_id, "skill.add:response", result)
    elif method == "skill.enable":
        if not _scope_check(request_id, method, emit_fn=emit, emit_error_fn=emit_error):
            return
        result = _toggle_skill(params.get("skill_id", ""), enabled=True)
        emit(request_id, "skill.enable:response", result)
    elif method == "skill.disable":
        if not _scope_check(request_id, method, emit_fn=emit, emit_error_fn=emit_error):
            return
        result = _toggle_skill(params.get("skill_id", ""), enabled=False)
        emit(request_id, "skill.disable:response", result)
    elif method == "mcp.test":
        result = await handle_mcp_test(params)
        emit(request_id, "mcp.test.result", result)
    elif method == "mcp.list":
        _handle_mcp_list(request_id, emit)
    elif method == "mcp.add":
        if not _scope_check(request_id, method, emit_fn=emit, emit_error_fn=emit_error):
            return
        _handle_mcp_add(request_id, params, emit, emit_error)
    elif method == "provider.list":
        emit(request_id, "provider.list:response", {"providers": _list_providers()})
    elif method == "provider.add":
        if not _scope_check(request_id, method, emit_fn=emit, emit_error_fn=emit_error):
            return
        result = _add_provider(params)
        emit(request_id, "provider.add:response", result)
    elif method == "provider.enable":
        if not _scope_check(request_id, method, emit_fn=emit, emit_error_fn=emit_error):
            return
        result = _toggle_provider(params.get("provider_id", ""), enabled=True)
        emit(request_id, "provider.enable:response", result)
    elif method == "provider.disable":
        if not _scope_check(request_id, method, {"provider_id": params.get("provider_id", "")}, emit, emit_error):
            return
        result = _toggle_provider(params.get("provider_id", ""), enabled=False)
        emit(request_id, "provider.disable:response", result)
    elif method == "provider.set_api_key":
        if not _scope_check(request_id, method, emit_fn=emit, emit_error_fn=emit_error):
            return
        _handle_set_api_key(request_id, params, emit, emit_error)
    elif method == "permission.respond":
        _handle_permission_respond(params)
    elif method == "memory.index":
        result = await handle_memory_index(params)
        emit(request_id, "memory.index:response", result)
    elif method == "memory.search":
        result = await handle_memory_search(params)
        emit(request_id, "memory.search:response", result)
    elif method == "memory.embed":
        result = await handle_memory_embed(params)
        emit(request_id, "memory.embed:response", result)
    elif method == "memory.delete":
        result = await handle_memory_delete(params)
        emit(request_id, "memory.delete:response", result)
    elif method == "memory.count":
        result = await handle_memory_count()
        emit(request_id, "memory.count:response", result)
    elif method == "shutdown":
        emit(request_id, "shutdown", {"ok": True})
        server._running = False
    elif method == "cache.clear":
        from sparta_config.providers import clear_all_caches
        clear_all_caches()
        emit(request_id, "cache.clear:response", {"ok": True, "message": "Todos los caches limpiados"})
    elif method == "agent.task":
        from sparta_mcp.server_stream import handle_agent_task
        await handle_agent_task(request_id, params, emit, emit_error)
    elif method == "audio.transcribe":
        await _handle_audio_transcribe(request_id, params, emit, emit_error)
    else:
        emit_error(request_id, "unknown_method", f"Unknown method: {method}")
        emit(request_id, "stream:completed", {})


def _handle_keymanager_set(request_id, params, emit, emit_error):
    from sparta_config.security import store_key
    key_id = params.get("key_id", params.get("keyId", ""))
    value = params.get("value", "")
    vendor = params.get("vendor")
    if key_id and value:
        store_key(key_id, value, vendor)
        emit(request_id, "keymanager.set", {"ok": True})
    else:
        emit_error(request_id, "invalid_params", "key_id and value required")


def _handle_keymanager_clear(request_id, emit):
    from sparta_config.security import clear_keys
    clear_keys()
    emit(request_id, "keymanager.clear", {"ok": True})


def _handle_skills_list(request_id, method, emit):
    from sparta_skills.skill_loader import skills_index
    emit(request_id, f"{method}:response", {"skills": skills_index()})


def _handle_skill_view(request_id, params, emit):
    from sparta_skills.skill_loader import skill_view as _skill_view
    result = _skill_view(params.get("skill_id", ""))
    emit(request_id, "skill.view:response", result)


def _handle_mcp_list(request_id, emit):
    from sparta_tools.mcp_manage_tool import _load_configured as _load_mcp_servers
    configured = _load_mcp_servers()
    emit(request_id, "mcp.list:response", {"servers": configured})


def _handle_mcp_add(request_id, params, emit, emit_error):
    from sparta_tools.mcp_manage_tool import _load_catalog, _load_configured, _save_configured, _emit_mcp_event
    server_id = params.get("server_id", "")
    catalog = _load_catalog()
    if server_id not in catalog:
        emit_error(request_id, "not_in_catalog", f"'{server_id}' no está en el catálogo curado.")
        return
    entry = catalog[server_id]
    config = {"type": entry.get("type", "stdio"), "enabled": True}
    if entry.get("type") == "stdio":
        config["command"] = entry["command"]
        config["args"] = entry.get("args", [])
    elif entry.get("type") == "http":
        config["url"] = entry["url"]
    configured = _load_configured()
    configured[server_id] = config
    _save_configured(configured)
    _emit_mcp_event("mcp:server_added", {"serverId": server_id, "config": config})
    emit(request_id, "mcp.add:response", {"ok": True, "server_id": server_id})


def _handle_set_api_key(request_id, params, emit, emit_error):
    provider_id = params.get("provider_id", "")
    key_value = params.get("api_key", "")
    if key_value:
        from sparta_config.security import store_key
        key_id = f"provider:{provider_id}:api_key"
        store_key(key_id, key_value, vendor=provider_id)
        logger.info("API key stored for provider: %s", provider_id)
        emit(request_id, "provider.set_api_key:response", {"ok": True, "provider_id": provider_id})
    else:
        emit_error(request_id, "invalid_params", "api_key is required")


def _handle_permission_respond(params):
    from sparta_tools.permission_broker import resolve_permission
    perm_id = params.get("request_id", "")
    approved = bool(params.get("approved", False))
    remember = str(params.get("remember", "once"))
    resolve_permission(perm_id, approved, remember)


def _list_providers() -> list[dict]:
    try:
        from sparta_config.providers import get_providers
        return get_providers()
    except Exception as e:
        logger.error("Failed to list providers: %s", e)
        return []


def _add_provider(params: dict) -> dict:
    try:
        provider_id = params.get("provider_id", "")
        provider_config = params.get("config", {})
        if not provider_id:
            return {"error": "provider_id is required"}
        from sparta_config.providers import add_provider
        add_provider(provider_id, provider_config)
        logger.info("Provider added: %s", provider_id)
        return {"ok": True, "provider_id": provider_id}
    except Exception as e:
        logger.error("Failed to add provider: %s", e)
        return {"error": str(e)}


def _toggle_provider(provider_id: str, enabled: bool) -> dict:
    try:
        if not provider_id:
            return {"error": "provider_id is required"}
        from sparta_config.providers import set_provider_enabled
        set_provider_enabled(provider_id, enabled)
        logger.info("Provider %s: %s", provider_id, "enabled" if enabled else "disabled")
        return {"ok": True, "provider_id": provider_id, "enabled": enabled}
    except Exception as e:
        logger.error("Failed to toggle provider %s: %s", provider_id, e)
        return {"error": str(e)}


def _add_skill(params: dict) -> dict:
    try:
        skill_id = params.get("skill_id", "")
        skill_data = params.get("data", {})
        if not skill_id:
            return {"error": "skill_id is required"}
        from sparta_tools.skill_tools import _get_writable_skill_dir, _build_skill_md
        skill_dir = _get_writable_skill_dir(skill_id)
        skill_dir.mkdir(parents=True, exist_ok=True)
        md_path = skill_dir / "SKILL.md"
        name = skill_data.get("name", skill_id)
        description = skill_data.get("description", "")
        body = skill_data.get("body", "")
        category = skill_data.get("category", "User")
        tags = skill_data.get("tags", [])
        content = _build_skill_md(name, description, body, category, tags)
        md_path.write_text(content, encoding="utf-8")
        from sparta_skills.skill_loader import clear_skill_cache
        clear_skill_cache()
        logger.info("Skill added: %s", skill_id)
        return {"ok": True, "skill_id": skill_id}
    except Exception as e:
        logger.error("Failed to add skill: %s", e)
        return {"error": str(e)}


def _toggle_skill(skill_id: str, enabled: bool) -> dict:
    try:
        if not skill_id:
            return {"error": "skill_id is required"}
        logger.info("Skill %s: %s (session-level toggle)", skill_id, "enabled" if enabled else "disabled")
        return {"ok": True, "skill_id": skill_id, "enabled": enabled}
    except Exception as e:
        logger.error("Failed to toggle skill %s: %s", skill_id, e)
        return {"error": str(e)}


async def _handle_audio_transcribe(request_id, params, emit, emit_error):
    audio_b64 = params.get("audio", "")
    filename = params.get("filename", "recording.webm")
    language = params.get("language", "es")

    if not audio_b64:
        emit_error(request_id, "invalid_params", "Missing 'audio' field (base64-encoded audio data)")
        return

    try:
        audio_bytes = base64.b64decode(audio_b64)
    except Exception:
        emit_error(request_id, "invalid_audio", "Invalid base64 audio data")
        return

    suffix = os.path.splitext(filename)[1] or ".webm"
    tmp_path = ""
    try:
        from sparta_audio.transcriber import transcribe
    except ImportError:
        emit(request_id, "audio.transcribe:response", {
            "error": "Transcripción no disponible. Instala el extra de audio: pip install -e '.[audio]'",
        })
        return

    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
            tmp.write(audio_bytes)
            tmp_path = tmp.name
        text = transcribe(tmp_path, language=language or None)
        emit(request_id, "audio.transcribe:response", {"text": text})
    except Exception as e:
        logger.exception("Audio transcription failed")
        emit(request_id, "audio.transcribe:response", {"error": str(e)})
    finally:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
