/**
 * Sparta Agent - Tipos e Interfaces de Dominio para Chat Runtime
 */

import type { ProjectAttachmentTarget } from "../../utils/project-attachment-target";

export type { ProjectAttachmentTarget };

export type PermissionMode = "ask" | "auto" | "off" | "full";

export type RagSource = { type: "thread" } | { type: "kb"; kbId: string };

export type RagMode = "hybrid" | "lexical" | "dense";

export type RagAutoInject = "auto" | "on" | "off";

export type ReasoningStyle =
  | "enable_thinking"
  | "reasoning_effort"
  | "enable_thinking_effort";

export type ReasoningEffort =
  | "none"
  | "minimal"
  | "low"
  | "medium"
  | "high"
  | "max"
  | "xhigh";

export type DiffusionCanvasFrame = {
  block: number;
  step: number;
  total: number;
  text: string;
};

export type PendingImageEditReference = {
  threadId: string | null;
  openaiImageGenerationCallId: string;
  openaiResponseId?: string;
  openaiReasoningItem?: unknown;
};

export type LoadingModelPick = {
  id: string;
  ggufVariant: string | null;
  nativePathToken: string | null;
};

export type ThreadRunOwner = {
  owner: () => void;
  local: boolean;
};

export type ToolStatusEntry = {
  status: string;
  startedAt: number;
  owner?: () => void;
};

export type ContextUsageSnapshot = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cachedTokens: number;
  cacheWriteTokens?: number;
};
