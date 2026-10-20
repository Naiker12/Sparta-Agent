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


FILE_CAPABILITIES = ('web_download', 'file_create', 'file_send')


def file_allowed(account, user_id, capability):
    if capability not in FILE_CAPABILITIES or user_id not in account.get('allowed_user_ids', []):
        return False
    configured = account.get('file_permissions', {}).get(user_id, {})
    if capability in configured:
        return configured[capability] is True
    # Preserve the selected defaults: only the owner can fetch public files or
    # create documents. Sending any file always requires an explicit grant.
    return capability in ('web_download', 'file_create') and is_owner(account, user_id)
