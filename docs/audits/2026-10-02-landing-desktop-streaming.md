# Streaming de la demo y del escritorio

La landing importa directamente `stabilizeStreamingMarkdown`, `IncrementalMarkdownCache`, `withoutStreamdownAnimationPlugin` y `safeMarkdownUrl` desde el frontend de escritorio. Un adaptador de presentación utiliza Streamdown con la misma actualización inmediata y caché de bloques, sin cargar stores, IPC ni utilidades nativas de Electron.

El origen del texto continúa siendo una respuesta de ejemplo local, entregada en fragmentos variables. No es una petición real al backend ni una conexión a un proveedor. El final depende de haber entregado la respuesta completa; ya no depende del temporizador fijo del escenario. Se conservan pausa por visibilidad, movimiento reducido, controles de envío y regeneración.

## Fidelidad de Thinking y acciones

Se compararon `assistant-ui/reasoning.tsx` y `thread/assistant-action-bar.tsx`. La demo elimina la fila anterior con check y número de archivos. Importa el `BulbIcon` real y las funciones `resolveReasoningOpen` y `resolveReasoningToggle`: apertura automática mientras llega razonamiento, cierre al terminar y reapertura manual. Presenta los puntos animados, duración medida y copia del razonamiento. Se separó su clase CSS de un antiguo control del composer que se ocultaba en pantallas pequeñas.

La barra utiliza el Button de escritorio, iconos Hugeicons y Lucide correspondientes al original, tamaño de 32 px y estilo ghost sin contorno. Incluye copiar, editar, regenerar, eliminar, bifurcar, exportar Markdown y detalles. Son adaptadores de navegador; no importan la barra o el componente de razonamiento completos, que dependen del runtime assistant-ui, stores y utilidades nativas. TTS, persistencia de conversaciones y cambios reales de archivos no están incorporados a la demo.

Se verificaron en navegador apertura del razonamiento, edición y guardado de respuesta, diálogo de detalles y regeneración. La fila antigua tiene cero elementos y los cuatro botones principales miden 32 px con borde de 0 px.

Verificación: compilación TypeScript y Vite con `npm run build:gh`; envío en navegador; estado `running` con 20 caracteres seguido de `complete` con 306 caracteres visibles; listas, énfasis y código inline renderizados. Consola sin errores durante esta verificación. El adaptador no incorpora todos los plugins opcionales del escritorio para audio, artefactos HTML, matemáticas o Mermaid.
