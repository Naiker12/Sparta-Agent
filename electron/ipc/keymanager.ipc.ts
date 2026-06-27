import { ipcMain } from 'electron'
import { sendToPython, waitForSidecarReady } from './sidecar.ipc'
import { getKey, listKeys } from '../vault'

export function registerKeyManagerIPC(): void {
  ipcMain.handle('keymanager:push', async (_event, keyId: string, vendor?: string) => {
    const ready = await waitForSidecarReady(10_000)
    if (!ready) return { ok: false, error: 'Sidecar not ready' }
    const value = getKey(keyId)
    if (!value) return { ok: false, error: `Key ${keyId} not found in vault` }
    sendToPython({
      id: `km:${keyId}`,
      method: 'keymanager.set',
      params: { key_id: keyId, value, vendor },
    })
    return { ok: true }
  })

  ipcMain.handle('keymanager:pushAll', async () => pushAllKeys())

  ipcMain.handle('keymanager:clear', async () => {
    const ready = await waitForSidecarReady(10_000)
    if (!ready) return { ok: false, error: 'Sidecar not ready' }
    sendToPython({ id: 'km:clear', method: 'keymanager.clear', params: {} })
    return { ok: true }
  })
}

export async function pushAllKeys(timeoutMs = 30_000): Promise<{ ok: boolean; count: number; error?: string }> {
  const ready = await waitForSidecarReady(timeoutMs)
  if (!ready) {
    return { ok: false, count: 0, error: 'Sidecar not ready' }
  }

  try {
    const keys = listKeys()
    for (const { keyId, vendor } of keys) {
      const value = getKey(keyId)
      if (value) {
        sendToPython({
          id: `km:${keyId}`,
          method: 'keymanager.set',
          params: { key_id: keyId, value, vendor },
        })
      }
    }
    return { ok: true, count: keys.length }
  } catch (err) {
    const message = (err as Error).message
    console.error('[keymanager] pushAllKeys failed:', message)
    return { ok: false, count: 0, error: message }
  }
}
