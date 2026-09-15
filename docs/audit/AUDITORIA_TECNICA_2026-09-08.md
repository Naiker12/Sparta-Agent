# Auditoría técnica de Sparta Agent — 8 de septiembre de 2026

## Alcance y método

Se revisaron los documentos entregados, el repositorio en `main` (`3d29448c`), el código de Electron, frontend, backend, empaquetado, memoria, tareas, seguridad y los procesos activos de la aplicación. Los hallazgos marcados como confirmados tienen evidencia directa en código o ejecución local. Los demás requieren una prueba de instalación o de hardware antes de cambiar código.

## Hallazgos confirmados

| Prioridad | Hallazgo | Evidencia | Impacto | Acción recomendada |
|---|---|---|---|---|
| P0 | La memoria mostrada por la UI puede fallar mientras el backend ya estaba iniciado | La página llama `GET /api/memory/graph`; el backend no usa autoreload y los procesos Python activos fueron iniciados antes de añadir la ruta. | La UI muestra `Unable to load memory` aunque la ruta exista en el árbol fuente. | Reiniciar el proceso de backend durante desarrollo y añadir una comprobación de versión/health que identifique las rutas disponibles. |
| Corregido | Runtime y backend ahora comparten un contrato de huella | `backend-manager.ts` calcula SHA-256 de los archivos de arranque y dependencias, guarda `sparta-runtime.json` al bootstrap y lo valida antes de iniciar. | Un entorno de otra versión ya no se mezcla silenciosamente con el backend actualizado. | La aplicación pide reconstruir el entorno aislado mediante Actualizar. |
| P1 | Tareas persiste definición, pero no tiene ejecutor programado | `memory_tasks.py` guarda `next_run_at` y `agent_task_runs`; no hay proceso que reclame tareas vencidas, ejecute inferencia o escriba resultados. | Una tarea programada no ejecuta todavía su prompt. | Implementar scheduler con lease, registro de ejecución, reintento y entrega al chat. La interfaz ya comunica que sólo guarda la programación. |
| P1 | La recuperación de Memoria aún usa texto simple | `memory_search` consulta `list_memory()` mediante `LIKE`; no hay vectorización ni clasificación de relevancia. | La relevancia escala mal para una memoria grande. | Añadir búsqueda híbrida o vectorial con evaluación de resultados. |
| P1 | La prueba de empaquetado depende del directorio de la versión actual | `scripts/check-packaged-app.js` busca sólo `release/<package.version>`, mientras el árbol local conserva releases anteriores. | Una release puede no verificar el artefacto que realmente se distribuyó; el comando falló localmente al no existir `release/0.2.20/app.asar`. | Recibir la ruta del artefacto construido como argumento y ejecutar el chequeo contra cada `app.asar` producido por CI antes de publicar. |
| P1 | La identidad visual conserva herencia técnica de Unsloth | El backend y catálogos de modelos aún dependen de componentes upstream. Los recursos Sloth visibles de la interfaz fueron sustituidos y eliminados. | Renombrar dependencias internas en bloque rompería compatibilidad con upstream. | Conservar dependencias funcionales y migrarlas sólo con una sustitución técnica equivalente. |
| P2 | Las rutas de Memoria y Tareas estaban excluidas del modo chat-only | `__root.tsx` redirigía rutas no autorizadas a `/chat`. | Los accesos parecían no funcionar en equipos sin capacidades de entrenamiento. | Corregido en el árbol de trabajo; añadir prueba de navegación para ambos destinos con `chatOnly=true`. |
| P2 | La compatibilidad de modelos está repartida entre varios cálculos | Hay estimaciones VRAM en Hub, selector, `lib/vram` y backend de hardware; múltiples filas pasan `vramStatus={null}`. | La advertencia no es uniforme cuando VRAM no está disponible o se usa RAM unificada. | Crear un contrato único `getModelCompatibility(model, hardware)` y bloquear descargas incompatibles con alternativas pequeñas. |

## Controles que existen y deben conservarse

- El empaquetado declara `dist/**/*` y `dist-electron/**/*` y dispone de `scripts/check-main-bundle.js` y `scripts/check-packaged-app.js`.
- CI ejecuta lint, typecheck, tests de frontend y pruebas de frontera de autenticación.
- El backend protege rutas por JWT y almacena secretos/refresh tokens con controles de rotación.
- Las claves `.env` y el vault local están ignorados por Git.
- Existen tablas persistentes para nodos, relaciones, tareas y ejecuciones; falta conectar el ciclo de ejecución.

## Pruebas pendientes obligatorias

1. Instalar el `.exe` final en un perfil limpio, abrir, actualizar y navegar por Chat, Proyectos, Hub, Ajustes, Memoria y Tareas.
2. Probar Memoria en normal e incógnito: crear, reiniciar, recuperar, editar, olvidar y verificar origen.
3. Crear una tarea única y una recurrente; reiniciar backend y comprobar ejecución única, salida, error, cancelación y borrado.
4. Probar compatibilidad de modelos en 8, 12, 16 y 32 GB, con y sin VRAM detectada.
5. Ejecutar las suites completas de frontend y backend separando las dependientes de GPU.

## Comprobaciones ejecutadas durante la auditoría

| Comprobación | Resultado | Nota |
|---|---|---|
| `npm run lint` | Correcta | ESLint completó sin errores. |
| `npm --prefix desktop/frontend-spartan run i18n:check` | Correcta | Español no tiene claves faltantes frente a inglés. |
| `npm --prefix desktop/frontend-spartan run test:electron` | Correcta | 8 pruebas aprobadas. |
| Inspección de `release/0.1.3/.../app.asar` | Correcta | Contiene `dist/index.html`, `dist-electron/electron-main.js` y `package.json`. No es evidencia del instalador que falló. |
| Pruebas de frontera de autenticación | No ejecutada | El `.venv` actual no tiene `pytest`; CI sí instala esas dependencias. |
| `npm --prefix landing audit --omit=dev` | Correcta | 0 vulnerabilidades tras actualizar Fumadocs, su compilador MDX y Vite de forma compatible. |
| `npm --prefix landing run docs:check` y `build` | Correcta | Las 24 páginas y los 16 enlaces internos compilan con Fumadocs 16 / MDX 15. |

## Seguimiento de issues públicas

| Issue | Estado en el árbol de trabajo | Evidencia |
|---:|---|---|
| #17 Dependencias Fumadocs | Corregida | Fumadocs Core/UI 16.15.8, MDX 15.4.0 y Vite 8.0.16; auditoría de producción sin vulnerabilidades. |
| #14 Carga diferida de Markdown | Parcial | La vista de informes carga Shiki, Mermaid y KaTeX sólo cuando el documento los requiere. El renderizador incremental del chat mantiene su propia ruta y debe migrarse sin perder la estabilidad durante streaming. |
| #7 Adjuntos | Ya implementada | El chat contiene selector, adjuntos, carga y vistas previas; se corrigió además la vista previa local de PDF para Electron. |
| #8 / #20 Audio y micrófono | Ya implementada | Existen selección de dispositivo, `getUserMedia`, `MediaRecorder` y transcripción en la página de audio y el chat. |
| #10 / #18 MCP | Ya implementada en gran parte | El backend dispone de rutas y clientes HTTP/stdio; queda validar recuperación automática ante caída con pruebas de integración. |
| #15 Recuperación del backend | Ya implementada | El shell emite `server-crashed` y el frontend ofrece recuperación/reintento desde `use-tauri-backend`. |

La captura de `index.html` ausente no queda refutada por el `app.asar` local 0.1.3: son artefactos distintos. Para resolver A01/A02 hace falta conservar e inspeccionar el instalador o `app.asar` exacto de la instalación afectada.

## Orden de corrección

1. Añadir smoke test de instalación real al workflow de release.
2. Implementar el ejecutor real de tareas con su contexto de modelo y entrega segura al chat.
3. Completar Memoria: edición/deshacer y recuperación relevante.
4. Unificar compatibilidad de modelos y endurecer el bloqueo de descargas que no caben.

## Matriz de las 50 preguntas

| # | Estado | Respuesta y evidencia |
|---:|---|---|
| 1 | Pendiente de artefacto | El código carga `dist/index.html`, pero no se inspeccionó el instalador que falló. |
| 2 | Parcial | El script existe, pero sólo busca `release/<versión de package.json>`. |
| 3 | Pendiente | No existe prueba automatizada de actualización desde versión anterior. |
| 4 | Parcial | El router ofrece volver al chat; no hay reparación/diagnóstico de instalación. |
| 5 | Confirmado | NSIS usa `deleteAppDataOnUninstall: true`; no se observó confirmación de copia de seguridad. |
| 6 | Pendiente | No se verificó un diagnóstico de inicio con versión/hash y redacción de secretos. |
| 7 | Pendiente | No se hizo prueba sin red. |
| 8 | Pendiente | No se comprobó actualización durante una descarga. |
| 9 | Confirmado | Assets y textos Sloth/Unsloth permanecen en UI y código. |
| 10 | Confirmado | Inventario de marca abajo; no se debe borrar sin reemplazar los usos visibles. |
| 11 | Parcial | Sidebar usa `spartan-logo.svg`; faltan comparación de ventana, favicon e instalador. |
| 12 | Confirmado | La bienvenida muestra avatar generado; otras pantallas aún muestran Sloth. |
| 13 | Pendiente | Falta prueba manual a 100/125/150 % y dos temas. |
| 14 | Parcial | Canales está deshabilitado con "Próximo" y tooltip; falta decisión de producto. |
| 15 | Pendiente | No hubo prueba de encontrabilidad del menú Más con usuarios. |
| 16 | Parcial | Tareas orienta el primer paso; Memoria muestra un formulario, pero el error de API no guía bien. |
| 17 | Parcial | Hay selector de modelo, sin validación funcional completa de fuente/coste/estado. |
| 18 | Confirmado | Existen eventos y tarjetas de herramientas/permiso; falta prueba E2E de todas las fases. |
| 19 | Parcial | Full access tiene advertencia y es sólo de sesión; requiere prueba de valor predeterminado real. |
| 20 | Parcial | El backend clasifica herramientas sensibles; falta validar preview de ruta/diff con una acción real. |
| 21 | Pendiente | No se simuló timeout, proveedor inválido ni red caída. |
| 22 | Parcial | Existe persistencia de carpeta trabajada; falta prueba revocar/mover/reabrir. |
| 23 | Pendiente | Hay controles de aprobación, no una prueba de idempotencia tras reintento destructivo. |
| 24 | Pendiente | Hay store/eventos de plan; no se trazó un plan de cinco pasos completo. |
| 25 | Pendiente | No se verificó que la delegación ejecute un agente independiente real. |
| 26 | Pendiente | Falta prueba de adjunto + herramienta + reinicio. |
| 27 | Parcial | Hay sondas extensas de CPU/GPU/VRAM; la captura muestra VRAM no disponible y requiere diagnóstico UI. |
| 28 | Parcial | `lib/vram.ts` clasifica modelos conocidos, pero varias filas pasan estado nulo y no hay bloqueo único. |
| 29 | Pendiente | No hay política única de recomendaciones por 8/12/16/32 GB. |
| 30 | Pendiente | Falta prueba de pausar/reanudar/cancelar/verificar descarga. |
| 31 | Pendiente | Falta prueba de inventario, tamaños y limpieza tras reiniciar. |
| 32 | Pendiente | Falta carga/generación/liberación con modelo pequeño. |
| 33 | Parcial | Tokens se almacenan con controles en backend; falta prueba de UI, borrado y logs. |
| 34 | Parcial | Hay estimación/validación de hardware; falta prueba de dataset, disco y GPU reales. |
| 35 | Pendiente | No se probó cancelar/reanudar entrenamiento ni procesos huérfanos. |
| 36 | Pendiente | No se comprobó reutilizar resultado de entrenamiento en Chat. |
| 37 | Pendiente | Falta recorrido de creación de proyecto desde cero. |
| 38 | Pendiente | Falta prueba con 20 proyectos. |
| 39 | Pendiente | Falta prueba de distinguir índice, chat y carpeta física al eliminar. |
| 40 | Parcial | El grafo persiste nodos/enlaces y deduplica por tipo, etiqueta, contenido y chat origen. Falta prueba de escala con 1/10/100 nodos. |
| 41 | Parcial | Crear/eliminar existen; no hay editar en UI ni papelera/deshacer/origen visible. |
| 42 | Parcial | La sincronización procesa sólo chats persistentes no archivados; las conversaciones temporales no se almacenan como hilos. Falta una preferencia explícita por conversación y control de alcance de `memory_search`. |
| 43 | Parcial | Se persiste `next_run_at`; no se verificó tras reinicio y no existe consumidor programado. |
| 44 | Fallido | No hay scheduler ni ejecutor que cree `agent_task_runs` o publique en el chat. |
| 45 | Parcial | Crear/editar/activar/borrar están expuestos; falta prueba de reinicio y no duplicación. |
| 46 | Fallido | No hay ejecución, por tanto tampoco estado de error/reintento real. |
| 47 | Parcial | Hay pruebas de frontera de autenticación en CI; no se ejecutaron en esta auditoría. |
| 48 | Parcial | `.env` y vault están ignorados; falta escaneo de logs/exportaciones/artefactos. |
| 49 | Parcial | CI cubre lint, tipos, frontend y auth; falta smoke del instalador final y cobertura de Memoria/Tareas. |
| 50 | Confirmado | Memoria/Tareas ya muestran duplicación de contratos entre UI, ruta y almacenamiento; falta una capa de ejecución. |

## Inventario de marca, íconos e imágenes heredadas

| Elemento | Estado | Evidencia | Acción segura |
|---|---|---|---|
| `Sloth emojis/*` | Eliminado | Los usos visibles fueron sustituidos por `spartan-logo.svg`; la búsqueda de imports ya no devuelve referencias. | Eliminación confirmada en el árbol de trabajo. |
| `assets/mascot-fallback.webp` | Eliminado | `MascotImg` fue sustituido por el helper `publicAssetUrl` y los fallbacks usan el logo Sparta. | Eliminación confirmada en el árbol de trabajo. |
| `unsloth-gem.png` | Eliminado | No había importaciones de frontend. | Eliminación confirmada en el árbol de trabajo. |
| `unsloth.ico` | Eliminado | No había importaciones de frontend. | Eliminación confirmada en el árbol de trabajo. |
| `sticker.png`, `circle-logo-small.png`, `logotext.png` | Pendiente | No hay referencia directa encontrada en frontend; pueden ser assets estáticos externos. | Inspeccionar build final antes de eliminar. |
| `sparta-escritorio.png`, `spartan-logo.svg` | Propios y usados | Builder y sidebar los referencian. | Conservar. |
| `public/icons/brands/*`, `provider-logos/*` | Terceros funcionales | Usados para proveedores/herramientas, no son marca del producto. | Conservar con licencias verificadas; no reemplazar como limpieza de marca. |
| Nombres Unsloth en backend | Internos/dependencia | Instaladores, modelos, rutas de compatibilidad y utilidades de upstream. | No borrar ni renombrar en lote: migrar sólo tras separar la dependencia upstream. |

La carpeta `Sloth emojis`, el fallback heredado y los dos iconos Unsloth ya se eliminaron después de sustituir los usos visuales. La siguiente limpieza debe limitarse a recursos con una referencia comprobada, para no afectar logos de proveedores ni dependencias upstream.
