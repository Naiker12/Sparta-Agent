/**
 * Sparta Agent - Debounce y Coalescencia de Parches de Configuración
 * Agrupa escrituras de configuración para evitar llamadas HTTP excesivas.
 */

import { toast } from "@/lib/toast";
import { savePersistedChatSettingsPatch } from "../../utils/chat-settings-storage";
import { retryablePatchAfterFailure } from "../../utils/settings-retry";
import { ATOMIC_SETTING_KEYS, SETTINGS_DEBOUNCE_MS } from "./constants";

export type SettingsPatch = Parameters<typeof savePersistedChatSettingsPatch>[0];

let hasShownSettingsPersistenceWarning = false;
let pendingPatch: SettingsPatch = {};
let pendingTimer: ReturnType<typeof setTimeout> | null = null;
let inflightFlush: Promise<void> = Promise.resolve();

export function warnSettingsPersistenceFailure(): void {
  if (hasShownSettingsPersistenceWarning) {
    return;
  }
  hasShownSettingsPersistenceWarning = true;
  toast.warning("Chat settings could not be persisted", {
    description: "Your changes apply now, but may reset after refresh.",
  });
}

export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export const NESTED_MAP_SETTING_KEYS = new Set<string>(["inferenceParamsByModel"]);

export function mergePatch(into: SettingsPatch, more: SettingsPatch): void {
  for (const [key, value] of Object.entries(more)) {
    const intoAny = into as Record<string, unknown>;
    const prev = intoAny[key];
    if (ATOMIC_SETTING_KEYS.has(key)) {
      intoAny[key] = value;
      continue;
    }
    if (!isPlainObject(prev) || !isPlainObject(value)) {
      intoAny[key] = value;
      continue;
    }
    if (!NESTED_MAP_SETTING_KEYS.has(key)) {
      intoAny[key] = { ...prev, ...value };
      continue;
    }
    const merged: Record<string, unknown> = { ...prev };
    for (const [id, entry] of Object.entries(value)) {
      const existing = merged[id];
      merged[id] =
        isPlainObject(existing) && isPlainObject(entry)
          ? { ...existing, ...entry }
          : entry;
    }
    intoAny[key] = merged;
  }
}

export async function flushSettingsPatch(keepalive = false): Promise<void> {
  if (Object.keys(pendingPatch).length === 0) return;
  const patch = pendingPatch;
  pendingPatch = {};
  try {
    await savePersistedChatSettingsPatch(patch, { keepalive });
  } catch (error) {
    const { patch: retryable, progressed } = retryablePatchAfterFailure(
      patch,
      error,
    );
    const retryPatch: SettingsPatch = {};
    mergePatch(retryPatch, retryable);
    mergePatch(retryPatch, pendingPatch);
    pendingPatch = retryPatch;
    warnSettingsPersistenceFailure();
    if (progressed && !keepalive && Object.keys(pendingPatch).length > 0) {
      scheduleSettingsFlush();
    }
  }
}

export function scheduleSettingsFlush(): void {
  if (pendingTimer !== null) clearTimeout(pendingTimer);
  pendingTimer = setTimeout(() => {
    pendingTimer = null;
    inflightFlush = inflightFlush
      .catch(() => undefined)
      .then(() => flushSettingsPatch());
  }, SETTINGS_DEBOUNCE_MS);
}

export function saveSettingsPatch(patch: SettingsPatch): void {
  mergePatch(pendingPatch, patch);
  scheduleSettingsFlush();
}

export function cancelPendingFlushTimer(): void {
  if (pendingTimer !== null) {
    clearTimeout(pendingTimer);
    pendingTimer = null;
  }
}

export function mergePreHydrationPatch(patch: SettingsPatch): void {
  mergePatch(pendingPatch, patch);
}

export function flushPendingSettingsNow(keepalive = false): void {
  if (Object.keys(pendingPatch).length === 0) return;
  inflightFlush = inflightFlush
    .catch(() => undefined)
    .then(() => flushSettingsPatch(keepalive));
}
