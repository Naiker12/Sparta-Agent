"""Traduce excepciones internas a mensajes que un usuario no técnico entienda.

El detalle técnico original sigue yendo al log (logger.exception).
Esta capa solo transforma el string que se muestra en el toast/UI.
"""

import re

_KNOWN_PATTERNS: list[tuple[re.Pattern, str]] = [
    (
        re.compile(r"Connection refused|ConnectionRefusedError"),
        "No se pudo conectar al servicio. Verificá tu conexión o que el servidor esté activo.",
    ),
    (
        re.compile(r"401|Unauthorized|invalid.?api.?key", re.IGNORECASE),
        "La clave de API no es válida o expiró. Revisá la configuración del proveedor.",
    ),
    (
        re.compile(r"429|rate.?limit|quota", re.IGNORECASE),
        "Se alcanzó el límite de uso del proveedor. Esperá un momento o cambiá de modelo.",
    ),
    (
        re.compile(r"timeout|TimeoutError", re.IGNORECASE),
        "La operación tardó demasiado y se canceló.",
    ),
    (
        re.compile(r"FileNotFoundError|No such file"),
        "No se encontró el archivo indicado.",
    ),
    (
        re.compile(r"PermissionError|Permission denied|Access is denied", re.IGNORECASE),
        "No se tiene permiso para acceder a este recurso.",
    ),
    (
        re.compile(r"JSONDecodeError|json\.decoder\.JSONDecodeError"),
        "La respuesta del servidor no tiene un formato válido.",
    ),
    (
        re.compile(r"SSL|SSLError|certificate", re.IGNORECASE),
        "Error de conexión segura (SSL). Verificá la configuración de red.",
    ),
]


def to_user_message(raw_error: str) -> str:
    """Convert a raw exception string to a human-readable user message.

    If no known pattern matches, returns a generic honest message instead
    of leaking the technical stack trace to the UI.
    """
    for pattern, friendly in _KNOWN_PATTERNS:
        if pattern.search(raw_error):
            return friendly
    return "Ocurrió un error inesperado. Podés ver el detalle técnico en los logs."
