import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeName =
  | 'midnight' | 'obsidian' | 'emerald' | 'rose'
  | 'amber' | 'dracula' | 'catppuccin' | 'nord'
  | 'light' | 'linen' | 'sage' | 'mist' | 'sand'

export const DARK_THEMES: readonly ThemeName[] = [
  'midnight', 'obsidian', 'emerald', 'rose',
  'amber', 'dracula', 'catppuccin', 'nord',
] as const

export function isDarkTheme(theme: ThemeName): boolean {
  return DARK_THEMES.includes(theme)
}

const THEME_OVERLAY_COLORS: Record<ThemeName, { color: string; symbolColor: string }> = {
  midnight:   { color: '#0C0C10', symbolColor: '#9CA3AF' },
  obsidian:   { color: '#121214', symbolColor: '#A1A1AA' },
  emerald:    { color: '#0B1410', symbolColor: '#A7D8C5' },
  rose:       { color: '#160C10', symbolColor: '#E5B4C7' },
  amber:      { color: '#140F08', symbolColor: '#E0B978' },
  dracula:    { color: '#191A21', symbolColor: '#BD93F9' },
  catppuccin: { color: '#1E1E2E', symbolColor: '#CDD6F4' },
  nord:       { color: '#2E3440', symbolColor: '#D8DEE9' },
  linen:      { color: '#F3EAE0', symbolColor: '#4B4039' },
  sage:       { color: '#EAEFE6', symbolColor: '#3F4A3A' },
  mist:       { color: '#E9EDF1', symbolColor: '#3A434B' },
  sand:       { color: '#F1E9DC', symbolColor: '#4A4032' },
  light:      { color: '#FFFFFF', symbolColor: '#374151' },
}

function applyOverlay(theme: ThemeName) {
  const overlay = THEME_OVERLAY_COLORS[theme] ?? THEME_OVERLAY_COLORS.midnight
  const root = document.documentElement
  root.setAttribute('data-theme', theme)
  root.setAttribute('data-theme-mode', isDarkTheme(theme) ? 'dark' : 'light')
  window.electronAPI?.setTitleBarOverlay?.(overlay)
}

interface ThemeStore {
  theme: ThemeName
  setTheme: (theme: ThemeName) => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'midnight',
      setTheme: (theme) => {
        applyOverlay(theme)
        set({ theme })
      },
    }),
    { name: 'sparta-theme' }
  )
)

export function initTheme() {
  const stored = localStorage.getItem('sparta-theme')
  let theme: ThemeName = 'midnight'
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      theme = parsed?.state?.theme ?? 'midnight'
    } catch { /* ignore parse error */ }
  }
  applyOverlay(theme)
}
