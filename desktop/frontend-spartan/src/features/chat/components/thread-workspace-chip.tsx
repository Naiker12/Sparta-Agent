import { useT } from "@/i18n";
import { default as Folder01Icon } from "@hugeicons/core-free-icons/Folder01Icon";
import { default as FolderAddIcon } from "@hugeicons/core-free-icons/FolderAddIcon";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useRef, useState } from "react";
import { useAuiState } from "@assistant-ui/react";
import { CheckIcon, ChevronDownIcon, XIcon, GitBranchIcon } from "lucide-react";
import { useDocumentPreviewStore } from "@/features/rag/components/preview-store";
import {
  configureGitReview,
  type GitReviewScope,
} from "../api/modules/workspace-git-api";
import { getProjectNativeFilesystem } from "../hooks/use-chat-projects";
import { useWorkspaceStore } from "../stores/use-workspace-store";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "@/lib/toast";
import {
  type ThreadWorkspaceBinding,
  type WorkspaceAccess,
  bindThreadWorkspace,
  getThreadWorkspace,
  unbindThreadWorkspace,
} from "../api/chat-api";
import {
  chooseProjectWorkspaceFolder,
  ensureFolderProject,
  useChatProjects,
} from "../hooks/use-chat-projects";
import { workspacePathKey } from "../utils/workspace-path-key";
import { hasUnconnectedWorkspacePath } from "../utils/workspace-path-mention";
import { useChatRuntimeStore } from "../stores/chat-runtime-store";
import {
  type PendingWorkspace,
  getPendingWorkspace,
  setPendingWorkspace,
} from "../utils/pending-workspace";
import { isAssistantLocalThreadId } from "../utils/thread-ids";

type NativeWorkspaceBridge = {
  setWorkspaceBinding?: (
    bindingId: string,
    root: string,
    access: WorkspaceAccess,
  ) => Promise<{ success: boolean; error?: string }>;
  clearWorkspaceBinding?: (
    bindingId: string,
  ) => Promise<{ success: boolean; error?: string }>;
};

function label(path: string): string {
  return (
    path
      .replace(/[\\/]+$/, "")
      .split(/[\\/]/)
      .pop() || path
  );
}

/** The visible workspace capability for the currently open chat. */
export function ThreadWorkspaceChip({
  isRunning = false,
  threadId: explicitThreadId,
}: { isRunning?: boolean; threadId?: string }) {
  const t = useT();
  const runtimeThreadId = useAuiState(({ threadListItem }) => threadListItem.remoteId);
  const composerText = useAuiState(({ composer }) => composer.text);
  const threadId = explicitThreadId ?? runtimeThreadId;
  const isDraft = !threadId || isAssistantLocalThreadId(threadId);
  const ownerRef = useRef(threadId);
  ownerRef.current = threadId;
  const { projects, isLoading, error, retry } = useChatProjects();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  const barRef = useRef<HTMLDivElement>(null);
  const [binding, setBinding] = useState<ThreadWorkspaceBinding | null>(null);
  const [pending, setPending] = useState<PendingWorkspace | null>(
    () => explicitThreadId ? null : getPendingWorkspace(),
  );
  const [gitStatus, setGitStatus] = useState<{
    scopeKey: string;
    isRepository?: boolean;
    branch?: string;
    upstream?: string;
    changed?: number;
    insertions?: number;
    deletions?: number;
  } | null>(null);

  useEffect(() => {
    const refresh = () => {
      setPending(explicitThreadId ? null : getPendingWorkspace());
      setRevision((value) => value + 1);
    };
    window.addEventListener("sparta:workspace-changed", refresh);
    return () =>
      window.removeEventListener("sparta:workspace-changed", refresh);
  }, [explicitThreadId]);

  useEffect(() => {
    setOpen(false);
    setBusy(false);
    setPending(!explicitThreadId && isDraft ? getPendingWorkspace() : null);
  }, [threadId, explicitThreadId, isDraft]);

  useEffect(() => {
    if (isRunning) setOpen(false);
  }, [isRunning]);

  useEffect(() => {
    const form = barRef.current?.closest("form");
    const close = () => setOpen(false);
    form?.addEventListener("submit", close);
    return () => form?.removeEventListener("submit", close);
  }, []);

  useEffect(() => {
    if (!threadId || isAssistantLocalThreadId(threadId)) {
      setBinding(null);
      return;
    }
    let cancelled = false;
    // Viewing a saved chat must never consume another draft's pending folder.
    void getThreadWorkspace(threadId)
      .then(async (next) => {
        if (cancelled) {
          return;
        }
        if (!next) {
          setBinding(null);
          return;
        }
        setBinding(next);
        setPending(null);
        if (next.projectId && !explicitThreadId)
          useChatRuntimeStore.getState().setActiveProjectId(next.projectId);
        const bridge = (window as Window & { fs?: NativeWorkspaceBridge }).fs;
        const configured = await bridge?.setWorkspaceBinding?.(
          next.bindingId,
          next.canonicalPath,
          next.access,
        );
        if (configured && !configured.success) {
          throw new Error(configured.error);
        }
        if (cancelled) {
          return;
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        toast.error(t("chat.workspace.errorPrepare"), {
          description: error instanceof Error ? error.message : undefined,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [threadId, t, revision, explicitThreadId]);

  async function selectFolder() {
    setOpen(false);
    try {
      const folder = await chooseProjectWorkspaceFolder();
      if (!folder) {
        return;
      }
      if (
        workspacePathKey(currentPath ?? "") ===
        workspacePathKey(folder)
      )
        return;
      await connectFolder(folder);
    } catch (error) {
      toast.error(t("chat.workspace.errorSelect"), {
        description: error instanceof Error ? error.message : undefined,
      });
    }
  }

  async function connectFolder(folder: string) {
    const access: WorkspaceAccess =
      !explicitThreadId && useChatRuntimeStore.getState().permissionMode === "full"
        ? "write"
        : "write_no_delete";
    setBusy(true);
    try {
      const activeThreadId = threadId;
      if (!activeThreadId || isAssistantLocalThreadId(activeThreadId)) {
        if (!useChatRuntimeStore.getState().incognito) {
          const project = await ensureFolderProject(folder);
          if (ownerRef.current !== activeThreadId) return;
          useChatRuntimeStore.getState().setActiveProjectId(project.id);
        }
        setPendingWorkspace({ folder, access });
        setPending({ folder, access });
        return;
      }
      const next = await bindThreadWorkspace(activeThreadId, folder, access);
      const bridge = (window as Window & { fs?: NativeWorkspaceBridge }).fs;
      const configured = await bridge?.setWorkspaceBinding?.(
        next.bindingId,
        next.canonicalPath,
        next.access,
      );
      if (configured && !configured.success) {
        throw new Error(configured.error);
      }
      if (ownerRef.current === activeThreadId) setBinding(next);
      if (ownerRef.current === activeThreadId && next.projectId && !explicitThreadId)
        useChatRuntimeStore.getState().setActiveProjectId(next.projectId);
      window.dispatchEvent(new Event("sparta:workspace-changed"));
    } catch (error) {
      toast.error(t("chat.workspace.errorConnect"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      if (ownerRef.current === threadId) setBusy(false);
    }
  }

  async function disconnect() {
    setOpen(false);
    if (!explicitThreadId && isDraft) setPendingWorkspace(null);
    setPending(null);
    if (!threadId || isAssistantLocalThreadId(threadId) || !visibleBinding) {
      if (ownerRef.current === threadId) setBinding(null);
      window.dispatchEvent(new Event("sparta:workspace-changed"));
      return;
    }
    setBusy(true);
    try {
      await unbindThreadWorkspace(threadId);
      const bridge = (window as Window & { fs?: NativeWorkspaceBridge }).fs;
      await bridge?.clearWorkspaceBinding?.(visibleBinding.bindingId);
      if (ownerRef.current === threadId) setBinding(null);
      window.dispatchEvent(new Event("sparta:workspace-changed"));
    } catch (error) {
      toast.error(t("chat.workspace.errorDisconnect"), {
        description: error instanceof Error ? error.message : undefined,
      });
    } finally {
      if (ownerRef.current === threadId) setBusy(false);
    }
  }

  const visibleBinding = binding?.threadId === threadId ? binding : null;
  const visiblePending = !explicitThreadId && isDraft ? pending : null;
  const currentPath = visibleBinding?.canonicalPath ?? visiblePending?.folder;
  const currentAccess = visibleBinding?.access ?? visiblePending?.access;
  const currentProject = projects.find(
    (project) =>
      currentPath &&
      project.connectedFolderPath &&
      workspacePathKey(project.connectedFolderPath) ===
        workspacePathKey(currentPath),
  );
  const scopeId =
    visibleBinding?.bindingId ??
    (visiblePending && currentPath
      ? `sparta-draft:${workspacePathKey(currentPath)}`
      : currentProject?.id);
  const isBinding = Boolean(visibleBinding || visiblePending);
  const mentionedUnconnectedPath = hasUnconnectedWorkspacePath(composerText, currentPath);
  const gitScopeKey = `${scopeId ?? ""}\0${currentPath ?? ""}`;
  const visibleGitStatus = gitStatus?.scopeKey === gitScopeKey ? gitStatus : null;
  const scope: GitReviewScope | null =
    currentPath && scopeId
      ? {
          id: scopeId,
          root: currentPath,
          access: currentAccess ?? "read",
          binding: isBinding,
        }
      : null;
  useEffect(() => {
    let cancelled = false;
    setGitStatus(null);
    if (!explicitThreadId) useWorkspaceStore
      .getState()
      .setCapabilities({ hasGit: false, hasGithub: false });
    if (!currentPath || !scopeId) return;
    const refresh = async () => {
      try {
        await configureGitReview({
          id: scopeId,
          root: currentPath,
          access: currentAccess ?? "read",
          binding: isBinding,
        });
        const result =
          await getProjectNativeFilesystem()?.getGitStatus?.(scopeId);
        if (!cancelled) {
          setGitStatus(result?.success ? { ...result, scopeKey: gitScopeKey } : null);
          if (!explicitThreadId) useWorkspaceStore
            .getState()
            .setCapabilities({
              hasGit: Boolean(result?.success && result.isRepository),
              hasGithub: Boolean(result?.success && result.isRepository),
            });
        }
      } catch {
        if (!cancelled) setGitStatus(null);
      }
    };
    void refresh();
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    const timer = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, 15000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [currentPath, scopeId, currentAccess, isBinding, revision, explicitThreadId, gitScopeKey]);
  function openRepository(kind: "changes" | "github") {
    if (!scope) return;
    setOpen(false);
    useDocumentPreviewStore
      .getState()
      .openRepositoryPreview(
        { scope, kind },
        t(`chat.repository.${kind === "changes" ? "changes" : "pullRequests"}`),
      );
  }

  const chip = (
    <button
      type="button"
      disabled={busy || isRunning}
      className="composer-pill-btn composer-pill-workspace"
      data-keep-label="true"
      aria-label={
        currentPath ? label(currentPath) : t("chat.workspace.chipLabel")
      }
      title={currentPath ?? t("chat.workspace.chipLabel")}
    >
      <span className="composer-pill-glyph">
        <HugeiconsIcon
          icon={visibleBinding || visiblePending ? Folder01Icon : FolderAddIcon}
          className="size-3.5"
          strokeWidth={1.8}
        />
      </span>
      <span className="max-w-48 truncate">
        {currentPath ? label(currentPath) : t("chat.workspace.chipLabel")}
      </span>
      <ChevronDownIcon className="size-3 shrink-0" />
    </button>
  );

  return (
    <>
      <div
        ref={barRef}
        data-tour="chat-workspace"
        className="composer-workspace-bar"
        aria-label={t("chat.workspace.contextLabel")}
      >
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild={true}>{chip}</PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            className="w-80 max-w-[calc(100vw-2rem)] p-0"
          >
            {currentPath && visibleGitStatus?.isRepository && (
              <div className="flex flex-col gap-2 border-b p-3">
                <p className="truncate text-sm font-medium">
                  {label(currentPath!)} · {visibleGitStatus.branch ?? "HEAD"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {visibleGitStatus.upstream ?? t("chat.repository.noUpstream")} ·{" "}
                  {t("chat.repository.fileCount", {
                    count: visibleGitStatus.changed ?? 0,
                  })}{" "}
                  · +{visibleGitStatus.insertions ?? 0} −{visibleGitStatus.deletions ?? 0}
                </p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openRepository("changes")}
                  >
                    {t("chat.repository.changes")}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openRepository("github")}
                  >
                    {t("chat.repository.pullRequests")}
                  </Button>
                </div>
              </div>
            )}
            <Command>
              <CommandInput placeholder={t("chat.workspace.searchFolders")} />
              <CommandList>
                <CommandEmpty>
                  {isLoading
                    ? t("chat.workspace.loading")
                    : t("chat.workspace.noFolders")}
                </CommandEmpty>
                <CommandGroup heading={t("chat.workspace.recentFolders")}>
                  {projects
                    .filter((project) => project.connectedFolderPath)
                    .sort((a, b) => b.updatedAt - a.updatedAt)
                    .map((project) => {
                      const folder = project.connectedFolderPath!;
                      const selected = Boolean(
                        currentPath &&
                          workspacePathKey(currentPath) ===
                            workspacePathKey(folder),
                      );
                      return (
                        <CommandItem
                          key={project.id}
                          value={project.id}
                          keywords={[project.name, folder]}
                          disabled={busy}
                          onSelect={() => {
                            setOpen(false);
                            if (selected) return;
                            void connectFolder(folder);
                          }}
                        >
                          <HugeiconsIcon
                            icon={Folder01Icon}
                            strokeWidth={1.8}
                          />
                          <span
                            className="min-w-0 flex-1 truncate"
                            title={folder}
                          >
                            {project.name}
                          </span>
                          {selected ? (
                            <CheckIcon
                              aria-label={t("chat.workspace.selected")}
                            />
                          ) : null}
                        </CommandItem>
                      );
                    })}
                </CommandGroup>
                <CommandSeparator />
                <CommandGroup>
                  {error ? (
                    <CommandItem onSelect={retry}>
                      {t("chat.workspace.retryFolders")}
                    </CommandItem>
                  ) : null}
                  <CommandItem
                    disabled={busy}
                    onSelect={() => void selectFolder()}
                  >
                    <HugeiconsIcon icon={FolderAddIcon} strokeWidth={1.8} />
                    {t("chat.workspace.connect")}
                  </CommandItem>
                  {currentPath ? (
                    <CommandItem
                      disabled={busy}
                      onSelect={() => void disconnect()}
                    >
                      <XIcon />
                      {t("chat.workspace.withoutFolder")}
                    </CommandItem>
                  ) : null}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
        {currentPath && visibleGitStatus?.isRepository && (
          <Button
            size="sm"
            variant="ghost"
            disabled={busy || isRunning}
            aria-label={`${t("chat.repository.changes")} · ${visibleGitStatus.branch ?? "HEAD"}`}
            onClick={() => openRepository("changes")}
          >
            <GitBranchIcon />
            {visibleGitStatus.branch ?? "HEAD"}
          </Button>
        )}
        {currentAccess ? (
          <span className="composer-workspace-access" title={currentPath}>
            {busy
              ? t("chat.workspace.loading")
              : currentAccess === "read"
                ? t("chat.workspace.readOnly")
                : currentAccess === "write_no_delete"
                  ? t("chat.workspace.editNoDelete")
                  : t("chat.workspace.allowEdits")}
          </span>
        ) : null}
      </div>
      {mentionedUnconnectedPath && !isRunning ? (
        <div className="flex items-center gap-2 px-2 pb-1 text-xs text-muted-foreground" role="status">
          <span>{t("chat.workspace.pathNotConnected")}</span>
          <Button
            type="button"
            size="sm"
            variant="link"
            className="h-auto shrink-0 p-0 text-xs"
            disabled={busy}
            onClick={() => setOpen(true)}
          >
            {t("chat.workspace.connectPath")}
          </Button>
        </div>
      ) : null}
    </>
  );
}
