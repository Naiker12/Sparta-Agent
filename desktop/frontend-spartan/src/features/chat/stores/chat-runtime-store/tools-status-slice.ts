/**
 * Sparta Agent - Slice de Estado y Streaming de Herramientas
 * Controla el streaming de salidas live, confirmaciones de herramientas y estatus visual.
 */

import type { ToolStatusEntry } from "./types";

export interface ToolConfirmationItem {
  approvalId: string;
  sessionId: string;
  autoAllowKey: string;
}

export interface ToolsStatusSliceState {
  toolStatusByThreadId: Record<string, ToolStatusEntry[]>;
  toolLiveOutput: Record<string, string>;
  toolFullOutput: Record<string, string>;
  toolConfirmations: Record<string, ToolConfirmationItem>;
  alwaysAllowToolsBySession: Map<string, Set<string>>;
}

export interface ToolsStatusSliceActions {
  setToolStatus: (
    threadId: string,
    status: string | null,
    owner?: () => void,
  ) => void;
  appendToolLiveOutput: (toolCallId: string, text: string) => void;
  setToolFullOutput: (toolCallId: string, text: string) => void;
  clearToolFullOutput: (toolCallId: string) => void;
  clearToolLiveOutput: (toolCallId?: string) => void;
  setToolConfirmation: (
    toolCallId: string,
    approvalId: string,
    sessionId: string,
    autoAllowKey: string,
  ) => void;
  clearToolConfirmation: (toolCallId: string) => void;
  addAlwaysAllowTool: (sessionId: string, toolName: string) => void;
}

export type ToolsStatusSlice = ToolsStatusSliceState & ToolsStatusSliceActions;

export const initialToolsStatusState: ToolsStatusSliceState = {
  toolStatusByThreadId: {},
  toolLiveOutput: {},
  toolFullOutput: {},
  toolConfirmations: {},
  alwaysAllowToolsBySession: new Map(),
};

export type ToolsStatusStateParam = ToolsStatusSliceState & Record<string, any>;

export type ToolsStatusSet = (
  updater:
    | Partial<ToolsStatusSliceState>
    | ((state: ToolsStatusStateParam) => any),
) => void;

export const createToolsStatusSlice = (
  set: ToolsStatusSet,
): ToolsStatusSlice => ({
  ...initialToolsStatusState,

  setToolStatus: (threadId, status, owner) =>
    set((state: ToolsStatusStateParam) => {
      const next = { ...state.toolStatusByThreadId };
      const entries = state.toolStatusByThreadId[threadId] ?? [];
      const mine = entries.find((e: ToolStatusEntry) => e.owner === owner);
      if (!status) {
        if (mine === undefined) return state;
        const rest = entries.filter((e: ToolStatusEntry) => e !== mine);
        if (rest.length > 0) {
          next[threadId] = rest;
        } else {
          delete next[threadId];
        }
      } else {
        if (mine?.status === status) return state;
        const entry = { status, startedAt: Date.now(), owner };
        next[threadId] = mine
          ? entries.map((e: ToolStatusEntry) => (e === mine ? entry : e))
          : [...entries, entry];
      }
      return { toolStatusByThreadId: next };
    }),

  appendToolLiveOutput: (toolCallId, text) =>
    set((state: ToolsStatusStateParam) => ({
      toolLiveOutput: {
        ...state.toolLiveOutput,
        [toolCallId]: (state.toolLiveOutput[toolCallId] ?? "") + text,
      },
    })),

  setToolFullOutput: (toolCallId, text) =>
    set((state: ToolsStatusStateParam) => ({
      toolFullOutput: {
        ...state.toolFullOutput,
        [toolCallId]: text,
      },
    })),

  clearToolFullOutput: (toolCallId) =>
    set((state: ToolsStatusStateParam) => {
      if (!(toolCallId in state.toolFullOutput)) {
        return {};
      }
      const next = { ...state.toolFullOutput };
      delete next[toolCallId];
      return { toolFullOutput: next };
    }),

  clearToolLiveOutput: (toolCallId) =>
    set((state: ToolsStatusStateParam) => {
      if (toolCallId === undefined) {
        return Object.keys(state.toolLiveOutput).length
          ? { toolLiveOutput: {} }
          : {};
      }
      if (!(toolCallId in state.toolLiveOutput)) {
        return {};
      }
      const next = { ...state.toolLiveOutput };
      delete next[toolCallId];
      return { toolLiveOutput: next };
    }),

  setToolConfirmation: (toolCallId, approvalId, sessionId, autoAllowKey) =>
    set((state: ToolsStatusStateParam) => ({
      toolConfirmations: {
        ...state.toolConfirmations,
        [toolCallId]: { approvalId, sessionId, autoAllowKey },
      },
    })),

  clearToolConfirmation: (toolCallId) =>
    set((state: ToolsStatusStateParam) => {
      if (
        !Object.prototype.hasOwnProperty.call(
          state.toolConfirmations,
          toolCallId,
        )
      ) {
        return state;
      }
      const next = { ...state.toolConfirmations };
      delete next[toolCallId];
      return { toolConfirmations: next };
    }),

  addAlwaysAllowTool: (sessionId, toolName) =>
    set((state: ToolsStatusStateParam) => {
      const current = state.alwaysAllowToolsBySession.get(sessionId);
      if (current?.has(toolName)) return state;
      const next = new Map(state.alwaysAllowToolsBySession);
      next.set(sessionId, new Set(current ?? []).add(toolName));
      return { alwaysAllowToolsBySession: next };
    }),
});
