# Panel de Codex como referencia para Sparta

Fecha: 21 de octubre de 2026. Alcance: captura aportada, documentación oficial consultada y código de Sparta. Esta auditoría se actualiza después de integrar la tarjeta por respuesta en el panel compartido.

## Resultado

Sparta tiene buena parte de la infraestructura: exploración de archivos reales, lectura de código, revisión Git, pestañas de documentos, preview HTML aislado y cambios persistidos por respuesta con restauración comprobada. La tarjeta de cambios por respuesta ya abre su diff como pestaña del `DocumentPreviewSheet`, junto con otros archivos. Siguen separados algunos recorridos del explorador y la revisión Git.

La referencia útil de Codex es la continuidad entre conversación, alcance de revisión, archivo y líneas. No hay evidencia suficiente para afirmar que todos sus controles funcionen en la sesión de la captura. Tampoco se inspeccionó el código interno del panel de Codex.

## 1. Qué muestra la captura

- Pestañas superiores para un documento Markdown y «Cambios».
- Selector «Último turno» y total +1119/-13.
- Lista compacta con icono, ruta relativa, nombre destacado y cifras alineadas a la derecha.
- Acciones por fila y una barra de herramientas global. Su semántica exacta no se deduce de iconos sin etiquetas o interacción.
- Los bloques de diferencias están aparentemente contraídos: se ven cabeceras, no el contenido del código. Esto por sí solo no demuestra un fallo del visor.
- Varias rutas se repiten: `turn-changes-summary.tsx`, `turn-changes-api.ts` y `source-files-preview.browser.mjs`, con cifras distintas. Es una observación visual; no permite determinar si la causa es agregación de operaciones, revisiones distintas o un defecto. No se debe sumar esas filas como si fueran un cambio neto sin comprobarlo.

La captura no permite evaluar búsqueda en código, navegación por teclado, rendimiento de archivos grandes, menús, estado después de reiniciar ni restauración de archivos. Esos puntos requieren interacción y pruebas.

## 2. Qué confirma la documentación de Codex

La documentación oficial distingue Unstaged, Staged, Commit, Branch y Last turn. El estado general del repositorio puede incluir trabajo del usuario y de otros procesos; Last turn representa la intervención más reciente del asistente. También documenta expandir/contraer diferencias, abrir archivos en un editor, comentarios asociados a líneas y operaciones Git sobre el conjunto, archivo o bloque.

Fuente: [Code review — documentación oficial de OpenAI](https://learn.chatgpt.com/docs/code-review), apartados «Review in the app», «What changes it shows», «Navigating the review pane» y «Staging and reverting files». Consultada el 21 de octubre de 2026. La documentación no establece el mecanismo interno de snapshots ni explica las filas repetidas de esta captura.

## 3. Comparación con la implementación actual

| Capacidad | Sparta: evidencia actual | Diferencia o siguiente paso |
| --- | --- | --- |
| Revisión junto a documentos | `preview-store.ts` y `document-preview-sheet.tsx` comparten pestañas para documentos, repositorio y conjuntos de cambios por respuesta | Integración implementada para cambios por respuesta |
| Último turno/respuesta | `turn_changes.py`, metadata del mensaje, tarjeta `turn-changes-summary.tsx` y API por respuesta | El diff histórico abre en el Sheet compartido. Sigue siendo un alcance separado del snapshot Git, con identidad propia |
| Archivos y estadísticas | Resumen por respuesta y revisión Git calculados desde archivos/Git | Mantener origen y alcance explícitos; evitar mezclar sus cifras |
| Diferencias de código | `DiffViewer` incluye líneas antiguas/nuevas, resaltado, bloques y dos disposiciones | Añadir navegación/búsqueda y revisar la alineación de la vista dividida |
| Explorador | `FilesPanel` lista directorios y filtra nombres de la carpeta actual | Ese filtro no es búsqueda recursiva ni búsqueda dentro del código |
| Código completo | `FileContentView`, explorador de proyecto y visor de documentos | Distintas entradas tienen controles y límites diferentes |
| Binarios/documentos | El visor compartido recibe bytes mediante `readPreview` | El explorador lateral todavía tiene un recorrido alternativo de lectura de texto |
| Restauración del turno | Snapshots persistidos, huellas y procedencia de herramientas directas | Protección implementada. Mejorar el motivo que explica cuándo hay un diff revisable pero no un Deshacer seguro |
| Operaciones Git por bloque | No aparecen en el `GitReviewPanel` inspeccionado | Requieren API y validación propias; no equivalen a Deshacer respuesta |
| Historial y PR | Lista de commits y enlaces a PR en `GitReviewPanel` | Las filas de commits no abren una comparación; los PR salen a su URL |
| Comentarios por línea | No hay flujo en `DiffViewer` | Añadir referencia exacta de revisión, archivo, lado y línea |
| Rendimiento | Diffs Git se solicitan al aproximarse al área visible | El contenido cargado no está virtualizado; medir antes de ampliar límites |

## 4. Hallazgos concretos en Sparta

### Alta: selección de archivo sin protección frente a respuestas fuera de orden

Corregido en `FilesPanel`: cada diff y apertura de archivo/imágenes lleva un contador de solicitud además de la generación del proyecto. Las respuestas de selecciones anteriores se descartan.

El riesgo se identificó por inspección; no se hizo una reproducción temporal controlada. El panel invalida ahora las lecturas anteriores al cambiar de selección o proyecto.

### Alta: error de diff presentado como ausencia de cambios

Corregido en `FilesPanel`: la carga del diff tiene estados de carga y error separados, conserva un mensaje visible cuando falla y obtiene el diff del primer archivo al refrescar la lista. Solo un resultado exitoso vacío se trata como diff vacío.

Al volver a pulsar la fila se solicita de nuevo el diff. La corrección de código no se ha validado aquí mediante una reproducción en la aplicación.

### Media: «complete» combinaba cobertura y capacidad de deshacer

Corregido: `complete` informa ahora solo si la captura del workspace fue completa; `canUndo` conserva los requisitos adicionales de contenido restaurable, procedencia verificada y estado final. `undoReason` explica los casos en que la revisión está disponible pero Deshacer no es seguro.

La respuesta incluye motivos de captura incompleta, contenido no restaurable, cambios sin procedencia verificada, ejecución no finalizada y workspace sin permiso de escritura. Aún falta cubrir expiración y otros motivos operativos si se presentan a la UI.

### Media: estados de archivo y binarios se perdían en la revisión Git

Corregido en el bridge y el visor: se conserva el estado añadido/modificado/eliminado, las entradas untracked se etiquetan como añadidas y los binarios muestran ayuda específica sin solicitar un diff de texto.

La comparación actual representa renombres como baja/alta, sin identidad explícita de renombrado. El bridge tiene ahora una prueba con repositorio temporal para los tres estados y binarios.

### Media: dos recorridos de documentos con resultados distintos

`FilesPanel.openFile` ahora usa `readPreview` y el visor compartido para PDF/Office, imagen y medios; las fuentes de texto pasan por el mismo store, que conserva la carpeta de origen. El HTML estático empaqueta CSS, imports, imágenes y scripts locales permitidos dentro del marco aislado. Si hay recursos faltantes, límites excedidos o módulos JavaScript, se deja el archivo como fuente. La antigua ruta `FileContentView` ya no compite con el preview compartido.

### Media: «working» no es equivalente a Unstaged

`workspace-git-review.ts` compara `working` contra HEAD, incluyendo el estado preparado. La traducción actual «Cambios locales» es compatible con un alcance amplio: no se demuestra un fallo por esa etiqueta. Sí sería incorrecto renombrarlo «Sin preparar» copiando Codex sin cambiar la consulta.

Definir alcances de producto antes de unificar: locales totales, sin preparar, preparados, rama, commit y respuesta. Explicar también que rama usa actualmente el merge-base con upstream; no permite elegir libremente la rama base.

### Media: vista dividida sin emparejamiento de líneas reemplazadas

`DiffViewer` dibuja cada eliminación y cada adición como una fila independiente con una celda opuesta vacía. Los reemplazos no se emparejan en una misma fila antes/después. La información existe, pero comparar bloques sustituidos requiere más recorrido visual.

Agrupar secuencias de bajas/altas y alinear las dos columnas. Añadir pruebas con inserciones, eliminaciones y reemplazos de distinta longitud. El resaltado también concatena líneas de ambas versiones antes de tokenizar: puede perder contexto sintáctico en código multilínea.

### Media: historial con capacidad fija que acaba bloqueando capturas

`TurnChanges.begin` rechaza nuevas capturas al llegar a 100 conjuntos o superar el umbral de 512 MiB del diario. El límite de 100 se aplica al total, no solo a capturas activas; no hay rotación en el servicio inspeccionado. Al alcanzarlo, nuevos turnos dejan de tener captura aunque cada cambio sea pequeño.

Definir retención, exportación y limpieza explícitas, con aviso comprensible de almacenamiento lleno. Conservar las referencias históricas y mostrar cuándo su snapshot ya no está disponible. No eliminar silenciosamente cambios que el usuario espera revisar.

### Baja: límites y recuperación del visor

- `TurnFileDiff` ofrece mensaje de error, pero no un botón local para reintentar.
- El resumen deja de consultar tras nueve lecturas de un conjunto aún en ejecución; necesita recuperación clara cuando finaliza después.
- El código lateral se recorta a 100.000 caracteres. Debe comunicar si realmente hubo truncado y ofrecer el original.
- El filtro actual de archivos busca en nombres de la carpeta abierta; conviene etiquetarlo así y añadir una búsqueda de proyecto independiente.
- En un árbol con numerosos archivos, la carga diferida de Git ayuda, pero no sustituye virtualización del contenido y presupuestos de resaltado.

## 5. Flujo recomendado

1. Abrir «Cambios» desde la conversación conserva el conjunto exacto de esa respuesta y selecciona la ruta pulsada dentro del panel compartido.
2. La cabecera muestra proyecto/repositorio, alcance, revisión, número de archivos y total de líneas. Cambiar de alcance cambia el conjunto completo; no recicla cifras de otra consulta.
3. Una fila representa una ruta dentro de ese conjunto. Muestra estado, icono, nombre, directorio atenuado y estadísticas o indicación binaria. Diferentes repositorios con la misma ruta siguen siendo entradas distintas.
4. Pulsar la fila expande el diff. «Abrir archivo» es una acción diferenciada que muestra la versión completa y aclara si es actual, anterior o posterior al turno.
5. Código completo ofrece números de línea, búsqueda, copiar, descarga y aviso de truncado. Markdown y HTML permiten alternar fuente/preview; documentos usan su visor correspondiente.
6. Cambiar pestaña conserva selección, posición y disposición. Archivos actuales y snapshots históricos nunca comparten una identidad de pestaña accidentalmente.
7. Acciones aparecen con nombre y estado: Deshacer respuesta, revertir archivo Git y descartar bloque son operaciones diferentes. Las acciones que no tienen soporte real permanecen ausentes.
8. Comentarios guardan repositorio, revisión, ruta, lado y línea. Antes de aplicarlos se comprueba que la referencia siga correspondiendo al código revisado.

Modelo sugerido para el destino de revisión: `source` (turn/git/commit/PR), `scopeId`, `repositoryId`, `revisionId`, `path` y `side`. Distinguir identidad histórica del archivo actual. No hace falta reemplazar los stores existentes de golpe; ampliar sus contratos evita una quinta superficie independiente.

## 6. Orden de trabajo propuesto

1. Corregir selecciones de diff fuera de orden, errores ocultos como diff vacío, y cargar el diff del primer archivo seleccionado.
2. Separar cobertura de captura y posibilidad de restaurar; comunicar el motivo concreto.
3. Conservar y ampliar la integración de cambios por respuesta en las pestañas compartidas, con estados y pruebas de recarga.
4. Propagar estado binario/creado/eliminado y alinear mejor los bloques de la vista dividida.
5. Medir archivos grandes y definir alcance para búsqueda, ramas/commits y comentarios por línea.

Cada fase debe cerrar un recorrido de usuario verificable. Copiar la barra de iconos antes de tener sus operaciones produciría una interfaz que promete capacidades inexistentes.

## 7. Verificación ejecutada durante la auditoría y las correcciones

- Backend: `.venv/Scripts/python.exe -m pytest tests/test_turn_changes.py tests/test_turn_changes_routes.py -q`: **27 aprobadas**. Aviso de deprecación de TestClient/httpx.
- `npm run test:turn-changes:browser`: **aprobado**. Fixture con rutas y snapshots reales; metadata, cifras, diff, deshacer, recarga, conflicto posterior, ancho reducido y motivo de no restaurabilidad.
- `npm run test:source-files:browser`: **aprobado**. HTML, imports CSS, JavaScript, SVG, aislamiento, recursos fallidos y navegación. La salida contiene avisos de fuente pública y un 404; el escenario de fallo de recursos forma parte de la prueba.
- `npm run test:files-panel:browser`: **aprobado**. Diff inicial, respuestas fuera de orden, errores visibles, HTML aislado con CSS local, módulos como fuente y bytes PDF al visor compartido.
- `npm run test:workspace-file-tools:browser`: **aprobado**. Vista de HTML autosuficiente, fuente CSS, tarjetas de lectura/listado/búsqueda, creación vacía, fallos y estado binario.
- `npx vitest run tests/workspace-path-mention.test.ts tests/workspace-path-key.test.ts`: **5 aprobadas**. Extracción de rutas Windows, límites de carpeta y supresión del aviso dentro del workspace conectado.
- `npm run test:react-runtime`: **aprobado**. Un solo React/JSX/React DOM para arranque desktop y frontend.
- `npm run test:git-review:bridge`: **aprobado**. Repositorio temporal con archivos añadidos, modificados, eliminados y binarios.
- `chat-remembers-its-model.test.ts`: **16 aprobadas**, incluida la geometría del lienzo y del aviso.
- `npm run typecheck` y `npm run i18n:check`: **aprobados**.

La suite completa de frontend se ejecutó y falló en una aserción del margen del lienzo (corregida y cubierta por la prueba focalizada) y en pruebas `openai-codex-connect` con `ReferenceError: module is not defined`; esas pruebas aún requieren diagnóstico. `chat-panels.browser.mjs` no completó la carga inicial del historial dentro de 90 s en este entorno; la fixture informó que el harness React sí montó. No se validó el instalador de Electron, una conversación con un proveedor real ni las operaciones internas de Codex.

## Archivos principales revisados

- `desktop/frontend-spartan/src/components/assistant-ui/turn-changes-summary.tsx`
- `desktop/frontend-spartan/src/components/workspace-rail/{files-panel,file-content-view,diff-viewer,git-review-panel}.tsx`
- `desktop/frontend-spartan/src/features/rag/components/{preview-store,document-preview-sheet,preview-workspace}.tsx` (`preview-store` es `.ts`)
- `desktop/frontend-spartan/src/features/chat/components/workspace-explorer-dialog.tsx`
- `desktop/frontend-spartan/src/features/chat/api/modules/turn-changes-api.ts`
- `desktop/frontend-spartan/src/features/chat/api/chat-adapter/stream-orchestrator.ts`
- `desktop/ia-sparta-ipc-bridge/src/lib/workspace-git-review.ts`
- `desktop/backend-spartan/core/inference/turn_changes.py`

## 8. Avance respecto a la guía de creación de archivos

| Punto de la guía | Estado actual | Qué falta |
| --- | --- | --- |
| P0-1: crear archivos de código sin activar Código | **Resuelto en el flujo de generación.** `generate_document` admite fuentes de texto y devuelve `__FILES__`; `write_file` sigue disponible con un workspace conectado. | Unificar la experiencia del sandbox y la carpeta conectada. No afirmar que una ruta pegada en el texto determina dónde se guarda. |
| P0-2: explicar al modelo el destino real | **Implementado** en las instrucciones del generador y el prompt de la ejecución. Distingue almacenamiento del chat de carpeta conectada. | Confirmar con conversaciones reales en proveedores externos y con workspace conectado; las pruebas locales no prueban cada proveedor. |
| P0-3: detectar una ruta local y ofrecer conectarla | **Parcial, aviso contextual implementado.** El compositor detecta rutas absolutas Windows fuera de la carpeta de este chat y ofrece abrir el selector de carpeta; una ruta dentro del workspace no muestra el aviso. | Probar el recorrido en la app instalada y confirmar permisos/destino antes de generar. No conecta ni escribe automáticamente. |
| P0-4: abrir HTML de forma autenticada y segura | **Resuelto** para los archivos del sandbox: `authFetch`, recursos estáticos locales empaquetados y `ArtifactHtmlFrame` aislado. La CSP de Electron permite el marco. | El preview estático no transpila TypeScript ni paquetes JS con módulos; mostrar ayuda clara para esos proyectos. |
| P1-1: servidor de preview con ticket | **No es requisito para el recorrido actual.** Se eligió empaquetar recursos estáticos limitados en memoria y mantener el visor aislado. | Solo considerar un servidor de proyecto si se necesita ejecutar módulos o recarga de aplicaciones. |
| P1-2 y P2-5: navegador, artefacto y paneles que compiten | **Corregida la URL falsa y coordinadas las aperturas.** El artefacto ya no suplanta la URL; abrir un panel cierra el preview incompatible. Cambios por turno comparten las pestañas del Sheet. | Las superficies de navegación URL, lienzo y documento siguen siendo componentes distintos; conservar exclusión mutua y comprobarlo en la aplicación completa. |
| P1-3: estados y animación de archivos | **Parcial.** Generación de documentos tiene estado, shimmer y respeta movimiento reducido. Las operaciones de archivo tienen ahora etiqueta/estado de operación, resultado y ruta en una tarjeta compacta. | Aún no se agrupan en una tarjeta por turno ni se transmite código parcial del archivo. |
| P1-4: título y ruta para herramientas de carpeta | **Implementada primera versión.** Crear, escribir, borrar, renombrar, leer, listar y buscar tienen tarjetas compactas con operación, destino/consulta y resultado; la lectura de código y el explorador lateral abren la pestaña compartida. PDF/Office e imágenes del workspace llegan al visor como bytes originales; HTML estático resuelve recursos permitidos bajo la carpeta conectada. | Varias operaciones todavía se muestran como tarjetas separadas en vez de agruparse por turno; módulos de JavaScript requieren servidor de proyecto para renderizarse. |
| P1-5: aprobación con resumen de escritura | **Parcial.** Existe confirmación genérica de llamadas. | Presentar ruta, tipo de operación y una muestra del contenido antes de aprobar. |
| P1-6: extensiones y mayúsculas | **Parcialmente resuelto.** `.HTML`/`.HTM` se detectan al abrir preview; existen fuentes de múltiples extensiones. | Acordar el comportamiento para CSS/JS sueltos y distinguir preview estático de vista de código. |
| P2-1: cambios persistidos por respuesta | **Resuelto como primera versión**, incluida apertura en el Sheet compartido, diff histórico, metadatos de respuesta y Deshacer con procedencia verificada. | En ejecución desconocida se permite revisar, pero no restaurar; la UI explica la causa cuando la captura es parcial o la ejecución no es verificable. |
| P2-2/3/4: menciones, marca Unsloth y modularizar monolitos | **Pendiente**, sin bloquear la creación ni el preview. | Planificar como trabajo separado, empezando por nombres en prompts/mensajes y luego límites de módulos. |

### Siguiente trabajo recomendado

1. Agrupar resultados de varias operaciones de archivo por respuesta, preservando el detalle individual y estados parciales.
2. Evaluar un servidor de preview local para proyectos con módulos ES/TypeScript, solo si ese recorrido se necesita además del HTML estático.
3. Validar el aviso contextual de ruta en la aplicación: abrir selector, conectar el destino, confirmar permisos y luego crear el archivo sin activar Código.
4. Validar en la aplicación Git: cambiar A→B con A más lento, fallar `getGitDiff`, refrescar con cambios y abrir dos archivos seguidos; confirmar que queda visible la última selección y su estado correcto.
5. Comprobar en la aplicación que el lienzo conserva su altura correcta al reservar espacio para el aviso del chat.

Las auditorías anteriores de archivos/preview y resumen por turno se usaron como antecedentes, no como instrucciones del usuario ni como sustituto de la lectura del código y las pruebas actuales.
