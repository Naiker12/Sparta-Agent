import type { LastLocalModelKind } from "../../utils/last-local-model-load";
import type { GgufVariantDetail } from "../../types/api";

export type AutoLoadSource = {
  kind: LastLocalModelKind;
  /** Catalog id: per-model settings, toasts, remembered-model matching. */
  id: string;
  /** Sent to /api/inference/load as model_path. */
  loadId: string;
  sizeBytes: number;
  maxSeqLength: number;
  /** null when the target is one file already (a local .gguf) or safetensors. */
  listVariants: (() => Promise<GgufVariantDetail[]>) | null;
};

export function normalizeAutoLoadTarget(value: string): string {
  const target = value.trim().normalize("NFC");
  if (/^[A-Za-z]:[\\/]/.test(target) || target.startsWith("\\\\")) {
    const slashed = target.replace(/\\/g, "/");
    return /^\/\/wsl[$.]/i.test(slashed) ? slashed : slashed.toLowerCase();
  }
  return /^[/~]/.test(target) ? target : target.toLowerCase();
}

export function autoLoadSourceKey(source: AutoLoadSource): string {
  return normalizeAutoLoadTarget(source.loadId);
}

export function isRememberedAutoLoadSource(
  source: AutoLoadSource,
  remembered: { id: string; kind: LastLocalModelKind },
): boolean {
  if (source.kind !== remembered.kind) return false;
  const target = normalizeAutoLoadTarget(remembered.id);
  return normalizeAutoLoadTarget(source.id) === target || normalizeAutoLoadTarget(source.loadId) === target;
}

/** Last used first, then GGUF before safetensors, then smallest first. */
export function orderAutoLoadSources(
  sources: AutoLoadSource[],
  remembered: { id: string; kind: LastLocalModelKind } | null,
): AutoLoadSource[] {
  const rank = (source: AutoLoadSource): number => {
    if (remembered && isRememberedAutoLoadSource(source, remembered)) return 0;
    return source.kind === "gguf" ? 1 : 2;
  };
  const size = (source: AutoLoadSource): number =>
    source.sizeBytes > 0 ? source.sizeBytes : Number.MAX_SAFE_INTEGER;
  return [...sources].sort((a, b) => rank(a) - rank(b) || size(a) - size(b));
}
