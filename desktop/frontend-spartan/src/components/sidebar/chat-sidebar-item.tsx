/**
 * Sparta Agent – Chat Sidebar Item Component
 *
 * Componente que renderiza un elemento individual de conversación (individual o en modo comparación)
 * en la barra lateral, incluyendo:
 * - Indicadores de actividad de generación (spinner) o no leídos.
 * - Soporte para arrastre y reordenamiento manual.
 * - Edición inline de título de chat.
 * - Menú contextual individual y menú kebab (renombrar, fijar/desfijar, abrir carpeta de sandbox, mover a proyecto, exportar, archivar, borrar).
 */

import type { ReactElement } from "react";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  SidebarMenuItem,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import {
  ContextMenu,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
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
import { Spinner } from "@/components/ui/spinner";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Archive03Icon,
  BookOpen01Icon,
  BubbleChatIcon,
  Delete02Icon,
  Download01Icon,
  Edit03Icon,
  Folder01Icon,
  FolderAddIcon,
  FolderExportIcon,
  FolderOpenIcon,
  MoreVerticalIcon,
  PinIcon,
  PinOffIcon,
} from "@hugeicons/core-free-icons";
import { toast } from "@/lib/toast";
import { isDownloadCancelled } from "@/lib/native-files";
import { sandboxSessionIdFor } from "@/components/assistant-ui/sandbox-files";
import {
  revealSandbox,
  sandboxHasFiles,
} from "@/components/assistant-ui/sandbox-reveal";
import { useSettingsDialogStore } from "@/features/settings";
import {
  compareModelDisplayName,
  isDefaultChatTitle,
  listStoredChatMessages,
  listStoredChatThreads,
  recordedSandboxSessionId,
  type ProjectRecord,
  type SidebarItem,
} from "@/features/chat";
import {
  CHAT_EXPORT_OPTIONS,
} from "./sidebar-types-and-constants";
import {
  exportConversationByFormat,
  getSidebarItemThreadIds,
  saveChatToProjectSources,
} from "./sidebar-chat-helpers";
import { OpenChatFolderUnavailableItem } from "./sidebar-nav-items";
import { ChatContextMenu } from "./sidebar-context-menus";
import type { DeleteTarget, RenameTarget } from "./sidebar-dialogs";

export interface ChatSidebarItemProps {
  item: SidebarItem;
  variant: "project" | "recent";
  drag?: { scope: string; orderedIds: string[]; index: number };
  list?: { scope: string; ids: string[] };
  // States
  activeThreadId?: string | null;
  selectedChatIds: ReadonlySet<string> | Set<string>;
  pinnedIdSet: Set<string>;
  runningByThreadId: Record<string, boolean>;
  queueByThreadId: Record<string, any>;
  unreadThreadIds: Set<string>;
  pendingRename: { id: string; title: string } | null;
  renamingTarget: RenameTarget | null;
  renameDraft: string;
  draggingRow: { id: string; scope: string } | null;
  projects: ProjectRecord[];
  isTauri: boolean;
  confirmDeleteChats: boolean;
  alwaysDeleteChatFiles: boolean;
  // Selection
  selectionCount: number;
  allSelectedPinned: boolean;
  // Event handlers
  dropCueClass: (scope: string | undefined, orderedIds: string[] | undefined, rowId: string) => string | undefined;
  rowDragProps: (scope: string, orderedIds: string[], rowId: string) => any;
  handleSelectionClick: (event: React.MouseEvent, item: SidebarItem, list: { scope: string; ids: string[] }) => boolean;
  selectForContextMenu: (item: SidebarItem, list: { scope: string; ids: string[] }) => void;
  clearSelection: () => void;
  clearChatNotifications: (item: SidebarItem) => void;
  navigate: (target: { to: string; search?: Record<string, any> }) => void;
  closeMobileIfOpen: () => void;
  togglePinnedChat: (id: string) => void;
  openRenameChat: (item: SidebarItem) => void;
  setRenameDraft: (val: string) => void;
  handleInlineRenameKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  handleInlineRenameBlur: () => void;
  renderMoveRowItems: (scope: string, orderedIds: string[], rowId: string, index: number) => ReactElement;
  setProjectCreateMoveTarget: (item: SidebarItem | null) => void;
  setCreatingProject: (val: boolean) => void;
  moveChatToProject: (item: SidebarItem, projectId: string | null) => Promise<void>;
  handleArchiveThread: (item: SidebarItem) => Promise<void>;
  openDeleteDialog: (target: DeleteTarget) => void;
  deleteChatWithCleanup: (item: SidebarItem, options: { deleteFiles: boolean }) => Promise<void>;
  pinSelected: (pinned: boolean) => void;
  archiveSelected: () => Promise<void>;
  markSelectedUnread: () => void;
  deleteSelected: () => void;
}

export function ChatSidebarItem({
  item,
  variant,
  drag,
  list,
  activeThreadId,
  selectedChatIds,
  pinnedIdSet,
  runningByThreadId,
  queueByThreadId,
  unreadThreadIds,
  pendingRename,
  renamingTarget,
  renameDraft,
  draggingRow,
  projects,
  isTauri,
  confirmDeleteChats,
  alwaysDeleteChatFiles,
  selectionCount,
  allSelectedPinned,
  dropCueClass,
  rowDragProps,
  handleSelectionClick,
  selectForContextMenu,
  clearSelection,
  clearChatNotifications,
  navigate,
  closeMobileIfOpen,
  togglePinnedChat,
  openRenameChat,
  setRenameDraft,
  handleInlineRenameKeyDown,
  handleInlineRenameBlur,
  renderMoveRowItems,
  setProjectCreateMoveTarget,
  setCreatingProject,
  moveChatToProject,
  handleArchiveThread,
  openDeleteDialog,
  deleteChatWithCleanup,
  pinSelected,
  archiveSelected,
  markSelectedUnread,
  deleteSelected,
}: ChatSidebarItemProps): ReactElement {
  const t = useT();
  const threadIds = getSidebarItemThreadIds(item);
  const isPinned = pinnedIdSet.has(item.id);

  const sandboxSessionId =
    item.type === "single" || item.projectId
      ? sandboxSessionIdFor(threadIds[0] ?? item.id, item.projectId)
      : undefined;

  const isGenerating =
    item.type === "compare"
      ? (item.threadIds ?? []).some((id) => Boolean(runningByThreadId[id]))
      : Boolean(runningByThreadId[item.id]);
  const hasQueuedActivity = threadIds.some((threadId) =>
    Boolean(queueByThreadId[threadId]),
  );
  const showQueuedActivity = hasQueuedActivity && !isGenerating;
  const showWorkSpinner = isGenerating || showQueuedActivity;
  const hasUnreadActivity =
    !isGenerating &&
    !hasQueuedActivity &&
    threadIds.some((threadId) => unreadThreadIds.has(threadId));
  const hasSecondaryRowAction =
    variant === "project" || (variant === "recent" && isPinned);
  const itemClass =
    variant === "project"
      ? "group/project-chat-item relative"
      : "group/recent-item relative";
  const actionClass =
    variant === "project"
      ? "sidebar-row-action sidebar-touch-reveal group-hover/project-chat-item:opacity-100 group-hover/project-chat-item:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto"
      : "sidebar-row-action sidebar-touch-reveal group-hover/recent-item:opacity-100 group-hover/recent-item:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto";

  const buttonClass = cn(
    "sidebar-nav-btn h-[30px] cursor-pointer rounded-full py-0 pr-4 text-ui-14p5 leading-ui-19 tracking-nav font-medium",
    variant === "project" ? "pl-[39px]" : "pl-3",
    isPinned && variant !== "project" && "gap-[8.5px]",
    showWorkSpinner
      ? hasSecondaryRowAction
        ? "pr-16"
        : undefined
      : hasUnreadActivity
        ? "pr-7"
        : undefined,
    variant === "project"
      ? showWorkSpinner
        ? undefined
        : "group-hover/project-chat-item:pr-14 group-has-[.sidebar-row-action[data-state=open]]/project-chat-item:pr-8 [@media(pointer:coarse)]:pr-14"
      : isPinned
        ? showWorkSpinner
          ? undefined
          : "group-hover/recent-item:pr-16 group-has-[.sidebar-row-action[data-state=open]]/recent-item:pr-8 [@media(pointer:coarse)]:pr-16"
        : showWorkSpinner
          ? "group-hover/recent-item:pr-8 group-has-[.sidebar-row-action[data-state=open]]/recent-item:pr-8 [@media(pointer:coarse)]:pr-10"
          : "group-hover/recent-item:pr-6 group-has-[.sidebar-row-action[data-state=open]]/recent-item:pr-6 [@media(pointer:coarse)]:pr-10",
    showWorkSpinner &&
      (variant === "project"
        ? "group-has-[.sidebar-row-action:focus-visible]/project-chat-item:pr-14"
        : isPinned
          ? "group-has-[.sidebar-row-action:focus-visible]/recent-item:pr-16"
          : "group-has-[.sidebar-row-action:focus-visible]/recent-item:pr-8"),
  );

  const isRenamingThis =
    renamingTarget?.kind === "chat" && renamingTarget.item.id === item.id;

  if (isRenamingThis) {
    return (
      <SidebarMenuItem key={item.id} className={itemClass}>
        <input
          autoFocus
          value={renameDraft}
          onChange={(event) => setRenameDraft(event.target.value)}
          onKeyDown={handleInlineRenameKeyDown}
          onBlur={handleInlineRenameBlur}
          onFocus={(event) => event.currentTarget.select()}
          maxLength={120}
          aria-label={t("shell.dialog.renameChat.placeholder")}
          className={cn(
            "text-foreground h-[30px] w-full border-0 bg-transparent py-0 pr-4 text-ui-14p5 leading-ui-19 font-medium tracking-nav outline-none",
            variant === "project" ? "pl-[39px]" : "pl-3",
          )}
        />
      </SidebarMenuItem>
    );
  }

  return (
    <ContextMenu key={item.id}>
      <ContextMenuTrigger asChild>
        <SidebarMenuItem
          className={cn(
            itemClass,
            draggingRow?.id === item.id && "opacity-50",
            dropCueClass(drag?.scope, drag?.orderedIds, item.id),
          )}
          onContextMenu={() => list && selectForContextMenu(item, list)}
          {...(drag
            ? rowDragProps(drag.scope, drag.orderedIds, item.id)
            : undefined)}
        >
          <SidebarMenuButton
            data-testid="recent-thread"
            data-thread-type={item.type}
            data-thread-id={item.id}
            data-generating={isGenerating ? "true" : undefined}
            aria-busy={isGenerating || undefined}
            isActive={activeThreadId === item.id}
            data-selected={selectedChatIds.has(item.id) ? "true" : undefined}
            className={buttonClass}
            onClick={(event) => {
              if (list && handleSelectionClick(event, item, list)) return;
              clearSelection();
              clearChatNotifications(item);
              navigate({
                to: "/chat",
                search:
                  item.type === "single"
                    ? {
                        thread: item.id,
                        ...(item.projectId
                          ? { project: item.projectId }
                          : {}),
                      }
                    : {
                        compare: item.id,
                        ...(item.projectId
                          ? { project: item.projectId }
                          : {}),
                      },
              });
              closeMobileIfOpen();
            }}
          >
            {isPinned && variant !== "project" && (
              <HugeiconsIcon
                icon={BubbleChatIcon}
                strokeWidth={1.75}
                className="size-icon! shrink-0"
              />
            )}
            <span className="truncate">
              {pendingRename?.id === item.id
                ? pendingRename.title
                : isDefaultChatTitle(item.title)
                  ? t("shell.navigation.newChat")
                  : item.title}
            </span>
            {item.modelId && !showWorkSpinner && !hasUnreadActivity && (
              <span
                className="ml-auto max-w-[45%] shrink-0 truncate text-ui-10 text-muted-foreground/70"
                title={item.modelId}
              >
                {compareModelDisplayName(item.modelId).toLowerCase() === "free"
                  ? t("shell.navigation.free")
                  : compareModelDisplayName(item.modelId)}
              </span>
            )}
            {showWorkSpinner && (
              <Spinner
                data-testid="chat-row-spinner"
                label={
                  isGenerating
                    ? t("shell.navigation.chatGenerating")
                    : "Queued"
                }
                className="ml-auto size-3.5 shrink-0 text-muted-foreground"
              />
            )}
          </SidebarMenuButton>
          {hasUnreadActivity ? (
            <span
              className={cn(
                "pointer-events-none absolute right-2 top-1/2 z-10 flex size-4 -translate-y-1/2 items-center justify-center text-muted-foreground transition-opacity",
                variant === "project"
                  ? "group-hover/project-chat-item:opacity-0 group-has-[.sidebar-row-action[data-state=open]]/project-chat-item:opacity-0"
                  : "group-hover/recent-item:opacity-0 group-has-[.sidebar-row-action[data-state=open]]/recent-item:opacity-0",
              )}
              aria-hidden
            >
              <span className="size-2 rounded-full bg-muted-foreground/60" />
            </span>
          ) : null}
          {variant === "project" && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePinnedChat(item.id);
              }}
              aria-label={t(isPinned ? "chat.menu.unpin" : "chat.menu.pin")}
              className="sidebar-row-action sidebar-touch-reveal is-unpin-action group-hover/project-chat-item:opacity-100 group-hover/project-chat-item:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto"
            >
              <span className="sidebar-row-action-glyph">
                <HugeiconsIcon
                  icon={isPinned ? PinOffIcon : PinIcon}
                  strokeWidth={1.75}
                  className="size-icon"
                />
              </span>
            </button>
          )}
          {variant === "recent" && isPinned && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePinnedChat(item.id);
              }}
              aria-label={t("chat.menu.unpin")}
              className="sidebar-row-action sidebar-touch-reveal is-unpin-action group-hover/recent-item:opacity-100 group-hover/recent-item:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto"
            >
              <span className="sidebar-row-action-glyph">
                <HugeiconsIcon
                  icon={PinOffIcon}
                  strokeWidth={1.75}
                  className="size-icon"
                />
              </span>
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                aria-label={t("chat.menu.options")}
                className={actionClass}
              >
                <span className="sidebar-row-action-glyph">
                  <HugeiconsIcon
                    icon={MoreVerticalIcon}
                    strokeWidth={1.75}
                    className="size-icon"
                  />
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              side="bottom"
              align="start"
              sideOffset={0}
              className="unsloth-plus-menu menu-flat-destructive w-56"
            >
              <DropdownMenuItem onSelect={() => openRenameChat(item)}>
                <HugeiconsIcon
                  icon={Edit03Icon}
                  strokeWidth={1.75}
                  className="size-icon"
                />
                <span>{t("chat.menu.rename")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => togglePinnedChat(item.id)}>
                <HugeiconsIcon
                  icon={isPinned ? PinOffIcon : PinIcon}
                  strokeWidth={1.75}
                  className="size-icon"
                />
                <span>
                  {t(isPinned ? "chat.menu.unpin" : "chat.menu.pin")}
                </span>
              </DropdownMenuItem>
              {drag &&
                renderMoveRowItems(
                  drag.scope,
                  drag.orderedIds,
                  item.id,
                  drag.index,
                )}
              {sandboxSessionId ? (
                isTauri ? (
                  <DropdownMenuItem
                    title={t("chat.menu.openFolderDescription")}
                    onSelect={() => {
                      void (async () => {
                        try {
                          const ids =
                            threadIds.length > 0 ? threadIds : [item.id];
                          const recorded: (string | undefined)[] = [];
                          for (const threadId of ids) {
                            recorded.push(
                              recordedSandboxSessionId(
                                await listStoredChatMessages(threadId),
                              ),
                            );
                          }
                          let distinct = [
                            ...new Set(recorded.filter(Boolean)),
                          ];
                          if (distinct.length === 0 && item.projectId) {
                            const held: string[] = [];
                            for (const threadId of ids) {
                              if (await sandboxHasFiles(threadId)) {
                                held.push(threadId);
                              }
                            }
                            distinct = [...new Set(held)];
                          }
                          if (distinct.length > 1) {
                            toast.error(t("chat.menu.multipleFolders"), {
                              description: t(
                                "chat.menu.multipleFoldersDescription",
                              ),
                            });
                            return;
                          }
                          await revealSandbox(
                            distinct[0] ?? sandboxSessionId,
                          );
                        } catch (error) {
                          toast.error(t("chat.menu.openFolderFailed"), {
                            description:
                              error instanceof Error
                                ? error.message
                                : String(error),
                          });
                        }
                      })();
                    }}
                  >
                    <HugeiconsIcon
                      icon={FolderOpenIcon}
                      strokeWidth={1.75}
                      className="size-icon"
                    />
                    <span>{t("chat.menu.openFolder")}</span>
                  </DropdownMenuItem>
                ) : (
                  <OpenChatFolderUnavailableItem />
                )
              ) : null}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <HugeiconsIcon
                    icon={FolderExportIcon}
                    strokeWidth={1.75}
                    className="size-icon"
                  />
                  <span>{t("chat.menu.moveToProject")}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  sideOffset={0}
                  alignOffset={-4}
                  className="unsloth-plus-menu w-52"
                >
                  <DropdownMenuItem
                    onSelect={() => {
                      setProjectCreateMoveTarget(item);
                      setCreatingProject(true);
                    }}
                  >
                    <HugeiconsIcon
                      icon={FolderAddIcon}
                      strokeWidth={1.75}
                      className="size-icon"
                    />
                    <span>{t("chat.menu.newProject")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!item.projectId}
                    onSelect={() => void moveChatToProject(item, null)}
                  >
                    <span>{t("chat.menu.recents")}</span>
                  </DropdownMenuItem>
                  {projects.map((project) => (
                    <DropdownMenuItem
                      key={project.id}
                      disabled={item.projectId === project.id}
                      onSelect={() =>
                        void moveChatToProject(item, project.id)
                      }
                    >
                      <HugeiconsIcon
                        icon={Folder01Icon}
                        strokeWidth={1.75}
                        className="size-icon"
                      />
                      <span className="truncate">{project.name}</span>
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
                  <span>{t("chat.menu.export")}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  sideOffset={8}
                  alignOffset={-4}
                  className="unsloth-plus-menu w-52"
                >
                  {CHAT_EXPORT_OPTIONS.map(({ label, format }) => (
                    <DropdownMenuItem
                      key={label}
                      onSelect={async () => {
                        try {
                          const ids =
                            item.type === "single"
                              ? [item.id]
                              : (
                                  await listStoredChatThreads({
                                    pairId: item.id,
                                  })
                                ).map((t) => t.id);
                          for (const id of ids) {
                            await exportConversationByFormat(id, format);
                          }
                        } catch (error) {
                          if (!isDownloadCancelled(error)) {
                            toast.error(t("chat.menu.exportFailed"));
                          }
                        }
                      }}
                    >
                      {label}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={() =>
                      useSettingsDialogStore.getState().openDialog("data")
                    }
                  >
                    {t("chat.menu.exportAll")}
                  </DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <HugeiconsIcon
                    icon={BookOpen01Icon}
                    strokeWidth={1.75}
                    className="size-icon"
                  />
                  <span>{t("chat.menu.saveToProjectSources")}</span>
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  sideOffset={8}
                  alignOffset={-4}
                  className="unsloth-plus-menu w-52"
                >
                  {projects.length === 0 && (
                    <DropdownMenuItem disabled>
                      {t("chat.menu.noProjectsYet")}
                    </DropdownMenuItem>
                  )}
                  {projects.map((project) => (
                    <DropdownMenuItem
                      key={project.id}
                      onSelect={async () => {
                        try {
                          await saveChatToProjectSources(item, project.id);
                        } catch {
                          toast.error(
                            t("chat.menu.saveToProjectSourcesFailed"),
                          );
                        }
                      }}
                    >
                      <HugeiconsIcon
                        icon={Folder01Icon}
                        strokeWidth={1.75}
                        className="size-icon"
                      />
                      <span className="truncate">{project.name}</span>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => void handleArchiveThread(item)}
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
                onSelect={() =>
                  confirmDeleteChats
                    ? openDeleteDialog({ kind: "chat", item })
                    : void deleteChatWithCleanup(item, {
                        deleteFiles: alwaysDeleteChatFiles,
                      })
                }
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
        </SidebarMenuItem>
      </ContextMenuTrigger>
      <ChatContextMenu
        selectionCount={selectionCount}
        allSelectedPinned={allSelectedPinned}
        onPinSelected={pinSelected}
        onArchiveSelected={archiveSelected}
        onMarkSelectedUnread={markSelectedUnread}
        onDeleteSelected={deleteSelected}
      />
    </ContextMenu>
  );
}
