import { create } from "zustand";

export type LocalPreviewKind =
  | "image"
  | "audio"
  | "video"
  | "pdf"
  | "word"
  | "excel"
  | "csv"
  | "code"
  | "text"
  | "powerpoint"
  | "archive"
  | "unknown";

export interface LocalPreview {
  blob: Blob;
  filename: string;
  kind: LocalPreviewKind;
  /** Composer attachment that owns this preview, if any. */
  attachmentId?: string;
  /** Present only for files read from a connected project workspace. */
  workspaceSource?: { projectId: string; path: string };
}

// Global store for the shared preview Sheet, so any citation drives the one viewer
// without prop-drilling.
interface DocumentPreviewState {
  open: boolean;
  revision: number;
  documentId: string | null;
  /** Chunk to highlight; null opens at page 1. */
  chunkId: string | null;
  filename: string | null;
  page: number | null;
  localPreview: LocalPreview | null;
  tabs: PreviewTab[];
  activeTabId: string | null;
  selectTab: (id: string) => void;
  closeTab: (id: string) => void;
  removeAttachmentPreview: (attachmentId: string) => void;
  openPreview: (args: {
    documentId: string;
    chunkId?: string | null;
    filename?: string | null;
    page?: number | null;
  }) => void;
  openLocalPreview: (preview: LocalPreview) => void;
  closePreview: () => void;
}

export interface PreviewTab {
  id: string;
  documentId: string | null;
  chunkId: string | null;
  filename: string | null;
  page: number | null;
  localPreview: LocalPreview | null;
}

function selectedTab(tab?: PreviewTab) {
  return {
    open: Boolean(tab), activeTabId: tab?.id ?? null,
    documentId: tab?.documentId ?? null, chunkId: tab?.chunkId ?? null,
    filename: tab?.filename ?? null, page: tab?.page ?? null,
    localPreview: tab?.localPreview ?? null,
  };
}

export const useDocumentPreviewStore = create<DocumentPreviewState>((set) => ({
  open: false,
  revision: 0,
  documentId: null,
  chunkId: null,
  filename: null,
  page: null,
  localPreview: null,
  tabs: [],
  activeTabId: null,
  selectTab: (id) => set((state) => {
    const tab = state.tabs.find((item) => item.id === id);
    return tab ? { ...selectedTab(tab), revision: state.revision + 1 } : state;
  }),
  closeTab: (id) => set((state) => {
    const index = state.tabs.findIndex((tab) => tab.id === id);
    if (index < 0) return state;
    const tabs = state.tabs.filter((tab) => tab.id !== id);
    return state.activeTabId === id
      ? { tabs, ...selectedTab(tabs[Math.min(index, tabs.length - 1)]), revision: state.revision + 1 }
      : { tabs };
  }),
  removeAttachmentPreview: (attachmentId) => set((state) => {
    const tabs = state.tabs.filter((tab) => tab.localPreview?.attachmentId !== attachmentId);
    if (tabs.length === state.tabs.length) return state;
    const current = tabs.find((tab) => tab.id === state.activeTabId);
    return { tabs, ...selectedTab(current ?? tabs.at(-1)), revision: state.revision + 1 };
  }),
  openPreview: ({ documentId, chunkId, filename, page }) =>
    set((state) => {
      const tab: PreviewTab = { id: `document:${documentId}`, documentId, chunkId: chunkId ?? null, filename: filename ?? null, page: page ?? null, localPreview: null };
      const exists = state.tabs.some((item) => item.id === tab.id);
      return { ...selectedTab(tab), revision: state.revision + 1, tabs: exists ? state.tabs.map((item) => item.id === tab.id ? tab : item) : [...state.tabs, tab] };
    }),
  openLocalPreview: (localPreview) =>
    set((state) => {
      const existing = state.tabs.find((tab) => {
        const other = tab.localPreview;
        if (!other) return false;
        if (localPreview.attachmentId) return other.attachmentId === localPreview.attachmentId;
        if (localPreview.workspaceSource) return other.workspaceSource?.projectId === localPreview.workspaceSource.projectId && other.workspaceSource?.path === localPreview.workspaceSource.path;
        return other.blob === localPreview.blob;
      });
      const tab: PreviewTab = { id: existing?.id ?? `local:${crypto.randomUUID()}`, documentId: null, chunkId: null, filename: localPreview.filename, page: null, localPreview };
      return { ...selectedTab(tab), revision: state.revision + 1, tabs: existing ? state.tabs.map((item) => item.id === tab.id ? tab : item) : [...state.tabs, tab] };
    }),
  // The rendered preview can hold a large Blob (and parsers often create an
  // ArrayBuffer copy). Clear every local reference as soon as it closes.
  closePreview: () =>
    set({
      open: false,
      documentId: null,
      chunkId: null,
      filename: null,
      page: null,
      localPreview: null,
      tabs: [],
      activeTabId: null,
    }),
}));
