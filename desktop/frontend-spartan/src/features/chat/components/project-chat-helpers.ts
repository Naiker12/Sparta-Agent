/**
 * Sparta Agent – Project Chat Export & Storage Helpers
 *
 * Utilidades puras para exportación de conversaciones de proyectos,
 * guardado de hilos como fuentes RAG y extracción de fragmentos de texto.
 */

import type { MessageRecord } from "../types";
import type { SidebarItem } from "../hooks/use-chat-sidebar-items";
import { listStoredChatThreads } from "../utils/chat-history-storage";
import {
  CONVERSATION_MARKDOWN_FORMAT,
  CONVERSATION_MARKDOWN_LABEL,
} from "../utils/conversation-markdown";

export function formatProjectChatDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(timestamp));
}

/**
 * Unique thread nonce; falls back off crypto.randomUUID for non-secure
 * (HTTP LAN) contexts where it is unavailable.
 */
export function createThreadNonce(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Chat export formats, mirroring the sidebar chat menu. */
export type ProjectChatExportFormat =
  | "raw-jsonl"
  | "csv"
  | "sharegpt-jsonl"
  | typeof CONVERSATION_MARKDOWN_FORMAT;

export const PROJECT_CHAT_EXPORT_OPTIONS: Array<{
  label: string;
  format: ProjectChatExportFormat;
}> = [
  { label: "Raw JSONL", format: "raw-jsonl" },
  { label: "CSV", format: "csv" },
  { label: "ShareGPT JSONL", format: "sharegpt-jsonl" },
  {
    label: CONVERSATION_MARKDOWN_LABEL,
    format: CONVERSATION_MARKDOWN_FORMAT,
  },
];

export async function exportProjectConversation(
  threadId: string,
  format: ProjectChatExportFormat,
): Promise<void> {
  const exports = await import("../prompt-storage/prompt-storage-dialog");
  if (format === "raw-jsonl") return exports.exportConversationRawJsonl(threadId);
  if (format === "csv") return exports.exportConversationCsv(threadId);
  if (format === CONVERSATION_MARKDOWN_FORMAT)
    return exports.exportConversationMarkdown(threadId);
  if (format === "sharegpt-jsonl") return exports.exportConversationShareGPT(threadId);
  const unhandled: never = format;
  throw new Error(`Unhandled export format: ${String(unhandled)}`);
}

export async function exportProjectChatItem(
  item: SidebarItem,
  format: ProjectChatExportFormat,
): Promise<void> {
  const ids =
    item.type === "single"
      ? [item.id]
      : (await listStoredChatThreads({ pairId: item.id })).map((t) => t.id);
  for (const id of ids) await exportProjectConversation(id, format);
}

export async function saveProjectChatItemAsSource(
  item: SidebarItem,
  projectId: string,
): Promise<void> {
  const { saveChatItemAsProjectSource } = await import(
    "../prompt-storage/prompt-storage-dialog"
  );
  await saveChatItemAsProjectSource(item, projectId);
}

export function extractMessageText(content: MessageRecord["content"]): string {
  if (typeof content === "string") {
    return content;
  }
  if (!Array.isArray(content)) {
    return "";
  }
  return content
    .map((part) => {
      if (part.type === "text") {
        return part.text;
      }
      if (part.type === "image") {
        return "Image";
      }
      if (part.type === "audio") {
        return "Audio";
      }
      return "";
    })
    .filter(Boolean)
    .join(" ");
}
