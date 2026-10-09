"""Single-use, expiring discovery links. Only the desktop owner grants access."""
import hashlib
import json
import re
import secrets
import time
import uuid

from .repository import connection

TTL_SECONDS = 600
_START = re.compile(r'^/start(?:@[A-Za-z0-9_]+)? link_([A-Za-z0-9_-]{43})$')


def _expire(db):
    db.execute("UPDATE channel_pairings SET status='expired',user_id=NULL,username=NULL,name=NULL,confirmation=NULL "
               "WHERE status IN ('waiting','review') AND expires_at<=?", (int(time.time()),))


def expire():
    with connection() as db:
        _expire(db)


def is_link(update):
    message = update.get('message') or {}
    text = message.get('text')
    return isinstance(text, str) and bool(re.match(r'^/start(?:@[A-Za-z0-9_]+)? link_', text))


def active(account_id):
    with connection() as db:
        _expire(db)
        return bool(db.execute(
            "SELECT 1 FROM channel_pairings WHERE account_id=? "
            "AND status IN ('waiting','review') AND expires_at>? LIMIT 1",
            (account_id, int(time.time())),
        ).fetchone())


def _public(row):
    if not row:
        return None
    status = row['status']
    if status in ('waiting', 'review') and row['expires_at'] <= int(time.time()):
        status = 'expired'
    return {key: row[key] for key in
            ('id', 'expires_at', 'user_id', 'username', 'name', 'confirmation')} | {'status': status}


def create(account_id, owner):
    token, session_id = secrets.token_urlsafe(32), str(uuid.uuid4())
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        account = db.execute('SELECT config FROM channel_accounts WHERE id=? AND owner=?',
                             (account_id, owner)).fetchone()
        if not account:
            raise ValueError('account_not_found')
        username = json.loads(account['config']).get('bot_username', '')
        if not re.fullmatch(r'[A-Za-z0-9_]{5,32}', username):
            raise ValueError('invalid_bot_username')
        db.execute("UPDATE channel_pairings SET status='cancelled' WHERE account_id=? AND status IN ('waiting','review')", (account_id,))
        db.execute('DELETE FROM channel_pairings WHERE account_id=?', (account_id,))
        db.execute('INSERT INTO channel_pairings(id,account_id,token_hash,expires_at,status) VALUES(?,?,?,?,?)',
                   (session_id, account_id, hashlib.sha256(token.encode()).hexdigest(),
                    int(time.time()) + TTL_SECONDS, 'waiting'))
        result = _public(db.execute('SELECT * FROM channel_pairings WHERE id=?', (session_id,)).fetchone())
    return {**result, 'url': f'https://t.me/{username}?start=link_{token}'}


def get(account_id, session_id, owner):
    with connection() as db:
        _expire(db)
        row = db.execute('SELECT p.* FROM channel_pairings p JOIN channel_accounts a ON a.id=p.account_id '
                         'WHERE p.id=? AND p.account_id=? AND a.owner=?',
                         (session_id, account_id, owner)).fetchone()
        return _public(row)


def capture(account_id, update):
    message = update.get('message')
    if not isinstance(message, dict) or type(update.get('update_id')) is not int or update['update_id'] < 0:
        return None
    sender, chat = message.get('from') or {}, message.get('chat') or {}
    user_id, chat_id = sender.get('id'), chat.get('id')
    text = message.get('text')
    match = _START.fullmatch(text) if isinstance(text, str) else None
    if (not match or chat.get('type') != 'private' or type(user_id) is not int or
            not 0 < user_id < 2**53 or type(chat_id) is not int or
            user_id != chat_id or sender.get('is_bot')):
        return None
    token_hash = hashlib.sha256(match[1].encode()).hexdigest()
    confirmation = secrets.token_hex(3).upper()
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        changed = db.execute(
            "UPDATE channel_pairings SET status='review',user_id=?,username=?,name=?,confirmation=? "
            "WHERE account_id=? AND token_hash=? AND status='waiting' AND expires_at>?",
            (str(user_id), str(sender.get('username') or '')[:64],
             ' '.join(str(sender.get(key) or '') for key in ('first_name', 'last_name')).strip()[:120],
             confirmation, account_id, token_hash, int(time.time())),
        ).rowcount
    return {'chat_id': chat_id, 'confirmation': confirmation} if changed else None


def approve(account_id, session_id, owner, *, purpose='guest'):
    if purpose not in ('self', 'guest'):
        raise ValueError('invalid_pairing_purpose')
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT p.* FROM channel_pairings p JOIN channel_accounts a ON a.id=p.account_id '
                         'WHERE p.id=? AND p.account_id=? AND a.owner=?',
                         (session_id, account_id, owner)).fetchone()
        result = _public(row)
        if not result:
            raise ValueError('pairing_not_found')
        if result['status'] != 'review':
            raise ValueError('pairing_not_ready')
        account = db.execute('SELECT config FROM channel_accounts WHERE id=? AND owner=?',
                             (account_id, owner)).fetchone()
        config = json.loads(account['config'])
        if purpose == 'self':
            existing_owner = config.get('owner_user_id')
            if existing_owner and existing_owner != row['user_id']:
                raise ValueError('owner_already_linked')
            # One atomic approval establishes the personal link and dynamic
            # project visibility. Existing approvals remain guest-only.
            config['owner_user_id'] = row['user_id']
            config['profile_user_id'] = row['user_id']
            config.setdefault('project_access', {})[row['user_id']] = 'all'
            config['permissions_version'] = 2
        ids = set(config['allowed_user_ids']) | {row['user_id']}
        if len(ids) > 20:
            raise ValueError('user_limit')
        config['allowed_user_ids'] = sorted(ids)
        db.execute('UPDATE channel_accounts SET config=?,enabled=1 WHERE id=? AND owner=?',
                   (json.dumps(config), account_id, owner))
        db.execute("UPDATE channel_pairings SET status='approved' WHERE id=?", (session_id,))
    return {**result, 'status': 'approved'}


def cancel(account_id, session_id, owner):
    with connection() as db:
        return bool(db.execute(
            "UPDATE channel_pairings SET status='cancelled',user_id=NULL,username=NULL,name=NULL,confirmation=NULL WHERE id=? AND account_id=? "
            "AND status IN ('waiting','review') AND EXISTS "
            '(SELECT 1 FROM channel_accounts WHERE id=? AND owner=?)',
            (session_id, account_id, account_id, owner),
        ).rowcount)
