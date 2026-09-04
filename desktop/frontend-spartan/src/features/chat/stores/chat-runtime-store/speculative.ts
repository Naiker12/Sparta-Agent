/**
 * Sparta Agent - Gestión de Decodificación Especulativa
 * Normalización de modos de sampling especulativo (MTP, DSpark, DFlash, NGram).
 */

import { CHAT_SPECULATIVE_TYPE_KEY, PERSISTED_SPEC_MODES } from "./constants";

export function normalizeSpeculativeType(
  v: string | null | undefined,
): string | null {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (!s) return null;
  if (s === "auto" || s === "default") return "auto";
  if (s === "off") return "off";
  if (s === "mtp" || s === "draft-mtp") return "mtp";
  if (s === "dspark" || s === "draft-dspark") return "dspark";
  if (s === "dflash" || s === "draft-dflash") return "dflash";
  if (s === "ngram" || s === "ngram-mod" || s === "ngram-simple") {
    return "ngram";
  }
  if (s === "mtp+ngram") return "mtp+ngram";
  const parts = s
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const hasMtp = parts.some((p) => p === "mtp" || p === "draft-mtp");
  const hasNgram = parts.some(
    (p) => p === "ngram" || p === "ngram-mod" || p === "ngram-simple",
  );
  if (hasMtp && hasNgram) return "mtp+ngram";
  if (hasMtp) return "mtp";
  if (hasNgram) return "ngram";
  return "auto";
}

export function resolveLoadedSpeculativeSettings(response: {
  speculative_type?: string | null;
  spec_draft_n_max?: number | null;
}): {
  speculativeType: string | null;
  loadedSpeculativeType: string | null;
  specDraftNMax: number | null;
  loadedSpecDraftNMax: number | null;
} {
  const loadedSpeculativeType = normalizeSpeculativeType(
    response.speculative_type,
  );
  const loadedSpecDraftNMax = response.spec_draft_n_max ?? null;
  return {
    speculativeType: loadedSpeculativeType,
    loadedSpeculativeType,
    specDraftNMax: loadedSpecDraftNMax,
    loadedSpecDraftNMax,
  };
}

export function readPersistedSpeculativeType(): string {
  if (typeof window === "undefined") return "auto";
  try {
    const raw = window.localStorage.getItem(CHAT_SPECULATIVE_TYPE_KEY) ?? "auto";
    return PERSISTED_SPEC_MODES.has(raw) ? raw : "auto";
  } catch {
    return "auto";
  }
}

export function saveSpeculativeType(
  value: string | null,
  onPersist?: (key: string, value: string) => void,
): void {
  if (typeof window === "undefined") return;
  try {
    if (value && PERSISTED_SPEC_MODES.has(value)) {
      window.localStorage.setItem(CHAT_SPECULATIVE_TYPE_KEY, value);
      onPersist?.(CHAT_SPECULATIVE_TYPE_KEY, value);
    }
  } catch {
    // Non-fatal
  }
}
