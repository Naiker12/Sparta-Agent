import type { ProviderModelInfo } from "./api/providers-api";

const storageKey = "sparta.model-reasoning-catalog";
let catalog: Record<string, ProviderModelInfo["reasoning"]> | null = null;

function readCatalog() {
  if (!catalog) {
    try { catalog = JSON.parse(localStorage.getItem(storageKey) ?? "{}"); }
    catch { catalog = {}; }
    if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) catalog = {};
  }
  return catalog;
}

export function getCatalogReasoning(provider: string, model: string) {
  return readCatalog()[`${provider}:${model}`];
}

export function saveReasoningCatalog(provider: string, models: ProviderModelInfo[]) {
  const current = readCatalog();
  for (const model of models) current[`${provider.toLowerCase()}:${model.id.toLowerCase()}`] = model.reasoning ?? null;
  try { localStorage.setItem(storageKey, JSON.stringify(current)); } catch { /* Memory cache remains usable. */ }
}
