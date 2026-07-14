import { ipcMain } from 'electron'
import { sendToPython, isSidecarRunning, sidecarEvents, SidecarEvent } from '../sidecar.ipc'

const mcpTestResolvers = new Map<string, (result: unknown) => void>()

sidecarEvents.on(SidecarEvent.MESSAGE, (msg: Record<string, unknown>) => {
  if (msg.event === 'mcp.test.result') {
    const testId = (msg.id as string) ?? ''
    const resolve = mcpTestResolvers.get(testId)
    if (resolve) {
      resolve(msg.data ?? { ok: false, error: 'Sin datos' })
      mcpTestResolvers.delete(testId)
    }
  }
})

export function registerMcpTestIPC(): void {
  ipcMain.handle('mcp:test', async (_event, config: Record<string, unknown>) => {
    if (!isSidecarRunning()) {
      return { ok: false, error: 'Sidecar no iniciado' }
    }
    const testId = `mcp_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    sendToPython({ id: testId, method: 'mcp.test', params: { config } })

    return new Promise((resolve) => {
      mcpTestResolvers.set(testId, resolve)
      setTimeout(() => {
        if (mcpTestResolvers.has(testId)) {
          mcpTestResolvers.delete(testId)
          resolve({ ok: false, error: 'Timeout — el servidor MCP no respondió en 15s' })
        }
      }, 16_000)
    })
  })
}
