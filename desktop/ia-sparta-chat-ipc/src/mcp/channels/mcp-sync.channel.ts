/**
 * mcp-sync.channel.ts
 * Sincronizador de catálogo de herramientas MCP al inicio de la aplicación.
 */

import { ipcMain } from 'electron'
import { McpProcessManager } from '../core/McpProcessManager'

export function registerMcpSyncIPC(): void {
  ipcMain.handle('mcp:sync-all', async (_event, servers: Record<string, unknown>[]) => {
    const manager = McpProcessManager.getInstance()
    const results: Record<string, { ok: boolean; tools: unknown[]; error?: string }> = {}

    for (const server of servers) {
      const id = (server.id as string) || (server.name as string)
      if (!id || server.enabled === false) continue
      try {
        const res = await manager.ensureConnected(server)
        results[id] = { ok: res.ok, tools: res.tools, error: res.error }
      } catch (err) {
        results[id] = { ok: false, tools: [], error: (err as Error).message }
      }
    }

    return results
  })
}
