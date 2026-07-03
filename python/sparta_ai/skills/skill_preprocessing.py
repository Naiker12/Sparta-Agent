"""Skill content preprocessing — template variable substitution and inline shell execution.

Before the agent sees skill content, two transformations can be applied:

1. Template variable substitution:
   - ${HERMES_SKILL_DIR} → skill directory path
   - ${HERMES_SESSION_ID} → current session ID
   - ${HERMES_USER_NAME} → current user name (if available)
   - ${HERMES_OS} → platform identifier (windows/macos/linux)

2. Inline shell execution (DISABLED by default for security):
   !`command` → replaced with stdout of command

Configurable via SPARTA_SKILL_TEMPLATE_VARS and SPARTA_SKILL_INLINE_SHELL env vars.
"""
import logging
import os
import platform as _platform
import re
import subprocess
import sys
from typing import Any

logger = logging.getLogger("sparta_ai.skills.preprocessing")

# Whether template variable substitution is enabled (default: True)
_TEMPLATE_VARS_ENABLED = os.environ.get("SPARTA_SKILL_TEMPLATE_VARS", "1") not in ("0", "false", "no")

# Whether inline shell execution is enabled (default: False - SECURITY)
_INLINE_SHELL_ENABLED = os.environ.get("SPARTA_SKILL_INLINE_SHELL", "0") not in ("0", "false", "no")

# Inline shell timeout in seconds
_INLINE_SHELL_TIMEOUT = int(os.environ.get("SPARTA_SKILL_INLINE_SHELL_TIMEOUT", "10"))

_TEMPLATE_RE = re.compile(r"\$\{(HERMES_\w+)\}")
_INLINE_SHELL_RE = re.compile(r"!`([^`]+)`")


def _get_template_vars(skill_dir: str = "", session_id: str = "") -> dict[str, str]:
    """Get available template variables."""
    return {
        "HERMES_SKILL_DIR": skill_dir or os.getcwd(),
        "HERMES_SESSION_ID": session_id or "unknown",
        "HERMES_USER_NAME": os.environ.get("USER", os.environ.get("USERNAME", "unknown")),
        "HERMES_OS": _platform.system().lower(),
    }


def _substitute_template_vars(text: str, skill_dir: str = "", session_id: str = "") -> str:
    """Substitute ${HERMES_*} template variables in text."""
    if not _TEMPLATE_VARS_ENABLED:
        return text
    vars_map = _get_template_vars(skill_dir, session_id)

    def _replace(m: re.Match) -> str:
        var_name = m.group(1)
        return vars_map.get(var_name, m.group(0))

    return _TEMPLATE_RE.sub(_replace, text)


def _execute_inline_shell(text: str) -> str:
    """Execute !`command` blocks and replace with stdout.

    SECURITY: This is DISABLED by default. Enable with SPARTA_SKILL_INLINE_SHELL=1.
    Only run this on trusted skill content.
    """
    if not _INLINE_SHELL_ENABLED:
        return _INLINE_SHELL_RE.sub(
            r"[inline shell disabled — set SPARTA_SKILL_INLINE_SHELL=1 to enable]",
            text,
        )

    def _run_cmd(m: re.Match) -> str:
        cmd = m.group(1).strip()
        try:
            result = subprocess.run(
                cmd,
                shell=True,
                capture_output=True,
                text=True,
                timeout=_INLINE_SHELL_TIMEOUT,
            )
            output = result.stdout.strip()
            if result.returncode != 0:
                logger.warning("Inline shell command failed (exit %d): %s", result.returncode, cmd[:60])
                return f"[command failed with exit {result.returncode}]"
            return output if output else "[no output]"
        except subprocess.TimeoutExpired:
            logger.warning("Inline shell command timed out (%ds): %s", _INLINE_SHELL_TIMEOUT, cmd[:60])
            return f"[command timed out after {_INLINE_SHELL_TIMEOUT}s]"
        except OSError as e:
            logger.warning("Inline shell command error: %s", e)
            return f"[command error: {e}]"

    return _INLINE_SHELL_RE.sub(_run_cmd, text)


def preprocess_skill_content(
    text: str,
    skill_dir: str = "",
    session_id: str = "",
) -> str:
    """Apply all preprocessing steps to skill content.

    Order:
    1. Inline shell execution (disabled by default)
    2. Template variable substitution

    Args:
        text: Raw SKILL.md content.
        skill_dir: Path to the skill directory (for ${HERMES_SKILL_DIR}).
        session_id: Current session ID (for ${HERMES_SESSION_ID}).

    Returns:
        Preprocessed content string.
    """
    result = text
    # Step 1: Inline shell (before template vars so shell output can use vars)
    result = _execute_inline_shell(result)
    # Step 2: Template variable substitution
    result = _substitute_template_vars(result, skill_dir, session_id)
    return result


def is_inline_shell_enabled() -> bool:
    """Check if inline shell execution is enabled."""
    return _INLINE_SHELL_ENABLED
