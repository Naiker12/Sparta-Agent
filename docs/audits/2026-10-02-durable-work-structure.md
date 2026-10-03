# Primera parte: estructura para trabajo persistente en Sparta

Fecha: 2026-10-02. Revisión estática del código actual. Este documento concreta la primera etapa de la [auditoría funcional](./2026-10-02-sparta-openbot-functional-audit.md). Describe una propuesta; no afirma que la integración esté implementada.

## 1. Estructura existente

| Carpeta | Responsabilidad | Papel en esta etapa |
| --- | --- | --- |
| `desktop/frontend-spartan` | Interfaz React, chat, proyectos y configuración | Mostrar cola y estado recuperados del backend |
| `desktop/backend-spartan` | API Python, inferencia, herramientas y almacenamiento | Conservar ejecuciones y validar transiciones |
| `desktop/ia-sparta-app-shell` | Shell de escritorio | Revisar ciclo de vida antes de prometer trabajo con la ventana cerrada |
| `desktop/ia-sparta-ipc-bridge` | Contratos de comunicación de escritorio | Usar solamente si hacen falta operaciones nativas |
| `landing` | Web pública y demo | Consumidor posterior; no debe gobernar las tareas reales |
| `docs` | Documentación y auditorías | Contratos, decisiones y evidencias de validación |
| `skills` | Procedimientos disponibles | Integración posterior, una vez estable el núcleo |

Las carpetas de compilación, dependencias y resultados no son el lugar para implementar esta función. No se necesita reorganizar todo el repositorio para introducirla.

## 2. Archivos que ya resuelven parte del problema

| Archivo | Qué contiene | Decisión |
| --- | --- | --- |
| [prompt-queue-manager.ts](D:/sparta-agent/desktop/frontend-spartan/src/components/assistant-ui/thread/prompt-queue-manager.ts) | Despacho secuencial, reintentos, orden y estructuras `Map`/`Set` en memoria | Conservar comportamiento; introducir un adaptador persistente gradualmente |
| [prompt-queue-types.ts](D:/sparta-agent/desktop/frontend-spartan/src/components/assistant-ui/thread/prompt-queue-types.ts) | Targets con callbacks, temporizadores y estado de ejecución | Separar datos serializables de funciones de la sesión |
| [prompt-queue-ui-store.ts](D:/sparta-agent/desktop/frontend-spartan/src/features/chat/stores/prompt-queue-ui-store.ts) | Proyección Zustand para mostrar ítems y progreso | Mantenerlo como vista; el estado durable debe tener autoridad en backend |
| [prompt-queue-stack.tsx](D:/sparta-agent/desktop/frontend-spartan/src/components/assistant-ui/thread/prompt-queue-stack.tsx) | Superficie existente de la cola | Revisar su contrato antes de añadir otra pantalla |
| [memory_tasks.py](D:/sparta-agent/desktop/backend-spartan/storage/studio/memory_tasks.py) | CRUD de tareas, programación e historial | Mantener tareas programadas; vincular sus futuras ejecuciones al núcleo común |
| [task_scheduler.py](D:/sparta-agent/desktop/backend-spartan/core/inference/task_scheduler.py) | Bucle de automatizaciones y cálculo de ocurrencias | Adaptarlo después de validar el almacenamiento; no habilitar herramientas automáticamente |
| [task_preview.py](D:/sparta-agent/desktop/backend-spartan/core/inference/task_preview.py) | Ejecución acotada de automatizaciones de texto | Preservar sus límites durante la transición |
| [tasks.py](D:/sparta-agent/desktop/backend-spartan/routes/tasks.py) | API autenticada de tareas y pruebas | Mantener compatibilidad y aislamiento por propietario |
| [research_runs_db.py](D:/sparta-agent/desktop/backend-spartan/storage/research_runs_db.py) | Transacciones, estados, eventos y comprobaciones de lease | Referencia para concurrencia y recuperación; no convertir investigación en motor genérico de golpe |
| [research_runs.py](D:/sparta-agent/desktop/backend-spartan/core/research_runs.py) | Coordinación del trabajador de investigación, recuperación y cancelación | Revisar límites reutilizables sin trasladar dependencias específicas de investigación |
| [schema.py](D:/sparta-agent/desktop/backend-spartan/storage/studio/schema.py) | Tablas y evolución del esquema, incluidos `research_runs`, `agent_tasks` y `agent_task_runs` | Añadir tablas mediante evolución compatible de la base existente |
| [connection.py](D:/sparta-agent/desktop/backend-spartan/storage/studio/connection.py) | Apertura de SQLite, claves foráneas y preparación del esquema | Reutilizar conexión y transacciones; verificar configuración real de SQLite |

## 3. Hallazgos que condicionan el diseño

1. **No partimos de cero.** Ya existe persistencia para automatizaciones e investigaciones. Falta un contrato común para el trabajo encolado del chat.
2. **La cola actual no se puede serializar tal cual.** Sus targets incluyen `append`, `cancel`, funciones para consultar conversaciones y temporizadores. Debemos persistir identificadores y datos; reconstruir los callbacks al conectar la interfaz.
3. **Guardar pendiente no prueba que una acción terminó.** Tras una desconexión, una llamada puede haber modificado archivos aunque la interfaz no recibiera la respuesta. Ese caso necesita reconciliación, no reenvío automático.
4. **Las preferencias importan por ítem.** Proyecto, conversación, modelo, proveedor y permisos deben quedar definidos para cada solicitud; revisar los utilitarios `queued-*` antes de congelar el contrato.
5. **Temporal debe seguir significando temporal.** La primera integración debe excluir conversaciones temporales de la recuperación durable o establecer una política explícita antes de guardar contenido.
6. **Ventana cerrada y proceso apagado son situaciones distintas.** La persistencia conserva trabajo; no garantiza ejecución con el backend detenido.

## 4. Estructura propuesta, todavía sin crear estos módulos

```text
desktop/backend-spartan/
  storage/studio/schema.py        # evolución compatible del esquema
  storage/work_runs_db.py         # registros, eventos, transiciones y reclamación
  core/work_runs.py               # coordinación independiente del tipo de trabajo
  routes/work_runs.py             # API autenticada del núcleo
  tests/test_work_runs_storage.py # recuperación, aislamiento e idempotencia

desktop/frontend-spartan/src/features/work/
  api/work-runs-api.ts            # contrato cliente del backend
  types.ts                       # datos serializables
  stores/work-runs-store.ts       # proyección sincronizada de la interfaz
  adapters/prompt-queue.ts        # integración con la cola existente
```

Los nombres son una propuesta. Primero se fijarán los contratos y límites; después se crearán los módulos necesarios. La bandeja visual puede incorporarse cuando la recuperación esté probada.

### Datos mínimos que debemos definir

| Entidad | Contenido | Regla |
| --- | --- | --- |
| Ejecución | ID, propietario, origen, conversación/proyecto, estado, fechas | Todas las operaciones comprueban propietario |
| Solicitud | Objetivo, configuración de proveedor/modelo, permisos, referencias | Sin credenciales ni callbacks almacenados |
| Intento | ID de intento, ejecutor, inicio/fin, resultado | Diferenciar un reintento de una solicitud nueva |
| Evento | Secuencia, tipo, fecha y datos acotados | Orden estable y transición atómica |
| Acción pendiente | Tipo, referencia y resultado conocido/desconocido | Una acción incierta no se repite a ciegas |

Estados iniciales propuestos: `queued`, `running`, `awaiting_approval`, `paused`, `completed`, `failed`, `cancelled`, `needs_review`. Pausa y cancelación deben definir qué sucede con la llamada en curso; no basta con cambiar la etiqueta.

## 5. Orden de trabajo paso a paso

| Paso | Trabajo | Resultado para revisar |
| --- | --- | --- |
| **1 — completado en esta revisión** | Localizar estructura, persistencia y cola existente | Este mapa y sus decisiones iniciales |
| **2 — siguiente** | Revisar contratos de chat, autenticación, configuración encolada y ciclo de vida | Contrato definitivo de ejecución y recuperación |
| 3 | Implementar almacenamiento y migración compatible | Pendientes recuperables y transiciones atómicas con pruebas |
| 4 | Añadir API autenticada | Listar, crear y actualizar sin acceso entre propietarios |
| 5 | Integrar cola actual detrás de un adaptador | Mantener edición, orden, cancelación y configuración por ítem |
| 6 | Diseñar y conectar bandeja de trabajo | Estados reales con abrir conversación y revisar incidencias |
| 7 | Conectar automatizaciones gradualmente | Resultado trazable y ninguna ampliación implícita de permisos |

### Validación necesaria antes de avanzar a la interfaz

- Reiniciar con trabajo pendiente conserva los datos y el orden.
- Dos trabajadores no reclaman simultáneamente la misma ejecución.
- Repetir una solicitud con la misma clave de idempotencia no crea duplicados; cambiar su contenido devuelve conflicto.
- Cancelar una pendiente evita su despacho; cancelar una activa conserva la evidencia de lo ya ejecutado.
- Reiniciar durante una acción con efectos inciertos marca revisión requerida.
- Un propietario no puede listar ni modificar ejecuciones ajenas.
- Migrar una base existente conserva chats, memorias y automatizaciones.
- Editar o reordenar pendientes no cambia la configuración de una ejecución activa.

## 6. Alcance de esta entrega

Se ha analizado la estructura y escrito el mapa de integración. No se ha modificado el motor de chat ni creado una bandeja funcional. Antes de implementar, el paso 2 debe resolver el vínculo entre mensaje, solicitud, intento y resultado, además del tratamiento de chats temporales y del cierre del backend.

## 7. Avance de implementación posterior al mapa inicial

Se implementó una primera entrega de los pasos 2–4: registro durable y API de solicitudes independientes. La vinculación con chat/proyecto y el adaptador del paso 5 siguen pendientes. Los nombres propuestos se ajustaron para mantener responsabilidades pequeñas:

| Módulo implementado | Responsabilidad |
| --- | --- |
| [work_requests.py](D:/sparta-agent/desktop/backend-spartan/core/work_requests.py) | Contratos versionados y validación estricta; selección de modelo y permisos; rechaza credenciales estructuradas y campos desconocidos |
| [work_runs_schema.py](D:/sparta-agent/desktop/backend-spartan/storage/work_runs_schema.py) | Tablas e índices aditivos de ejecuciones y eventos |
| [work_runs_db.py](D:/sparta-agent/desktop/backend-spartan/storage/work_runs_db.py) | Repositorio transaccional con conexión y reloj inyectables |
| [work_runs.py](D:/sparta-agent/desktop/backend-spartan/routes/work_runs.py) | API autenticada, dependencias sustituibles y errores HTTP consistentes |
| [test_work_runs_storage.py](D:/sparta-agent/desktop/backend-spartan/tests/test_work_runs_storage.py) | Persistencia, FIFO, concurrencia, recuperación, transacciones y esquema completo |
| [test_work_runs_api.py](D:/sparta-agent/desktop/backend-spartan/tests/test_work_runs_api.py) | Autenticación, aislamiento, contratos, conflictos y paginación |

### Contrato disponible

- `POST /api/work-runs`: crear solicitud con clave de idempotencia por propietario.
- `GET /api/work-runs`: listar solicitudes del usuario autenticado.
- `GET /api/work-runs/{id}`: consultar una ejecución propia.
- `GET /api/work-runs/{id}/events?after=N`: consultar eventos posteriores a una revisión.
- `POST /api/work-runs/{id}/actions`: pausar/reanudar pendientes o cancelar trabajo no activo, con revisión esperada.

La API inicial admite origen `manual`, proveedor/modelo de referencia y permisos explícitos. No admite todavía referencias de chat/proyecto ni configura inferencia: el registro no valida disponibilidad del proveedor. Los permisos almacenados describen intención; no conceden acceso a herramientas. No hay ejecutor ni consumidor frontend conectado a esta API.

Las operaciones internas de reclamar, finalizar, renovar lease y recuperar no son endpoints públicos. Una ejecución interrumpida pasa a `needs_review`, sin reenvío automático. Pausar o cancelar una activa devuelve conflicto: la interrupción cooperativa del proveedor requiere la integración del ejecutor, todavía pendiente.

### Clean Code y SOLID aplicados

- Esquema, contratos, almacenamiento y transporte tienen responsabilidades separadas.
- El repositorio recibe conexión y reloj: las pruebas usan SQLite real y tiempo controlado sin importar inferencia.
- La API recibe el repositorio mediante inyección de dependencias.
- Las transacciones conservan cambio de estado y evento juntos; la reclamación usa `BEGIN IMMEDIATE`.
- No se introdujo una jerarquía de proveedores o abstracciones sin consumidores reales.

### Validación ejecutada

**42 pruebas dirigidas aprobadas**, incluidas las regresiones de tareas programadas y preview. Se validaron también compilación Python y whitespace de los archivos existentes modificados.

```powershell
cd D:/sparta-agent/desktop/backend-spartan
.\.venv\Scripts\python.exe -m pytest --noconftest tests/test_work_runs_storage.py tests/test_work_runs_api.py tests/test_tasks_redesign.py tests/test_task_preview.py -q --tb=short
```

Limitación del entorno: la ejecución normal de pytest se bloqueó en el fixture global de `tests/conftest.py`, que importa el módulo ausente `core.inference.diffusion_prequant`. `--noconftest` permite ejecutar este grupo independiente sin ese fixture; no equivale a haber aprobado toda la suite. Se mantuvo sin modificar la configuración ajena a este bloque. FastAPI TestClient emite además un aviso de deprecación de su transporte `httpx`.

### Siguiente integración concreta

Definir y verificar la vinculación atómica de propietario, conversación y proyecto; capturar la configuración completa de la cola; conservar edición y orden de pendientes; introducir el adaptador frontend y la interrupción cooperativa del ejecutor. Después conectar la bandeja visual y comprobar el recorrido de escritorio con reinicio. Esta entrega todavía no hace persistente la cola actual del chat.

### Actualización posterior: cola del chat conectada

El adaptador y la recuperación explícita de pendientes ya se implementaron en la entrega siguiente. Véase [Paso 5: persistencia de la cola del chat](./2026-10-02-prompt-queue-persistence.md) para el comportamiento, archivos, validación y límites actuales. El registro genérico todavía no recibe los intentos de cada turno; la bandeja global y la interrupción cooperativa siguen pendientes.
