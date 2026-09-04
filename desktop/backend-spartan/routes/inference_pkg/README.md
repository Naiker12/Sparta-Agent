# Sub-paquete de Rutas de Inferencia (`routes.inference_pkg`)

Este paquete descompone modularmente el archivo monolítico `routes/inference.py` aplicando los principios de Clean Architecture y Single Responsibility (SRP), manteniendo el 100% de paridad y compatibilidad con los routers `router` y `studio_router`.

## Estructura de Sub-routers

1. **`router_images_studio.py`** (19 endpoints):
   - Generación de imágenes por difusión local (`POST /images/generate`).
   - Plan de descarga de modelos de difusión (`POST /images/download-plan`).
   - Carga y descarga de pipeline (`POST /images/load`, `POST /images/unload`).
   - Estado y progreso (`GET /images/status`, `GET /images/info`, `GET /images/load-progress`, `GET /images/generate-progress`).
   - Cancelación de inferencia visual (`POST /images/generate/cancel`).
   - CRUD de galería de imágenes (`GET /images/gallery`, `GET /images/gallery/{id}/file`, `GET /images/gallery/{id}/file-signed`, `PATCH /images/gallery/{id}`, `DELETE /images/gallery/{id}`, `DELETE /images/gallery`).
   - CRUD de galería de audio (`GET /audio/gallery`, `GET /audio/gallery/{id}/file`, `DELETE /audio/gallery/{id}`, `DELETE /audio/gallery`).

2. **`router_stt_studio.py`** (8 endpoints):
   - Estado del sidecar de voz a texto (`GET /audio/stt/status`).
   - Descarga de modelos STT (`POST /audio/stt/download`, `POST /audio/stt/download/cancel`).
   - Carga, validación y descarga de STT (`POST /audio/stt/load`, `POST /audio/stt/validate`, `POST /audio/stt/unload`).
   - Transcripción de audio (`POST /audio/transcribe`, `POST /audio/transcribe/raw`).

3. **`router_sandbox.py`** (3 endpoints):
   - Listado de archivos en sandbox (`GET /sandbox/{session_id}`).
   - Apertura en explorador del sistema (`POST /sandbox/{session_id}/reveal`).
   - Servicio de archivos con protección de contención (`GET /sandbox/{session_id}/{filename:path}`).

4. **`router_containers.py`** (3 endpoints):
   - Listado de contenedores remotos OpenAI (`POST /external/openai/containers/list`).
   - Creación de contenedor con TTL (`POST /external/openai/containers/create`).
   - Eliminación de contenedor (`POST /external/openai/containers/delete`).

## Agregación en Fachada (`routes/inference.py`)

La fachada mantiene compatibilidad con todas las rutas y herramientas externas mediante:
```python
for r in _sub_router.routes:
    router.routes.append(r) # o studio_router.routes.append(r)
```
Preservando los 62 endpoints (26 en `router` y 36 en `studio_router`) activos sin alterar URLs, schemas ni decoradores.
