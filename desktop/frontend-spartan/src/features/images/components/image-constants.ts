import type { GalleryImage, DiffusionGenerateProgress } from "../api";
import { formatEta } from "@/features/hub/lib/format";

export const CONDITIONED_WORKFLOW_INPUTS: Record<string, string> = {
  img2img: "the source image",
  inpaint: "the source image and mask",
  upscale: "the source image",
  edit: "the source image",
  reference: "the source and reference images",
  controlnet: "the control image",
};

export const ASPECT_RATIOS: Record<string, [number, number]> = {
  "1:1": [1, 1],
  "3:2": [3, 2],
  "4:3": [4, 3],
  "16:9": [16, 9],
  "21:9": [21, 9],
};

export const ASPECT_OPTIONS = ["custom", ...Object.keys(ASPECT_RATIOS)];

export const ASPECT_LABELS: Record<string, string> = {
  "1:1": "Square",
  "3:2": "Photo",
  "4:3": "Landscape",
  "16:9": "Widescreen",
  "21:9": "Ultrawide",
};

export const CONTROL_TYPE_LABELS: Record<string, string> = {
  passthrough: "Passthrough (already a map)",
  canny: "Canny (trace edges)",
  depth: "Depth (map)",
  pose: "Pose (map)",
};

export const MIN_DIM = 256;
export const MAX_DIM = 2048;
export const RUNS_SLIDER_MAX = 128;

export const DIM_OPTIONS = [
  256, 320, 384, 448, 512, 576, 640, 704, 768, 832, 896, 960, 1024, 1152, 1280,
  1408, 1536, 1664, 1792, 1920, 2048,
];

export function snapDim(value: number): number {
  if (!Number.isFinite(value)) return 1024;
  return Math.min(MAX_DIM, Math.max(MIN_DIM, Math.round(value / 16) * 16));
}

export function matchAspect(width: number, height: number): { key: string; portrait: boolean } {
  const target = Math.max(width, height) / Math.min(width, height);
  const found = Object.entries(ASPECT_RATIOS).find(
    ([, [a, b]]) => Math.abs(target - a / b) < 0.01,
  );
  return { key: found ? found[0] : "custom", portrait: height > width };
}

export const IMAGE_BLOB_BUDGET_BYTES = 192 * 1024 * 1024;
export const PAGE_SIZE = 50;
export const RESYNC_MAX_ATTEMPTS = 3;

export type ImageExportFormat = "png" | "jpeg" | "webp";

export function exportFilename(image: GalleryImage, format: ImageExportFormat = "png"): string {
  const d = new Date(image.created_at * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  const suffix = image.batch_index > 0 ? `_${image.batch_index}` : "";
  const ext = format === "jpeg" ? "jpg" : format;
  return `Unsloth_${stamp}_${image.seed}${suffix}.${ext}`;
}

export function formatTimestamp(epochSeconds: number): string {
  return new Date(epochSeconds * 1000).toLocaleString();
}

export function genStepLabel(p: DiffusionGenerateProgress): string {
  if (p.step === 0) return "Preparing (text encoding + warmup)…";
  const base = `Step ${p.step}/${p.total_steps}`;
  const eta = p.eta_seconds != null ? formatEta(p.eta_seconds) : "";
  return eta ? `${base} · ~${eta}` : base;
}

export const SETTLE_POLL_MS = 1000;
export const SETTLE_MAX_MS = 6 * 60 * 60 * 1000;
export const SETTLE_MAX_FAILS = 5;
