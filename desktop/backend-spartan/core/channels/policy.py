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
    result = {'user_id': str(user_id), 'chat_id': chat_id, 'text': text, 'media': media}
    if media == 'document' and isinstance(message['document'], dict):
        import re
        attachment = message['document']
        name, file_id = attachment.get('file_name'), attachment.get('file_id')
        # Display name only. Never accept paths or use this name on disk.
        if isinstance(name, str) and re.fullmatch(r'[\w .()-]{1,120}\.(txt|md|csv|json)', name, re.IGNORECASE):
            result['document'] = {'file_id': file_id if isinstance(file_id, str) and len(file_id) <= 512 else '',
                                  'file_name': name, 'file_size': attachment.get('file_size') if type(attachment.get('file_size')) is int else None}
            caption = message.get('caption', '')
            if isinstance(caption, str) and len(caption) <= 4000:
                result['text'] = caption
    if media in ('voice', 'audio'):
        attachment = message[media]
        if isinstance(attachment, dict):
            # Only Telegram identifiers and bounded metadata; no filename, URL
            # or caption can choose a local path or grant tool permissions.
            file_id = attachment.get('file_id')
            result['audio'] = {'file_id': file_id if isinstance(file_id, str) and len(file_id) <= 512 else '',
                               'file_size': attachment.get('file_size') if type(attachment.get('file_size')) is int else None,
                               'duration': attachment.get('duration') if type(attachment.get('duration')) is int else None}
    return result
