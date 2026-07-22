import json
import logging
import os
import subprocess
import sys
import uuid
from langchain_core.tools import tool
from sparta_security.command_sanitizer import CommandSanitizer
from sparta_security.rate_limiter import terminal_rate_limiter
from sparta_tools.permission_broker import request_permission_sync_generic, get_agent_autonomy, _current_session

logger = logging.getLogger("sparta_ai.tools.terminal")

_sanitizer = CommandSanitizer()
_EXECUTE_LOCAL = False

# Process result cache: maps proc_id → {"output": str, "exit_code": int, "done": bool}
_proc_results: dict[str, dict] = {}

# Open files in the editor — updated from each chat request
_open_files: list[str] = []

# Sandbox mode: "none" (direct execution) or "docker" (ephemeral container)
_SANDBOX_MODE: str = "none"
_DEFAULT_DOCKER_IMAGE = "ubuntu:latest"
_DOCKER_TIMEOUT = 120


def set_sandbox_mode(mode: str) -> None:
    global _SANDBOX_MODE
    _SANDBOX_MODE = mode


def _run_in_docker(command: str, timeout: int = _DOCKER_TIMEOUT) -> tuple[str, int, bool]:
    """Run a command inside an ephemeral Docker container.

    Returns:
        (output: str, exit_code: int, docker_available: bool)
    """
    root = os.environ.get("SPARTA_WORKSPACE_ROOT", "")
    if not root:
        return "Error: No hay workspace configurado para montar en el contenedor.", -1, True

    # Check Docker is available
    try:
        subprocess.run(["docker", "--version"], capture_output=True, timeout=10)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        logger.warning("Docker not available, falling back to local execution")
        return "", 0, False

    container_name = f"sparta-sandbox-{uuid.uuid4().hex[:12]}"
    docker_cmd = [
        "docker", "run", "--rm",
        "--name", container_name,
        "-v", f"{root}:{root}:ro",  # Bind mount read-only for security
        "-w", root,
        "--network", "none",  # No network access from sandbox
        "--memory", "512m",   # Limit memory
        "--cpus", "1",        # Limit CPU
        _DEFAULT_DOCKER_IMAGE,
        "sh", "-c", command,
    ]

    try:
        result = subprocess.run(
            docker_cmd,
            capture_output=True, text=True,
            timeout=timeout,
        )
        output = result.stdout
        if result.stderr:
            output += f"\n[stderr]\n{result.stderr}"
        return output.strip(), result.returncode, True
    except FileNotFoundError:
        logger.warning("Docker binary not found")
        return "", 0, False
    except subprocess.TimeoutExpired:
        # Kill the container if it times out
        subprocess.run(["docker", "kill", container_name], capture_output=True, timeout=5)
        return f"[Timeout: el comando excedió el límite de {timeout}s en el sandbox]", -1, True
    except Exception as e:
        return f"[Error en sandbox Docker: {e}]", -1, True


def _set_open_files(files: list[str]) -> None:
    global _open_files
    _open_files = files


def _execute_command(command: str, timeout: int) -> tuple[str, int]:
    """Execute a command either directly or in a Docker sandbox.

    Returns:
        (output: str, exit_code: int)
    """
    if _SANDBOX_MODE == "docker":
        output, code, available = _run_in_docker(command, timeout)
        if available:
            return output, code
        # Docker not available, fall through to local
        logger.warning("Docker sandbox requested but not available, running locally")

    root = os.environ.get("SPARTA_WORKSPACE_ROOT") or None

    try:
        result = subprocess.run(
            command, shell=True, capture_output=True, text=True, timeout=timeout,
            cwd=root,
            stdin=subprocess.DEVNULL,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        output = (result.stdout or "") + (result.stderr or "")
        return output.strip(), result.returncode
    except subprocess.TimeoutExpired:
        return f"[Timeout: el comando excedió el límite de {timeout}s]", -1
    except Exception as e:
        logger.error("terminal_execute_tool crashed unexpectedly: %s", e, exc_info=True)
        _emit_terminal_event("terminal:tool_crash", {"error": str(e)})
        return f"[Error interno al ejecutar el comando: {e}]", -1


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

    # Exec policy check (after sanitizer, before permission gate)
    from sparta_security.exec_policy import evaluate as eval_policy
    workspace_root = os.environ.get("SPARTA_WORKSPACE_ROOT", "")
    policy_result = eval_policy(sanitized, workspace_root)
    if policy_result is not None:
        if policy_result.decision == "forbid":
            just = policy_result.justification or "Comando prohibido por la política del proyecto."
            logger.warning("Terminal command forbidden by exec policy: %s", sanitized[:120])
            return f"Error de seguridad: {just}"
        elif policy_result.decision == "allow":
            logger.info("Terminal command allowed by exec policy: %s", sanitized[:120])
            # Skip permission gate — proceed directly to execution
            if _EXECUTE_LOCAL or _SANDBOX_MODE == "docker":
                proc_id = f"term-{uuid.uuid4().hex[:8]}"
                _emit_terminal_event("terminal:agent_spawn", {"procId": proc_id, "command": sanitized[:200]})
                output, code = _execute_command(sanitized, timeout=60)
                if output:
                    _emit_terminal_event("terminal:agent_output", {"procId": proc_id, "chunk": output[:5000]})
                _emit_terminal_event("terminal:agent_exit", {"procId": proc_id, "code": code})
                _emit_terminal_event("file:changed", {"path": os.environ.get("SPARTA_WORKSPACE_ROOT", "")})
                _proc_results[proc_id] = {"output": output, "exit_code": code, "done": True}
                return output or f"(comando completado, código {code})"
            return f"Comando ejecutándose: {sanitized[:120]}. El usuario puede ver la ejecución en vivo."
        elif policy_result.decision == "prompt":
            just = policy_result.justification or "Requiere confirmación según la política del proyecto."
            allowed = request_permission_sync_generic(
                kind="terminal_exec",
                subject=f"[Política] {just}\n\nComando: {command.strip()[:200]}",
                tool_name="terminal_execute_tool",
                preview=f"[Política del proyecto]\n{just}\n\nComando: {command.strip()[:500]}",
            )
            if not allowed:
                return "Comando rechazado por el usuario (política del proyecto)."

    session_id = _current_session.get()
    if session_id and not terminal_rate_limiter.check(session_id):
        logger.warning("Terminal command rate-limited for session %s", session_id[:40])
        return (
            "Error de rate limit: se alcanzó el límite de comandos por sesión. "
            "Esperá unos segundos y volvé a intentar."
        )

    logger.info("Terminal command queued: %s", sanitized[:120])

    if get_agent_autonomy() == "always_ask" or not _sanitizer.is_safe(sanitized):
        allowed = request_permission_sync_generic(
            kind="terminal_exec",
            subject=command.strip()[:200],
            tool_name="terminal_execute_tool",
            preview=f"Comando: {command.strip()[:500]}",
        )
        if not allowed:
            return "Comando rechazado por el usuario."
    if _EXECUTE_LOCAL or _SANDBOX_MODE == "docker":
        proc_id = f"term-{uuid.uuid4().hex[:8]}"
        _emit_terminal_event("terminal:agent_spawn", {"procId": proc_id, "command": sanitized[:200]})

        output, code = _execute_command(sanitized, timeout=60)

        # Stream output to the terminal tab
        if output:
            _emit_terminal_event("terminal:agent_output", {"procId": proc_id, "chunk": output[:5000]})
        _emit_terminal_event("terminal:agent_exit", {"procId": proc_id, "code": code})

        # Notify frontend to refresh file tree after command execution
        _emit_terminal_event("file:changed", {"path": os.environ.get("SPARTA_WORKSPACE_ROOT", "")})

        # Cache result for terminal_check_tool
        _proc_results[proc_id] = {"output": output, "exit_code": code, "done": True}

        return output or f"(comando completado, código {code})"

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

    # Exec policy check (after sanitizer, before permission gate)
    from sparta_security.exec_policy import evaluate as eval_policy
    workspace_root = os.environ.get("SPARTA_WORKSPACE_ROOT", "")
    policy_result = eval_policy(sanitized, workspace_root)
    if policy_result is not None:
        if policy_result.decision == "forbid":
            just = policy_result.justification or "Comando prohibido por la política del proyecto."
            logger.warning("Background command forbidden by exec policy: %s", sanitized[:120])
            return f"Error de seguridad: {just}"
        elif policy_result.decision == "allow":
            logger.info("Background command allowed by exec policy: %s", sanitized[:120])
            if _EXECUTE_LOCAL or _SANDBOX_MODE == "docker":
                proc_id = f"bg-{uuid.uuid4().hex[:8]}"
                label_str = f" ({label})" if label else ""
                _emit_terminal_event("terminal:agent_spawn", {
                    "procId": proc_id, "command": sanitized[:200], "label": label or "",
                })
                output, code = _execute_command(sanitized, timeout=300)
                if output:
                    _emit_terminal_event("terminal:agent_output", {
                        "procId": proc_id, "chunk": output[:10000],
                    })
                _emit_terminal_event("terminal:agent_exit", {"procId": proc_id, "code": code})
                _emit_terminal_event("file:changed", {"path": os.environ.get("SPARTA_WORKSPACE_ROOT", "")})
                _proc_results[proc_id] = {"output": output, "exit_code": code, "done": True}
                return f"Salida del comando de fondo{label_str}:\n{output}"
            return (
                f"Comando de fondo ejecutándose: {sanitized[:120]}. "
                "El usuario lo ve en una pestaña nueva."
            )
        elif policy_result.decision == "prompt":
            just = policy_result.justification or "Requiere confirmación según la política del proyecto."
            allowed = request_permission_sync_generic(
                kind="terminal_exec",
                subject=f"[Política] {just}\n\nComando: {command.strip()[:200]}",
                tool_name="terminal_execute_background_tool",
                preview=f"[Política del proyecto]\n{just}\n\nComando (fondo): {command.strip()[:500]}",
            )
            if not allowed:
                return "Comando de fondo rechazado por el usuario (política del proyecto)."

    session_id = _current_session.get()
    if session_id and not terminal_rate_limiter.check(session_id):
        logger.warning("Background command rate-limited for session %s", session_id[:40])
        return "Error de rate limit: se alcanzó el límite de comandos por sesión."

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

    if _EXECUTE_LOCAL or _SANDBOX_MODE == "docker":
        proc_id = f"bg-{uuid.uuid4().hex[:8]}"
        label_str = f" ({label})" if label else ""
        _emit_terminal_event("terminal:agent_spawn", {"procId": proc_id, "command": sanitized[:200], "label": label or ""})

        output, code = _execute_command(sanitized, timeout=300)

        if output:
            _emit_terminal_event("terminal:agent_output", {"procId": proc_id, "chunk": output[:10000]})
        _emit_terminal_event("terminal:agent_exit", {"procId": proc_id, "code": code})

        # Notify frontend to refresh file tree after command execution
        _emit_terminal_event("file:changed", {"path": os.environ.get("SPARTA_WORKSPACE_ROOT", "")})

        _proc_results[proc_id] = {"output": output, "exit_code": code, "done": True}

        return f"Salida del comando de fondo{label_str}:\n{output}"

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


@tool
def get_open_files_tool() -> str:
    """Devuelve la lista de archivos abiertos actualmente en el editor.

    Úsalo para saber qué archivos está viendo el usuario y priorizar contexto.
    Los archivos se listan en orden de apertura (el último es el activo).

    Returns:
        Lista de rutas de archivos abiertos en el editor.
    """
    if not _open_files:
        return "No hay archivos abiertos en el editor."
    lines = [f"Archivos abiertos en el editor ({len(_open_files)}):"]
    for i, fp in enumerate(_open_files, 1):
        marker = "  ►" if i == len(_open_files) else "   "
        lines.append(f"{marker} {fp}")
    return "\n".join(lines)
