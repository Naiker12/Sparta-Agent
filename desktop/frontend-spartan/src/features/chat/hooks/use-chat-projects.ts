import { translate as uiTranslate } from "@/i18n";
import { useChatRuntimeStore } from "../stores/chat-runtime-store";
import {
  getPendingWorkspace,
  setPendingWorkspace,
} from "../utils/pending-workspace";
import { useDocumentPreviewStore } from "@/features/rag/components/preview-store";
import { useEffect, useState, useSyncExternalStore } from "react";
import { CHAT_PROJECTS_UPDATED_EVENT } from "../api/chat-api";
import { updateChatProjectWorkspace } from "../api/chat-api";
import type { ProjectRecord } from "../types";
import {
  createStoredChatProject,
  deleteStoredChatProject,
  isExpectedBackgroundChatStorageError,
  listStoredChatProjects,
  moveStoredChatItemToProject,
  updateStoredChatProject,
} from "../utils/chat-history-storage";
import { offerToDeleteKeptSandboxes } from "../utils/offer-kept-sandbox-files";
import { workspacePathKey } from "../utils/workspace-path-key";
import type { SidebarItem } from "./use-chat-sidebar-items";

let cachedProjects: ProjectRecord[] = [];
const deletingProjectIds = new Set<string>();
let projectsVersion = 0;
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
  cachedProjects = projects.filter(
    (project) => !deletingProjectIds.has(project.id),
  );
  projectsLoaded = true;
  for (const onStoreChange of projectSubscribers) {
    onStoreChange();
  }
}

function loadProjects(
  force = false,
  followUpIfPending = false,
): Promise<ProjectRecord[]> {
  if (projectsRequest) {
    if (followUpIfPending) {
      projectsRefreshPending = true;
    }
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
        const version = projectsVersion;
        const next = await listStoredChatProjects({ includeArchived: false });
        if (version !== projectsVersion) {
          projectsRefreshPending = true;
          continue;
        }
        nextProjects = Array.isArray(next) ? next : [];
      } catch (error) {
        if (!isExpectedBackgroundChatStorageError(error)) {
          throw error;
        }
        nextProjects = null;
      }
    } while (projectsRefreshPending);
    if (nextProjects !== null) {
      publishProjects(nextProjects);
    }
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
  error: string | null;
  retry: () => void;
} {
  const projects = useSyncExternalStore(
    subscribeToProjects,
    getProjectsSnapshot,
    getProjectsSnapshot,
  );
  const [isLoading, setIsLoading] = useState(!projectsLoaded);
  const [hasLoaded, setHasLoaded] = useState(projectsLoaded);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function refresh(force = false, followUpIfPending = false) {
      if (!force && projectsLoaded) {
        return;
      }
      if (!(cancelled || projectsLoaded)) {
        setIsLoading(true);
      }
      try {
        await loadProjects(force, followUpIfPending);
        if (!cancelled) setError(null);
      } catch (cause) {
        if (!cancelled)
          setError(
            cause instanceof Error
              ? cause.message
              : "No se pudieron cargar los proyectos.",
          );
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

  return {
    projects,
    isLoading,
    hasLoaded,
    error,
    retry: () => window.dispatchEvent(new Event(CHAT_PROJECTS_UPDATED_EVENT)),
  };
}

export async function createChatProject(name: string): Promise<ProjectRecord> {
  const project = await createStoredChatProject(name);
  projectsVersion++;
  publishProjects([
    ...cachedProjects.filter((item) => item.id !== project.id),
    project,
  ]);
  return project;
}

export async function renameChatProject(
  projectId: string,
  name: string,
): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error(uiTranslate("ui.project_name_is_required"));
  }
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
  getGitStatus?: (projectId: string) => Promise<{
    success: boolean;
    error?: string;
    isRepository?: boolean;
    branch?: string;
    upstream?: string;
    ahead?: number;
    behind?: number;
    changed?: number;
    added?: number;
    modified?: number;
    deleted?: number;
    untracked?: number;
    insertions?: number;
    deletions?: number;
  }>;
  getGitChanges?: (projectId: string) => Promise<{
    success: boolean;
    error?: string;
    isRepository?: boolean;
    changes: Array<{ path: string; status: string }>;
    conflicts?: string[];
  }>;
  getGitDiff?: (
    projectId: string,
    path: string,
  ) => Promise<{ success: boolean; error?: string; diff?: string }>;
  getGitBranches?: (
    projectId: string,
  ) => Promise<{ success: boolean; error?: string; branches: string[] }>;
  switchGitBranch?: (
    projectId: string,
    branch: string,
  ) => Promise<GitOperationResult>;
  stageGitPaths?: (
    projectId: string,
    paths: string[],
  ) => Promise<GitOperationResult>;
  unstageGitPaths?: (
    projectId: string,
    paths: string[],
  ) => Promise<GitOperationResult>;
  commitGit?: (
    projectId: string,
    message: string,
  ) => Promise<GitOperationResult>;
  pullGit?: (projectId: string) => Promise<GitOperationResult>;
  pushGit?: (projectId: string) => Promise<GitOperationResult>;
  resolveGitConflict?: (
    projectId: string,
    path: string,
    choice: "ours" | "theirs",
  ) => Promise<GitOperationResult>;
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
  setWorkspaceBinding?: (
    bindingId: string,
    root: string,
    access: "read" | "write" | "write_no_delete",
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
  readPreview?: (
    projectId: string,
    path: string,
  ) => Promise<{ success: boolean; bytes?: Uint8Array; error?: string }>;
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

type GitOperationResult = {
  success: boolean;
  error?: string;
  output?: string;
  conflicts: string[];
};

function nativeFilesystem(): NativeFilesystem | null {
  if (typeof window === "undefined") {
    return null;
  }
  return (window as Window & { fs?: NativeFilesystem }).fs ?? null;
}

export async function connectChatProjectWorkspace(
  projectId: string,
  workspaceAccess?: "read" | "write",
): Promise<string | null> {
  const selected = await chooseProjectWorkspaceFolder();
  if (!selected) {
    return null;
  }
  const access = workspaceAccess ?? (await requestWorkspaceAccess(selected));
  if (!access) {
    return null;
  }
  return setChatProjectWorkspace(projectId, selected, access);
}

export async function requestWorkspaceAccess(
  _folder: string,
): Promise<"read" | "write" | null> {
  return nativeFilesystem() ? "read" : null;
}

export async function requestThreadWorkspaceAccess(
  _folder: string,
): Promise<"read" | "write" | "write_no_delete" | null> {
  return nativeFilesystem()
    ? useChatRuntimeStore.getState().permissionMode === "full"
      ? "write"
      : "write_no_delete"
    : null;
}

export async function chooseProjectWorkspaceFolder(): Promise<string | null> {
  const filesystem = nativeFilesystem();
  if (!filesystem) {
    throw new Error(
      uiTranslate(
        "ui.connecting_a_local_folder_is_available_only_in_the_desktop_app",
      ),
    );
  }
  return filesystem.openFolderDialog();
}

export async function setChatProjectWorkspace(
  projectId: string,
  folder: string,
  workspaceAccess: "read" | "write" = "read",
): Promise<string | null> {
  const duplicate = cachedProjects.find(
    (project) =>
      project.id !== projectId &&
      project.connectedFolderPath &&
      workspacePathKey(project.connectedFolderPath) ===
        workspacePathKey(folder),
  );
  if (duplicate)
    throw new Error(uiTranslate("chat.workspace.alreadyConnected"));
  const project = await updateChatProjectWorkspace(
    projectId,
    folder,
    workspaceAccess,
  );
  projectsVersion++;
  publishProjects([
    ...cachedProjects.filter((item) => item.id !== project.id),
    project,
  ]);
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

let folderProjectOperation: Promise<ProjectRecord> | null = null;
export async function ensureFolderProject(
  folder: string,
): Promise<ProjectRecord> {
  const previous = folderProjectOperation;
  const operation = (async () => {
    if (previous) await previous.catch(() => undefined);
    const projects = await listStoredChatProjects({ includeArchived: true });
    const existing = projects.find(
      (p) =>
        p.connectedFolderPath &&
        workspacePathKey(p.connectedFolderPath) === workspacePathKey(folder),
    );
    if (existing) {
      const restored = existing.archived
        ? ((await updateStoredChatProject(existing.id, { archived: false })) ??
          existing)
        : existing;
      projectsVersion++;
      publishProjects([
        ...cachedProjects.filter((item) => item.id !== restored.id),
        restored,
      ]);
      return restored;
    }
    const project = await createChatProject(
      folder.split(/[\\/]/).filter(Boolean).pop() ?? "Carpeta de trabajo",
    );
    // Grouping does not grant edits to other chats. Their own binding decides access.
    await setChatProjectWorkspace(project.id, folder, "read");
    return {
      ...project,
      connectedFolderPath: folder,
      workspaceAccess: "read" as const,
    };
  })();
  folderProjectOperation = operation;
  try {
    return await operation;
  } finally {
    if (folderProjectOperation === operation) folderProjectOperation = null;
  }
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
  if (deletingProjectIds.has(projectId)) return;
  const removed = cachedProjects.find((project) => project.id === projectId);
  deletingProjectIds.add(projectId);
  projectsVersion++;
  publishProjects(cachedProjects);
  try {
    const kept = await deleteStoredChatProject(projectId, args);
    const runtime = useChatRuntimeStore.getState();
    if (runtime.activeProjectId === projectId) runtime.setActiveProjectId(null);
    const folder = removed?.connectedFolderPath;
    const pending = getPendingWorkspace();
    if (
      folder &&
      pending &&
      workspacePathKey(pending.folder) === workspacePathKey(folder)
    )
      setPendingWorkspace(null);
    const preview = useDocumentPreviewStore.getState();
    for (const tab of preview.tabs) {
      if (
        tab.repositoryPreview?.scope.id === projectId ||
        (folder &&
          tab.repositoryPreview &&
          workspacePathKey(tab.repositoryPreview.scope.root) ===
            workspacePathKey(folder)) ||
        tab.localPreview?.workspaceSource?.projectId === projectId
      )
        preview.closeTab(tab.id);
    }
    await nativeFilesystem()
      ?.clearWorkspaceRoot?.(projectId)
      .catch(() => undefined);
    window.dispatchEvent(new Event("sparta:workspace-changed"));
    offerToDeleteKeptSandboxes(kept);
  } catch (error) {
    deletingProjectIds.delete(projectId);
    if (removed) publishProjects([...cachedProjects, removed]);
    throw error;
  } finally {
    deletingProjectIds.delete(projectId);
    projectsVersion++;
    window.dispatchEvent(new Event(CHAT_PROJECTS_UPDATED_EVENT));
  }
}

export async function moveChatItemToProject(
  item: SidebarItem,
  projectId: string | null,
): Promise<void> {
  await moveStoredChatItemToProject(item, projectId);
}
