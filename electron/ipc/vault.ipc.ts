import { ipcMain } from 'electron'
import { isEncryptionAvailable, storeKey, getKey, deleteKey, listKeys, hasKey } from '../vault'

export function registerVaultIPC(): void {
  ipcMain.handle('vault:isAvailable', () => {
    return isEncryptionAvailable()
  })

  ipcMain.handle('vault:storeKey', (_event, keyId: string, value: string, vendor?: string) => {
    return storeKey(keyId, value, vendor)
  })

  ipcMain.handle('vault:getKey', (_event, keyId: string) => {
    return getKey(keyId)
  })

  ipcMain.handle('vault:deleteKey', (_event, keyId: string) => {
    return deleteKey(keyId)
  })

  ipcMain.handle('vault:listKeys', () => {
    return listKeys()
  })

  ipcMain.handle('vault:hasKey', (_event, keyId: string) => {
    return hasKey(keyId)
  })
}
