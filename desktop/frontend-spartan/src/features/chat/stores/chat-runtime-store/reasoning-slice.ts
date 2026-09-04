/**
 * Sparta Agent - Slice de Razonamiento (Thinking Mode y Reasoning Effort)
 * Controla flags de razonamiento para modelos locales y proveedores externos.
 */

import type { ReasoningEffort, ReasoningStyle } from "./types";

export interface ReasoningSliceState {
  supportsReasoning: boolean;
  reasoningAlwaysOn: boolean;
  reasoningEnabled: boolean;
  lastOpenRouterChosenModel: string | null;
  reasoningStyle: ReasoningStyle;
  reasoningEffort: ReasoningEffort;
  supportsReasoningOff: boolean;
  reasoningEffortLevels: readonly ReasoningEffort[];
  supportsPreserveThinking: boolean;
  preserveThinking: boolean;
}

export interface ReasoningSliceActions {
  setReasoningEnabled: (
    enabled: boolean,
    options?: { persist?: boolean },
  ) => void;
  setLastOpenRouterChosenModel: (chosen: string | null) => void;
  setReasoningStyle: (style: ReasoningStyle) => void;
  setReasoningEffort: (effort: ReasoningEffort) => void;
  setPreserveThinking: (value: boolean) => void;
}

export type ReasoningSlice = ReasoningSliceState & ReasoningSliceActions;

export const initialReasoningState: ReasoningSliceState = {
  supportsReasoning: false,
  reasoningAlwaysOn: false,
  reasoningEnabled: false,
  lastOpenRouterChosenModel: null,
  reasoningStyle: "enable_thinking",
  reasoningEffort: "medium",
  supportsReasoningOff: true,
  reasoningEffortLevels: [
    "none",
    "minimal",
    "low",
    "medium",
    "high",
    "max",
    "xhigh",
  ],
  supportsPreserveThinking: false,
  preserveThinking: false,
};
