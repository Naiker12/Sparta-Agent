const VAULT_KEY_NAME = 'sparta-web-vault-key'

async function getOrCreateVaultKey(): Promise<CryptoKey> {
  const stored = sessionStorage.getItem(VAULT_KEY_NAME)

  if (stored) {
    const keyData: number[] = JSON.parse(stored)
    return await crypto.subtle.importKey(
      'raw', new Uint8Array(keyData),
      { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']
    )
  }

  const key = await crypto.subtle.generateKey(
    { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
  )

  const exported = await crypto.subtle.exportKey('raw', key)
  sessionStorage.setItem(VAULT_KEY_NAME, JSON.stringify(Array.from(new Uint8Array(exported))))

  return key
}

export async function encryptApiKey(apiKey: string): Promise<string> {
  const key = await getOrCreateVaultKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(apiKey)

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key, encoded
  )

  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return btoa(String.fromCharCode(...combined))
}

export async function decryptApiKey(encrypted: string): Promise<string> {
  const key = await getOrCreateVaultKey()
  const combined = Uint8Array.from(atob(encrypted), c => c.charCodeAt(0))
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv }, key, ciphertext
  )
  return new TextDecoder().decode(decrypted)
}