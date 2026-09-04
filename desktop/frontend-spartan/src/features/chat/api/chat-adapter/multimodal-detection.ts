import type { ChatModelAdapter } from "@assistant-ui/react";
import { useChatRuntimeStore } from "../../stores/chat-runtime-store";

export type RunMessages = Parameters<ChatModelAdapter["run"]>[0]["messages"];
export type RunMessage = RunMessages[number];

export const CANVAS_TOOL_INSTRUCTION =
  "When the user asks for an HTML, CSS, or JavaScript canvas, call render_html once with one complete self-contained HTML document in the code argument. Embed CSS and JavaScript inside the document. After render_html succeeds, do not call it again in the same response unless the user asks for changes. Future user requests for new canvases may call render_html once.";

export const CANVAS_FALLBACK_INSTRUCTION =
  "When the user asks for an HTML, CSS, or JavaScript canvas, return one complete self-contained fenced html code block. Embed CSS and JavaScript inside the document. Do not emit tool-call syntax.";

export function messagesContainImage(messages: RunMessages): boolean {
  const isImage = (part: { type: string }) =>
    part.type === "image" &&
    "image" in part &&
    Boolean((part as { image: string }).image);
  for (const message of messages) {
    for (const part of message.content ?? []) {
      if (isImage(part)) return true;
    }
    if ("attachments" in message) {
      for (const attachment of message.attachments ?? []) {
        for (const part of attachment.content ?? []) {
          if (isImage(part)) return true;
        }
      }
    }
  }
  return false;
}

export function extractAudioPartBase64(
  part: { type: string } | null | undefined,
): string | undefined {
  if (!part || part.type !== "audio" || !("audio" in part)) return undefined;
  const audioPart = (
    part as unknown as {
      type: "audio";
      audio: string | { data: string; format: string };
    }
  ).audio;
  const raw = typeof audioPart === "string" ? audioPart : audioPart?.data;
  if (!raw) return undefined;
  return raw.startsWith("data:") ? raw.split(",")[1] : raw;
}

export function findLatestUserAudioBase64(
  messages: RunMessages,
  includePendingAudio = true,
): string | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.role !== "user") continue;

    for (const part of message.content ?? []) {
      const base64 = extractAudioPartBase64(part);
      if (base64) return base64;
    }

    if ("attachments" in message) {
      for (const attachment of message.attachments ?? []) {
        for (const part of attachment.content ?? []) {
          const base64 = extractAudioPartBase64(part);
          if (base64) return base64;
        }
      }
    }
    break;
  }

  const pendingAudio = includePendingAudio
    ? useChatRuntimeStore.getState().pendingAudioBase64
    : null;
  return pendingAudio ?? undefined;
}

export function extractVideoPartBase64(
  part: { type: string } | null | undefined,
): string | undefined {
  if (!part || part.type !== "file") return undefined;
  const filePart = part as unknown as { data?: string; mimeType?: string };
  if (!filePart.data || !/^video\//i.test(filePart.mimeType ?? ""))
    return undefined;
  return filePart.data.startsWith("data:")
    ? filePart.data.split(",")[1]
    : filePart.data;
}

export function findLatestUserVideoBase64(
  messages: RunMessages,
): string | undefined {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (!message || message.role !== "user") continue;
    for (const part of message.content ?? []) {
      const base64 = extractVideoPartBase64(part);
      if (base64) return base64;
    }
    if ("attachments" in message) {
      for (const attachment of message.attachments ?? []) {
        for (const part of attachment.content ?? []) {
          const base64 = extractVideoPartBase64(part);
          if (base64) return base64;
        }
      }
    }
    break;
  }
  return undefined;
}
