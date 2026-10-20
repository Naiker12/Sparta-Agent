# OpenUI: primera integración funcional

Fecha: 2026-10-19. Implementación del renderizador y del piloto de respuestas visuales. No equivale a soporte de aplicaciones arbitrarias generadas por el modelo.

Actualización posterior autorizada: se añadieron paneles compuestos y formularios mediante `present_ui`, además de la corrección de caché de Vite. Ver `2026-10-19-openui-panels-and-vite-cache.md`. Los límites siguientes describen el piloto inicial.

## Qué se entregó

- `@openuidev/react-lang@0.4.1` y Zod como dependencias explícitas, con lockfile. La versión 1.0.1 fue rechazada por el filtro de antigüedad del instalador. No se forzaron peers. Se conserva Zustand 5 y no se instala el conector incompatible `@openuidev/assistant-ui@0.2.0`.
- Preferencia persistida **Ajustes → Chat → Respuestas visuales**, inicialmente apagada. También se encuentra mediante la búsqueda de ajustes. Desactivarla vuelve a la presentación Markdown sin modificar historial.
- Tablas Markdown compatibles presentadas mediante una biblioteca propia de OpenUI y los componentes Table/Button de Spartan. Permiten ordenar columnas y alternar a texto.
- Gráficos de barras opcionales para tablas de dos columnas con números finitos e inequívocos. Los encabezados conservan etiquetas y unidades. No se interpretan automáticamente separadores de miles, monedas, porcentajes ni celdas ausentes. Hay alternativa tabular.
- Búsqueda de imágenes de referencia en la herramienta existente `web_search`, con `search_type: "images"`. El backend obtiene metadatos mediante DDGS, conserva URL de origen y de imagen, aplica límites de sitios a ambas, deduplica y respeta cancelación. Devuelve hasta dos referencias mediante el adaptador existente de imágenes de canales.
- Galería con origen enlazado, carga diferida y estado de error. Las imágenes remotas solo se solicitan después de pulsar **Cargar imágenes**; al abrir el historial no se descargan automáticamente.
- Actividad de búsqueda agrupada y plegable dentro del mensaje, fuentes sin duplicados de fragmentos de la misma página. Las confirmaciones, la salida en vivo y los errores explícitos fuerzan la apertura del grupo.
- Instrucciones compactas al agente: búsqueda para datos actuales o comprobación solicitada, fuentes primarias, lectura cuando los extractos no bastan, contraste de fechas, reutilización de evidencia y distinción de inferencias. El formato recomendado sigue siendo Markdown estándar.

## Decisión sobre generación e historial

Se eligió derivar las vistas del contenido canónico existente en lugar de añadir un segundo protocolo de salida del modelo. OpenUI recibe documentos construidos localmente con payloads JSON entrecomillados y solo dos componentes permitidos. El modelo no puede introducir consultas, comandos o acciones a través de ese documento.

Esto completa la ruta de presentación del piloto sin migrar el esquema de mensajes: una respuesta guardada sigue siendo texto y los resultados de sus herramientas siguen siendo evidencia. Copia, búsqueda, exportación y contexto del modelo conservan su formato. Los chats antiguos pueden aprovechar las vistas compatibles, pero también siguen funcionando sin OpenUI. La prueba de navegador verifica que exportar y restaurar el repositorio preserva el mensaje canónico al alternar presentaciones.

Las tablas con enlaces, imágenes, HTML o texto tachado en sus celdas conservan el renderizador Markdown para no perder semántica. Límites: bloque de 40.000 caracteres, 100 filas, 12 columnas, 2.000 caracteres por celda y gráficos de hasta 30 puntos. La galería admite hasta seis elementos en el cliente aunque el adaptador actual devuelve hasta dos.

No se añadió una llamada al LLM para componer interfaces, reparar documentos o reformatear respuestas. Tampoco se alteró la selección de proveedor ni el sistema de permisos. La búsqueda de imágenes nueva está disponible cuando Spartan ejecuta la herramienta local de búsqueda; no se afirma que los buscadores alojados por terceros admitan ese parámetro.

## Aislamiento y rendimiento

- Carga diferida del renderizador, del parser GFM y de Zod. No se descargan para respuestas de prosa o cuando la opción está apagada.
- Una suscripción a la preferencia por parte de texto, propagada por contexto; no una suscripción al store por cada bloque Markdown.
- Los bloques completos siguen memoizados y conservan las reglas existentes de publicación del stream.
- Suspense conserva la vista Markdown mientras carga el módulo. Un error de importación, parsing o renderizado degrada a esa misma vista sin convertir la generación en fallo ni exigir regenerarla.
- No se conectan Query/Mutation, herramientas o acciones al Renderer. No se incorporan Gateway, Autofix alojado ni observabilidad externa.
- Se inhibe el inspector CDN que react-lang 0.4.1 monta por defecto en desarrollo, mediante su guardia de bootstrap. Es un detalle interno de la versión fijada y debe revisarse al actualizar. La prueba de navegador comprueba ausencia de solicitudes externas antes de cargar imágenes.
- La instalación se realizó con `--ignore-scripts`. CI configura `OPENUI_TELEMETRY_DISABLED=1`; para instalaciones locales futuras se recomienda la misma variable, según la documentación del paquete. No se habilitó telemetría de ejecución.

El build deja el renderizador en un chunk separado de aproximadamente 169 kB sin comprimir / 52 kB gzip en esta ejecución. El módulo principal pasó de aproximadamente 940,85 a 943,29 kB gzip respecto al build anterior de assistant-ui actualizado. Son tamaños de compilación, no mediciones de rapidez del modelo. No se promete una reducción porcentual de latencia.

## Validación

- Suite completa frontend: **3.641 pruebas correctas**.
- Pruebas específicas posteriores de presentación y memoización de Markdown: **10 correctas**.
- TypeScript desde la raíz: correcto, incluye frontend y proyecto completo.
- Compilación del frontend: correcta; persisten advertencias de tamaño de chunks e importaciones dinámicas de canales.
- i18n: comprobación de paridad ejecutada junto con la suite frontend.
- Pruebas específicas del backend de imágenes, despacho de la herramienta y políticas web: **34 correctas**, sin red real.
- Comprobación ampliada del backend: **1.729 correctas y 3 fallidas**. Los tres fallos de `test_secure_tools_execute.py` se producen al preparar un backend llama.cpp simulado: intentan sustituir `_stream_with_retry`, método ausente en la implementación deshabilitada actual de `core/inference/llama_cpp.py`. Esa clase no se modificó en esta tarea; no se presentan esos tests como aprobados.
- Prueba real en Edge con runtime y modelo simulados: activación optativa, tabla/gráfico/texto, ordenación, exportación/restauración canónica, galería, ausencia de conexiones externas previas a la carga, error de imagen, modo oscuro y ancho de 390 px, sin errores de página en el flujo normal.
- Se conserva la prueba de navegador de la actualización de assistant-ui: primer envío, StrictMode, respuesta parcial ante error, cancelación y siguiente envío.
- Prueba adicional de fallo del módulo visual: se bloquea deliberadamente la descarga del chunk y el mensaje conserva su tabla Markdown y estado completo. El error de importación esperado queda registrado por React en desarrollo, pero no exige regenerar el mensaje.

Comandos: `npm run test:openui:browser` y `npm run test:assistant-ui:browser` desde la raíz. No hacen llamadas a modelos reales ni modifican chats del usuario.

## Límites y siguientes ampliaciones

Esta entrega cubre el piloto de lectura y presentación. Formularios con efectos, mapas, paneles arbitrarios escritos por el modelo y el toolkit completo de OpenUI siguen requiriendo diseño y validación propios. Tampoco se ha realizado una prueba con credenciales de un proveedor real ni una nueva distribución empaquetada de Electron.

Las instrucciones de búsqueda mejoran la política disponible al agente; no garantizan por sí solas que todos los modelos consulten fuentes correctamente. La optimización posterior del harness debe medir persistencia, carga del modelo, primer token, búsqueda y lectura por separado antes de cambiar presupuestos, concurrencia o reintentos.

Referencias oficiales consultadas:

- https://www.openui.com/docs/openui-lang/defining-components
- https://www.openui.com/docs/openui-lang/renderer
- https://www.openui.com/docs/openui-lang/telemetry
- https://www.openui.com/integrations/assistant-ui
