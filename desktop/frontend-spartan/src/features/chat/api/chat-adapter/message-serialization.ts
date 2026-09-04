import type { ToolCallMessagePart } from "@assistant-ui/core";
import { toolCallReplayArguments } from "../../tool-call-arguments";
import {
  codexLocalToolRoundId,
  codexReasoningForToolCalls,
  readCodexReasoning,
  shouldReplayAssistantReasoning,
  startsNewCodexToolRound,
} from "../../codex-reasoning";
import {
  attachAssistantThoughtSignature,
  buildReplayContent,
  setAssistantCodexReasoning,
} from "./replay-content";
import { isWrappedWithText } from "./tool-results";
import type { RunMessage, RunMessages } from "./multimodal-detection";
import type { PendingImageEditReference } from "../../stores/chat-runtime-store";
import type {
  OpenAIChatMessage,
  OpenAIMessageContent,
  OpenAIReasoningContentPart,
} from "../../types/api";

export type {
  OpenAIChatMessage,
  OpenAIMessageContent,
  OpenAIReasoningContentPart,
};

export function normalizeOpenAIReasoningItem(
  value: unknown,
): OpenAIReasoningContentPart | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const item = value as Record<string, unknown>;
  if (item.type !== "reasoning" || typeof item.id !== "string" || !item.id) {
    return null;
  }
  const summary = Array.isArray(item.summary)
    ? item.summary.flatMap((part) => {
        if (!part || typeof part !== "object") {
          return [];
        }
        const summaryPart = part as Record<string, unknown>;
        return summaryPart.type === "summary_text" &&
          typeof summaryPart.text === "string"
          ? [{ type: "summary_text" as const, text: summaryPart.text }]
          : [];
      })
    : [];
  const normalized: OpenAIReasoningContentPart = {
    type: "reasoning",
    id: item.id,
    summary,
  };
  if (
    item.status === "in_progress" ||
    item.status === "completed" ||
    item.status === "incomplete"
  ) {
    normalized.status = item.status;
  }
  return normalized;
}

export function toOpenAIImageEditReferenceMessage(
  reference: PendingImageEditReference,
): OpenAIChatMessage | null {
  if (!reference.openaiImageGenerationCallId) {
    return null;
  }
  const content: Exclude<OpenAIMessageContent, string> = [];
  const reasoningItem = normalizeOpenAIReasoningItem(
    reference.openaiReasoningItem,
  );
  if (reasoningItem) {
    content.push(reasoningItem);
  }
  content.push({
    type: "image_generation_call",
    id: reference.openaiImageGenerationCallId,
    ...(reference.openaiResponseId
      ? { response_id: reference.openaiResponseId }
      : {}),
  });
  return { role: "assistant", content };
}


export type SerializedMessage = OpenAIChatMessage & {
  reasoning_content?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: { name: string; arguments: string };
    extra_content?: unknown;
  }>;
  extra_content?: unknown;
};

export type SerializedToolCall = NonNullable<SerializedMessage["tool_calls"]>[number];
export type SerializedToolResult = {
  role: "tool";
  content: string;
  tool_call_id: string;
  name?: string;
};

export const SERVER_SIDE_BUILTIN_TOOL_NAMES = new Set<string>([
  "web_search",
  "web_fetch",
  "code_execution",
  "image_generation",
]);

export function isServerSideBuiltinToolPart(
  toolNameLower: string,
  _argsObj: Record<string, unknown> | null,
  hasServerToolMarker: boolean,
  hasNativePart: boolean,
): boolean {
  if (!SERVER_SIDE_BUILTIN_TOOL_NAMES.has(toolNameLower)) return false;
  if (hasServerToolMarker) return true;
  return hasNativePart;
}

export function collectTextParts(message: RunMessage): string[] {
  const textParts = message.content
    .filter((part) => part.type === "text")
    .map((part) => part.text);

  if ("attachments" in message && (message.attachments?.length ?? 0) > 0) {
    for (const attachment of message.attachments ?? []) {
      for (const part of (attachment.content ?? []) as Array<{ type?: string; text?: string }>) {
        if (part.type === "text" && typeof part.text === "string") {
          textParts.push(part.text);
        }
      }
    }
  }

  return textParts;
}

export function collectImageParts(
  message: RunMessage,
): Array<{ type: "image_url"; image_url: { url: string } }> {
  const parts: Array<{ type: "image_url"; image_url: { url: string } }> = [];
  const pushImagePart = (part: { type: string }) => {
    if (part.type !== "image" || !("image" in part)) return;
    const src = (part as { image: string }).image;
    if (!src) return;
    parts.push({
      type: "image_url",
      image_url: {
        url: src.startsWith("data:") ? src : `data:image/png;base64,${src}`,
      },
    });
  };

  for (const part of message.content ?? []) {
    pushImagePart(part);
  }

  if ("attachments" in message && (message.attachments?.length ?? 0) > 0) {
    for (const attachment of message.attachments ?? []) {
      for (const part of (attachment.content ?? []) as Array<{ type?: string; image?: string }>) {
        pushImagePart(part as { type: string });
      }
    }
  }

  return parts;
}

export function sanitizeAssistantReplayText(text: string): string {
  return text.replace(
    /data:audio\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/g,
    "[audio]",
  );
}

export function isAnthropicRefusalMessage(message: RunMessage): boolean {
  if (message.role !== "assistant") return false;
  const metadata = (message as { metadata?: unknown }).metadata as
    | { custom?: Record<string, unknown> }
    | undefined;
  return metadata?.custom?.anthropicRefusal === true;
}

export function getToolPartReplayMetadata(tc: ToolCallMessagePart): {
  argsObj: Record<string, unknown> | null;
  argsGoogle: Record<string, unknown> | null;
  hasNativePart: boolean;
  isServerSideBuiltin: boolean;
} {
  const toolNameLower = (tc.toolName ?? "").toLowerCase();
  const argsObj =
    tc.args && typeof tc.args === "object"
      ? (tc.args as Record<string, unknown>)
      : null;
  const argsGoogle =
    argsObj && typeof argsObj.google === "object" && argsObj.google !== null
      ? (argsObj.google as Record<string, unknown>)
      : null;
  const hasNativePart = Boolean(
    argsGoogle &&
    typeof argsGoogle.native_part === "object" &&
    argsGoogle.native_part !== null,
  );
  const hasServerToolMarker = Boolean(
    argsObj && (argsObj as Record<string, unknown>)._server_tool === true,
  );
  return {
    argsObj,
    argsGoogle,
    hasNativePart,
    isServerSideBuiltin: isServerSideBuiltinToolPart(
      toolNameLower,
      argsObj,
      hasServerToolMarker,
      hasNativePart,
    ),
  };
}

export function serializeToolResultPart(
  part: ToolCallMessagePart,
): SerializedToolResult | null {
  const tc = part as ToolCallMessagePart;
  const result = (tc as { result?: unknown }).result;
  const { isServerSideBuiltin } = getToolPartReplayMetadata(tc);

  if (isServerSideBuiltin) {
    return null;
  }
  if (result === undefined || result === null) return null;

  let content: string;
  if (typeof result === "string") {
    content = result.length > 0 ? result : JSON.stringify({ result: "" });
  } else if (isWrappedWithText(result, tc.toolName ?? "")) {
    content =
      result.text.length > 0 ? result.text : JSON.stringify({ result: "" });
  } else {
    try {
      content = JSON.stringify(result);
    } catch {
      content = String(result);
    }
  }

  return {
    role: "tool" as const,
    content,
    tool_call_id: tc.toolCallId,
    ...(tc.toolName ? { name: tc.toolName } : {}),
  };
}

export function canReplayToolCallWithoutRoleTool(part: ToolCallMessagePart): boolean {
  return getToolPartReplayMetadata(part).isServerSideBuiltin;
}

export function serializeAssistantToolCallPart(
  part: ToolCallMessagePart,
): SerializedToolCall | null {
  const tc = part as ToolCallMessagePart & {
    argsText?: string;
    extra_content?: unknown;
  };
  const { argsGoogle, hasNativePart, isServerSideBuiltin } =
    getToolPartReplayMetadata(tc);

  if (isServerSideBuiltin && !hasNativePart) {
    return null;
  }

  const argumentsStr = toolCallReplayArguments(tc.argsText, tc.args);
  const entry: SerializedToolCall = {
    id: tc.toolCallId,
    type: "function" as const,
    function: {
      name: tc.toolName ?? "",
      arguments: argumentsStr,
    },
  };
  if (tc.extra_content !== undefined) {
    entry.extra_content = tc.extra_content;
  } else if (argsGoogle) {
    entry.extra_content = { google: argsGoogle };
  }
  return entry;
}

export function extractImageBase64(input: string): string | undefined {
  if (!input) return undefined;
  if (input.startsWith("data:")) {
    const commaIndex = input.indexOf(",");
    return commaIndex >= 0 ? input.slice(commaIndex + 1) : undefined;
  }
  return input;
}

export function findLatestUserImageBase64(messages: RunMessages): string | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.role !== "user") continue;

    for (const part of message.content ?? []) {
      if (part.type === "image" && "image" in part) {
        const encoded = extractImageBase64(part.image);
        if (encoded) return encoded;
      }
    }

    if ("attachments" in message && (message.attachments?.length ?? 0) > 0) {
      for (const attachment of message.attachments ?? []) {
        for (const part of attachment.content ?? []) {
          if (part.type === "image") {
            const encoded = extractImageBase64(part.image);
            if (encoded) return encoded;
          }
        }
      }
    }
  }
  return undefined;
}

export function collectAssistantTextThoughtSignature(
  message: RunMessage,
): string | undefined {
  if (!Array.isArray(message.content)) return undefined;
  for (let i = message.content.length - 1; i >= 0; i -= 1) {
    const part = message.content[i] as { type?: string } & Record<
      string,
      unknown
    >;
    if (part?.type !== "text") continue;
    const sig = part._google_thought_signature;
    if (typeof sig === "string" && sig) return sig;
  }
  return undefined;
}

export function serializeAssistantReplayMessages(
  message: RunMessage,
  includeReasoningContent = false,
): SerializedMessage[] {
  if (isAnthropicRefusalMessage(message)) {
    return [];
  }

  const imageParts = collectImageParts(message);
  const codexReasoning = readCodexReasoning(
    (message as { metadata?: unknown }).metadata,
  );
  const messages: SerializedMessage[] = [];
  const pendingTextParts: string[] = [];
  const pendingReasoningParts: string[] = [];
  let pendingToolCalls: SerializedToolCall[] = [];
  let pendingToolResults: SerializedToolResult[] = [];
  let imagePartsPending = imageParts.length > 0;
  let pendingLocalToolRoundId: number | null = null;

  const flushAssistantAndToolResults = (force = false): void => {
    const textContent = sanitizeAssistantReplayText(
      pendingTextParts.join("\n"),
    );
    const includeImageParts = imagePartsPending ? imageParts : [];
    const hasContent = textContent.length > 0 || includeImageParts.length > 0;
    const hasToolCalls = pendingToolCalls.length > 0;
    const reasoningContent = pendingReasoningParts.join("\n");
    const hasReasoningContent = shouldReplayAssistantReasoning({
      enabled: includeReasoningContent,
      reasoningContent,
      hasContent,
      hasToolCalls,
      incomplete: false,
    });

    if (!force && !hasContent && !hasToolCalls && !hasReasoningContent) {
      return;
    }

    const assistantMessage: SerializedMessage = {
      role: "assistant",
      content: hasContent
        ? buildReplayContent(textContent, includeImageParts)
        : "",
    };
    if (hasToolCalls) {
      assistantMessage.tool_calls = pendingToolCalls;
      if (!hasContent) {
        assistantMessage.content = null;
      }
    }
    if (hasReasoningContent) {
      assistantMessage.reasoning_content = reasoningContent;
    }

    if (hasToolCalls) {
      setAssistantCodexReasoning(
        assistantMessage,
        codexReasoningForToolCalls(
          codexReasoning,
          pendingToolCalls
            .map((call) => call.id)
            .filter((id): id is string => typeof id === "string"),
        ),
      );
    }

    messages.push(assistantMessage);
    if (pendingToolResults.length > 0) {
      messages.push(...pendingToolResults);
    }

    pendingTextParts.length = 0;
    pendingReasoningParts.length = 0;
    pendingToolCalls = [];
    pendingToolResults = [];
    imagePartsPending = false;
    pendingLocalToolRoundId = null;
  };

  for (const part of message.content ?? []) {
    if (part.type === "reasoning") {
      if (pendingToolCalls.length > 0) flushAssistantAndToolResults();
      pendingReasoningParts.push(part.text);
      continue;
    }

    if (part.type === "text") {
      if (pendingToolCalls.length > 0) flushAssistantAndToolResults();
      pendingTextParts.push(part.text);
      continue;
    }

    if (part.type === "tool-call") {
      const toolPart = part as ToolCallMessagePart;
      const toolCall = serializeAssistantToolCallPart(toolPart);
      if (!toolCall) continue;

      const toolResult = serializeToolResultPart(toolPart);
      if (!toolResult && !canReplayToolCallWithoutRoleTool(toolPart)) {
        continue;
      }

      const provenance = (toolPart as { provenance?: unknown }).provenance as { source?: string } | undefined;
      const localRoundId = codexLocalToolRoundId(provenance);
      if (
        pendingToolCalls.length > 0 &&
        startsNewCodexToolRound(pendingLocalToolRoundId, localRoundId)
      ) {
        flushAssistantAndToolResults();
      }
      if (localRoundId !== null) pendingLocalToolRoundId = localRoundId;

      pendingToolCalls.push(toolCall);
      if (toolResult) {
        pendingToolResults.push(toolResult);
      }
    }
  }

  flushAssistantAndToolResults(messages.length === 0);
  attachAssistantThoughtSignature(
    messages,
    collectAssistantTextThoughtSignature(message),
  );

  const finalAssistant = [...messages]
    .reverse()
    .find((candidate) => candidate.role === "assistant");
  if (finalAssistant) {
    setAssistantCodexReasoning(finalAssistant, codexReasoning?.final);
  }
  return messages;
}

export function toOpenAIMessages(
  message: RunMessage,
  includeReasoningContent = false,
): SerializedMessage[] {
  if (
    message.role !== "system" &&
    message.role !== "user" &&
    message.role !== "assistant"
  ) {
    return [];
  }

  if (message.role === "assistant") {
    return serializeAssistantReplayMessages(message, includeReasoningContent);
  }

  const textContent = collectTextParts(message).join("\n");
  const imageParts = collectImageParts(message);
  return [
    {
      role: message.role,
      content: buildReplayContent(textContent, imageParts),
    },
  ];
}
