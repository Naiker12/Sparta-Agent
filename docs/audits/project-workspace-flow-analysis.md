# Análisis del flujo de proyectos y carpetas conectadas

Fecha: 2026-08-27

## Diagnóstico principal

El comportamiento mostrado en las capturas **no es un fallo de la base de datos ni de la carpeta seleccionada**. Es un fallo de flujo y estado de interfaz:

1. En el diálogo **Crear proyecto**, seleccionar una carpeta solo ejecuta `setWorkspacePath(folder)` en el estado local del componente.
2. Esa selección todavía no tiene un proyecto al que pertenecer; por tanto, no se guarda en backend.
3. Al cerrar el diálogo, `close()` llama a `reset()` y `reset()` ejecuta `setWorkspacePath(null)`.
4. Como el proyecto no se creó, nunca se ejecuta `setChatProjectWorkspace(project.id, workspacePath)`.
5. La lista continúa mostrando el proyecto existente `test` sin carpeta, correctamente según los datos guardados.

En resumen: el texto “Se guardará al crear el proyecto” es técnicamente cierto, pero el flujo resulta confuso porque permite elegir una carpeta antes de que exista el proyecto y después destruye ese borrador al cerrar.

## Flujo actual real

```text
Nuevo proyecto
  └─ Elegir carpeta
       └─ Estado temporal: workspacePath (solo React)
  └─ Escribir nombre + pulsar Crear proyecto
       └─ POST proyecto → devuelve project.id
       └─ PATCH /projects/{id}/workspace con la ruta
       └─ SQLite: chat_projects.connected_folder_path
       └─ UI actualiza lista y vista del proyecto

Si se cierra antes de Crear:
  └─ reset() borra nombre, carpeta y fuentes
  └─ No hay PATCH, no hay persistencia, no hay proyecto asociado
```

## Qué debe hacer el flujo correcto

La carpeta debe pertenecer siempre a un proyecto identificado. Hay dos recorridos válidos; el producto debe ofrecerlos explícitamente.

### A. Crear proyecto con carpeta

1. El usuario escribe el nombre obligatorio.
2. Elige opcionalmente una carpeta.
3. Pulsa **Crear proyecto**.
4. La aplicación crea el proyecto y guarda la carpeta como una única operación lógica.
5. Se abre la vista del proyecto mostrando una tarjeta `Carpeta de código → nombre de carpeta → Explorar / Cambiar`.

Regla UX: si se cierra el diálogo antes de crear, no se promete persistencia. Se debe mostrar “La carpeta se guardará al crear el proyecto” y descartar el borrador de forma explícita.

### B. Conectar una carpeta a un proyecto existente

1. El usuario abre la fila o la vista de un proyecto existente.
2. Pulsa **Conectar carpeta**.
3. El selector nativo devuelve una ruta.
4. La aplicación hace inmediatamente `PATCH /projects/{id}/workspace`.
5. La respuesta del backend actualiza la fila y la tarjeta del proyecto sin cerrar ni requerir otro botón Guardar.

Regla UX: aquí no debe haber estado temporal. Tras escoger la carpeta, se guarda o se informa un error claro.

## Problemas concretos a corregir

| Prioridad | Problema | Consecuencia | Corrección recomendada |
| --- | --- | --- | --- |
| Alta | El diálogo permite seleccionar carpeta con el nombre vacío. | El usuario cree que conectó una carpeta, pero no existe un proyecto para guardarla. | Deshabilitar `Conectar carpeta` hasta que el nombre sea válido, o crear primero un borrador persistente con un id. |
| Alta | Al cerrar se borra el estado de carpeta sin una confirmación específica. | Pérdida silenciosa del trabajo seleccionado. | Mantener el descarte solo al cancelar y mostrar confirmación si ya se eligió carpeta/fuentes. |
| Alta | Creación y conexión son dos solicitudes separadas. | Si el PATCH falla, queda un proyecto creado sin carpeta. | Crear el proyecto con `connectedFolderPath` en el mismo POST, validándolo en backend, o compensar/borrar el proyecto si falla el PATCH. |
| Media | La lista muestra `Conectar carpeta`, pero la captura puede recortar las columnas según el ancho de ventana. | La acción parece desaparecer. | Usar una tabla/grid responsiva; en ventana estrecha dejar nombre + estado de carpeta + menú, y ocultar la fecha secundaria. |
| Media | La selección de carpeta es una ruta absoluta y su estado en Electron debe estar aislado por proyecto. | Riesgo de que el explorador/observador apunte al último proyecto abierto. | Pasar `projectId` en las operaciones IPC y mantener una raíz canónica por proyecto/sesión. |
| Media | La vista de proyecto depende de una recarga/evento para reflejar el cambio. | Puede existir un breve estado visual desactualizado. | Devolver el proyecto actualizado desde el PATCH y actualizar la caché/estado local de forma optimista. |

## Archivos del frontend

| Archivo | Responsabilidad actual |
| --- | --- |
| `desktop/frontend-spartan/src/features/chat/components/new-project-dialog.tsx` | Diálogo, borrador local de nombre/carpeta/fuentes; contiene el problema de descarte en `reset()`. |
| `desktop/frontend-spartan/src/features/chat/hooks/use-chat-projects.ts` | Crea proyectos, abre selector nativo y guarda/desconecta la carpeta. |
| `desktop/frontend-spartan/src/features/chat/api/chat-api.ts` | Cliente HTTP; incluye `updateChatProjectWorkspace`. |
| `desktop/frontend-spartan/src/features/chat/projects-page.tsx` | Lista de proyectos, columna Carpeta y menú de acciones. |
| `desktop/frontend-spartan/src/features/chat/chat-page.tsx` | Vista interna del proyecto y tarjeta de carpeta conectada. |
| `desktop/frontend-spartan/src/features/chat/components/workspace-explorer-dialog.tsx` | Explorador de solo lectura de la carpeta conectada. |
| `desktop/frontend-spartan/src/features/chat/api/chat-adapter.ts` | Añade al agente el hecho de que existe un workspace conectado, sin enviar la ruta absoluta. |
| `desktop/frontend-spartan/src/features/chat/types.ts` | Tipo `ProjectRecord`, incluido `connectedFolderPath`. |

## Archivos del backend

| Archivo | Responsabilidad actual |
| --- | --- |
| `desktop/backend-spartan/routes/chat_history.py` | Endpoints de proyectos y `PATCH /projects/{project_id}/workspace`; valida la petición. |
| `desktop/backend-spartan/storage/studio_db.py` | Migración SQLite y lectura/escritura de `chat_projects.connected_folder_path`. |
| `desktop/backend-spartan/state/project_workspace_link.py` | Valida carpetas conectables y resuelve la carpeta activa frente al sandbox. |
| `desktop/backend-spartan/core/inference/tools.py` | Selecciona la carpeta conectada como directorio de trabajo de herramientas del agente. |
| `desktop/ia-sparta-ipc-bridge/src/channels/filesystem.channel.ts` | Operaciones Electron para explorar archivos con límites de workspace. |
| `desktop/ia-sparta-ipc-bridge/src/tools/path-guard.ts` | Defensa contra traversal y symlinks/junctions. |

## Contrato de datos

```text
chat_projects
  id                    identificador del proyecto
  name                  nombre visible
  connected_folder_path ruta absoluta elegida por el usuario, nullable
  root_path/sandbox_path área gestionada de respaldo

API
  POST /projects                         crea proyecto
  PATCH /projects/{id}/workspace         conecta/desconecta carpeta
  GET /projects                          devuelve connectedFolderPath
```

## Implementación recomendada, por fases

1. **Corregir creación atómica:** añadir `connectedFolderPath` al modelo de creación, validarlo y persistirlo con el `POST` de proyecto. El frontend envía nombre + carpeta en una sola solicitud.
2. **Evitar expectativas falsas en el diálogo:** deshabilitar el selector hasta tener nombre, o etiquetarlo como borrador claramente descartable. Confirmar al cancelar si hay carpeta/fuentes ya elegidas.
3. **Actualizar la lista de forma inmediata:** usar la respuesta del POST/PATCH como fuente de verdad para no depender de refrescos posteriores.
4. **Hacer la tabla responsiva:** mantener la carpeta y el menú siempre visibles; reducir/ocultar `Modificado` primero en ancho pequeño.
5. **Aislar Electron por proyecto:** mapear cada `projectId` a una raíz canónica y no usar una única raíz global para explorador/observador.
6. **Pruebas:** crear, cancelar, crear con carpeta, fallo de persistencia, reconexión, dos proyectos con carpetas distintas y reinicio de la aplicación.

## Criterio de aceptación

El flujo estará correcto cuando se cumplan estas condiciones:

- Elegir carpeta y crear proyecto produce un único proyecto con carpeta visible inmediatamente.
- Cerrar antes de crear no deja creer que la carpeta fue guardada.
- Conectar carpeta desde un proyecto existente persiste y aparece sin recargar la app.
- La vista Proyectos y la vista interna muestran el mismo estado de carpeta.
- Dos proyectos distintos nunca comparten accidentalmente explorador, observador ni directorio de herramientas.
