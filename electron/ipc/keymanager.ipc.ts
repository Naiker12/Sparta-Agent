import { ipcMain } from 'electron'
import { sendToPython } from './sidecar.ipc'
import { getKey } from '../vault'

export function registerKeyManagerIPC(): void {
  ipcMain.handle('keymanager:push', async (_event, keyId: string, vendor?: string) => {
    const value = getKey(keyId)
    if (!value) return { ok: false, error: `Key ${keyId} not found in vault` }
    sendToPython({
      id: `km:${keyId}`,
      method: 'keymanager.set',
      params: { key_id: keyId, value, vendor },
    })
    return { ok: true }
  })

  ipcMain.handle('keymanager:pushAll', async () => {
    const { listKeys } = await import('../vault')
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
  })

  ipcMain.handle('keymanager:clear', async () => {
    sendToPython({ id: 'km:clear', method: 'keymanager.clear', params: {} })
    return { ok: true }
  })
}
