import { useThemeStore, isDarkTheme } from '../stores/theme.store'

export function useTheme() {
  const { theme, setTheme } = useThemeStore()
  return { theme, setTheme, isDark: isDarkTheme(theme) }
}
