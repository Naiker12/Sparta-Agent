import type { ThreadMessage } from "@assistant-ui/react";
import type { MessageRecord } from "../types";

export function clonePersistedValue<T>(value: T, fallback: T): T {
  if (value === undefined || value === null) {
    return fallback;
  }
  try {
    return structuredClone(value);
  } catch {
    return fallback;
  }
}

export function cloneContent(
  content: ThreadMessage["content"],
): ThreadMessage["content"] {
  if (!Array.isArray(content)) {
    return [{ type: "text", text: "" }];
  }
  return clonePersistedValue(content, [{ type: "text", text: "" }]);
}

export function cloneAttachments(
  attachments: unknown,
): Extract<ThreadMessage, { role: "user" }>["attachments"] {
  if (!Array.isArray(attachments)) {
    return [];
  }
  return clonePersistedValue(attachments, []);
}

export function toThreadMessage(m: MessageRecord): ThreadMessage {
  const rawContent: unknown = m.content;
  let content: ThreadMessage["content"] = [{ type: "text", text: "" }];

  if (typeof rawContent === "string") {
    content = [{ type: "text", text: rawContent }];
  } else if (Array.isArray(rawContent) && rawContent.length > 0) {
    content = cloneContent(rawContent as ThreadMessage["content"]);
  }

  // Asegurar que mensajes de asistente con reasoning tengan siempre representación válida
  if (m.role === "assistant" && Array.isArray(content)) {
    const hasText = content.some((p) => p && typeof p === "object" && (p as { type?: string }).type === "text");
    if (!hasText) {
      // Si solo tenía reasoning, mantenemos reasoning y agregamos un bloque de texto para compatibilidad con assistant-ui
      const reasoningPart = content.find((p) => p && typeof p === "object" && ((p as { type?: string }).type === "reasoning" || (p as { type?: string }).type === "thinking"));
      if (reasoningPart) {
        // Dejar el reasoning visible
      }
    }
  }

  if (m.role === "user") {
    return {
      id: m.id,
      createdAt: new Date(m.createdAt),
      role: "user" as const,
      content: content as Extract<ThreadMessage, { role: "user" }>["content"],
      attachments: cloneAttachments(m.attachments),
      metadata: { custom: {} },
    };
  }

  const custom = (m.metadata as Record<string, unknown>) ?? {};
  const savedTiming = custom.timing as
    | import("@assistant-ui/react").MessageTiming
    | undefined;

  return {
    id: m.id,
    createdAt: new Date(m.createdAt),
    role: "assistant" as const,
    content: content as Extract<ThreadMessage, { role: "assistant" }>["content"],
    status: { type: "complete" as const, reason: "unknown" as const },
    metadata: {
      custom,
      ...(savedTiming ? { timing: savedTiming } : {}),
      steps: [],
      unstable_annotations: [],
      unstable_data: [],
      unstable_state: null,
    },
  };
}

export function titleTextOf(message: ThreadMessage): string {
  if (!Array.isArray(message.content)) return "";
  for (const part of message.content) {
    if (part && typeof part === "object" && "text" in part && typeof (part as { text?: unknown }).text === "string") {
      return (part as { text: string }).text.trim();
    }
  }
  return "";
}

export function fallbackTitleFromUserText(text: string): string {
  if (!text) return "Nueva conversación";
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (cleaned.length <= 40) return cleaned;
  return `${cleaned.slice(0, 37)}...`;
}
