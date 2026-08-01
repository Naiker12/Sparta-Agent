# Reglas de Proyecto — Sparta Agent Workspace

1. **Aislamiento del Código Fuente**:
   - Nunca modifiques o crees archivos de ejemplo (calculadoras, demos HTML/JS/CSS, pruebas temporales) directamente en la raíz de este proyecto (`Sparta-Agent`).
   - Cuando el usuario solicite un ejemplo, plantilla o app web de demostración:
     - Entrega todo el código completo en bloques de Markdown (`.md`) dentro del chat.
     - Si hay una carpeta conectada explícitamente, escribe los archivos en esa carpeta y no en la raíz del proyecto.

2. **Respuestas Directas para Ejemplos de Código**:
   - Para solicitudes de código general (ej. "crear una calculadora en html y js y css"), genera el código directamente sin delegar a subagentes de código que puedan consumir cuotas o expirar.

3. **Ejecución Segura de Herramientas MCP**:
   - La ejecución de herramientas MCP (Google Drive, Gmail, Calendar, Filesystem, Git, Slack, Notion, etc.) debe realizarse ÚNICAMENTE mediante la interfaz nativa del canal IPC `mcp:call-tool` y `McpProcessManager`.
   - Queda estrictamente prohibido intentar ejecutar comandos de consola (ej. `echo`, `cp`, scripts impersonados en PowerShell/Terminal) en lugar de utilizar el protocolo de invocación directa de herramientas MCP.

4. **Diferenciación Estricta de Modos (Chat vs Agente) y Diálogo Modal de Permisos**:
   - **Modo Chat (Solo Lectura / Consulta)**: Permite únicamente listar, buscar, consultar y leer información (`search_files`, `list_files`, `get_file_metadata`, `download_file`, `read_file`, `web_search`). Queda strictly prohibido crear, modificar, editar o borrar recursos en Modo Chat. Si el usuario solicita crear, editar o eliminar en Modo Chat, la IA debe avisar: *"Debes activar el Modo Agente en el selector de modo para crear, editar o borrar recursos."*
   - **Modo Agente (Modificación con Autorización Explicita)**: Permite crear, modificar, actualizar y eliminar recursos (`upload_file`, `write_file`, `delete_file`, `run_command`). Cada acción de modificación en Modo Agente DEBE activar obligatoriamente el diálogo modal de permisos (`PermissionRequestDialog` / `ask_permission`) mostrando una tarjeta de confirmación previa para aprobación directa del usuario.

5. **Resumen Obligatorio de Acciones y Cambios**:
   - Cada vez que la IA ejecute una herramienta (Notion, Google Drive, OneDrive, Gmail, Filesystem, etc.), NUNCA debe responder de forma vaga o terminar con "Ya lo hice" / "Ya te agregué eso".
   - Es OBLIGATORIO entregar siempre un resumen estructurado y transparente en Markdown que describa exactamente qué se creó o modificó, el título del recurso objetivo y el contenido agregado.
