import type { Provider } from '@/types'
import { IS_ELECTRON } from './env-adapter'
import { encryptApiKey, decryptApiKey } from './web-vault'

export async function getProviderKey(provider: Provider): Promise<string | undefined> {
  if (IS_ELECTRON) {
    if (provider.hasVaultKey && window.vault) {
      const key = await window.vault.getKey(provider.id)
      if (key) return key
    }

    if (provider.apiKey) {
      const trimmed = provider.apiKey.trim()
      if (trimmed) {
        if (window.vault) {
          try {
            await window.vault.storeKey(provider.id, trimmed, provider.vendor)
          } catch { /* vault not available */ }
        }
        return trimmed
      }
    }
  } else {
    if (provider.hasVaultKey) {
      const encrypted = localStorage.getItem(`sparta-key-${provider.id}`)
      if (encrypted) {
        return decryptApiKey(encrypted)
      }
    }

    if (provider.apiKey) {
      const trimmed = provider.apiKey.trim()
      if (trimmed) return trimmed
    }
  }

  return undefined
}

export async function storeInVault(providerId: string, apiKey: string, vendor?: string): Promise<boolean> {
  if (IS_ELECTRON) {
    if (!window.vault) return false
    try {
      const available = await window.vault.isAvailable()
      if (!available) return false
      return await window.vault.storeKey(providerId, apiKey, vendor)
    } catch {
      return false
    }
  } else {
    try {
      const encrypted = await encryptApiKey(apiKey)
      localStorage.setItem(`sparta-key-${providerId}`, encrypted)
      return true
    } catch {
      return false
    }
  }
}

export async function removeFromVault(providerId: string): Promise<boolean> {
  if (IS_ELECTRON) {
    if (!window.vault) return false
    try {
      return await window.vault.deleteKey(providerId)
    } catch {
      return false
    }
  } else {
    try {
      localStorage.removeItem(`sparta-key-${providerId}`)
      return true
    } catch {
      return false
    }
  }
}

export async function isVaultAvailable(): Promise<boolean> {
  if (IS_ELECTRON) {
    if (!window.vault) return false
    try {
      return await window.vault.isAvailable()
    } catch {
      return false
    }
  } else {
    return true
  }
}
