"""Resolve persisted channel identity and project visibility outside the model."""


def is_owner(account, user_id):
    return bool(user_id and account.get('owner_user_id') == user_id
                and user_id in account.get('allowed_user_ids', []))


def all_projects(account, user_id):
    return (is_owner(account, user_id)
            and account.get('project_access', {}).get(user_id) == 'all')


def project_allowed(account, user_id, project_id):
    return (user_id in account.get('allowed_user_ids', [])
            and (all_projects(account, user_id)
                 or project_id in account.get('project_grants', {}).get(user_id, [])))


def project_context_allowed(account, user_id):
    return bool(user_id in account.get('allowed_user_ids', [])
                and account.get('project_context', {}).get(user_id, is_owner(account, user_id)))
