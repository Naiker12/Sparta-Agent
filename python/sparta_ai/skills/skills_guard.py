"""Static analysis security guard for skill installation.

Scans incoming SKILL.md / skill files for dangerous patterns before
they are written to disk. Prevents prompt injection, code execution,
and filesystem abuse via skill content.
"""
import logging
import re
from typing import Any

logger = logging.getLogger("sparta_ai.skills_guard")

DANGEROUS_PATTERNS: list[tuple[str, str, str]] = [
    ("exec_eval", r"\b(exec|eval|compile|__import__)\s*\(", "Dynamic code execution detected"),
    ("subprocess", r"\b(subprocess|os\.system|os\.popen|shutil\.rmtree)\s*\.", "Shell/process execution detected"),
    ("file_write", r"\b(open|write|mkdir|rmdir|unlink|chmod)\s*\(.*['\"`]", "File modification outside skill scope"),
    ("base64_decode", r"base64\.(b64decode|decode)", "Obfuscated payload may be present"),
    ("requests_outbound", r"(requests|urllib|httpx)\.(get|post|put|delete)\s*\(", "Outbound network request detected"),
    ("import_statement", r"^import\s+(os|subprocess|shutil|sys|ctypes)", "Restricted module import"),
    ("path_traversal", r"\.\./|\.\.\\\\", "Path traversal attempt detected"),
    ("env_access", r"os\.environ|os\.getenv", "Environment variable access in skill"),
]

TRUSTED_SOURCES = {"builtin", "agentskills.io", "github.com/anthropics"}


def scan_skill_content(content: str, filename: str = "SKILL.md") -> dict[str, Any]:
    """Scan skill content for dangerous patterns.

    Returns:
        {
            "passed": bool,
            "warnings": list[str],
            "risk_score": int,       # 0-100
            "risk_level": "low"|"medium"|"high"|"critical"
        }
    """
    findings: list[tuple[str, int]] = []  # (description, severity 1-5)

    for rule_id, pattern, description in DANGEROUS_PATTERNS:
        matches = re.findall(pattern, content, re.IGNORECASE | re.MULTILINE)
        if matches:
            severity = min(len(matches), 5)
            findings.append((f"[{rule_id}] {description} ({len(matches)} match(es))", severity))

    risk_score = min(sum(s for _, s in findings) * 10, 100)

    if risk_score == 0:
        risk_level = "low"
    elif risk_score <= 30:
        risk_level = "medium"
    elif risk_score <= 70:
        risk_level = "high"
    else:
        risk_level = "critical"

    warnings = [f for f, _ in findings]

    return {
        "passed": risk_level not in ("high", "critical"),
        "warnings": warnings,
        "risk_score": risk_score,
        "risk_level": risk_level,
    }


def is_source_trusted(source: str) -> bool:
    """Check if a source URL is in the trusted list."""
    source_lower = source.lower().rstrip("/")
    for trusted in TRUSTED_SOURCES:
        if trusted in source_lower:
            return True
    return False
