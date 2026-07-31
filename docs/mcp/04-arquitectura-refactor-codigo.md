# 04 — Refactor de Arquitectura: dividir los archivos grandes

`mcp-test.channel.ts` hoy hace demasiado: prueba conexión stdio, prueba conexión HTTP, parsea JSON-RPC crudo, y es el único lugar donde "vive" la lógica de comunicarse con servidores MCP. Se propone dividirlo en módulos de responsabilidad única, cada uno resolviendo una brecha puntual del diagnóstico.

---

## Estructura de carpetas propuesta

```
desktop/ia-sparta-chat-ipc/src/mcp/
├── channels/
│   ├── mcp-test.channel.ts        # SOLO prueba efímera manual (botón "Probar conexión")
│   ├── mcp-call-tool.channel.ts   # NUEVO — handler de tools/call en runtime (Brecha 1)
│   ├── mcp-sync.channel.ts        # NUEVO — sincroniza catálogo de tools al iniciar la app
│   └── mcp-oauth.channel.ts       # Igual que hoy, sin cambios grandes
│
├── core/
│   ├── McpProcessManager.ts       # NUEVO — pool de procesos persistentes (Brecha 2)
│   ├── McpPermissionsMiddleware.ts# NUEVO — aplica mcpRules antes de ejecutar (Brecha 6)
│   ├── McpOAuthRefresher.ts       # NUEVO — refresco pasivo de tokens (Brecha 7)
│   └── McpToolSchemaAdapter.ts    # NUEVO — mapMcpToolToProviderFormat (Brecha 3)
│
├── transport/
│   ├── StdioTransport.ts          # usa StdioClientTransport del SDK oficial
│   └── SseTransport.ts            # usa SSEClientTransport + Mcp-Session-Id (Brecha 4)
│
└── parsers/
    └── JsonRpcStreamParser.ts     # NUEVO — ignora líneas no-JSON en stdout (Brecha 5)
```

Cada archivo nuevo queda bajo 150-200 líneas y con una sola razón para cambiar, en vez de un único archivo monolítico que mezcla transporte, parsing y ciclo de vida.

---

## Responsabilidad de cada pieza nueva

### `McpProcessManager.ts`
Clase singleton que mantiene `Map<serverId, McpClientSession>`. Expone:
```typescript
class McpProcessManager {
  async ensureConnected(serverId: string): Promise<McpClientSession>
  async callTool(serverId: string, toolName: string, args: unknown): Promise<ToolResult>
  async listTools(serverId: string): Promise<McpTool[]>
  disconnect(serverId: string): void
}
```
**Resuelve la Brecha 2:** Los procesos `stdio` no se matan tras cada prueba, se mantienen vivos durante la sesión del usuario. Esto hace posible que la card pase de "Desconectado" a "Conectado" de forma sostenida (ver documento 02).

---

### `mcp-call-tool.channel.ts`
```typescript
ipcMain.handle('mcp:call-tool', async (_event, { serverId, toolName, args }) => {
  await mcpPermissionsMiddleware.check(serverId, toolName) // Brecha 6
  emitEvent('mcp:tool_call_started', { serverId, toolName })
  try {
    const result = await mcpProcessManager.callTool(serverId, toolName, args)
    emitEvent('mcp:tool_call_finished', { serverId, toolName, status: 'success' })
    return result
  } catch (err) {
    emitEvent('mcp:tool_call_finished', { serverId, toolName, status: 'error', error: String(err) })
    throw err
  }
})
```
Los eventos `mcp:tool_call_started` / `finished` alimentan el chip de "MCP trabajando" del documento 02.

---

### `mcp-sync.channel.ts`
Se ejecuta al iniciar la app para cada servidor habilitado: llama `mcpProcessManager.listTools(serverId)` y persiste el resultado en `mcp.store.ts`. Resuelve directamente el bug de "Sin herramientas" (documento 01, sección B2) sin necesidad de abrir el diálogo manualmente.

---

### `McpToolSchemaAdapter.ts`
```typescript
function mapMcpToolToProviderFormat(tool: McpTool, vendor: 'openai' | 'anthropic' | 'gemini') {
  switch (vendor) {
    case 'openai':
      return { type: 'function', function: { name: tool.name, description: tool.description, parameters: tool.inputSchema } }
    case 'anthropic':
      return { name: tool.name, description: tool.description, input_schema: tool.inputSchema }
    case 'gemini':
      return { functionDeclarations: [{ name: tool.name, description: tool.description, parameters: tool.inputSchema }] }
  }
}
```
Incluye validación de `required` / propiedades anidadas antes de enviar a las APIs (Brecha 3).

---

### `SseTransport.ts`
Reemplaza el `fetch POST` directo. Implementa el handshake correcto: `GET /sse` → escuchar evento `endpoint` → enviar JSON-RPC por POST a esa URL con header `Mcp-Session-Id` (Brecha 4). Se utiliza `@modelcontextprotocol/sdk` (`SSEClientTransport`).

---

### `JsonRpcStreamParser.ts`
Un parser de líneas que descarta cualquier línea de `stdout` que no sea JSON válido antes de intentar `JSON.parse`, evitando errores `SyntaxError` (Brecha 5).

---

## Qué NO cambia
- `McpView.tsx`, `McpServerCard.tsx`, `AddMcpServerDialog.tsx` siguen existiendo, pero se simplifican para reflejar los nuevos estados del documento 02 en vez de manejar lógica de conexión directamente — esa lógica pasa a vivir en `mcp.store.ts` alimentado por los eventos del Main Process.
- El catálogo (`sparta_mcp_catalog.json`, `mcp-catalog.ts`) no requiere cambios estructurales.
