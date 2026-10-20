# Panel ausente en el chat real

El chat de prueba guardado contiene llamadas a `web_search` y `generate_document`, sin ninguna llamada a `present_ui`. Se creó `planificador-de-tareas.md`, pero no un panel. Por tanto, no había un resultado de panel que el frontend pudiera mostrar.

El backend activo se inició a las 11:08:17; los archivos `response_panels.py` y `tools.py` que registran la herramienta se guardaron a las 11:08:49. Un proceso Python ya iniciado conserva sus módulos importados. Esto es compatible con que la interfaz actualizada enviara instrucciones de presentación mientras el backend conservaba el catálogo anterior.

Se añadió una regresión que usa `_select_request_tools`, el selector real de la ruta externa, con la lista de herramientas usada en el chat y los cuatro modos de permisos. Verifica que `present_ui` llega con su esquema completo. Las 14 pruebas de paneles pasaron en el entorno `.venv` del backend. La prueba de navegador de OpenUI también pasó, incluyendo formularios y exportación/restauración.

Para cargar los módulos actualizados es necesario cerrar completamente Spartan y volver a abrirlo. Recargar solo Vite o el frontend no reinicia Python. Repetir la prueba en un chat nuevo evita reutilizar el contexto de la ejecución fallida. No se modificó el chat guardado ni se simuló un resultado del modelo.

Pendiente: repetir con el proveedor real después de reiniciar el proceso de escritorio. Las pruebas automatizadas de interfaz usan un modelo simulado y no acreditan esa última comprobación.
