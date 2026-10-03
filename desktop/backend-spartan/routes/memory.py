"""Authenticated endpoints for the scoped conversational graph."""
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from auth.authentication import get_current_subject
from auth.authentication import authenticated_via_api_key
from storage.studio import conversation_memory as memory

router = APIRouter()

class MemoryInput(BaseModel):
    type: str = Field(default="fact", pattern="^(entity|fact|preference|event)$")
    label: str = Field(min_length=1, max_length=300)
    content: str = Field(min_length=1, max_length=10000)
    projectId: str | None = None
    confidence: float = Field(default=1, ge=0, le=1)

class MemoryEdgeInput(BaseModel):
    source: str = Field(min_length=1)
    target: str = Field(min_length=1)
    relation: str = Field(min_length=1, max_length=120)

class ExtractionInput(BaseModel):
    providerId: str = Field(min_length=1)
    model: str = Field(min_length=1, max_length=300)

class ReviewInput(BaseModel):
    extraction: dict
    selectedIndices: list[int] = Field(min_length=1, max_length=20)


@router.post('/nodes/{node_id}/accept-extraction')
def accept_extraction(node_id: str, body: ReviewInput,
                      current_subject: str = Depends(get_current_subject)):
    try:
        return memory.accept_extraction(current_subject, node_id, body.extraction, body.selectedIndices)
    except ValueError as error:
        raise HTTPException(422, 'Invalid proposals or missing source; no memory was changed') from error


@router.post('/nodes/{node_id}/extract')
async def extract_node(node_id: str, body: ExtractionInput,
                       current_subject: str = Depends(get_current_subject),
                       via_api_key: bool = Depends(authenticated_via_api_key)):
    # Saved installation credentials require an interactive UI session.
    from routes.provider_credentials import require_ui_session, resolve_provider_api_key_or_400
    from storage.providers_db import get_provider
    from core.inference.providers import get_base_url
    from core.inference.external_provider import ExternalProviderClient
    from core.inference.memory_extraction import extract
    require_ui_session(via_api_key)
    source = memory.get_node(current_subject, node_id)
    if source is None:
        raise HTTPException(404, 'Memory not found')
    provider = get_provider(body.providerId)
    if not provider or not provider['is_enabled']:
        raise HTTPException(422, 'Choose an enabled provider')
    if provider['provider_type'] == 'openai_codex':
        raise HTTPException(422, 'Memory extraction does not yet support subscription connections')
    allowed = provider.get('models') or provider.get('available_models') or []
    if body.model not in allowed:
        raise HTTPException(422, 'Choose a model configured for this provider')
    key = resolve_provider_api_key_or_400(body.providerId, None)
    client = ExternalProviderClient(provider['provider_type'],
                                   provider.get('base_url') or get_base_url(provider['provider_type']), key)
    try:
        return await extract(client, body.model, source)
    except (ValueError, TimeoutError) as error:
        raise HTTPException(422, 'Extraction failed validation or timed out; no memory was changed') from error

@router.get('/graph')
def graph(q: str | None = Query(default=None, max_length=300), projectId: str | None = None,
          current_subject: str = Depends(get_current_subject)):
    return memory.graph(current_subject, projectId, q)

@router.get('/nodes/{node_id}')
def node(node_id: str, current_subject: str = Depends(get_current_subject)):
    value = memory.get_node(current_subject, node_id)
    if not value: raise HTTPException(404, 'Memory not found')
    return value

@router.post('/nodes')
def create(body: MemoryInput, current_subject: str = Depends(get_current_subject)):
    return memory.save(current_subject, body.model_dump())

@router.patch('/nodes/{node_id}')
def update(node_id: str, body: MemoryInput, current_subject: str = Depends(get_current_subject)):
    node(node_id, current_subject)
    return memory.save(current_subject, body.model_dump(), node_id)

@router.delete('/nodes/{node_id}', status_code=204)
def remove(node_id: str, current_subject: str = Depends(get_current_subject)):
    if not memory.remove(current_subject, node_id): raise HTTPException(404, 'Memory not found')

@router.post('/edges')
def create_edge(body: MemoryEdgeInput, current_subject: str = Depends(get_current_subject)):
    try: return memory.connect(current_subject, body.source, body.target, body.relation)
    except ValueError as error: raise HTTPException(422, str(error)) from error

@router.delete('/edges/{edge_id}', status_code=204)
def remove_edge(edge_id: str, current_subject: str = Depends(get_current_subject)):
    if not memory.remove_edge(current_subject, edge_id): raise HTTPException(404, 'Memory relation not found')
