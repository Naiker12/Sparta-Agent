import { bindThreadWorkspace, getThreadWorkspace, type WorkspaceAccess, type ThreadWorkspaceBinding } from "../api/modules/workspaces-api";
import { isAssistantLocalThreadId } from "./thread-ids";

export type PendingWorkspace = { folder: string; access: WorkspaceAccess };
const key = "sparta.pending-workspace";
let request: Promise<ThreadWorkspaceBinding | null> | null = null;
let requestThread: string | null = null;

export function getPendingWorkspace(): PendingWorkspace | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? "null");
    return value && typeof value.folder === "string" &&
      ["read", "write", "write_no_delete"].includes(value.access) ? value : null;
  } catch { return null; }
}

export function setPendingWorkspace(value: PendingWorkspace | null): void {
  if (value) sessionStorage.setItem(key, JSON.stringify(value));
  else sessionStorage.removeItem(key);
}

/** Both the composer and sender await the same durable binding operation. */
export async function ensureThreadWorkspace(threadId: string): Promise<ThreadWorkspaceBinding | null> {
  if (!threadId || isAssistantLocalThreadId(threadId)) return null;
  if (request && requestThread === threadId) return request;
  if (request) {
    await request;
    return getThreadWorkspace(threadId);
  }
  const pending = getPendingWorkspace();
  if (!pending) return getThreadWorkspace(threadId);
  requestThread = threadId;
  const operation = bindThreadWorkspace(threadId, pending.folder, pending.access).then((binding) => {
    const current = getPendingWorkspace();
    if (current?.folder === pending.folder && current.access === pending.access) setPendingWorkspace(null);
    return binding;
  });
  request = operation;
  try { return await operation; }
  finally { if (request === operation) { request = null; requestThread = null; } }
}
