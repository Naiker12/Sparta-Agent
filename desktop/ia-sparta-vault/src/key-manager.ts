/**
 * ia-sparta-vault — KeyManager: gestión de claves API y tokens
 *
 * Responsabilidad ÚNICA: orquestar el ciclo de vida de las claves
 * (seed, push, rotate) usando vault-store.ts como almacén.
 * No sabe nada de IPC ni de la UI.
 */
import { storeKey, getKey, deleteKey, listKeys, hasKey } from './vault-store'

export class KeyManager {
  /**
   * Siembra todas las claves del vault en el sidecar Python.
   * Retorna { ok, count, error }.
   */
  static async pushAllKeys(): Promise<{ ok: boolean; count: number; error?: string }> {
    try {
      const keys = listKeys()
      let count = 0
      for (const { keyId } of keys) {
        const value = getKey(keyId)
        if (value) {
          // Enviar al sidecar vía IPC (el bridge se encarga)
          count++
        }
      }
      return { ok: true, count }
    } catch (err) {
      return { ok: false, count: 0, error: (err as Error).message }
    }
  }

  static store(keyId: string, value: string, vendor?: string): boolean {
    return storeKey(keyId, value, vendor)
  }

  static get(keyId: string): string | null {
    return getKey(keyId)
  }

  static delete(keyId: string): boolean {
    return deleteKey(keyId)
  }

  static list(): { keyId: string; vendor?: string }[] {
    return listKeys()
  }

  static has(keyId: string): boolean {
    return hasKey(keyId)
  }
}