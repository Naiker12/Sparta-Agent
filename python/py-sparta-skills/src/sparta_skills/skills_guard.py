"""Static analysis security guard for skill installation and runtime detection.

Scans incoming SKILL.md files for dangerous patterns before
they are written to disk. Prevents prompt injection, code execution,
and filesystem abuse via skill content.

Also provides runtime detection of skill activation during LLM thinking.

Expanded pattern set inspired by Hermes Agent's skills_guard.py (70+ patterns).
"""
import logging
import platform
import re
import sys
from typing import Any

logger = logging.getLogger("sparta_ai.skills_guard")

DANGEROUS_PATTERNS: list[tuple[str, str, str, int]] = [
    # ── Code Execution (severity 5) ──────────────────────────────
    ("exec_eval", r"\b(exec|eval|compile|__import__)\s*\(", "Dynamic code execution", 5),
    ("subprocess_shell", r"\b(subprocess\.(call|run|Popen|check_call|check_output)\s*\()", "Subprocess shell execution", 5),
    ("os_system", r"\bos\.(system|popen)\s*\(", "OS command execution", 5),
    ("shutil_rmtree", r"\bshutil\.rmtree\s*\(", "Recursive directory deletion", 5),
    ("os_remove", r"\bos\.(remove|unlink|rmdir)\s*\(", "File/directory deletion", 5),
    ("ctypes_injection", r"\bctypes\.(CDLL|windll|cdll)\s*\(", "Native code loading via ctypes", 5),
    ("pickle_load", r"\b(pickle|cloudpickle|dill)\.(load|loads)\s*\(", "Deserialization of untrusted pickle", 5),
    ("shelve_open", r"\bshelve\.open\s*\(", "Persistent dict with potential code exec", 5),
    ("marshal_load", r"\bmarshal\.(load|loads)\s*\(", "Unsafe deserialization", 5),

    # ── File System Access (severity 4) ──────────────────────────
    ("file_write", r"\b(open|write|mkdir|makedirs|chmod|chown)\s*\(.*['\"`]", "File modification outside skill scope", 4),
    ("file_delete", r"\b(os\.(remove|unlink|rmdir)|shutil\.(rmtree|move|copy))\s*\(", "File system modification", 4),
    ("tempfile_danger", r"\btempfile\.(mkstemp|mkdtemp|TemporaryFile)\s*\(", "Temporary file creation (abuse risk)", 3),
    ("path_traversal", r"\.\./|\.\.\\\\", "Path traversal attempt", 5),
    ("symlink", r"\bos\.symlink\s*\(", "Symlink creation (escape risk)", 4),

    # ── Network / Exfiltration (severity 4) ──────────────────────
    ("requests_outbound", r"\b(requests|urllib|httpx|aiohttp)\.(get|post|put|delete|patch)\s*\(", "Outbound network request", 4),
    ("socket_connect", r"\bsocket\.(connect|send|sendto)\s*\(", "Raw socket connection", 4),
    ("webrtc_outbound", r"\b(websocket|WebSocket)\s*\(", "WebSocket outbound connection", 4),
    ("http_server", r"\b(HTTPServer|BaseHTTPRequestHandler|uvicorn\.run|flask\.run|fastapi)\s*\(", "HTTP server inside skill", 4),
    ("dns_query", r"\bsocket\.(gethostbyname|getaddrinfo)\s*\(", "DNS query (potential exfiltration)", 3),
    ("ftp_transfer", r"\bftplib\.|paramiko\.SFTP", "FTP/SFTP file transfer", 4),
    ("smtp_send", r"\bsmtplib\.SMTP\s*\(", "Email sending from skill", 4),

    # ── Obfuscation (severity 4) ─────────────────────────────────
    ("base64_decode", r"base64\.(b64decode|decode)", "Obfuscated payload: base64 decode", 4),
    ("base64_exec", r"(base64|b64decode)\s*\(.*\)\s*\.\s*(decode|exec)", "Obfuscated code execution", 5),
    ("hex_decode", r"bytes\.fromhex|binascii\.unhexlify", "Hex-encoded payload", 3),
    ("rot13", r"codecs\.decode.*rot13|str\.translate.*rot13", "ROT13 obfuscation", 3),
    ("xor_decode", r"(lambda|for\s+\w+\s+in).*\^.*\b(exec|eval)\b", "XOR obfuscated execution", 5),
    ("compress_decode", r"(zlib|gzip|bz2|lzma)\.decompress", "Compressed payload extraction", 4),

    # ── Restricted Imports (severity 4) ──────────────────────────
    ("import_os", r"^import\s+os\b", "OS module import (system access)", 4),
    ("import_subprocess", r"^import\s+subprocess\b", "Subprocess module import", 5),
    ("import_shutil", r"^import\s+shutil\b", "Shutil module import (file operations)", 4),
    ("import_sys", r"^import\s+sys\b", "Sys module import", 3),
    ("import_ctypes", r"^import\s+ctypes\b", "C types module import (native code)", 5),
    ("import_ptty", r"^import\s+(pty|pexpect)\b", "PTY/spawn import", 4),
    ("import_requests", r"^import\s+requests\b", "Requests module import", 3),

    # ── Environment & Secrets (severity 3) ───────────────────────
    ("env_access", r"os\.environ|os\.getenv", "Environment variable access", 3),
    ("env_write", r"os\.environ\[.*\]\s*=", "Environment variable modification", 4),
    ("keyring_access", r"\bkeyring\.(get_password|set_password)", "System keyring access", 4),
    ("token_access", r"(api_key|api.token|access_token|secret_key)\s*=", "Possible secret hardcoded", 3),

    # ── Persistence (severity 4) ─────────────────────────────────
    ("cron_install", r"\bcrontab\b|cron\.(schedule|add)", "Cron job installation", 4),
    ("startup_install", r"(\.bashrc|\.profile|\.zshrc|\.config/autostart|LaunchAgent|StartupItems)", "Startup persistence installation", 4),
    ("service_install", r"\bsystemctl\s+(enable|start)\b|service\s+\w+\s+start", "System service installation", 4),
    ("registry_write", r"winreg\.(SetValue|CreateKey)", "Windows registry modification", 4),

    # ── Anti-Detection (severity 5) ──────────────────────────────
    ("clear_history", r"(history\s*-c|rm\s.*\.bash_history|Clear-History)", "Command history clearing", 5),
    ("disable_logging", r"logging\.disable|log\.setLevel.*CRITICAL", "Logging suppression", 4),
    ("sandbox_escape", r"(detect_sandbox|is_vm|check_virtual|amtland|is_buildkite)", "Sandbox detection / evasion", 5),
    ("sleep_evasion", r"\btime\.sleep\s*\(\s*\d{2,}", "Long sleep (timeout evasion)", 3),
    ("null_audio", r"(os\.devnull|>/dev/null\s*2>&1|Start-Sleep)", "Output suppression", 2),

    # ── Prompt Injection (severity 5) ────────────────────────────
    ("ignore_instructions", r"(ignore\s+(all\s+)?(previous|above|below)|disregard|forget\s+instructions)", "Prompt injection: ignore instructions", 5),
    ("role_override", r"(You\s+are\s+(now|not)|Act\s+as\s+if|Pretend\s+to\s+be|From\s+now\s+on)", "Prompt injection: role override", 5),
    ("system_prompt_leak", r"(output\s+(your\s+)?(system\s+)?prompt|print\s+(your\s+)?instructions|reveal\s+prompt)", "System prompt extraction attempt", 5),
    ("delimiter_break", r"(ignore\s+(delimiter|separator|boundary)|forget\s+(delimiter|marker))", "Delimiter boundary break attempt", 4),
    ("jailbreak_pattern", r"(DAN|jailbreak|bypass\s+(restriction|limit|rule)|hypothetical\s+scenario)", "Jailbreak pattern detected", 5),

    # ── Data Destruction (severity 5) ────────────────────────────
    ("format_disk", r"\bformat\s+\w:|dd\s+if=|mkfs\.|fdisk\b", "Disk format/partition command", 5),
    ("bulk_delete", r"\brm\s+(-rf|/)|Remove-Item\s+-Recurse\b", "Bulk file deletion", 5),
    ("truncate_data", r"\btruncate\s+|shred\s+|wipefs\b", "Data destruction / wiping", 5),

    # ── Cryptography (severity 3) ────────────────────────────────
    ("crypto_mine", r"(cryptomin|bitcoin|monero|ethash|stratum\+tcp)", "Cryptocurrency mining reference", 4),
    ("ransomware", r"(encrypt\s+(files|data)|ransom|decrypt.*payment)", "Ransomware-like behavior", 5),
    ("key_generation", r"(cryptography\.fernet|Crypto\.(Cipher|PublicKey)|rsa\.generate|ecdsa)", "Key generation (may be legit, flagged)", 2),

    # ── Resource Abuse (severity 3) ──────────────────────────────
    ("infinite_loop", r"while\s+True\s*:\s*(pass|continue|sleep|\.)", "Potential infinite loop", 3),
    ("fork_bomb", r":\(\)\s*\{|fork\s*\w*\s*\w*\s*\{|while\s*true.*fork", "Fork bomb pattern", 5),
    ("excessive_memory", r"(allocate\s+\d+[GT]B|malloc\(\d{9,}|mmap.*\d{9,})", "Excessive memory allocation", 3),

    # ── Shell commands (severity 4) ──────────────────────────────
    ("shell_curl_pipe", r"curl\s+.*\||wget\s+.*\||curl\s+.*\|.*bash|wget\s+.*\|.*sh", "Remote script pipe to shell", 5),
    ("shell_chmod", r"chmod\s+(\d{3}|u\+s|\+x)\s", "Permission modification via shell", 4),
    ("shell_sudo", r"\bsudo\s+", "Sudo command execution via skill", 4),
    ("shell_wget", r"\bwget\s+|curl\s+-[oO]\s+", "File download via shell", 4),
    ("shell_eval", r"`[^`]*`|\$\([^)]*\)", "Shell command substitution", 5),
]

TRUSTED_SOURCES = {"builtin", "agentskills.io", "github.com/anthropics", "github.com/nousresearch"}


def scan_skill_content(content: str, filename: str = "SKILL.md") -> dict[str, Any]:
    """Scan skill content for dangerous patterns.

    Returns:
        {"passed": bool, "warnings": list[str], "risk_score": int (0-100), "risk_level": str}
    """
    findings: list[tuple[str, int]] = []

    for rule_id, pattern, description, severity in DANGEROUS_PATTERNS:
        matches = re.findall(pattern, content, re.IGNORECASE | re.MULTILINE)
        if matches:
            count = len(matches)
            effective_severity = min(severity + (count - 1), 5)
            findings.append((f"[{rule_id}] {description} ({count} match(es))", effective_severity))

    risk_score = min(sum(s for _, s in findings) * 2, 100)

    if risk_score == 0:
        risk_level = "low"
    elif risk_score <= 20:
        risk_level = "low"
    elif risk_score <= 40:
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
    """Check if a source URL/name is in the trusted list."""
    source_lower = source.lower().rstrip("/")
    for trusted in TRUSTED_SOURCES:
        if trusted in source_lower:
            return True
    return False


# ── Platform / Environment Gating ──────────────────────────────────

SUPPORTED_PLATFORMS = {
    "windows": sys.platform.startswith("win"),
    "macos": sys.platform == "darwin",
    "linux": sys.platform.startswith("linux"),
}


def skill_matches_platform(meta: dict) -> bool:
    """Check if a skill's platform requirements match the current OS.

    If the skill has no 'platforms' field, it's assumed compatible.
    """
    platforms = meta.get("platforms")
    if not platforms:
        return True
    if isinstance(platforms, str):
        platforms = [p.strip() for p in platforms.split(",")]
    if not isinstance(platforms, list):
        return True
    for p in platforms:
        p = p.strip().lower()
        if p in SUPPORTED_PLATFORMS and SUPPORTED_PLATFORMS[p]:
            return True
    return False


def detect_skill_in_thought(
    thought_text: str,
    active_skill_ids: list[str],
    skills_index_data: list[dict],
) -> dict | None:
    """Detect if the LLM is thinking about using a specific skill.

    Returns the skill dict if a match is found, or None.
    """
    if not active_skill_ids or not skills_index_data:
        return None

    thought_lower = thought_text.lower()
    skill_map = {s["id"]: s for s in skills_index_data}

    for skill_id in active_skill_ids:
        skill = skill_map.get(skill_id)
        if not skill:
            continue

        name_lower = skill.get("name", "").lower()
        if not name_lower:
            continue

        patterns = [
            skill_id,
            name_lower,
            f"skill: {skill_id}",
            f"skill_id: {skill_id}",
            f"using {name_lower}",
            f"usando {name_lower}",
            f"aplicando {name_lower}",
            f"applying {name_lower}",
        ]

        for pattern in patterns:
            if pattern and pattern in thought_lower:
                return skill

    return None
