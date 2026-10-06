"""Platform metadata is authoritative; message bodies never grant permissions."""


def normalize_private_message(update: dict, allowed_user_ids: list[str]):
    message = update.get('message')
    if not isinstance(message, dict):
        return None
    sender, chat = message.get('from') or {}, message.get('chat') or {}
    user_id, chat_id = sender.get('id'), chat.get('id')
    if (chat.get('type') != 'private' or type(user_id) is not int or
            type(chat_id) is not int or user_id != chat_id or sender.get('is_bot') or
            str(user_id) not in allowed_user_ids):
        return None
    text = message.get('text', '')
    if not isinstance(text, str) or len(text) > 32000:
        return None
    media = 'voice' if message.get('voice') else 'document' if message.get('document') else 'audio' if message.get('audio') else None
    if not text and not media:
        return None
    return {'user_id': str(user_id), 'chat_id': chat_id, 'text': text, 'media': media}
