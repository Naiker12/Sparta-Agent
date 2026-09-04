# Paquete Modular de Rutas de Configuración (`routes.settings_pkg`)

Este paquete descompone el anterior monolito `routes/settings.py` (2,550 líneas) en submódulos especializados:

- **`schemas.py`**: Modelos Pydantic (53 clases) de configuración, hardware, presets y temas.
- **`router_presets.py`**: Presets de generación multimodal (imagen y video).
- **`router_hardware.py`**: Ajustes de hardware, tokens HF, rutas llama.cpp, límites de subida, VRAM y memoria de modelos.
- **`router_providers_switch.py`**: Coding agents, conmutación automática de OpenAI, overrides y modelo de embeddings RAG.
- **`router_network.py`**: Enlaces de previsualización, acceso remoto, LAN y compartición.
- **`router_personalization.py`**: Personalización visual de UI, tipografías, avatares, temas y barra lateral.
- **`router_debug.py`**: Registro de depuración y fuentes de logs.
- **`__init__.py`**: Router unificado que compone las 48 rutas REST y re-exporta los símbolos con 100% de retrocompatibilidad.
