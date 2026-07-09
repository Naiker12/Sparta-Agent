import ipaddress
import logging
import socket
from html import unescape
from urllib.parse import urlparse

import httpx
from langchain_core.tools import tool

from sparta_ai.tools.web_progress import dispatch_progress

logger = logging.getLogger("sparta_ai.tools.web_fetch")

_MAX_CONTENT_BYTES = 1_500_000  # ~1.5MB, cortamos antes de parsear
_TIMEOUT = 12.0


def _is_safe_url(url: str) -> tuple[bool, str]:
    """Bloquea SSRF: IPs privadas, localhost, metadata endpoints de cloud."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return False, "Solo se permiten URLs http/https."
    host = parsed.hostname
    if not host:
        return False, "URL sin host válido."
    try:
        addrs = socket.getaddrinfo(host, None)
    except socket.gaierror:
        return False, "No se pudo resolver el host."
    for family, _, _, _, sockaddr in addrs:
        ip = ipaddress.ip_address(sockaddr[0])
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved:
            return False, "Bloqueado: la URL resuelve a una IP privada/interna (protección SSRF)."
    return True, ""


def _extract_readable_text(html: str) -> str:
    """Extracción de texto legible sin dependencias pesadas (regex + heurística).

    Si más adelante se agrega `trafilatura` o `readability-lxml` al entorno
    del sidecar, reemplazar esta función.
    """
    import re

    html = re.sub(
        r"<(script|style|nav|footer|header|svg|aside|form|button)[^>]*>.*?</\1>",
        " ",
        html,
        flags=re.DOTALL | re.IGNORECASE,
    )
    text = re.sub(r"<[^>]+>", " ", html)
    text = re.sub(r"\s+", " ", text).strip()
    return unescape(text)


@tool
async def web_fetch_tool(url: str, max_chars: int = 8000) -> str:
    """
    Descarga y extrae el contenido de texto legible de una página web.
    Úsala DESPUÉS de web_search_tool cuando necesites el contenido completo
    de un resultado específico (el snippet de búsqueda no alcanza).

    Args:
        url: URL completa (http/https) de la página a leer.
        max_chars: Máximo de caracteres de texto a devolver (default 8000).

    Returns:
        Texto extraído de la página, o un mensaje de error.
    """
    safe, reason = _is_safe_url(url)
    if not safe:
        logger.warning("web_fetch_tool blocked url=%s reason=%s", url, reason)
        return f"Error de seguridad: {reason}"

    await dispatch_progress("reading", url=url)

    try:
        async with httpx.AsyncClient(
            timeout=_TIMEOUT,
            follow_redirects=True,
            headers={"User-Agent": "Mozilla/5.0 (compatible; SpartaAgent/1.0)"},
        ) as client:
            async with client.stream("GET", url) as resp:
                resp.raise_for_status()
                content_type = resp.headers.get("content-type", "")
                if "text/html" not in content_type and "text/plain" not in content_type:
                    return f"Error: contenido no soportado ({content_type}). Solo HTML/texto."
                raw = b""
                async for chunk in resp.aiter_bytes():
                    raw += chunk
                    if len(raw) > _MAX_CONTENT_BYTES:
                        break
        html = raw.decode("utf-8", errors="ignore")
        text = _extract_readable_text(html)
        if not text:
            return f"No se pudo extraer contenido legible de {url}."
        truncated = text[:max_chars]
        suffix = "\n\n[contenido truncado]" if len(text) > max_chars else ""
        return f"[Contenido de {url}]\n\n{truncated}{suffix}"
    except httpx.TimeoutException:
        return f"Timeout leyendo {url}."
    except httpx.HTTPStatusError as e:
        return f"Error HTTP {e.response.status_code} leyendo {url}."
    except Exception as e:
        logger.exception("web_fetch_tool failed for %s", url)
        return f"Error inesperado leyendo {url}: {e}"
