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
}

// Global store for the shared preview Sheet, so any citation drives the one viewer
// without prop-drilling.
interface DocumentPreviewState {
  open: boolean;
  documentId: string | null;
  /** Chunk to highlight; null opens at page 1. */
  chunkId: string | null;
  filename: string | null;
  page: number | null;
  localPreview: LocalPreview | null;
  openPreview: (args: {
    documentId: string;
    chunkId?: string | null;
    filename?: string | null;
    page?: number | null;
  }) => void;
  openLocalPreview: (preview: LocalPreview) => void;
  closePreview: () => void;
}

export const useDocumentPreviewStore = create<DocumentPreviewState>((set) => ({
  open: false,
  documentId: null,
  chunkId: null,
  filename: null,
  page: null,
  localPreview: null,
  openPreview: ({ documentId, chunkId, filename, page }) =>
    set({
      open: true,
      documentId,
      chunkId: chunkId ?? null,
      filename: filename ?? null,
      page: page ?? null,
      localPreview: null,
    }),
  openLocalPreview: (localPreview) =>
    set({
      open: true,
      documentId: null,
      chunkId: null,
      filename: localPreview.filename,
      page: null,
      localPreview,
    }),
  closePreview: () => set({ open: false }),
}));
