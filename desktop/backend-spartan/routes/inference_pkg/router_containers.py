"""External OpenAI shell-tool container management router.

Extracted from monolithic routes/inference.py to preserve SRP and clean architecture.
"""
from __future__ import annotations

import logging
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

from auth import get_current_subject
from core.inference.external_provider import ExternalProviderClient
from core.inference.providers import get_base_url
from routes.provider_credentials import resolve_provider_api_key_or_400
from models.inference import (
    CreateOpenAIContainerBody,
    DeleteOpenAIContainerBody,
    ListOpenAIContainersResponse,
    OpenAIContainerRequest,
    OpenAIContainerSummary,
)
from storage import providers_db
from utils.utils import log_and_http_error

logger = logging.getLogger(__name__)

router = APIRouter()

def _request_has_api_key(request: Request) -> bool:
    auth = request.headers.get("authorization", "")
    return bool(auth.strip().lower().startswith("bearer ") and len(auth.strip()) > 7)

# ── OpenAI shell-tool container management ───────────────────────


def _resolve_openai_cloud_client(
    body: OpenAIContainerRequest, *, allow_saved_key: bool
) -> ExternalProviderClient:
    """
    Decrypt the API key + validate the base URL points at OpenAI cloud, then
    build an ExternalProviderClient for the three container CRUD endpoints
    below. The shell tool only exists on api.openai.com, so rejecting non-cloud
    bases up front prevents confusing 404s on ollama / llama.cpp / vLLM /
    custom presets.
    """
    base_url = body.provider_base_url or get_base_url("openai")
    if body.provider_id and not body.encrypted_api_key:
        config = providers_db.get_provider(body.provider_id)
        if config is None:
            raise HTTPException(
                status_code = 404,
                detail = f"Provider config not found: {body.provider_id}",
            )
        if config["provider_type"] != "openai":
            raise HTTPException(
                status_code = 400,
                detail = "OpenAI container management requires a saved OpenAI provider.",
            )

        if not config["is_enabled"]:
            raise HTTPException(
                status_code = 400,
                detail = f"Provider '{config['display_name']}' is disabled.",
            )
        base_url = config["base_url"]
    from urllib.parse import urlparse

    parsed_base_url = urlparse(base_url)
    if parsed_base_url.scheme != "https" or parsed_base_url.hostname != "api.openai.com":
        raise HTTPException(
            status_code = 400,
            detail = (
                "OpenAI container management is only available on the "
                "managed cloud (api.openai.com). The provider's base URL "
                f"points at {base_url!r}."
            ),
        )
    api_key = resolve_provider_api_key_or_400(
        body.provider_id,
        body.encrypted_api_key,
        allow_saved_key = allow_saved_key,
    )
    if not api_key:
        raise HTTPException(status_code = 400, detail = "No OpenAI API key is saved.")
    return ExternalProviderClient(
        provider_type = "openai",
        base_url = base_url,
        api_key = api_key,
    )


def _summarize_container(raw: dict) -> OpenAIContainerSummary:
    expires = raw.get("expires_after")
    expires_minutes: Optional[int] = None
    if isinstance(expires, dict):
        minutes = expires.get("minutes")
        if isinstance(minutes, int):
            expires_minutes = minutes
    return OpenAIContainerSummary(
        id = str(raw.get("id") or ""),
        name = raw.get("name"),
        created_at = raw.get("created_at") if isinstance(raw.get("created_at"), int) else None,
        last_active_at = raw.get("last_active_at")
        if isinstance(raw.get("last_active_at"), int)
        else None,
        expires_after_minutes = expires_minutes,
        status = raw.get("status") if isinstance(raw.get("status"), str) else None,
    )


@router.post(
    "/external/openai/containers/list",
    response_model = ListOpenAIContainersResponse,
)
async def list_openai_containers(
    body: OpenAIContainerRequest,
    request: Request,
    current_subject: str = Depends(get_current_subject),
) -> ListOpenAIContainersResponse:
    """List the user's OpenAI shell-tool containers."""
    client = _resolve_openai_cloud_client(body, allow_saved_key = not _request_has_api_key(request))
    try:
        try:
            raw = await client.list_openai_containers()
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text[:500] if exc.response is not None else str(exc)
            raise HTTPException(
                status_code = exc.response.status_code if exc.response else 502,
                detail = f"OpenAI rejected /containers list: {detail}",
            )
        except httpx.HTTPError as exc:
            raise log_and_http_error(
                exc,
                502,
                "Could not reach OpenAI.",
                event = "openai_container_list.transport_error",
                log = logger,
            )
        # OpenAI keeps expired containers in /v1/containers indefinitely with
        # status="expired" -- dead but still listed. Hide them so the picker
        # only shows usable containers.
        return ListOpenAIContainersResponse(
            containers = [
                _summarize_container(c)
                for c in raw
                if isinstance(c, dict) and c.get("status") != "expired"
            ],
        )
    finally:
        await client.close()


@router.post(
    "/external/openai/containers/create",
    response_model = OpenAIContainerSummary,
)
async def create_openai_container(
    body: CreateOpenAIContainerBody,
    request: Request,
    _current_subject: str = Depends(get_current_subject),
) -> OpenAIContainerSummary:
    """Create a named container with the user-chosen idle TTL."""
    client = _resolve_openai_cloud_client(body, allow_saved_key = not _request_has_api_key(request))
    try:
        try:
            raw = await client.create_openai_container(
                name = body.name,
                ttl_minutes = body.ttl_minutes,
            )
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text[:500] if exc.response is not None else str(exc)
            raise HTTPException(
                status_code = exc.response.status_code if exc.response else 502,
                detail = f"OpenAI rejected /containers create: {detail}",
            )
        except httpx.HTTPError as exc:
            raise log_and_http_error(
                exc,
                502,
                "Could not reach OpenAI.",
                event = "openai_container_create.transport_error",
                log = logger,
            )
        if not isinstance(raw, dict):
            raise HTTPException(
                status_code = 502,
                detail = "OpenAI returned an unexpected container payload.",
            )
        return _summarize_container(raw)
    finally:
        await client.close()


@router.post("/external/openai/containers/delete", status_code = 204)
async def delete_openai_container(
    body: DeleteOpenAIContainerBody,
    request: Request,
    current_subject: str = Depends(get_current_subject),
) -> None:
    """Delete a named container by id."""
    logger.info(
        "openai_container_delete.request subject=%s container_id=%s base_url=%s",
        current_subject,
        body.container_id,
        body.provider_base_url,
    )
    client = _resolve_openai_cloud_client(body, allow_saved_key = not _request_has_api_key(request))
    try:
        try:
            await client.delete_openai_container(body.container_id)
            logger.info(
                "openai_container_delete.success container_id=%s",
                body.container_id,
            )
        except httpx.HTTPStatusError as exc:
            detail = exc.response.text[:500] if exc.response is not None else str(exc)
            logger.warning(
                "openai_container_delete.openai_rejected container_id=%s status=%s body=%s",
                body.container_id,
                exc.response.status_code if exc.response else None,
                detail,
            )
            raise HTTPException(
                status_code = exc.response.status_code if exc.response else 502,
                detail = f"OpenAI rejected /containers delete: {detail}",
            )
        except httpx.HTTPError as exc:
            raise log_and_http_error(
                exc,
                502,
                "Could not reach OpenAI.",
                event = "openai_container_delete.transport_error",
                log = logger,
            )
    finally:
        await client.close()


