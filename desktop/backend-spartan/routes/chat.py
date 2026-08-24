import asyncio
import json
import uuid
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

router = APIRouter(prefix="/api/chat", tags=["chat"])

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatPayload(BaseModel):
    messages: List[ChatMessage]
    model: Optional[str] = "default"
    stream: Optional[bool] = True
    session_id: Optional[str] = None
    temperature: Optional[float] = 0.7

@router.get("/threads")
async def list_threads():
    return {"threads": []}

@router.post("")
async def create_chat_completion(payload: ChatPayload):
    if not payload.stream:
        return {
            "id": f"chatcmpl-{uuid.uuid4().hex[:8]}",
            "model": payload.model,
            "choices": [{
                "message": {
                    "role": "assistant",
                    "content": "Respuesta generada por Sparta-Agent Backend."
                },
                "finish_reason": "stop"
            }]
        }

    async def stream_generator():
        yield "data: " + json.dumps({
            "choices": [{"delta": {"role": "assistant", "content": ""}}]
        }) + "\n\n"
        
        reply_chunks = [
            "Procesando ", "consulta ", "mediante ", "Sparta ", "Backend ", "Python..."
        ]
        for chunk in reply_chunks:
            await asyncio.sleep(0.05)
            yield "data: " + json.dumps({
                "choices": [{"delta": {"content": chunk}}]
            }) + "\n\n"
            
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        stream_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        }
    )
