# Auditoría de seguridad y calidad — 2026-08-27

## Estado tras la corrección

- **Corregido:** operaciones IPC de archivos sin workspace, validación tardía antes de convertir documentos, escapes por symlink/junction en destinos nuevos, exposición de la ruta absoluta al modelo, espacios finales/EOF y artefacto de dependencia `xlsx` sin uso.
- **Dependencias:** `npm audit --json` informa **0 vulnerabilidades** después de actualizar el lockfile y las dependencias de empaquetado.
- **Verificado:** typecheck del frontend, paridad de i18n y compilación de Python.
- **Pendiente de verificación de integración:** ejecutar la aplicación empaquetada con dos proyectos conectados a carpetas distintas y ejecutar la suite de backend cuando `pytest` esté instalado. No se declara cerrada esa cobertura hasta entonces.

## Resultado ejecutivo

El proyecto compila en el frontend y sus pruebas disponibles pasan, pero **no está listo para considerarse seguro** sin corregir los hallazgos altos de IPC/archivos y actualizar dependencias. No encontré claves privadas embebidas con la búsqueda de encabezados PEM. Esta es una auditoría estática y de dependencias; no sustituye un pentest ni prueba todos los flujos reales de la aplicación empaquetada.

## Verificaciones realizadas

| Verificación | Resultado |
| --- | --- |
| `npm run typecheck --prefix desktop/frontend-spartan` | Correcta |
| `npm run i18n:check --prefix desktop/frontend-spartan` | Correcta; ES no tiene claves faltantes |
| `npm test --prefix desktop/frontend-spartan` | Correcta (suite completada sin fallos) |
| `python -m compileall -q desktop/backend-spartan` | Correcta; un `SyntaxWarning` en un texto de prueba |
| `npm audit --omit=dev --audit-level=high --json` | 9 altas, 5 moderadas, 0 críticas |
| `git diff --check` | Fallos de espacios finales y líneas vacías al EOF |
| Búsqueda de cabeceras de claves privadas PEM | Sin resultados |

No fue posible ejecutar `pytest`: el intérprete virtual `desktop/backend-spartan/.venv` no tiene instalado el módulo `pytest`. Por tanto, los tests del backend **no fueron ejecutados**.

## Hallazgos prioritarios

### Alto — IPC de archivos expuesto sin una raíz obligatoria

- **Archivos:** `desktop/ia-sparta-ipc-bridge/src/channels/filesystem.channel.ts` y `desktop/ia-sparta-ipc-bridge/src/electron-preload.ts` (también `preload.ts`).
- **Evidencia:** los manejadores `fs:readFile`, `fs:writeFile`, `fs:deleteFile`, `fs:deleteFolder`, `fs:mkdir` y `fs:readDirLevel` solo restringen cuando `_workspaceRoot` tiene valor. Al iniciar, su valor es `null`. El preload expone esas operaciones al renderer como `window.fs`.
- **Impacto:** si se produce XSS, contenido web no confiable o una extensión/script comprometido en el renderer, podría leer, escribir o enviar a la papelera archivos accesibles por el usuario antes de seleccionar una carpeta. La terminal también acepta parámetros sensibles del renderer.
- **Corrección:** eliminar el modo sin raíz; cada llamada debe recibir un `projectId`/token de capacidad emitido por el proceso principal y resolverse contra una raíz registrada y validada. Rechazar cualquier operación sin esa capacidad.

### Alto — Lectura/conversión de documentos fuera del workspace antes de validar la ruta

- **Archivo:** `desktop/ia-sparta-ipc-bridge/src/channels/filesystem.channel.ts`.
- **Evidencia:** `fs:readFile` consulta la caché y llama a `convertDocumentToMarkdown(filePath)` antes de comprobar `isWithinRoot(filePath, _workspaceRoot)`.
- **Impacto:** aun con una raíz configurada, una ruta de PDF/DOCX/XLSX fuera de ella puede ser procesada y devuelta al renderer.
- **Corrección:** validar la ruta y resolver enlaces simbólicos **antes** de caché, conversión y lectura. Aplicar la misma política al caché por ruta.

### Alto — Dependencias de producción con vulnerabilidades conocidas

- **Archivo:** `package-lock.json` / `package.json` (resultado de `npm audit`).
- **Evidencia:** 9 vulnerabilidades altas. Destacan `xlsx` (prototype pollution y ReDoS, sin arreglo automático), `vite` (traversal/filtración en Windows), `undici`, `js-yaml`, `fast-uri`, `ip-address`, `nanoid`, `postcss` y `brace-expansion`.
- **Impacto:** el alcance depende de los flujos que procesan archivos, URLs y del servidor de desarrollo, pero `xlsx` es especialmente relevante porque la aplicación acepta documentos.
- **Corrección:** actualizar bloqueos y dependencias tras revisar compatibilidad; sustituir o aislar `xlsx` si no hay versión segura. Repetir `npm audit` hasta eliminar altas de runtime. Actualizar Vite antes de usar el servidor de desarrollo en redes no confiables.

## Hallazgos medios

### Medio — La raíz del workspace es global, no pertenece a cada proyecto

- **Archivos:** `desktop/ia-sparta-ipc-bridge/src/channels/filesystem.channel.ts`, `desktop/frontend-spartan/src/features/chat/hooks/use-chat-projects.ts` y `workspace-explorer-dialog.tsx`.
- **Evidencia:** `_workspaceRoot` es una variable global del proceso principal; `fs:setWorkspaceRoot` la reemplaza desde el renderer y también reinicia el observador.
- **Impacto:** abrir/cambiar dos proyectos puede hacer que el explorador, observador y operaciones nativas apunten a la carpeta del último proyecto. Es un fallo funcional y una frontera de seguridad poco clara.
- **Corrección:** mantener una tabla `projectId -> root canonicalizado`; exigir el proyecto en cada IPC, asociarlo a la ventana/sesión y no permitir que el renderer establezca rutas arbitrarias.

### Medio — La ruta local absoluta se envía al modelo/proveedor

- **Archivo:** `desktop/frontend-spartan/src/features/chat/api/chat-adapter.ts`.
- **Evidencia:** incorpora `connectedFolderPath` dentro de `<project_workspace>` en el prompt de sistema.
- **Impacto:** nombres de usuario, estructura local y datos de contexto se comparten con el proveedor remoto seleccionado. Puede ser inesperado para el usuario y es un riesgo de privacidad.
- **Corrección:** pedir consentimiento explícito al conectar cuando se use proveedor remoto, minimizar la información enviada (alias lógico) y documentarlo. No enviar la ruta para modelos externos si no es necesaria.

### Medio — La protección de rutas del puente no cubre de forma robusta destinos nuevos bajo enlaces

- **Archivos:** `desktop/ia-sparta-ipc-bridge/src/tools/path-guard.ts` y `desktop/ia-sparta-ipc-bridge/src/channels/filesystem.channel.ts`.
- **Evidencia:** las escrituras se validan antes de crear el archivo; para destinos inexistentes, la canonicalización puede caer a una comparación textual. Un enlace/junction existente dentro del workspace puede redirigir un destino nuevo fuera de él.
- **Impacto:** escritura o borrado fuera de la carpeta autorizada en árboles con symlinks/junctions manipulados.
- **Corrección:** canonicalizar el ancestro existente más cercano, verificar que permanece dentro de la raíz y volver a verificar tras abrir/crear. Añadir tests específicos para symlink y junction de Windows.

### Medio — Cobertura de pruebas del backend sin ejecutar

- **Archivos:** `desktop/backend-spartan/tests/` y entorno `.venv`.
- **Evidencia:** `pytest` no está disponible en el entorno auditado.
- **Impacto:** migraciones de SQLite, autorización de proyectos, rutas API e integración de herramientas no están verificadas de extremo a extremo.
- **Corrección:** instalar dependencias de desarrollo en un entorno aislado y ejecutar la suite backend, priorizando `test_project_workspace_link.py`, `test_chat_history_storage.py`, permisos y protección de rutas.

## Calidad, errores y código para limpiar

| Prioridad | Archivo | Problema | Acción |
| --- | --- | --- |
| Media | `desktop/backend-spartan/core/inference/mcp_server_actions.py` | 12 líneas con espacios finales, detectadas por `git diff --check`. | Formatear sin cambiar la lógica. |
| Baja | `desktop/backend-spartan/core/research/parsing.py` | Espacio final en la línea 250. | Formatear. |
| Baja | `desktop/frontend-spartan/src/features/chat/tour/steps.tsx` | Línea vacía extra al final. | Eliminarla. |
| Baja | `desktop/frontend-spartan/src/features/export/tour/steps.tsx` | Línea vacía extra al final. | Eliminarla. |
| Baja | `desktop/ia-sparta-ipc-bridge/src/channels/system.channel.ts` | Línea vacía extra al final. | Eliminarla. |
| Baja | `desktop/backend-spartan/plugins/data-designer-github-repo-seed/build/lib/` | Artefactos `build/lib` versionados. | Confirmar si se publican; si no, eliminarlos del repositorio y añadir `build/` al `.gitignore`. |
| Baja | `desktop/backend-spartan/plugins/data-designer-unstructured-seed/build/lib/` | Artefactos `build/lib` versionados. | Mismo tratamiento. |

No clasifiqué archivos como “basura” solo por estar modificados o no rastreados: la migración de i18n, las pruebas nuevas y los archivos del workspace pueden ser cambios funcionales legítimos. Los dos directorios `build/lib` sí son candidatos claros a artefactos generados, sujetos a confirmar que no formen parte del paquete distribuido.

## Aspectos positivos comprobados

- Electron activa `contextIsolation: true` y desactiva `nodeIntegration` en las ventanas principales.
- La aplicación tiene una capa de validación de rutas y varias protecciones para comandos destructivos; el problema es que no se aplican de forma uniforme al puente expuesto al renderer.
- El frontend mantiene coherencia de traducciones ES/EN y pasa la comprobación de tipos y su suite disponible.

## Orden recomendado de corrección

1. Cerrar el IPC de archivos: raíz obligatoria, token/capacidad por proyecto y validación antes de conversión/caché.
2. Corregir symlinks/junctions y añadir pruebas de escape de ruta en Windows.
3. Actualizar o sustituir las dependencias vulnerables, comenzando por `xlsx` y Vite.
4. Ejecutar pruebas de backend con `pytest` y una prueba manual empaquetada con dos proyectos conectados a carpetas distintas.
5. Limpiar espacios finales, EOF y decidir si los `build/lib` deben seguir versionados.
