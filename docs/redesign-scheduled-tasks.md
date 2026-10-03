# Tareas programadas: auditoría y propuesta

Estado: implementación parcial y arquitectura pendiente. 2026-09-30. No eliminar tareas existentes ni tablas de memoria.

Avance: interfaz de lista, búsqueda, filtros, panel lateral de detalle/historial y editor en tres pasos implementados con shadcn/ui. Creación guarda borradores pausados, sin proveedor ni capacidades todavía. API admite PATCH parcial; almacenamiento aísla propietarios y no desplaza la próxima fecha en una edición sin cambios de horario. Tres pruebas de almacenamiento pasan. Pendientes: ejecutor, horarios diarios/semanales con zona persistida, proyecto/modelo/permisos, notificaciones y comprobación visual en la aplicación instalada. Registros legacy sin propietario se conservan pero no se exponen en las consultas de usuarios.

Segundo avance: prueba manual de texto con selección explícita de proveedor API/modelo en el detalle. Envía únicamente el prompt guardado, sin herramientas, archivos ni contexto de chat/proyecto. Usa credenciales guardadas solo desde sesión UI, valida proveedor/modelo en servidor y registra resultado o fallo sin guardar excepciones que pudieran contener secretos. Límite de 90 segundos y 24.000 caracteres; bloqueo transaccional de pruebas simultáneas y recuperación de registros abandonados al reintentar después de 120 segundos. Siete pruebas de almacenamiento/colección y TypeScript pasan. La API impide nuevas activaciones automáticas mientras no exista planificador. No se realizó llamada pagada a un proveedor ni validación visual instalada. La selección de proveedor/modelo es por prueba, todavía no persistida como configuración de la automatización.

## Hallazgos comprobados

- `desktop/frontend-spartan/src/features/tasks/tasks-page.tsx`: creación por intervalo exclusivamente; pausar y eliminar pueden fallar silenciosamente; no configura proyecto, proveedor, permisos ni zona horaria.
- `desktop/backend-spartan/routes/tasks.py`: CRUD autenticado, sin endpoints de ejecución, cancelación o aprobación; PATCH exige un objeto completo.
- `desktop/backend-spartan/storage/studio/memory_tasks.py`: almacenamiento mezclado con memoria. Las consultas aceptan `owner_subject IS NULL` para cualquier usuario. Cada actualización recalcula la próxima ejecución. Una actualización de un ID inexistente puede crear un registro.
- Búsqueda de referencias a `agent_tasks` y `agent_task_runs` en desktop/scripts/tests: no se encontró servicio que reclame tareas vencidas, invoque al agente y registre resultados. La existencia de próximas fechas no demuestra ejecución real.

## Experiencia propuesta

Tercer avance: planificador conectado al lifespan del backend. La activación dedicada exige sesión UI y confirma proveedor/modelo y reutilización de sus credenciales; no se activa por POST/PATCH genérico ni migra permisos de tareas legacy. Ejecuta texto con límites de la prueba manual. Reclamación transaccional, exclusión por tarea, recuperación de registros abandonados, una ocurrencia pendiente al reabrir y próxima fecha semanal calculada con ZoneInfo. La cola es secuencial, por lo que puede retrasarse con muchas tareas. Pausar impide nuevas reclamaciones, no cancela una petición ya iniciada. Notificaciones consultadas desde cualquier ruta de la app, con cursor por usuario y contenido genérico; Tauri y Electron usan sus APIs nativas/Web Notifications. Se solicita permiso al activar y no desde el sondeo. Diez pruebas backend, TypeScript y compilación Python pasan. Pendientes de verificación real: ejecución con proveedor configurado y notificación en Windows instalado. No ejecuta con backend cerrado; no es un servicio Windows ni un agente con herramientas.

Entrada «Automatizaciones», sin etiqueta «Nuevo» permanente. Vista principal de lista compacta, no un lienzo obligatorio de nodos. Filtros: todas, activas, pausadas y requieren atención. Cada fila muestra nombre, proyecto, próxima ejecución local y último resultado. Botón «Nueva automatización».

Detalle en panel lateral: instrucciones, horario, contexto, permisos, últimas ejecuciones y acciones. Crear en cuatro pasos: qué hacer; en qué proyecto y con qué proveedor/modelo; cuándo; revisar permisos y activar. Vista previa de las próximas tres fechas con zona IANA explícita.

Tipos de horario: una vez, diario a una hora, días de semana, semanal e intervalo. No exigir cron al usuario. Canvas opcional futuro para flujos con ramificaciones; no confundirlo con el diagrama de arquitectura.

## Arquitectura propuesta

UI → API validada → base de datos → planificador → cola durable → ejecutor del agente → resultado e historial. Antes de herramientas, una política valida propietario, proyecto, carpeta y capacidades; operaciones que requieren revisión se suspenden esperando aprobación, sin ampliar permisos.

Separar definición de automatización, ejecución y aprobación. Datos de definición: propietario, proyecto, prompt, referencia a proveedor/modelo (sin secretos), horario, zona, estado, política de capacidades, límite de tiempo/coste y política de notificación. Ejecución: fecha prevista, ID único, intentos, estado, inicio/fin, resultado, error y checkpoints cuando sean soportados.

Reclamación atómica con lease; clave única por automatización y fecha prevista para evitar duplicar la planificación. No prometer exactly-once para herramientas externas: usar idempotencia cuando exista y no reintentar automáticamente efectos no idempotentes de resultado incierto. Una ejecución simultánea por automatización inicialmente.

Estados de ejecución: en cola, ejecutando, esperando aprobación, completada, fallida y cancelada. Estados de definición: activa, pausada y archivada.

## Aplicación cerrada

Primera versión local: solo ejecuta mientras el backend está activo; cerrar a la bandeja y terminar la aplicación son situaciones distintas. Equipo dormido/apagado no ejecuta. Mostrar esta limitación y el estado real del servicio. Al reabrir, aplicar una política visible para vencidas: omitir, ejecutar la última o preguntar. No disparar todas las tareas perdidas de golpe. Ejecución independiente futura requiere servicio del sistema o nube y autorización explícita.

## Seguridad y migración

Exportar/resguardar registros antes de reemplazar implementación. Migrar con versionado; las tareas sin propietario no deben asignarse automáticamente al usuario que las encuentre. Presentar revisión local administrativa. No activar registros legacy sin proveedor, contexto y horario verificados. Agrupar por proyecto no concede escritura. Deshabilitar elimina futuras ejecuciones, no los archivos del usuario.

## Orden de implementación

1. Diseño validado y contrato de datos/API.
2. Almacenamiento separado, aislamiento de propietarios y migración revisable.
3. Planificador durable, reclamación, historial y recuperación tras reinicio.
4. Ejecutor conectado al proveedor y herramientas existentes con políticas explícitas.
5. Interfaz de lista/detalle/creación, aprobación y notificaciones.
6. Pruebas funcionales y visuales en instalación real.

## Criterios de aceptación

- Crear/editar/pausar/reanudar no pierde instrucciones ni cambia horarios sin intención.
- Un usuario no ve ni modifica automatizaciones de otro.
- Dos procesos no reclaman la misma ejecución simultáneamente.
- Reinicio, suspensión, zona horaria y cambios de horario estacional tienen comportamiento probado.
- Falta de API, red, carpeta o aprobación aparece como estado accionable, no éxito falso.
- Lectura/escritura/eliminación respetan capacidades durante toda la ejecución.
- Cancelación detiene nuevas acciones y conserva historial.
- Pruebas con reloj controlado, proveedores falsos y herramientas idempotentes; prueba real opcional con consentimiento para coste/envío de datos.

## Referencias

- n8n Schedule Trigger: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.scheduletrigger/
- LangGraph durable execution: https://docs.langchain.com/oss/python/langgraph/durable-execution
- LangChain human-in-the-loop: https://docs.langchain.com/oss/python/langchain/human-in-the-loop

Estas referencias orientan el diseño; no implican instalar n8n o LangGraph ni disponer ya de sus garantías.
