import { authFetch } from "@/features/auth";

export interface TurnChangeRef { id: string; threadId: string }
export interface TurnChangedFile {
  path: string;
  status: "added" | "modified" | "deleted";
  additions: number | null;
  deletions: number | null;
  binary: boolean;
}
export interface TurnChangeSet extends TurnChangeRef {
  state: "running" | "finished" | "undone";
  complete: boolean;
  canUndo: boolean;
  undoReason?: "capture_incomplete" | "content_unavailable" | "unverified_changes" | "not_finished" | "no_changes" | "workspace_not_writable" | null;
  files: TurnChangedFile[];
}
export class TurnChangesError extends Error {
  code: string;
  constructor(code: string) { super(code); this.code = code; }
}
const url = (ref: TurnChangeRef) => `/api/chat/threads/${encodeURIComponent(ref.threadId)}/changes/${encodeURIComponent(ref.id)}`;
async function request<T>(path: string, method = "GET"): Promise<T> {
  // Separate from generation's AbortSignal: cancellation must still finalize
  // the snapshot of files that were already written.
  const response = await authFetch(path, { method, signal: AbortSignal.timeout(30_000) });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new TurnChangesError(typeof body.detail === "string" ? body.detail : "capture_unavailable");
  }
  return response.json();
}
export const beginTurnChanges = (threadId: string) => request<TurnChangeRef>(`/api/chat/threads/${encodeURIComponent(threadId)}/changes`, "POST");
export const finishTurnChanges = (ref: TurnChangeRef) => request<TurnChangeSet>(url(ref) + "/finish", "POST");
export const getTurnChanges = (ref: TurnChangeRef) => request<TurnChangeSet>(url(ref));
export const undoTurnChanges = (ref: TurnChangeRef) => request<TurnChangeSet>(url(ref) + "/undo", "POST");
export const getTurnFileDiff = (ref: TurnChangeRef, path: string) => request<{ diff: string; binary: boolean; truncated: boolean }>(url(ref) + `?path=${encodeURIComponent(path)}`);

export function readTurnChangeRefs(value: unknown): TurnChangeRef[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is TurnChangeRef => entry != null && typeof entry === "object" && /^[a-f0-9]{32}$/.test(entry.id) && typeof entry.threadId === "string");
}
