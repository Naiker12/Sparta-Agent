import { authFetch } from "@/features/auth";
import type {
  ApiMonitorEntry,
  ApiMonitorResponse,
  AudioGenerationResponse,
  InferenceStatusResponse,
  OpenAIChatChunk,
  OpenAIChatCompletionsRequest,
} from "../../types/api";
import {
  GenerationLengthError,
  StreamInterruptedError,
  parseErrorText,
  parseJsonOrThrow,
} from "./base";

export interface ActiveGenerationsResponse {
  count: number;
  thread_ids: string[];
  active?: { thread_id: string | null; kind?: string }[];
  parallel_slots: number;
}

export async function getInferenceStatus(
  signal?: AbortSignal,
): Promise<InferenceStatusResponse> {
  const response = await authFetch("/api/inference/status", { signal });
  return parseJsonOrThrow<InferenceStatusResponse>(response);
}

export async function getApiMonitor(): Promise<ApiMonitorResponse> {
  const response = await authFetch("/api/inference/monitor");
  return parseJsonOrThrow<ApiMonitorResponse>(response);
}

export async function getApiMonitorEntry(id: string): Promise<ApiMonitorEntry> {
  const response = await authFetch(
    `/api/inference/monitor/${encodeURIComponent(id)}`,
  );
  return parseJsonOrThrow<ApiMonitorEntry>(response);
}

export async function clearApiMonitor(): Promise<void> {
  const response = await authFetch("/api/inference/monitor", {
    method: "DELETE",
  });
  await parseJsonOrThrow<{ cleared: boolean }>(response);
}

export async function getActiveGenerations(): Promise<ActiveGenerationsResponse> {
  const response = await authFetch("/api/inference/active-generations");
  return parseJsonOrThrow<ActiveGenerationsResponse>(response);
}

export async function countChatInputTokens(payload: {
  model: string;
  messages: OpenAIChatCompletionsRequest["messages"];
  enable_thinking?: boolean;
  reasoning_effort?: OpenAIChatCompletionsRequest["reasoning_effort"];
  preserve_thinking?: boolean;
  enable_tools?: boolean;
  enabled_tools?: string[];
  mcp_enabled?: boolean;
  rag_scope?: Record<string, unknown>;
  auto_heal_tool_calls?: boolean;
  run_tools_locally?: boolean;
}): Promise<{ input_tokens: number; model?: string }> {
  const response = await authFetch("/api/inference/chat/count_tokens", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return parseJsonOrThrow<{ input_tokens: number; model?: string }>(response);
}

export async function resolveToolConfirmation(
  sessionId: string,
  approvalId: string,
  decision: "allow" | "deny",
): Promise<boolean> {
  const response = await authFetch("/api/inference/tool-confirm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      session_id: sessionId,
      approval_id: approvalId,
      decision,
    }),
  });
  const parsed = await parseJsonOrThrow<{ resolved?: boolean }>(response);
  return parsed.resolved === true;
}

function parseSseEvent(rawEvent: string): string[] {
  const dataLines: string[] = [];
  for (const line of rawEvent.split(/\r?\n/)) {
    if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trimStart());
    }
  }
  return dataLines;
}

function hasNonWhitespaceText(value: unknown): boolean {
  if (typeof value === "string") {
    return value.trim().length > 0;
  }
  if (Array.isArray(value)) {
    return value.some((item) => hasNonWhitespaceText(item));
  }
  if (!value || typeof value !== "object") {
    return false;
  }
  const record = value as Record<string, unknown>;
  return ["thinking", "text", "content", "reasoning", "summary"].some(
    (key) => key in record && hasNonWhitespaceText(record[key]),
  );
}

function classifyStructuredDeltaContent(content: unknown): {
  hasAssistantContent: boolean;
  hasReasoningContent: boolean;
} {
  if (typeof content === "string") {
    return {
      hasAssistantContent: hasNonWhitespaceText(content),
      hasReasoningContent: false,
    };
  }
  if (!Array.isArray(content)) {
    return {
      hasAssistantContent: false,
      hasReasoningContent: false,
    };
  }

  let hasAssistantContent = false;
  let hasReasoningContent = false;
  for (const part of content) {
    if (typeof part === "string") {
      hasAssistantContent ||= hasNonWhitespaceText(part);
      continue;
    }
    if (!part || typeof part !== "object") {
      continue;
    }
    const record = part as Record<string, unknown>;
    if (record.type === "thinking" || record.type === "reasoning") {
      hasReasoningContent ||= hasNonWhitespaceText(record);
    } else if (record.type === "text" || record.type === "output_text") {
      const text =
        typeof record.text === "string" ? record.text : record.content;
      hasAssistantContent ||= hasNonWhitespaceText(text);
    }
  }
  return { hasAssistantContent, hasReasoningContent };
}

export async function* streamChatCompletions(
  payload: OpenAIChatCompletionsRequest,
  signal: AbortSignal,
): AsyncGenerator<OpenAIChatChunk> {
  const response = await authFetch("/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(parseErrorText(response.status, body));
  }

  if (!response.body) {
    throw new Error("Stream response missing body");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let completed = false;
  let sawTerminalSignal = false;
  let terminalFinishReason: string | null = null;
  let sawAssistantContent = false;
  let sawReasoningContent = false;

  const throwIfReasoningOnlyLength = () => {
    if (
      terminalFinishReason === "length" &&
      sawReasoningContent &&
      !sawAssistantContent
    ) {
      throw new GenerationLengthError();
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        completed = true;
        if (!sawTerminalSignal) {
          throw new StreamInterruptedError();
        }
        throwIfReasoningOnlyLength();
        break;
      }

      buffer += decoder.decode(value, { stream: true });

      let separatorIndex = buffer.search(/\r?\n\r?\n/);
      while (separatorIndex >= 0) {
        const rawEvent = buffer.slice(0, separatorIndex);
        const separatorLength = buffer[separatorIndex] === "\r" ? 4 : 2;
        buffer = buffer.slice(separatorIndex + separatorLength);

        const dataLines = parseSseEvent(rawEvent);
        if (dataLines.length === 0) {
          separatorIndex = buffer.search(/\r?\n\r?\n/);
          continue;
        }

        const dataText = dataLines.join("\n");
        if (dataText === "[DONE]") {
          completed = true;
          sawTerminalSignal = true;
          throwIfReasoningOnlyLength();
          return;
        }

        const parsed = JSON.parse(dataText) as
          | OpenAIChatChunk
          | { type?: string; content?: string; error?: { message?: string } };
        if ("error" in parsed && parsed.error) {
          throw new Error(parsed.error.message || "Stream error");
        }
        if ("type" in parsed && parsed.type === "tool_status") {
          yield {
            _toolStatus: parsed.content ?? "",
          } as unknown as OpenAIChatChunk;
          separatorIndex = buffer.search(/\r?\n\r?\n/);
          continue;
        }
        if ("type" in parsed && parsed.type === "diffusion_frame") {
          yield {
            _diffusionFrame: parsed,
          } as unknown as OpenAIChatChunk;
          separatorIndex = buffer.search(/\r?\n\r?\n/);
          continue;
        }
        if (
          "type" in parsed &&
          (parsed.type === "tool_start" ||
            parsed.type === "tool_end" ||
            parsed.type === "tool_output" ||
            parsed.type === "tool_args")
        ) {
          yield { _toolEvent: parsed } as unknown as OpenAIChatChunk;
          separatorIndex = buffer.search(/\r?\n\r?\n/);
          continue;
        }
        if (
          parsed &&
          typeof parsed === "object" &&
          "type" in parsed &&
          parsed.type === "reasoning_summary"
        ) {
          yield {
            _reasoningDurationMs: (parsed as { duration_ms?: number })
              .duration_ms,
          } as unknown as OpenAIChatChunk;
          separatorIndex = buffer.search(/\r?\n\r?\n/);
          continue;
        }
        const parsedChoices = (
          parsed as {
            choices?: Array<{
              delta?: Record<string, unknown>;
              finish_reason?: string | null;
            }>;
          }
        ).choices;
        for (const choice of parsedChoices ?? []) {
          const delta = choice.delta;
          if (delta) {
            const contentState = classifyStructuredDeltaContent(delta.content);
            sawAssistantContent ||= contentState.hasAssistantContent;
            sawReasoningContent ||= contentState.hasReasoningContent;
            const reasoning =
              delta.reasoning_content ??
              delta.reasoning ??
              delta.reasoning_details;
            sawReasoningContent ||= hasNonWhitespaceText(reasoning);
          }
          if (choice.finish_reason) {
            terminalFinishReason = choice.finish_reason;
          }
        }
        const finishReason = parsedChoices?.[0]?.finish_reason;
        if (finishReason) {
          sawTerminalSignal = true;
        }
        yield parsed as OpenAIChatChunk;
        separatorIndex = buffer.search(/\r?\n\r?\n/);
      }
    }
  } finally {
    if (!completed) {
      try {
        await reader.cancel();
      } catch {
        // already closed
      }
    }
  }
}

export async function generateAudio(
  payload: OpenAIChatCompletionsRequest,
  signal: AbortSignal,
): Promise<AudioGenerationResponse> {
  const response = await authFetch("/api/inference/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, stream: false }),
    signal,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(parseErrorText(response.status, body));
  }

  return (await response.json()) as AudioGenerationResponse;
}
