# Spartan: plan de rendimiento y experiencia visual

Fecha: 2026-10-08. Investigación del código, build existente, registro oficial de npm y documentación de los autores. Este documento propone cambios; no acredita mejoras de CPU, RAM ni velocidad ya realizadas.

## Qué podemos conseguir

Reducir trabajo innecesario, cargar herramientas cuando se necesitan, liberar recursos al cerrar documentos y mantener el chat fluido. Una aplicación Electron necesita memoria y espacio; un modelo local y LibreOffice añaden recursos propios. El objetivo será una instalación base ligera y componentes opcionales claros, con cifras separadas para cada uno. La velocidad del proveedor de IA se medirá aparte de la respuesta visual de Spartan.

## Hallazgos comprobados

Inventario reproducible: `node scripts/audit-spartan-performance.mjs --check-updates`. Resultado en `output/performance/baseline.json`, medido el 8 de octubre a las 23:01 UTC. Analiza el build existente, no ejecuta un benchmark de producción.

| Hallazgo | Evidencia | Consecuencia |
|---|---|---|
| Frontend compilado: 51,87 MiB, 662 archivos | Inventario de `dist` | No equivale al tamaño del instalador ni a RAM consumida |
| JavaScript inicial: 7,26 MiB; gzip aproximado 2,10 MiB | Cadena de imports estáticos desde el HTML | Hay código inicial que conviene separar; gzip no mide memoria |
| Bloque `vendor-charts`: 3,40 MiB y forma parte de la carga inicial | `vite.config.ts` agrupa Mermaid, D3 y thinking-orbs | Revisar consumidores e imports antes de cambiar los chunks |
| SVG de favicon entre 1,27 y 1,77 MiB, con variantes repetidas | Archivos generados en `dist` | Simplificar vectores y comprobar duplicación del empaquetado |
| React 18 en raíz y React 19 en frontend; Vite 7 y 8 respectivamente | Resolución de paquetes instalados | Unificar la ruta real de build y verificar si hay duplicación efectiva; no está demostrada en el bundle |
| Varias consultas de automatizaciones cada 1–2 segundos | Controles, notificaciones y detalle de ejecuciones | Coordinar suscripciones y evitar peticiones duplicadas |
| `thinking-orbs` 0.1.1 instalado | Dependencias | No encontré que el indicador visible del chat utilice este componente; actualizarlo solo no cambia ese indicador |
| Lectura de documentos de automatizaciones importa `core.rag.parsers`; el builder excluye `core/rag/**` | `automation_workspace.py` y `electron-builder.config.cjs` | Riesgo de funcionamiento en instalación empaquetada que debe verificarse antes de optimizar |

Ya existen mejoras que debemos preservar: vistas PDF/Word diferidas, worker de hojas de cálculo con cancelación, PDF por página, actualizaciones del streaming agrupadas con requestAnimationFrame y mascota con modo estático/movimiento reducido. No corresponde reconstruirlas sin medir sus límites actuales.

## Fase 0: base fiable y mediciones

1. Probar un paquete instalado limpio: automatización leyendo TXT, PDF, DOCX y XLSX. Separar lectores ligeros de módulos de entrenamiento y declarar únicamente las dependencias necesarias. No incluir todo RAG para resolver un import.
2. Medir aplicación de producción, sin Vite, DevTools abiertos ni instrumentación de React permanente. Registrar versión, hardware, build, tamaño de documentos y componentes instalados.
3. Recoger CPU y memoria de procesos principal, renderer, GPU, backend Python y procesos de conversión/modelo. Usar un recolector central para `app.getAppMetrics()`: el intervalo de CPU depende de las llamadas anteriores. Explicar normalización por núcleos; no confundir memoria privada con suma de working sets, que puede contar páginas compartidas.
4. Ejecutar cinco arranques en frío y caliente; diez minutos en reposo visible y minimizado; chat largo; streaming; abrir/cerrar documentos repetidamente; automatización activa; voz/modelo local como escenarios separados.
5. Registrar mediana y p95 de arranque, interacción, apertura de documentos, primer feedback y primer token. Guardar perfiles de CPU y heap para las operaciones lentas. Usar React Profiler sólo durante diagnóstico.

Criterio: poder repetir una comparación antes/después con el mismo escenario y detectar si el coste simplemente se trasladó a otro proceso. La documentación de [Electron sobre rendimiento](https://www.electronjs.org/docs/latest/tutorial/performance) recomienda perfilar y diferir cargas; las [métricas de Electron](https://www.electronjs.org/docs/latest/api/app) y [React Profiler](https://react.dev/reference/react/Profiler) sirven para esta base.

## Fase 1: arranque y tamaño

- Separar Mermaid/D3 de indicadores pequeños; cargar diagramas, editor, terminal y lectores desde su función. Corregir imports estáticos que anulan cargas diferidas y ciclos entre chunks. Evitar agrupar bibliotecas sin relación por comodidad.
- Elegir un punto de build reproducible, alinear React/ReactDOM y comprobar una sola resolución de React en el renderer. Revisar lockfiles y aliases antes de migrar versiones mayores.
- Auditar logos, favicon, fuentes, mapas y recursos repetidos entre `public`, `dist` y recursos del builder. Sustituir gráficos sobredimensionados preservando marca y calidad. Retirar archivos únicamente con referencias, uso dinámico y empaquetado comprobados.
- Medir por separado instalador, instalación base, Python, LibreOffice y modelos descargados. Mantener instalación/actualización de componentes con progreso y versión claros; evitar reinstalaciones o comprobaciones de red en cada render.

Objetivo inicial provisional: reducir al menos 30% el JavaScript inicial respecto a 7,26 MiB, sin empeorar el primer uso de herramientas. No publicar esa reducción hasta medir el build nuevo. El ahorro del instalador se fijará después de medirlo.

## Fase 2: CPU en reposo y automatizaciones

- Crear una suscripción central de eventos de ejecución, notificaciones y cambios de chat; evaluar SSE con reconexión y cursor. Compartir caché y actualizar sólo entidades modificadas.
- Conservar un fallback de polling con intervalos adaptativos y backoff. Consultar rápido sólo durante una ejecución visible; disminuir consultas sin actividad. Evitar descargar todo el historial para descubrir un cambio.
- Pausar animaciones decorativas y consultas visuales innecesarias con ventana oculta. El scheduler, Telegram y las automatizaciones deben continuar en backend cuando corresponda.
- Revisar heartbeat y consultas SQL mediante perfiles; mantener cancelación, exclusión de ejecuciones duplicadas y recuperación de notificaciones. No aumentar intervalos arbitrariamente si rompe garantías.

Criterio: ninguna petición duplicada por varios consumidores del mismo estado; recuperación sin perder eventos tras reconectar; cancelación y notificaciones conservadas. Comparar CPU de reposo y número de peticiones con la base. La [API de visibilidad](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) permite adaptar el trabajo de la interfaz.

## Fase 3: chat rápido y memoria acotada

- Perfilar renderizados por token. Mantener bloques Markdown terminados estables y procesar la cola nueva de forma incremental cuando resulte seguro; evitar escanear y copiar todo el mensaje repetidamente. Comparar con el batching actual antes de sustituirlo.
- Usar suscripciones pequeñas y referencias estables. Aplicar memoización donde el perfil muestre beneficio; conservar pruebas contra el error de actualizaciones infinitas al adjuntar archivos.
- Evaluar virtualización para conversaciones largas y tablas grandes con las bibliotecas ya disponibles. Primero comprobar el comportamiento de assistant-ui. Preservar alturas variables, scroll al final, selección, búsqueda, accesibilidad y copia.
- Acotar cachés de previews por bytes, no sólo cantidad. Liberar object URLs, listeners, canvas y buffers al cerrar; terminar workers y cancelar tareas pendientes. No retener una pestaña retirada del composer.
- Mantener renderizado PDF por página; medir zoom/DPR y memoria de canvas. No renderizar todo el documento para aparentar una vista completa.

Criterio: abrir y cerrar 20 documentos no produce crecimiento sostenido de memoria retenida; chat largo mantiene escritura y scroll responsivos. Meta provisional: p95 de feedback de controles menor de 100 ms; revisar tareas que bloqueen más de 50 ms. Estas son metas, no resultados actuales. Referencias: [TanStack Virtual](https://tanstack.com/virtual/latest/docs/introduction) y [PDF.js FAQ](https://github.com/mozilla/pdf.js/wiki/frequently-asked-questions).

## Fase 4: backend y componentes locales

- Verificar qué importa realmente el arranque API-only. Actualmente se invoca calentamiento de ML; medir si carga Torch/Transformers en cada entorno y diferir lo que no se necesita hasta pedir un modelo o transcripción.
- Mantener conversiones de Office fuera del hilo de interfaz, con concurrencia limitada, cancelación, timeout y limpieza de temporales. Reutilizar conversiones válidas mediante identidad del archivo, versión del conversor y opciones.
- Indexar consultas de ejecuciones e historiales según el perfil; paginar y enviar cambios desde un cursor. Evitar copias repetidas de salidas grandes.
- Definir política de descarga de modelos, memoria y cierre de componentes con mensajes claros. No descargar modelos activos ni desactivar aceleración por defecto: puede empeorar la experiencia.

Criterio: chat sin modelo local no paga cargas de ML innecesarias; cerrar un documento libera su tarea; límites de concurrencia evitan saturación sin bloquear las automatizaciones.

## Fase 5: indicador de actividad y diseño profesional

Contrato visual basado en eventos reales:

| Situación | Texto/acción | Representación |
|---|---|---|
| Solicitud enviada | Conectando | Indicador discreto |
| Proveedor trabajando sin detalle | Preparando respuesta | Un único indicador activo |
| Herramienta de búsqueda | Buscando | Icono de búsqueda y nombre de acción |
| Lectura/conversión | Leyendo documento / Convirtiendo | Icono del formato y progreso sólo si se conoce |
| Escritura autorizada | Guardando archivo | Ruta/nombre y resultado real |
| Streaming | Respondiendo | Contenido progresivo y opción Detener |
| Error/cancelación/final | Estado concreto | Sin animación persistente; reintento cuando proceda |

No mostrar pensamientos inventados ni progreso porcentual sin medición. Mostrar resumen de razonamiento únicamente si el proveedor lo entrega para exposición al usuario.

La librería instalada es [Thinking Orbs de Libraries.dev](https://github.com/Jakubantalik/Libraries.dev). El registro consultado ofrece 0.3.2 frente a 0.1.1 instalado. Su implementación actual usa canvas 2D, estados como searching/composing, pausa por visibilidad y movimiento reducido. La versión antigua ya incorpora parte de esas protecciones: la actualización no implica por sí sola ahorro. Cada instancia tiene su propio loop; evitar múltiples orbes activos. Validar la API del paquete publicado antes de migrar.

Propuesta: comparar un indicador CSS/SVG sencillo con un solo orbe de 20 px, midiendo CPU, fluidez y comprensión. Mantener iconos de acciones en Lucide/Hugeicons; un orbe no sustituye un catálogo de iconos. No incorporar efectos de cursor, WebGL o nuevas bibliotecas decorativas como requisito del chat.

Para transiciones, evaluar `LazyMotion` donde Motion sea necesario; preferir transform/opacity y respetar movimiento reducido. La documentación describe cargas menores con [LazyMotion](https://motion.dev/docs/react-lazy-motion), pero sus cifras no son mediciones de Spartan. Revisar [rendimiento de Motion](https://motion.dev/docs/performance).

Unificar grosor y tamaño de iconos, bordes superiores del panel, cabecera compacta, estados de carga/error/vacío y colores del tema. Mantener documento blanco cuando el formato lo requiera y entorno oscuro coherente. Botones con foco visible, tooltip, nombre accesible y atajos consistentes. Modo ahorro de energía: indicador estático y efectos decorativos desactivados.

## Versiones investigadas y decisión

Versiones instaladas resueltas por contexto; novedades consultadas en npm el 2026-10-08. Revalidar antes de implementar.

| Componente | Instalado | Actual consultado | Decisión |
|---|---|---|---|
| Electron | 44.4.5 | 44.7.0 | Revisar parche y regresiones de Windows/installer |
| React/DOM | Raíz 18.3.1; frontend 19.2.5 | 19.3.0 | Resolver coherencia antes de migrar |
| Vite | Raíz 7.3.6; frontend 8.0.16 | 8.3.4 | Unificar build y revisar cambio mayor |
| Framer Motion / Motion | 12.42.2 / 12.38.0 | 14.0.0 | Migración separada; no garantía de rendimiento |
| thinking-orbs | 0.1.1 | 0.3.2 | Evaluación A/B y carga diferida |
| Lucide | 1.24.0 / 1.14.0 | 1.53.0 | Importar sólo iconos usados y alinear estilos |
| Hugeicons React | 1.1.10 / 1.1.6 | 1.1.10 | Revisar necesidad de dos catálogos |
| docx-preview | 0.4.1 | 0.4.1 | Corregir integración, no hay actualización detectada |
| react-pdf | 10.4.1 | 11.0.0 | Probar migración con worker compatible |
| xlsx | 0.18.5 | npm 0.18.5; distribución oficial 0.20.3 | Usar procedimiento oficial, no confiar sólo en npm latest |
| page-mascot | 0.1.0 | 0.1.0 | Conservar modo estático y carga diferida |

La [instalación oficial de SheetJS](https://docs.sheetjs.com/docs/getting-started/installation/nodejs/) explica su distribución fuera del registro público actualizado. Revisar procedencia, licencia e integridad del artefacto. Para versiones mayores consultar [React-PDF releases](https://github.com/wojtekmaj/react-pdf/releases) y [guía de actualización de Motion](https://motion.dev/docs/react-upgrade-guide).

## Orden de ejecución y aceptación

1. **P0 — Integridad y medición:** lectores en paquete instalado, baseline CPU/RAM/arranque/instalación. Entregable: benchmark reproducible y resultados por escenario.
2. **P1 — Carga inicial:** separar gráficos, alinear resolución del build y optimizar recursos. Entregable: tabla antes/después y primera apertura de herramientas sin regresiones.
3. **P2 — Reposo:** coordinar eventos/polling, visibilidad y cargas de backend. Entregable: menos trabajo medido, automatizaciones y Telegram continúan correctamente.
4. **P3 — Chat/documentos:** perfiles, parsing incremental, cachés y liberación. Entregable: interacción fluida y memoria sin crecimiento sostenido.
5. **P4 — Presentación:** estados reales, iconos coherentes, indicador ligero, movimiento reducido. Entregable: revisión en Spartan instalada, no sólo harness.
6. **P5 — Actualizaciones y limpieza:** cambios pequeños, compatibilidad y archivos sin uso demostrado. Entregable: paquete reproducible, pruebas pertinentes y reversión disponible.

Cada bloque debe indicar qué cambió, métricas antes/después y limitaciones. Las pruebas deben cubrir comportamiento real: adjuntar/retirar, pestañas, lectura/conversión, cancelar, reconectar y automatizaciones en segundo plano. No eliminar datos del usuario, dependencias dinámicas o archivos de licencia por una coincidencia textual. No afirmar ahorro de CPU/RAM hasta completar las mediciones de producción.
