# Changelog

## [0.1.9] - 2026-08-25

### Añadido y Mejorado

- Landing de producto renovada con demostraciones reales de planificación, edición de código y conexiones MCP.
- Capturas de contexto y permisos integradas en las capacidades del producto.
- Panel de ajustes de ejecución incluido en el frontend distribuido, con preajustes, instrucción del sistema y parámetros de muestreo.
- Navegación lateral ampliada con Canales como próxima funcionalidad.

### Corregido

- El contenido de Conexiones vuelve a desplazarse correctamente en los ajustes.
- Recursos visuales con respaldo para evitar avatares e iconos de proveedor rotos.
- Traducciones y consistencia del tema claro en las vistas de Audio, Exportar y la barra de título.

### Cambiado

- Metadatos, instaladores, enlaces de descarga y anuncios públicos actualizados a la versión `0.1.9`.

## [0.1.8] - 2026-08-16

### Añadido y Mejorado

- Landing Page moderna y cinematográfica para Sparta Agent con fondos de video en alta definición, temas oscuros puros y micro-animaciones fluidas.
- Integración directa del portal de documentación oficial (`DocsPage`) desde la barra de navegación y pie de página.
- Sistema de búsqueda web multi-motor enriquecido con DuckDuckGo Instant Answer JSON API y fallback inteligente de palabras clave para evitar bloqueos por CAPTCHA.
- Manejo adaptativo y cortafuegos de herramientas en modo chat para modelos sin soporte de Function Calling nativo, evitando errores 400 y 503 Provider Error.
- Interceptación en streaming de etiquetas textuales `<tool_call>` emitidas por modelos de razonamiento como DeepSeek R1.
- Ocultación dinámica de la barra de workflows en Chat Compose una vez iniciada la conversación.

### Cambiado

- Metadatos públicos, enlaces de release e interfaz de usuario actualizados a la versión `0.1.8`.

## [0.1.7] - 2026-08-15

### Añadido y Mejorado

- Selector de modelos flotante ultra-estilizado ("más flaco") con logotipos vectoriales de marca nativos para OpenAI, Anthropic, DeepSeek, Grok, Meta y OpenRouter.
- Control segmentado `[💬 Chat] [💻 Terminal]` profesional en la barra de título superior.
- Notificaciones Toast en píldoras flotantes cristalinas con bordes continuos e insignias circulares.
- Consola de terminal con formato EOL estricto, tipografía nítida y padding lateral interno.
- Grafo interactivo de memoria con colores temáticos por contenido, rejilla cósmica y etiquetas flotantes limpias.
- Tarjetas de herramientas vistas (`CONTENIDO LEÍDO`) integradas armónicamente con el esquema de color general.

### Cambiado

- Metadatos públicos, enlaces de instaladores y referencias de interfaz actualizados a `0.1.7`.

## [0.1.6] - 2026-08-11

### Añadido

- Enlace directo a la documentación publicada desde el menú Ayuda de la aplicación.
- Navegación de documentación compatible con la URL pública `?docs` y sus secciones.

### Cambiado

- Metadatos públicos, enlaces de instaladores y referencias de interfaz actualizados a `0.1.6`.
- Landing y documentación refinadas para tema claro/oscuro, movimiento reducido y pantallas móviles.

### Verificación

- Los instaladores se publican mediante el workflow de release al crear la etiqueta `v0.1.6`.
