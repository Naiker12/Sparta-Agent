# Creación y apertura de documentos — 2026-10-09

Se revisaron la herramienta de generación, las tarjetas de archivos y los visores. La creación escribe y valida un archivo temporal antes de devolver una tarjeta; no publica el documento durante su generación.

## Problemas encontrados y cambios

- La herramienta aceptaba un título sin cuerpo y tablas con celdas vacías. Ahora exige texto o datos de tabla con contenido antes de generar cualquiera de los seis formatos soportados. El esquema instruye al modelo a preparar el contenido y comprobar los datos antes de crear el archivo. La visibilidad del razonamiento depende del proveedor; no se añade razonamiento ficticio.
- En desarrollo se reprodujo una recarga al abrir el visor de hojas por primera vez: Vite descubría `xlsx` después de iniciar la aplicación y recargaba la página, perdiendo la vista. Se incluyen de antemano las dependencias de hojas y PDF junto a Word. Este hallazgo corresponde al servidor de desarrollo; no demuestra un cierre del proceso de Electron empaquetado.
- La tarjeta de generación presenta un documento con líneas animadas, estado accesible y nombre del archivo. Respeta la preferencia de reducir movimiento; no muestra porcentajes inventados. La tarjeta final sigue apareciendo únicamente cuando la herramienta termina con archivos.
- La tarjeta tolera argumentos o mensajes de error de tipos inesperados para evitar errores de renderizado.

## Verificación

- 23 pruebas de generación aprobadas, incluyendo contenido PDF, Word y Excel, cancelación, conservación de archivos existentes y rechazo de documentos vacíos en los seis formatos.
- 33 pruebas de interfaz aprobadas sobre selección de visor, pestañas y liberación de documentos, ejecutadas con el runner de Node configurado por el proyecto.
- Navegador real: primera apertura de Word, PDF, hoja CSV y Markdown, cambio de formato y reapertura aprobados. La regresión comprueba que no se recarga la página.
- Word en Electron aislado: dos páginas, saltos de página y papel blanco aprobados.
- TypeScript aprobado; ESLint de la tarjeta y configuración modificadas aprobado.

Se añadió la prueba de navegador a CI. No se recompiló la aplicación instalada. Si el cierre ocurre en una versión empaquetada, será necesario identificarlo con el documento y los registros de esa ejecución: las pruebas realizadas no reprodujeron un cierre de Electron.

## Seguimiento de los bloques Python persistentes

La captura posterior mostraba scripts visibles aunque la herramienta estuviera plegada. `PythonToolUI` colocaba el código fuera del contenido plegable. Ahora el código y la salida están dentro de los detalles, cerrados inicialmente, y el encabezado muestra solo el nombre de la herramienta. Las tarjetas de archivos generados conservan su acceso directo.

La prueba de carga independiente reprodujo además `Cannot access PythonToolUI before initialization`. Se eliminó el recorrido circular entre componentes de herramientas, exportaciones generales del chat, configuración de modelos y registro del propio componente. La prueba real de navegador ahora carga el componente desde cero, verifica que el código no aparece inicialmente y comprueba abrir y cerrar los detalles sin errores de página.

La guía general enviada al modelo también incluye el generador integrado cuando está disponible, incluso si es la única herramienta. Tres pruebas comprueban la preferencia por `generate_document`, su convivencia con Python y que no se recomienda una herramienta desactivada. El test histórico `test_full_access_tool_prompt.py` no se pudo recopilar por un import eliminado anteriormente (`_append_to_codex_instructions`); las nuevas pruebas importan la función vigente directamente.

TypeScript y lint raíz aprobaron. De 52 pruebas adicionales de configuración de modelos, 50 aprobaron; dos comprobaciones estáticas siguen buscando código en funciones/archivos anteriores (`use-chat-model-runtime.ts` y el antiguo `chat-adapter.ts`). Esos dos archivos no se modificaron en esta corrección.
