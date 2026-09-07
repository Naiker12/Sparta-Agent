# Carpeta conectada al chat: correcciones del flujo

## Problemas comprobados

- La selección anterior al primer mensaje vivía exclusivamente en una variable de módulo. La interfaz vinculaba la carpeta en paralelo al envío, sin que el envío esperara ese resultado.
- Las herramientas podían recibir la sesión del proyecto aunque la autorización estuviera asociada al identificador del chat.
- Un fallo al restaurar el puente nativo borraba visualmente la carpeta y parecía una desconexión.
- La inicialización del esquema SQLite invocaba dos funciones de inventario sin importarlas. Se reprodujo al crear una base nueva en las pruebas.

## Comportamiento corregido

El envío espera la vinculación de la carpeta y usa el identificador del chat para sus herramientas. La lectura, búsqueda y escritura de archivos se habilitan por la carpeta conectada, independientemente del botón Código, y conservan las restricciones de acceso. El contexto explica al modelo que un entorno de ejecución alojado por el proveedor no es la carpeta local.

La selección todavía pendiente se conserva en sessionStorage durante recargas de la misma ventana. Una vez vinculada al chat, se guarda en SQLite. La restauración conserva la vinculación visible cuando falla el puente nativo y muestra un error. Las respuestas de consultas anteriores se descartan al cambiar de chat.

## Validación y límites

Pasaron seis pruebas de carpetas: persistencia de proyecto, desconexión, aislamiento entre conversaciones, reemplazo de vinculación, permisos y conservación tras guardar el chat y reabrir una conexión SQLite. Pasó la comprobación TypeScript del frontend.

Pendiente de comprobación interactiva: cierre y reapertura de Electron, cierre de sesión y reentrada, y envío con el proveedor mostrado en las capturas. La selección de un borrador aún sin chat persistido no se conserva al cerrar definitivamente la ventana; sessionStorage solamente cubre recargas.

## Referencias consultadas

- [Electron: app y directorio userData](https://www.electronjs.org/docs/latest/api/app).
- [Node.js: child_process y directorio cwd](https://nodejs.org/api/child_process.html).
