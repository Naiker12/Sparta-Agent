import { create } from 'zustand'

interface SecurityState {
  loaded: boolean
  auditEnabled: boolean
  checked: boolean
  setStatus: (loaded: boolean, auditEnabled: boolean) => void
}

export const useSecurityStore = create<SecurityState>((set) => ({
  loaded: false,
  auditEnabled: false,
  checked: false,
  setStatus: (loaded, auditEnabled) => set({ loaded, auditEnabled, checked: true }),
}))
