"""Observe channel execution in the shared ledger; never enqueue a second executor."""
import hashlib
import json
import time
import uuid
from contextlib import contextmanager

from storage.work_run_events import append_work_event
from storage.work_runs_schema import ensure_work_runs_schema
from .repository import connection


@contextmanager
def ledger():
    with connection() as db:
        ensure_work_runs_schema(db)
        db.execute('BEGIN IMMEDIATE')
        yield db


def start(account_id, update_id, message):
    with ledger() as db:
        account = db.execute('SELECT owner,config,enabled FROM channel_accounts WHERE id=?', (account_id,)).fetchone()
        if not account or not account['enabled']:
            raise ValueError('channel_not_authorized')
        config = json.loads(account['config'])
        if message['user_id'] not in config['allowed_user_ids']:
            raise ValueError('channel_not_authorized')
        key = f'channel:{account_id}:{update_id}'
        if db.execute('SELECT id FROM work_runs WHERE owner_subject=? AND request_key=?', (account['owner'], key)).fetchone():
            raise ValueError('channel_work_already_observed')
        request = {'origin': 'telegram', 'promptPreview': message['text'][:1000],
                   'modelId': config['model'], 'channelName': config['name']}
        raw = json.dumps(request, ensure_ascii=False, sort_keys=True)
        run_id, now = str(uuid.uuid4()), int(time.time() * 1000)
        db.execute("INSERT INTO work_runs(id,owner_subject,request_key,request_hash,request_json,status,attempt,created_at,updated_at,source_kind,source_channel_id,source_item_id) VALUES(?,?,?,?,?,'running',1,?,?,'telegram',?,?)",
                   (run_id, account['owner'], key, hashlib.sha256(raw.encode()).hexdigest(), raw, now, now, account_id, str(update_id)))
        append_work_event(db, run_id, 'telegram.started', now)
        return run_id


def finish(run_id, status, summary='', reason=''):
    assert status in ('completed', 'cancelled', 'failed', 'needs_review')
    with ledger() as db:
        row = db.execute("SELECT status FROM work_runs WHERE id=? AND source_kind='telegram'", (run_id,)).fetchone()
        if not row or row['status'] != 'running':
            return
        result = json.dumps({'summary': summary[:12000], 'reason': reason, 'observedBy': 'telegram_runtime'}, ensure_ascii=False)
        db.execute('UPDATE work_runs SET status=?,result_json=? WHERE id=?', (status, result, run_id))
        append_work_event(db, run_id, 'telegram.' + status, int(time.time() * 1000))


def recover(account_id):
    with ledger() as db:
        rows = db.execute("SELECT id FROM work_runs WHERE source_kind='telegram' AND source_channel_id=? AND status='running'", (account_id,)).fetchall()
        for row in rows:
            db.execute("UPDATE work_runs SET status='needs_review' WHERE id=?", (row['id'],))
            append_work_event(db, row['id'], 'telegram.interrupted', int(time.time() * 1000))
        db.execute("UPDATE channel_usage SET status='failed' WHERE account_id=? AND status='running'", (account_id,))


def delete(db, account_id):
    db.execute("DELETE FROM work_run_events WHERE run_id IN (SELECT id FROM work_runs WHERE source_kind='telegram' AND source_channel_id=?)", (account_id,))
    db.execute("DELETE FROM work_runs WHERE source_kind='telegram' AND source_channel_id=?", (account_id,))
