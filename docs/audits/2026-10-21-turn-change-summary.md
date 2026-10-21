# Resumen de archivos modificados por respuesta

Estado: primera implementación completada. El análisis original se conserva debajo; el resultado y los límites están al final.

## Qué representa la captura

La tarjeta muestra tres archivos, un total de +55/-1, estadísticas por archivo y acciones «Ver cambios» y «Deshacer». Es un resumen de operaciones reales sobre archivos, asociado a una respuesta. No debe generarlo el modelo como texto ni aparecer porque el mensaje contiene un bloque de código.

La documentación oficial de Codex distingue el estado general del repositorio de la vista «Last turn», que muestra los cambios de la última intervención. También documenta revisión de diferencias y acciones Git por archivo y bloque. No publica en esa página el algoritmo interno ni el almacenamiento que usa exactamente el botón de esta tarjeta. Lo siguiente es una propuesta para Spartan, no una afirmación sobre internals de Codex.

Fuente: [Documentación oficial de revisión](https://learn.chatgpt.com/docs/code-review?surface=app).

## Qué existe en Spartan

| Archivo | Capacidad actual | Diferencia respecto a la tarjeta |
| --- | --- | --- |
| `desktop/ia-sparta-ipc-bridge/src/lib/workspace-git-review.ts` | Estadísticas `git diff --numstat`, archivos nuevos y diff por archivo; modos working/staged/branch | Estado del repositorio; no identifica por sí solo quién hizo cada cambio ni en qué respuesta |
| `desktop/frontend-spartan/src/features/chat/api/modules/workspace-git-api.ts` | Contratos de listado y lectura del diff; vinculación del workspace autorizado | Falta un alcance persistido por ejecución y operaciones de restauración de ese alcance |
| `desktop/frontend-spartan/src/components/assistant-ui/tool-ui-edit-file.tsx` | Muestra ruta y fragmentos `old_string`/`new_string` de una llamada | Los fragmentos no equivalen al diff neto completo del archivo ni agregan varias herramientas |
| `desktop/backend-spartan/core/inference/tools.py` | Herramientas `edit_file`, `write_file`, `create_file`, Python y terminal; snapshots para detectar archivos producidos | Los snapshots revisados guardan metadatos y, en algunos casos, huellas; no una copia anterior suficiente para deshacer |

No encontré un historial persistente de cambios por respuesta conectado a este flujo que pueda alimentar tanto el resumen como un Deshacer fiable. No basta con añadir la tarjeta sobre el listado Git actual.

## Comportamiento propuesto

1. Al iniciar una ejecución, asociar `runId`, chat, respuesta y raíz canónica del workspace. Registrar el estado anterior necesario antes de que una herramienta modifique archivos.
2. Mientras se ejecutan herramientas, recopilar cambios verificados. El modelo no decide las cifras. Varias ediciones del mismo archivo se agrupan en una sola entrada.
3. Calcular el cambio neto entre el estado inicial y final. Si un archivo vuelve exactamente a su contenido anterior, desaparece del resumen.
4. Al terminar, publicar una tarjeta debajo de la respuesta con número de archivos, total de líneas y filas por archivo. Si falla o se cancela después de escribir, conservar la tarjeta con el estado real de esa ejecución.
5. Guardar la referencia al conjunto de cambios en el historial para recuperarlo al volver a abrir el chat. El diff de una respuesta antigua no se recalcula contra el HEAD actual.

Una respuesta que solo explica código no produce tarjeta. Un archivo guardado como descarga conserva su tarjeta de archivo. Un archivo creado dentro del proyecto pertenece al resumen de cambios; si es HTML puede ofrecer también Vista previa como acción independiente.

## Contenido y acciones

- Encabezado: «Se han modificado 3 archivos», con +N/-N calculados y nombres accesibles para las cifras.
- Filas: ruta relativa completa, estado creado/modificado/eliminado/renombrado y estadísticas. Las rutas largas se truncan visualmente, pero se pueden consultar completas.
- «Ver cambios»: abre el visor con el diff persistido de esa respuesta. Cada fila abre su archivo concreto. El estado global Git sigue disponible como otro alcance claramente identificado.
- «Deshacer»: restaura exclusivamente el conjunto correspondiente. No debe ejecutar `git reset --hard`, limpiar el repositorio ni restaurar todo contra HEAD.
- Si el archivo cambió después, comprobar su huella actual. Bloquear la restauración de ese archivo y mostrar el conflicto, o realizar una combinación segura validada. Nunca sobrescribir silenciosamente cambios posteriores.
- Un archivo creado se elimina al deshacer solo si sigue coincidiendo con la versión registrada. Un archivo eliminado necesita copia anterior. Un renombrado necesita ambas rutas.
- Para binarios, informar tipo/tamaño o estado sin inventar estadísticas de líneas. Habilitar Deshacer únicamente si se conservó una copia válida.

«Ver cambios» debe ser útil aun cuando Deshacer no esté disponible. No mostrar un botón operativo si falta el estado anterior necesario.

## Captura de cambios

La base debe incluir las modificaciones que el usuario ya tenía antes de la respuesta. Por eso, comparar únicamente con HEAD atribuiría al asistente trabajo ajeno y lo revertiría incorrectamente.

Las herramientas directas de escritura pueden registrar el contenido antes de la primera modificación. Para terminal/Python hace falta una estrategia adicional de snapshot inicial limitado y comprobación final, porque pueden escribir sin pasar por `write_file`. Un watcher que avisa después de la escritura no recupera por sí mismo el contenido anterior.

Definir límites de archivos, bytes y retención. Si un límite impide capturar el estado anterior completo, el backend debe informar cobertura parcial y deshabilitar la restauración que no pueda garantizar. No recorrer directorios de dependencias ni `.git` indiscriminadamente. Mantener la validación de rutas, identidad y permisos del workspace también al revisar y restaurar.

No atribuir al turno cambios simultáneos de otros procesos solo por aparecer en un diff final. En sesiones concurrentes sobre la misma raíz, registrar esa incertidumbre y evitar presentar una restauración automática como segura.

## Integración sugerida

| Capa | Trabajo |
| --- | --- |
| Backend | Servicio de conjuntos de cambios, captura antes/después, diff neto, persistencia y restauración con comprobación de conflictos |
| Ejecución de herramientas | Integrar el registro en el ejecutor común, con identidad de ejecución; cubrir rutas locales y proveedores que usan herramientas de Spartan |
| Streaming e historial | Eventos de cambios confirmados y cierre del conjunto; persistir su ID junto a la respuesta; reconciliar recarga/cancelación |
| API | Listar conjunto por ejecución, consultar diff por archivo y solicitar restauración acotada; validar permisos actuales |
| UI | Componente de resumen bajo la respuesta, estados de carga/fallo/cancelación/restauración y apertura del visor |
| Visor | Reutilizar presentación y componentes de diff existentes, añadiendo alcance por respuesta sin confundirlo con working/staged/branch |

La tarjeta debe usar el ancho responsivo del chat/compositor ya solicitado, colores semánticos y acciones compactas. Mostrar una transición breve al completar los datos y respetar reducción de movimiento. El panel lateral debe seguir integrado, sin otra ventana de preview.

## Orden de implementación

1. Registro persistente y diff neto por ejecución, con pruebas sobre archivos reales.
2. Tarjeta final y Ver cambios, incluyendo recuperación desde el historial.
3. Deshacer con copias previas, comprobación de huellas y manejo de conflictos.
4. Ampliar la captura a terminal/Python y concurrencia con cobertura explícita.

No conviene publicar un Deshacer aparente antes de completar la etapa 3. Si la primera versión cubre solo herramientas directas, la UI debe comunicar ese alcance.

## Pruebas necesarias

- Crear, editar, borrar y renombrar; varias llamadas sobre el mismo archivo; cambio finalmente revertido por la propia ejecución.
- Cambios del usuario anteriores al turno y posteriores al turno; otra respuesta modifica el mismo archivo.
- Error y cancelación después de una escritura; reinicio y reapertura del historial.
- Proyecto sin Git, repositorio sin commits, archivo nuevo sin seguimiento, binarios y archivos grandes.
- Revocación de permisos, carpeta reemplazada/desconectada y rutas fuera de la raíz.
- Tarjeta y visor con el mismo conjunto y estadísticas; teclado, móvil y reducción de movimiento.

## Implementación realizada

- `core/inference/turn_changes.py`: capturas antes/después, diferencias netas, diario SQLite fuera del repositorio y restauración con preflight completo. Conserva las modificaciones previas del usuario sin depender de HEAD ni de Git.
- `routes/chat/router_workspaces.py`: API autenticada de inicio, cierre, consulta de resumen/diff y deshacer, con ámbito por propietario/chat, permisos actuales e identidad de carpeta.
- `core/inference/tools.py`: observador del ejecutor común para atribuir escrituras directas. Un fallo del observador no cambia el resultado de la herramienta.
- `stream-orchestrator.ts`: abre captura antes de enviar la generación, guarda su referencia en metadata del mensaje y la cierra al finalizar o salir de la ejecución. Las continuaciones conservan los conjuntos anteriores.
- `turn-changes-summary.tsx` y `turn-changes-api.ts`: tarjeta final responsiva, totales y filas de archivos, visor de diferencias existente, errores recuperables y restauración. Los identificadores persistidos permiten recuperar la tarjeta tras recargar.

### Alcance y límites de esta versión

La captura corresponde al workspace local conectado o al proyecto local. Los archivos de herramientas alojadas por proveedores remotos y los documentos descargables independientes no se presentan como modificaciones del proyecto local.

Terminal/Python y cambios externos dentro de la ventana de captura pueden aparecer en el resumen para revisión. **Deshacer exige procedencia verificada de herramientas directas** (`edit_file`, `write_file`, `create_file`, `delete_path`, `rename_path` sobre archivos). No se habilita si hay cambios desconocidos, un salto en la cadena de huellas, captura incompleta, ejecución concurrente o archivos sin copia recuperable. Las operaciones sobre directorios no se atribuyen como escrituras individuales verificadas. Una edición posterior impide la restauración antes de escribir el primer archivo. No existe bloqueo exclusivo frente a procesos externos entre la comprobación y la escritura; no se promete una transacción de filesystem entre múltiples archivos.

Se omiten dependencias, salidas de compilación, `.git`, archivos `.env` y nombres de credenciales indicados en el servicio. Límites: 5.000 archivos, 2.000 directorios, 512 KiB por archivo, 16 MiB de contenido por captura y diff de hasta 160.000 caracteres. El diario rechaza nuevas capturas al alcanzar 100 conjuntos o superar 512 MiB; no elimina silenciosamente el historial. Las capturas pendientes caducan a las 24 horas y no son restaurables. No se vuelcan contenidos al historial del mensaje: este conserva únicamente referencias.

### Validación

- 27 pruebas del servicio y rutas pasadas con archivos temporales reales: diferencias netas, alta/baja/renombre, binarios, límites, permisos, propietario, persistencia, conflictos, rollback y procedencia de herramientas.
- Prueba en navegador (`npm run test:turn-changes:browser`): usa las rutas FastAPI y almacenamiento reales en un proyecto temporal; valida metadata de mensaje, estadísticas, diff por archivo, Deshacer, recarga y rechazo de una edición posterior. Comprueba también ancho de 390 px. Captura visual: `docs/audits/turn-changes-summary.png`.
- TypeScript (`tsc -b`) y ESLint de los componentes nuevos pasados. Las pruebas existentes de `edit_file` dieron 48 pasadas y 10 omitidas con Python en modo UTF-8; una primera ejecución concurrente sin ese modo falló por lectura del emoji con la codificación de Windows y por el umbral de tiempo. La ejecución aislada con UTF-8 pasó ambos casos. La prueba de navegador no ejecuta un modelo ni acredita generación remota: comprueba la tarjeta y su integración con la API.


### Revisión adicional del panel HTML

Se actualizó el harness de archivos al panel de documentos que realmente utiliza `SandboxFiles`, y se cerró ese panel al navegar al navegador lateral para evitar vistas simultáneas. La prueba de archivos fuente pasó con HTML, imports CSS, JavaScript interactivo, SVG, aislamiento, fallo de recurso y navegación/timeout. La prueba espera el manejador del script diferido antes de pulsar el botón.

### Integración con el Sheet compartido

«Ver cambios» y las filas de la tarjeta abren ahora una pestaña en `DocumentPreviewSheet`, usando `preview-store`, su redimensionado y sus controles existentes. Se retiró el modal `CodeViewerModal` de esta funcionalidad. Cada conjunto tiene una identidad de pestaña estable, conserva el archivo seleccionado al cambiar a otros documentos y reutiliza la pestaña al volver a abrirlo. El diff histórico sigue separado del estado Git actual.
