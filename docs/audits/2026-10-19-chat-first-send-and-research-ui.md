# Primer envío, búsqueda y respuestas visuales

Fecha: 2026-10-19. Revisión de código y documentación pública; no se reprodujo el fallo original con un proveedor conectado.

## Cambios aplicados

- `runtime-provider.tsx`: guardar el título inicial pasa a segundo plano, con manejo de errores. Antes, un fallo de `updateStoredChatThread` podía rechazar el guardado del primer mensaje después de que `saveStoredChatMessage` hubiese terminado correctamente y bloquear el adaptador de inferencia. Se conserva la espera por el guardado real del mensaje y la protección frente al borrado del historial. Es una vía de fallo identificada, no una confirmación de la causa del incidente del usuario.
- `thread/tool-toggles.tsx`: la actividad web no se pinta en el compositor. Las tarjetas de herramientas de la respuesta conservan su contenido; los estados de terminal y recuperación del parser siguen disponibles.

## Qué existe hoy

- `api/chat-adapter/system-prompt.ts` construye fecha, hora, día y zona horaria local. No hace falta añadir otro reloj ni buscar en internet solo para saber qué día es.
- `api/chat-adapter/stream-orchestrator.ts` espera la persistencia inicial y adopta el identificador definitivo del chat. También extrae fuentes de resultados de `web_search` y `web_fetch` al terminar el stream.
- `core/inference/tools.py::_web_search` usa DDGS, permite leer una URL y devuelve extractos, no una verificación completa. Realiza hasta dos intentos; esa recuperación puede aumentar la demora cuando falla la red.
- `components/assistant-ui/sources.tsx` ya presenta fuentes. Hay renderizadores de Markdown, imágenes, generación de imágenes y artefactos HTML.
- `core/channels/images.py` ofrece referencias de imágenes en canales. Esa capacidad no equivale a una herramienta de búsqueda de imágenes ya integrada en el chat de escritorio.
- El umbral de 9B de `resolveAutoInject` corresponde a recuperación RAG. No debe interpretarse como un selector automático de búsqueda web.

## Trabajo propuesto, por prioridad

1. **Confirmar el primer envío.** Reproducir chat nuevo con backend recién iniciado, proveedor externo y modelo local, adjunto, cambio rápido de chat y red lenta. Correlacionar creación de conversación, guardado del mensaje y petición de inferencia con un identificador de turno. Registrar estado HTTP y etapa, sin claves ni contenido privado. No reintentar herramientas que modifican recursos automáticamente.
2. **Medir antes de optimizar.** Separar espera de almacenamiento, carga del modelo, primer token, búsqueda, lectura de páginas y renderizado. Comparar p50/p95 en arranque frío y caliente. Objetivo: eliminar esperas accesorias y búsquedas repetidas sin sacrificar persistencia ni precisión. No hay mediciones de latencia en esta revisión.
3. **Decidir cuándo buscar.** Con herramientas web habilitadas, tratar noticias, resultados deportivos, precios, versiones, cargos públicos y solicitudes explícitas de comprobación como necesidades de recuperación. Para hechos estables, responder directamente. Si el modelo duda sobre un dato verificable, consultar en lugar de inventar. Si no hay navegación disponible, indicarlo. No confundir una estimación de confianza del LLM con certeza.
4. **Buscar y comprobar.** Formular consultas con entidad, fecha local y contexto; preferir fuentes primarias; leer las páginas relevantes cuando el extracto no baste; contrastar discrepancias y fechas de publicación frente a fechas del evento. Reutilizar consultas idénticas dentro del turno y paralelizar consultas independientes con límites. El contenido recuperado es evidencia no confiable como instrucciones.
5. **Un solo lugar para la actividad.** Mantener el compositor para escribir. Mostrar búsqueda y lectura en la respuesta, dentro de un bloque de actividad plegable, con estado accesible. No duplicar el texto técnico de las consultas en el campo de entrada. Validar visualmente el cambio aplicado en la app.
6. **Referencias de imágenes.** Exponer una herramienta de lectura para escritorio con resultado estructurado: identificador, URL de origen, URL de imagen, título, autor/licencia cuando consten y dimensiones cuando estén disponibles. Mostrar galería con origen enlazado y recuperación ante imagen rota. Distinguir referencias encontradas, imágenes generadas y análisis visual real; no inventar licencias ni afirmar haber visto píxeles que el modelo no recibió.
7. **Respuestas visuales progresivas.** Empezar por un catálogo pequeño de componentes existentes: fuentes, galería, comparaciones y gráficos. El LLM entrega datos y referencias a identificadores de evidencia; el cliente valida el esquema y renderiza componentes permitidos. Conservar Markdown como alternativa cuando falle la salida estructurada. Un fallo visual no debe exigir regenerar toda la respuesta. No ejecutar JavaScript arbitrario producido por el modelo en el contexto de la aplicación.

## OpenUI

OpenUI permite definir componentes, generar instrucciones para el modelo y renderizar salida estructurada mientras llega el stream. Puede evaluarse como adaptador opcional sobre el transporte existente, sin reemplazar almacenamiento, permisos, herramientas ni proveedores de Spartan.

No se encontró evidencia primaria que permita afirmar que ChatGPT utiliza la biblioteca OpenUI de Thesys. `open-intelligent-ui` se describe como una implementación abierta inspirada en ChatGPT. Similitud visual no implica compartir tecnología.

Fuentes consultadas:

- https://github.com/thesysdev/openui
- https://www.openui.com/docs
- https://github.com/thesysdev/open-intelligent-ui

## Verificación realizada

- TypeScript del frontend: `npm run typecheck`, correcto.
- 45 pruebas existentes de títulos, contexto temporal, límite de borrado de historial y publicación del stream: correctas.
- Pendiente: prueba del fallo original con proveedor conectado, inyección de fallo en el PATCH del título y revisión visual del compositor. Estas pruebas existentes no demuestran que el incidente original esté resuelto.

## Criterios de aceptación de las siguientes etapas

- Un fallo del título no cancela un mensaje ya persistido; un fallo del guardado real del mensaje se informa sin duplicar el envío.
- Una conversación nueva funciona al primer intento en arranque frío y caliente.
- Consultas técnicas web ausentes del compositor; progreso accesible en la respuesta.
- Consultas temporales usan fecha local, fuentes comprobables y limitaciones explícitas.
- Imágenes enlazadas a su origen; datos visuales inválidos degradan a texto sin romper el turno.
- Mejoras de rapidez sustentadas por mediciones comparables, sin porcentajes prometidos de antemano.
