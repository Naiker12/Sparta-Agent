import {
  type ThreadWorkspaceBinding,
  type WorkspaceAccess,
  bindThreadWorkspace,
  getThreadWorkspace,
} from "../api/modules/workspaces-api";
import { isAssistantLocalThreadId } from "./thread-ids";

export type PendingWorkspace = { folder: string; access: WorkspaceAccess };
const key = "sparta.pending-workspace";
const requests = new Map<string, Promise<ThreadWorkspaceBinding | null>>();
const claimedWorkspaces = new Map<string, PendingWorkspace>();

/** A draft folder belongs only to the new primary chat created from that draft. */
export function claimPendingWorkspace(threadId: string): void {
  const pending = getPendingWorkspace();
  if (pending) claimedWorkspaces.set(threadId, pending);
}

export function getPendingWorkspace(): PendingWorkspace | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? sessionStorage.getItem(key) ?? "null");
    return value &&
      typeof value.folder === "string" &&
      ["read", "write", "write_no_delete"].includes(value.access)
      ? value
      : null;
  } catch {
    return null;
  }
}

export function setPendingWorkspace(value: PendingWorkspace | null): void {
  if (value) {
    localStorage.setItem(key, JSON.stringify(value));
    sessionStorage.removeItem(key);
  } else {
    sessionStorage.removeItem(key);
    localStorage.removeItem(key);
  }
  window.dispatchEvent(new Event("sparta:workspace-changed"));
}

/** Both the composer and sender await the same durable binding operation. */
export async function ensureThreadWorkspace(
  threadId: string,
): Promise<ThreadWorkspaceBinding | null> {
  if (!threadId || isAssistantLocalThreadId(threadId)) {
    return null;
  }
  const inFlight = requests.get(threadId);
  if (inFlight) return inFlight;
  const operation = (async () => {
    const existing = await getThreadWorkspace(threadId);
    if (existing) {
      claimedWorkspaces.delete(threadId);
      return existing;
    }
    const pending = claimedWorkspaces.get(threadId);
    if (!pending) return null;
    const binding = await bindThreadWorkspace(threadId, pending.folder, pending.access);
    claimedWorkspaces.delete(threadId);
    const current = getPendingWorkspace();
    if (current?.folder === pending.folder && current.access === pending.access) {
      setPendingWorkspace(null);
    }
    return binding;
  })();
  requests.set(threadId, operation);
  try {
    return await operation;
  } finally {
    if (requests.get(threadId) === operation) requests.delete(threadId);
  }
}
