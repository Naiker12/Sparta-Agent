import { ipcMain } from 'electron'
import { sendToPython, isSidecarRunning, waitForSidecarReady, sidecarEvents, SidecarEvent } from '../sidecar.ipc'

const memoryResolvers = new Map<string, (result: unknown) => void>()

sidecarEvents.on(SidecarEvent.MESSAGE, (msg: Record<string, unknown>) => {
  const event = msg.event as string
  if (event === 'memory.index:response' || event === 'memory.search:response' || event === 'memory.embed:response') {
    const resolver = memoryResolvers.get((msg.id as string) ?? '')
    if (resolver) {
      resolver(msg.data ?? { ok: false, error: 'Sin datos' })
      memoryResolvers.delete((msg.id as string) ?? '')
    }
  }
})

async function callMemoryMethod(method: string, params: Record<string, unknown>): Promise<unknown> {
  if (!isSidecarRunning()) {
    return { ok: false, error: 'Sidecar no iniciado' }
  }
  const ready = await waitForSidecarReady(10_000)
  if (!ready) {
    return { ok: false, error: 'Sidecar no listo' }
  }
  const requestId = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
  sendToPython({ id: requestId, method, params })
  return new Promise((resolve) => {
    memoryResolvers.set(requestId, resolve)
    setTimeout(() => {
      if (memoryResolvers.has(requestId)) {
        memoryResolvers.delete(requestId)
        resolve({ ok: false, error: 'Timeout esperando respuesta del sidecar' })
      }
    }, 15_000)
  })
}

export function registerMemoryIPC(): void {
  ipcMain.handle('memory:index', async (_event, entry: Record<string, unknown>) => {
    return callMemoryMethod('memory.index', { entry })
  })

  ipcMain.handle('memory:search', async (_event, { query, k }: { query: string; k?: number }) => {
    return callMemoryMethod('memory.search', { query, k: k ?? 5 })
  })

  ipcMain.handle('memory:embed', async (_event, { texts }: { texts: string[] }) => {
    return callMemoryMethod('memory.embed', { texts })
  })

  ipcMain.handle('memory:delete', async (_event, entryId: string) => {
    return callMemoryMethod('memory.delete', { entry_id: entryId })
  })

  ipcMain.handle('memory:count', async () => {
    return callMemoryMethod('memory.count', {})
  })
}
