import { create } from 'zustand'

interface SecurityState {
  loaded: boolean
  auditEnabled: boolean
  safeMode: boolean
  checked: boolean
  setStatus: (loaded: boolean, auditEnabled: boolean, safeMode?: boolean) => void
}

export const useSecurityStore = create<SecurityState>((set) => ({
  loaded: false,
  auditEnabled: false,
  safeMode: false,
  checked: false,
  setStatus: (loaded, auditEnabled, safeMode = false) => set({ loaded, auditEnabled, safeMode, checked: true }),
}))
