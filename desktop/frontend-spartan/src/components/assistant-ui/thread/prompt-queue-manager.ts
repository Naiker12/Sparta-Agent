/**
 * Sparta Agent - Gestor del Motor de Cola de Prompts
 * Controla el despacho secuencial, polling de estado, reintentos con backoff
 * y reordenamiento de turnos pendientes entre conversaciones.
 */

import { createContext } from "react";
import {
  PROMPT_QUEUE_RUN_FAILED_EVENT,
  PROMPT_QUEUE_STOP_EVENT,
  planLocalPromptQueueStop,
  promptQueueActiveItemChanged,
  reorderPromptQueueItems,
  type PromptQueueRunFailedEventDetail,
  type PromptQueueStopEventDetail,
} from "@/features/chat";
import { resolveProjectId } from "@/features/chat/api/chat-adapter";
import { useChatRuntimeStore } from "@/features/chat/stores/chat-runtime-store";
import {
  usePromptQueueUI,
  type PromptQueueUIEntry,
  type PromptQueueUIItem,
  type PromptQueueUIItemStatus,
  type PromptQueueUIState,
} from "@/features/chat/stores/prompt-queue-ui-store";
import { discardQueuedChatRunSettingsForThread } from "@/features/chat/utils/queued-chat-run-settings";
import {
  isRagClientError,
  listProjectDocuments,
  listThreadDocuments,
  projectWorkCount,
} from "@/features/rag/api/rag-api";
import { useRagAvailabilityStore } from "@/features/rag/api/rag-availability";
import {
  PROMPT_QUEUE_DISPATCH_RETRY_MS,
  PROMPT_QUEUE_INDEXING_RETRY_MS,
  PROMPT_QUEUE_MAX_DISPATCH_RETRIES,
  PROMPT_QUEUE_TARGET_STATE_POLL_MS,
  type PromptQueueCallbacks,
  type PromptQueueItem,
  type PromptQueueRun,
  type PromptQueueTarget,
} from "./prompt-queue-types";

const promptQueueRuns = new Map<string, PromptQueueRun>();
const promptQueueActiveRunIds = new Set<string>();
const promptQueueDispatchingRunIds = new Set<string>();
const promptQueueRunOrder: string[] = [];
let promptQueueStoreUnsub: (() => void) | null = null;
let promptQueuePumpTimer: ReturnType<typeof setTimeout> | null = null;
let promptQueueRoundRobinCursor = 0;

export function compactIds(ids: Array<string | null | undefined>): string[] {
  return Array.from(new Set(ids.filter((id): id is string => Boolean(id))));
}

export function createPromptQueueItemId(): string {
  return `prompt-queue-${crypto.randomUUID()}`;
}

export function createPromptQueueRunId(): string {
  return `prompt-queue-run-${crypto.randomUUID()}`;
}

function stopPromptQueueSubscription(): void {
  if (promptQueueStoreUnsub) {
    promptQueueStoreUnsub();
    promptQueueStoreUnsub = null;
  }
}

function clearPromptQueuePumpTimer(): void {
  if (!promptQueuePumpTimer) return;
  clearTimeout(promptQueuePumpTimer);
  promptQueuePumpTimer = null;
}

function clearPromptQueueRetryTimer(run: PromptQueueRun): void {
  if (!run.retryTimer) return;
  clearTimeout(run.retryTimer);
  run.retryTimer = null;
}

export function deletePromptQueueRun(run: PromptQueueRun): void {
  run.generation += 1;
  clearPromptQueueRetryTimer(run);
  promptQueueActiveRunIds.delete(run.id);
  promptQueueDispatchingRunIds.delete(run.id);
  promptQueueRuns.delete(run.id);
  const orderIndex = promptQueueRunOrder.indexOf(run.id);
  if (orderIndex >= 0) {
    promptQueueRunOrder.splice(orderIndex, 1);
    if (promptQueueRoundRobinCursor > orderIndex) {
      promptQueueRoundRobinCursor -= 1;
    }
    if (promptQueueRunOrder.length > 0) {
      promptQueueRoundRobinCursor %= promptQueueRunOrder.length;
    } else {
      promptQueueRoundRobinCursor = 0;
    }
  }
  if (promptQueueRuns.size === 0) {
    clearPromptQueuePumpTimer();
    stopPromptQueueSubscription();
  }
  syncPromptQueueUI();
}

export function resetPromptQueues(): void {
  for (const run of promptQueueRuns.values()) {
    run.generation += 1;
    clearPromptQueueRetryTimer(run);
  }
  promptQueueRuns.clear();
  promptQueueActiveRunIds.clear();
  promptQueueDispatchingRunIds.clear();
  promptQueueRunOrder.length = 0;
  promptQueueRoundRobinCursor = 0;
  clearPromptQueuePumpTimer();
  stopPromptQueueSubscription();
  syncPromptQueueUI();
}

export function requestPromptQueuePumpIfReady(delay = 0): void {
  if (hasReadyPromptQueueRun()) {
    requestPromptQueuePump(delay);
  }
}

function handleQueuedPromptAppendFailure(
  run: PromptQueueRun,
  item: PromptQueueItem,
  error: unknown,
): void {
  if (!isActivePromptQueueItem(run, item, run.generation)) return;
  item.dispatched = false;
  promptQueueActiveRunIds.delete(run.id);
  syncPromptQueueUI();
  item.dispatchRetries += 1;
  if (item.dispatchRetries > PROMPT_QUEUE_MAX_DISPATCH_RETRIES) {
    console.error("Prompt queue dispatch failed permanently:", error);
    try {
      item.target.cancel();
    } catch (cleanupError) {
      console.error("Prompt queue cleanup failed:", cleanupError);
    }
    deletePromptQueueRun(run);
    requestPromptQueuePumpIfReady();
    return;
  }
  item.target.complete();
  scheduleQueuedPromptDispatch(run, item, PROMPT_QUEUE_DISPATCH_RETRY_MS);
}

function consumePromptQueueDeepResearch(
  run: PromptQueueRun,
  item: PromptQueueItem,
): void {
  if (run.deepResearchConsumed || !item.target.usesDeepResearch) return;
  run.deepResearchConsumed = true;
  for (const queueItem of run.items) {
    queueItem.target.consumeDeepResearch();
  }
}

function appendQueuedPrompt(run: PromptQueueRun, item: PromptQueueItem): void {
  item.dispatched = true;
  promptQueueActiveRunIds.add(run.id);
  syncPromptQueueUI();
  try {
    const result = item.target.append(item.prompt);
    if (result && typeof result.catch === "function") {
      void result
        .then(() => consumePromptQueueDeepResearch(run, item))
        .catch((error) => {
          handleQueuedPromptAppendFailure(run, item, error);
        });
    } else {
      consumePromptQueueDeepResearch(run, item);
    }
  } catch (error) {
    handleQueuedPromptAppendFailure(run, item, error);
  }
  schedulePromptQueueTargetStatePoll(run);
}

const indexingDocument = (doc: { status: string }) =>
  doc.status === "pending" || doc.status === "running";

async function targetHasIndexingDocuments(
  item: PromptQueueItem,
): Promise<boolean> {
  if (item.target.isIndexing()) return true;
  const threadId = item.target.getDocumentThreadId();
  try {
    if (threadId && item.target.usesThreadDocuments) {
      const documents = await listThreadDocuments(threadId);
      if (documents.some(indexingDocument)) return true;
    }
    if (item.target.usesKnowledgeBase) return false;
    const queueProjectId = item.target.getQueueProjectId();
    const projectId = threadId
      ? await resolveProjectId(threadId, undefined, {
          rethrowReadFailure: true,
          composerProjectId: queueProjectId,
        })
      : queueProjectId;
    if (!projectId) return false;
    if (projectWorkCount(projectId) > 0) return true;
    try {
      const projectDocuments = await listProjectDocuments(projectId);
      return projectDocuments.some(indexingDocument);
    } catch (error) {
      if (isRagClientError(error)) return false;
      throw error;
    }
  } catch {
    return !useRagAvailabilityStore.getState().isUnavailable();
  }
}

export function getActivePromptQueueItem(
  run: PromptQueueRun,
): PromptQueueItem | undefined {
  return run.items[Math.max(run.index, 0)];
}

export function isActivePromptQueueItem(
  run: PromptQueueRun,
  item: PromptQueueItem,
  generation: number,
): boolean {
  if (promptQueueRuns.get(run.id) !== run || generation !== run.generation) {
    return false;
  }
  return getActivePromptQueueItem(run) === item;
}

export function scheduleQueuedPromptDispatch(
  run: PromptQueueRun,
  item: PromptQueueItem,
  delay: number,
  generation = run.generation,
): void {
  clearPromptQueueRetryTimer(run);
  run.retryTimer = setTimeout(() => {
    run.retryTimer = null;
    if (isActivePromptQueueItem(run, item, generation)) {
      requestPromptQueuePump();
    }
  }, delay);
}

export function isPromptQueueRunReadyToDispatch(run: PromptQueueRun): boolean {
  const item = getActivePromptQueueItem(run);
  return Boolean(
    item &&
      run.index >= 0 &&
      !item.dispatched &&
      !run.waitingForTargetIdle &&
      !run.retryTimer &&
      !promptQueueActiveRunIds.has(run.id) &&
      !promptQueueDispatchingRunIds.has(run.id),
  );
}

function getNextReadyPromptQueueRun(): PromptQueueRun | null {
  if (promptQueueRunOrder.length === 0) return null;
  const size = promptQueueRunOrder.length;
  for (let offset = 0; offset < size; offset += 1) {
    const orderIndex = (promptQueueRoundRobinCursor + offset) % size;
    const runId = promptQueueRunOrder[orderIndex];
    const run = promptQueueRuns.get(runId);
    if (!run || !isPromptQueueRunReadyToDispatch(run)) continue;
    promptQueueRoundRobinCursor = (orderIndex + 1) % size;
    return run;
  }
  return null;
}

export function requestPromptQueuePump(delay = 0): void {
  if (promptQueuePumpTimer) return;
  promptQueuePumpTimer = setTimeout(() => {
    promptQueuePumpTimer = null;
    pumpPromptQueues();
  }, delay);
}

function pumpPromptQueues(): void {
  ensurePromptQueueSubscription();
  while (true) {
    const run = getNextReadyPromptQueueRun();
    if (!run) return;
    const item = getActivePromptQueueItem(run);
    if (!item) {
      deletePromptQueueRun(run);
      continue;
    }
    promptQueueDispatchingRunIds.add(run.id);
    dispatchQueuedPrompt(run, item, run.generation)
      .catch(() => undefined)
      .finally(() => {
        promptQueueDispatchingRunIds.delete(run.id);
        syncPromptQueueUI();
        if (!promptQueueActiveRunIds.has(run.id)) {
          requestPromptQueuePump();
        }
      });
  }
}

async function dispatchQueuedPrompt(
  run: PromptQueueRun,
  item: PromptQueueItem,
  generation = run.generation,
): Promise<void> {
  if (!isActivePromptQueueItem(run, item, generation)) return;
  if (
    isPromptQueueTargetRunning(
      item.target,
      useChatRuntimeStore.getState().runningByThreadId,
    )
  ) {
    run.waitingForTargetIdle = true;
    run.prevStoreRunning = true;
    promptQueueActiveRunIds.delete(run.id);
    syncPromptQueueUI();
    ensurePromptQueueSubscription();
    handlePromptQueueRunState(
      run,
      useChatRuntimeStore.getState().runningByThreadId,
    );
    schedulePromptQueueTargetStatePoll(run);
    return;
  }
  const hasIndexing = await targetHasIndexingDocuments(item);
  if (!isActivePromptQueueItem(run, item, generation)) return;
  if (hasIndexing) {
    promptQueueActiveRunIds.delete(run.id);
    scheduleQueuedPromptDispatch(run, item, PROMPT_QUEUE_INDEXING_RETRY_MS);
    return;
  }
  if (!isActivePromptQueueItem(run, item, generation)) return;
  appendQueuedPrompt(run, item);
}

export function createQueuedPrompt(
  prompt: string,
  target: PromptQueueTarget,
): PromptQueueItem {
  return {
    id: createPromptQueueItemId(),
    prompt,
    target,
    dispatched: false,
    dispatchRetries: 0,
  };
}

export function getPromptQueueTargetIds(target: PromptQueueTarget): string[] {
  return compactIds([
    ...target.getRunningThreadIds(),
    target.getDocumentThreadId(),
  ]);
}

export function getPromptQueueRunTargetIds(run: PromptQueueRun): string[] {
  const ids: Array<string | null | undefined> = [];
  for (const item of run.items) {
    ids.push(...item.target.getRunningThreadIds());
    ids.push(item.target.getDocumentThreadId());
  }
  return compactIds(ids);
}

export function promptQueueRunUsesLocalModel(run: PromptQueueRun): boolean {
  return run.items
    .slice(Math.max(run.index, 0))
    .some((item) => item.target.usesLocalModel);
}

export function promptQueueRunIsTemporary(run: PromptQueueRun): boolean {
  return run.items
    .slice(Math.max(run.index, 0))
    .some((item) => item.target.temporary);
}

export function promptQueueRunMatchesThreadIds(
  run: PromptQueueRun,
  threadIds: string[],
): boolean {
  return getPromptQueueRunTargetIds(run).some((id) => threadIds.includes(id));
}

export function findPromptQueueRunByTarget(
  target: PromptQueueTarget,
): PromptQueueRun | null {
  const targetIds = getPromptQueueTargetIds(target);
  if (targetIds.length === 0) return null;
  for (const run of promptQueueRuns.values()) {
    if (promptQueueRunMatchesThreadIds(run, targetIds)) return run;
  }
  return null;
}

export function findPromptQueueRunByItemId(
  itemId: string,
): { run: PromptQueueRun; itemIndex: number; item: PromptQueueItem } | null {
  for (const run of promptQueueRuns.values()) {
    const itemIndex = run.items.findIndex((item) => item.id === itemId);
    if (itemIndex >= 0) {
      return { run, itemIndex, item: run.items[itemIndex] };
    }
  }
  return null;
}

export function findPromptQueueRunByThreadIds(
  threadIds: string[],
): PromptQueueRun | null {
  if (threadIds.length === 0) return null;
  for (const run of promptQueueRuns.values()) {
    if (promptQueueRunMatchesThreadIds(run, threadIds)) return run;
  }
  return null;
}

export function findPromptQueueEntry(
  state: PromptQueueUIState,
  threadIds: string[],
): PromptQueueUIEntry | null {
  for (const threadId of threadIds) {
    const entry = state.byThreadId[threadId];
    if (entry) return entry;
  }
  return null;
}

export function canEditPromptQueueItem(item: PromptQueueItem): boolean {
  return !item.dispatched;
}

export function canRemovePromptQueueItem(item: PromptQueueItem): boolean {
  return !item.dispatched;
}

export function getPromptQueueRunProgress(run: PromptQueueRun): {
  activeItemIndex: number;
  current: number;
  total: number;
} {
  const activeItemIndex = Math.max(run.index, 0);
  const total = run.items.length;
  const current = run.index >= 0 ? Math.min(activeItemIndex + 1, total) : 0;
  return { activeItemIndex, current, total };
}

export function getPromptQueueItemStatus(
  run: PromptQueueRun,
  index: number,
  activeItemIndex: number,
): PromptQueueUIItemStatus {
  if (run.index >= 0 && index === activeItemIndex) {
    return run.waitingForTargetIdle ? "waiting" : "next";
  }
  return "queued";
}

export function getPromptQueueUIItemsForRun(
  run: PromptQueueRun,
): PromptQueueUIItem[] {
  const { activeItemIndex, total } = getPromptQueueRunProgress(run);
  const items: PromptQueueUIItem[] = [];
  for (const [index, item] of run.items.entries()) {
    if (index < activeItemIndex || item.dispatched) continue;
    items.push({
      id: item.id,
      runId: run.id,
      prompt: item.prompt,
      position: index + 1,
      total,
      status: getPromptQueueItemStatus(run, index, activeItemIndex),
      threadIds: getPromptQueueTargetIds(item.target),
      canEdit: canEditPromptQueueItem(item),
      canRemove: canRemovePromptQueueItem(item),
    });
  }
  return items;
}

export function syncPromptQueueUI(): void {
  if (promptQueueRuns.size === 0) {
    usePromptQueueUI.setState({
      byThreadId: {},
      current: 0,
      total: 0,
      items: [],
      isRunning: false,
    });
    return;
  }

  const items: PromptQueueUIItem[] = [];
  const byThreadId: Record<string, PromptQueueUIEntry> = {};
  let current = 0;
  let total = 0;

  for (const run of promptQueueRuns.values()) {
    const { current: runCurrent, total: runTotal } =
      getPromptQueueRunProgress(run);
    current += runCurrent;
    total += runTotal;
    items.push(...getPromptQueueUIItemsForRun(run));

    const ids = getPromptQueueRunTargetIds(run);
    if (ids.length === 0) continue;
    const entry: PromptQueueUIEntry = {
      runId: run.id,
      current: runCurrent,
      total: runTotal,
      local: promptQueueRunUsesLocalModel(run),
      temporary: promptQueueRunIsTemporary(run),
      dispatched: Boolean(getActivePromptQueueItem(run)?.dispatched),
    };
    for (const id of ids) {
      byThreadId[id] = entry;
    }
  }

  usePromptQueueUI.setState({
    byThreadId,
    current,
    total,
    items,
    isRunning: true,
  });
}

export function editPromptQueueItem(itemId: string, prompt: string): boolean {
  const nextPrompt = prompt.trim();
  if (!nextPrompt) return false;
  const match = findPromptQueueRunByItemId(itemId);
  if (!match) return false;
  const { item } = match;
  if (!canEditPromptQueueItem(item)) return false;
  item.prompt = nextPrompt;
  syncPromptQueueUI();
  return true;
}

export function removePromptQueueItem(itemId: string): boolean {
  const match = findPromptQueueRunByItemId(itemId);
  if (!match) return false;
  const { run, itemIndex, item } = match;
  if (!canRemovePromptQueueItem(item)) return false;

  const wasActive = itemIndex === Math.max(run.index, 0);
  run.items.splice(itemIndex, 1);
  if (run.items.length === 0) {
    deletePromptQueueRun(run);
    return true;
  }

  if (itemIndex < run.index) {
    run.index -= 1;
  }
  if (wasActive && run.index >= run.items.length) {
    deletePromptQueueRun(run);
    return true;
  }

  syncPromptQueueUI();
  if (wasActive) {
    clearPromptQueueRetryTimer(run);
    if (run.index < 0 || run.waitingForTargetIdle) return true;
    run.prevStoreRunning = false;
    const next = run.items[run.index];
    if (next) {
      scheduleQueuedPromptDispatch(run, next, 50);
    }
  }
  return true;
}

export function movePromptQueueItem(
  itemId: string,
  targetItemId: string,
): boolean {
  if (itemId === targetItemId) return false;
  const match = findPromptQueueRunByItemId(itemId);
  const target = findPromptQueueRunByItemId(targetItemId);
  if (!match || !target || match.run !== target.run) return false;
  const { run, itemIndex, item } = match;
  if (item.dispatched || target.item.dispatched) return false;
  if (promptQueueDispatchingRunIds.has(run.id)) return false;

  const activeIndex = Math.max(run.index, 0);
  const before = run.items;
  const after = reorderPromptQueueItems(
    before,
    itemIndex,
    target.itemIndex,
    activeIndex,
  );
  if (!after) return false;
  const activeChanged = promptQueueActiveItemChanged(before, after, run.index);
  run.items = after;
  syncPromptQueueUI();

  const nowActive = run.items[run.index];
  if (
    run.index >= 0 &&
    !run.waitingForTargetIdle &&
    nowActive &&
    activeChanged
  ) {
    clearPromptQueueRetryTimer(run);
    run.prevStoreRunning = false;
    scheduleQueuedPromptDispatch(run, nowActive, 50);
  }
  return true;
}

export function isPromptQueueTargetRunning(
  target: PromptQueueTarget,
  runningByThreadId: Record<string, boolean>,
): boolean {
  try {
    if (target.isRunning()) return true;
  } catch {
    // Silently continue
  }
  const runningIds = Object.keys(runningByThreadId);
  if (runningIds.length === 0) return false;
  const targetIds = target.getRunningThreadIds();
  if (targetIds.length === 0) return false;
  return runningIds.some((threadId) => targetIds.includes(threadId));
}

export function isPromptQueueRunTargetRunning(
  run: PromptQueueRun,
  runningByThreadId: Record<string, boolean>,
): boolean {
  const activeItem = getActivePromptQueueItem(run);
  if (!activeItem) return false;
  return isPromptQueueTargetRunning(activeItem.target, runningByThreadId);
}

export function advancePromptQueue(run: PromptQueueRun): void {
  clearPromptQueueRetryTimer(run);
  promptQueueActiveRunIds.delete(run.id);
  getActivePromptQueueItem(run)?.target.complete();
  const nextIndex = run.index + 1;
  if (nextIndex >= run.items.length) {
    deletePromptQueueRun(run);
    return;
  }
  run.index = nextIndex;
  run.waitingForTargetIdle = false;
  run.prevStoreRunning = false;
  syncPromptQueueUI();
  requestPromptQueuePump(100);
}

export function shouldPollPromptQueueTargetState(
  run: PromptQueueRun,
): boolean {
  return (
    run.waitingForTargetIdle ||
    run.index < 0 ||
    Boolean(getActivePromptQueueItem(run)?.dispatched)
  );
}

export function schedulePromptQueueTargetStatePoll(run: PromptQueueRun): void {
  const isWaiting = shouldPollPromptQueueTargetState(run);
  if (run.retryTimer || !isWaiting) return;
  const generation = run.generation;
  run.retryTimer = setTimeout(() => {
    run.retryTimer = null;
    if (
      promptQueueRuns.get(run.id) !== run ||
      generation !== run.generation ||
      !shouldPollPromptQueueTargetState(run)
    ) {
      return;
    }
    handlePromptQueueRunState(
      run,
      useChatRuntimeStore.getState().runningByThreadId,
    );
    if (
      promptQueueRuns.get(run.id) === run &&
      shouldPollPromptQueueTargetState(run)
    ) {
      schedulePromptQueueTargetStatePoll(run);
    }
  }, PROMPT_QUEUE_TARGET_STATE_POLL_MS);
}

function getRunningThreadCount(
  runningByThreadId: Record<string, boolean>,
): number {
  return Object.values(runningByThreadId).filter(Boolean).length;
}

export function hasReadyPromptQueueRun(): boolean {
  return Array.from(promptQueueRuns.values()).some(
    isPromptQueueRunReadyToDispatch,
  );
}

export function handlePromptQueueRunState(
  run: PromptQueueRun,
  runningByThreadId: Record<string, boolean>,
): void {
  if (!promptQueueRuns.has(run.id)) return;
  const isRunning = isPromptQueueRunTargetRunning(run, runningByThreadId);
  const wasRunning = run.prevStoreRunning;
  run.prevStoreRunning = isRunning;
  if (!wasRunning || isRunning) return;
  if (run.waitingForTargetIdle) {
    clearPromptQueueRetryTimer(run);
    run.waitingForTargetIdle = false;
    const activeItem = run.items[run.index];
    if (activeItem) {
      requestPromptQueuePump(50);
    }
    return;
  }
  advancePromptQueue(run);
  requestPromptQueuePump();
}

export function ensurePromptQueueSubscription(): void {
  if (promptQueueStoreUnsub) return;
  let previousRunningCount = getRunningThreadCount(
    useChatRuntimeStore.getState().runningByThreadId,
  );

  promptQueueStoreUnsub = useChatRuntimeStore.subscribe((state) => {
    if (promptQueueRuns.size === 0) {
      stopPromptQueueSubscription();
      return;
    }
    const nextRunningCount = getRunningThreadCount(state.runningByThreadId);
    for (const run of Array.from(promptQueueRuns.values())) {
      handlePromptQueueRunState(run, state.runningByThreadId);
    }

    if (nextRunningCount < previousRunningCount && hasReadyPromptQueueRun()) {
      requestPromptQueuePump();
    }
    previousRunningCount = nextRunningCount;
  });
}

export function startPromptQueue(
  items: string[],
  target: PromptQueueTarget,
  waitForCurrentRun = false,
): void {
  const filtered = items.map((item) => item.trim()).filter(Boolean);
  if (filtered.length === 0) return;

  const existingRun = findPromptQueueRunByTarget(target);
  if (existingRun) {
    if (existingRun.deepResearchConsumed) {
      target.consumeDeepResearch();
    }
    existingRun.items.push(
      ...filtered.map((prompt) => createQueuedPrompt(prompt, target)),
    );
    syncPromptQueueUI();
    requestPromptQueuePump();
    return;
  }

  const runningByThreadId = useChatRuntimeStore.getState().runningByThreadId;
  const shouldWaitForCurrentRun =
    waitForCurrentRun && isPromptQueueTargetRunning(target, runningByThreadId);
  const run: PromptQueueRun = {
    id: createPromptQueueRunId(),
    items: filtered.map((prompt) => createQueuedPrompt(prompt, target)),
    index: shouldWaitForCurrentRun ? -1 : 0,
    generation: 0,
    prevStoreRunning: shouldWaitForCurrentRun,
    waitingForTargetIdle: false,
    retryTimer: null,
    deepResearchConsumed: false,
  };
  promptQueueRuns.set(run.id, run);
  promptQueueRunOrder.push(run.id);
  syncPromptQueueUI();
  ensurePromptQueueSubscription();
  if (shouldWaitForCurrentRun) {
    handlePromptQueueRunState(
      run,
      useChatRuntimeStore.getState().runningByThreadId,
    );
    schedulePromptQueueTargetStatePoll(run);
  } else {
    requestPromptQueuePump(50);
  }
}

export function getPromptQueueRunsForThreadIds(
  threadIds?: string[],
): PromptQueueRun[] {
  if (!threadIds || threadIds.length === 0) {
    return Array.from(promptQueueRuns.values());
  }

  const runs = new Set<PromptQueueRun>();
  for (const id of compactIds(threadIds)) {
    const run = findPromptQueueRunByThreadIds([id]);
    if (run) runs.add(run);
  }
  return Array.from(runs);
}

export function stopPromptQueueRun(threadIds?: string[]): void {
  for (const run of getPromptQueueRunsForThreadIds(threadIds)) {
    const activeItem = getActivePromptQueueItem(run);
    const activeTarget = activeItem?.target;
    const shouldCancel = Boolean(activeItem?.dispatched);
    deletePromptQueueRun(run);
    if (!shouldCancel) continue;
    try {
      activeTarget?.cancel();
    } catch {
      // Ignore cancel failure
    }
  }
  requestPromptQueuePumpIfReady();
}

export function stopPromptQueueRunForThreadIds(threadIds: string[]): void {
  stopPromptQueueRun(threadIds);
}

export function waitForPromptQueueTargetIdle(run: PromptQueueRun): void {
  clearPromptQueueRetryTimer(run);
  promptQueueActiveRunIds.delete(run.id);
  run.waitingForTargetIdle = true;
  run.prevStoreRunning = true;
  syncPromptQueueUI();
  ensurePromptQueueSubscription();
}

export function refreshPromptQueueTargetIdleWait(run: PromptQueueRun): void {
  handlePromptQueueRunState(
    run,
    useChatRuntimeStore.getState().runningByThreadId,
  );
  schedulePromptQueueTargetStatePoll(run);
}

export function stopLocalPromptQueueRun(run: PromptQueueRun): void {
  const activeItem = getActivePromptQueueItem(run);
  const plan = planLocalPromptQueueStop(
    run.items.map((item) => ({
      usesLocalModel: item.target.usesLocalModel,
      dispatched: item.dispatched,
    })),
    run.index,
  );
  if (plan.retainedItemIndexes.length === run.items.length) return;

  run.items = plan.retainedItemIndexes.map((index) => run.items[index]);
  if (!getActivePromptQueueItem(run)) {
    deletePromptQueueRun(run);
    if (!plan.cancelActiveItem) return;
    try {
      activeItem?.target.cancel();
    } catch {
      // Ignore
    }
    return;
  }
  if (plan.activeItemRemoved) {
    clearPromptQueueRetryTimer(run);
  }
  if (plan.cancelActiveItem) {
    waitForPromptQueueTargetIdle(run);
    try {
      activeItem?.target.cancel();
    } catch {
      // Ignore
    }
    refreshPromptQueueTargetIdleWait(run);
    return;
  }
  syncPromptQueueUI();
  if (plan.refreshTargetIdleWait) {
    refreshPromptQueueTargetIdleWait(run);
    return;
  }
  if (plan.activeItemRemoved && run.index >= 0 && !run.waitingForTargetIdle) {
    requestPromptQueuePump(50);
  }
}

export function stopLocalPromptQueueRunsForThreadIds(
  threadIds: string[],
): void {
  if (threadIds.length === 0) return;
  for (const run of getPromptQueueRunsForThreadIds(threadIds)) {
    stopLocalPromptQueueRun(run);
  }
  requestPromptQueuePumpIfReady();
}

export function retainPendingPromptQueueItemsAfterFailure(
  run: PromptQueueRun,
): boolean {
  const activeIndex = Math.max(run.index, 0);
  const activeItem = run.items[activeIndex];
  if (run.index < 0 || !activeItem?.dispatched) return false;

  activeItem.target.complete();
  run.items.splice(activeIndex, 1);
  if (!getActivePromptQueueItem(run)) {
    deletePromptQueueRun(run);
    return true;
  }
  waitForPromptQueueTargetIdle(run);
  refreshPromptQueueTargetIdleWait(run);
  return true;
}

export function cancelPendingPromptQueueFactoriesForStop<
  T extends { temporary: boolean; cancelled: boolean },
>(
  pendingFactories: Map<string, T>,
  aliases: string[],
  detail: PromptQueueStopEventDetail,
): void {
  const { threadIds, temporaryOnly, localOnly } = detail;
  if (localOnly) return;
  if (
    threadIds &&
    threadIds.length > 0 &&
    !threadIds.some((threadId) => aliases.includes(threadId))
  ) {
    return;
  }
  for (const [key, reservation] of pendingFactories) {
    if (temporaryOnly && !reservation.temporary) continue;
    reservation.cancelled = true;
    pendingFactories.delete(key);
  }
}

export function stopAllPromptQueueRuns(): void {
  const activeRuns = Array.from(promptQueueRuns.values()).map((run) => ({
    activeItem: getActivePromptQueueItem(run),
  }));
  resetPromptQueues();
  for (const { activeItem } of activeRuns) {
    const activeTarget = activeItem?.target;
    const shouldCancel = Boolean(activeItem?.dispatched);
    if (!shouldCancel) continue;
    try {
      activeTarget?.cancel();
    } catch {
      // Ignore
    }
  }
}

export function handlePromptQueueRunFailed(threadId?: string | null): void {
  if (threadId) {
    const failedRun = findPromptQueueRunByThreadIds([threadId]);
    if (failedRun) {
      if (!retainPendingPromptQueueItemsAfterFailure(failedRun)) {
        discardQueuedChatRunSettingsForThread(threadId);
        deletePromptQueueRun(failedRun);
      }
    } else {
      discardQueuedChatRunSettingsForThread(threadId);
    }
  }
  requestPromptQueuePumpIfReady();
}

if (typeof window !== "undefined") {
  window.addEventListener(PROMPT_QUEUE_STOP_EVENT, (event) => {
    const { threadIds, temporaryOnly, localOnly } =
      (event as CustomEvent<PromptQueueStopEventDetail>).detail ?? {};
    if (localOnly) {
      stopLocalPromptQueueRunsForThreadIds(threadIds ?? []);
      return;
    }
    if (threadIds && threadIds.length > 0) {
      stopPromptQueueRunForThreadIds(threadIds);
      return;
    }
    if (temporaryOnly) return;
    stopAllPromptQueueRuns();
  });

  window.addEventListener(PROMPT_QUEUE_RUN_FAILED_EVENT, (event) => {
    const { threadId } =
      (event as CustomEvent<PromptQueueRunFailedEventDetail>).detail ?? {};
    handlePromptQueueRunFailed(threadId);
  });
}

export const noopStartPromptQueue: PromptQueueCallbacks["startQueue"] = () =>
  false;
export const noopStopPromptQueue: PromptQueueCallbacks["stopQueue"] = () =>
  undefined;

export const PromptQueueContext = createContext<PromptQueueCallbacks>({
  startQueue: noopStartPromptQueue,
  stopQueue: noopStopPromptQueue,
});

export function appendTextToThread(prompt: string) {
  return {
    role: "user",
    content: [{ type: "text", text: prompt }],
    createdAt: new Date(),
  } as never;
}
