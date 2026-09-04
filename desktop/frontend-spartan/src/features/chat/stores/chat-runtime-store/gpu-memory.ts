/**
 * Sparta Agent - Gestión y Asignación de Memoria GPU para Chat Runtime
 * Funciones de particionamiento, split y reconciliación de IDs de GPU.
 */

import {
  cachedPinnableGpuIndexKind,
  reconcileCachedGpuSelection,
  type ReconciledGpuSelection,
  type GpuIndexKind,
} from "@/hooks/use-gpu-info";
import {
  GPU_LAYERS_AUTO,
  recoverDroppedDiffusionSplit,
  shouldHydrateGpuPlacementControls,
} from "../../lib/gpu-placement";
import { CHAT_GPU_MEMORY_MODE_KEY } from "./constants";

export { GPU_LAYERS_AUTO };

export function readPersistedGpuMemoryMode(): "auto" | "manual" {
  if (typeof window === "undefined") return "auto";
  try {
    const raw = window.localStorage.getItem(CHAT_GPU_MEMORY_MODE_KEY);
    return raw === "manual" ? "manual" : "auto";
  } catch {
    return "auto";
  }
}

export function saveGpuMemoryMode(
  value: "auto" | "manual",
  onPersist?: (key: string, value: string) => void,
): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAT_GPU_MEMORY_MODE_KEY, value);
    onPersist?.(CHAT_GPU_MEMORY_MODE_KEY, value);
  } catch {
    // Non-fatal
  }
}

export function persistGpuMemoryModeOnLoad(
  resp: { is_gguf?: boolean; is_diffusion?: boolean },
  mode: "auto" | "manual",
  onPersist?: (key: string, value: string) => void,
): void {
  if (resp.is_gguf && !resp.is_diffusion) {
    saveGpuMemoryMode(mode, onPersist);
  }
}

export function largestRemainder(shares: number[], total: number): number[] {
  const out = shares.map((x) => Math.floor(x));
  let rem = total - out.reduce((a, b) => a + b, 0);
  const byFrac = shares
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac);
  for (let k = 0; rem > 0 && k < byFrac.length; k++, rem--) out[byFrac[k].i] += 1;
  return out;
}

export function distributeByWeight(total: number, weights: number[]): number[] {
  if (weights.length === 0) return [];
  const t = Math.max(0, Math.floor(total));
  const sum = weights.reduce((a, b) => a + b, 0);
  const w = sum > 0 ? weights : weights.map(() => 1);
  const wSum = w.reduce((a, b) => a + b, 0);
  return largestRemainder(
    w.map((x) => (t * x) / wSum),
    t,
  );
}

export function rebalanceSplit(
  total: number,
  counts: number[],
  index: number,
  value: number,
): number[] {
  const v = Math.max(0, Math.min(value, total));
  const out = counts.slice();
  const otherIdx = counts.map((_, i) => i).filter((i) => i !== index);
  if (otherIdx.length === 0) {
    out[index] = total;
    return out;
  }
  out[index] = v;
  const dist = distributeByWeight(
    total - v,
    otherIdx.map((i) => counts[i]),
  );
  otherIdx.forEach((i, k) => (out[i] = dist[k]));
  return out;
}

export function reconcilePersistedGpuIds(
  ids: number[] | null,
  savedIndexKind?: GpuIndexKind | null,
  forDiffusion = false,
): number[] | null {
  return reconcilePersistedGpuSelection(
    ids,
    savedIndexKind,
    forDiffusion,
  ).ids;
}

export function reconcilePersistedGpuSelection(
  ids: number[] | null,
  savedIndexKind?: GpuIndexKind | null,
  forDiffusion = false,
): ReconciledGpuSelection {
  return reconcileCachedGpuSelection(ids, savedIndexKind, forDiffusion);
}

export function requestedGpuIdsFromResponse(resp: {
  gpu_ids?: number[] | null;
  requested_gpu_ids?: number[] | null;
}): number[] | null {
  return Object.prototype.hasOwnProperty.call(resp, "requested_gpu_ids")
    ? (resp.requested_gpu_ids ?? null)
    : (resp.gpu_ids ?? null);
}

export function loadedGpuMemoryFields(resp: {
  is_gguf?: boolean;
  is_diffusion?: boolean;
  gpu_memory_mode?: "auto" | "manual";
  gpu_layers?: number;
  cpu_fallback_reason?: "vulkan_startup_crash" | null;
  n_cpu_moe?: number;
  tensor_split?: number[] | null;
  n_layers?: number | null;
  n_moe_layers?: number;
  gpu_ids?: number[] | null;
  requested_gpu_ids?: number[] | null;
  diffusion_requested_ngl?: number | null;
}) {
  if (!resp.is_gguf) {
    return {
      selectedGpuIds: null,
      selectedGpuIndexKind: null,
      loadedGpuIds: null,
      loadedGpuIndexKind: null,
      loadedGpuMemoryMode: null,
      loadedCpuFallback: false,
      gpuLayers: GPU_LAYERS_AUTO,
      loadedGpuLayers: null,
      nCpuMoe: 0,
      loadedNCpuMoe: null,
      splitRatio: null,
      loadedSplitRatio: null,
      ggufLayerCount: null,
      moeLayerCount: null,
    };
  }
  const mode = resp.gpu_memory_mode ?? "auto";
  const hydratePlacementControls = shouldHydrateGpuPlacementControls(
    resp.cpu_fallback_reason,
  );
  const reportedGpuIds = requestedGpuIdsFromResponse(resp);
  const gpuIndexKind =
    reportedGpuIds == null
      ? null
      : cachedPinnableGpuIndexKind(resp.is_diffusion === true);
  const gpuIds =
    reportedGpuIds != null && gpuIndexKind !== null ? reportedGpuIds : null;
  const droppedSplit = recoverDroppedDiffusionSplit(
    resp.is_diffusion,
    mode,
    resp.diffusion_requested_ngl,
  );
  const manualKnobs =
    mode === "manual"
      ? {
          loadedGpuLayers: resp.gpu_layers ?? null,
          loadedNCpuMoe: resp.n_cpu_moe ?? null,
          loadedSplitRatio: resp.tensor_split ?? null,
          ...(hydratePlacementControls
            ? {
                gpuLayers: resp.gpu_layers ?? GPU_LAYERS_AUTO,
                nCpuMoe: resp.n_cpu_moe ?? 0,
                splitRatio: resp.tensor_split ?? null,
              }
            : {}),
        }
      : {
          loadedGpuLayers: null,
          loadedNCpuMoe: null,
          loadedSplitRatio: null,
          ...(resp.is_diffusion
            ? droppedSplit != null
              ? { gpuLayers: droppedSplit }
              : {}
            : { gpuLayers: GPU_LAYERS_AUTO }),
          nCpuMoe: 0,
          splitRatio: null,
        };
  return {
    ...(hydratePlacementControls
      ? resp.is_diffusion && mode !== "manual"
        ? droppedSplit != null
          ? { gpuMemoryMode: "manual" as const }
          : {}
        : { gpuMemoryMode: mode }
      : {}),
    loadedGpuMemoryMode: mode,
    loadedCpuFallback: resp.cpu_fallback_reason === "vulkan_startup_crash",
    ggufLayerCount: resp.n_layers ?? null,
    moeLayerCount: resp.n_moe_layers ?? null,
    selectedGpuIds: gpuIds,
    selectedGpuIndexKind: gpuIds == null ? null : (gpuIndexKind ?? null),
    loadedGpuIds: gpuIds,
    loadedGpuIndexKind: gpuIds == null ? null : (gpuIndexKind ?? null),
    ...manualKnobs,
  };
}
