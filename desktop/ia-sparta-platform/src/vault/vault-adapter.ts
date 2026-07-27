import type { Provider } from 'ia-sparta-core'
import { IS_ELECTRON } from '../env'
import { encryptApiKey, decryptApiKey } from './web-vault'

import { useSettingsStore } from 'ia-sparta-core'

export async function getProviderKey(provider: Provider): Promise<string | undefined> {
  // 1. Check Electron Vault
  if (IS_ELECTRON && window.vault) {
    try {
      let key = await window.vault.getKey(provider.id)
      if (!key && provider.vendor) {
        key = await window.vault.getKey(`api_key_${provider.vendor}`)
      }
      if (!key && provider.vendor) {
        key = await window.vault.getKey(provider.vendor)
      }
      if (key && key.trim()) return key.trim()
    } catch { /* vault read error */ }
  }

  // 2. Check direct provider.apiKey property
  if (provider.apiKey && provider.apiKey.trim()) {
    const trimmed = provider.apiKey.trim()
    if (IS_ELECTRON && window.vault) {
      try {
        await window.vault.storeKey(provider.id, trimmed, provider.vendor)
      } catch { /* ignore */ }
    }
    return trimmed
  }

  // 3. Check Web localStorage Vault
  if (!IS_ELECTRON && provider.hasVaultKey) {
    try {
      const encrypted = localStorage.getItem(`sparta-key-${provider.id}`)
      if (encrypted) {
        const decrypted = await decryptApiKey(encrypted)
        if (decrypted && decrypted.trim()) return decrypted.trim()
      }
    } catch { /* decrypt error */ }
  }

  // 4. Fallback to SettingsStore apiKeys map
  try {
    const settingsState = useSettingsStore.getState()
    const settingsKeys = settingsState?.apiKeys
    if (settingsKeys) {
      const keyFromSettings = settingsKeys[provider.vendor] || settingsKeys[provider.id]
      if (keyFromSettings && keyFromSettings.trim()) {
        return keyFromSettings.trim()
      }
    }
  } catch { /* ignore */ }

  // 5. Fallback to process.env
  if (typeof process !== 'undefined' && process.env) {
    const vendorUpper = (provider.vendor || provider.id || '').toUpperCase()
    const envKey =
      process.env[`${vendorUpper}_API_KEY`] ||
      process.env[`SPARTA_${vendorUpper}_KEY`] ||
      process.env.OPENROUTER_API_KEY ||
      process.env.OPENAI_API_KEY
    if (envKey && envKey.trim()) return envKey.trim()
  }

  return undefined
}

export async function storeInVault(providerId: string, apiKey: string, vendor?: string): Promise<boolean> {
  const trimmed = apiKey.trim()
  if (!trimmed) return false

  // Store in SettingsStore apiKeys map for immediate availability
  try {
    const settings = useSettingsStore.getState()
    if (vendor) settings.setApiKey(vendor, trimmed)
    settings.setApiKey(providerId, trimmed)
  } catch { /* ignore */ }

  if (IS_ELECTRON) {
    if (!window.vault) return true
    try {
      await window.vault.storeKey(providerId, trimmed, vendor)
      if (vendor) {
        await window.vault.storeKey(`api_key_${vendor}`, trimmed, vendor)
        await window.vault.storeKey(vendor, trimmed, vendor)
      }
      return true
    } catch {
      return true
    }
  } else {
    try {
      const encrypted = await encryptApiKey(trimmed)
      localStorage.setItem(`sparta-key-${providerId}`, encrypted)
      if (vendor) {
        localStorage.setItem(`sparta-key-${vendor}`, encrypted)
      }
      return true
    } catch {
      return true
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