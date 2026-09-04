import { authFetch } from "@/features/auth";
import { isAssistantLocalThreadId } from "../../utils/thread-ids";
import {
  combineAbortSignals,
  disposableTimeoutSignal,
} from "@/features/hub/lib/abort-signals";
import type { MessageRecord, ModelType, ProjectRecord, ThreadRecord } from "../../types";
import {
  notifyChatHistoryUpdated,
  parseErrorText,
  parseJsonOrThrow,
  threadWriteFetch,
} from "./base";

const THREAD_WRITE_TIMEOUT_MS = 30_000;

export class ChatThreadDeletedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ChatThreadDeletedError";
  }
}

export async function listChatThreads(
  args: {
    modelType?: ModelType;
    pairId?: string;
    projectId?: string | null;
    includeArchived?: boolean;
    requireMessages?: boolean;
  } = {},
): Promise<ThreadRecord[]> {
  const params = new URLSearchParams();
  if (args.modelType) params.set("model_type", args.modelType);
  if (args.pairId) params.set("pair_id", args.pairId);
  if (args.projectId) params.set("project_id", args.projectId);
  if (args.includeArchived !== undefined) {
    params.set("include_archived", String(args.includeArchived));
  }
  if (args.requireMessages !== undefined) {
    params.set("require_messages", String(args.requireMessages));
  }
  const qs = params.toString();
  const response = await authFetch(`/api/chat/threads${qs ? `?${qs}` : ""}`);
  const data = await parseJsonOrThrow<{ threads: ThreadRecord[] }>(response);
  return Array.isArray(data.threads) ? data.threads : [];
}

export async function getChatThread(
  threadId: string,
  options: { bounded?: boolean; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<ThreadRecord | null> {
  if (isAssistantLocalThreadId(threadId)) {
    return null;
  }
  const timeout =
    options.bounded || options.timeoutMs !== undefined
      ? disposableTimeoutSignal(options.timeoutMs ?? THREAD_WRITE_TIMEOUT_MS)
      : null;
  const combined =
    timeout && options.signal
      ? combineAbortSignals([timeout.signal, options.signal])
      : null;
  const signal = combined?.signal ?? timeout?.signal ?? options.signal;
  try {
    const response = await authFetch(
      `/api/chat/threads/${encodeURIComponent(threadId)}`,
      signal ? { signal } : undefined,
    );
    if (response.status === 404) return null;
    return parseJsonOrThrow<ThreadRecord>(response);
  } finally {
    combined?.dispose();
    timeout?.dispose();
  }
}

export async function saveChatThread(
  thread: ThreadRecord,
): Promise<ThreadRecord> {
  const response = await threadWriteFetch("/api/chat/threads", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(thread),
  });
  if (response.status === 410) {
    const body = await response.json().catch(() => null);
    throw new ChatThreadDeletedError(parseErrorText(response.status, body));
  }
  const savedThread = await parseJsonOrThrow<ThreadRecord>(response);
  notifyChatHistoryUpdated();
  return savedThread;
}

export interface UpdateChatThreadOptions {
  expectedTitle?: string;
  expectedOpeningMessageId?: string;
  signal?: AbortSignal;
}

export type ChatThreadWritePatch = Partial<ThreadRecord> & {
  settingsPatch?: ThreadRecord["settings"];
  settingsSeq?: number;
  settingsWriter?: string;
};

export async function updateChatThread(
  threadId: string,
  patch: ChatThreadWritePatch,
  options: UpdateChatThreadOptions = {},
): Promise<ThreadRecord> {
  const body: Record<string, unknown> = { ...patch };
  if (options.expectedTitle !== undefined) {
    body.expectedTitle = options.expectedTitle;
  }
  if (options.expectedOpeningMessageId !== undefined) {
    body.expectedOpeningMessageId = options.expectedOpeningMessageId;
  }
  const response = await threadWriteFetch(
    `/api/chat/threads/${encodeURIComponent(threadId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
    options.signal,
  );
  const thread = await parseJsonOrThrow<ThreadRecord>(response);
  notifyChatHistoryUpdated();
  return thread;
}

export interface ForkChatThreadResult {
  thread: ThreadRecord;
  messages: MessageRecord[];
  containerSnapshotWarning: string | null;
}

export async function forkChatThread(
  threadId: string,
  args: { messageId: string; newThreadId: string; createdAt: number },
): Promise<ForkChatThreadResult> {
  const response = await authFetch(
    `/api/chat/threads/${encodeURIComponent(threadId)}/fork`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(args),
    },
  );
  const data = await parseJsonOrThrow<{
    thread: ThreadRecord;
    messages: MessageRecord[];
    containerSnapshotWarning: string | null;
  }>(response);
  notifyChatHistoryUpdated();
  return data;
}

export async function getThreadForkCounts(
  threadId: string,
): Promise<ReadonlyMap<string, number>> {
  const response = await authFetch(
    `/api/chat/threads/${encodeURIComponent(threadId)}/forks`,
  );
  if (response.status === 404) return new Map();
  const data = await parseJsonOrThrow<{ counts?: Record<string, number> }>(
    response,
  );
  return new Map(Object.entries(data.counts ?? {}));
}

export async function deleteChatThreads(
  threadIds: string[],
  args: { deleteFiles?: boolean } = {},
): Promise<string[]> {
  if (threadIds.length === 0) return [];
  const response = await threadWriteFetch("/api/chat/threads", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: threadIds, delete_files: !!args.deleteFiles }),
  });
  const data = await parseJsonOrThrow<{ sandboxes_kept?: string[] }>(response);
  notifyChatHistoryUpdated();
  return Array.isArray(data?.sandboxes_kept) ? data.sandboxes_kept : [];
}

export async function countBackendChats(): Promise<number> {
  const response = await authFetch("/api/chat/count");
  const data = await parseJsonOrThrow<{ count: number }>(response);
  return data.count;
}

export async function clearBackendChats(
  options: {
    notify?: boolean;
    operationId?: string;
    tombstoneThreadIds?: string[];
    deleteFiles?: boolean;
  } = {},
): Promise<{ deletedThreadIds: string[]; sandboxesKept: string[] }> {
  const response = await threadWriteFetch(
    `/api/chat${options.deleteFiles ? "?delete_files=true" : ""}`,
    {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: options.tombstoneThreadIds ?? [],
        operationId: options.operationId,
      }),
    },
  );
  const data = await parseJsonOrThrow<{
    deletedThreadIds?: string[];
    sandboxes_kept?: string[];
  }>(response);
  if (options.notify !== false) {
    notifyChatHistoryUpdated();
  }
  return {
    deletedThreadIds: Array.isArray(data?.deletedThreadIds)
      ? data.deletedThreadIds
      : [],
    sandboxesKept: Array.isArray(data?.sandboxes_kept)
      ? data.sandboxes_kept
      : [],
  };
}

export async function buildBackendChatExport(): Promise<{
  exportedAt: string;
  version: number;
  threadCount: number;
  projects?: ProjectRecord[];
  threads: ThreadRecord[];
  messages: MessageRecord[];
}> {
  const response = await authFetch("/api/chat/export");
  return parseJsonOrThrow(response);
}

export async function listChatImportLedger(): Promise<Set<string>> {
  const response = await authFetch("/api/chat/import-ledger");
  if (response.status === 404 || response.status === 405) return new Set();
  const data = await parseJsonOrThrow<{ threadIds: string[] }>(response);
  return new Set(data.threadIds);
}

export interface RecordChatImportLedgerResult {
  accepted: number;
  inserted: number;
  supported: boolean;
}

export async function recordChatImportLedger(
  threadIds: string[],
): Promise<RecordChatImportLedgerResult> {
  if (threadIds.length === 0) {
    return { accepted: 0, inserted: 0, supported: true };
  }
  const response = await authFetch("/api/chat/import-ledger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ threadIds }),
  });
  if (
    response.status === 404 ||
    response.status === 405 ||
    response.status === 501
  ) {
    return { accepted: 0, inserted: 0, supported: false };
  }
  const data = await parseJsonOrThrow<{ accepted: number; inserted: number }>(
    response,
  );
  return {
    accepted: data.accepted,
    inserted: data.inserted,
    supported: true,
  };
}
