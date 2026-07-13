"""Execute external hook commands with timeout and capture."""

import logging
import os
import subprocess

logger = logging.getLogger("sparta_ai.hooks.runner")

_DEFAULT_TIMEOUT = 10


def run_hooks(
    hooks: list[dict],
    event: str,
    tool_name: str = "",
    tool_input: str = "",
    workspace_root: str = "",
) -> tuple[bool, str]:
    """Run a list of hook commands for *event*.

    Args:
        hooks:          List of hook dicts from ``sparta.hooks.json``.
        event:          The event name (e.g. ``"PreToolUse"``).
        tool_name:      Name of the tool being invoked (for ``matcher`` filtering).
        tool_input:     Serialized tool input (for informational logging).
        workspace_root: Working directory for the subprocess.

    Returns:
        ``(allowed, output)`` — if any hook returns non-zero the command is
        considered blocked (``allowed=False``).  ``output`` contains combined
        stdout+stderr of all hooks run.
    """
    allowed = True
    combined_output: list[str] = []

    for hook_entry in hooks:
        if not isinstance(hook_entry, dict):
            continue

        # Optional matcher: only run if tool_name matches
        matcher = hook_entry.get("matcher", "")
        if matcher and tool_name:
            if not _tool_matches(matcher, tool_name):
                continue

        command = hook_entry.get("command", "")
        if not command:
            continue

        timeout = int(hook_entry.get("timeout", _DEFAULT_TIMEOUT))

        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=timeout,
                cwd=workspace_root or None,
                env={**os.environ, "SPARTA_EVENT": event, "SPARTA_TOOL": tool_name},
            )

            stdout = (result.stdout or "").strip()
            stderr = (result.stderr or "").strip()
            output = stdout or stderr

            if result.returncode != 0:
                allowed = False
                msg = (
                    f"Hook bloqueó la operación (exit {result.returncode})"
                    f"{f': {output[:200]}' if output else ''}"
                )
                combined_output.append(msg)
                logger.warning("hooks: %s hook blocked (%s): %s", event, command, msg)
            elif output:
                combined_output.append(output)
                logger.debug("hooks: %s hook output (%s): %s", event, command, output[:200])

        except subprocess.TimeoutExpired:
            msg = f"Hook excedió timeout de {timeout}s: {command}"
            combined_output.append(msg)
            logger.warning("hooks: %s %s", event, msg)
        except Exception as exc:
            msg = f"Hook error ({command}): {exc}"
            combined_output.append(msg)
            logger.error("hooks: %s %s", event, msg)

    return allowed, "\n".join(combined_output)


def _tool_matches(pattern: str, tool_name: str) -> bool:
    """Simple substring/regex match of pattern against tool_name."""
    import re
    try:
        return bool(re.search(pattern, tool_name))
    except re.error:
        return pattern in tool_name
