import type { MessageTiming } from "@assistant-ui/core";

/**
 * Estimación rápida de tokens basada en heurística de 4 caracteres por token.
 */
export function estimateTokenCount(text: string): number | undefined {
  const trimmed = text.trim();
  if (!trimmed) {
    return undefined;
  }
  return Math.max(1, Math.round(trimmed.length / 4));
}

/**
 * Construye el objeto de métricas de tiempo y velocidad de generación (tokens/segundo).
 */
export function buildTiming(
  streamStartTime: number,
  totalChunks: number,
  firstTokenTime?: number,
  totalStreamTime?: number,
  tokenCount?: number,
  toolCallCount = 0,
  tokensPerSecondOverride?: number,
): MessageTiming {
  return {
    streamStartTime,
    firstTokenTime,
    totalStreamTime,
    tokenCount,
    tokensPerSecond:
      tokensPerSecondOverride ??
      (typeof totalStreamTime === "number" &&
      totalStreamTime > 0 &&
      typeof tokenCount === "number"
        ? tokenCount / (totalStreamTime / 1000)
        : undefined),
    totalChunks,
    toolCallCount,
  };
}
