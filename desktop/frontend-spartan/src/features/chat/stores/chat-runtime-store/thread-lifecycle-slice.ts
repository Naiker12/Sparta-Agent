/**
 * Sparta Agent - Slice de Ciclo de Vida de Hilos de Chat
 * Gestiona hilos en ejecución, cancelaciones y snapshots de canvas.
 */

import type { DiffusionCanvasFrame, ThreadRunOwner } from "./types";

export interface ThreadLifecycleSliceState {
  runningByThreadId: Record<string, boolean>;
  localRunByThreadId: Record<string, boolean>;
  runOwnerByThreadId: Record<string, ThreadRunOwner[]>;
  cancelByThreadId: Record<string, () => void>;
  serverCancelByThreadId: Record<string, (() => void)[]>;
  activeDiffusionCanvasByThreadId: Record<string, DiffusionCanvasFrame>;
  generatingStatus: string | null;
}

export interface ThreadLifecycleSliceActions {
  setThreadRunning: (
    threadId: string,
    running: boolean,
    options?: { local?: boolean; owner?: () => void },
  ) => void;
  adoptDefaultThreadRun: (threadId: string) => void;
  runKeyForOwner: (fallbackKey: string, owner: () => void) => string;
  registerThreadCancel: (threadId: string, cancel: () => void) => void;
  clearThreadCancel: (threadId: string, cancel?: () => void) => void;
  registerThreadServerCancel: (threadId: string, cancel: () => void) => void;
  clearThreadServerCancel: (threadId: string, cancel?: () => void) => void;
  setActiveDiffusionCanvas: (
    threadId: string | null,
    canvas: DiffusionCanvasFrame,
  ) => void;
  clearActiveDiffusionCanvasForThread: (threadId: string | null) => void;
  setGeneratingStatus: (generatingStatus: string | null) => void;
}

export type ThreadLifecycleSlice = ThreadLifecycleSliceState &
  ThreadLifecycleSliceActions;

export const initialThreadLifecycleState: ThreadLifecycleSliceState = {
  runningByThreadId: {},
  localRunByThreadId: {},
  runOwnerByThreadId: {},
  cancelByThreadId: {},
  serverCancelByThreadId: {},
  activeDiffusionCanvasByThreadId: {},
  generatingStatus: null,
};

export type ThreadLifecycleStateParam = ThreadLifecycleSliceState &
  Record<string, any>;

export type ThreadLifecycleSet = (
  updater:
    | Partial<ThreadLifecycleSliceState>
    | ((state: ThreadLifecycleStateParam) => any),
) => void;

export const createThreadLifecycleSlice = (
  set: ThreadLifecycleSet,
  get: () => any,
): ThreadLifecycleSlice => ({
  ...initialThreadLifecycleState,

  setThreadRunning: (threadId, running, options) =>
    set((state: ThreadLifecycleStateParam) => {
      const next = { ...state.runningByThreadId };
      const nextLocal = { ...state.localRunByThreadId };
      const nextOwner = { ...state.runOwnerByThreadId };
      const owners = state.runOwnerByThreadId[threadId] ?? [];
      const local = options?.local !== false;
      if (running) {
        next[threadId] = true;
        if (options?.owner) {
          nextOwner[threadId] = [...owners, { owner: options.owner, local }];
        }
        if (local) {
          nextLocal[threadId] = true;
        } else if (!owners.some((o: ThreadRunOwner) => o.local)) {
          delete nextLocal[threadId];
        }
      } else {
        const remaining = options?.owner
          ? owners.filter((o: ThreadRunOwner) => o.owner !== options.owner)
          : [];
        if (options?.owner && remaining.length === owners.length) return state;
        if (!options?.owner && owners.length > 0) return state;
        if (remaining.length > 0) {
          nextOwner[threadId] = remaining;
          if (remaining.some((o: ThreadRunOwner) => o.local)) {
            nextLocal[threadId] = true;
          } else {
            delete nextLocal[threadId];
          }
        } else {
          delete next[threadId];
          delete nextLocal[threadId];
          delete nextOwner[threadId];
        }
      }
      return {
        runningByThreadId: next,
        localRunByThreadId: nextLocal,
        runOwnerByThreadId: nextOwner,
      };
    }),

  adoptDefaultThreadRun: (threadId) =>
    set((state: ThreadLifecycleStateParam) => {
      const key = "__default";
      if (!threadId || threadId === key) return state;
      if ((state.runOwnerByThreadId[key]?.length ?? 0) > 1) return state;
      const moved: Record<string, any> = {};
      const move = (map: Record<string, any>, name: string) => {
        const entry = map[key];
        if (entry === undefined || map[threadId] !== undefined) return;
        const next = { ...map };
        delete next[key];
        next[threadId] = entry;
        moved[name] = next;
      };
      move(state.runningByThreadId, "runningByThreadId");
      move(state.localRunByThreadId, "localRunByThreadId");
      move(state.runOwnerByThreadId, "runOwnerByThreadId");
      move(state.cancelByThreadId, "cancelByThreadId");
      move(state.serverCancelByThreadId, "serverCancelByThreadId");
      if (state.toolStatusByThreadId) {
        move(state.toolStatusByThreadId, "toolStatusByThreadId");
      }
      move(
        state.activeDiffusionCanvasByThreadId,
        "activeDiffusionCanvasByThreadId",
      );
      return Object.keys(moved).length > 0 ? moved : state;
    }),

  runKeyForOwner: (fallbackKey, owner) => {
    for (const [key, entries] of Object.entries(
      get().runOwnerByThreadId as Record<string, ThreadRunOwner[]>,
    )) {
      if (entries.some((e) => e.owner === owner)) return key;
    }
    return fallbackKey;
  },

  registerThreadCancel: (threadId, cancel) =>
    set((state: ThreadLifecycleStateParam) => {
      const next = { ...state.cancelByThreadId };
      next[threadId] = cancel;
      return { cancelByThreadId: next };
    }),

  clearThreadCancel: (threadId, cancel) =>
    set((state: ThreadLifecycleStateParam) => {
      if (!(threadId in state.cancelByThreadId)) return state;
      if (cancel && state.cancelByThreadId[threadId] !== cancel) return state;
      const next = { ...state.cancelByThreadId };
      delete next[threadId];
      return { cancelByThreadId: next };
    }),

  registerThreadServerCancel: (threadId, cancel) =>
    set((state: ThreadLifecycleStateParam) => {
      const next = { ...state.serverCancelByThreadId };
      next[threadId] = [
        ...(state.serverCancelByThreadId[threadId] ?? []),
        cancel,
      ];
      return { serverCancelByThreadId: next };
    }),

  clearThreadServerCancel: (threadId, cancel) =>
    set((state: ThreadLifecycleStateParam) => {
      const current = state.serverCancelByThreadId[threadId];
      if (current === undefined) return state;
      const remaining =
        cancel === undefined ? [] : current.filter((c: () => void) => c !== cancel);
      if (remaining.length === current.length) return state;
      const next = { ...state.serverCancelByThreadId };
      if (remaining.length > 0) {
        next[threadId] = remaining;
      } else {
        delete next[threadId];
      }
      return { serverCancelByThreadId: next };
    }),

  setActiveDiffusionCanvas: (threadId, canvas) =>
    set((state: ThreadLifecycleStateParam) => ({
      activeDiffusionCanvasByThreadId: {
        ...state.activeDiffusionCanvasByThreadId,
        [threadId || "__default"]: canvas,
      },
    })),

  clearActiveDiffusionCanvasForThread: (threadId) =>
    set((state: ThreadLifecycleStateParam) => {
      const key = threadId || "__default";
      if (state.activeDiffusionCanvasByThreadId[key] === undefined) return state;
      const next = { ...state.activeDiffusionCanvasByThreadId };
      delete next[key];
      return { activeDiffusionCanvasByThreadId: next };
    }),

  setGeneratingStatus: (generatingStatus) => set({ generatingStatus }),
});
