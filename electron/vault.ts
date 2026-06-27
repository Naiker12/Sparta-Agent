import { safeStorage } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface VaultData {
  keys: Record<string, { encrypted: string; iv?: string; vendor?: string }>
}

let _vaultPath: string | null = null
let _cache: VaultData | null = null

function getVaultPath(): string {
  if (_vaultPath) return _vaultPath
  const root = process.env.APP_ROOT || path.join(__dirname, '..')
  _vaultPath = path.join(root, 'sparta-vault.json')
  return _vaultPath
}

function loadVault(): VaultData {
  if (_cache) return _cache
  const vaultPath = getVaultPath()
  try {
    const raw = fs.readFileSync(vaultPath, 'utf-8')
    const data = JSON.parse(raw) as VaultData
    _cache = data
    return data
  } catch {
    const data: VaultData = { keys: {} }
    _cache = data
    return data
  }
}

function saveVault(): void {
  if (!_cache) return
  const vaultPath = getVaultPath()
  fs.writeFileSync(vaultPath, JSON.stringify(_cache, null, 2), 'utf-8')
}

export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

export function storeKey(keyId: string, value: string, vendor?: string): boolean {
  if (!safeStorage.isEncryptionAvailable()) return false
  const encrypted = safeStorage.encryptString(value)
  const data = loadVault()
  data.keys[keyId] = {
    encrypted: encrypted.toString('base64'),
    vendor,
  }
  _cache = data
  saveVault()
  return true
}

export function getKey(keyId: string): string | null {
  const data = loadVault()
  const entry = data.keys[keyId]
  if (!entry) return null
  if (!safeStorage.isEncryptionAvailable()) return null
  try {
    const buffer = Buffer.from(entry.encrypted, 'base64')
    return safeStorage.decryptString(buffer)
  } catch {
    return null
  }
}

export function deleteKey(keyId: string): boolean {
  const data = loadVault()
  if (!data.keys[keyId]) return false
  delete data.keys[keyId]
  _cache = data
  saveVault()
  return true
}

export function listKeys(): { keyId: string; vendor?: string }[] {
  const data = loadVault()
  return Object.entries(data.keys).map(([keyId, entry]) => ({
    keyId,
    vendor: entry.vendor,
  }))
}

export function hasKey(keyId: string): boolean {
  const data = loadVault()
  return keyId in data.keys
}

export function clearVault(): void {
  _cache = { keys: {} }
  saveVault()
}
