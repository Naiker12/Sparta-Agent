"""Explicit natural-language public searches, never inferred from private history."""
import re
from datetime import datetime
import unicodedata


def current_date_reply(text, locale, *, now=None):
    if not isinstance(text, str):
        return None
    normalized = ''.join(c for c in unicodedata.normalize('NFD', text.lower())
                         if not unicodedata.combining(c))
    question = ' '.join(normalized.strip(' ¿?¡!.').split())
    if question not in ('que dia es hoy', 'que fecha es hoy', 'cual es la fecha de hoy',
                        'what day is today', 'what is today\'s date', 'what date is today'):
        return None
    current = now if now is not None else datetime.now().astimezone()
    if locale == 'es':
        days = ('lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo')
        months = ('enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre')
        return f'Hoy es {days[current.weekday()]}, {current.day} de {months[current.month - 1]} de {current.year}, según la fecha local del equipo donde funciona Spartan.'
    days = ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')
    return f'Today is {days[current.weekday()]}, {current.date().isoformat()}, using the local date of the computer running Spartan.'


def public_search(text):
    if not isinstance(text, str):
        return None
    match = re.fullmatch(
        r'\s*(?:por favor[, ]+|please[, ]+)?(?:'
        r'(?:busca|buscar|buscame|búscame)\s+(?:en\s+(?:internet|la web)|(?:en\s+)?la web)'
        r'|(?:search|look up)\s+(?:the web|on\s+(?:the web|internet)|online)'
        r')\s*[:,-]?\s*(.*?)\s*', text, re.IGNORECASE | re.DOTALL)
    return match.group(1) if match else None
