"""Sender-bound plans; only explicit confirmation activates the schedule."""
import re
import secrets
import time
from datetime import datetime
from zoneinfo import ZoneInfo
from . import controls
from core.inference.automation_proposals import validate_proposal

_plans = {}


def can_propose(account, user_id, text):
    return bool(account.get('enabled') and account.get('owner') and
                user_id == account.get('owner_user_id') and user_id in account.get('allowed_user_ids', []) and
                re.search(r'\b(programa\w*|agend\w*|recu[eé]rd\w*|schedule\w*|remind\w*)\b', text, re.I))


def prepare(account, user_id, arguments):
    if not can_propose(account, user_id, 'schedule'):
        raise ValueError('Only the paired owner can schedule tasks')
    plan = validate_proposal(arguments)
    now = time.monotonic()
    for key in list(_plans):
        if _plans[key]['expires'] <= now or (_plans[key]['account'] == account['id'] and _plans[key]['user'] == user_id):
            del _plans[key]
    while len(_plans) >= 1000:
        del _plans[next(iter(_plans))]
    token = secrets.token_urlsafe(18)
    _plans[token] = {'account': account['id'], 'owner': account['owner'], 'user': user_id, 'provider': account['provider_id'], 'model': account['model'], 'plan': plan, 'expires': now + 600}
    from .images import ChannelReply
    day_names = ('Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom') if account['locale'] == 'es' else ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')
    schedule = (f"{plan['intervalSeconds']} s" if plan['scheduleType'] == 'interval' else
                f"{', '.join(day_names[day] for day in plan['weekdays'])} · {plan['localTime']} · {plan['timezone']}" if plan['scheduleType'] == 'weekly' else
                datetime.fromtimestamp(plan['runAt'] / 1000, ZoneInfo(plan['timezone'])).isoformat())
    spanish = account['locale'] == 'es'
    text = ('Plan de tarea' if spanish else 'Task plan') + '\n' + plan['title'] + '\n\n' + plan['prompt'] + '\n\n' + schedule
    text += '\n' + account['model'] + '\n' + ('Web pública: ' if spanish else 'Public web: ') + str(plan['webAccess'])
    text += '\n' + ('Sin acceso a archivos. Sparta debe seguir abierta. Confirma para activar o cancela. Para cambiar el plan, pide otro con las nuevas opciones.' if spanish else 'No file access. Sparta must remain running. Confirm to activate or cancel. To change the plan, request another with the new options.')
    reply = ChannelReply(text, [])
    reply.automation_plan_token = token
    return reply


def keyboard(account, message, token):
    return {'inline_keyboard': [[
        {'text': 'Confirmar horario' if account['locale'] == 'es' else 'Confirm schedule', 'callback_data': controls.issue(account['id'], message['user_id'], message['chat_id'], '/schedule_confirm ' + token)},
        {'text': 'Cancelar' if account['locale'] == 'es' else 'Cancel', 'callback_data': controls.issue(account['id'], message['user_id'], message['chat_id'], '/schedule_cancel ' + token)},
    ]]}


def resolve(account, message):
    parts = message['text'].split()
    if not parts or parts[0] not in ('/schedule_confirm', '/schedule_cancel'):
        return None
    entry = _plans.get(parts[1]) if len(parts) == 2 else None
    spanish = account['locale'] == 'es'
    if (not entry or entry['expires'] <= time.monotonic() or entry['account'] != account['id'] or
        entry['owner'] != account['owner'] or entry['user'] != message['user_id'] or
        not can_propose(account, message['user_id'], 'schedule')):
        return 'El plan expiró o no está autorizado. Solicita uno nuevo.' if spanish else 'The plan expired or is not authorized. Request a new plan.'
    token = parts[1]
    if parts[0] == '/schedule_cancel':
        _plans.pop(token, None)
        return 'Plan cancelado; no se activó ninguna tarea.' if spanish else 'Plan cancelled; no task was activated.'
    if entry['provider'] != account['provider_id'] or entry['model'] != account['model']:
        return 'Cambió el modelo de la conexión. Solicita un plan nuevo antes de confirmar.' if spanish else 'The connection model changed. Request a new plan before confirming.'
    try:
        from core.inference.task_scheduler import make_client
        from storage.studio.memory_tasks import upsert_task, activate_task
        make_client(account['provider_id'], account['model'])
        task_id = entry.get('task_id')
        if not task_id:
            task_id = upsert_task(entry['plan'], owner_subject=account['owner'])['id']
            entry['task_id'] = task_id
        task = activate_task(task_id, account['owner'], account['provider_id'], account['model'])
        _plans.pop(token, None)
        return ('Tarea programada: ' if spanish else 'Task scheduled: ') + task['title']
    except (ValueError, LookupError):
        return 'No se pudo activar. Revisa el modelo y el horario en Sparta.' if spanish else 'Activation failed. Check the model and schedule in Sparta.'
