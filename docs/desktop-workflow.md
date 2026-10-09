# Conexiones, documentos y proyectos

Esta guía describe el comportamiento implementado en la aplicación de escritorio. Las notas de planes y auditorías conservan su contexto histórico y no sustituyen esta guía.

## Conectar un proveedor o servidor local

En Conexiones, elige el proveedor, revisa su URL base y guarda la conexión. Los IDs de modelos no son obligatorios para guardarla. **Probar conexión y consultar modelos** solicita los modelos disponibles al servidor; introducir IDs manualmente sigue siendo una alternativa cuando el servidor no permite descubrirlos. Guardar una conexión sin modelos no significa que ya puedas iniciar una conversación: selecciona un modelo disponible antes de enviar mensajes.

Los valores iniciales de los servidores externos son:

| Servidor | URL base inicial |
| --- | --- |
| LM Studio | `http://localhost:1234/v1` |
| Ollama | `http://localhost:11434/v1` |
| llama.cpp | `http://localhost:8080/v1` |
| vLLM | `http://localhost:8000/v1` |

Puedes cambiar el host, puerto o ruta para tu instalación. Estos valores son direcciones propuestas, no una comprobación de que el servidor esté activo. La clave de API es opcional en una conexión compatible; si el servidor exige autenticación, proporciona su clave. Sparta utiliza esos endpoints, pero no inicia los servidores ni instala modelos.

## Crear y abrir documentos

Pide el archivo y su contenido en el chat, por ejemplo: «Crea un Excel con estas columnas y filas». La herramienta `generate_document` admite PDF, XLSX, DOCX, CSV, TXT y Markdown. Recibe texto y tablas, valida el formato resultante y devuelve el archivo solo después de crearlo correctamente.

Esta herramienta se ofrece independientemente del interruptor **Código**, cuando el modelo y el modo de conversación admiten herramientas. Desactivar Código sigue desactivando las herramientas de ejecución de código; no impide crear estos documentos mediante datos. No todos los modos, proveedores o modelos admiten llamadas a herramientas.

El chat muestra un indicador durante la generación y otro mientras prepara la apertura. Una vez creado, puedes previsualizar o descargar el archivo. Si ya existe un archivo con ese nombre, se crea otro con un sufijo numérico en lugar de sobrescribirlo. La ubicación efectiva depende de los permisos del espacio de trabajo; una carpeta de solo lectura no habilita escritura y puede utilizarse el espacio aislado de la sesión.

El generador tiene límites: 100.000 caracteres de contenido, hasta 10.000 filas y 100 columnas, con un máximo de 2 MB para los datos de tablas. El visor tiene sus propios límites, explicados en [vista previa de archivos](preview-workspace-review.md). Una vista parcial no modifica el archivo descargable original.

## Búsqueda web con modelos locales

Activa **Búsqueda web** en el menú del compositor. El modelo solicita una llamada a la herramienta; Sparta realiza la búsqueda y devuelve los resultados al modelo. Tener un modelo local no lo conecta por sí solo a internet: el equipo necesita conectividad para ejecutar la búsqueda.

La interfaz relaciona las capacidades de LM Studio, Ollama, llama.cpp y vLLM con su conexión compatible del backend. Una capacidad explícitamente no admitida continúa deshabilitada. El tamaño del modelo no garantiza llamadas correctas a herramientas: un modelo pequeño puede fallar al elegir la herramienta o formar sus argumentos. Comprueba su comportamiento con una consulta concreta y revisa los resultados mostrados.

## Carpetas y proyectos

Seleccionar una carpeta desde el compositor la conecta directamente, sin un segundo diálogo para escoger permisos. La conexión usa el modo de acceso vigente de la conversación. Esto no elimina las confirmaciones aplicables a acciones posteriores sobre archivos o comandos.

Una carpeta ya vinculada no crea un segundo proyecto. El backend compara rutas reales y normaliza el nombre de ruta; las conexiones de chats pueden reutilizar el proyecto existente, incluido uno archivado. Otra asignación incompatible a un proyecto diferente se rechaza. Al eliminar un proyecto, la interfaz actualiza el estado compartido inmediatamente; si la petición falla, restaura la entrada y muestra el error.

## Revisar cambios y pull requests

Cuando la carpeta contiene un repositorio Git, el indicador del compositor muestra su rama. Desde la rama o el menú de carpeta puedes abrir **Cambios** y **Pull requests** en el mismo panel que utiliza la vista previa de documentos.

La revisión permite consultar cambios de trabajo, cambios preparados y comparación de rama con su referencia disponible. Muestra archivos reales, líneas añadidas y eliminadas, y vistas unificada o dividida. Las referencias dependen del estado del repositorio: una rama sin upstream no tiene automáticamente una comparación remota.

Los pull requests requieren un repositorio GitHub. Para repositorios privados se utiliza la sesión existente de GitHub CLI (`gh`); la consulta pública puede usar la API de GitHub. La revisión no crea, publica ni fusiona pull requests por abrir el panel.

## Autenticación de escritorio

El intercambio del secreto local de escritorio por una sesión se ejecuta fuera del bucle asíncrono de FastAPI. Esto permite que otras peticiones progresen mientras SQLite espera un bloqueo de escritura y corrige ese caso de error 500 al iniciar sesión. No convierte cualquier error 500 en un problema de bloqueo: conserva el mensaje y los registros si falla el arranque.

Para cargar cambios del generador, backend o puente nativo después de actualizar el código, reconstruye y reinicia la aplicación correspondiente.
