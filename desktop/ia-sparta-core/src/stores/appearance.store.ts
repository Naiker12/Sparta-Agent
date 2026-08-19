import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface AppearanceState {
  fontUI: string
  fontMono: string
  fontSize: string
  transparency: boolean
  borderRadius: string
  smoothAnimations: boolean
  setFontUI: (fontUI: string) => void
  setFontMono: (fontMono: string) => void
  setFontSize: (fontSize: string) => void
  setTransparency: (transparency: boolean) => void
  setBorderRadius: (borderRadius: string) => void
  setSmoothAnimations: (smoothAnimations: boolean) => void
}

const RADIUS_MAP: Record<string, { sm: string; md: string; lg: string; xl: string }> = {
  '14px': { sm: '4px', md: '8px', lg: '14px', xl: '18px' },
  '18px': { sm: '6px', md: '10px', lg: '18px', xl: '24px' },
  '8px':  { sm: '2px', md: '5px', lg: '8px', xl: '12px' },
  '0px':  { sm: '0px', md: '0px', lg: '0px', xl: '0px' },
}

export function applyAppearanceToDOM(state: {
  fontUI: string
  fontMono: string
  fontSize: string
  transparency: boolean
  borderRadius: string
  smoothAnimations: boolean
}) {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  // 1. Tipografías
  root.style.setProperty('--font-ui', state.fontUI)
  root.style.setProperty('--font-display', state.fontUI)
  root.style.setProperty('--font-mono', state.fontMono)
  root.style.setProperty('--font-code', state.fontMono)

  // 2. Tamaño de fuente base
  root.style.setProperty('--font-size-base', state.fontSize)
  root.style.fontSize = state.fontSize

  // 3. Bordes Redondeados
  const radii = RADIUS_MAP[state.borderRadius] ?? RADIUS_MAP['14px']
  root.style.setProperty('--radius-sm', radii.sm)
  root.style.setProperty('--radius-md', radii.md)
  root.style.setProperty('--radius-lg', radii.lg)
  root.style.setProperty('--radius-xl', radii.xl)
  root.style.setProperty('--radius-base', state.borderRadius)

  // 4. Transparencia y Glassmorphism
  root.setAttribute('data-transparency', String(state.transparency))
  if (state.transparency) {
    root.classList.add('glass-effect')
  } else {
    root.classList.remove('glass-effect')
  }

  // 5. Animaciones
  root.setAttribute('data-animations', String(state.smoothAnimations))
  root.style.setProperty('--transition-speed', state.smoothAnimations ? '0.15s' : '0.001s')
}

export const useAppearanceStore = create<AppearanceState>()(
  persist(
    (set, get) => ({
      fontUI: 'Geist, Inter, system-ui, sans-serif',
      fontMono: 'Geist Mono, monospace',
      fontSize: '13px',
      transparency: true,
      borderRadius: '14px',
      smoothAnimations: true,

      setFontUI: (fontUI) => {
        set({ fontUI })
        applyAppearanceToDOM(get())
      },
      setFontMono: (fontMono) => {
        set({ fontMono })
        applyAppearanceToDOM(get())
      },
      setFontSize: (fontSize) => {
        set({ fontSize })
        applyAppearanceToDOM(get())
      },
      setTransparency: (transparency) => {
        set({ transparency })
        applyAppearanceToDOM(get())
      },
      setBorderRadius: (borderRadius) => {
        set({ borderRadius })
        applyAppearanceToDOM(get())
      },
      setSmoothAnimations: (smoothAnimations) => {
        set({ smoothAnimations })
        applyAppearanceToDOM(get())
      },
    }),
    {
      name: 'sparta-appearance-prefs',
      onRehydrateStorage: () => (state) => {
        if (state) {
          applyAppearanceToDOM(state)
        }
      },
    }
  )
)

export function initAppearance() {
  if (typeof window === 'undefined') return
  const state = useAppearanceStore.getState()
  applyAppearanceToDOM(state)
}
