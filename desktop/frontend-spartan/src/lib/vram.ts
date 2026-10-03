export type TrainingMethod =
  | "qlora"
  | "lora"
  | "full"
  | "dpo"
  | "orpo"
  | "grpo"
  | "cpt"
  | "reward";
















/**
 * Effective bytes per parameter for 4-bit weights at driver level. Raw bnb 4-bit is ~0.5, but
 * embedding/lm_head stay fp16 and bnb adds per-block metadata, giving ~0.84-0.93; 0.9 is the mid. */
export const BNB_4BIT_LOADING_BYTES = 0.9;

/** Fixed overhead (GB) for the CUDA driver context and PyTorch runtime, independent of model
 * size. Measured at 1.34-1.46 GB; we use 1.4. */
export const LOADING_OVERHEAD_GB = 1.4;

export type VramFitStatus = "fits" | "tight" | "exceeds";

/** Bytes per parameter at fp16/bf16 (LoRA, full FT). Theoretical (2 bytes); not yet calibrated,
 * so real usage may run slightly higher (as 4-bit is 0.9 vs 0.5). */
export const FP16_LOADING_BYTES = 2.0;

function usesQuantizedLoading(
  method: TrainingMethod,
  modelId?: string,
): boolean {
  if (method === "qlora") {
    return true;
  }
  return method === "cpt" && (modelId ?? "").toLowerCase().includes("4bit");
}




export function estimateLoadingVram(
  totalParams: number,
  method: TrainingMethod = "qlora",
  modelId?: string,
): number {
  const bytesPerParam = usesQuantizedLoading(method, modelId)
    ? BNB_4BIT_LOADING_BYTES
    : FP16_LOADING_BYTES;
  const gb = (totalParams / 1e9) * bytesPerParam + LOADING_OVERHEAD_GB;
  return Math.round(gb * 10) / 10;
}

/** Check whether a model fits in available GPU VRAM: fits <= 75%; tight 75-100%; exceeds > 100%. */
export function checkVramFit(
  requiredGb: number,
  availableGb: number,
): VramFitStatus {
  if (availableGb <= 0) {
    return requiredGb <= 0 ? "fits" : "exceeds";
  }
  const ratio = requiredGb / availableGb;
  if (ratio <= 0.75) {
    return "fits";
  }
  if (ratio <= 1.0) {
    return "tight";
  }
  return "exceeds";
}

export interface ModelVramMapInput {
  id: string;
  totalParams?: number;
}

export interface ModelVramMapEntry {
  est: number;
  status: VramFitStatus | null;
}

export function buildModelVramMap(
  models: ModelVramMapInput[],
  method: TrainingMethod,
  gpu: { available: boolean; memoryTotalGb: number },
): Map<string, ModelVramMapEntry> {
  const map = new Map<string, ModelVramMapEntry>();
  for (const model of models) {
    if (!model.totalParams) {
      map.set(model.id, { est: 0, status: null });
      continue;
    }

    const est = estimateLoadingVram(model.totalParams, method, model.id);
    const status = gpu.available ? checkVramFit(est, gpu.memoryTotalGb) : null;
    map.set(model.id, { est, status });
  }
  return map;
}
