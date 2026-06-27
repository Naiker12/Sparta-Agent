import type { Provider } from '@/types'

export async function getProviderKey(provider: Provider): Promise<string | undefined> {
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

  return undefined
}

export async function storeInVault(providerId: string, apiKey: string, vendor?: string): Promise<boolean> {
  if (!window.vault) return false
  try {
    const available = await window.vault.isAvailable()
    if (!available) return false
    return await window.vault.storeKey(providerId, apiKey, vendor)
  } catch {
    return false
  }
}

export async function removeFromVault(providerId: string): Promise<boolean> {
  if (!window.vault) return false
  try {
    return await window.vault.deleteKey(providerId)
  } catch {
    return false
  }
}

export async function isVaultAvailable(): Promise<boolean> {
  if (!window.vault) return false
  try {
    return await window.vault.isAvailable()
  } catch {
    return false
  }
}
