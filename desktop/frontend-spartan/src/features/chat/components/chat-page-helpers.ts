/**
 * Sparta Agent – Chat Page Utilities & Types
 *
 * Tipos de navegación, validadores de parámetros de búsqueda (ChatSearch)
 * y funciones auxiliares puras para modelos externos, LoRA y detección de imágenes.
 */

import type { SelectedModelInput } from "../hooks/use-chat-model-runtime";
import type { MessageRecord } from "../types";

export type ChatSearch = {
  thread?: string;
  compare?: string;
  new?: string;
  project?: string;
};

export function validateChatSearch(search: Record<string, unknown>): ChatSearch {
  return {
    thread: typeof search.thread === "string" ? search.thread : undefined,
    compare: typeof search.compare === "string" ? search.compare : undefined,
    new: typeof search.new === "string" ? search.new : undefined,
    project: typeof search.project === "string" ? search.project : undefined,
  };
}

export type PendingHubAutoLoad = {
  selection: SelectedModelInput;
  contextKey: string;
  originCheckpoint: string;
  originGgufVariant: string | null;
};

export type LoraCandidate = {
  id: string;
  baseModel: string;
  updatedAt?: number;
  exportType?: "lora" | "merged" | "gguf";
};

const EXTERNAL_PROVIDER_DROPDOWN_ORDER: Record<string, number> = {
  openai: 0,
  anthropic: 1,
};

export function getExternalProviderDropdownRank(providerType: string): number {
  return EXTERNAL_PROVIDER_DROPDOWN_ORDER[providerType] ?? 2;
}

export function normalizeModelRef(value: string | null | undefined): string {
  return value?.trim().toLowerCase() ?? "";
}

export function pickBestLoraForBase(
  loras: LoraCandidate[],
  baseModel: string | null,
): LoraCandidate | null {
  const adapterOnly = loras.filter((lora) => lora.exportType === "lora");
  if (adapterOnly.length === 0) return null;
  const sorted = [...adapterOnly].sort(
    (a, b) => (b.updatedAt ?? -1) - (a.updatedAt ?? -1),
  );
  const normalizedBase = normalizeModelRef(baseModel);
  if (!normalizedBase) return sorted[0] ?? null;

  const exact = sorted.find(
    (lora) => normalizeModelRef(lora.baseModel) === normalizedBase,
  );
  if (exact) return exact;

  const partial = sorted.find((lora) => {
    const normalizedLoraBase = normalizeModelRef(lora.baseModel);
    if (!normalizedLoraBase) return false;
    return (
      normalizedLoraBase.includes(normalizedBase) ||
      normalizedBase.includes(normalizedLoraBase)
    );
  });
  return partial ?? sorted[0] ?? null;
}

export function messageHasImage(message: MessageRecord): boolean {
  const contentParts = Array.isArray(message.content) ? message.content : [];
  if (contentParts.some((part) => part.type === "image")) {
    return true;
  }
  const attachments = Array.isArray(message.attachments)
    ? message.attachments
    : [];
  for (const attachment of attachments) {
    const parts = Array.isArray(attachment.content) ? attachment.content : [];
    for (const part of parts as Array<{ type?: string }>) {
      if (part?.type === "image") {
        return true;
      }
    }
  }
  return false;
}
