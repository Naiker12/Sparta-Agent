/**
 * Manejo del guardado automático en background del hilo activo
 */

export type ThreadAutosaveHandle = {
  registerFirstSave(threadId: string, promise: Promise<void>): Promise<void>;
  awaitFirstSave(threadId: string | undefined): Promise<void>;
};

const FIRST_THREAD_SAVE_TIMEOUT_MS = 250;
const pendingFirstThreadSaves = new Map<string, Promise<void>>();

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const ThreadAutosaveHandle: ThreadAutosaveHandle = {
  registerFirstSave(threadId, promise) {
    const trackedPromise = promise.catch(() => {});
    const cleanupPromise = trackedPromise.finally(() => {
      if (pendingFirstThreadSaves.get(threadId) === cleanupPromise) {
        pendingFirstThreadSaves.delete(threadId);
      }
    });
    pendingFirstThreadSaves.set(threadId, cleanupPromise);
    return cleanupPromise;
  },

  async awaitFirstSave(threadId) {
    if (!threadId) {
      return;
    }
    const pending = pendingFirstThreadSaves.get(threadId);
    if (!pending) {
      return;
    }
    await Promise.race([pending, wait(FIRST_THREAD_SAVE_TIMEOUT_MS)]);
  },
};

export function useThreadAutosaveHandle(): ThreadAutosaveHandle {
  return ThreadAutosaveHandle;
}
