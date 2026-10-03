import { getAuthSessionEpoch } from "@/features/auth";
import { requestWorkJson } from "@/features/work/api/work-transport";
import type { QueuedChatRunSettings } from "../utils/queued-chat-run-settings";
import type { QueueExecutionResult } from "../utils/queue-execution-result";

export type QueueCheckpoint = {
  version: 1;
  threadId: string;
  projectId: string | null;
  items: Array<{
    id: string;
    prompt: string;
    dispatched: boolean;
    settings: QueuedChatRunSettings;
    result?: QueueExecutionResult;
  }>;
};

export type SavedPromptQueue = {
  id: string;
  revision: number;
  checkpoint: QueueCheckpoint;
};

export async function savePromptQueue(
  id: string, checkpoint: QueueCheckpoint, expectedRevision: number, epoch: number,
): Promise<number> {
  const saved = await requestWorkJson<SavedPromptQueue>(`/api/work-runs/prompt-queues/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ checkpoint, expectedRevision }),
  }, epoch);
  return saved.revision;
}

export async function listSavedPromptQueues(threadId: string): Promise<SavedPromptQueue[]> {
  const result = await requestWorkJson<{ queues: SavedPromptQueue[] }>(
    `/api/work-runs/prompt-queues?threadId=${encodeURIComponent(threadId)}`, undefined, getAuthSessionEpoch(),
  );
  return result.queues;
}
