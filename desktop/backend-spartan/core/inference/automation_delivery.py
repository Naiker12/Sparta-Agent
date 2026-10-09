"""Durable, owner-scoped announcements to a uniquely paired Telegram account."""
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import re
import uuid

from storage.studio.connection import get_connection
from storage.channels import repository
from storage.credential_secrets import get_secret
from core.channels.telegram import Telegram, TelegramError
import asyncio


def personal_destination(owner):
    try:
        candidates = [account for account in repository.accounts(owner) if account.get('platform', 'telegram') == 'telegram' and account.get('enabled') and account.get('owner_user_id') and account.get('owner_user_id') in account.get('allowed_user_ids', [])]
    except Exception:
        return None
    return candidates[0] if len(candidates) == 1 else None


def enqueue(conn, task, run_id, event, now, status=None, account=None):
    if not task.get('notify', True): return
    existing = conn.execute("SELECT account_id,user_id,locale FROM automation_deliveries WHERE run_id=? AND event='started'", (run_id,)).fetchone()
    if existing:
        account_id, user_id = existing['account_id'], existing['user_id']
    else:
        if not account: return
        account_id, user_id = account['id'], account['owner_user_id']
    stamp = datetime.fromtimestamp(now / 1000, timezone.utc).astimezone(ZoneInfo(task.get('timezone') or 'UTC')).strftime('%Y-%m-%d %H:%M:%S %Z')
    locale = existing['locale'] if existing else account.get('locale', 'es')
    spanish = locale == 'es'
    if event == 'started':
        title = 'Comienza la tarea' if spanish else 'Task started'
    else:
        title = ('Tarea completada' if status == 'completed' else 'La tarea necesita atención') if spanish else ('Task completed' if status == 'completed' else 'Task needs attention')
    label = re.sub(r'\b(?:sk-|hf_|ghp_|github_pat_)[A-Za-z0-9_-]+', '[redacted]', str(task['title']))
    label = re.sub(r'\s+', ' ', label).strip()[:180]
    details = ''
    if event == 'started' and task.get('scheduledAt'):
        planned = datetime.fromtimestamp(task['scheduledAt'] / 1000, timezone.utc).astimezone(ZoneInfo(task.get('timezone') or 'UTC')).strftime('%Y-%m-%d %H:%M:%S %Z')
        details += ('Programada: ' if spanish else 'Scheduled: ') + planned + '\n'
    if task.get('projectId'):
        project = conn.execute('SELECT name FROM chat_projects WHERE id=?', (task['projectId'],)).fetchone()
        if project:
            details += ('Proyecto: ' if spanish else 'Project: ') + str(project['name'])[:120] + '\n'
    if event == 'finished':
        run = conn.execute('SELECT started_at FROM agent_task_runs WHERE id=?', (run_id,)).fetchone()
        if run:
            details += ('Duración: ' if spanish else 'Duration: ') + str(max(0, (now - run['started_at']) // 1000)) + ' s\n'
    body = f"{title}: {label}\n{stamp}\n{details}" + (f"Ejecución: {run_id}. Puedes abrir su chat en Automatizaciones." if spanish else f"Execution: {run_id}. Open its chat in Automations.")
    conn.execute('INSERT OR IGNORE INTO automation_deliveries(id,run_id,event,owner,account_id,user_id,body,created_at,updated_at,locale) VALUES(?,?,?,?,?,?,?,?,?,?)',
                 (str(uuid.uuid4()), run_id, event, task['ownerSubject'], account_id, user_id, body, now, now, locale))


async def flush():
    from storage.studio.memory_tasks import _now
    conn = get_connection()
    try:
        conn.execute('BEGIN IMMEDIATE')
        conn.execute("UPDATE automation_deliveries SET status='unknown',error='Delivery interrupted; receipt unknown',updated_at=? WHERE status='sending' AND updated_at<?", (_now(), _now() - 120000))
        row = conn.execute("""SELECT d.* FROM automation_deliveries d WHERE status='pending' AND updated_at<=?
        AND (event='started' OR NOT EXISTS (SELECT 1 FROM automation_deliveries s WHERE s.run_id=d.run_id AND s.event='started' AND s.status IN ('pending','sending')))
        ORDER BY created_at,CASE event WHEN 'started' THEN 0 ELSE 1 END,id LIMIT 1""", (_now(),)).fetchone()
        if not row:
            conn.commit(); return
        entry = dict(row)
        conn.execute("UPDATE automation_deliveries SET status='sending',attempts=attempts+1,updated_at=? WHERE id=?", (_now(), entry['id']))
        conn.commit()
    finally: conn.close()
    status, error, next_attempt = 'delivered', None, _now()
    account = repository.get_account(entry['account_id'], entry['owner'])
    if not account or not account.get('enabled') or entry['user_id'] not in account.get('allowed_user_ids', []) or account.get('owner_user_id') != entry['user_id']:
        status, error = 'blocked', 'Destination is no longer authorized'
    else:
        token = get_secret('channel_bot_token', entry['account_id'])
        if not token:
            status, error = 'blocked', 'Channel credential unavailable'
        else:
            transport = Telegram(token)
            try:
                await transport.send(int(entry['user_id']), entry['body'])
            except TelegramError as failure:
                status, error = 'unknown', failure.code
                if failure.code == 'rate_limited':
                    status = 'pending' if entry['attempts'] < 2 else 'failed'
                    next_attempt = _now() + failure.retry_after * 1000
                elif failure.code == 'credentials_error':
                    status = 'blocked'
            finally:
                await transport.close()
    conn = get_connection()
    try:
        conn.execute('UPDATE automation_deliveries SET status=?,error=?,updated_at=? WHERE id=?', (status, error, next_attempt, entry['id']))
        conn.commit()
    finally: conn.close()


async def delivery_loop():
    while True:
        try:
            await flush()
        except asyncio.CancelledError:
            raise
        except Exception:
            # Delivery failures never fail or re-run the automation itself.
            pass
        await asyncio.sleep(1)
