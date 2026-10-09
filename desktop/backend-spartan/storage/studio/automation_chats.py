"""Chat records owned by one scheduled execution, with durable text checkpoints."""
import json
from urllib.parse import quote

from storage.studio.connection import get_connection


def create_run_chat(conn, task, run_id, now):
    thread_id = 'automation-' + run_id
    project_id = task.get('projectId')
    if project_id and not conn.execute('SELECT 1 FROM chat_projects WHERE id=? AND archived=0', (project_id,)).fetchone():
        raise ValueError('Automation project is unavailable')
    conn.execute('INSERT INTO chat_threads(id,title,model_type,model_id,project_id,archived,created_at,updated_at) VALUES(?,?,?,?,?,0,?,?)',
                 (thread_id, task['title'], 'base', f"external::{task['providerId']}::{quote(task['model'], safe='')}", project_id, now, now))
    metadata = json.dumps({'automationRunId': run_id, 'automationId': task['id'], 'serverManaged': True})
    for suffix, role, parent, text in [('prompt', 'user', None, task['prompt']), ('answer', 'assistant', run_id + '-prompt', '')]:
        conn.execute('INSERT INTO chat_messages(id,thread_id,parent_id,role,content_json,metadata_json,created_at) VALUES(?,?,?,?,?,?,?)',
                     (run_id + '-' + suffix, thread_id, parent, role, json.dumps([{'type': 'text', 'text': text}]), metadata, now + (role == 'assistant')))
    return thread_id


def checkpoint(run_id, text, now):
    conn = get_connection()
    try:
        conn.execute('BEGIN IMMEDIATE')
        run = conn.execute("SELECT thread_id FROM agent_task_runs WHERE id=? AND status='running'", (run_id,)).fetchone()
        if not run:
            raise ValueError('Automation execution is no longer active')
        conn.execute("UPDATE agent_task_runs SET output=?,heartbeat_at=? WHERE id=?", (text, now, run_id))
        if run['thread_id']:
            if not conn.execute('SELECT 1 FROM chat_threads WHERE id=?', (run['thread_id'],)).fetchone():
                raise ValueError('Automation chat was deleted')
            conn.execute('UPDATE chat_messages SET content_json=? WHERE id=? AND thread_id=?',
                         (json.dumps([{'type': 'text', 'text': text}]), run_id + '-answer', run['thread_id']))
            conn.execute('UPDATE chat_threads SET updated_at=? WHERE id=?', (now, run['thread_id']))
        conn.commit()
    finally:
        conn.close()


def heartbeat(run_id, now):
    """Keep leases alive during provider silence; stop when the chat/run disappears."""
    conn = get_connection()
    try:
        result = conn.execute("UPDATE agent_task_runs SET heartbeat_at=? WHERE id=? AND status='running' AND EXISTS (SELECT 1 FROM chat_threads WHERE chat_threads.id=agent_task_runs.thread_id)", (now, run_id))
        conn.commit()
        return result.rowcount == 1
    finally:
        conn.close()


def finish_chat(conn, run_id, output, error, now):
    run = conn.execute('SELECT thread_id,output FROM agent_task_runs WHERE id=?', (run_id,)).fetchone()
    if not run or not run['thread_id']:
        return
    text = output if output is not None else run['output'] or ''
    if error:
        text += '\n\n' + error
    conn.execute('UPDATE chat_messages SET content_json=? WHERE id=? AND thread_id=?',
                 (json.dumps([{'type': 'text', 'text': text}]), run_id + '-answer', run['thread_id']))
    conn.execute('UPDATE chat_threads SET updated_at=? WHERE id=?', (now, run['thread_id']))
