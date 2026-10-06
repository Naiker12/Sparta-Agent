"""Reported provider usage only; local rate budget is a separate quantity."""
import time

from .repository import connection


def normalize(value):
    if not isinstance(value, dict):
        return {}
    result = {}
    for name, alias in (('prompt_tokens', 'input_tokens'), ('completion_tokens', 'output_tokens'), ('total_tokens', 'total_tokens')):
        count = value.get(name, value.get(alias))
        if type(count) is int and 0 <= count <= 1_000_000_000:
            result[name] = count
    return result


def start(account, update_id, user_id):
    now = int(time.time())
    with connection() as db:
        db.execute('DELETE FROM channel_usage WHERE created_at<?', (now - 30 * 86400,))
        db.execute("INSERT OR IGNORE INTO channel_usage(account_id,update_id,user_id,provider_id,model,status,created_at) VALUES(?,?,?,?,?,'running',?)",
                   (account['id'], update_id, user_id, account['provider_id'], account['model'], now))


def record(account_id, update_id, value):
    counts = normalize(value)
    if not counts:
        return
    with connection() as db:
        # SSE usage packets describe cumulative counts, not increments.
        if value.get('_incomplete') is True:
            db.execute('UPDATE channel_usage SET usage_partial=1 WHERE account_id=? AND update_id=?', (account_id, update_id))
        for name, count in counts.items():
            db.execute(f'UPDATE channel_usage SET {name}=MAX(COALESCE({name},0),?) WHERE account_id=? AND update_id=?',
                       (count, account_id, update_id))


def finish(account_id, update_id, status):
    assert status in ('completed', 'cancelled', 'failed')
    with connection() as db:
        db.execute('UPDATE channel_usage SET status=? WHERE account_id=? AND update_id=?', (status, account_id, update_id))


def summary(account_id, user_id=None):
    cutoff = int(time.time()) - 86400
    with connection() as db:
        rows = db.execute('SELECT * FROM channel_usage WHERE account_id=? AND created_at>?' + (' AND user_id=?' if user_id is not None else ''),
                          (account_id, cutoff, user_id) if user_id is not None else (account_id, cutoff)).fetchall()
        attempts = db.execute('SELECT COUNT(*) FROM channel_budget WHERE account_id=? AND requested_at>?',
                              (account_id, int(time.time()) - 3600)).fetchone()[0]
    return {
        'period_hours': 24, 'requests': len(rows),
        'reported_requests': sum(any(row[name] is not None for name in ('prompt_tokens', 'completion_tokens', 'total_tokens')) for row in rows),
        'complete_requests': sum(row['status'] == 'completed' and not row['usage_partial'] and row['prompt_tokens'] is not None and row['completion_tokens'] is not None for row in rows),
        'input_reports': sum(row['prompt_tokens'] is not None for row in rows),
        'output_reports': sum(row['completion_tokens'] is not None for row in rows),
        'prompt_tokens': sum(row['prompt_tokens'] or 0 for row in rows),
        'completion_tokens': sum(row['completion_tokens'] or 0 for row in rows),
        'total_tokens': sum(row['total_tokens'] if row['total_tokens'] is not None else (row['prompt_tokens'] or 0) + (row['completion_tokens'] or 0) for row in rows),
        'hourly_request_limit': 30, 'hourly_requests_remaining': max(0, 30 - attempts),
    }
