# Reglas de Proyecto — Sparta Agent Workspace

1. **Aislamiento del Código Fuente**:
   - Nunca modifiques o crees archivos de ejemplo (calculadoras, demos HTML/JS/CSS, pruebas temporales) directamente en la raíz de este proyecto (`Sparta-Agent`).
   - Cuando el usuario solicite un ejemplo, plantilla o app web de demostración:
     - Entrega todo el código completo en bloques de Markdown (`.md`) dentro del chat.
     - Si hay una carpeta conectada explícitamente, escribe los archivos en esa carpeta y no en la raíz del proyecto.

2. **Respuestas Directas para Ejemplos de Código**:
   - Para solicitudes de código general (ej. "crear una calculadora en html y js y css"), genera el código directamente sin delegar a subagentes de código que puedan consumir cuotas o expirar.
