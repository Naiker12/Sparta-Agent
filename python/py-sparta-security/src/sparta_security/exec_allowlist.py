"""Declarative execution allowlist for terminal commands.

Inspired by codex-rs/execpolicy — provides a default allowlist of binaries
that are safe to execute without user confirmation. Any command whose
first token is NOT in this list requires approval via the active
ApprovalPolicy, regardless of the current mode.

This is NOT a full sandbox (no OS-level isolation). It is a second layer
of defense after CommandSanitizer: even if a dangerous pattern slips
through the regex, it still needs to be an allowed binary to execute.

The allowlist can be extended per-project via ``sparta.execpolicy.json``
(see exec_policy.py).
"""
import logging
import shlex

logger = logging.getLogger("sparta_ai.security.exec_allowlist")

# ── Default allowlist ─────────────────────────────────────────
# Commands whose first token must be one of these to be auto-approved.
# Anything not listed here requires ASK approval.

# Read-only commands — always safe
_READ_ONLY_BINARIES: frozenset[str] = frozenset({
    "ls", "dir", "cat", "head", "tail", "echo", "pwd", "which", "where",
    "whoami", "id", "date", "cal", "uptime", "uname",
    "env", "printenv",
    "find", "grep", "rg", "ag", "tree", "wc", "sort", "uniq", "cut",
    "tr", "sed", "awk", "jq", "yq",
    "type", "file", "stat", "du", "df",
    "git status", "git log", "git diff", "git branch", "git remote",
    "git show", "git tag", "git blame",
    "pnpm ls", "npm ls", "yarn list",
    "pip list", "pip freeze", "pip show",
    "python --version", "python3 --version", "node --version",
    "npm --version", "pnpm --version", "yarn --version",
})

# Dev commands — safe within workspace context
_DEV_BINARIES: frozenset[str] = frozenset({
    "node", "npm", "pnpm", "yarn", "npx",
    "python", "python3", "pip", "pip3", "uv", "poetry",
    "pytest", "jest", "vitest", "mocha", "eslint", "prettier",
    "tsc", "esbuild", "webpack", "vite",
    "git", "gh", "docker", "docker-compose",
    "cargo", "rustc", "go", "java", "javac",
    "make", "cmake", "meson",
    "cargo test", "cargo build", "cargo run", "cargo clippy",
    "go test", "go build", "go run",
})

# All allowed binaries (union of above)
ALLOWED_BINARIES: frozenset[str] = _READ_ONLY_BINARIES | _DEV_BINARIES


def _tokenize_first_command(command: str) -> list[str]:
    """Extract the first command from a shell string, splitting on metacharacters."""
    # Split on shell metacharacters to isolate the first command
    for sep in (";", "|", "&&", "||", "`", "$(", "\n", "\r\n"):
        idx = command.find(sep)
        if idx >= 0:
            command = command[:idx]
    command = command.strip()
    if not command:
        return []
    try:
        return shlex.split(command)
    except ValueError:
        return command.split()


def is_command_allowed(command: str) -> bool:
    """Check if a command's first token is in the allowlist.

    Returns True if the command is safe to execute without user approval.
    Returns False if it requires approval (binary not in allowlist).
    """
    tokens = _tokenize_first_command(command)
    if not tokens:
        return False

    first_token = tokens[0]
    # Check bare binary name
    if first_token in ALLOWED_BINARIES:
        return True

    # Check "git status", "git log" etc (two-word commands)
    if len(tokens) >= 2:
        two_word = f"{tokens[0]} {tokens[1]}"
        if two_word in ALLOWED_BINARIES:
            return True

    return False


def get_denied_reason(command: str) -> str | None:
    """Return a human-readable reason why a command is not in the allowlist.

    Returns None if the command is allowed.
    """
    tokens = _tokenize_first_command(command)
    if not tokens:
        return "Comando vacío"

    first_token = tokens[0]
    if first_token in ALLOWED_BINARIES:
        return None

    if len(tokens) >= 2:
        two_word = f"{tokens[0]} {tokens[1]}"
        if two_word in ALLOWED_BINARIES:
            return None

    return f"Binario '{first_token}' no está en la allowlist de ejecución segura"
