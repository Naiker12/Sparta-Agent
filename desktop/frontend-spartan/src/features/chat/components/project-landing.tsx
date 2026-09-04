/**
 * Sparta Agent - ProjectLanding Component
 * Vista de aterrizaje para proyectos de chat (Landing con pestañas de chats y fuentes).
 */

import {
  type CSSProperties,
  type ReactElement,
  lazy,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "@tanstack/react-router";
import { useT } from "@/i18n";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Archive03Icon,
  BookOpen01Icon,
  BubbleChatTemporaryIcon,
  Delete02Icon,
  Download01Icon,
  Edit03Icon,
  Folder01Icon,
  Folder02Icon,
  FolderExportIcon,
  MoreHorizontalIcon,
  MoreVerticalIcon,
  PinIcon,
  PinOffIcon,
  PencilEdit02Icon,
  Telescope02Icon,
} from "@hugeicons/core-free-icons";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent } from "@/components/ui/tooltip";
import { ProjectComposer, Thread } from "@/components/assistant-ui/thread";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { isDownloadCancelled } from "@/lib/native-files";

import { notifyChatHistoryUpdated } from "../api/chat-api";
import { DeleteChatFilesSwitch } from "./delete-chat-files-switch";
import {
  ChatRuntimeProvider,
  useChatActive,
} from "../runtime-provider";
import {
  PENDING_CHAT_ATTACHMENT_KEY,
  readPendingAttachmentTargetClaim,
  useChatRuntimeStore,
} from "../stores/chat-runtime-store";
import { useChatPreferencesStore } from "../stores/chat-preferences-store";
import { usePinnedChatsStore } from "../stores/pinned-chats-store";
import { usePinnedProjectsStore } from "../stores/pinned-projects-store";
import {
  deleteChatProject,
  moveChatItemToProject,
  renameChatProject,
  useChatProjects,
} from "../hooks/use-chat-projects";
import {
  type SidebarItem,
  archiveChatItem,
  deleteChatItem,
  renameChatItem,
} from "../hooks/use-chat-sidebar-items";
import {
  listStoredChatMessages,
  listStoredChatThreads,
} from "../utils/chat-history-storage";
import { attachmentsSample } from "../utils/pasted-text";
import type { ChatView } from "../types";
import {
  consumeProjectSourcesPending,
  hasProjectSourcesPending,
} from "@/features/rag/components/project-source-dropzone";
import {
  createThreadNonce,
  exportProjectChatItem,
  exportProjectConversation,
  extractMessageText,
  formatProjectChatDate,
  PROJECT_CHAT_EXPORT_OPTIONS,
  type ProjectChatExportFormat,
  saveProjectChatItemAsSource,
} from "./project-chat-helpers";

const ProjectSourcesPanel = lazy(() =>
  import("@/features/rag/components/project-sources-panel").then((module) => ({
    default: module.ProjectSourcesPanel,
  })),
);

export function ProjectLanding({
  projectId,
  projectName,
  items,
}: {
  projectId: string;
  projectName: string;
  items: SidebarItem[];
}): ReactElement {
  const t = useT();
  const navigate = useNavigate();
  const { projects: projectRecords } = useChatProjects();
  const project = projectRecords.find((item) => item.id === projectId) ?? null;
  // Gates body-portaled surfaces so they can't linger or act while the landing
  // is off-route (e.g. behind another tab).
  const active = useChatActive();
  const activeThreadId = useChatRuntimeStore((s) => s.activeThreadId);
  const initialActiveThreadRef = useRef<string | null>(null);
  // Land on Sources when the project was just created with dropped files.
  const [projectTab, setProjectTab] = useState<"chats" | "sources">(() =>
    hasProjectSourcesPending(projectId) ? "sources" : "chats",
  );
  // Drop the marker once committed: React may replay the initializer above.
  useEffect(() => {
    consumeProjectSourcesPending(projectId);
  }, [projectId]);
  const [pendingNewThreadId, setPendingNewThreadId] = useState<string | null>(
    null,
  );
  const [newThreadNonce, setNewThreadNonce] = useState(() =>
    createThreadNonce(),
  );
  const [previews, setPreviews] = useState<
    Record<string, { snippet: string; date: string }>
  >({});
  // Inline rename, mirroring the sidebar recent-row UX: edit the title in place,
  // commit on Enter/blur, cancel on Escape. Reuses the projectId-agnostic
  // renameChatItem so behavior matches the sidebar.
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  // Skips the input's blur-commit when Enter/Escape already handled it.
  const skipRenameBlurRef = useRef(false);
  // Optimistic title shown until the debounced sidebar refresh (fired by the
  // rename) catches up, so the old name does not flash back in.
  const [pendingRename, setPendingRename] = useState<{
    id: string;
    title: string;
  } | null>(null);

  // Project-level options (the header kebab menu).
  const pinnedProjectIds = usePinnedProjectsStore((s) => s.pinnedIds);
  const togglePinProject = usePinnedProjectsStore((s) => s.togglePin);
  const projectPinned = pinnedProjectIds.includes(projectId);
  const [renamingProject, setRenamingProject] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [deletingProject, setDeletingProject] = useState(false);

  async function handleProjectExport(
    format: ProjectChatExportFormat,
  ): Promise<void> {
    try {
      const threads = await listStoredChatThreads({
        projectId,
        includeArchived: false,
      });
      const ids = [...new Set(threads.map((t) => t.id))];
      for (const id of ids) await exportProjectConversation(id, format);
    } catch (error) {
      if (!isDownloadCancelled(error)) toast.error("Export failed.");
    }
  }

  async function commitProjectRename(): Promise<void> {
    const name = projectNameDraft.trim();
    setRenamingProject(false);
    if (!name || name === projectName) return;
    try {
      await renameChatProject(projectId, name);
    } catch (err) {
      toast.error("Failed to rename project", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function commitProjectDelete(): Promise<void> {
    setDeletingProject(false);
    try {
      await deleteChatProject(projectId);
      // Refresh chat history so the project's now-deleted chats don't linger
      // in the sidebar, matching the sidebar delete path.
      notifyChatHistoryUpdated();
      useChatRuntimeStore.getState().setActiveProjectId(null);
      navigate({ to: "/chat", search: { new: createThreadNonce() } });
    } catch (err) {
      toast.error("Failed to delete project", {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  useEffect(() => {
    initialActiveThreadRef.current =
      useChatRuntimeStore.getState().activeThreadId;
    useChatRuntimeStore.getState().setActiveThreadId(null);
    useChatRuntimeStore.getState().setContextUsage(null);
    setPendingNewThreadId(null);
    setNewThreadNonce(createThreadNonce());
    setRenamingId(null);
    setPendingRename(null);
  }, [projectId]);

  useEffect(() => {
    if (!pendingRename) return;
    const match = items.find((item) => item.id === pendingRename.id);
    if (match && match.title === pendingRename.title) setPendingRename(null);
  }, [items, pendingRename]);

  const openRename = useCallback((item: SidebarItem) => {
    skipRenameBlurRef.current = false;
    setRenameDraft(item.title);
    setRenamingId(item.id);
  }, []);

  const commitRename = useCallback(
    async (item: SidebarItem) => {
      const trimmed = renameDraft.trim();
      setRenamingId(null);
      if (!trimmed || trimmed === item.title) return;
      setPendingRename({ id: item.id, title: trimmed });
      try {
        await renameChatItem(item, trimmed);
      } catch (err) {
        setPendingRename(null);
        toast.error("Failed to rename chat", {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    },
    [renameDraft],
  );

  // Full chat actions, matching the sidebar chat menu.
  const { projects } = useChatProjects();
  const pinnedChatIds = usePinnedChatsStore((s) => s.pinnedIds);
  const togglePinnedChat = usePinnedChatsStore((s) => s.togglePin);
  const confirmDeleteChats = useChatPreferencesStore(
    (s) => s.confirmDeleteChats,
  );
  const alwaysDeleteChatFiles = useChatPreferencesStore(
    (s) => s.alwaysDeleteChatFiles,
  );
  const pinnedChatIdSet = useMemo(
    () => new Set(pinnedChatIds),
    [pinnedChatIds],
  );
  const [confirmingDelete, setConfirmingDelete] = useState<SidebarItem | null>(
    null,
  );
  // Preselected from the preference, so the dialog shows what is about to
  // happen and can still be turned off for this one chat.
  const [deleteFilesOnDelete, setDeleteFilesOnDelete] = useState(false);

  // Landing has no active thread selected, so the onView callback here is a
  // no-op; the items list refreshes itself once storage emits its update.
  const noopView = useCallback(() => { }, []);

  const handleArchive = useCallback(
    async (item: SidebarItem) => {
      try {
        await archiveChatItem(item, activeThreadId ?? undefined, noopView);
      } catch (err) {
        toast.error("Failed to archive chat", {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    },
    [activeThreadId, noopView],
  );

  const runDelete = useCallback(
    async (item: SidebarItem, deleteFiles: boolean) => {
      try {
        await deleteChatItem(item, activeThreadId ?? undefined, noopView, {
          deleteFiles,
        });
      } catch (err) {
        toast.error("Failed to delete chat", {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    },
    [activeThreadId, noopView],
  );

  const handleDelete = useCallback(
    (item: SidebarItem) => {
      if (confirmDeleteChats) {
        setDeleteFilesOnDelete(alwaysDeleteChatFiles);
        setConfirmingDelete(item);
        return;
      }
      // No confirmation to preselect, so the preference is the answer.
      void runDelete(item, alwaysDeleteChatFiles);
    },
    [confirmDeleteChats, runDelete, alwaysDeleteChatFiles],
  );

  const handleMoveToProject = useCallback(
    async (item: SidebarItem, targetId: string | null) => {
      try {
        await moveChatItemToProject(item, targetId);
      } catch (err) {
        toast.error("Failed to move chat", {
          description: err instanceof Error ? err.message : undefined,
        });
      }
    },
    [],
  );

  const handleExport = useCallback(
    async (item: SidebarItem, format: ProjectChatExportFormat) => {
      try {
        await exportProjectChatItem(item, format);
      } catch (error) {
        if (!isDownloadCancelled(error)) toast.error("Export failed.");
      }
    },
    [],
  );

  const handleSaveAsSource = useCallback(
    async (item: SidebarItem) => {
      try {
        await saveProjectChatItemAsSource(item, projectId);
      } catch {
        toast.error("Failed to save to project sources.");
      }
    },
    [projectId],
  );

  // No composer ever records under this, so passing it refuses the adoption.
  // (adoptPendingProjectAttachmentTarget only adopts on an exact claim match.)
  const NO_SUCH_CLAIM = -1;

  // The claim the composer on screen recorded its attach choice under: every
  // fresh composer shares one pending key, so only the claim tells them apart.
  const pendingTargetClaimRef = useRef<{
    nonce: string;
    claim: number;
  } | null>(null);
  useEffect(() => {
    return useChatRuntimeStore.subscribe((state) => {
      const pending =
        state.projectAttachmentTargetByThread[PENDING_CHAT_ATTACHMENT_KEY];
      if (pending === undefined) return;
      // By claim, not by value: picking the same destination twice rewrites the
      // same string under a new claim, and skipping it reads as somebody else's.
      const claim = readPendingAttachmentTargetClaim();
      const captured = pendingTargetClaimRef.current;
      if (captured?.nonce === newThreadNonce && captured.claim === claim) {
        return;
      }
      pendingTargetClaimRef.current = { nonce: newThreadNonce, claim };
    });
  }, [newThreadNonce]);

  useEffect(() => {
    if (!activeThreadId) {
      // Leaving a created chat for a new one: rotate the nonce so the runtime
      // switches to a fresh thread instead of appending to the old chat.
      if (pendingNewThreadId) {
        setNewThreadNonce(createThreadNonce());
        setPendingNewThreadId(null);
      }
      return;
    }
    if (activeThreadId === initialActiveThreadRef.current) {
      return;
    }
    // Hand the composer's attach choice to the chat it just created: setting
    // this swaps ProjectComposer for Thread, so the bar holding the choice
    // unmounts without seeing the id and its cleanup drops it. Its own choice
    // only, or a send materializing after another composer opened would consume
    // that one's pick; an unrecognised claim is refused.
    const captured = pendingTargetClaimRef.current;
    useChatRuntimeStore
      .getState()
      .adoptPendingProjectAttachmentTarget(
        activeThreadId,
        captured?.nonce === newThreadNonce ? captured.claim : NO_SUCH_CLAIM,
      );
    setPendingNewThreadId(activeThreadId);
  }, [activeThreadId, pendingNewThreadId, newThreadNonce]);

  useEffect(() => {
    let cancelled = false;

    async function loadPreviews(): Promise<void> {
      const entries = await Promise.all(
        items.map(async (item) => {
          if (item.type !== "single") {
            return [
              item.id,
              {
                snippet: "Compare chat",
                date: formatProjectChatDate(item.createdAt),
              },
            ] as const;
          }
          const messages = await listStoredChatMessages(item.id).catch(
            () => [],
          );
          const firstUserMessage =
            messages.find((message) => message.role === "user") ?? messages[0];
          return [
            item.id,
            {
              // A paste-only message carries its text in the attachment, so
              // the row would otherwise be blank.
              snippet: firstUserMessage
                ? extractMessageText(firstUserMessage.content) ||
                attachmentsSample(firstUserMessage.attachments)
                : "",
              date: formatProjectChatDate(item.createdAt),
            },
          ] as const;
        }),
      );
      if (!cancelled) {
        setPreviews(Object.fromEntries(entries));
      }
    }

    void loadPreviews();
    return () => {
      cancelled = true;
    };
  }, [items]);

  return (
    <ChatRuntimeProvider
      key={projectId}
      projectId={projectId}
      newThreadNonce={newThreadNonce}
      listThreads={false}
    >
      {pendingNewThreadId ? (
        <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden">
          <Thread hideWelcome={true} targetThreadId={pendingNewThreadId} />
        </div>
      ) : (
        <div
          className="flex min-h-0 min-w-0 flex-1 basis-0 overflow-y-auto px-5"
          style={
            {
              ["--thread-max-width" as string]: "48rem",
            } as CSSProperties
          }
        >
          {/* Slightly narrower than the composer max; every block shares this. */}
          <div className="mx-auto flex w-full max-w-[44rem] flex-col pt-[120px] pb-14">
            <div className="mb-12 flex items-center gap-4">
              <span className="flex size-13 shrink-0 items-center justify-center rounded-[18px] bg-muted text-foreground/80">
                <HugeiconsIcon
                  icon={Folder02Icon}
                  strokeWidth={1.75}
                  className="size-6.5"
                />
              </span>
              <h1 className="min-w-0 flex-1 truncate font-sans text-ui-30 font-medium leading-tight tracking-normal text-foreground">
                {projectName}
              </h1>
              <DropdownMenu>
                <DropdownMenuTrigger asChild={true}>
                  <button
                    type="button"
                    aria-label={t("projectsPage.projectOptionsAria")}
                    className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring data-[state=open]:bg-muted data-[state=open]:text-foreground"
                  >
                    <HugeiconsIcon icon={MoreHorizontalIcon} strokeWidth={1.75} className="size-5" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="bottom"
                  align="end"
                  sideOffset={6}
                  className="unsloth-plus-menu menu-flat-destructive w-52"
                >
                  <DropdownMenuItem
                    onSelect={() => {
                      setProjectNameDraft(projectName);
                      setRenamingProject(true);
                    }}
                  >
                    <HugeiconsIcon icon={Edit03Icon} strokeWidth={1.75} className="size-icon" />
                    <span>{t("projectsPage.renameTitle")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => togglePinProject(projectId)}>
                    <HugeiconsIcon icon={projectPinned ? PinOffIcon : PinIcon} strokeWidth={1.75} className="size-icon" />
                    <span>{t(projectPinned ? "projectsPage.unpinProject" : "projectsPage.pinProject")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <HugeiconsIcon icon={Download01Icon} strokeWidth={1.75} className="size-icon" />
                      <span>{t("projectsPage.export")}</span>
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent className="unsloth-plus-menu w-48">
                      {PROJECT_CHAT_EXPORT_OPTIONS.map(({ label, format }) => (
                        <DropdownMenuItem
                          key={format}
                          onSelect={() => void handleProjectExport(format)}
                        >
                          {label}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => setDeletingProject(true)}
                  >
                    <HugeiconsIcon icon={Delete02Icon} strokeWidth={1.75} className="size-icon" />
                    <span>{t("projectsPage.deleteTitle")}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <ProjectComposer
              disabled={Boolean(pendingNewThreadId)}
              placeholder={`New chat in ${projectName}`}
            />

            <div className="mt-9 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setProjectTab("chats")}
                data-active={projectTab === "chats"}
                className="h-10 rounded-full px-5 text-ui-14 font-semibold transition-colors data-[active=true]:bg-muted data-[active=true]:text-foreground data-[active=false]:text-muted-foreground data-[active=false]:hover:bg-nav-surface-hover"
              >
                {t("projectsPage.chatsTitle")}
              </button>
              <button
                type="button"
                onClick={() => setProjectTab("sources")}
                data-active={projectTab === "sources"}
                className="h-10 rounded-full px-5 text-ui-14 font-semibold transition-colors data-[active=true]:bg-muted data-[active=true]:text-foreground data-[active=false]:text-muted-foreground data-[active=false]:hover:bg-nav-surface-hover"
              >
                {t("projectsPage.sourcesTitle")}
              </button>
            </div>

            {projectTab === "sources" ? (
              <Suspense
                fallback={
                  <div className="mt-8 rounded-[26px] bg-muted/30 px-6 py-10 text-center text-sm text-muted-foreground">
                    Loading sources…
                  </div>
                }
              >
                <ProjectSourcesPanel projectId={projectId} />
              </Suspense>
            ) : (
              <div className="mt-8 flex flex-col gap-1">
                {items.map((item) => {
                  const preview = previews[item.id];
                  const displayTitle =
                    pendingRename?.id === item.id
                      ? pendingRename.title
                      : item.title;
                  if (renamingId === item.id) {
                    return (
                      <div
                        key={`${item.type}:${item.id}`}
                        className="flex min-h-[58px] w-full items-center rounded-full px-4 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <input
                            autoFocus
                            value={renameDraft}
                            onChange={(event) =>
                              setRenameDraft(event.target.value)
                            }
                            onKeyDown={(event) => {
                              // Ignore keydowns fired mid-IME-composition (CJK)
                              // so a candidate-confirming Enter or candidate-
                              // cancelling Escape does not commit/cancel the
                              // rename. Guard before the key branch so Escape is
                              // covered too (isComposing on WebKit, 229 on Chromium).
                              if (
                                event.nativeEvent.isComposing ||
                                event.keyCode === 229
                              )
                                return;
                              if (event.key === "Enter") {
                                event.preventDefault();
                                skipRenameBlurRef.current = true;
                                void commitRename(item);
                              } else if (event.key === "Escape") {
                                event.preventDefault();
                                skipRenameBlurRef.current = true;
                                setRenamingId(null);
                              }
                            }}
                            onBlur={() => {
                              if (skipRenameBlurRef.current) {
                                skipRenameBlurRef.current = false;
                                return;
                              }
                              void commitRename(item);
                            }}
                            onFocus={(event) => event.currentTarget.select()}
                            maxLength={120}
                            aria-label="Rename chat"
                            className="w-full border-0 bg-transparent text-ui-15 font-semibold leading-5 text-foreground outline-none"
                          />
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={`${item.type}:${item.id}`}
                      className="group relative flex min-h-[58px] w-full items-center rounded-full transition-colors hover:bg-nav-surface-hover has-[[data-state=open]]:bg-nav-surface-hover"
                    >
                      <button
                        type="button"
                        onClick={() => {
                          navigate({
                            to: "/chat",
                            search:
                              item.type === "single"
                                ? { thread: item.id, project: projectId }
                                : { compare: item.id, project: projectId },
                          });
                        }}
                        className="flex min-h-[58px] min-w-0 flex-1 items-center gap-4 rounded-full px-4 py-2 text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-ui-15 font-semibold leading-5 text-foreground">
                            {displayTitle}
                          </div>
                        </div>
                        <span className="shrink-0 text-ui-14 text-muted-foreground transition-opacity max-md:opacity-0 pointer-coarse:opacity-0 group-hover:opacity-0 group-has-[[data-state=open]]:opacity-0">
                          {preview?.date ??
                            formatProjectChatDate(item.createdAt)}
                        </span>
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            onClick={(event) => event.stopPropagation()}
                            aria-label="Chat options"
                            className="absolute right-3 top-1/2 inline-flex size-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-muted-foreground outline-none transition-opacity hover:bg-foreground/10 md:pointer-fine:opacity-0 md:pointer-fine:pointer-events-none focus-visible:opacity-100 focus-visible:pointer-events-auto group-hover:opacity-100 group-hover:pointer-events-auto data-[state=open]:opacity-100 data-[state=open]:pointer-events-auto"
                          >
                            <HugeiconsIcon
                              icon={MoreVerticalIcon}
                              strokeWidth={1.75}
                              className="size-icon"
                            />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                          side="bottom"
                          align="end"
                          sideOffset={4}
                          className="unsloth-plus-menu menu-flat-destructive w-56"
                        >
                          <DropdownMenuItem onSelect={() => openRename(item)}>
                            <HugeiconsIcon
                              icon={Edit03Icon}
                              strokeWidth={1.75}
                              className="size-icon"
                            />
                            <span>Rename</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => togglePinnedChat(item.id)}
                          >
                            <HugeiconsIcon
                              icon={
                                pinnedChatIdSet.has(item.id)
                                  ? PinOffIcon
                                  : PinIcon
                              }
                              strokeWidth={1.75}
                              className="size-icon"
                            />
                            <span>
                              {pinnedChatIdSet.has(item.id)
                                ? "Unpin chat"
                                : "Pin chat"}
                            </span>
                          </DropdownMenuItem>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <HugeiconsIcon
                                icon={FolderExportIcon}
                                strokeWidth={1.75}
                                className="size-icon"
                              />
                              <span>Move to project</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="unsloth-plus-menu w-52">
                              <DropdownMenuItem
                                disabled={item.projectId !== projectId}
                                onSelect={() =>
                                  void handleMoveToProject(item, null)
                                }
                              >
                                <span>Recents</span>
                              </DropdownMenuItem>
                              {projects.map((p) => (
                                <DropdownMenuItem
                                  key={p.id}
                                  disabled={item.projectId === p.id}
                                  onSelect={() =>
                                    void handleMoveToProject(item, p.id)
                                  }
                                >
                                  <HugeiconsIcon
                                    icon={Folder01Icon}
                                    strokeWidth={1.75}
                                    className="size-icon"
                                  />
                                  <span className="truncate">{p.name}</span>
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger>
                              <HugeiconsIcon
                                icon={Download01Icon}
                                strokeWidth={1.75}
                                className="size-icon"
                              />
                              <span>Export</span>
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent className="unsloth-plus-menu w-52">
                              {PROJECT_CHAT_EXPORT_OPTIONS.map(
                                ({ label, format }) => (
                                  <DropdownMenuItem
                                    key={format}
                                    onSelect={() =>
                                      void handleExport(item, format)
                                    }
                                  >
                                    {label}
                                  </DropdownMenuItem>
                                ),
                              )}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                          <DropdownMenuItem
                            onSelect={() => void handleSaveAsSource(item)}
                          >
                            <HugeiconsIcon
                              icon={BookOpen01Icon}
                              strokeWidth={1.75}
                              className="size-icon"
                            />
                            <span>{t("chat.menu.saveToProjectSources")}</span>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onSelect={() => void handleArchive(item)}
                          >
                            <HugeiconsIcon
                              icon={Archive03Icon}
                              strokeWidth={1.75}
                              className="size-icon"
                            />
                            <span>{t("chat.menu.archive")}</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            variant="destructive"
                            onSelect={() => handleDelete(item)}
                          >
                            <HugeiconsIcon
                              icon={Delete02Icon}
                              strokeWidth={1.75}
                              className="size-icon"
                            />
                            <span>{t("chat.menu.delete")}</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      <AlertDialog
        open={active && confirmingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete chat</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes "{confirmingDelete?.title}". This cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <DeleteChatFilesSwitch
            id="chat-landing-delete-files"
            checked={deleteFilesOnDelete}
            onCheckedChange={setDeleteFilesOnDelete}
          />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                const target = confirmingDelete;
                const deleteFiles = deleteFilesOnDelete;
                setConfirmingDelete(null);
                if (target) void runDelete(target, deleteFiles);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Dialog
        open={active && renamingProject}
        onOpenChange={(open) => {
          if (!open) setRenamingProject(false);
        }}
      >
        <DialogContent className="corner-squircle dialog-soft-surface sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("projectsPage.renameTitle")}</DialogTitle>
          </DialogHeader>
          <Input
            value={projectNameDraft}
            onChange={(e) => setProjectNameDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void commitProjectRename();
              }
            }}
            autoFocus={true}
            maxLength={120}
            placeholder={t("projectsPage.projectNamePlaceholder")}
            aria-label={t("projectsPage.projectNamePlaceholder")}
            className="focus-visible:border-input focus-visible:ring-0"
          />
          <DialogFooter className="flex-wrap gap-2 sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setRenamingProject(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void commitProjectRename()}
              disabled={
                !projectNameDraft.trim() || projectNameDraft.trim() === projectName
              }
            >
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog
        open={active && deletingProject}
        onOpenChange={(open) => {
          if (!open) setDeletingProject(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("projectsPage.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("projectsPage.deleteDescription", { name: projectName })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void commitProjectDelete()}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ChatRuntimeProvider>
  );
}

