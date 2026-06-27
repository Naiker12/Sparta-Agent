import type { ITheme } from '@xterm/xterm'

// Terminal ALWAYS uses dark background, regardless of the active UI theme.
// Light-theme terminal on light UI is unreadable; VS Code and all major editors
// force a dark terminal too.
const TERMINAL_BG = '#0C0C10'

export function getXtermTheme(): ITheme {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string, fallback: string) => {
    const value = css.getPropertyValue(name).trim()
    return value || fallback
  }

  return {
    background: TERMINAL_BG,
    foreground: v('--color-terminal-foreground', '#D0D0DC'),
    cursor: v('--color-terminal-accent', '#6366F1'),
    cursorAccent: TERMINAL_BG,
    selectionBackground: v('--color-terminal-selection', '#6366F140'),
    selectionForeground: undefined,
    black: v('--color-terminal-black', '#1a1a2e'),
    red: v('--color-terminal-red', '#f56565'),
    green: v('--color-terminal-green', '#48bb78'),
    yellow: v('--color-terminal-yellow', '#ecc94b'),
    blue: v('--color-terminal-blue', '#4299e1'),
    magenta: v('--color-terminal-magenta', '#9f7aea'),
    cyan: v('--color-terminal-cyan', '#38b2ac'),
    white: v('--color-terminal-white', '#e2e8f0'),
    brightBlack: v('--color-terminal-bright-black', '#4a5568'),
    brightRed: v('--color-terminal-bright-red', '#fc8181'),
    brightGreen: v('--color-terminal-bright-green', '#68d391'),
    brightYellow: v('--color-terminal-bright-yellow', '#f6e05e'),
    brightBlue: v('--color-terminal-bright-blue', '#63b3ed'),
    brightMagenta: v('--color-terminal-bright-magenta', '#b794f4'),
    brightCyan: v('--color-terminal-bright-cyan', '#4fd1c5'),
    brightWhite: v('--color-terminal-bright-white', '#f7fafc'),
  }
}
