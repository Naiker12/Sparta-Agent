# Persistencia de Acceso total

El selector descartaba deliberadamente Acceso total al reiniciar. Ahora una selección explícita se guarda de forma síncrona en `unsloth_chat_device_full_access` y se restaura junto con `bypassPermissions` y `confirmToolCalls`. Elegir otro modo, desactivar el control antiguo de bypass o activar investigación profunda elimina esa preferencia. Restablecer los ajustes también la elimina.

La preferencia pertenece al dispositivo. Los contratos del backend, las exportaciones de chats y las colas duraderas siguen sin transportar Acceso total. Se conserva el diálogo existente al activarlo desde el selector.

Validación: prueba de navegador con el almacén real y recargas para los cuatro modos, selección dentro de un chat, reapertura de un chat guardado, control antiguo de bypass y transición a investigación profunda; 23 pruebas de contratos de ajustes; comprobación de tipos del frontend.

Para probar las respuestas visuales, activar Ajustes → Chat → Respuestas visuales y usar un modelo compatible con herramientas:

> Muéstrame un panel para planear una tarea. Incluye un resumen y un formulario con nombre de la tarea, prioridad (alta, media o baja), fecha, presupuesto y una casilla para indicar si necesita investigación. Espera a que envíe los datos; después presenta un resumen con ellos. No ejecutes acciones externas.

La comprobación automatizada reproduce el reinicio del estado JavaScript mediante recarga; no genera un instalador ni sustituye una prueba manual de cierre del ejecutable de escritorio.
