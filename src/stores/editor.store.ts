import { create } from 'zustand'

interface EditorState {
  openFiles: string[]
  activeFilePath: string | undefined
  setOpenFiles: (files: string[]) => void
  setActiveFilePath: (path: string | undefined) => void
  addOpenFile: (path: string) => void
  removeOpenFile: (path: string) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  openFiles: [],
  activeFilePath: undefined,
  setOpenFiles: (files) => set({ openFiles: files }),
  setActiveFilePath: (path) => set({ activeFilePath: path }),
  addOpenFile: (path) =>
    set((s) => ({
      openFiles: s.openFiles.includes(path) ? s.openFiles : [...s.openFiles, path],
    })),
  removeOpenFile: (path) =>
    set((s) => ({
      openFiles: s.openFiles.filter((f) => f !== path),
    })),
}))
