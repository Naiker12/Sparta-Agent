# Hilo local desaparecido al inicializar el primer mensaje

El usuario aportó el error `Thread "__LOCALID_..." not found while initializing it`, procedente del append de historial, junto con un acceso fallido a `_nonReactive`.

Se comprobó el código instalado de assistant-ui: cambiar la identidad del adaptador en `__internal_setOptions` incrementa generaciones de carga, adaptación y navegación y programa el reemplazo de la lista. Spartan construía `createStudioDbAdapter(...)` de nuevo en cada render de ChatRuntimeProviderImpl. Se conserva ahora el adaptador con `useMemo`, con dependencias de su configuración real.

La regresión de navegador monta el proveedor real de Spartan, captura el cliente del hilo local, fuerza tres renders del padre y verifica que el ID local no cambia. Después inicializa el cliente capturado originalmente, comprobando que sigue perteneciendo a la lista. También conserva la prueba de adopción del ID guardado sin desmontar el motor. La prueba pasa.

Prueba de escritorio: se abrió y recargó la ventana real de Spartan mediante la herramienta de Windows y se introdujo un mensaje de prueba. No se completó el envío: el control de Windows devolvió `coordinate input geometry is unavailable` al pulsar el botón y la captura de ventana agotó su espera. No se acredita una respuesta del proveedor real ni se presenta la regresión automatizada como ese envío.

El error `_nonReactive` puede ser secundario a invalidar los clientes durante el reemplazo, pero no se afirma una causa independiente sin una reproducción completa de escritorio.
