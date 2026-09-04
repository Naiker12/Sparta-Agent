/**
 * Sparta Agent - Tipos y Constantes de la Cola de Prompts
 * Define contratos para targets de ejecución, ítems encolados y parámetros de sondeo.
 */

export type PromptQueueTarget = {
  getDocumentThreadId: () => string | null;
  getQueueProjectId: () => string | null;
  usesKnowledgeBase: boolean;
  getRunningThreadIds: () => string[];
  isRunning: () => boolean;
  append: (prompt: string) => void | Promise<void>;
  complete: () => void;
  cancel: () => void;
  isIndexing: () => boolean;
  usesThreadDocuments: boolean;
  usesLocalModel: boolean;
  usesDeepResearch: boolean;
  temporary: boolean;
  consumeDeepResearch: () => void;
};

export type PromptQueueItem = {
  id: string;
  prompt: string;
  target: PromptQueueTarget;
  dispatched: boolean;
  dispatchRetries: number;
};

export type PromptQueueRun = {
  id: string;
  items: PromptQueueItem[];
  index: number;
  generation: number;
  prevStoreRunning: boolean;
  waitingForTargetIdle: boolean;
  retryTimer: ReturnType<typeof setTimeout> | null;
  deepResearchConsumed: boolean;
};

export interface PromptQueueCallbacks {
  startQueue: (
    items: string[],
    waitForCurrentRun?: boolean,
    onAborted?: () => void,
  ) => boolean;
  stopQueue: () => void;
}

export const PROMPT_QUEUE_INDEXING_RETRY_MS = 500;
export const PROMPT_QUEUE_DISPATCH_RETRY_MS = 500;
export const PROMPT_QUEUE_TARGET_STATE_POLL_MS = 50;
export const PROMPT_QUEUE_MAX_DISPATCH_RETRIES = 5;
