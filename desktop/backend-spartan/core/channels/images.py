"""Public reference images: metadata only, never generated or downloaded locally."""
import json
from dataclasses import dataclass

from . import web

IMAGE_TOOL = {'type': 'function', 'function': {
    'name': 'search_reference_images',
    'description': 'Find up to two public reference images requested by the user. Returns titles, image URLs and source pages, not visual analysis or generated images.',
    'parameters': {'type': 'object', 'properties': {'query': {'type': 'string', 'maxLength': 500}}, 'required': ['query'], 'additionalProperties': False},
}}


@dataclass(frozen=True)
class ReferenceImage:
    title: str
    url: str
    image_url: str

    def evidence(self):
        return {'title': self.title, 'url': self.url, 'image_url': self.image_url, 'kind': 'image'}


class ChannelReply(str):
    """Keep the existing text/history contract, with trusted adapter attachments."""
    def __new__(cls, text, images=()):
        value = super().__new__(cls, text)
        value.images = tuple(images)
        return value


def public_url(value):
    try:
        return web.page_arguments(json.dumps({'url': value}))
    except (ValueError, TypeError):
        return None


def parse_results(results):
    accepted = []
    if not isinstance(results, list):
        return accepted
    for result in results[:12]:
        if not isinstance(result, dict):
            continue
        image_url, source_url = public_url(result.get('image')), public_url(result.get('url'))
        if not image_url or not source_url or any(image.image_url == image_url for image in accepted):
            continue
        title = result.get('title')
        if not isinstance(title, str):
            continue
        title = ' '.join(''.join(char for char in title if ord(char) >= 32).split())[:160]
        if not title:
            continue
        # Exclude known geometry that Telegram cannot accept as a photo.
        width, height = result.get('width'), result.get('height')
        if type(width) is int and type(height) is int:
            if min(width, height) <= 0 or width + height > 10000 or max(width, height) / min(width, height) > 20:
                continue
        accepted.append(ReferenceImage(title, source_url, image_url))
        if len(accepted) == 2:
            break
    return accepted


async def search(query):
    try:
        query = web.arguments(json.dumps({'query': query}))
    except (ValueError, TypeError):
        return []
    def fetch(cancelled):
        from ddgs import DDGS
        results = DDGS(timeout=10).images(query, max_results=6, safesearch='on')
        return [] if cancelled.is_set() else parse_results(results)
    return await web.public_lookup(fetch)
