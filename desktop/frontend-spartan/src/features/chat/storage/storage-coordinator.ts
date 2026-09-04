import {
  ChatThreadDeletedError,
} from "../api/chat-api";
import {
  isChatThreadDeleted,
} from "../utils/chat-thread-tombstones";
import { ThreadRecordWriteCoordinator } from "../utils/thread-record-write-coordinator";

/** IDs de hilos que pertenecen a sesiones incógnito/temporales no persistidas. */
const incognitoThreadIds = new Set<string>();

export function markThreadIncognito(threadId: string): void {
  incognitoThreadIds.add(threadId);
}

export function unmarkThreadIncognito(threadId: string): void {
  incognitoThreadIds.delete(threadId);
}

export function isThreadIncognito(threadId: string): boolean {
  return incognitoThreadIds.has(threadId);
}

export const threadRecordWrites = new ThreadRecordWriteCoordinator(
  (threadId) =>
    new Error(
      `Chat history was cleared before thread ${threadId} could be persisted`,
    ),
  (error) => error instanceof ChatThreadDeletedError,
);

const initializingThreadRecords = new Map<string, Promise<void>>();
export const failedThreadRecordByThreadId = new Map<string, () => Promise<void>>();
export let threadRecordClearEpoch = 0;

export function bumpThreadRecordClearEpoch(): void {
  threadRecordClearEpoch++;
}

/** Espera que las escrituras en curso para un hilo concluyan. */
export function awaitStoredChatThreadWrites(threadId: string): Promise<void> {
  return threadRecordWrites.settleCurrent(threadId);
}

/** Observa y registra una inicialización asíncrona de hilo para evitar condiciones de carrera. */
export function trackStoredChatThreadRecord(
  threadId: string,
  createRecord: () => Promise<void>,
): Promise<void> {
  const inFlight = initializingThreadRecords.get(threadId);
  if (inFlight) {
    return inFlight;
  }
  const epoch = threadRecordClearEpoch;
  const work = threadRecordWrites.observe(
    threadId,
    Promise.resolve().then(createRecord),
  );
  initializingThreadRecords.set(threadId, work);
  work.then(
    () => {
      if (initializingThreadRecords.get(threadId) === work) {
        initializingThreadRecords.delete(threadId);
      }
      failedThreadRecordByThreadId.delete(threadId);
    },
    () => {
      if (initializingThreadRecords.get(threadId) === work) {
        initializingThreadRecords.delete(threadId);
      }
      if (epoch === threadRecordClearEpoch && !isChatThreadDeleted(threadId)) {
        failedThreadRecordByThreadId.set(threadId, createRecord);
      }
    },
  );
  return work;
}

export function isExpectedBackgroundChatStorageError(error: unknown): boolean {
  return (
    error instanceof Error &&
    (error.message === "Invalid or expired token" ||
      error.message === "Not authenticated" ||
      error.message === "Request failed (401)" ||
      error.message.includes("Sparta Agent") ||
      error.message.includes("database is locked"))
  );
}
