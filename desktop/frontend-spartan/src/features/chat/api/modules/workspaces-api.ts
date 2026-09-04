import { authFetch } from "@/features/auth";
import { isAssistantLocalThreadId } from "../../utils/thread-ids";
import { parseJsonOrThrow } from "./base";

export type WorkspaceAccess = "read" | "write" | "write_no_delete";

export interface ThreadWorkspaceBinding {
  bindingId: string;
  threadId: string;
  id: string;
  displayName: string;
  canonicalPath: string;
  filesystemIdentity?: string | null;
  access: WorkspaceAccess;
  createdAt: number;
  updatedAt: number;
  lastUsedAt?: number | null;
  boundAt: number;
}

export async function getThreadWorkspace(
  threadId: string,
): Promise<ThreadWorkspaceBinding | null> {
  if (!threadId || isAssistantLocalThreadId(threadId)) {
    return null;
  }
  const response = await authFetch(
    `/api/chat/threads/${encodeURIComponent(threadId)}/workspace`,
  );
  if (response.status === 404) return null;
  return parseJsonOrThrow<ThreadWorkspaceBinding | null>(response);
}

export async function bindThreadWorkspace(
  threadId: string,
  folderPath: string,
  access: WorkspaceAccess,
): Promise<ThreadWorkspaceBinding> {
  const response = await authFetch(
    `/api/chat/threads/${encodeURIComponent(threadId)}/workspace`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folderPath, access }),
    },
  );
  return parseJsonOrThrow<ThreadWorkspaceBinding>(response);
}

export async function unbindThreadWorkspace(threadId: string): Promise<void> {
  const response = await authFetch(
    `/api/chat/threads/${encodeURIComponent(threadId)}/workspace`,
    {
      method: "DELETE",
    },
  );
  if (!response.ok && response.status !== 404) {
    await parseJsonOrThrow(response);
  }
}
