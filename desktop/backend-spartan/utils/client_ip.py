
"Resolve the caller's IP for rate limiting.\n\nTrust model, in order:\n     their own reverse proxy), honor the *rightmost* ``X-Forwarded-For`` hop -- the\n     one the trusted proxy appended. The leftmost entry is client-controlled and\n     spoofable, so this assumes a proxy that appends (or overwrites) the header;\n     only enable the env var behind such a proxy.\n     Cloudflare tunnel terminates at 127.0.0.1, so every tunneled visitor would\n     otherwise collapse onto the same socket peer (the local cloudflared process)\n     and share one rate-limit bucket. ``CF-Connecting-IP`` is set by Cloudflare's\n     edge and can't be forged by a tunneled client.\n  3. Otherwise the socket peer, so a direct LAN caller can't spoof a header to\n     dodge a per-IP limit."

from __future__ import annotations

import ipaddress
import os

_TRUST_FORWARDED_ENV = "UNSLOTH_STUDIO_TRUST_FORWARDED"


def _trust_forwarded_for() -> bool:
    return os.environ.get(_TRUST_FORWARDED_ENV, "").strip().lower() in {"1", "true", "yes"}


def _is_loopback(host: str | None) -> bool:
    try:
        return bool(host) and ipaddress.ip_address(host).is_loopback
    except ValueError:
        return False


def _normalize_addr(value: str | None) -> str | None:
    """Parse an ``X-Forwarded-For`` entry into a bare, validated IP (strip port/brackets)."""
    raw = (value or "").strip().strip('"')
    if not raw:
        return None
    if raw.startswith("["):  # [ipv6]:port
        raw = raw[1:].split("]", 1)[0]
    elif raw.count(":") == 1:  # ipv4:port
        raw = raw.split(":", 1)[0]
    try:
        return ipaddress.ip_address(raw).compressed
    except ValueError:
        return None


def client_ip(request) -> str:
    """Best-effort client IP, or ``"_unknown"`` when it can't be determined."""
    if request is None:
        return "_unknown"
    peer = request.client.host if request.client else None
    if _trust_forwarded_for():
        # Rightmost hop = what the trusted proxy saw; the leftmost is spoofable.
        xff = request.headers.get("x-forwarded-for", "")
        if xff:
            normalized = _normalize_addr(xff.rsplit(",", 1)[-1])
            if normalized:
                return normalized
    if _is_loopback(peer):
        cf = _normalize_addr(request.headers.get("cf-connecting-ip"))
        if cf:
            return cf
    return peer or "_unknown"
