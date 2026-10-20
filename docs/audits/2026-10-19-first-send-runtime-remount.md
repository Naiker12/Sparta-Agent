# El chat vuelve a la bienvenida después del primer envío

La captura muestra el chat recién guardado en Recientes y una bienvenida vacía en la vista principal. Se encontró una causa en `ChatRuntimeProvider`: su clave de React incluía `initialThreadId`. Cuando ChatPage deriva la vista a partir del ID publicado por el primer guardado, esa prop pasa de indefinida al ID persistido. React desmontaba entonces el proveedor anterior y su motor, interrumpiendo el primer envío.

La clave ahora depende únicamente de la configuración de ejecución (`modelType` y `pairId`). La navegación entre chats la resuelve el `ThreadAutoSwitch` existente dentro de la lista persistente. Esto conserva el motor durante la adopción del ID.

La prueba `tests/first-send-storage.browser.mjs` ahora monta el `ChatRuntimeProvider` real con un componente que cuenta montajes/desmontajes, publica el ID guardado y espera que el hilo se active. Comprueba que el proveedor mantiene un montaje y cero desmontajes. La misma prueba conserva los casos de guardado retrasado, guardado fallido y ausencia de bloqueo circular.

Al montar el proveedor real de forma independiente se detectó una importación circular: `prompt-queue-manager.ts` leía constantes de `features/chat`, que vuelve a importar ChatPage y sus vistas antes de inicializar dichas constantes. Se sustituyeron esas importaciones por los módulos concretos de límites, modelo y reordenación de cola.

Validación: prueba de navegador del proveedor real y 24 pruebas de colas/formularios correctas. La prueba no realiza una llamada a un proveedor externo ni acredita por sí sola la generación completa en el ejecutable.
