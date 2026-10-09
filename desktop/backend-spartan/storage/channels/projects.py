"""Explicit per-sender project visibility, without filesystem permissions."""
import json

from .repository import connection, get_account
from storage.studio.chat_projects import get_chat_project, list_chat_projects
from core.channels.permissions import project_allowed, is_owner


def available(account_id, user_id):
    account = get_account(account_id)
    if not account or user_id not in account['allowed_user_ids']:
        return []
    return [{'id': project['id'], 'name': project['name']} for project in list_chat_projects()
            if not project['archived'] and project_allowed(account, user_id, project['id'])]


def grant(account_id, owner, user_id, project_ids, *, mode='selected', context=None):
    # Indexed context is separate from visibility; never grants filesystem tools.
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT config FROM channel_accounts WHERE id=? AND owner=?', (account_id, owner)).fetchone()
        if not row:
            raise ValueError('account_not_found')
        config = json.loads(row['config'])
        if user_id not in config['allowed_user_ids']:
            raise ValueError('user_not_authorized')
        if mode not in ('selected', 'all'):
            raise ValueError('invalid_project_mode')
        if mode == 'all' and not is_owner(config, user_id):
            raise ValueError('owner_required')
        ids = sorted(set(project_ids))
        if any(not (project := get_chat_project(identifier)) or project['archived'] for identifier in ids):
            raise ValueError('project_not_found')
        config.setdefault('project_grants', {})[user_id] = ids
        config.setdefault('project_access', {})[user_id] = mode
        if context is not None:
            config.setdefault('project_context', {})[user_id] = bool(context)
        # Responses may quote project contents. A policy change clears those turns.
        db.execute('DELETE FROM channel_history WHERE account_id=? AND user_id=?', (account_id, user_id))
        if not project_allowed(config, user_id, config.get('selected_projects', {}).get(user_id)):
            config.setdefault('selected_projects', {}).pop(user_id, None)
        db.execute('UPDATE channel_accounts SET config=? WHERE id=?', (json.dumps(config), account_id))


def select(account_id, user_id, project_id):
    with connection() as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT config,enabled FROM channel_accounts WHERE id=?', (account_id,)).fetchone()
        if not row or not row['enabled']:
            return False
        config = json.loads(row['config'])
        if user_id not in config['allowed_user_ids']:
            return False
        if project_id is not None:
            project = get_chat_project(project_id)
            if (not project_allowed(config, user_id, project_id)
                    or not project or project['archived']):
                return False
        config.setdefault('selected_projects', {})[user_id] = project_id
        if json.loads(row['config']).get('selected_projects', {}).get(user_id) != project_id:
            db.execute('DELETE FROM channel_history WHERE account_id=? AND user_id=?', (account_id, user_id))
        db.execute('UPDATE channel_accounts SET config=? WHERE id=?', (json.dumps(config), account_id))
        return True


def selected(account_id, user_id):
    account = get_account(account_id)
    if not account:
        return None
    identifier = account.get('selected_projects', {}).get(user_id)
    return next((project for project in available(account_id, user_id) if project['id'] == identifier), None)
