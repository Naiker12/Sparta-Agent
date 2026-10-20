# Seguimiento: panel duplicado y primer envío vacío

Las capturas y el historial guardado confirman una llamada exitosa a `present_ui` en la regeneración. El modelo añadió después una tabla de campos y una sección de uso que duplicaban el formulario.

Se ajustaron las instrucciones del turno, la descripción de la herramienta y su recibo compacto para indicar que el panel ya está visible, cerrar con una sola confirmación breve y esperar los valores antes de resumirlos. No se oculta ni elimina texto del historial mediante heurísticas. La respuesta del modelo todavía requiere comprobación real; las instrucciones no garantizan su obediencia.

El usuario aclaró que el primer envío no muestra un error: se queda sin respuesta. Se encontró que `ThreadNewChatSwitch` volvía a ejecutar la navegación para el mismo nonce si cambiaba una dependencia de su efecto, incluido el estado de carga de la lista. Ahora una referencia registra el nonce procesado antes de cambiar de chat; las reevaluaciones y la repetición de efectos de StrictMode no deben repetir esa navegación. Un nonce nuevo sigue abriendo un chat nuevo.

Validación de paneles: 14 pruebas backend y 12 frontend correctas. La prueba de navegador existente comprueba primer envío, StrictMode, cancelación y recuperación con un modelo simulado; no reproduce toda la navegación de ChatPage ni acredita el proveedor real. No se da por cerrado el bloqueo del primer envío sin esa comprobación.

Se corrigió además `toThreadMessage` para conservar los metadatos de los mensajes de usuario cargados del backend. Antes se restauraban siempre como `{}`, perdiendo `responseUiSubmission` y permitiendo que el formulario de origen pareciera no enviado. Una prueba adicional comprueba la restauración de origen y valores, incluidos cero y falso. Las seis pruebas del archivo de paneles pasan después de este cambio.
