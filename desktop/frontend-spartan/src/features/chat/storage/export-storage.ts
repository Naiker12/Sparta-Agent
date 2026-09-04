import { buildBackendChatExport } from "../api/chat-api";
import { db } from "../db";
import type { MessageRecord, ThreadRecord } from "../types";
import { isChatThreadDeleted } from "../utils/chat-thread-tombstones";
import { listStoredChatThreads, updateStoredChatThread } from "./thread-storage";

export interface ExportedChat {
  exportedAt: string;
  version: 1;
  threadCount: number;
  projects?: unknown[];
  threads: unknown[];
  messages: unknown[];
}

export async function moveStoredChatItemToProject(
  item: { type: "single" | "compare"; id: string },
  projectId: string | null,
): Promise<void> {
  const threadIds =
    item.type === "single"
      ? [item.id]
      : (
          await listStoredChatThreads({
            pairId: item.id,
            includeArchived: true,
          })
        ).map((thread) => thread.id);

  await Promise.all(
    Array.from(new Set(threadIds)).map((threadId) =>
      updateStoredChatThread(threadId, { projectId }),
    ),
  );
}

export async function buildStoredChatExport(): Promise<ExportedChat> {
  const [legacyThreads, legacyMessages] = await Promise.all([
    db.threads.toArray().catch(() => []),
    db.messages.toArray().catch(() => []),
  ]);
  const hasLegacyData =
    legacyThreads.some((thread) => !isChatThreadDeleted(thread.id)) ||
    legacyMessages.some((message) => !isChatThreadDeleted(message.threadId));

  const backend = await buildBackendChatExport().catch((error) => {
    if (hasLegacyData) return null;
    throw error;
  });

  const threadsById = new Map<string, unknown>();
  const backendThreadIds = new Set<string>();
  const messagesById = new Map<string, unknown>();

  for (const thread of backend?.threads ?? []) {
    if (isChatThreadDeleted(thread.id)) continue;
    backendThreadIds.add(thread.id);
    threadsById.set(thread.id, thread);
  }
  for (const message of backend?.messages ?? []) {
    if (isChatThreadDeleted(message.threadId)) continue;
    messagesById.set(message.id, message);
  }

  for (const thread of legacyThreads as ThreadRecord[]) {
    if (isChatThreadDeleted(thread.id) || backendThreadIds.has(thread.id)) {
      continue;
    }
    threadsById.set(thread.id, thread);
  }
  for (const message of legacyMessages as MessageRecord[]) {
    if (isChatThreadDeleted(message.threadId)) continue;
    if (!messagesById.has(message.id)) {
      messagesById.set(message.id, message);
    }
  }

  const threads = Array.from(threadsById.values());
  const messages = Array.from(messagesById.values());

  return {
    exportedAt: new Date().toISOString(),
    version: 1,
    threadCount: threads.length,
    projects: backend?.projects ?? [],
    threads,
    messages,
  };
}
