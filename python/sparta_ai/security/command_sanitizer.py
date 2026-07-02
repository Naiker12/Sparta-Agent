"""Sanitizes shell commands before execution to prevent dangerous operations.

This is a first-line defense — it uses pattern matching to block obviously
dangerous commands. It is NOT a full sandbox. For that, see Docker-based
isolation (future work).
"""
import logging
import re

logger = logging.getLogger("sparta_ai.security.commands")

# Patterns that are always blocked regardless of allowlist
DANGEROUS_PATTERNS: list[re.Pattern] = [
    re.compile(r"\brm\s+(-rf|--recursive|-r|-f)", re.IGNORECASE),
    re.compile(r"\bmv\s+.*\s+/(?:dev|null)", re.IGNORECASE),
    re.compile(r"\bdd\s+if=", re.IGNORECASE),
    re.compile(r"\b(wget|curl)\s+.*[|;]", re.IGNORECASE),
    re.compile(r"\bchmod\s+777", re.IGNORECASE),
    re.compile(r"\bchown\s", re.IGNORECASE),
    re.compile(r"\bsudo\s+rm", re.IGNORECASE),
    re.compile(r"\bmake\s+.*(?:mkfs|format)", re.IGNORECASE),
    re.compile(r"\bmkfs\.", re.IGNORECASE),
    re.compile(r"\bdd\b", re.IGNORECASE),
    re.compile(r">\s*/dev/sd", re.IGNORECASE),
]

# Commands considered safe enough to execute without human confirmation
SAFE_COMMANDS: set[str] = {
    "ls", "cat", "head", "tail", "echo", "pwd", "which",
    "git status", "git log", "git diff", "git branch", "git remote",
    "npm test", "npm run", "pnpm test", "pnpm run", "yarn test", "yarn run",
    "pip list", "pip freeze",
    "python --version", "node --version", "npm --version",
    "dir", "type", "find", "grep", "rg", "ag",
}


class CommandSanitizer:
    """Validates shell commands before execution."""

    def __init__(self):
        self._patterns = DANGEROUS_PATTERNS

    def is_safe(self, command: str) -> bool:
        """Check if a command is safe to execute without human confirmation."""
        stripped = command.strip()
        for safe_cmd in SAFE_COMMANDS:
            if stripped.startswith(safe_cmd):
                return True
        return False

    def is_dangerous(self, command: str) -> bool:
        """Check if a command matches any dangerous pattern."""
        for pattern in self._patterns:
            if pattern.search(command):
                return True
        return False

    def sanitize(self, command: str) -> str | None:
        """Validate a command.

        Returns the original command if it passes checks, or a redacted message
        if it's dangerous, or None if empty.
        """
        if not command or not command.strip():
            return None

        if self.is_dangerous(command):
            logger.warning("Blocked dangerous command: %s", command[:120])
            return None

        return command.strip()
