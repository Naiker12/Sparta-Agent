import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface FolderState {
  connectedPath: string | null
  folderName: string | null
  recentPaths: string[]
  connectFolder: (path: string) => void
  disconnectFolder: () => void
  addRecentPath: (path: string) => void
}

function nameFromPath(p: string): string {
  const parts = p.replace(/\\/g, '/').split('/')
  return parts[parts.length - 1] || parts[parts.length - 2] || p
}

export const useFolderStore = create<FolderState>()(
  persist(
    (set) => ({
      connectedPath: null,
      folderName: null,
      recentPaths: [],

      connectFolder: (path: string) => {
        const name = nameFromPath(path)
        set((s) => {
          const recent = [path, ...s.recentPaths.filter((p) => p !== path)].slice(0, 8)
          return { connectedPath: path, folderName: name, recentPaths: recent }
        })
      },

      disconnectFolder: () => {
        set({ connectedPath: null, folderName: null })
      },

      addRecentPath: (path: string) => {
        set((s) => ({
          recentPaths: [path, ...s.recentPaths.filter((p) => p !== path)].slice(0, 8),
        }))
      },
    }),
    {
      name: 'sparta-folder',
      partialize: (state) => ({
        connectedPath: state.connectedPath,
        folderName: state.folderName,
        recentPaths: state.recentPaths,
      }),
    }
  )
)
