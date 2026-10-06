import { translate as uiTranslate } from "@/i18n";
/** Data checkpoint adapter; runtime targets and timers never enter storage. */
import { getAuthSessionEpoch } from "@/features/auth";
import { savePromptQueue, type QueueCheckpoint } from "@/features/chat/api/prompt-queues-api";
import { QueueCheckpointWriter } from "@/features/chat/utils/queue-checkpoint-writer";
import type { PromptQueueRun } from "./prompt-queue-types";

export type QueuePersistence = {
  threadId: string;
  epoch: number;
  writer: QueueCheckpointWriter<QueueCheckpoint>;
  heartbeat?: ReturnType<typeof setInterval>;
};

export function attachQueuePersistence(run: PromptQueueRun, threadId: string, revision = 0): void {
  if (run.persistence) return;
  const epoch = getAuthSessionEpoch();
  run.persistence = {
    threadId, epoch,
    writer: new QueueCheckpointWriter(
      (snapshot, expected) => savePromptQueue(run.id, snapshot, expected, epoch), revision,
    ),
  };
}

export async function checkpointPromptQueue(run: PromptQueueRun, empty = false): Promise<void> {
  if (!run.persistence) return Promise.resolve();
  const items = empty ? [] : run.items.slice(Math.max(run.index, 0)).filter(
    (item) => !item.target.temporary,
  ).map((item) => {
    const settings = item.target.getDurableSettings?.();
    if (!settings) throw new Error(uiTranslate("ui.the_queue_has_no_recoverable_configuration"));
    return { id: item.id, prompt: item.prompt, dispatched: item.dispatched, settings, result: item.result };
  });
  // Clone now: a later edit or deep-research consumption cannot mutate this write.
  const snapshot: QueueCheckpoint = JSON.parse(JSON.stringify({
    version: 1, threadId: run.persistence.threadId,
    projectId: run.items[0]?.target.getQueueProjectId() ?? null, items,
  }));
  return run.persistence.writer.write(snapshot);
}
