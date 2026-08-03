import { create } from 'zustand'

interface ArtifactState {
  openPath: string | null
  openSessionId: string | null
  refreshToken: number
  open: (path: string, sessionId?: string) => void
  close: () => void
  bump: () => void
}

export const useArtifactStore = create<ArtifactState>((set) => ({
  openPath: null,
  openSessionId: null,
  refreshToken: 0,
  open: (path, sessionId) => set({ openPath: path, openSessionId: sessionId ?? null, refreshToken: Date.now() }),
  close: () => set({ openPath: null, openSessionId: null }),
  bump: () => set((state) => ({ refreshToken: state.refreshToken + 1 })),
}))
