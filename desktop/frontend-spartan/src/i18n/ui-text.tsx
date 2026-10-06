import { useT, type TranslationKey } from "./index";

/** Reactive text for JSX emitted by non-component rendering helpers. */
export function UiText({ messageKey }: { messageKey: TranslationKey }) {
  const t = useT();
  return <>{t(messageKey)}</>;
}
