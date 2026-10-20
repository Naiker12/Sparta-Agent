"""Short-lived, sender-bound Telegram controls. No action payloads from the model."""
import secrets
import time

_pending = {}


def issue(account_id, user_id, chat_id, text='', *, cancel_for=None, action=None, ref=None):
    now = time.monotonic()
    for key in list(_pending):
        if _pending[key]['expires'] <= now:
            del _pending[key]
    while len(_pending) >= 1000:
        del _pending[next(iter(_pending))]
    token = 'sc:' + secrets.token_urlsafe(18)
    _pending[token] = dict(account_id=account_id, user_id=user_id,
                           chat_id=chat_id, text=text, cancel_for=cancel_for,
                           action=action, ref=ref,
                           expires=now + 600)
    return token


def revoke(tokens):
    for token in tokens:
        _pending.pop(token, None)


def revoke_user(account_id, user_id):
    for token, control in list(_pending.items()):
        if control['account_id'] == account_id and control['user_id'] == user_id:
            _pending.pop(token, None)


def consume(account, update):
    query = update.get('callback_query')
    if not isinstance(query, dict) or not account.get('enabled'):
        return None
    sender, message = query.get('from') or {}, query.get('message') or {}
    if not isinstance(sender, dict) or not isinstance(message, dict):
        return None
    chat = message.get('chat') or {}
    if not isinstance(chat, dict):
        return None
    user, chat_id = sender.get('id'), chat.get('id')
    token = query.get('data')
    if (type(user) is not int or type(chat_id) is not int or user != chat_id
            or chat.get('type') != 'private' or sender.get('is_bot')
            or str(user) not in account.get('allowed_user_ids', [])
            or not isinstance(token, str)):
        return None
    control = _pending.get(token)
    if (not control or control['expires'] <= time.monotonic()
            or control['account_id'] != account['id']
            or control['user_id'] != str(user) or control['chat_id'] != chat_id):
        return None
    _pending.pop(token)
    result = dict(user_id=str(user), chat_id=chat_id, text=control['text'], media=None)
    if control.get('action'):
        result['action'] = control['action']
    if control.get('ref'):
        result['ref'] = control['ref']
    if control['cancel_for'] is not None:
        result['cancel_for'] = control['cancel_for']
    return result


def file_keyboard(account, message, document):
    size = f"{document.size / (1024 * 1024):.1f} MB" if document.size >= 1024 * 1024 else f"{max(1, document.size // 1024)} KB"
    send = issue(account['id'], message['user_id'], message['chat_id'],
                 action='send_file', ref=document.outbox_id)
    cancel = issue(account['id'], message['user_id'], message['chat_id'],
                   action='cancel_file', ref=document.outbox_id)
    es = account['locale'] == 'es'
    return {'inline_keyboard': [[
        {'text': (f'Enviar «{document.filename}» · {size}' if es else f'Send “{document.filename}” · {size}')[:64], 'callback_data': send},
        {'text': 'Cancelar' if es else 'Cancel', 'callback_data': cancel},
    ]]}


def files_keyboard(account, message, documents):
    rows = []
    for document in tuple(documents)[:5]:
        rows.extend(file_keyboard(account, message, document)['inline_keyboard'])
    return {'inline_keyboard': rows} if rows else None


def project_keyboard(account, message):
    from storage.channels.projects import available
    rows = []
    for project in available(account['id'], message['user_id'])[:20]:
        rows.append([{'text': project['name'][:60], 'callback_data': issue(
            account['id'], message['user_id'], message['chat_id'], '/project ' + project['id'])}])
    if rows:
        rows.append([{'text': 'Salir del proyecto' if account['locale'] == 'es' else 'Leave project',
                      'callback_data': issue(account['id'], message['user_id'], message['chat_id'], '/project off')}])
    return {'inline_keyboard': rows} if rows else None
