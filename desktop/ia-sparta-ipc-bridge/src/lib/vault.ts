/**
 * vault.ts — Almacén cifrado seguro para API keys y credenciales.
 * Utiliza Electron safeStorage para cifrado nativo por hardware/SO (DPAPI en Windows, Keychain en macOS, libsecret en Linux).
 */

import { safeStorage, app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

interface VaultEntry {
  keyId: string
  encryptedBase64: string
  vendor?: string
  updatedAt: number
}

interface VaultStore {
  version: 1
  entries: Record<string, VaultEntry>
}

let _vaultFilePath: string | null = null

function getVaultPath(): string {
  if (!_vaultFilePath) {
    const userData = app.isPackaged ? app.getPath('userData') : process.cwd()
    _vaultFilePath = path.join(userData, 'sparta-vault.json')
  }
  return _vaultFilePath
}

function loadVault(): VaultStore {
  try {
    const vPath = getVaultPath()
    if (fs.existsSync(vPath)) {
      const raw = fs.readFileSync(vPath, 'utf-8')
      const parsed = JSON.parse(raw)
      if (parsed && typeof parsed === 'object' && parsed.entries) {
        return parsed as VaultStore
      }
    }
  } catch (err) {
    console.error('[vault] Error reading vault store:', err)
  }
  return { version: 1, entries: {} }
}

function saveVault(store: VaultStore): void {
  try {
    const vPath = getVaultPath()
    fs.mkdirSync(path.dirname(vPath), { recursive: true })
    fs.writeFileSync(vPath, JSON.stringify(store, null, 2), 'utf-8')
  } catch (err) {
    console.error('[vault] Error writing vault store:', err)
  }
}

export function isEncryptionAvailable(): boolean {
  try {
    return safeStorage.isEncryptionAvailable()
  } catch {
    return false
  }
}

export function storeKey(keyId: string, value: string, vendor?: string): { success: boolean; error?: string } {
  if (!keyId || typeof keyId !== 'string') return { success: false, error: 'keyId inválido' }
  try {
    const isAvail = isEncryptionAvailable()
    const encryptedBase64 = isAvail
      ? safeStorage.encryptString(value).toString('base64')
      : Buffer.from(value, 'utf-8').toString('base64')

    const store = loadVault()
    store.entries[keyId] = {
      keyId,
      encryptedBase64,
      vendor,
      updatedAt: Date.now(),
    }
    saveVault(store)
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export function getKey(keyId: string): string | null {
  if (!keyId || typeof keyId !== 'string') return null
  try {
    const store = loadVault()
    const entry = store.entries[keyId]
    if (!entry || !entry.encryptedBase64) return null

    const buf = Buffer.from(entry.encryptedBase64, 'base64')
    const isAvail = isEncryptionAvailable()
    if (isAvail) {
      try {
        return safeStorage.decryptString(buf)
      } catch {
        // Fallback for unencrypted stored buffers
        return buf.toString('utf-8')
      }
    }
    return buf.toString('utf-8')
  } catch (err) {
    console.error(`[vault] Error decrypting key ${keyId}:`, err)
    return null
  }
}

export function deleteKey(keyId: string): { success: boolean; error?: string } {
  if (!keyId || typeof keyId !== 'string') return { success: false, error: 'keyId inválido' }
  try {
    const store = loadVault()
    if (store.entries[keyId]) {
      delete store.entries[keyId]
      saveVault(store)
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : String(err) }
  }
}

export function listKeys(): Array<{ keyId: string; vendor?: string }> {
  try {
    const store = loadVault()
    return Object.values(store.entries).map((e) => ({
      keyId: e.keyId,
      vendor: e.vendor,
    }))
  } catch {
    return []
  }
}

export function hasKey(keyId: string): boolean {
  if (!keyId) return false
  const store = loadVault()
  return Boolean(store.entries[keyId])
}
