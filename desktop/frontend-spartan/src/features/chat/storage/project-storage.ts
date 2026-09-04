import {
  deleteChatProject,
  getChatProject,
  listChatProjects,
  saveChatProject,
  updateChatProject,
  updateChatProjectWorkspace,
} from "../api/chat-api";
import type { ProjectRecord } from "../types";

export async function listStoredChatProjects(
  args: { includeArchived?: boolean } = {},
): Promise<ProjectRecord[]> {
  return listChatProjects(args);
}

export async function getStoredChatProject(
  projectId: string,
): Promise<ProjectRecord | null> {
  return getChatProject(projectId);
}

export async function createStoredChatProject(
  name: string,
): Promise<ProjectRecord> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Project name is required.");
  }
  const now = Date.now();
  return saveChatProject({
    id: crypto.randomUUID(),
    name: trimmed,
    instructions: "",
    archived: false,
    createdAt: now,
    updatedAt: now,
  });
}

export async function saveStoredChatProject(
  project: ProjectRecord,
): Promise<ProjectRecord> {
  return saveChatProject(project);
}

export async function updateStoredChatProject(
  projectId: string,
  patch: Partial<ProjectRecord>,
): Promise<ProjectRecord | undefined> {
  return updateChatProject(projectId, {
    ...patch,
    updatedAt: patch.updatedAt ?? Date.now(),
  });
}

export async function updateStoredChatProjectWorkspace(
  projectId: string,
  connectedFolderPath: string | null,
  workspaceAccess: "read" | "write" = "read",
): Promise<ProjectRecord> {
  return updateChatProjectWorkspace(
    projectId,
    connectedFolderPath,
    workspaceAccess,
  );
}

export async function deleteStoredChatProject(
  projectId: string,
  args: { deleteFiles?: boolean } = {},
): Promise<string[]> {
  return deleteChatProject(projectId, args);
}
