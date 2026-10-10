"""Data-only scheduling proposals: execution always needs a human confirmation."""
import json

PROPOSE_AUTOMATION_TOOL = {
    'type': 'function', 'function': {
        'name': 'propose_automation',
        'description': 'When the user asks to schedule a task or reminder, propose a complete plan for them to review. Ask for missing instructions or timing first. This does NOT create or activate a task. Never claim it was scheduled. The user chooses model, capabilities and confirms activation in the application or channel controls.',
        'parameters': {'type': 'object', 'properties': {
            'title': {'type': 'string'}, 'prompt': {'type': 'string', 'description': 'Standalone instructions for the future run, including the requested output.'},
            'scheduleType': {'type': 'string', 'enum': ['interval', 'once', 'weekly']},
            'intervalSeconds': {'type': 'integer', 'minimum': 60},
            'runAt': {'type': 'integer', 'description': 'Future Unix timestamp in milliseconds for a once schedule.'},
            'timezone': {'type': 'string', 'description': 'Explicit IANA timezone, e.g. America/Bogota. Ask if unknown.'},
            'weekdays': {'type': 'array', 'items': {'type': 'integer', 'minimum': 0, 'maximum': 6}},
            'localTime': {'type': 'string', 'description': 'HH:MM for weekly schedules.'},
            'webAccess': {'type': 'boolean', 'description': 'Propose public web research; requires confirmation.'},
            'notify': {'type': 'boolean'},
        }, 'required': ['title', 'prompt', 'scheduleType', 'timezone'], 'additionalProperties': False},
    },
}


def validate_proposal(arguments):
    from routes.tasks import TaskInput
    from core.inference.task_scheduler import next_occurrence
    import time
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
    if not isinstance(arguments, dict):
        raise ValueError('Invalid automation plan')
    allowed = PROPOSE_AUTOMATION_TOOL['function']['parameters']['properties']
    data = TaskInput.model_validate({key: value for key, value in arguments.items() if key in allowed} | {
        'enabled': False, 'workspaceAccess': 'none',
        'executionMode': 'agent' if arguments.get('webAccess') else 'text',
    }).model_dump()
    if not data['title'].strip() or not data['prompt'].strip():
        raise ValueError('Provide task instructions and title')
    try:
        ZoneInfo(data['timezone'])
    except (ZoneInfoNotFoundError, ValueError):
        raise ValueError('Choose an available IANA timezone') from None
    if data['scheduleType'] == 'interval' and data['intervalSeconds'] is None:
        raise ValueError('Choose an interval of at least 60 seconds')
    if data['scheduleType'] == 'weekly' and (not data['weekdays'] or any(day not in range(7) for day in data['weekdays'])):
        raise ValueError('Choose weekdays from Monday (0) to Sunday (6)')
    now = int(time.time() * 1000)
    if data['scheduleType'] == 'once':
        if not data.get('runAt') or data['runAt'] <= now:
            raise ValueError('Choose a future date')
    else:
        next_occurrence(data, now)
    return data


def propose_automation(arguments):
    try:
        return json.dumps({'kind': 'automation_proposal', 'plan': validate_proposal(arguments)}, ensure_ascii=False)
    except (ValueError, TypeError) as error:
        return json.dumps({'error': str(error), 'scheduled': False}, ensure_ascii=False)
