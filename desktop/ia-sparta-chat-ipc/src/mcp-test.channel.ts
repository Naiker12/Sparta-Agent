import { ipcMain } from 'electron'
import { McpProcessManager } from './mcp/core/McpProcessManager'

export function registerMcpTestIPC(): void {
  ipcMain.handle('mcp:test', async (_event, config: Record<string, unknown>) => {
    const manager = McpProcessManager.getInstance()
    const result = await manager.ensureConnected(config)
    if (!result.ok) {
      return { ok: false, error: result.error }
    }
    return {
      ok: true,
      tools: result.tools,
      toolCount: result.tools.length,
    }
  })
}
