import { create } from 'zustand'

interface ArtifactState {
  openPath: string | null
  open: (path: string) => void
  close: () => void
}

export const useArtifactStore = create<ArtifactState>((set) => ({
  openPath: null,
  open: (path) => set({ openPath: path }),
  close: () => set({ openPath: null }),
}))
