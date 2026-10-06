import { ui as englishUi } from "./locales/en/ui";
import { ui as spanishUi } from "./locales/es/ui";
import { translate, type TranslationKey } from "./messages";

const englishKeys = new Map(
  Object.entries(englishUi).map(([key, value]) => [
    value as string,
    `ui.${key}` as TranslationKey,
  ]),
);
const spanishKeys = new Map(
  Object.entries(spanishUi).map(([key, value]) => [
    value as string,
    `ui.${key}` as TranslationKey,
  ]),
);

/** Translate known application messages while preserving external diagnostics. */
export function localizeUiMessage<T>(message: T): T {
  if (typeof message !== "string") return message;
  const key = englishKeys.get(message) ?? spanishKeys.get(message);
  return key ? (translate(key) as T) : message;
}
