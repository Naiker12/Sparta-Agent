import { es } from './locales/es'
import { en } from './locales/en'
import { useSettingsStore } from 'ia-sparta-core'

export * from './locales/es'
export * from './locales/en'

type Dict = typeof es

const dicts: Record<string, Dict> = { es, en }

function getNestedValue(obj: Record<string, unknown>, path: string): string {
  const keys = path.split('.')
  let current: unknown = obj
  for (const key of keys) {
    if (typeof current !== 'object' || current === null) return path
    current = (current as Record<string, unknown>)[key]
  }
  return typeof current === 'string' ? current : path
}

export function useTranslation() {
  const lang = useSettingsStore((s) => s.language)
  const dict = dicts[lang] || es
  return {
    t: (path: string): string => getNestedValue(dict as unknown as Record<string, unknown>, path),
    lang,
  }
}
