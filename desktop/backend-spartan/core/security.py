import hashlib
import secrets
import time
from typing import Optional, Dict, Any

ACTIVE_TOKENS: Dict[str, Dict[str, Any]] = {}

def hash_password(password: str, salt: Optional[str] = None) -> str:
    if not salt:
        salt = secrets.token_hex(16)
    hashed = hashlib.sha256((password + salt).encode('utf-8')).hexdigest()
    return f"{salt}:{hashed}"

def verify_password(password: str, hashed_value: str) -> bool:
    try:
        salt, hashed = hashed_value.split(":")
        check = hashlib.sha256((password + salt).encode('utf-8')).hexdigest()
        return secrets.compare_digest(hashed, check)
    except Exception:
        return False

def generate_token(subject: str = "user") -> str:
    token = secrets.token_urlsafe(32)
    ACTIVE_TOKENS[token] = {
        "sub": subject,
        "created_at": time.time(),
        "expires_at": time.time() + (30 * 86400) # 30 días
    }
    return token

def validate_token(token: str) -> bool:
    if token in ACTIVE_TOKENS:
        if ACTIVE_TOKENS[token]["expires_at"] > time.time():
            return True
        else:
            del ACTIVE_TOKENS[token]
    return False
