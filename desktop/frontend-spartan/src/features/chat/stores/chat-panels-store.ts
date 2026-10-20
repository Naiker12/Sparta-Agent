import { create } from "zustand";
import { AUTH_SESSION_CLEARED_EVENT } from "@/features/auth/session-events";
import type { ThreadRecord } from "../types";
import { CHAT_PANE_LAYOUT_KEY, readPaneLayout, writePaneLayout } from "../utils/pane-layout";

export const CHAT_PANE_MIME = "application/x-spartan-chat-thread";
export const CHAT_PANE_OPEN_EVENT = "spartan:open-chat-pane";
export type ChatPane = { id: string; thread: ThreadRecord };
type ThreadReader = (id: string) => Promise<ThreadRecord | undefined>;
let restorePromise: Promise<void> | undefined;
let sessionGeneration = 0;
const dismissedThreadIds = new Set<string>();

export const useChatPanelsStore = create<{
  panes: ChatPane[];
  focusedId: string | null;
  workspaceMounted: boolean;
  requestedThreadId: string | null;
  layoutLoaded: boolean;
  restoringLayout: boolean;
  pendingRestoreIds: string[];
  pendingFocusedThreadId: string | null;
  restoreLayout: (readThread: ThreadReader) => Promise<void>;
  open: (thread: ThreadRecord) => boolean;
  focus: (id: string | null) => void;
  move: (id: string, targetId: string, after?: boolean) => void;
  close: (id: string) => void;
}>((set, get) => ({
  panes: [], focusedId: null, workspaceMounted: false, requestedThreadId: null,
  layoutLoaded: false, restoringLayout: false, pendingRestoreIds: [], pendingFocusedThreadId: null,
  restoreLayout(readThread) {
    if (restorePromise) return restorePromise;
    if (!get().layoutLoaded) {
      let layout = { threadIds: [] as string[], focusedThreadId: null as string | null };
      try { layout = readPaneLayout(window.localStorage); } catch { /* unavailable */ }
      set({ layoutLoaded: true, pendingRestoreIds: layout.threadIds, pendingFocusedThreadId: layout.focusedThreadId });
    }
    const ids = get().pendingRestoreIds;
    if (!ids.length) return Promise.resolve();
    const generation = sessionGeneration;
    set({ restoringLayout: true });
    const work = async () => {
      const results = await Promise.all(ids.map(async id => {
        try { return { id, thread: await readThread(id), failed: false }; }
        catch { return { id, thread: undefined, failed: true }; }
      }));
      if (generation !== sessionGeneration) return;
      set(state => {
        const panes = [...state.panes];
        const pendingRestoreIds: string[] = [];
        for (const result of results) {
          if (dismissedThreadIds.has(result.id)) continue;
          if (result.failed) { pendingRestoreIds.push(result.id); continue; }
          const thread = result.thread;
          if (!thread || thread.archived || thread.pairId || panes.some(pane => pane.thread.id === thread.id) || panes.length >= 3) continue;
          panes.push({ id: crypto.randomUUID(), thread });
        }
        const focused = panes.find(pane => pane.thread.id === state.pendingFocusedThreadId);
        return {
          panes, focusedId: focused?.id ?? state.focusedId,
          pendingRestoreIds: pendingRestoreIds.slice(0, 3 - panes.length),
          pendingFocusedThreadId: focused ? null : state.pendingFocusedThreadId,
          restoringLayout: false,
        };
      });
    };
    restorePromise = work().finally(() => { if (generation === sessionGeneration) restorePromise = undefined; });
    return restorePromise;
  },
  open(thread) {
    dismissedThreadIds.delete(thread.id);
    const existing = get().panes.find(pane => pane.thread.id === thread.id);
    if (existing) { set({ focusedId: existing.id, pendingFocusedThreadId: null }); return true; }
    if (get().panes.length >= 3) return false;
    const pane = { id: crypto.randomUUID(), thread };
    set(state => ({ panes: [...state.panes, pane], focusedId: pane.id, pendingFocusedThreadId: null, pendingRestoreIds: state.pendingRestoreIds.filter(id => id !== thread.id).slice(0, 2 - state.panes.length) }));
    return true;
  },
  focus: focusedId => set({ focusedId, pendingFocusedThreadId: null }),
  move: (id, targetId, after = false) => set(state => {
    const moving = state.panes.find(pane => pane.id === id);
    if (!moving || id === targetId || !state.panes.some(pane => pane.id === targetId)) return state;
    const panes = state.panes.filter(pane => pane.id !== id);
    const index = panes.findIndex(pane => pane.id === targetId);
    panes.splice(index + (after ? 1 : 0), 0, moving);
    return { panes, focusedId: id, pendingFocusedThreadId: null };
  }),
  close: id => {
    const threadId = get().panes.find(pane => pane.id === id)?.thread.id;
    if (threadId) dismissedThreadIds.add(threadId);
    set(state => ({
    panes: state.panes.filter(pane => pane.id !== id),
    focusedId: state.focusedId === id ? null : state.focusedId,
    pendingRestoreIds: state.pendingRestoreIds.filter(candidate => candidate !== threadId),
    pendingFocusedThreadId: state.pendingFocusedThreadId === threadId ? null : state.pendingFocusedThreadId,
  }));
  },
}));

useChatPanelsStore.subscribe((state, previous) => {
  if (!state.layoutLoaded || (state.panes === previous.panes && state.focusedId === previous.focusedId && state.pendingRestoreIds === previous.pendingRestoreIds && state.pendingFocusedThreadId === previous.pendingFocusedThreadId && previous.layoutLoaded)) return;
  const focusedThreadId = state.panes.find(pane => pane.id === state.focusedId)?.thread.id ?? state.pendingFocusedThreadId;
  try { writePaneLayout(window.localStorage, { threadIds: [...state.panes.map(pane => pane.thread.id), ...state.pendingRestoreIds].slice(0, 3), focusedThreadId }); }
  catch { /* unavailable */ }
});

export function requestChatPane(threadId: string): void {
  useChatPanelsStore.setState({ requestedThreadId: threadId });
  window.dispatchEvent(new CustomEvent(CHAT_PANE_OPEN_EVENT, { detail: threadId }));
}

if (typeof window !== "undefined") window.addEventListener(AUTH_SESSION_CLEARED_EVENT, () => {
  sessionGeneration++;
  restorePromise = undefined;
  dismissedThreadIds.clear();
  useChatPanelsStore.setState({ panes: [], focusedId: null, requestedThreadId: null, pendingRestoreIds: [], pendingFocusedThreadId: null, restoringLayout: false, layoutLoaded: false });
  try { window.localStorage.removeItem(CHAT_PANE_LAYOUT_KEY); } catch { /* unavailable */ }
});
