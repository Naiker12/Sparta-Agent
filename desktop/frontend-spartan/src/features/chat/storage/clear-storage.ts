import {
  clearBackendChats,
  notifyChatHistoryUpdated,
} from "../api/chat-api";
import { db } from "../db";
import { markChatThreadsDeleted } from "../utils/chat-thread-tombstones";
import { listStoredChatThreads } from "./thread-storage";
import {
  bumpThreadRecordClearEpoch,
  failedThreadRecordByThreadId,
  threadRecordWrites,
} from "./storage-coordinator";

export interface ClearStoredChatsResult {
  backend: "cleared" | "failed" | "skipped";
  legacy: "cleared" | "failed" | "skipped";
  deletedThreadIds: string[];
  failedThreadIds: string[];
  sandboxesKept: string[];
}

let clearStoredChatsPromise: Promise<ClearStoredChatsResult> | null = null;

export async function countStoredChats(): Promise<number> {
  return (await listStoredChatThreads()).length;
}

export function clearStoredChats(
  options: { deleteFiles?: boolean } = {},
): Promise<ClearStoredChatsResult> {
  if (clearStoredChatsPromise) return clearStoredChatsPromise;

  bumpThreadRecordClearEpoch();
  failedThreadRecordByThreadId.clear();
  const reopenAdmission = threadRecordWrites.closeAdmission();
  const operation = clearStoredChatsWithAdmissionClosed(options);
  const tracked = operation.finally(() => {
    reopenAdmission();
    if (clearStoredChatsPromise === tracked) {
      clearStoredChatsPromise = null;
    }
  });
  clearStoredChatsPromise = tracked;
  return tracked;
}

async function clearStoredChatsWithAdmissionClosed(
  options: { deleteFiles?: boolean },
): Promise<ClearStoredChatsResult> {
  const pendingThreadIds = threadRecordWrites.idsRequiringFence();
  const operationId = crypto.randomUUID();
  const legacyThreads = await db.threads.toArray().catch(() => []);
  const legacyThreadIds = new Set(legacyThreads.map((thread) => thread.id));
  const idsToFence = Array.from(
    new Set([...legacyThreadIds, ...pendingThreadIds]),
  );

  const result: ClearStoredChatsResult = {
    backend: "skipped",
    legacy: "skipped",
    deletedThreadIds: [],
    failedThreadIds: [],
    sandboxesKept: [],
  };

  let backendDeletedThreadIds: string[] = [];
  const runBackendClear = () =>
    clearBackendChats({
      notify: false,
      operationId,
      deleteFiles: options.deleteFiles,
      tombstoneThreadIds: idsToFence,
    });

  try {
    const backendResult = await runBackendClear().catch(() =>
      runBackendClear(),
    );
    backendDeletedThreadIds = backendResult.deletedThreadIds;
    result.sandboxesKept = backendResult.sandboxesKept;
    result.backend = "cleared";
    threadRecordWrites.confirmFinalState(idsToFence);
  } catch (error) {
    result.backend = "failed";
    console.error("clearStoredChats: backend clear failed", error);
  }

  try {
    await db.transaction("rw", db.threads, db.messages, async () => {
      await db.messages.clear();
      await db.threads.clear();
    });
    result.legacy = "cleared";
  } catch (error) {
    result.legacy = "failed";
    console.error("clearStoredChats: legacy Dexie clear failed", error);
  }

  const allThreadIds = Array.from(
    new Set([...legacyThreadIds, ...backendDeletedThreadIds]),
  );
  result.deletedThreadIds =
    result.backend === "cleared"
      ? allThreadIds.filter(
          (id) => !legacyThreadIds.has(id) || result.legacy === "cleared",
        )
      : [];
  const deleted = new Set(result.deletedThreadIds);
  result.failedThreadIds = allThreadIds.filter((id) => !deleted.has(id));

  markChatThreadsDeleted(result.deletedThreadIds);
  notifyChatHistoryUpdated();

  if (result.backend === "failed" && result.legacy === "failed") {
    throw new Error("clearStoredChats: both backend and legacy clear failed");
  }
  return result;
}
