# 01 — Diagnóstico Técnico

## A. Backend (resumen de las 7 brechas ya identificadas)

Estas ya estaban bien detectadas en el informe original; se condensan aquí como referencia rápida. El detalle de cómo resolver cada una está en [04-arquitectura-refactor-codigo.md](04-arquitectura-refactor-codigo.md).

| # | Brecha | Efecto observable |
|---|---|---|
| 1 | Falta `ipcMain.handle('mcp:call-tool', ...)` | El agente nunca puede ejecutar una tool real, solo "probarla" |
| 2 | No hay `McpProcessManager` (proceso persistente) | Cada llamada reiniciaría el proceso `npx`/`uvx` desde cero (3-10s de latencia), y se pierde estado en memoria |
| 3 | `buildToolDefinitions` no normaliza `inputSchema` por proveedor | Fallos silenciosos o parámetros mal mapeados en OpenAI/Gemini/Anthropic |
| 4 | HTTP MCP se llama con `fetch POST` directo en vez de SSE + `Mcp-Session-Id` | Servidores remotos estándar (Notion, Supabase) devuelven 404/405 |
| 5 | `tryProcessLine` no filtra texto no-JSON en stdout | `SyntaxError: Unexpected token` al usar `npx`/`uvx` que imprime logs |
| 6 | No hay middleware que respete `mcpRules` en runtime | Una tool marcada "Denegar" igual podría ejecutarse si el handler existiera |
| 7 | No hay refresco pasivo de OAuth | Fallos `401` silenciosos tras ~1h en Google Drive/Notion/Supabase |

---

## B. UX / Frontend — bugs nuevos detectados en las capturas

Estos no estaban en el informe original pero son la causa de la frustración inmediata ("siempre me sale desconectado", "no muestra lo que hace el mcp"). Todos son **síntomas de las mismas brechas 1 y 2**, no bugs nuevos — pero se documentan aparte porque su solución es de UI, no solo de backend.

### B1. `spawn npx ENOENT` (Problema de Entorno y PATH)

**Causa raíz:** Cuando Electron se lanza desde el ícono de escritorio (no desde una terminal), el proceso principal **no hereda el `PATH` del shell de login** del usuario. Si `npx`/`node` fueron instalados vía `nvm`, `volta`, o un instalador que solo modifica el `.zshrc`/`.bashrc`, Electron no los encuentra y `child_process.spawn('npx', ...)` falla con `ENOENT`. Esto es un problema común en apps Electron en macOS y en Windows cuando el `PATH` de usuario no llegó al proceso de Explorer.

**Por qué el botón "Instalar" es la acción equivocada:** El error no significa "falta instalar el paquete MCP", significa "no encuentro el binario `npx` para ejecutar nada". Ofrecer "Instalar" hace creer al usuario que el problema es el servidor MCP, cuando es el entorno de ejecución de Sparta.

**Fix recomendado:**
- Al arrancar el Main Process, resolver el `PATH` real del shell de login (paquete `fix-path` o `shell-env`) y cachearlo, en vez de confiar en `process.env.PATH`.
- Si aun así no se encuentra el binario, mostrar un mensaje específico: *"No se encontró `npx` en el sistema. Verifica que Node.js esté instalado y accesible desde la terminal."* — con un botón **"Reintentar"**, no "Instalar".
- Reservar la etiqueta "Instalar" únicamente para cuando de verdad se va a ejecutar `npm install`/`npx -y <paquete>` por primera vez (descarga del paquete MCP en sí).

---

### B2. "Sin herramientas" en el modal de capacidades pese a estar "Instalado"

**Causa raíz:** `testStdio`/`testHttp` en `mcp-test.channel.ts` ejecutan `tools/list` como parte de una prueba **efímera** y matan el proceso (`proc.kill()`) apenas reciben la respuesta (Brecha 2). El resultado de esa prueba nunca se persiste de vuelta al `mcp.store.ts` de forma duradera — o si se persiste, se pierde en el siguiente render porque no hay sesión activa que respaldar esa lista. El modal de capacidades termina leyendo un estado vacío por defecto.

**Fix recomendado:** El listado de tools debe guardarse en el store **inmediatamente después de un `tools/list` exitoso**, independientemente de si el proceso sigue vivo o no, y debe re-sincronizarse automáticamente:
- al iniciar la app (para servidores marcados como habilitados),
- al reconectar manualmente,
- y en background cada cierto intervalo para servidores remotos (para detectar tools nuevas del lado del proveedor).

---

### B3. "Desconectado" persistente en la vista de servidores conectados

**Causa raíz:** Es el mismo problema que B2, visto desde la card en vez del modal. "Conectado" debería significar *"hay un proceso/sesión activa que puede responder `tools/call` ahora mismo"* — pero como no existe `McpProcessManager`, esa condición nunca es verdadera fuera de la ventana de tiempo de una prueba manual. El estado por defecto que se muestra es, correctamente, "Desconectado" — el bug no está en la etiqueta, está en que **nunca hay nada que la vuelva verde de forma sostenida**.

**Fix recomendado:** Una vez exista el proceso persistente (Fase Backend), la card debe reflejar 3 estados reales y no solo "conectado en el momento del test": ver el detalle completo de estados en [02-ux-flujo-conexion-mcp.md](02-ux-flujo-conexion-mcp.md).

---

## C. Conclusión del diagnóstico

Las brechas de backend (A) y los bugs de UX (B) **son la misma causa raíz vista desde dos ángulos**. Arreglar solo el backend (Fases 1-2 del plan original) hará que B2 y B3 desaparezcan automáticamente. B1 es independiente y debe resolverse aparte porque es un problema de entorno de ejecución, no de arquitectura MCP.
