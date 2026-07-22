"""Declarative command execution policy engine.

Reads ``sparta.execpolicy.json`` from the workspace root (optional) and
evaluates shell commands against user-defined rules *after* the hard
``CommandSanitizer`` has already cleared them.

Three decision levels:
  - ``allow``   : skip user-approval (overrides the default prompt).
  - ``prompt``  : ask the user with the rule's justification message.
  - ``forbid``  : block the command outright with the justification.

If no policy file exists, ``evaluate()`` returns ``None`` immediately
(no-op, zero overhead).
"""

import json
import logging
import shlex
from pathlib import Path

logger = logging.getLogger("sparta_ai.security.exec_policy")

_POLICY_FILENAME = "sparta.execpolicy.json"
_cached_policy: dict | None = None
_cached_workspace: str | None = None


def _load_policy(workspace_root: str) -> dict | None:
    """Load and cache the exec-policy JSON from the workspace root."""
    global _cached_policy, _cached_workspace

    if _cached_workspace == workspace_root and _cached_policy is not None:
        return _cached_policy

    policy_path = Path(workspace_root) / _POLICY_FILENAME
    if not policy_path.is_file():
        _cached_policy = None
        _cached_workspace = workspace_root
        return None

    try:
        raw = policy_path.read_text(encoding="utf-8")
        data = json.loads(raw)
        if not isinstance(data, dict) or "rules" not in data:
            logger.warning("execpolicy: invalid format in %s — ignoring", policy_path)
            _cached_policy = None
            _cached_workspace = workspace_root
            return None
        _cached_policy = data
        _cached_workspace = workspace_root
        logger.info("execpolicy: loaded %d rules from %s", len(data["rules"]), policy_path)
        return data
    except Exception as exc:
        logger.error("execpolicy: failed to load %s: %s", policy_path, exc)
        _cached_policy = None
        _cached_workspace = workspace_root
        return None


def _tokenize(command: str) -> list[str]:
    """Best-effort shell tokenisation."""
    try:
        return shlex.split(command)
    except ValueError:
        return command.split()


def _matches(tokens: list[str], pattern: list) -> bool:
    """Check whether *tokens* match *pattern*.

    ``pattern`` is a list that may contain plain strings or sub-lists.
    A sub-list means "any of these alternatives at this position".
    """
    if len(tokens) < len(pattern):
        return False
    for tok, pat in zip(tokens, pattern):
        if isinstance(pat, list):
            if tok not in pat:
                return False
        else:
            if tok != pat:
                return False
    return True


class ExecPolicyResult:
    """Result of an exec-policy evaluation."""

    __slots__ = ("decision", "justification", "rule_pattern")

    def __init__(
        self,
        decision: str,
        justification: str = "",
        rule_pattern: list | None = None,
    ):
        self.decision = decision          # "allow" | "prompt" | "forbid"
        self.justification = justification
        self.rule_pattern = rule_pattern

    def __repr__(self) -> str:
        return f"ExecPolicyResult({self.decision!r}, {self.justification!r})"


def evaluate(command: str, workspace_root: str) -> ExecPolicyResult | None:
    """Evaluate *command* against the project's exec-policy.

    Returns ``None`` when no policy file exists or no rule matches
    (caller should follow its default flow).
    Returns an ``ExecPolicyResult`` when a rule matches.
    """
    policy = _load_policy(workspace_root)
    if policy is None:
        return None

    tokens = _tokenize(command)

    for rule in policy.get("rules", []):
        pattern = rule.get("pattern")
        decision = rule.get("decision", "prompt")
        justification = rule.get("justification", "")

        if not pattern or decision not in ("allow", "prompt", "forbid"):
            continue

        if _matches(tokens, pattern):
            logger.info(
                "execpolicy: command matched pattern %s → %s",
                pattern,
                decision,
            )
            return ExecPolicyResult(
                decision=decision,
                justification=justification,
                rule_pattern=pattern,
            )

    return None
