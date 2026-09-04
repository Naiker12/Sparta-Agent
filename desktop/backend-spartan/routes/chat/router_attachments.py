"""FastAPI route handlers for chat attachments and media content serving."""

import urllib.parse
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response

from auth.authentication import get_current_subject
from loggers import get_logger
from storage.studio_db import (
    ChatMessageProtectedError,
    delete_chat_attachment,
    get_chat_attachment,
    list_chat_attachments_page,
)
from utils.utils import log_and_http_error, safe_curated_detail
from routes.chat.helpers import (
    _AUDIO_FORMAT_MEDIA_TYPES,
    _decode_attachment_base64,
    _safe_image_media_type,
)

logger = get_logger(__name__)
router = APIRouter()

@router.get("/attachments")
def list_attachments(
    limit: Annotated[int, Query(ge = 1, le = 100)] = 50,
    offset: Annotated[int, Query(ge = 0)] = 0,
    current_subject: str = Depends(get_current_subject),
) -> dict:
    """One bounded page of chat uploads for the settings Data tab."""
    attachments, next_offset = list_chat_attachments_page(limit = limit, offset = offset)
    return {"attachments": attachments, "nextOffset": next_offset}



@router.get("/attachments/{message_id}/{attachment_id}/file")
def get_attachment_file(
    message_id: str,
    attachment_id: str,
    current_subject: str = Depends(get_current_subject),
):
    """Serve one attachment's stored content: image or audio bytes, or
    extracted text."""
    import urllib.parse

    from fastapi.responses import Response

    attachment = get_chat_attachment(message_id, attachment_id)
    if attachment is None:
        raise HTTPException(status_code = 404, detail = "Attachment not found")

    attachment_content_type = attachment.get("contentType")
    texts: list[str] = []
    for part in attachment.get("content") or []:
        if not isinstance(part, dict):
            continue
        image = part.get("image")
        if isinstance(image, str) and image[:5].lower() == "data:":
            header, _, payload = image.partition(",")
            media_type = _safe_image_media_type(
                header[5:].split(";", 1)[0] or "application/octet-stream"
            )
            if "base64" not in header.lower():
                # RFC 2397 non-base64 form stores percent-encoded bytes.
                data = urllib.parse.unquote_to_bytes(payload)
                return Response(content = data, media_type = media_type)
            data = _decode_attachment_base64(payload)
            return Response(content = data, media_type = media_type)
        # Audio parts: the attachment adapter stores {data, format} with raw
        # base64; compare chats store a bare base64 string.
        audio = part.get("audio")
        if isinstance(audio, dict) or (isinstance(audio, str) and audio):
            if isinstance(audio, dict):
                payload = audio.get("data")
                audio_format = audio.get("format")
            else:
                payload = audio.rsplit(",", 1)[-1]
                audio_format = None
            if isinstance(payload, str) and payload:
                data = _decode_attachment_base64(payload)
                media_type = (
                    attachment_content_type
                    if isinstance(attachment_content_type, str)
                    and attachment_content_type.startswith("audio/")
                    else _AUDIO_FORMAT_MEDIA_TYPES.get(
                        str(audio_format or "").lower(), "application/octet-stream"
                    )
                )
                return Response(content = data, media_type = media_type)
        text = part.get("text")
        if isinstance(text, str) and text:
            texts.append(text)
    if texts:
        return Response(content = "\n".join(texts), media_type = "text/plain; charset=utf-8")
    raise HTTPException(status_code = 404, detail = "Attachment has no stored content")


@router.delete("/attachments/{message_id}/{attachment_id}")
def delete_attachment(
    message_id: str,
    attachment_id: str,
    current_subject: str = Depends(get_current_subject),
) -> dict:
    """Remove one attachment from its chat message."""
    try:
        deleted = delete_chat_attachment(message_id, attachment_id)
    except ChatMessageProtectedError as exc:
        raise log_and_http_error(
            exc,
            409,
            safe_curated_detail(exc),
            event = "chat_history.delete_attachment_conflict",
            log = logger,
        ) from exc
    if not deleted:
        raise HTTPException(status_code = 404, detail = "Attachment not found")
    return {"ok": True}


