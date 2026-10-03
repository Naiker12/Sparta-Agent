const ASSISTANT_LOCAL_THREAD_ID_PREFIX = "__LOCALID_";
const persistedLocalIds = new Set<string>();

/** Older versions persisted provisional IDs; authoritative records remain readable. */
export function notePersistedThreadId(threadId: string): void {
  if (threadId.startsWith(ASSISTANT_LOCAL_THREAD_ID_PREFIX)) {
    persistedLocalIds.add(threadId);
  }
}

export function isAssistantLocalThreadId(
  threadId: string | null | undefined,
): boolean {
  return Boolean(
    threadId?.startsWith(ASSISTANT_LOCAL_THREAD_ID_PREFIX) &&
      !persistedLocalIds.has(threadId),
  );
}
