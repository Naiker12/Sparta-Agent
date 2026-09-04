import { authFetch } from "@/features/auth";
import type { ProjectRecord } from "../../types";
import {
  notifyChatProjectsUpdated,
  parseJsonOrThrow,
} from "./base";

export async function listChatProjects(
  args: { includeArchived?: boolean } = {},
): Promise<ProjectRecord[]> {
  const params = new URLSearchParams();
  if (args.includeArchived !== undefined) {
    params.set("include_archived", String(args.includeArchived));
  }
  const qs = params.toString();
  const response = await authFetch(`/api/chat/projects${qs ? `?${qs}` : ""}`);
  const data = await parseJsonOrThrow<{ projects: ProjectRecord[] }>(response);
  return Array.isArray(data.projects) ? data.projects : [];
}

export async function getChatProject(
  projectId: string,
): Promise<ProjectRecord | null> {
  const response = await authFetch(
    `/api/chat/projects/${encodeURIComponent(projectId)}`,
  );
  if (response.status === 404) return null;
  return parseJsonOrThrow<ProjectRecord>(response);
}

export async function saveChatProject(
  project: ProjectRecord,
): Promise<ProjectRecord> {
  const response = await authFetch("/api/chat/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(project),
  });
  const saved = await parseJsonOrThrow<ProjectRecord>(response);
  notifyChatProjectsUpdated();
  return saved;
}

export async function updateChatProject(
  projectId: string,
  patch: Partial<ProjectRecord>,
): Promise<ProjectRecord> {
  const response = await authFetch(
    `/api/chat/projects/${encodeURIComponent(projectId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
  );
  const project = await parseJsonOrThrow<ProjectRecord>(response);
  notifyChatProjectsUpdated();
  return project;
}

export async function updateChatProjectWorkspace(
  projectId: string,
  connectedFolderPath: string | null,
  workspaceAccess: "read" | "write" = "read",
): Promise<ProjectRecord> {
  const response = await authFetch(
    `/api/chat/projects/${encodeURIComponent(projectId)}/workspace`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectedFolderPath, workspaceAccess }),
    },
  );
  const project = await parseJsonOrThrow<ProjectRecord>(response);
  notifyChatProjectsUpdated();
  return project;
}

export async function deleteChatProject(
  projectId: string,
  args: { deleteFiles?: boolean } = {},
): Promise<string[]> {
  const params = new URLSearchParams();
  if (args.deleteFiles) params.set("delete_files", "true");
  const qs = params.toString();
  const response = await authFetch(
    `/api/chat/projects/${encodeURIComponent(projectId)}${qs ? `?${qs}` : ""}`,
    { method: "DELETE" },
  );
  const data = await parseJsonOrThrow<
    ProjectRecord & { sandboxes_kept?: string[] }
  >(response);
  notifyChatProjectsUpdated();
  return Array.isArray(data?.sandboxes_kept) ? data.sandboxes_kept : [];
}
