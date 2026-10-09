"""Deliver reference photos only while the sender still has access."""
from storage.channels import repository as repo

from .images import ChannelReply
from .telegram import TelegramError


class DeliveryRevoked(Exception):
    pass


def check_access(account_id, user_id):
    current = repo.get_account(account_id)
    if not current or not current['enabled'] or user_id not in current['allowed_user_ids']:
        raise DeliveryRevoked()


async def deliver(transport, account, message, output):
    account_id = account['id']
    check_access(account_id, message['user_id'])
    await transport.send(message['chat_id'], str(output))
    delivered = str(output)
    attachments = output.images[:2] if isinstance(output, ChannelReply) else ()
    for index, image in enumerate(attachments):
        check_access(account_id, message['user_id'])
        try:
            await transport.photo(message['chat_id'], image)
        except TelegramError as error:
            if error.code != 'photo_unavailable':
                # Ambiguous delivery and authentication/rate failures must not
                # become an automatic retry that duplicates a delivered photo.
                raise
            repo.event(account_id, 'photo_unavailable')
            notice = (f'No pude enviar la imagen {index + 1}. Puedes abrir sus enlaces en la respuesta anterior.' if account['locale'] == 'es'
                      else f'I could not send image {index + 1}. You can open its links in the previous reply.')
            check_access(account_id, message['user_id'])
            await transport.send(message['chat_id'], notice)
            delivered += '\n\n' + notice
        else:
            repo.event(account_id, 'photo_sent')
        if index + 1 < len(attachments):
            from .progress import delay
            await delay(1)
    check_access(account_id, message['user_id'])
    return delivered
