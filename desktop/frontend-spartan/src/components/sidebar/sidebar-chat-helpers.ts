/**
 * Sparta Agent – Sidebar Chat Helpers
 *
 * Utilidades para exportación de conversaciones de chat por formato,
 * guardado en fuentes RAG y extracción de IDs de hilos de un SidebarItem.
 */

import type { SidebarItem } from "@/features/chat";
import { CONVERSATION_MARKDOWN_FORMAT } from "@/features/chat";
import type { ConversationExportFormat } from "./sidebar-types-and-constants";

export async function exportConversationByFormat(
  threadId: string,
  format: ConversationExportFormat,
): Promise<void> {
  const exports =
    await import("@/features/chat/prompt-storage/prompt-storage-dialog");
  switch (format) {
    case "raw-jsonl":
      return exports.exportConversationRawJsonl(threadId);
    case "csv":
      return exports.exportConversationCsv(threadId);
    case "sharegpt-jsonl":
      return exports.exportConversationShareGPT(threadId);
    case CONVERSATION_MARKDOWN_FORMAT:
      return exports.exportConversationMarkdown(threadId);
    default: {
      const unhandled: never = format;
      throw new Error(`Unhandled export format: ${String(unhandled)}`);
    }
  }
}

export async function saveChatToProjectSources(
  item: SidebarItem,
  projectId: string,
): Promise<void> {
  const { saveChatItemAsProjectSource } =
    await import("@/features/chat/prompt-storage/prompt-storage-dialog");
  await saveChatItemAsProjectSource(item, projectId);
}

export function getSidebarItemThreadIds(item: SidebarItem): string[] {
  return item.threadIds?.length ? item.threadIds : [item.id];
}
