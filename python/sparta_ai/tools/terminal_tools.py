import logging
import subprocess
import uuid
from langchain_core.tools import tool
from sparta_ai.security.command_sanitizer import CommandSanitizer
from sparta_ai.tools.permission_broker import request_permission_sync_generic

logger = logging.getLogger("sparta_ai.tools.terminal")

_sanitizer = CommandSanitizer()
_EXECUTE_LOCAL = False


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

    # NUEVO: gate de permiso real, igual que file_tools.py
    # Los comandos no seguros requieren confirmación explícita del usuario
    if not _sanitizer.is_safe(sanitized):
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
            result = subprocess.run(
                sanitized, shell=True, capture_output=True, text=True, timeout=60,
            )
            output = result.stdout
            if result.stderr:
                output += result.stderr
            if result.returncode != 0:
                output += f"\n[Exit code: {result.returncode}]"
            return output.strip() or f"(comando completado, código {result.returncode})"
        except subprocess.TimeoutExpired:
            return "[Error: el comando excedió el límite de 60s]"
        except Exception as e:
            return f"[Error al ejecutar: {e}]"

    needs_confirmation = not _sanitizer.is_safe(sanitized)
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

    if _EXECUTE_LOCAL:
        try:
            result = subprocess.run(
                sanitized, shell=True, capture_output=True, text=True, timeout=300,
            )
            output = result.stdout
            if result.stderr:
                output += result.stderr
            if result.returncode != 0:
                output += f"\n[Exit code: {result.returncode}]"
            label_str = f" ({label})" if label else ""
            return f"Salida del comando de fondo{label_str}:\n{output.strip()}"
        except subprocess.TimeoutExpired:
            return "[Error: el comando de fondo excedió el límite de 300s]"
        except Exception as e:
            return f"[Error al ejecutar comando de fondo: {e}]"

    proc_id = f"bg-{uuid.uuid4().hex[:8]}"
    logger.info("Background terminal spawn requested: %s (%s)", sanitized[:120], proc_id)
    return f"Proceso de fondo iniciado ({proc_id}): {sanitized[:120]}. El usuario lo ve en una pestaña nueva."
