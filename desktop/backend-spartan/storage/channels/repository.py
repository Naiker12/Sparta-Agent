from __future__ import annotations

import json
import sqlite3
import time
import uuid
from contextlib import contextmanager

from utils.paths import ensure_dir, studio_db_path


@contextmanager
def connection():
    path = studio_db_path()
    ensure_dir(path.parent)
    db = sqlite3.connect(str(path), timeout=5)
    db.row_factory = sqlite3.Row
    try:
        db.execute('PRAGMA busy_timeout=5000')
        db.executescript('''
          CREATE TABLE IF NOT EXISTS channel_accounts (
            id TEXT PRIMARY KEY, owner TEXT NOT NULL, bot_id TEXT UNIQUE NOT NULL,
            config TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 0,
            offset INTEGER NOT NULL DEFAULT 0);
          CREATE TABLE IF NOT EXISTS channel_inbox (
            account_id TEXT NOT NULL, update_id INTEGER NOT NULL,
            payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'queued',
            created_at INTEGER NOT NULL, PRIMARY KEY(account_id, update_id));
          CREATE TABLE IF NOT EXISTS channel_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT, account_id TEXT NOT NULL,
            code TEXT NOT NULL, created_at INTEGER NOT NULL);
          CREATE TABLE IF NOT EXISTS channel_budget (
            account_id TEXT NOT NULL, requested_at INTEGER NOT NULL);
          CREATE TABLE IF NOT EXISTS channel_usage (
            account_id TEXT NOT NULL, update_id INTEGER NOT NULL, user_id TEXT NOT NULL,
            provider_id TEXT NOT NULL, model TEXT NOT NULL, status TEXT NOT NULL,
            prompt_tokens INTEGER, completion_tokens INTEGER, total_tokens INTEGER,
            usage_partial INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL, PRIMARY KEY(account_id,update_id));
          CREATE INDEX IF NOT EXISTS channel_usage_user ON channel_usage(account_id,user_id,created_at);
          CREATE TABLE IF NOT EXISTS channel_history (
            account_id TEXT NOT NULL, user_id TEXT NOT NULL,
            update_id INTEGER NOT NULL, user_text TEXT NOT NULL,
            assistant_text TEXT NOT NULL, created_at INTEGER NOT NULL,
            PRIMARY KEY(account_id, update_id));
          CREATE INDEX IF NOT EXISTS channel_history_user
            ON channel_history(account_id, user_id, update_id);
          CREATE TABLE IF NOT EXISTS channel_pairings (
            id TEXT PRIMARY KEY, account_id TEXT NOT NULL,
            token_hash TEXT UNIQUE NOT NULL, expires_at INTEGER NOT NULL,
            status TEXT NOT NULL, user_id TEXT, username TEXT, name TEXT,
            confirmation TEXT);
          CREATE INDEX IF NOT EXISTS channel_pairings_account
            ON channel_pairings(account_id, expires_at);
        ''')
        if 'usage_partial' not in {row['name'] for row in db.execute('PRAGMA table_info(channel_usage)')}:
            try:
                db.execute('ALTER TABLE channel_usage ADD COLUMN usage_partial INTEGER NOT NULL DEFAULT 0')
            except sqlite3.OperationalError:
                # Another UI/worker connection may have completed this additive migration.
                if 'usage_partial' not in {row['name'] for row in db.execute('PRAGMA table_info(channel_usage)')}:
                    raise
        yield db
        db.commit()
    finally:
        db.close()


def _account(row):
    return {**json.loads(row['config']), 'id': row['id'], 'enabled': bool(row['enabled'])}


def accounts(owner: str | None = None):
    with connection() as db:
        rows = db.execute('SELECT * FROM channel_accounts' + (' WHERE owner=?' if owner else ''), (owner,) if owner else ()).fetchall()
        return [_account(row) for row in rows]


def get_account(account_id: str, owner: str | None = None):
    with connection() as db:
        row = db.execute('SELECT * FROM channel_accounts WHERE id=?' + (' AND owner=?' if owner else ''), (account_id, owner) if owner else (account_id,)).fetchone()
        return _account(row) if row else None


def create_account(owner: str, bot_id: str, config: dict):
    account_id = str(uuid.uuid4())
    with connection() as db:
        db.execute('INSERT INTO channel_accounts(id,owner,bot_id,config) VALUES(?,?,?,?)', (account_id, owner, bot_id, json.dumps(config)))
    return get_account(account_id, owner)


def set_enabled(account_id: str, owner: str, enabled: bool):
    with connection() as db:
        db.execute('UPDATE channel_accounts SET enabled=? WHERE id=? AND owner=?', (int(enabled), account_id, owner))


def delete_account(account_id: str, owner: str):
    with connection() as db:
        if not db.execute('DELETE FROM channel_accounts WHERE id=? AND owner=?', (account_id, owner)).rowcount:
            return False
        db.execute('DELETE FROM channel_inbox WHERE account_id=?', (account_id,))
        db.execute('DELETE FROM channel_events WHERE account_id=?', (account_id,))
        db.execute('DELETE FROM channel_budget WHERE account_id=?', (account_id,))
        db.execute('DELETE FROM channel_usage WHERE account_id=?', (account_id,))
        db.execute('DELETE FROM channel_history WHERE account_id=?', (account_id,))
        db.execute('DELETE FROM channel_pairings WHERE account_id=?', (account_id,))
        if db.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='work_runs'").fetchone():
            from .work import delete
            delete(db, account_id)
        return True


def offset(account_id: str):
    with connection() as db:
        return db.execute('SELECT offset FROM channel_accounts WHERE id=?', (account_id,)).fetchone()['offset']


def ingest(account_id: str, updates: list[dict], normalize):
    """Commit accepted messages and cursor together, before acknowledging upstream.

    Rejected senders never persist their text or trigger a download/provider call.
    """
    with connection() as db:
        for update in updates:
            update_id = update.get('update_id')
            if type(update_id) is not int or update_id < 0:
                continue
            payload = normalize(update)
            if payload:
                db.execute('INSERT OR IGNORE INTO channel_inbox(account_id,update_id,payload,created_at) VALUES(?,?,?,?)', (account_id, update_id, json.dumps(payload), int(time.time())))
            db.execute('UPDATE channel_accounts SET offset=MAX(offset,?) WHERE id=?', (update_id + 1, account_id))
        # Retain bounded history; never discard queued work.
        db.execute("DELETE FROM channel_inbox WHERE account_id=? AND status!='queued' AND created_at<?", (account_id, int(time.time()) - 7 * 86400))


def claim(account_id: str):
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute("SELECT * FROM channel_inbox WHERE account_id=? AND status='queued' ORDER BY update_id LIMIT 1", (account_id,)).fetchone()
        if not row:
            return None
        db.execute("UPDATE channel_inbox SET status='processing' WHERE account_id=? AND update_id=?", (account_id, row['update_id']))
        return row['update_id'], json.loads(row['payload'])


def finish(account_id: str, update_id: int, status: str):
    assert status in ('completed', 'failed')
    with connection() as db:
        db.execute('UPDATE channel_inbox SET status=? WHERE account_id=? AND update_id=?', (status, account_id, update_id))


def consume_control(account_id: str, update_id: int):
    """Handle an ingested control once; replayed updates cannot cancel new work."""
    with connection() as db:
        return bool(db.execute("UPDATE channel_inbox SET status='completed' WHERE account_id=? AND update_id=? AND status='queued'", (account_id, update_id)).rowcount)


def take_cancel(account_id: str, user_id: str, after: int):
    """Also catch /cancel delivered in the same batch as the active prompt."""
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        rows = db.execute("SELECT update_id,payload FROM channel_inbox WHERE account_id=? AND status='queued' AND update_id>? AND json_extract(payload,'$.user_id')=? ORDER BY update_id", (account_id, after, user_id))
        for row in rows:
            payload = json.loads(row['payload'])
            parts = payload['text'].split()
            if not payload['media'] and parts and parts[0].split('@')[0].lower() == '/cancel':
                db.execute("UPDATE channel_inbox SET status='completed' WHERE account_id=? AND update_id=?", (account_id, row['update_id']))
                return True
        return False


def recover(account_id: str):
    # A restart cannot prove whether a provider/sendMessage completed. Do not replay
    # ambiguous operations and accidentally incur charges or duplicate replies.
    with connection() as db:
        db.execute("UPDATE channel_inbox SET status='failed' WHERE account_id=? AND status='processing'", (account_id,))


def event(account_id: str, code: str):
    with connection() as db:
        db.execute('INSERT INTO channel_events(account_id,code,created_at) VALUES(?,?,?)', (account_id, code, int(time.time())))
        db.execute('DELETE FROM channel_events WHERE account_id=? AND id NOT IN (SELECT id FROM channel_events WHERE account_id=? ORDER BY id DESC LIMIT 100)', (account_id, account_id))


def events(owner: str):
    with connection() as db:
        return [dict(row) for row in db.execute('SELECT e.id,e.account_id,e.code,e.created_at FROM channel_events e JOIN channel_accounts a ON a.id=e.account_id WHERE a.owner=? ORDER BY e.id DESC LIMIT 50', (owner,)).fetchall()]


def reserve_provider_request(account_id: str, limit: int = 30):
    """Persistent rolling-hour bound; failed attempts count too."""
    now = int(time.time())
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        db.execute('DELETE FROM channel_budget WHERE requested_at<=?', (now - 3600,))
        count = db.execute('SELECT COUNT(*) FROM channel_budget WHERE account_id=?', (account_id,)).fetchone()[0]
        if count >= limit:
            return False
        db.execute('INSERT INTO channel_budget(account_id,requested_at) VALUES(?,?)', (account_id, now))
        return True
