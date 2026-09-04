import {
  batchListChatMessages,
  deleteChatThreads,
  getChatThread,
  listChatThreads,
  saveChatThread,
  updateChatThread,
  type ChatThreadWritePatch,
  type UpdateChatThreadOptions,
} from "../api/chat-api";
import { db } from "../db";
import type { MessageRecord, ModelType, ThreadRecord } from "../types";
import {
  isChatThreadDeleted,
  markChatThreadsDeleted,
} from "../utils/chat-thread-tombstones";
import { listStoredChatMessages } from "./message-storage";
import { isAssistantLocalThreadId } from "../utils/thread-ids";
import {
  awaitStoredChatThreadWrites,
  failedThreadRecordByThreadId,
  isThreadIncognito,
  trackStoredChatThreadRecord,
  threadRecordWrites,
} from "./storage-coordinator";

export type StoredChatThreadReadResult = {
  thread: ThreadRecord | undefined;
  cacheable: boolean;
};

type ThreadListArgs = {
  modelType?: ModelType;
  pairId?: string;
  projectId?: string | null;
  includeArchived?: boolean;
};

function matchesThreadListArgs(
  thread: ThreadRecord,
  args: ThreadListArgs,
): boolean {
  return (
    !isChatThreadDeleted(thread.id) &&
    (!args.pairId || thread.pairId === args.pairId) &&
    (args.projectId === undefined ||
      (thread.projectId ?? null) === args.projectId) &&
    (!args.modelType || thread.modelType === args.modelType) &&
    (args.includeArchived !== false || !thread.archived)
  );
}

export async function listStoredChatThreads(
  args: ThreadListArgs = {},
): Promise<ThreadRecord[]> {
  try {
    const backendThreads = await listChatThreads(args);
    return backendThreads.filter((t) => matchesThreadListArgs(t, args));
  } catch {
    const legacy = await db.threads.toArray();
    return legacy.filter((t) => matchesThreadListArgs(t, args));
  }
}

export async function getStoredChatThreadReadResult(
  threadId: string,
  options: { bounded?: boolean; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<StoredChatThreadReadResult> {
  if (isThreadIncognito(threadId)) {
    return { thread: undefined, cacheable: true };
  }
  if (isChatThreadDeleted(threadId)) {
    return { thread: undefined, cacheable: true };
  }

  // Intentar consultar al backend
  let backendThread: ThreadRecord | null = null;
  try {
    backendThread = await getChatThread(threadId, {
      bounded: options.bounded,
      timeoutMs: options.timeoutMs,
      signal: options.signal,
    });
  } catch (error) {
    // Si no es un ID local, buscar en legacy Dexie
    if (!isAssistantLocalThreadId(threadId)) {
      const legacyThread = await db.threads.get(threadId).catch(() => undefined);
      if (legacyThread && !isChatThreadDeleted(legacyThread.id)) {
        return { thread: legacyThread, cacheable: false };
      }
      throw error;
    }
    return { thread: undefined, cacheable: false };
  }

  if (backendThread && !isChatThreadDeleted(backendThread.id)) {
    return { thread: backendThread, cacheable: true };
  }

  // Si no está en backend, verificar si está en Dexie
  const legacyThread = await db.threads.get(threadId).catch(() => undefined);
  if (legacyThread && !isChatThreadDeleted(legacyThread.id)) {
    return { thread: legacyThread, cacheable: false };
  }

  return { thread: undefined, cacheable: !isAssistantLocalThreadId(threadId) };
}

export async function getStoredChatThread(
  threadId: string,
): Promise<ThreadRecord | undefined> {
  return (await getStoredChatThreadReadResult(threadId)).thread;
}

export async function ensureStoredChatThread(
  threadId: string,
  fallback?: ThreadRecord,
  options: { bounded?: boolean; signal?: AbortSignal } = {},
): Promise<ThreadRecord | undefined> {
  if (isThreadIncognito(threadId)) return undefined;
  if (isChatThreadDeleted(threadId)) return undefined;

  await awaitStoredChatThreadWrites(threadId);

  // Consultar si ya existe en backend
  try {
    const backendThread = await getChatThread(threadId, {
      bounded: options.bounded,
      signal: options.signal,
    });
    if (backendThread) return backendThread;
  } catch (error) {
    if (fallback && !isChatThreadDeleted(fallback.id)) {
      return fallback;
    }
    if (!isAssistantLocalThreadId(threadId)) {
      throw error;
    }
  }

  if (fallback) {
    return fallback;
  }

  const legacyThread = await db.threads.get(threadId).catch(() => undefined);
  if (legacyThread && !isChatThreadDeleted(legacyThread.id)) {
    return legacyThread;
  }

  return retryFailedThreadRecord(threadId);
}

async function retryFailedThreadRecord(
  threadId: string,
): Promise<ThreadRecord | undefined> {
  const createRecord = failedThreadRecordByThreadId.get(threadId);
  if (!createRecord && !threadRecordWrites.hasPending(threadId)) {
    return undefined;
  }
  if (createRecord) {
    failedThreadRecordByThreadId.delete(threadId);
    await trackStoredChatThreadRecord(threadId, createRecord);
  } else {
    await awaitStoredChatThreadWrites(threadId);
  }
  return (await getChatThread(threadId)) ?? undefined;
}

export async function saveStoredChatThread(
  thread: ThreadRecord,
): Promise<ThreadRecord> {
  if (isThreadIncognito(thread.id)) return thread;
  const saved = await saveChatThread(thread);
  await db.threads.put(saved).catch(() => {});
  return saved;
}

export async function updateStoredChatThread(
  threadId: string,
  patch: ChatThreadWritePatch,
  options: UpdateChatThreadOptions = {},
): Promise<ThreadRecord | undefined> {
  if (isThreadIncognito(threadId)) return undefined;
  const updated = await updateChatThread(threadId, patch, options);
  await db.threads.update(threadId, patch as Partial<ThreadRecord>).catch(() => {});
  return updated;
}

export async function deleteStoredChatThreads(
  threadIds: string[],
  args: { deleteFiles?: boolean } = {},
): Promise<string[]> {
  markChatThreadsDeleted(threadIds);
  const sandboxes = await deleteChatThreads(threadIds, args);
  await Promise.all(
    threadIds.map((id) => db.threads.delete(id).catch(() => {})),
  );
  return sandboxes;
}

export async function listStoredChatThreadsWithMessages(
  args: ThreadListArgs = {},
): Promise<ThreadRecord[]> {
  const threads = await listStoredChatThreads(args);
  if (threads.length === 0) return [];
  const threadIds = threads.map((t) => t.id);
  let backendByThread: Map<string, MessageRecord[]>;
  try {
    backendByThread = await batchListChatMessages(threadIds);
  } catch {
    backendByThread = new Map();
  }
  const entries = await Promise.all(
    threads.map(async (thread) => {
      const backendMessages = backendByThread.get(thread.id) ?? [];
      if (backendMessages.length > 0) {
        return { thread, hasContent: true };
      }
      const legacy = await listStoredChatMessages(thread.id).catch(() => null);
      return { thread, hasContent: legacy === null || legacy.length > 0 };
    }),
  );
  return entries.filter((e) => e.hasContent).map((e) => e.thread);
}

