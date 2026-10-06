"""Bounded Telegram context; never reads desktop conversations or graph memory."""
import time

from .repository import connection

MAX_TURNS = 6
MAX_CONTEXT_CHARS = 24000
RETENTION_SECONDS = 7 * 86400


def _prune(db):
    db.execute('DELETE FROM channel_history WHERE created_at<?',
               (int(time.time()) - RETENTION_SECONDS,))


def messages(account_id: str, user_id: str):
    with connection() as db:
        _prune(db)
        rows = db.execute(
            'SELECT user_text,assistant_text FROM channel_history '
            'WHERE account_id=? AND user_id=? ORDER BY update_id DESC LIMIT ?',
            (account_id, user_id, MAX_TURNS),
        ).fetchall()
    selected, size = [], 0
    for row in rows:
        cost = len(row['user_text']) + len(row['assistant_text'])
        if size + cost > MAX_CONTEXT_CHARS:
            break
        size += cost
        selected.append(row)
    return [message for row in reversed(selected) for message in (
        {'role': 'user', 'content': row['user_text']},
        {'role': 'assistant', 'content': row['assistant_text']},
    )]


def complete(account_id: str, update_id: int, message: dict, response: str):
    """Persist context only after Telegram acknowledges the complete reply.

    Inbox completion and history commit together. Failed or ambiguous delivery
    must never become an assistant turn that the user did not receive.
    """
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        changed = db.execute(
            "UPDATE channel_inbox SET status='completed' "
            "WHERE account_id=? AND update_id=? AND status='processing'",
            (account_id, update_id),
        ).rowcount
        if not changed:
            return
        db.execute(
            'INSERT INTO channel_history VALUES(?,?,?,?,?,?)',
            (account_id, message['user_id'], update_id, message['text'],
             response, int(time.time())),
        )
        _prune(db)
        db.execute(
            'DELETE FROM channel_history WHERE account_id=? AND user_id=? '
            'AND update_id NOT IN (SELECT update_id FROM channel_history '
            'WHERE account_id=? AND user_id=? ORDER BY update_id DESC LIMIT ?)',
            (account_id, message['user_id'], account_id, message['user_id'], MAX_TURNS),
        )


def reset(account_id: str, user_id: str):
    with connection() as db:
        db.execute('DELETE FROM channel_history WHERE account_id=? AND user_id=?',
                   (account_id, user_id))
