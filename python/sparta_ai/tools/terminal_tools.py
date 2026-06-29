import logging
from langchain_core.tools import tool

logger = logging.getLogger("sparta_ai.tools.terminal")


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

    logger.info("Terminal command queued: %s", command.strip()[:120])
    return f"Comando enviado a la terminal. El usuario puede ver la ejecución en vivo."
