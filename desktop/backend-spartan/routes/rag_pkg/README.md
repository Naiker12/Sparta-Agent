# Paquete Modular de Rutas RAG (`routes.rag_pkg`)

Este módulo descompone el anterior monolito `routes/rag.py` (1,077 líneas) en submódulos especializados:

- **`schemas.py`**: Modelos Pydantic de solicitud y actualización (`CreateKbRequest`, `SearchRequest`, etc.).
- **`helpers.py`**: Persistencia de archivos adjuntos, tokens firmados de previsualización, validación de propietarios y helpers de servicio RAG.
- **`router_knowledge_bases.py`**: Gestión CRUD de bases de conocimiento y subida de documentos a KB (7 endpoints).
- **`router_context_documents.py`**: Subida y listado de documentos asociados a hilos y proyectos (5 endpoints).
- **`router_linked_folders.py`**: Carpetas locales enlazadas, sincronización y reconstrucción de índices (5 endpoints).
- **`router_documents.py`**: Listado y borrado de documentos globales, URLs firmadas y objetivos de preview (5 endpoints).
- **`router_jobs.py`**: Consulta de estado y streaming SSE de eventos para tareas de indexación (4 endpoints).
- **`router_search.py`**: Búsqueda semántica híbrida vectorial (1 endpoint).
- **`__init__.py`**: Router unificado con los 27 endpoints y re-exportación transparente.
