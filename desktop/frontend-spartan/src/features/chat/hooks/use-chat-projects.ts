import { useEffect, useState, useSyncExternalStore } from "react";
import { getLocale } from "@/i18n";
import { CHAT_PROJECTS_UPDATED_EVENT } from "../api/chat-api";
import type { ProjectRecord } from "../types";
import {
  createStoredChatProject,
  deleteStoredChatProject,
  isExpectedBackgroundChatStorageError,
  listStoredChatProjects,
  moveStoredChatItemToProject,
  updateStoredChatProject,
} from "../utils/chat-history-storage";
import { updateChatProjectWorkspace } from "../api/chat-api";
import { offerToDeleteKeptSandboxes } from "../utils/offer-kept-sandbox-files";
import type { SidebarItem } from "./use-chat-sidebar-items";

let cachedProjects: ProjectRecord[] = [];
let projectsLoaded = false;
let projectsRequest: Promise<ProjectRecord[]> | null = null;
let projectsRefreshPending = false;
let lastProjectsUpdateEvent: Event | null = null;
const projectSubscribers = new Set<() => void>();

function subscribeToProjects(onStoreChange: () => void): () => void {
  projectSubscribers.add(onStoreChange);
  return () => projectSubscribers.delete(onStoreChange);
}

function getProjectsSnapshot(): ProjectRecord[] {
  return cachedProjects;
}

function publishProjects(projects: ProjectRecord[]): void {
  cachedProjects = projects;
  projectsLoaded = true;
  for (const onStoreChange of projectSubscribers) onStoreChange();
}

function loadProjects(
  force = false,
  followUpIfPending = false,
): Promise<ProjectRecord[]> {
  if (projectsRequest) {
    if (followUpIfPending) projectsRefreshPending = true;
    return projectsRequest;
  }
  if (!force && projectsLoaded) {
    return Promise.resolve(cachedProjects);
  }

  async function run(): Promise<ProjectRecord[]> {
    let nextProjects: ProjectRecord[] | null = null;
    do {
      projectsRefreshPending = false;
      try {
        const next = await listStoredChatProjects({ includeArchived: false });
        nextProjects = Array.isArray(next) ? next : [];
      } catch (error) {
        if (!isExpectedBackgroundChatStorageError(error)) throw error;
        nextProjects = null;
      }
    } while (projectsRefreshPending);
    if (nextProjects !== null) publishProjects(nextProjects);
    return cachedProjects;
  }

  const request = run().finally(() => {
    projectsRequest = null;
  });
  projectsRequest = request;
  return request;
}

export function useChatProjects(): {
  projects: ProjectRecord[];
  isLoading: boolean;
  hasLoaded: boolean;
} {
  const projects = useSyncExternalStore(
    subscribeToProjects,
    getProjectsSnapshot,
    getProjectsSnapshot,
  );
  const [isLoading, setIsLoading] = useState(!projectsLoaded);
  const [hasLoaded, setHasLoaded] = useState(projectsLoaded);

  useEffect(() => {
    let cancelled = false;

    async function refresh(force = false, followUpIfPending = false) {
      if (!force && projectsLoaded) return;
      if (!cancelled && !projectsLoaded) setIsLoading(true);
      try {
        await loadProjects(force, followUpIfPending);
      } finally {
        if (!cancelled) {
          setHasLoaded(true);
          setIsLoading(false);
        }
      }
    }

    const onProjectsUpdated = (event: Event) => {
      const followUpIfPending = event !== lastProjectsUpdateEvent;
      lastProjectsUpdateEvent = event;
      void refresh(true, followUpIfPending);
    };
    // Cached rows render immediately, then one shared request reconciles
    // changes made by another browser tab or API client.
    void refresh(projectsLoaded);
    window.addEventListener(CHAT_PROJECTS_UPDATED_EVENT, onProjectsUpdated);
    return () => {
      cancelled = true;
      window.removeEventListener(
        CHAT_PROJECTS_UPDATED_EVENT,
        onProjectsUpdated,
      );
    };
  }, []);

  return { projects, isLoading, hasLoaded };
}

export async function createChatProject(name: string): Promise<ProjectRecord> {
  return createStoredChatProject(name);
}

export async function renameChatProject(
  projectId: string,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Project name is required.");
  await updateStoredChatProject(projectId, { name: trimmed });
}

export async function updateChatProjectInstructions(
  projectId: string,
  instructions: string,
): Promise<void> {
  await updateStoredChatProject(projectId, {
    instructions: instructions.trim(),
  });
}

type NativeFilesystem = {
  openFolderDialog: () => Promise<string | null>;
  confirmWorkspaceAccess?: (
    folderPath: string,
    locale?: string,
  ) => Promise<"read" | "write" | "write_no_delete" | null>;
  getPathForFile?: (file: File) => string | null;
  setWorkspaceRoot?: (
    projectId: string,
    root: string,
    access?: "read" | "write",
  ) => Promise<{ success: boolean; error?: string }>;
  clearWorkspaceRoot?: (
    projectId: string,
  ) => Promise<{ success: boolean; error?: string }>;
  readDirLevel?: (
    projectId: string,
    path: string,
  ) => Promise<{
    nodes: Array<{ name: string; path: string; type: "file" | "directory" }>;
    error?: string;
  }>;
  readFile?: (
    projectId: string,
    path: string,
    encoding?: "utf-8",
  ) => Promise<{
    success: boolean;
    content?: string;
    error?: string;
  }>;
  writeFile?: (
    projectId: string,
    path: string,
    content: string,
  ) => Promise<{
    success: boolean;
    error?: string;
  }>;
};

function nativeFilesystem(): NativeFilesystem | null {
  if (typeof window === "undefined") return null;
  return (window as Window & { fs?: NativeFilesystem }).fs ?? null;
}

export async function connectChatProjectWorkspace(
  projectId: string,
  workspaceAccess?: "read" | "write",
): Promise<string | null> {
  const selected = await chooseProjectWorkspaceFolder();
  if (!selected) return null;
  const access = workspaceAccess ?? (await requestWorkspaceAccess(selected));
  if (!access) return null;
  return setChatProjectWorkspace(projectId, selected, access);
}

export async function requestWorkspaceAccess(
  folder: string,
): Promise<"read" | "write" | null> {
  const filesystem = nativeFilesystem();
  if (!filesystem) return null;
  if (filesystem.confirmWorkspaceAccess) {
    const access = await filesystem.confirmWorkspaceAccess(folder, getLocale());
    return access === "write_no_delete" ? "write" : access;
  }
  return "read";
}

export async function requestThreadWorkspaceAccess(
  folder: string,
): Promise<"read" | "write" | "write_no_delete" | null> {
  const filesystem = nativeFilesystem();
  if (!filesystem) return null;
  if (filesystem.confirmWorkspaceAccess)
    return filesystem.confirmWorkspaceAccess(folder, getLocale());
  return "read";
}

export async function chooseProjectWorkspaceFolder(): Promise<string | null> {
  const filesystem = nativeFilesystem();
  if (!filesystem) {
    throw new Error(
      "Connecting a local folder is available only in the desktop app.",
    );
  }
  return filesystem.openFolderDialog();
}

export async function setChatProjectWorkspace(
  projectId: string,
  folder: string,
  workspaceAccess: "read" | "write" = "read",
): Promise<string | null> {
  const project = await updateChatProjectWorkspace(
    projectId,
    folder,
    workspaceAccess,
  );
  const filesystem = nativeFilesystem();
  const configured = await filesystem?.setWorkspaceRoot?.(
    projectId,
    project.connectedFolderPath ?? folder,
    project.workspaceAccess ?? "read",
  );
  if (configured && !configured.success) {
    throw new Error(configured.error ?? "Unable to connect workspace folder.");
  }
  return project.connectedFolderPath ?? null;
}

export function getProjectNativeFilesystem(): NativeFilesystem | null {
  return nativeFilesystem();
}

export function getDroppedNativePath(file: File): string | null {
  return nativeFilesystem()?.getPathForFile?.(file) ?? null;
}

export async function disconnectChatProjectWorkspace(
  projectId: string,
): Promise<void> {
  await updateChatProjectWorkspace(projectId, null);
  await nativeFilesystem()?.clearWorkspaceRoot?.(projectId);
}

export async function deleteChatProject(
  projectId: string,
  args: { deleteFiles?: boolean } = {},
): Promise<void> {
  const kept = await deleteStoredChatProject(projectId, args);
  // The member chats went with the project, so their own sandboxes are
  // reachable from nothing: the same offer an ordinary chat delete makes, and
  // a sandbox the backend could not remove is kept even when asked to go.
  offerToDeleteKeptSandboxes(kept);
}

export async function moveChatItemToProject(
  item: SidebarItem,
  projectId: string | null,
): Promise<void> {
  await moveStoredChatItemToProject(item, projectId);
}
