import type { ReactNode } from "react";
import { InfoHint } from "@/components/ui/info-hint";
import {
  PRECISION_REFUSAL_TITLE,
  denseTextEncoderBuildLabel,
  denseTransformerBuildLabel,
  formatResolvedValue,
  isNativeEngineStatus,
  isPrecisionRefusal,
} from "@/lib/resolved-precision";
import { toast } from "@/lib/toast";
import type { DiffusionStatus, DiffusionLoadProgress } from "../api";
import { ModelLoadDescription } from "@/features/chat/components/model-load-status";
import { formatBytes } from "@/features/hub/lib/format";
import { ResolvedBadge } from "./image-form-fields";

// The chat tab model-load toast styling, reused verbatim so the diffusion load toast is visually identical.
export const LOAD_TOAST_CLASSNAMES = {
  toast: "chat-model-load-toast items-center gap-2.5",
  content: "gap-0.5 flex-1 min-w-0",
  title: "leading-5",
  description: "mt-0 w-full",
} as const;

// Render the chat ModelLoadDescription for a progress poll. The base repo downloads alongside the GGUF, so the total exceeds the quant size.
export function loadToastDescription(p: DiffusionLoadProgress) {
  // "Downloading" only when bytes actually remain: a cached model (or the pre-estimate window) must not claim a download.
  const downloading = p.bytes_total > 0 && p.bytes_downloaded < p.bytes_total * 0.999;
  const title = downloading
    ? "Downloading model requirements…"
    : p.phase === "finalizing"
      ? "Loading to GPU…"
      : "Starting model…";
  const hasTotal = p.bytes_total > 0;
  return (
    <ModelLoadDescription
      title={title}
      message={
        downloading
          ? "Downloading the files required to load this model."
          : "Loading the model."
      }
      progressPercent={hasTotal ? p.fraction * 100 : null}
      progressLabel={
        hasTotal
          ? `${formatBytes(p.bytes_downloaded)} of ${formatBytes(p.bytes_total)}`
          : p.bytes_downloaded > 0
            ? `${formatBytes(p.bytes_downloaded)} downloaded`
            : null
      }
    />
  );
}

// Toast args mirroring chat: persistent, closeable, content in `description`. Pass `id` to update in place.
// `onCancel` adds chat's Cancel action, the one control that reaches a load already in flight: the model
// selector's eject is hidden for exactly the span a first load runs (nothing is resident, so it has no
// selection to eject), which left a multi-gigabyte pull with no way out.
export function loadToastArgs(
  p: DiffusionLoadProgress,
  id?: string | number,
  onCancel?: () => void,
) {
  return {
    ...(id != null ? { id } : {}),
    description: loadToastDescription(p),
    duration: Infinity,
    closeButton: true,
    ...(onCancel ? { cancel: { label: "Cancel", onClick: onCancel } } : {}),
    classNames: LOAD_TOAST_CLASSNAMES,
  };
}

export const IDLE_PROGRESS: DiffusionLoadProgress = {
  phase: null,
  bytes_downloaded: 0,
  bytes_total: 0,
  fraction: 0,
  error: null,
};

export type Busy = "loading" | "unloading" | "generating" | null;

// What a pick optimistically replaced, so a load that never takes can put all of it back. The quant
// label and the generation recipe move together at pick time, so they have to roll back together too.
export type PickRevert = {
  prev: string | null;
  steps: number;
  guidance: number;
  commitRecipeClaim?: () => void;
  releaseRecipeClaim?: () => void;
  // What the pick applied. A field the user changed after that is theirs, not ours to put back.
  appliedSteps?: number;
  appliedGuidance?: number;
};

/** One "what actually ran" line in the loaded-build summary. */
export function BuildRow({ label, value, badge }: { label: string; value: string; badge?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex shrink-0 items-center gap-1 whitespace-nowrap text-muted-foreground">
        {label}
        {badge}
      </span>
      <span className="min-w-0 truncate text-foreground">{value}</span>
    </div>
  );
}

/**
 * What the LOADED model is actually running, read from status.
 */
export function LoadedBuildSummary({ status }: { status: DiffusionStatus | null }) {
  if (!status?.loaded) return null;
  const offload = status.offload_policy ?? "none";
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border/60 px-2.5 py-2 text-ui-11">
      <div className="flex items-center gap-1 pb-0.5 text-xs font-medium text-muted-foreground">
        Loaded build
        <InfoHint>
          What the loaded model is actually running, reported by the backend. A control whose
          requested value could not be used shows it next to that control, with the reason.
        </InfoHint>
      </div>
      <BuildRow
        label="Transformer"
        value={
          status.transformer_quant
            ? formatResolvedValue("transformer_quant", status.transformer_quant)
            : denseTransformerBuildLabel(status)
        }
        badge={<ResolvedBadge status={status} controlKey="transformer_quant" />}
      />
      <BuildRow
        label="Text encoder"
        value={
          status.text_encoder_quant
            ? formatResolvedValue("text_encoder_quant", status.text_encoder_quant)
            : denseTextEncoderBuildLabel(status)
        }
        badge={<ResolvedBadge status={status} controlKey="text_encoder_quant" />}
      />
      <BuildRow
        label="Memory"
        value={
          offload === "none"
            ? `${status.memory_mode ?? "auto"} · resident`
            : `${status.memory_mode ?? "auto"} · ${offload} offload`
        }
      />
      <BuildRow
        label="Attention"
        value={
          status.attention_backend
            ? formatResolvedValue("attention_backend", status.attention_backend)
            : isNativeEngineStatus(status)
            ? "sd.cpp built-in"
            : "Native SDPA"
        }
      />
    </div>
  );
}

/** Report a failed load with precision refusal toast formatting. */
export function reportLoadFailure(message: string | null | undefined, fallback: string): void {
  const text = (message || "").trim();
  if (text && isPrecisionRefusal(text)) {
    toast.error(PRECISION_REFUSAL_TITLE, { description: text });
    return;
  }
  toast.error(text || fallback);
}
