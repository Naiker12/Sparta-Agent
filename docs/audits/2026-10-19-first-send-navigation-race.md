# Salida del chat durante el primer envío

Los registros del backend de la sesión muestran consultas de chats que responden 404 alrededor de escrituras POST de nuevos chats. El adaptador publica el identificador antes de que concluya la creación de la fila. La validación de la URL en ChatPage consultaba esa fila sin esperar: una ausencia transitoria podía activar «Chat no encontrado», limpiar el chat activo y navegar a otro chat.

Cambios:

- `getStoredChatThread` ofrece `waitForWrites` para lectores de navegación. Espera las escrituras registradas de ese chat antes de consultar.
- Una creación fallida registrada no se convierte en ausencia definitiva: el lector rechaza y conserva el contexto actual.
- ChatPage usa esa lectura y deja de limpiar el chat activo por errores de transporte. Una lectura fallida de una navegación anterior tampoco cambia el chat actual.
- Los lectores internos del creador mantienen el comportamiento anterior: esperar desde dentro de la propia creación produciría un bloqueo circular.

Validación: `node tests/first-send-storage.browser.mjs` usa los módulos reales de almacenamiento en Edge y comprueba creación retrasada, ausencia de consultas prematuras, creación fallida y lectura del creador sin bloqueo circular. Las siete pruebas de coordinación de escrituras y vaciado de historial también pasan.

No se ha reproducido el envío completo con el proveedor externo real en esta revisión. Las consultas 404 de documentos RAG también aparecen repetidamente en los registros; este cambio no altera su contrato ni acredita que desaparezcan todos esos avisos. No se modifica el historial del usuario.
