# Paquete Modular de Rutas de Modelos (`routes.models_pkg`)

Este módulo descompone el anterior monolito `routes/models.py` (5,086 líneas) en componentes modulares, testeables y con responsabilidades desacopladas (SRP):

- **`schemas.py`**: Modelos Pydantic y estructuras de inventario local/remoto (`CachedModelRepo`, `CachedModelsResponse`, etc.).
- **`helpers_paths.py`**: Lógica de resolución de rutas, allowlists del explorador de carpetas, directorios de caché HuggingFace y poda de modelos eliminados.
- **`helpers_detection.py`**: Detección de arquitecturas GGUF, tareas diffusers/video/audio, cómputo de context length nativo y lectura de headers safetensors.
- **`router_local.py`**: Endpoints de escaneo local (`/local`), carpetas de escaneo (`/scan-folders`, `/recommended-folders`) y explorador seguro (`/browse-folders`).
- **`router_catalog.py`**: Catálogo de modelos (`/list`), configuración (`/config/{model_name}`) y verificación de capacidades (`/check-vision`, `/check-embedding`).
- **`router_security.py`**: Escaneo de código remoto (`/remote-code-scan`) y descarte de descargas en cuarentena (`/discard-remote-code`).
- **`router_loras.py`**: Adaptadores LoRA (`/loras`, `/loras/.../base-model`), diffusion LoRAs/ControlNets y borrado seguro de modelos ajustados (`/delete-finetuned`).
- **`router_gguf.py`**: Variantes GGUF (`/gguf-variants`), estimación de KV-cache (`/kv-cache-estimate`) y progreso de descargas (`/gguf-download-progress`, `/download-progress`).
- **`router_cached.py`**: Modelos en caché (`/cached-gguf`, `/cached-models`, `/delete-cached`), localización y checkpoints (`/checkpoints`, `/export-size`).
- **`__init__.py`**: Fachada que compone el `APIRouter` unificado con los 28 endpoints REST y re-exporta todos los símbolos para retrocompatibilidad total.
