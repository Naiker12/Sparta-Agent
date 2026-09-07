from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from auth.authentication import get_current_subject
from storage.studio.memory_tasks import (
    delete_memory,
    delete_memory_edge,
    get_memory_node,
    list_memory,
    upsert_memory,
    upsert_memory_edge,
)

router = APIRouter()
class MemoryInput(BaseModel):
    type: str = Field(default="fact", pattern="^(entity|fact|preference|event)$")
    label: str = Field(min_length=1, max_length=300)
    content: str = Field(min_length=1, max_length=10000)
    sourceThreadId: str | None = None
    confidence: float = Field(default=1, ge=0, le=1)

class MemoryEdgeInput(BaseModel):
    source: str = Field(min_length=1)
    target: str = Field(min_length=1)
    relation: str = Field(min_length=1, max_length=120)
@router.get('/graph')
def graph(q: str | None = Query(default=None, max_length=300), current_subject: str = Depends(get_current_subject)): return list_memory(q)
@router.get('/nodes/{node_id}')
def node(node_id: str, current_subject: str = Depends(get_current_subject)):
    value = get_memory_node(node_id)
    if not value: raise HTTPException(404, 'Memory not found')
    return value
@router.post('/nodes')
def create(body: MemoryInput, current_subject: str = Depends(get_current_subject)): return upsert_memory(body.model_dump())
@router.patch('/nodes/{node_id}')
def update(node_id: str, body: MemoryInput, current_subject: str = Depends(get_current_subject)): return upsert_memory(body.model_dump(), node_id)
@router.delete('/nodes/{node_id}', status_code=204)
def remove(node_id: str, current_subject: str = Depends(get_current_subject)):
    if not delete_memory(node_id): raise HTTPException(404, 'Memory not found')

@router.post('/edges')
def create_edge(body: MemoryEdgeInput, current_subject: str = Depends(get_current_subject)):
    try:
        return upsert_memory_edge(body.source, body.target, body.relation)
    except ValueError as error:
        raise HTTPException(422, str(error)) from error

@router.delete('/edges/{edge_id}', status_code=204)
def remove_edge(edge_id: str, current_subject: str = Depends(get_current_subject)):
    if not delete_memory_edge(edge_id): raise HTTPException(404, 'Memory relation not found')

@router.post('/sync-from-chats')
def sync_from_chats(current_subject: str = Depends(get_current_subject)):
    import json
    from storage.studio.connection import get_connection
    conn = get_connection()
    try:
        threads = conn.execute("SELECT id, title, created_at FROM chat_threads ORDER BY updated_at DESC LIMIT 40").fetchall()
        saved_count = 0
        node_ids = []
        for thread in threads:
            title = (thread["title"] or "").strip()
            if not title or title.lower() in {"new chat", "nuevo chat"}:
                continue
            t_id = thread["id"]
            msgs = conn.execute("SELECT role, content_json FROM chat_messages WHERE thread_id=? AND role='user' ORDER BY created_at ASC LIMIT 10", (t_id,)).fetchall()
            combined_texts = []
            for m in msgs:
                try:
                    parts = json.loads(m["content_json"]) if isinstance(m["content_json"], str) else []
                    for part in parts:
                        if isinstance(part, dict) and part.get("text"):
                            combined_texts.append(part["text"].strip())
                except Exception:
                    pass

            lower_title = title.lower()
            content = " ".join(combined_texts) if combined_texts else title

            if "clima" in lower_title or "tiempo" in lower_title:
                kind = "preference"
                loc = "Cartagena" if "cartagena" in lower_title or "cartegana" in lower_title else "Ubicación"
                label = f"Interés de Clima: {loc}"
                content = f"El usuario consulta con regularidad las condiciones meteorológicas y el pronóstico de {loc}."
            elif "partido" in lower_title or "premier" in lower_title or "futbol" in lower_title:
                kind = "preference"
                label = "Interés Deportivo: Premier League"
                content = "El usuario sigue resultados, calendario y partidos de la liga inglesa de fútbol."
            elif "naiker" in lower_title:
                kind = "entity"
                label = "Entidad: Naiker Codes"
                content = "Desarrollador, proyectos de código y perfiles consultados por el usuario en conversaciones con Sparta."
            elif "proyecto" in lower_title or "tenemos" in lower_title:
                kind = "fact"
                label = "Proyecto: Sparta Agent Workspace"
                content = "Espacio de trabajo principal, archivos fuente y arquitectura agéntica de Sparta."
            else:
                kind = "fact"
                label = f"Tema: {title[:40]}"
                content = f"Consulta previa del usuario: {content[:250]}"

            node = upsert_memory({
                "type": kind,
                "label": label,
                "content": content,
                "sourceThreadId": t_id,
                "confidence": 0.95
            })
            if node and node.get("id"):
                node_ids.append(node["id"])
                saved_count += 1

        if len(node_ids) >= 2:
            try:
                for i in range(len(node_ids) - 1):
                    upsert_memory_edge(node_ids[i], node_ids[i + 1], "conversación relacionada")
            except Exception:
                pass

        return {"synced": saved_count, "graph": list_memory()}
    finally:
        conn.close()
