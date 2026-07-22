import os
import logging
import tempfile

from fastapi import Request, UploadFile, File
from fastapi.responses import JSONResponse

from sparta_mcp.server_handlers import (
    handle_memory_index,
    handle_memory_search,
    handle_memory_embed,
    handle_memory_delete,
    handle_memory_count,
)

logger = logging.getLogger("sparta_ai.server_web")


def register_routes(app):
    @app.get("/api/skills/index")
    async def get_skills_index():
        from sparta_skills.skill_loader import skills_index
        return {"skills": skills_index()}

    @app.post("/api/memory/index")
    async def memory_index(request: Request):
        body = await request.json()
        return await handle_memory_index(body)

    @app.post("/api/memory/search")
    async def memory_search(request: Request):
        body = await request.json()
        return await handle_memory_search(body)

    @app.post("/api/memory/embed")
    async def memory_embed(request: Request):
        body = await request.json()
        return await handle_memory_embed(body)

    @app.post("/api/memory/delete")
    async def memory_delete(request: Request):
        body = await request.json()
        return await handle_memory_delete(body)

    @app.get("/api/memory/count")
    async def memory_count():
        return await handle_memory_count()

    @app.get("/health")
    async def health():
        return {"status": "ok", "mode": "web"}

    @app.post("/api/audio/transcribe")
    async def transcribe_audio(file: UploadFile = File(...)):
        try:
            from sparta_audio.transcriber import transcribe
        except ImportError:
            return JSONResponse(
                status_code=503,
                content={"error": "Transcripción no disponible. Instala el extra de audio: pip install -e '.[audio]'"},
            )
        suffix = os.path.splitext(file.filename or "audio.webm")[1] or ".webm"
        tmp_path = ""
        try:
            with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
                tmp.write(await file.read())
                tmp_path = tmp.name
            text = transcribe(tmp_path)
            return {"text": text}
        except Exception as e:
            logger.exception("Audio transcription failed")
            return JSONResponse(status_code=500, content={"error": str(e)})
        finally:
            if tmp_path and os.path.exists(tmp_path):
                os.unlink(tmp_path)
