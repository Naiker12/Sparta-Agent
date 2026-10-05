import { translate as uiTranslate } from "@/i18n";
export const MODEL_PROVIDER_TYPE_OPTIONS = [
  { value: "openai", get label() { return uiTranslate("ui.openai_compatible"); } },
  { value: "anthropic", label: "Anthropic" },
] as const;

export const SUPPORTED_MODEL_PROVIDER_TYPES = MODEL_PROVIDER_TYPE_OPTIONS.map(
  (option) => option.value,
);

export function normalizeModelProviderType(value: string): string {
  return value.trim().toLowerCase();
}

export function isSupportedModelProviderType(value: string): boolean {
  const normalized = normalizeModelProviderType(value);
  return SUPPORTED_MODEL_PROVIDER_TYPES.some((type) => type === normalized);
}
