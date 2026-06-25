import { useSettingsStore } from '@/stores/settings.store'

export function useSettings() {
  return useSettingsStore()
}
