import logging
from langchain_core.tools import tool
from sparta_ai.security.command_sanitizer import CommandSanitizer

logger = logging.getLogger("sparta_ai.tools.terminal")

_sanitizer = CommandSanitizer()


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
    needs_confirmation = not _sanitizer.is_safe(sanitized)
    if needs_confirmation:
        return (
            f"Comando enviado a la terminal (requiere confirmación del usuario): {sanitized[:120]}"
        )
    return f"Comando ejecutándose: {sanitized[:120]}. El usuario puede ver la ejecución en vivo."
