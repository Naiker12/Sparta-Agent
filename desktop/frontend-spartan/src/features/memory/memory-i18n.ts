import { getLocale, useLocale, translate, type TranslationKey } from "@/i18n";
import { memoryMessages } from "./memory-messages";
type MemoryKey = keyof typeof memoryMessages.en;
export function translateMemory(key: MemoryKey | TranslationKey, values?: Record<string, unknown>): string {
  const template = memoryMessages[getLocale()][key as MemoryKey];
  if (!template) return translate(key as TranslationKey, values as Parameters<typeof translate>[1]);
  return template.replace(/\{(\w+)\}/g, (match, name: string) => values && Object.prototype.hasOwnProperty.call(values, name) ? String(values[name] ?? "") : match);
}
export function useMemoryT() { useLocale(); return translateMemory; }
