import { create } from 'zustand'
import type { ProviderVendor } from '@/types'

export interface GatewayRequestEntry {
  vendor: ProviderVendor
  providerId: string
  status: number
  ok: boolean
  latency: number
  timestamp: number
  error?: string
}

interface GatewayState {
  entries: GatewayRequestEntry[]

  addEntry: (entry: GatewayRequestEntry) => void
  getEntries: (limit?: number) => GatewayRequestEntry[]
  getLatestByVendor: (vendor: ProviderVendor) => GatewayRequestEntry | undefined
  getHealthSummary: () => { healthy: boolean; lastError?: string; lastErrorTimestamp?: number }
  clear: () => void
}

export const useGatewayStore = create<GatewayState>((set, get) => ({
  entries: [],

  addEntry: (entry) => {
    set((s) => ({
      entries: [entry, ...s.entries].slice(0, 20),
    }))
  },

  getEntries: (limit = 20) => get().entries.slice(0, limit),

  getLatestByVendor: (vendor) => {
    return get().entries.find((e) => e.vendor === vendor)
  },

  getHealthSummary: () => {
    const entries = get().entries
    const lastError = entries.find((e) => !e.ok)
    return {
      healthy: entries.length === 0 || entries[0]?.ok !== false,
      lastError: lastError?.error,
      lastErrorTimestamp: lastError?.timestamp,
    }
  },

  clear: () => set({ entries: [] }),
}))
