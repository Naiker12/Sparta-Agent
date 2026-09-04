# Changelog

## [0.2.19] - 2026-09-03

### Añadido y mejorado

- **Modularización Profunda de Inferencia**: Se desacopló el monolito `routes/inference.py` reduciéndolo en más de 9,180 líneas hacia 16 módulos especializados en `routes/inference_pkg/`.
- **Desacoplamiento de Base de Datos SQLite**: Se modularizó `storage/studio_db.py` en subpaquetes especializados en `storage/studio/` con fachada transparente y 100% de compatibilidad hacia atrás.
- **Rutas Modulares**: Routers de Modelos, Chat, Configuración y RAG completamente modularizados.
- **Sincronización Total del Ecosistema**: Actualización unificada de versiones y artefactos de descarga en la Landing Page, App Shell y Releases.

### Corregido

- Se solucionó la advertencia de React `Function components cannot be given refs` envolviendo `DialogOverlay`, `DialogContent`, `DialogTitle` y `DialogDescription` con `React.forwardRef()`.
- Se removieron las etiquetas de navegación obsoletas en el panel de Configuración.

## [0.2.17] - 2026-09-02

### Añadido y mejorado

- La carpeta de trabajo se vincula explícitamente a cada chat, con permisos de solo lectura, edición sin eliminación o edición completa.
- El selector de carpeta vive en una fila propia del compositor y usa un diálogo integrado con la interfaz de Sparta Agent.
- Las herramientas de archivos usan primero la carpeta del chat, evitando compartir accidentalmente una carpeta de Proyecto.
- Las Fuentes y la carpeta de trabajo pueden leer PDF, DOCX, XLSX, CSV, TSV, PPTX, ODT, RTF, EPUB, JSON, HTML, Markdown y texto.
- Excel conserva las hojas, encabezados, valores y fórmulas durante la extracción para búsqueda y análisis.

### Corregido

- `list_directory`, lectura y edición de archivos reconocen el vínculo de carpeta por chat.
- Los permisos de carpeta bloquean correctamente cambios, renombrados y eliminaciones según el acceso concedido.

## [0.2.16] - 2026-08-31

### Corregido

- Las fuentes locales se empaquetan correctamente, sin respuestas HTML inválidas en lugar de archivos de fuente.
- La barra lateral reenvía sus referencias de React correctamente, eliminando los avisos de `ref` en consola.
- Los chats temporales ya no hacen solicitudes a hilos que aún no existen en el servidor.

## [0.2.15] - 2026-08-31

### Corregido

- Los documentos creados por el asistente muestran solo el archivo final, con vista previa y descarga, sin razonamiento, scripts ni comandos de instalación.

## [0.2.14] - 2026-08-31

### Corregido

- Se sincronizaron la versión de la aplicación, la landing, la documentación y los enlaces de descarga para el release.

## [0.2.13] - 2026-08-31

### Añadido y mejorado

- El aviso de actualización de Electron puede minimizarse y restaurarse, mostrando el progreso mientras descarga.
- Las notas incluidas en el manifiesto aparecen inmediatamente y la consulta enriquecida reintenta fallos transitorios.

### Corregido

- Los releases de macOS generan y publican el ZIP requerido por `electron-updater` junto con `latest-mac.yml`.
- Las notas de versión se conservan al completar la descarga y durante la instalación.
- Linux evita iniciar una instalación automática cuando la aplicación no se ejecuta desde un AppImage válido.

## [0.2.11] - 2026-08-29

### Corregido

- La landing, la guía de instalación y los enlaces de descarga se sincronizaron con la versión actual.

## [0.2.10] - 2026-08-29

### Añadido y mejorado

- El contexto del chat incluye automáticamente fecha, hora, día de la semana y zona horaria locales para interpretar correctamente expresiones como «hoy» y «mañana».
- La instalación y actualización de escritorio se prepararon para operar en segundo plano y para limpiar los datos de Sparta Agent al desinstalar en Windows.

### Corregido

- La restauración del historial evita la clonación JSON recursiva que podía impedir un envío con el error «Maximum call stack size exceeded».

## [0.2.9] - 2026-08-28

### Añadido y mejorado

- **Documentación Técnica Enriquecida**: Suite de diagramas visuales interactivos (*SecurityIsolationDiagram*, *LangGraphFlowDiagram*, *DeepResearchDiagram*, *HybridRagDiagram*, *McpArchitectureDiagram*).
- **Navegación Táctil con Paginación Reactiva**: Tarjetas interactivas de `Anterior` y `Siguiente` en todas las 21 secciones de la documentación con enrutamiento reactivo sin recarga de página.
- **Nuevas Secciones Documentadas**: Recipe Studio & Data Recipes, Monitor de APIs y Costos en tiempo real, Acceso Remoto / LAN / Colab GPU Bridge y Entrada de Voz con Whisper.
- **Showcase de Conectores MCP**: Catálogo de servidores MCP integrado en el diseño Raycast (Filesystem, PostgreSQL, GitHub, Notion, Slack, Google Drive).
- **Micro-Interacciones & Efectos Hover**: Particle burst con destellos stardust y barrido de luz shimmer en todos los botones de acción.

## [0.2.8] - 2026-08-28

### Añadido y mejorado

- Actualizador nativo para Electron: la aplicación comprueba las versiones publicadas, ofrece la descarga, muestra el progreso y permite instalar al reiniciar de forma controlada.
- Las novedades de cada versión se presentan dentro de la aplicación antes de descargarla, con acceso a las notas completas del release.
- El modal público de lanzamiento y todos los enlaces de descarga se sincronizaron con la versión `0.2.8`.

### Corregido

- Las tablas Markdown ampliadas respetan la barra de título de escritorio; el control para cerrar la vista completa permanece visible y utilizable.
- El separador de la barra de título se alinea dinámicamente con el panel lateral, incluso al expandirlo, contraerlo o cambiar su ancho.
- Los ajustes de ejecución usan el idioma seleccionado para etiquetas, estados y ejemplos, sin cambiar la identidad interna de los preajustes.

## [0.2.7] - 2026-08-27

### Corregido

- Sincronizado el lockfile de npm para que las instalaciones limpias de CI y releases funcionen correctamente.

## [0.2.6] - 2026-08-27

### Añadido y Mejorado

- Los proyectos con carpeta conectada disponen de un workspace operativo para el agente y el explorador de escritorio.
- Se añadieron herramientas de listado, lectura, búsqueda y modificación de archivos limitadas a la carpeta del proyecto.

### Corregido

- El agente recibe las herramientas de workspace cuando una carpeta está conectada y puede analizar el contenido del proyecto.

## [0.2.1] - 2026-08-25

### Añadido y Mejorado

- Motor de terminal y ejecución de comandos 100% nativo multiplataforma (`pty-manager.ts`) sin dependencias C++ externas ni compilación nativa en runtime.
- Soporte robusto y transparente para PowerShell, CMD, Bash y Zsh en Windows, macOS y Linux.
- Sincronización completa de enlaces directos de descarga y modales de lanzamiento a la versión `0.2.0`.

### Corregido

- Eliminado el error crítico `ENOENT: no such file or directory, open '.../app.asar.unpacked/node_modules/node-pty/package.json'` en el arranque del proceso principal de Electron.
- Resuelto el problema de empaquetado de módulos nativos garantizando inicialización limpia y rápida en todos los sistemas operativos.

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
