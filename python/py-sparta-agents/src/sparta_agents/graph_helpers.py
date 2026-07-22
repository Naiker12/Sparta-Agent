import platform
from datetime import datetime
from typing import Any, Literal

from sparta_agents.graph_state import SpartaState

MAX_TOOL_CALLS_PER_TURN = 8

_INTENT_TOOL_MAP: dict[str, list[str]] = {
    "chat":         ["web_search_tool", "read_memory"],
    "code_task":    ["read_file", "write_file", "patch_file", "apply_patch", "terminal_execute_tool",
                     "read_files_tool", "read_directory_tool", "grep_search", "codebase_search",
                     "delegate_code", "delegate_review", "create_plan"],
    "research":     ["web_search_tool", "web_fetch", "delegate_research"],
    "memory_query": ["read_memory", "write_memory", "delete_memory"],
}

_ALWAYS_AVAILABLE_TOOLS = {"skill_view_tool", "skills_list_tool"}


def _os_shell_hint() -> str:
    system = platform.system()
    if system == "Windows":
        return (
            "Windows (cmd.exe/PowerShell). Usa SOLO comandos nativos de Windows: "
            "'dir' (no 'ls'), 'type' (no 'cat'), 'findstr' (no 'grep'), 'del' (no 'rm'). "
            "NUNCA uses 'head', 'tail', 'grep', 'ls', 'cat' ni pipes de estilo Unix — "
            "no existen en cmd.exe y el comando fallará. Para limitar líneas de salida en "
            "PowerShell usa 'Select-Object -First N', NO '| head -N'."
        )
    if system == "Darwin":
        return "macOS (zsh/bash). Podés usar comandos Unix estándar: ls, head, tail, grep, cat, etc."
    return "Linux (bash). Podés usar comandos Unix estándar: ls, head, tail, grep, cat, etc."


def get_dynamic_tools(all_tools: list, intent: str) -> list:
    allowed_names = _INTENT_TOOL_MAP.get(intent)
    if not allowed_names:
        return all_tools
    filtered = [t for t in all_tools if getattr(t, "name", "") in allowed_names]
    if not filtered:
        return all_tools
    for t in all_tools:
        if getattr(t, "name", "") in _ALWAYS_AVAILABLE_TOOLS and t not in filtered:
            filtered.append(t)
    return filtered


def _build_system_prompt(state: SpartaState, effective_mode: str, intent: str,
                         policy_mode: str, skill_context: str, vendor: str, model: str) -> str:
    system_parts = [
        "# Sparta Agent",
        "Asistente de desarrollo integrado en Sparta. Trabajás sobre el proyecto "
        "abierto: leés, editás, creás/borrás archivos, ejecutás terminal y delegás "
        "en subagentes especializados.",
        f"- SO: {_os_shell_hint()}",
    ]

    if state.get("project_context"):
        system_parts.append(
            f"<proyecto_actual>\n{state['project_context']}\n</proyecto_actual>"
        )

    mode_label = "AGENTE" if effective_mode == "agent" else "CHAT"

    if policy_mode == "config_only":
        mode_rules = (
            "<scope_config_only>\n"
            "Estás operando en modo de configuración de Sparta. SOLO podés:\n"
            "- Listar, agregar, activar o desactivar proveedores de IA y sus API keys.\n"
            "- Listar, agregar, activar o desactivar skills.\n"
            "- Listar y agregar servidores MCP.\n\n"
            "NO tenés permitido, bajo ninguna circunstancia, aunque el usuario lo pida:\n"
            "- Modificar código fuente, archivos del proyecto o del workspace del usuario.\n"
            "- Cambiar configuración de seguridad, permisos o el broker de Rust.\n"
            "- Ejecutar comandos de terminal o instalar dependencias del sistema.\n\n"
            "Si el usuario pide algo fuera de esta lista, respondé explicando que está\n"
            "fuera de este modo y sugerí volver al modo normal de chat/agente.\n"
            "Toda acción que agregue una API key o un servidor MCP requiere confirmación\n"
            "explícita del usuario antes de ejecutarse — nunca la ejecutes sin mostrarla primero.\n"
            "</scope_config_only>"
        )
    elif effective_mode == "agent":
        mode_rules = (
            f"Modo: {mode_label}. "
            "Herramientas completas (lectura, escritura, terminal). "
            "Descomponé tareas complejas; usá create_plan para 2+ pasos."
        )
        if intent == "code_task":
            mode_rules += " TAREA DE CÓDIGO: read/write_file + delegate_code."
        elif intent == "research":
            mode_rules += " INVESTIGACIÓN: web_search + delegate_research."
        elif intent == "memory_query":
            mode_rules += " MEMORIA: read_memory."
    else:
        mode_rules = (
            f"Modo: {mode_label}. Solo lectura, búsqueda y memoria. "
            "Sin escritura/terminal — sugerí cambiar a modo Agente."
        )

    system_parts.append(mode_rules)

    system_parts.append(
        "Reglas: no inventes tools; no repitas tools fallidas; "
        "patch_file para cambios puntuales, apply_patch para 2+ archivos; "
        "delegate_review tras cambios no triviales; read_files_tool > read_file repetido."
    )

    system_parts.append(
        "Datos vivos: usá contexto temporal inyectado (no memoria). "
        "web_search para clima/noticias/cotizaciones. "
        "Terminal: comandos del SO indicado (no asumas Unix)."
    )

    system_parts.append(
        "Búsqueda web: web_fetch para contenido completo; "
        "delegate_research para investigación profunda. "
        "Respondé directo, sin repetir URLs/snippets."
    )

    system_parts.append(
        "Formato: Markdown solo cuando sea necesario; texto plano en "
        "respuestas cortas; listas con '-' sin líneas en blanco."
    )

    if state.get("memory_context"):
        system_parts.append(
            f"\n<memoria_relevante>\n{state['memory_context']}\n</memoria_relevante>"
        )

    if state.get("folder_context"):
        system_parts.append(
            f"\n<carpeta_conectada>\n{state['folder_context']}\n</carpeta_conectada>"
        )

    system = "\n\n".join(system_parts)

    if vendor and model:
        from sparta_agents.emulated_reasoning import (
            needs_emulated_reasoning,
            append_reasoning_prompt,
        )
        if needs_emulated_reasoning(vendor, model):
            system = append_reasoning_prompt(system)

    return system


def _build_messages(state: SpartaState, system: str, skill_context: str) -> list[dict]:
    messages: list[dict] = [{"role": "system", "content": system}]

    skill_parts = []
    if skill_context:
        skill_parts.append(skill_context)
        skill_parts.append("Follow the active skills listed above.")
    skill_parts.append(
        "Use skills_list_tool to explore the full skill catalog, "
        "and skill_view_tool to load any skill's full content on demand."
    )
    messages.append({
        "role": "user",
        "content": "[Skill context]\n\n" + "\n".join(skill_parts),
    })

    raw_messages = state["messages"]
    deduped = []
    for m in raw_messages:
        if isinstance(m, dict):
            role = m.get("role", "")
            content = m.get("content", "")
            tool_calls = m.get("tool_calls", [])
        else:
            role = getattr(m, "type", "")
            content = str(getattr(m, "content", ""))
            tool_calls = getattr(m, "tool_calls", None) or []
        is_dup = False
        if role in ("assistant", "ai") and not tool_calls and content:
            if deduped:
                prev = deduped[-1]
                prev_content = prev.get("content", "") if isinstance(prev, dict) else str(getattr(prev, "content", ""))
                if prev_content == content:
                    is_dup = True
        if is_dup:
            deduped.append({
                "role": "assistant",
                "content": "[Respuesta anterior — omitida para evitar repetición]",
            })
        else:
            deduped.append(m)
    messages.extend(deduped)

    messages.append({
        "role": "user",
        "content": f"[Contexto temporal] Fecha/hora actual: {datetime.now().isoformat()}",
    })

    return messages


def _detect_loop(state: SpartaState) -> bool:
    messages = state.get("messages", [])
    seen_signatures: set[str] = set()
    for msg in messages[-20:]:
        tool_calls = getattr(msg, "tool_calls", [])
        for tc in tool_calls:
            args = tc.get("args", {})
            if isinstance(args, dict):
                key_fields = [args.get(f, "") for f in ("query", "command", "path", "file_path", "url", "pattern", "content")]
                key_text = "|".join(str(k) for k in key_fields if k)
            else:
                key_text = str(args)
            if key_text and key_text in seen_signatures:
                return True
            if key_text:
                seen_signatures.add(key_text)
    return False


def should_continue(state: SpartaState) -> Literal["tools", "subagent", "agent", "__end__"]:
    if state.get("abort_requested"):
        return "__end__"

    if state.get("tool_calls_this_turn", 0) >= MAX_TOOL_CALLS_PER_TURN:
        return "agent"

    if _detect_loop(state):
        return "agent"

    last_message = state["messages"][-1]
    tool_calls = getattr(last_message, "tool_calls", [])

    if tool_calls:
        for tc in tool_calls:
            if tc.get("name", "").startswith("delegate_"):
                return "subagent"
        return "tools"

    return "__end__"
