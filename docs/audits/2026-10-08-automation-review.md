# Automatizaciones: revisión del comportamiento real

Fecha: 2026-10-08. Referencia: `docs/channels/plan-automatizaciones-chat-canales-2026-10-07.md`.

## Causa principal encontrada

Antes de esta corrección, `core/inference/task_scheduler.py` llamaba únicamente a `preview_task`: 90 segundos, 3000 tokens y 24000 caracteres, con todas las herramientas desactivadas. El proyecto aportaba instrucciones sin acceso a archivos. Esto sigue siendo el comportamiento del modo explícito de texto y de las tareas antiguas, pero ya no del nuevo modo agente.

La revisión ampliada encontró un bucle compartido en el backend (`core/inference/studio_tool_loop.py`), además del orquestador del frontend. El adaptador de automatizaciones ahora usa ese bucle con `OAICompatTransport` y un ejecutor acotado por tarea, sin modificar las herramientas globales. La cola manual `work_runs` conserva su contrato existente.

## Correcciones realizadas

- Guardar una edición desde la interfaz ya no envía `enabled: false`. Se conserva el estado activo; la acción de pausar sigue siendo explícita.
- El API permite conservar una tarea activa al editarla, pero rechaza activar una tarea pausada mediante PATCH. La activación sigue exigiendo la selección de proveedor y modelo por su ruta específica.
- La fecha semanal se calcula con los días, la hora y la zona horaria efectivos. Modificar cualquiera de estos valores recalcula la próxima ejecución; una edición del título mantiene la fecha pendiente.
- Modo agente con permisos explícitos: consulta de sitios públicos, listado y lectura de documentos del proyecto y creación de informes TXT, MD, CSV, TSV y JSON. El lector reutiliza los parsers de PDF, DOCX, XLSX, PPTX, ODT, RTF, EPUB y texto/tablas. No genera documentos binarios de Office ni ejecuta comandos, sobrescribe o elimina archivos.
- La activación fija la carpeta real y su identidad de sistema de archivos; cada operación vuelve a validar el proyecto y la autorización. Se rechazan rutas absolutas, recorrido al padre, enlaces, junctions y archivos con múltiples enlaces físicos. Cambiar proyecto o capacidades pausa el horario y requiere reactivación; no se amplían permisos antiguos de forma implícita.
- La prueba de agente reutiliza el adaptador, crea un chat propio y no mueve el horario pendiente. Historial y chat muestran progreso y un registro de los resultados reales de las herramientas.
- Cancelación por propietario desde historial y chat; no se puede completar posteriormente una ejecución cancelada. Heartbeat cada dos segundos independiente del texto. Hasta tres tareas simultáneas para evitar que una ejecución larga bloquee las demás. El agente tiene un límite total de diez minutos, doce llamadas y 100000 caracteres de respuesta; las consultas públicas conservan sus límites existentes.

## Orden de implementación pendiente

1. Selección explícita del destino de Telegram cuando existan varios bots. Actualmente el destino personal se elige sólo cuando existe uno único; no se debe seleccionar uno arbitrario.
2. Abrir el chat concreto al pulsar la notificación nativa; el plan registra que actualmente sólo enfoca la aplicación.
3. Ejecución con la aplicación cerrada: requiere un servicio persistente; el programador actual vive con el proceso del backend.
4. Ampliar las capacidades de generación de documentos y las tarjetas visuales de eventos, manteniendo permisos verificables.

## Alcance de esta revisión

Se probaron operaciones reales de archivos temporales y el flujo completo de claim programado → herramienta → informe creado → resultado persistido en chat, con proveedor simulado. Las pruebas comprueban revocación, confinamiento, cancelación, aislamiento de propietario, recuperación y herramientas comunes del chat. No se enviaron mensajes reales de Telegram ni se modificó la instalación antigua del escritorio. Para utilizar este código se debe ejecutar la versión actual del frontend y reiniciar su backend.

Validación final: 73 pruebas aprobadas en los módulos de automatizaciones, calendario, entregas, vista de texto y bucle compartido; TypeScript de frontend y shell y paridad de traducciones aprobados. Compilación de producción de frontend, Electron main y preload completada. Persisten las advertencias de chunks grandes y reexportaciones/importaciones mixtas existentes. No se realizó una revisión visual de la aplicación instalada en esta fase.
