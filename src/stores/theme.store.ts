import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeName =
  | 'midnight' | 'obsidian' | 'emerald' | 'rose'
  | 'amber' | 'dracula' | 'catppuccin' | 'nord' | 'light'

interface ThemeStore {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'midnight',
      setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme)
        set({ theme })
      },
    }),
    { name: 'sparta-theme' }
  )
)

export function initTheme() {
  const stored = localStorage.getItem('sparta-theme')
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      const theme = parsed?.state?.theme ?? 'midnight'
      document.documentElement.setAttribute('data-theme', theme)
      return
    } catch {}
  }
  document.documentElement.setAttribute('data-theme', 'midnight')
}
