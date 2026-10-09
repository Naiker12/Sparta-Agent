"""Explicit, owner-bound profile name changes from channel conversation input."""
import json
import re
import time
import unicodedata
from storage.channels import repository as repo
from utils.personalization_settings import get_personalization

_recent_names = {}


def name_request(account_id, user_id, text):
    """Accept a short correction only immediately after a successful name change."""
    explicit = requested_name(text)
    if explicit:
        return explicit
    key = (account_id, user_id)
    changed_at = _recent_names.get(key)
    if changed_at is None or time.monotonic() - changed_at > 120:
        _recent_names.pop(key, None)
        return None
    match = re.fullmatch(r'\s*(?:o|mejor|mejor dicho|or|actually)\s+([^\r\n]+?)\s*', text, re.IGNORECASE) if isinstance(text, str) else None
    if not match:
        _recent_names.pop(key, None)
        return None
    return requested_name('me quiero llamar ' + match[1])


def setup_reply(account, user_id):
    if account.get('owner_user_id') and account['owner_user_id'] != user_id:
        return ('Esta cuenta invitada no puede cambiar el perfil del propietario de Spartan. Puedes conversar y usar los proyectos que te haya autorizado.'
                if account['locale'] == 'es' else 'This guest account cannot change the Spartan owner profile. You can chat and use projects granted to you.')
    return ('Spartan permite cambiar tu nombre, pero tu usuario de Telegram aún no está vinculado al perfil. En Spartan abre Configuración → Canales y permisos → Perfil de Spartan, selecciona tu usuario y guarda el vínculo. Después escribe «me quiero llamar Naiker Codes».'
            if account['locale'] == 'es' else 'Spartan supports name changes, but your Telegram user is not linked to the profile yet. Open Settings → Channels and permissions → Spartan profile, select your user and save the link. Then send “call me Jane”.')


def capability_reply(text, account, user_id, *, history=None):
    """Answer profile capability questions from actual permission, not model history."""
    if not isinstance(text, str) or len(text) > 500:
        return None
    def normalized(value):
        return ' '.join(''.join(c for c in unicodedata.normalize('NFD', value.lower())
                               if not unicodedata.combining(c)).strip(' ¿?¡!.').split())
    question = normalized(text)
    # Common short variants remain a capability question, never a write grant.
    question = re.sub(r'\bcambis\b|\bcambia\b(?= mi nombre)', 'cambiar', question)
    question = re.sub(r' y (?:demas|dema)$', '', question)
    explicit = re.fullmatch(r'(?:ya |ahora |ahora si )?(?:puedes|se puede|podrias) cambiar (?:el |mi |tu )?nombre(?: de(?: mi)? perfil)?(?: en spartan| en telegram)?', question)
    followup = question in ('ahora si puedes', 'ya puedes', 'ahora puedes', 'now you can',
                            'si puedes', 'si se puede', 'intenta de nuevo', 'try again')
    relevant = any(item.get('role') == 'user' and re.search(r'(?:cambiar.{0,40}nombre|change.{0,40}name)', normalized(item.get('content', '')))
                   for item in (history or [])[-8:])
    english = re.fullmatch(r'can you change (?:my |the )?(?:profile |display )?name(?: in spartan| on telegram)?', question)
    explanation = re.fullmatch(r'(?:por favor )?(?:como (?:puedo )?|por que (?:no )?(?:puedes |puedo )?|quiero |necesito |puedo |ayudame a )cambiar (?:el |mi )?nombre(?: de(?: mi)? perfil)?(?: en spartan| en telegram)?', question)
    if not (explicit or english or explanation or (followup and relevant)):
        return None
    from .catalog import profile_linked
    if profile_linked(account, user_id):
        return ('Sí, puedes cambiar tu nombre en Spartan. Escribe «me quiero llamar Naiker Codes». Tu nombre de Telegram no cambia.'
                if account['locale'] == 'es' else 'Yes, you can change your Spartan name. Send “call me Jane”. Your Telegram name stays the same.')
    return setup_reply(account, user_id)


def requested_name(text):
    if not isinstance(text, str):
        return None
    match = re.fullmatch(r"\s*(?:me quiero llamar|quiero que me llames|llámame|cambia mi nombre a|cambiar mi nombre a|quiero cambiar mi nombre a|call me|i want to be called|change my name to)\s+([^\r\n]+?)\s*", text, re.IGNORECASE)
    if not match:
        return None
    name = match[1].strip()
    return name if 0 < len(name) <= 200 and not any(ord(c) < 32 or ord(c) == 127 for c in name) else None


def bind(account_id, owner, user_id):
    with repo.connection() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT config FROM channel_accounts WHERE id=? AND owner=?', (account_id, owner)).fetchone()
        if not row:
            raise ValueError('account_not_found')
        config = json.loads(row['config'])
        if user_id is not None and user_id not in config['allowed_user_ids']:
            raise ValueError('user_not_authorized')
        if user_id is not None and config.get('owner_user_id') and config['owner_user_id'] != user_id:
            raise ValueError('owner_required')
        config['profile_user_id'] = user_id
        db.execute('UPDATE channel_accounts SET config=? WHERE id=? AND owner=?', (json.dumps(config), account_id, owner))


def change_name(account_id, user_id, name):
    if not name or len(name) > 200 or any(ord(c) < 32 or ord(c) == 127 for c in name):
        raise ValueError('invalid_profile_name')
    get_personalization()  # Initialize the shared settings schema before transaction.
    with repo.connection() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT config,enabled FROM channel_accounts WHERE id=?', (account_id,)).fetchone()
        config = json.loads(row['config']) if row else {}
        if (not row or not row['enabled'] or config.get('profile_user_id') != user_id
                or user_id not in config.get('allowed_user_ids', [])
                or (config.get('owner_user_id') and config['owner_user_id'] != user_id)):
            return False
        stored = db.execute("SELECT value_json FROM app_settings WHERE key='personalization'").fetchone()
        value = json.loads(stored[0]) if stored else {}
        value['profile'] = {**value.get('profile', {}), 'displayName': name, 'nickname': name}
        db.execute("INSERT INTO app_settings(key,value_json,updated_at) VALUES('personalization',?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at", (json.dumps(value), int(time.time()*1000)))
    now = time.monotonic()
    for key in list(_recent_names):
        if now - _recent_names[key] > 120:
            _recent_names.pop(key, None)
    while len(_recent_names) >= 1000:
        _recent_names.pop(next(iter(_recent_names)))
    _recent_names[(account_id, user_id)] = now
    return True
