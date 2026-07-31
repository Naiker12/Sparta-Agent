/**
 * mcp-call-tool.channel.ts
 * Canal IPC 'mcp:call-tool' para ejecutar herramientas MCP en tiempo de ejecución.
 * Integra McpPermissionsMiddleware y emite eventos 'mcp:tool_call_started' y 'mcp:tool_call_finished' para la UI.
 */

import { ipcMain, BrowserWindow } from 'electron'
import { McpProcessManager } from '../core/McpProcessManager'
import { McpPermissionsMiddleware, type MCPRuleDefinition } from '../core/McpPermissionsMiddleware'

export interface CallToolPayload {
  serverId: string
  toolName: string
  args: unknown
  config?: Record<string, unknown>
  rules?: MCPRuleDefinition[]
}

function broadcastEvent(channel: string, payload: unknown): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('stream:event', { type: channel, data: payload })
      win.webContents.send(channel, payload)
    }
  }
}

export function registerMcpCallToolIPC(): void {
  ipcMain.handle('mcp:call-tool', async (_event, payload: CallToolPayload) => {
    const { serverId, toolName, args, config, rules } = payload

    if (!serverId || !toolName) {
      throw new Error('Parámetros serverId y toolName son obligatorios para mcp:call-tool')
    }

    // Evaluar reglas de permisos en runtime
    const middleware = new McpPermissionsMiddleware(rules ?? [])
    const permissionAction = middleware.evaluate(serverId, toolName)

    if (permissionAction === 'deny') {
      const errorMsg = `Ejecución de la herramienta ${toolName} bloqueada por la regla de seguridad del usuario ('deny').`
      broadcastEvent('mcp:tool_call_finished', {
        serverId,
        toolName,
        status: 'error',
        error: errorMsg,
        timestamp: Date.now(),
      })
      throw new Error(errorMsg)
    }

    // Notificar inicio de ejecución de herramienta a la UI
    broadcastEvent('mcp:tool_call_started', {
      serverId,
      toolName,
      args,
      timestamp: Date.now(),
    })

    const manager = McpProcessManager.getInstance()

    try {
      const result = await manager.callTool(serverId, toolName, args, config)

      // Notificar éxito a la UI
      broadcastEvent('mcp:tool_call_finished', {
        serverId,
        toolName,
        status: 'success',
        result,
        timestamp: Date.now(),
      })

      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)

      // Notificar error a la UI
      broadcastEvent('mcp:tool_call_finished', {
        serverId,
        toolName,
        status: 'error',
        error: errorMessage,
        timestamp: Date.now(),
      })

      throw err
    }
  })
}
