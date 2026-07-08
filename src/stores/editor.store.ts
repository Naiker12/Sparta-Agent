import { create } from 'zustand'

interface EditorState {
  openFiles: string[]
  setOpenFiles: (files: string[]) => void
  addOpenFile: (path: string) => void
  removeOpenFile: (path: string) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  openFiles: [],
  setOpenFiles: (files) => set({ openFiles: files }),
  addOpenFile: (path) =>
    set((s) => ({
      openFiles: s.openFiles.includes(path) ? s.openFiles : [...s.openFiles, path],
    })),
  removeOpenFile: (path) =>
    set((s) => ({
      openFiles: s.openFiles.filter((f) => f !== path),
    })),
}))
