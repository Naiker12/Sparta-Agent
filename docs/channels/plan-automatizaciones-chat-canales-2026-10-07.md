# Automatizaciones visibles, proyectos y avisos — 7 de octubre de 2026

## Objetivo

Al llegar la hora, Sparta crea un chat de ejecución, muestra el trabajo en tiempo real y conserva su resultado. Si la automatización pertenece a un proyecto, el chat queda vinculado a ese proyecto y a su carpeta autorizada. Envía un aviso inicial y uno final al destino conectado configurado para esa automatización. La interfaz permite abrir el chat desde la automatización, el historial y la notificación.

## Diagnóstico verificado en código

| Área | Comportamiento actual | Cambio requerido |
|---|---|---|
| Identidad de Windows | Ventana con PNG de Sparta, proceso de desarrollo `electron.exe`; sin AppUserModelID explícito | Identidad `com.sparta.agent`, nombre Sparta Agent y acceso directo con icono para desarrollo; instalador mantiene identidad de producción |
| Notificación | `native-notifications.ts` usa Notification del navegador sin icono | Icono explícito y registro de identidad; posteriormente navegación al chat al pulsar |
| Programación | `main.py` inicia `scheduler_loop`; consulta vencimientos cada 5 segundos mientras el backend está abierto | Mantener funcionamiento real documentado; no prometer ejecución con equipo apagado |
| Ejecución | `task_scheduler.py` usa `preview_task` | Sustituir para ejecuciones automáticas por un trabajador de agente vinculado a chat |
| Herramientas | `task_preview.py` prohíbe herramientas, navegación y archivos; límite 90 s, 3000 tokens y 24000 caracteres | Mantener prueba rápida de texto; crear ejecución de agente con capacidades explícitas |
| Chat | Se conserva `threadId` en tareas, pero el scheduler no lo usa | Nuevo chat por ejecución y vínculo de origen separado |
| Proyecto | TaskInput no contiene `projectId` ni política de carpeta | Guardar referencia a proyecto y comprobar sus permisos al ejecutar |
| Progreso | El scheduler acumula texto y guarda salida final | Persistir eventos y transmitirlos al chat sin depender de que esté abierto |
| Avisos | Frontend consulta `/api/tasks/notifications` cada 10 s; solo eventos finalizados | Eventos de inicio y fin y entrega backend independiente del frontend |
| Canales | No hay destinatario de entrega en el contrato de tareas | Destino concreto por cuenta y usuario/chat autorizado, con política inicio/fin |
| Recuperación | Claim transaccional; ejecuciones running de más de 120 s se marcan interrumpidas | Lease y heartbeat para tareas largas; recuperación sin duplicar acciones |

Las pantallas anuncian que se ejecuta mientras la aplicación está abierta. El aviso «Automatización completada» solo confirma la consulta actual; no demuestra que se haya realizado trabajo sobre un proyecto.

## Corrección inmediata aplicada

`desktop-identity.ts` establece nombre y AppUserModelID antes de crear la ventana. En desarrollo registra un acceso directo independiente con icono de Sparta; en producción el instalador ya utiliza `com.sparta.agent`. Las notificaciones del renderer incluyen el PNG de Sparta. Requiere iniciar nuevamente el proceso de Electron para aplicar la identidad a Windows. Las notificaciones antiguas y los accesos anclados anteriormente pueden conservar la identidad anterior.

La prueba con Electron real `output/channels/desktop-identity-smoke.mjs` pasa: comprueba el nombre, el AppUserModelID del acceso directo, que Windows/Electron pueda leer su icono y que cambiar el nombre no cambie la carpeta de datos del usuario. No sustituye la revisión visual de una notificación nueva en la sesión del usuario.

## Flujo propuesto

1. El usuario configura nombre, instrucciones, horario, zona horaria, proyecto opcional, proveedor/modelo, capacidades y destino de avisos. Antes de activar ve la siguiente fecha real y un resumen de qué puede hacer.
2. Al vencer, el scheduler reclama una ocurrencia mediante una clave única `(automationId, scheduledAt)`. Crea run y chat en una transacción. No reutiliza el chat que el usuario está escribiendo.
3. Se guarda el mensaje de instrucciones y el contexto de la automatización. Se vinculan `projectId` y la carpeta mediante el contrato de workspace ya existente en `chat_threads.py`; una ruta escrita en el prompt no concede acceso.
4. Se publica `run.started` con la hora programada y la hora efectiva. El chat aparece en la lista sin robar el foco. Automaciones muestra «En curso» y «Abrir chat».
5. El trabajador usa el motor de conversación y herramientas existente: transmite deltas y eventos de herramientas, persiste checkpoints, aplica límites y admite cancelación. El acceso al proyecto se verifica antes de cada operación sensible.
6. Se persiste un estado terminal y un resumen con referencias a resultados. El chat permanece navegable; cada repetición tiene su propio chat.
7. El backend entrega el aviso final. Un fallo de Telegram queda como fallo de entrega y permite reintentar el aviso sin ejecutar otra vez la tarea.

## Contrato de datos

- Automation: `id`, propietario, instrucciones, horario/zona, `projectId?`, `originThreadId?`, proveedor/modelo, política de capacidades, política de avisos y destino autorizado.
- Run: `id`, automationId, scheduledAt, startedAt, finishedAt, estado, threadId, projectId, snapshot de configuración, heartbeat/lease, resumen y error saneado.
- Event: runId, número de secuencia, tipo, hora y carga; reanudación desde cursor. Separar texto del asistente, herramientas y estados.
- Delivery: runId, evento inicio/fin, canal/cuenta/destinatario, intentos, estado, próxima fecha de reintento y receipt remoto. Unicidad por run/evento/destino.

Reutilizar el libro de trabajo `work_runs` y el almacén de chats donde sus contratos encajen; evitar un segundo sistema de estados contradictorio. Revisar migración de las tareas existentes: mantener resultados históricos y no convertir consentimientos actuales de texto en autorización automática para escribir archivos.

## Avisos por Telegram y otros canales

La configuración muestra el destino efectivo, no «todos los canales conectados». Para una automatización creada desde Telegram puede proponerse su usuario/chat de origen, validado con la cuenta y permisos actuales. Para una creada en escritorio se propone la cuenta personal vinculada y se permite cambiarla. Si no hay destino autorizado, se conserva el aviso en Sparta y se muestra «Sin destino de canal».

Inicio: «Comienza: Resumen del proyecto. Programada: 09:00 America/Bogota. Inicio: 09:00. Proyecto: MediaDock. Ejecución: …».

Fin: «Terminó: Resumen del proyecto. Estado: Completada. Duración: … Resultado: … Abrir ejecución: …».

El mensaje final distingue completada, fallida, cancelada y necesita atención. No incluye credenciales ni rutas privadas. La tarea declara si permite incluir el resumen en el canal. Revalidar el destino al entregar: si se revoca el usuario o se desconecta el bot, no enviar a otro destinatario como alternativa automática. Usar outbox persistente, reintentos con demora, deduplicación y diagnóstico de entrega.

## Interfaz

- Editor con bloques Horario, Trabajo y proyecto, Ejecución, Avisos. Zona horaria visible y fechas próximas antes de activar.
- Historial por ocurrencia: estado, fecha, duración, proyecto, «Abrir chat» y estado de entrega separado.
- Chat con encabezado de automatización, hora y proyecto, progreso normal del agente, cancelación y resultado. Al reabrir reconstruye el historial y continúa desde el cursor.
- Lista de proyecto incluye los chats de sus automatizaciones. Los chats generales permanecen separados de los proyectos.
- Notificación de escritorio abre la ejecución concreta; evitar texto genérico «Consulta el resultado en Automatizaciones» cuando ya exista un chat.
- Prueba rápida permanece identificada como consulta sin herramientas; una prueba de agente requiere el mismo alcance que una ejecución real.

## Fases y criterios de aceptación

1. **Identidad de escritorio (corrección inmediata):** nombre, AppUserModelID, icono y shortcut de desarrollo. Verificar en Windows después del reinicio; validar también instalación limpia y actualización.
2. **Modelo y chat:** migraciones y creación atómica, proyecto opcional y chat por ocurrencia. Dos claims simultáneos crean una sola ejecución/chat. La recurrencia crea chats distintos.
3. **Trabajador y progreso:** reutilizar motor del chat, SSE autenticado o canal de eventos existente, checkpoints y cancelación. Cerrar la vista no detiene la ejecución. Reconectar no duplica mensajes. Tarea de más de dos minutos no se interrumpe por el umbral antiguo.
4. **Proyectos:** conexión a carpeta e instrucciones/contexto con permisos vigentes. Proyecto borrado o acceso revocado produce estado comprensible. Probar archivos indexados y no indexados mediante herramientas autorizadas, sin fingir acceso.
5. **Entrega:** outbox de inicio/fin; Telegram primero, adaptador reutilizable para otros canales. Simular red caída, bot desconectado, usuario revocado, rate limit y reinicio entre envío y confirmación; no repetir el trabajo.
6. **Experiencia y pruebas completas:** programar tarea única a pocos minutos, observar chat en tiempo real, comprobar ambos avisos y abrir su resultado. Repetir dentro de proyecto, cancelar, provocar error de proveedor y reiniciar durante ejecución.

También probar cambios de hora/DST, equipo dormido, ocurrencias atrasadas y varias tareas. Mantener una política explícita de coalescencia: al reabrir ejecutar como máximo una ocurrencia atrasada por tarea, mostrando su retraso; no lanzar una avalancha. La futura ejecución con la aplicación cerrada exige un servicio persistente y es una fase distinta.

## Referencias e ideas investigadas

[Electron: notificaciones](https://github.com/electron/electron/blob/main/docs/tutorial/notifications.md) y [Microsoft: identidad de toast](https://learn.microsoft.com/en-us/windows/win32/shell/enable-desktop-toast-with-appusermodelid) explican la relación entre AppUserModelID y el acceso directo de Windows.

[OpenClaw: ejecución de automatizaciones](https://docs.openclaw.ai/automation/cron-jobs/how-it-works) y [entrega](https://docs.openclaw.ai/automation/cron-jobs/delivery) sirven de referencia para sesiones aisladas, procedencia del run y entrega vinculada a su ejecución. La propuesta de Sparta adapta esas ideas al almacén de chats/proyectos existente; no supone que sus mecanismos estén implementados aquí.

## Alcance entregado

La primera entrega introdujo ajustes de identidad/icono; la captura posterior confirmó que eran insuficientes en Windows. La continuación implementa los siguientes cambios:

- Creación transaccional de un chat por ejecución programada, con mensajes iniciales y referencia al proyecto opcional. Las repeticiones generan chats distintos.
- Checkpoints de texto cada 500 ms, lectura del chat en vivo cada segundo y actualización del historial de la automatización cada dos segundos. El historial conserva resultados parciales y errores. Los mensajes de ejecución se protegen frente a sincronizaciones antiguas y edición/borrado individual.
- Selector de proyecto y «Abrir chat» en cada ejecución. Se usan las instrucciones guardadas del proyecto, con un aviso explícito de que esta etapa todavía no lee/modifica sus archivos.
- Eventos de inicio y fin para avisos en Sparta y actualización de la lista de chats. Se preserva proveedor/modelo/consentimiento al editar una tarea.
- Cola persistente de avisos a Telegram, con destino personal del propietario cuando hay exactamente un bot activo vinculado. El final conserva el mismo destinatario del inicio. Se revalidan cuenta, propietario y permisos al enviar. Con varios bots no se elige uno al azar; falta la selección explícita de destino.
- Mensajes de canal con nombre de tarea, hora/zona, proyecto cuando existe, duración al terminar y referencia de ejecución. No se envía el prompt ni el resultado privado completo.
- Trabajador de entrega independiente. Rate limits esperan y reintentan hasta tres intentos; una entrega ambigua queda sin confirmar y no se reenvía automáticamente. La interfaz muestra el estado de cada aviso separado del estado de la tarea.
- Recuperación mediante heartbeat, preservación de texto al interrumpir y correcciones de importación de `os` y clases duplicadas de excepción en el almacenamiento de chats.

Verificación: 24 pruebas específicas de automatizaciones/chat/entrega/programación/consulta pasan con `--noconftest`; la suite normal mantiene el bloqueo compartido de difusión descrito anteriormente. La compilación y paridad de traducciones pasan. La prueba con navegador `output/channels/automation-live-smoke.mjs` utiliza los componentes reales y una API simulada: observa texto incremental en Automatizaciones, abre el chat real y verifica la actualización final sin recargar. Captura en `output/channels/automation-live-chat.png`. Los envíos Telegram se probaron con transporte simulado, sin enviar avisos de prueba a personas.

La revisión ampliada del historial tuvo 52 pruebas correctas y una expectativa fallida sobre monkeypatch de la fachada del exportador; se excluyeron tres pruebas antiguas que esperan funciones privadas ya no exportadas por esa fachada. ESLint de los componentes de Automatizaciones no presenta errores y mantiene dos advertencias de refs en la limpieza de solicitudes.

Pendientes concretos: motor de agente con herramientas y permisos de carpeta, archivos no indexados, selección de destinatario cuando existen varios bots, otros canales cuando estén implementados, apertura de ejecución desde la notificación nativa, cancelación desde el chat y ejecución con la aplicación cerrada. El límite actual de la consulta de texto sigue siendo 90 segundos. Se requiere reiniciar el backend para cargar la migración y los trabajadores actualizados.


## Corrección de avisos repetidos e identidad de Windows

La consulta solapaba el último milisegundo, pero los IDs mostrados solo vivían en memoria. Recargar reproducía el último aviso completado. Ahora el registro por cuenta guarda la marca temporal y los IDs de ese instante antes de mostrar el aviso. La migración omite el evento antiguo ya completado. Se mantiene respaldo en memoria cuando el almacenamiento está bloqueado.

La identidad se configura antes de app.whenReady(). La ventana recibe setAppDetails con AppUserModelID, ICO, nombre y comando de reapertura. Las notificaciones Electron pasan por un IPC limitado a la ventana principal y su origen, con validación de tamaño y deduplicación adicional. Pulsar el aviso enfoca Sparta.

Verificación: cuatro pruebas del registro, TypeScript y compilación del frontend pasan. La prueba Electron valida nombre, acceso directo de desarrollo, icono legible y conservación de datos. Falta comprobar visualmente el encabezado del toast y el icono de la barra de tareas; comprobar propiedades no demuestra el resultado visual.

La ventana abierta ejecuta Electron del repositorio. El acceso directo C:/Users/gomez/Desktop/Sparta Agent.lnk apunta a la instalación C:/Users/gomez/AppData/Local/Programs/sparta-agent/Sparta Agent.exe, fechada el 2 de octubre. Los cambios del repositorio no actualizan ese ejecutable instalado. No se reemplazó la instalación ni su acceso directo.

Referencias: [Electron: detalles de identidad de ventana](https://www.electronjs.org/pt/docs/latest/api/base-window) y [Microsoft: identidad e icono de barra de tareas](https://github.com/MicrosoftDocs/win32/blob/docs/desktop-src/properties/props-system-appusermodel-id.md).
# Continuación del 2026-10-08: motor de agente

El modo agente ya conecta el programador con `studio_tool_loop` y el transporte de proveedores externos. Incluye permisos separados para consulta web y lectura/creación de archivos del proyecto, identidad de carpeta validada de nuevo antes de cada operación, prueba de agente en un chat propio, cancelación desde historial/chat y heartbeat independiente. Las tareas antiguas conservan el modo de texto; cambiar capacidades pausa la programación hasta una nueva activación.

Validación: 73 pruebas relacionadas aprobadas, incluidas creación real de un informe desde una ejecución programada y persistencia de su resultado en chat, consulta pública con transporte simulado, cancelación de un proveedor detenido, confinamiento y permisos, y concurrencia del programador. TypeScript y paridad de traducciones aprobados. No se enviaron mensajes reales de Telegram.

Siguen pendientes el selector explícito de destino cuando hay varios bots, la navegación al chat exacto desde notificaciones nativas y un servicio para ejecutar con la aplicación cerrada. Detalle actualizado: `docs/audits/2026-10-08-automation-review.md`. Las secciones históricas siguientes describen el estado de la fase anterior.

