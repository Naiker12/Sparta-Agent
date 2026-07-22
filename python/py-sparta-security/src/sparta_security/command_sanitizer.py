"""Sanitizes shell commands before execution to prevent dangerous operations.

This is a first-line defense — it uses pattern matching to block obviously
dangerous commands. It is NOT a full sandbox. For that, see Docker-based
isolation (future work).

Second layer: exec_allowlist.py provides a binary allowlist that restricts
which binaries can execute without user confirmation, regardless of this
sanitizer's output.
"""
import logging
import re

from sparta_security.exec_allowlist import is_command_allowed

logger = logging.getLogger("sparta_ai.security.commands")

# Patterns that are always blocked regardless of allowlist.
# Covers destructive filesystem ops, crypto ransomware patterns,
# network pivoting, and privilege escalation.
DANGEROUS_PATTERNS: list[re.Pattern] = [
    # ── rm -rf / (any path outside cwd) ──
    re.compile(r"\brm\s+(-rf|--recursive|-r|-f)\s+[/\\~]", re.IGNORECASE),
    re.compile(r"\brm\s+(-rf|--recursive|-r|-f)\s+\.\.", re.IGNORECASE),
    re.compile(r"\brm\s+(-rf|--recursive|-r|-f)\s", re.IGNORECASE),
    re.compile(r"\brmdir\s+[/\\]", re.IGNORECASE),

    # ── Dangerous redirects to raw devices / special files ──
    re.compile(r">\s*/dev/", re.IGNORECASE),
    re.compile(r">\s*\\\\\\\\.\\\\", re.IGNORECASE),
    re.compile(r"dd\s+if=.*\s+of=", re.IGNORECASE),
    re.compile(r"\bmkfs\.", re.IGNORECASE),
    re.compile(r"\bfdisk\s+", re.IGNORECASE),
    re.compile(r"\bformat\s+\w:", re.IGNORECASE),
    re.compile(r"\bmkswap\b", re.IGNORECASE),

    # ── Crypto / ransomware patterns (write + delete cascade) ──
    re.compile(r"\bgpg\s+--symmetric\s+--passphrase", re.IGNORECASE),
    re.compile(r"\bopenssl\s+enc\s+-aes-256-cbc\s+-salt\s+-in\s+.*-out\s+.*-k\s+", re.IGNORECASE),
    re.compile(r"\bfind\s+/.*-exec\s+rm", re.IGNORECASE),
    re.compile(r"\bfind\s+/.*-delete", re.IGNORECASE),
    re.compile(r"\bshred\s+", re.IGNORECASE),
    re.compile(r"\bwipe\s+", re.IGNORECASE),
    re.compile(r"\bsrm\s+", re.IGNORECASE),

    # ── Remote fetch + pipe-to-shell (supply-chain / drive-by) ──
    re.compile(r"(wget|curl)\s+.*[|;]", re.IGNORECASE),
    re.compile(r"(wget|curl)\s+.*\|\s*(ba|z)?sh", re.IGNORECASE),
    re.compile(r"(wget|curl)\s+.*-O\s*-", re.IGNORECASE),
    re.compile(r"\bbash\s+<(wget|curl)", re.IGNORECASE),

    # ── Privilege escalation / system tampering ──
    re.compile(r"\bsudo\s+rm", re.IGNORECASE),
    re.compile(r"\bsudo\s+dd", re.IGNORECASE),
    re.compile(r"\bsudo\s+mkfs", re.IGNORECASE),
    re.compile(r"\bsu\s+-", re.IGNORECASE),
    re.compile(r"\bchmod\s+777\s+", re.IGNORECASE),
    re.compile(r"\bchmod\s+4777\s+", re.IGNORECASE),
    re.compile(r"\bchown\s", re.IGNORECASE),
    re.compile(r"\bpasswd\b", re.IGNORECASE),
    re.compile(r"\bvipw\b", re.IGNORECASE),
    re.compile(r"\bvisudo\b", re.IGNORECASE),

    # ── Network pivoting / internal service discovery ──
    re.compile(r"\bnmap\s+", re.IGNORECASE),
    re.compile(r"\bmasscan\s+", re.IGNORECASE),
    re.compile(r"\bnc\s+-[lv]", re.IGNORECASE),
    re.compile(r"\bsocat\s+", re.IGNORECASE),
    re.compile(r"\bssh\s+.*-L\s+", re.IGNORECASE),
    re.compile(r"\bssh\s+.*-R\s+", re.IGNORECASE),
    re.compile(r"\bssh\s+.*-D\s+", re.IGNORECASE),
    re.compile(r"\bproxychains\s+", re.IGNORECASE),

    # ── Windows-specific destructive ──
    re.compile(r"\bdel\s+/[fFsS]", re.IGNORECASE),
    re.compile(r"\brd\s+/[sSq]", re.IGNORECASE),
    re.compile(r"\bcipher\s+/w:", re.IGNORECASE),
    re.compile(r"\bformat\s+/[qQ]", re.IGNORECASE),
    re.compile(r"\bdiskpart\b", re.IGNORECASE),

    # ── Environment / credential exfiltration ──
    re.compile(r"\bexport\s+.*=.*\(`", re.IGNORECASE),
    re.compile(r"\becho\s+.*\$\(.*\$", re.IGNORECASE),
    re.compile(r">\s*(sparta-vault\.json|\.env|id_rsa|id_ed25519)", re.IGNORECASE),
]

# Commands considered safe enough to execute without human confirmation.
# Each entry must match the START of a single command (before any shell
# metacharacter like ; | && ||).
SAFE_COMMANDS: set[str] = {
    "ls", "cat", "head", "tail", "echo", "pwd", "which", "whoami", "id",
    "git status", "git log", "git diff", "git branch", "git remote",
    "npm test", "pnpm test", "yarn test",
    "npm ls", "pnpm ls", "yarn list",
    "pip list", "pip freeze", "pip show",
    "python --version", "python3 --version", "node --version", "npm --version",
    "dir", "type", "find", "grep", "rg", "ag", "tree",
    "date", "cal", "uptime", "uname", "who", "w",
    "env", "printenv",
}


class CommandSanitizer:
    """Validates shell commands before execution."""

    def __init__(self):
        self._patterns = DANGEROUS_PATTERNS

    @staticmethod
    def _first_command(cmd: str) -> str:
        """Extract the first command before shell metacharacters."""
        for sep in (";", "|", "&&", "||", "`", "$(", "\n", "\r\n"):
            idx = cmd.find(sep)
            if idx >= 0:
                cmd = cmd[:idx]
        return cmd.strip()

    def is_safe(self, command: str) -> bool:
        """Check if a command is safe to execute without human confirmation.

        Only checks the FIRST command in a chain — chained commands with
        ``;``, ``|``, ``&&``, ``||`` are never considered safe.

        Two-layer check:
          1. Must not be in SAFE_COMMANDS (read-only, known-safe prefixes)
          2. Must be in the exec_allowlist (binary allowlist from exec_allowlist.py)
        """
        stripped = command.strip()
        # Chained commands are never auto-approved
        for sep in (";", "|", "&&", "||", "`", "$("):
            if sep in stripped:
                return False
        first = self._first_command(stripped)
        if not first:
            return False
        # Check SAFE_COMMANDS (legacy, kept for backward compat)
        for safe_cmd in SAFE_COMMANDS:
            if first == safe_cmd or first.startswith(safe_cmd + " "):
                return True
        # Check exec_allowlist (declarative binary allowlist)
        return is_command_allowed(first)

    def is_dangerous(self, command: str) -> bool:
        """Check if a command matches any dangerous pattern."""
        for pattern in self._patterns:
            if pattern.search(command):
                return True
        return False

    def sanitize(self, command: str) -> str | None:
        """Validate a command.

        Returns the original command if it passes checks, or None if
        the command is empty, dangerous, or contains shell metacharacters
        in combination with dangerous operations.
        """
        cmd = command.strip()
        if not cmd:
            return None

        if self.is_dangerous(cmd):
            logger.warning("Blocked dangerous command: %s", cmd[:120])
            return None

        return cmd
