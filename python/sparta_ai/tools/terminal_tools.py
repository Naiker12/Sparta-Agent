import json
import logging
import subprocess
import sys
import uuid
from langchain_core.tools import tool
from sparta_ai.security.command_sanitizer import CommandSanitizer
from sparta_ai.tools.permission_broker import request_permission_sync_generic, get_agent_autonomy

logger = logging.getLogger("sparta_ai.tools.terminal")

_sanitizer = CommandSanitizer()
_EXECUTE_LOCAL = False

# Process result cache: maps proc_id → {"output": str, "exit_code": int, "done": bool}
_proc_results: dict[str, dict] = {}


def _emit_terminal_event(event: str, data: dict) -> None:
    """Write a terminal bridge event to stdout (visible in the terminal panel)."""
    try:
        sys.stdout.write(json.dumps({"event": event, "data": data}, ensure_ascii=False) + "\n")
        sys.stdout.flush()
    except (BrokenPipeError, OSError):
        pass


def set_execute_local(val: bool = True) -> None:
    global _EXECUTE_LOCAL
    _EXECUTE_LOCAL = val


@tool
def terminal_execute_tool(command: str) -> str:
    """
    Ejecuta un comando en la terminal del usuario (sistema operativo real).

    El comando se escribe en una terminal PTY real que el usuario ve en la interfaz.
    No devuelve la salida del comando — el usuario ve la ejecución en vivo.

    Args:
        command: Comando shell a ejecutar (por ejemplo "ls -la" o "cd src && npm test").

    Returns:
        Confirmación de que el comando fue enviado a la terminal.
    """
    if not command or not command.strip():
        return "Error: No se proporcionó ningún comando."

    sanitized = _sanitizer.sanitize(command)
    if sanitized is None:
        logger.warning("Terminal command blocked by sanitizer: %s", command.strip()[:120])
        return (
            "Error de seguridad: El comando fue bloqueado por el sanitizador porque "
            "coincide con un patrón peligroso. Si necesitás ejecutarlo, usá la terminal manualmente."
        )

    logger.info("Terminal command queued: %s", sanitized[:120])

    # Gate de permiso real, igual que file_tools.py
    # Los comandos no seguros requieren confirmación explícita del usuario
    # Con autonomía "always_ask", incluso los comandos seguros requieren confirmación
    if get_agent_autonomy() == "always_ask" or not _sanitizer.is_safe(sanitized):
        allowed = request_permission_sync_generic(
            kind="terminal_exec",
            subject=command.strip()[:200],
            tool_name="terminal_execute_tool",
            preview=f"Comando: {command.strip()[:500]}",
        )
        if not allowed:
            return "Comando rechazado por el usuario."

    if _EXECUTE_LOCAL:
        try:
            proc_id = f"term-{uuid.uuid4().hex[:8]}"
            # Spawn a background terminal tab so the user sees the command
            _emit_terminal_event("terminal:agent_spawn", {"procId": proc_id, "command": sanitized[:200]})

            result = subprocess.run(
                sanitized, shell=True, capture_output=True, text=True, timeout=60,
            )
            output = result.stdout
            if result.stderr:
                output += result.stderr
            if result.returncode != 0:
                output += f"\n[Exit code: {result.returncode}]"

            # Stream output to the terminal tab
            if output.strip():
                _emit_terminal_event("terminal:agent_output", {"procId": proc_id, "chunk": output[:5000]})
            _emit_terminal_event("terminal:agent_exit", {"procId": proc_id, "code": result.returncode})

            # Cache result for terminal_check_tool
            _proc_results[proc_id] = {"output": output.strip(), "exit_code": result.returncode, "done": True}

            return output.strip() or f"(comando completado, código {result.returncode})"
        except subprocess.TimeoutExpired:
            _emit_terminal_event("terminal:agent_exit", {"procId": proc_id, "code": -1})
            _proc_results[proc_id] = {"output": "[Timeout 60s]", "exit_code": -1, "done": True}
            return "[Error: el comando excedió el límite de 60s]"
        except Exception as e:
            _emit_terminal_event("terminal:agent_exit", {"procId": proc_id, "code": -1})
            _proc_results[proc_id] = {"output": str(e), "exit_code": -1, "done": True}
            return f"[Error al ejecutar: {e}]"

    needs_confirmation = get_agent_autonomy() == "always_ask" or not _sanitizer.is_safe(sanitized)
    if needs_confirmation:
        return (
            f"Comando enviado a la terminal (requiere confirmación del usuario): {sanitized[:120]}"
        )
    return f"Comando ejecutándose: {sanitized[:120]}. El usuario puede ver la ejecución en vivo."


@tool
def terminal_execute_background_tool(command: str, label: str | None = None) -> str:
    """
    Ejecuta un comando en un proceso de fondo dedicado, SIN usar la terminal
    interactiva del usuario. Usalo para comandos largos o silenciosos
    (servidores dev, watchers, builds) que no deberían bloquear la terminal
    que el usuario está mirando.

    El resultado aparece como una pestaña nueva de solo lectura en el panel
    de terminal. No devuelve stdout — el usuario ve la salida en vivo en esa
    pestaña.

    Args:
        command: Comando shell a ejecutar.
        label: Nombre corto opcional para la pestaña (por defecto, el comando).

    Returns:
        Confirmación con el identificador del proceso de fondo.
    """
    if not command or not command.strip():
        return "Error: No se proporcionó ningún comando."

    sanitized = _sanitizer.sanitize(command)
    if sanitized is None:
        logger.warning("Background command blocked by sanitizer: %s", command.strip()[:120])
        return "Error de seguridad: comando bloqueado por el sanitizador."

    # Gate de permiso real (mismo que terminal_execute_tool)
    if get_agent_autonomy() == "always_ask" or not _sanitizer.is_safe(sanitized):
        allowed = request_permission_sync_generic(
            kind="terminal_exec",
            subject=command.strip()[:200],
            tool_name="terminal_execute_background_tool",
            preview=f"Comando (fondo): {command.strip()[:500]}",
        )
        if not allowed:
            return "Comando de fondo rechazado por el usuario."

    if _EXECUTE_LOCAL:
        try:
            proc_id = f"bg-{uuid.uuid4().hex[:8]}"
            label_str = f" ({label})" if label else ""
            _emit_terminal_event("terminal:agent_spawn", {"procId": proc_id, "command": sanitized[:200], "label": label or ""})

            result = subprocess.run(
                sanitized, shell=True, capture_output=True, text=True, timeout=300,
            )
            output = result.stdout
            if result.stderr:
                output += result.stderr
            if result.returncode != 0:
                output += f"\n[Exit code: {result.returncode}]"

            if output.strip():
                _emit_terminal_event("terminal:agent_output", {"procId": proc_id, "chunk": output[:10000]})
            _emit_terminal_event("terminal:agent_exit", {"procId": proc_id, "code": result.returncode})

            _proc_results[proc_id] = {"output": output.strip(), "exit_code": result.returncode, "done": True}

            return f"Salida del comando de fondo{label_str}:\n{output.strip()}"
        except subprocess.TimeoutExpired:
            _emit_terminal_event("terminal:agent_exit", {"procId": proc_id, "code": -1})
            _proc_results[proc_id] = {"output": "[Timeout 300s]", "exit_code": -1, "done": True}
            return "[Error: el comando de fondo excedió el límite de 300s]"
        except Exception as e:
            _emit_terminal_event("terminal:agent_exit", {"procId": proc_id, "code": -1})
            _proc_results[proc_id] = {"output": str(e), "exit_code": -1, "done": True}
            return f"[Error al ejecutar comando de fondo: {e}]"

    proc_id = f"bg-{uuid.uuid4().hex[:8]}"
    logger.info("Background terminal spawn requested: %s (%s)", sanitized[:120], proc_id)
    return f"Proceso de fondo iniciado ({proc_id}): {sanitized[:120]}. El usuario lo ve en una pestaña nueva."


@tool
def terminal_check_tool(proc_id: str) -> str:
    """Consulta el resultado de un comando de fondo iniciado previamente.

    Úsalo para saber si un comando en background ya terminó y obtener su salida.

    Args:
        proc_id: El identificador del proceso devuelto por terminal_execute_background_tool.

    Returns:
        Estado del proceso (completado, ejecutando, o no encontrado).
    """
    result = _proc_results.get(proc_id)
    if result is None:
        return (
            f"No se encontró el proceso '{proc_id}'. "
            "Puede que siga ejecutándose (si se inició desde la terminal visible) "
            "o que el ID sea incorrecto."
        )
    if result["done"]:
        out = result.get("output", "").strip()
        code = result["exit_code"]
        status = f"Completado (código {code})"
        if out:
            return f"Proceso '{proc_id}': {status}\n{out[:3000]}"
        return f"Proceso '{proc_id}': {status} (sin salida)"
    return f"Proceso '{proc_id}': aún en ejecución."
