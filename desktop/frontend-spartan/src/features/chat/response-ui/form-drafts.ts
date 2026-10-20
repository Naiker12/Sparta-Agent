import type { FormBlock } from "./panels";
import { AUTH_SESSION_CLEARED_EVENT } from "@/features/auth/session-events";

const PREFIX = "spartan:response-form:";
const MAX_AGE = 30 * 24 * 60 * 60 * 1000;
function draftKey(scope: string, form: FormBlock): string {
  // Include the schema so an edited/regenerated form never inherits incompatible data.
  return PREFIX + JSON.stringify([scope, form.id, form.fields]);
}
export function readFormDraft(scope: string | undefined, form: FormBlock): Record<string, unknown> {
  if (!scope) return {};
  try {
    const entry = JSON.parse(localStorage.getItem(draftKey(scope, form)) ?? "null");
    if (!entry || !Number.isFinite(entry.savedAt) || Date.now() - entry.savedAt > MAX_AGE || !entry.values || typeof entry.values !== "object") return {};
    return Object.fromEntries(form.fields.flatMap(field => {
      const value = entry.values[field.id];
      return typeof value === "boolean" || (typeof value === "string" && value.length <= 2000)
        ? [[field.id, value]] : [];
    }));
  } catch { return {}; }
}
export function writeFormDraft(scope: string | undefined, form: FormBlock, values: Record<string, unknown>): void {
  if (!scope) return;
  try {
    const owned = Object.keys(localStorage).filter(key => key.startsWith(PREFIX));
    for (const key of owned) {
      try { if (Date.now() - JSON.parse(localStorage.getItem(key)!).savedAt > MAX_AGE) localStorage.removeItem(key); }
      catch { localStorage.removeItem(key); }
    }
    if (owned.length >= 100) localStorage.removeItem(owned[0]);
    localStorage.setItem(draftKey(scope, form), JSON.stringify({savedAt: Date.now(), values}));
  } catch { /* Drafts remain editable if storage is unavailable. */ }
}
export function removeFormDraft(scope: string | undefined, form: FormBlock): void {
  if (!scope) return;
  try { localStorage.removeItem(draftKey(scope, form)); } catch { /* Optional cache. */ }
}
if (typeof window !== "undefined") window.addEventListener(AUTH_SESSION_CLEARED_EVENT, () => {
  try { for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) localStorage.removeItem(key); }
  catch { /* Storage may be blocked. */ }
});
