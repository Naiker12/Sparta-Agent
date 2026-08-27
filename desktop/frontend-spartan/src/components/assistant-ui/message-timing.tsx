"use client";

import { useMessageTiming, useMessage } from "@assistant-ui/react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";
import type { FC } from "react";

const formatTimingMs = (ms: number | undefined): string => {
  if (ms === undefined) return "—";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

const formatNumber = (n: number | undefined): string => {
  if (n === undefined) return "—";
  return n.toLocaleString();
};

const formatRate = (r: number | undefined): string => {
  if (r === undefined || !Number.isFinite(r)) return "—";
  return `${Math.round(r).toLocaleString()} tok/s`;
};

/**
 * Shows streaming stats as a badge with hover tooltip.
 * When server timings are available (GGUF, MLX, safetensors), shows prompt eval,
 * prompt speed, generation, speed, tokens, and cache hits. Falls back to
 * client-side metrics otherwise.
 */
export const MessageTiming: FC<{
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
}> = ({ className, side = "right" }) => {
  const timing = useMessageTiming();
  const message = useMessage();
  const t = useT();

  if (timing?.totalStreamTime === undefined) return null;

  const custom = (
    message.metadata as Record<string, unknown> | undefined
  )?.custom as
    | {
        serverTimings?: {
          prompt_ms?: number;
          prompt_per_second?: number;
          prompt_n?: number;
          predicted_ms?: number;
          predicted_per_second?: number;
          predicted_n?: number;
          cache_hits?: number;
          cache_writes?: number;
          model_format?: string;
          diffusion_parallel_tok_s?: number;
          diffusion_effective_tok_s?: number;
          diffusion_output_tok_s?: number;
          diffusion_steps?: number;
          diffusion_blocks?: number;
          diffusion_canvas?: number;
          diffusion_prompt_n?: number;
          diffusion_wall_ms?: number;
        };
      }
    | undefined;

  const st = custom?.serverTimings;
  const isDiffusion = st?.model_format === "diffusion";
  const hasPredicted = (st?.predicted_n ?? 0) > 0;
  const predictedRate =
    st?.predicted_per_second ??
    (hasPredicted && st?.predicted_ms
      ? (st.predicted_n! / st.predicted_ms) * 1000
      : undefined);
  const cacheHits = st?.cache_hits ?? 0;
  const cacheWrites = st?.cache_writes ?? 0;

  const badgeText = isDiffusion
    ? st?.diffusion_effective_tok_s != null
      ? `${Math.round(st.diffusion_effective_tok_s)} tok/s`
      : formatTimingMs(timing.totalStreamTime)
    : predictedRate != null && predictedRate > 0
      ? `${predictedRate.toFixed(1)} tok/s`
      : formatTimingMs(timing.totalStreamTime);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          tabIndex={0}
          aria-label={t("chat.timing.total")}
          className={cn(
            "flex items-center rounded-[10px] p-1 font-mono text-chat-icon-fg text-ui-13 tabular-nums transition-colors hover:bg-chat-icon-bg-hover hover:text-chat-icon-fg-hover",
            className,
          )}
        >
          {badgeText}
        </button>
      </TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={8}
        data-slot="message-timing-popover"
        variant="rich"
        className="[&_span>svg]:hidden!"
      >
        <div className="grid min-w-40 gap-1.5 text-xs">
          {st ? (
            isDiffusion ? (
            <>
              {/* DiffusionGemma: honest throughput (no autoregressive prompt speed) */}
              {timing.firstTokenTime !== undefined && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("chat.timing.firstToken")}</span>
                  <span className="font-mono tabular-nums">
                    {formatTimingMs(timing.firstTokenTime)}
                  </span>
                </div>
              )}
              {st?.diffusion_parallel_tok_s != null && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("chat.timing.speedInStep")}</span>
                  <span className="font-mono tabular-nums">
                    {formatRate(st.diffusion_parallel_tok_s)}
                  </span>
                </div>
              )}
              {st?.diffusion_effective_tok_s != null && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("chat.timing.effective")}</span>
                  <span className="font-mono tabular-nums">
                    {formatRate(st.diffusion_effective_tok_s)}
                  </span>
                </div>
              )}
              {st?.diffusion_output_tok_s != null && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("chat.timing.output")}</span>
                  <span className="font-mono tabular-nums">
                    {formatRate(st.diffusion_output_tok_s)}
                  </span>
                </div>
              )}
              {st?.diffusion_steps != null && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("chat.timing.denoising")}</span>
                  <span className="font-mono tabular-nums">
                    {formatNumber(st.diffusion_steps)} steps
                    {st?.diffusion_blocks != null
                      ? `, ${formatNumber(st.diffusion_blocks)} blocks`
                      : ""}
                  </span>
                </div>
              )}
              {st?.diffusion_canvas != null && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("chat.timing.canvas")}</span>
                  <span className="font-mono tabular-nums">
                    {formatNumber(st.diffusion_canvas)} tokens
                  </span>
                </div>
              )}
              {(st?.diffusion_wall_ms ?? st?.predicted_ms) != null && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("chat.timing.generation")}</span>
                  <span className="font-mono tabular-nums">
                    {formatTimingMs(st.diffusion_wall_ms ?? st.predicted_ms)}
                  </span>
                </div>
              )}
              {timing.tokenCount !== undefined && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("chat.timing.answerTokens")}</span>
                  <span className="font-mono tabular-nums">
                    {formatNumber(timing.tokenCount)}
                  </span>
                </div>
              )}
              {(st?.diffusion_prompt_n ?? st?.prompt_n) != null && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("chat.timing.prompt")}</span>
                  <span className="font-mono tabular-nums">
                    {formatNumber(st.diffusion_prompt_n ?? st.prompt_n)} tokens
                  </span>
                </div>
              )}
              <div className="my-0.5 border-t border-border/40" />
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{t("chat.timing.total")}</span>
                <span className="font-mono tabular-nums">
                  {formatTimingMs(timing.totalStreamTime)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{t("chat.timing.chunks")}</span>
                <span className="font-mono tabular-nums">
                  {timing.totalChunks}
                </span>
              </div>
            </>
            ) : (
            <>
              {/* Server-side metrics (GGUF, MLX, safetensors) */}
              {st?.prompt_ms != null && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("chat.timing.promptEval")}</span>
                  <span className="font-mono tabular-nums">
                    {formatTimingMs(st.prompt_ms)}
                  </span>
                </div>
              )}
              {(st?.prompt_n ?? 0) > 1 &&
                st?.prompt_per_second != null &&
                st.prompt_per_second > 0 && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("chat.timing.promptSpeed")}</span>
                  <span className="font-mono tabular-nums">
                    {st.prompt_per_second.toFixed(1)} tok/s
                  </span>
                </div>
              )}
              {hasPredicted && st?.predicted_ms != null && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("chat.timing.generation")}</span>
                  <span className="font-mono tabular-nums">
                    {formatTimingMs(st.predicted_ms)}
                  </span>
                </div>
              )}
              {predictedRate != null && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("chat.timing.speed")}</span>
                  <span className="font-mono tabular-nums">
                    {predictedRate.toFixed(1)} tok/s
                  </span>
                </div>
              )}
              {timing.tokenCount !== undefined && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("chat.timing.tokens")}</span>
                  <span className="font-mono tabular-nums">
                    {formatNumber(timing.tokenCount)}
                  </span>
                </div>
              )}
              {timing.firstTokenTime !== undefined && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("chat.timing.firstToken")}</span>
                  <span className="font-mono tabular-nums">
                    {formatTimingMs(timing.firstTokenTime)}
                  </span>
                </div>
              )}
              {st?.diffusion_steps != null && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("chat.timing.denoisingSteps")}</span>
                  <span className="font-mono tabular-nums">
                    {formatNumber(st.diffusion_steps)}
                  </span>
                </div>
              )}
              {st?.diffusion_blocks != null && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("chat.timing.blocks")}</span>
                  <span className="font-mono tabular-nums">
                    {formatNumber(st.diffusion_blocks)}
                  </span>
                </div>
              )}
              {cacheHits > 0 && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("chat.timing.cacheHits")}</span>
                  <span className="font-mono tabular-nums">
                    {formatNumber(cacheHits)}
                  </span>
                </div>
              )}
              {cacheWrites > 0 && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("chat.timing.cacheWrites")}</span>
                  <span className="font-mono tabular-nums">
                    {formatNumber(cacheWrites)}
                  </span>
                </div>
              )}
              <div className="my-0.5 border-t border-border/40" />
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{t("chat.timing.total")}</span>
                <span className="font-mono tabular-nums">
                  {formatTimingMs(timing.totalStreamTime)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{t("chat.timing.chunks")}</span>
                <span className="font-mono tabular-nums">
                  {timing.totalChunks}
                </span>
              </div>
            </>
            )
          ) : (
            <>
              {/* Client-side metrics (external provider fallback) */}
              {timing.firstTokenTime !== undefined && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("chat.timing.firstToken")}</span>
                  <span className="font-mono tabular-nums">
                    {formatTimingMs(timing.firstTokenTime)}
                  </span>
                </div>
              )}
              {cacheHits > 0 && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("chat.timing.cacheHits")}</span>
                  <span className="font-mono tabular-nums">
                    {formatNumber(cacheHits)}
                  </span>
                </div>
              )}
              {cacheWrites > 0 && (
                <div className="flex items-center justify-between gap-4">
                  <span className="text-muted-foreground">{t("chat.timing.cacheWrites")}</span>
                  <span className="font-mono tabular-nums">
                    {formatNumber(cacheWrites)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{t("chat.timing.total")}</span>
                <span className="font-mono tabular-nums">
                  {formatTimingMs(timing.totalStreamTime)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">{t("chat.timing.chunks")}</span>
                <span className="font-mono tabular-nums">
                  {timing.totalChunks}
                </span>
              </div>
            </>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
};
