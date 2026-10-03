# Plan de conexión de carpetas y proyectos

Fecha: 2026-09-30. Auditoría del código actual y capturas del usuario. No se ha probado una conexión real ni se han cambiado permisos durante esta auditoría.

## Diagnóstico

1. Hay dos modelos de conexión. `ThreadWorkspaceChip` guarda una carpeta por conversación con `bindingId`, `canonicalPath` y `access`. `WorkspacePanelContainer` y `FilesPanel` buscan `ProjectRecord.connectedFolderPath` usando un `projectId`. Una conexión por chat no llena ese campo: por eso el compositor puede mostrar una carpeta y el explorador indicar que no hay ninguna.
2. Antes de crear el chat, la selección vive en `sessionStorage` (`sparta.pending-workspace`). El registro durable se crea con `ensureThreadWorkspace` al existir un thread real. Cerrar la aplicación antes de enviar puede perder esa selección; no debe presentarse como conexión durable.
3. `setWorkspaceBinding` registra la raíz en un mapa del proceso Electron. El mapa no sobrevive al reinicio. El chip intenta rehidratarlo, pero no existe un coordinador común para chip, explorador y envío.
4. La selección de carpeta abre siempre un diálogo de acceso iniciado en solo lectura. Esa elección es independiente del modo de aprobación del chat. El chip no consulta ese modo para evitar diálogos redundantes.
5. El panel de archivos no distingue falta de conexión, conexión pendiente, raíz inaccesible y fallo del puente nativo. En la captura, su mensaje de vacío contradice el compositor.
6. El contexto enviado al modelo sí consulta el binding del chat y recomienda `list_directory`, `read_file` y `search_in_files`. No envía automáticamente todos los archivos. El orquestador activa las herramientas de carpeta cuando existe el binding.
7. El resolvedor de herramientas prefiere el binding del chat y comprueba la identidad de la carpeta. Su fallback legacy de proyecto devuelve acceso `write` fijo: revisar y corregir antes de ampliar el flujo.
8. Los endpoints de binding autentican `current_subject`, pero no lo usan explícitamente en sus búsquedas. Verificar si la instalación admite varios usuarios y definir propiedad de workspace/chat antes de afirmar aislamiento entre usuarios.
9. `setWorkspaceBinding` no inicia un watcher. Las actualizaciones en vivo necesitan suscripción acotada a la carpeta visible y limpieza al cambiar de chat.

## Modelo objetivo

Una carpeta durable es un Workspace, no un campo temporal del compositor:

- Workspace: identificador, nombre, ruta canónica local, identidad de filesystem, estado y fechas.
- ThreadWorkspaceBinding: conversación, workspace y capacidad otorgada.
- Project: agrupación visible que puede referenciar un workspace y contener conversaciones.
- Estado frontend único: sin carpeta / conectando / preparada / inaccesible / error. Chip, panel y envío deben consumir el mismo estado.
- `permissionMode` controla aprobaciones; `workspaceAccess` controla operaciones autorizadas dentro de la raíz. Ninguno reemplaza al otro.

## Diseño propuesto

- Sidebar: sección Proyectos con carpetas, expandible para mostrar sus chats; acción de conectar carpeta y menú por proyecto. Tomar la organización de la captura de referencia, conservando los colores de Sparta.
- Compositor: nombre corto de la carpeta y estado legible. Sustituir `RW` por una descripción disponible mediante tooltip/menú. Cambiar y desconectar permanecen en ese menú.
- Panel derecho: cabecera con nombre de carpeta; árbol real con directorios expandibles, búsqueda, refresco y apertura de archivos. No mostrar 'Conecta una carpeta' si ya existe selección pendiente.
- Estados: cargando, carpeta vacía, acceso denegado, carpeta movida/eliminada y puente no disponible, con acción de recuperación apropiada.
- Cambiar de conversación actualiza inmediatamente el árbol y cancela lecturas anteriores para impedir que aparezcan archivos del chat anterior.
- Recientes y proyectos muestran las conversaciones del mismo binding, no una copia independiente.

## Política de permisos

No confundir 'acceso total' de herramientas con permiso del sistema operativo ni con acceso a todas las carpetas.

- Si la carpeta ya tiene una autorización vigente suficiente: conectarla sin volver a preguntar.
- Si el usuario elige una carpeta nueva bajo un modo de acceso completo expresamente confirmado: usar esa política dentro de la raíz seleccionada, con indicación visible; no habilitar lectura fuera de ella.
- Si hay una capacidad previa restrictiva: no aumentarla silenciosamente por cambiar el modo de aprobación. La ampliación debe ser una acción explícita.
- Solo lectura bloquea mutaciones también en backend e IPC.
- Editar sin borrar permite operaciones estructuradas admitidas y bloquea borrado y ejecución arbitraria que no pueda garantizar ese límite.
- Fuera de raíz, traversal, enlaces/junctions que escapen, credenciales y rutas protegidas conservan controles independientes.
- Ningún cambio en este plan autoriza por sí solo desactivar autenticación ni protecciones.

## Backend y puente nativo

1. Exponer resolución común por `workspaceId/bindingId`; migrar el explorador desde el contrato exclusivamente por proyecto.
2. Crear o reutilizar el workspace durable en el momento de conectar, incluso antes del primer mensaje. Mantener un borrador explícito asociado a ese workspace.
3. Guardar selección y capacidades en almacenamiento durable. Rehidratar y validar existencia/identidad antes de anunciar estado preparado; no aceptar el path guardado sin validación.
4. Centralizar autorización por sujeto, binding y operación. El backend determina alcance a partir de la conversación; el modelo no suministra su propia raíz ni permisos.
5. Resolver rutas relativas y canónicas en servidor/IPC, incluyendo límites de tamaño y enlaces que escapen de raíz.
6. Listado lazy por nivel, búsquedas acotadas y cancelación. No recorrer `node_modules`, `.git` o binarios de forma masiva por defecto; permitir navegación explícita.
7. Watcher del workspace activo con debounce, eventos acotados y limpieza. Refrescar estado Git sin asumir que toda carpeta es un repositorio.
8. Registrar fallos técnicos sin contenido sensible; devolver errores accionables a la UI.

## Contexto del LLM

- Resolver el binding antes de construir la petición. Si falla la preparación, no fingir que el modelo tiene acceso.
- Incluir identificador lógico, nombre, capacidades y herramientas disponibles; mantener rutas absolutas privadas salvo necesidad explícita.
- El modelo descubre estructura mediante `list_directory` y lee únicamente archivos relevantes mediante herramientas.
- Enviar contenido al proveedor solo cuando sea necesario para la petición y esté dentro de la capacidad concedida; no subir la carpeta completa.
- Separar sandbox remoto de filesystem local. Un sandbox hospedado no ve por sí solo la carpeta del equipo.
- Mantener procedencia de lecturas: ruta relativa, versión/mtime y límites de truncado.
- El contenido de archivos es información no confiable; no debe poder cambiar permisos, raíces ni instrucciones del sistema.

## Orden de implementación

1. Unificar estado del chat y explorador; corregir contradicción visible y mostrar archivos de la conexión actual.
2. Conexión durable previa al primer mensaje y restauración tras reinicio.
3. Política coherente de permisos, sin solicitudes duplicadas ni escaladas implícitas; corregir fallback legacy.
4. Integrar carpetas/chats en sidebar y mejorar árbol, búsqueda y estados de error.
5. Watchers, Git y apertura/edición con estado de modificaciones reales.
6. Verificar el recorrido completo con cada proveedor compatible y regresiones de seguridad.

## Criterios de aceptación

- Conectar carpeta en chat vacío muestra sus archivos sin enviar un mensaje.
- Reiniciar conserva la selección y recupera el estado validado.
- Dos chats con carpetas diferentes nunca cruzan archivos, permisos ni contexto.
- Una carpeta ya autorizada no vuelve a pedir el mismo permiso.
- Solo lectura y sin borrado se respetan por UI, IPC y herramientas del LLM.
- Raíz movida/eliminada, errores de acceso y enlaces externos muestran estados correctos.
- `list_directory`, lectura y búsqueda funcionan con rutas relativas; escrituras bloqueadas no mutan archivos.
- Desconectar retira contexto y herramientas; no borra los archivos del usuario.
- Árbol y Git se actualizan después de una modificación, sin bloquear la interfaz.
- Prueba visual en Windows con panel abierto/cerrado y sidebar expandida/contraída; prueba instalada además del modo desarrollo.

## Archivos principales auditados

- `desktop/frontend-spartan/src/features/chat/components/thread-workspace-chip.tsx`
- `desktop/frontend-spartan/src/features/chat/utils/pending-workspace.ts`
- `desktop/frontend-spartan/src/components/workspace-rail/workspace-panel-container.tsx`
- `desktop/frontend-spartan/src/components/workspace-rail/files-panel.tsx`
- `desktop/frontend-spartan/src/features/chat/api/chat-adapter/prompt-assembly.ts`
- `desktop/frontend-spartan/src/features/chat/api/chat-adapter/stream-orchestrator.ts`
- `desktop/frontend-spartan/src/features/chat/permission-mode-select.tsx`
- `desktop/backend-spartan/routes/chat/router_workspaces.py`
- `desktop/backend-spartan/state/thread_workspace.py`
- `desktop/backend-spartan/core/inference/tools.py`
- `desktop/ia-sparta-ipc-bridge/src/channels/filesystem.channel.ts`
