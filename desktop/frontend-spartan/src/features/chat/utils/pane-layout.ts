export const CHAT_PANE_LAYOUT_KEY = "spartan:chat-pane-layout:v1";
export type PaneLayout = { threadIds: string[]; focusedThreadId: string | null };
type LayoutStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function parsePaneLayout(raw: string | null): PaneLayout {
  const empty = { threadIds: [], focusedThreadId: null };
  try {
    const value = JSON.parse(raw ?? "null");
    if (!value || value.version !== 1 || !Array.isArray(value.threadIds)) return empty;
    const threadIds = [...new Set<string>(value.threadIds.filter((id: unknown): id is string =>
      typeof id === "string" && id.length > 0 && id.length <= 200 && id.trim() === id && !id.startsWith("__LOCALID_"),
    ))].slice(0, 3);
    return { threadIds, focusedThreadId: threadIds.includes(value.focusedThreadId) ? value.focusedThreadId : null };
  } catch { return empty; }
}

export function readPaneLayout(storage: LayoutStorage): PaneLayout {
  try { return parsePaneLayout(storage.getItem(CHAT_PANE_LAYOUT_KEY)); }
  catch { return { threadIds: [], focusedThreadId: null }; }
}

export function writePaneLayout(storage: LayoutStorage, layout: PaneLayout): void {
  try {
    if (!layout.threadIds.length) storage.removeItem(CHAT_PANE_LAYOUT_KEY);
    else storage.setItem(CHAT_PANE_LAYOUT_KEY, JSON.stringify({ version: 1, ...layout }));
  } catch { /* Storage restrictions must not interrupt a conversation. */ }
}
