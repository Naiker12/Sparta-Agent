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
