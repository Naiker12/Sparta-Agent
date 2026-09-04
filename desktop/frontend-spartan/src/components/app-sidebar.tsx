import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { useAnimatedThemeToggle } from "@/components/ui/animated-theme-toggler";
import {
  DesktopTitlebarNavigation,
  shouldUseCustomWindowTitlebar,
  shouldUseNativeMacWindowTitlebar,
} from "@/components/tauri/window-titlebar";
// Deep imports on purpose: the Images index re-exports ImagesPage, which would undo its code split.
/* eslint-disable no-restricted-imports */
import {
  isWorkflowEnabled,
  useImageWorkflowStore,
} from "@/features/images/stores/image-workflow-store";
import { WORKFLOW_TABS, type WorkflowId } from "@/features/images/workflows";
/* eslint-enable no-restricted-imports */
import { cn } from "@/lib/utils";
import { isTauri } from "@/lib/api-base";
import { publicAssetUrl } from "@/components/mascot-img";
import { useWebUpdateCheck } from "@/hooks/use-web-update-check";
import {
  Archive03Icon,
  ArrowDown01Icon,
  ArrowRight02Icon,
  ArrowUp01Icon,
  BadgeInfoIcon,
  BookOpen01Icon,
  BubbleChatIcon,
  CloudIcon,
  CpuIcon,
  CursorInfo02Icon,
  ChefHatIcon,
  DashboardCircleIcon,
  AudioWave01Icon,
  Delete02Icon,
  Download01Icon,
  DownloadSquare01Icon,
  Edit03Icon,
  FolderAddIcon,
  FolderExportIcon,
  FolderOpenIcon,
  Folder01Icon,
  Globe02Icon,
  HelpCircleIcon,
  Image03Icon,
  Logout05Icon,
  Message01Icon,
  MoreHorizontalIcon,
  MoreVerticalIcon,
  PaintBrush02Icon,
  Search01Icon,
  PinIcon,
  PinOffIcon,
  PlusSignIcon,
  PowerIcon,
  PencilEdit02Icon,
  LayoutAlignLeftIcon,
  Settings02Icon,
  Sun03Icon,
  UserIcon,
  ZapIcon,
} from "@hugeicons/core-free-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import { HugeiconsIcon } from "@hugeicons/react";
import { ChevronDown, Moon } from "lucide-react";
import {
  Link,
  useNavigate,
  useRouter,
  useRouterState,
} from "@tanstack/react-router";
import {
  archiveChatItem,
  ChatSearchDialog,
  clearNewChatDraft,
  deleteChatProject,
  deleteChatItem,
  isDefaultChatTitle,
  listStoredChatMessages,
  listStoredChatThreads,
  moveChatItemToProject,
  recordedSandboxSessionId,
  notifyChatHistoryUpdated,
  renameChatItem,
  renameChatProject,
  useChatRuntimeStore,
  useChatProjects,
  useChatSearchStore,
  useChatSidebarItems,
  usePinnedChatsStore,
  usePinnedProjectsStore,
  rangeBetween,
  toggleSelected,
  useChatPreferencesStore,
  usePromptQueueUI,
  useSidebarOrganizationStore,
  applyManualOrder,
  dropEdgeFor,
  showsInRecents,
  moveIdBy,
  projectOrderScope,
  reorderIds,
  PINNED_ORDER_SCOPE,
  PROJECT_ORDER_SCOPE,
  RECENTS_ORDER_SCOPE,
  type SidebarChatSort,
  type SidebarOrganizeBy,
  CONVERSATION_MARKDOWN_FORMAT,
  CONVERSATION_MARKDOWN_LABEL,
  type ProjectRecord,
  type SidebarItem,
  compareModelDisplayName,
} from "@/features/chat";
import { sandboxSessionIdFor } from "@/components/assistant-ui/sandbox-files";
import {
  revealSandbox,
  sandboxHasFiles,
} from "@/components/assistant-ui/sandbox-reveal";
import { NewProjectDialog } from "@/features/chat/components/new-project-dialog";
import {
  useAppearanceCustomStore,
  useSettingsDialogStore,
  useShortcutLabel,
} from "@/features/settings";
import type { SidebarNavItemId } from "@/features/settings";
import { useEffectiveProfile, UserAvatar } from "@/features/profile";
import { resolveNavRowState } from "@/components/nav-row-state";
import { fetchDeviceType, usePlatformStore } from "@/config/env";
import { clearAuthTokens, logout } from "@/features/auth";
import { TOUR_OPEN_EVENT } from "@/features/tour";
import { useExportRuntimeStore } from "@/features/export";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { isDownloadCancelled } from "@/lib/native-files";
import { toast } from "@/lib/toast";
import { ShutdownDialog } from "@/components/shutdown-dialog";
import { translate, useT, type TranslationKey } from "@/i18n";

import {
  EMPHASIS_MARKER,
  type AppT,
  renderEmphasizedTranslation,
  getTourId,
  SETTINGS_TAB_MENU_ITEMS,
  type NavRowDef,
  type ConversationExportFormat,
  PROJECT_CHAT_LIMIT,
  SIDEBAR_PROJECT_LIMIT,
  menuRadioItemClass,
  SELECT_WITH_META,
  DROP_CUE_BASE,
  DROP_CUE_TOP,
  DROP_CUE_BOTTOM,
  CHAT_SORT_OPTIONS,
  ORGANIZE_OPTIONS,
  CHAT_EXPORT_OPTIONS,
  formatRelativeShort,
  createNavigationNonce,
  preloadSilently,
  VERDICT_UNKNOWN_POLL_MS,
  SELF_HEAL_POLL_MS,
  VERDICT_POLL_STALL_MS,
} from "./sidebar/sidebar-types-and-constants";
import {
  NavBadge,
  NavItem,
  MoreMenuItem,
  OpenChatFolderUnavailableItem,
  WorkflowChoice,
  ImagesNavDisclosure,
  ImagesWorkflowList,
} from "./sidebar/sidebar-nav-items";
import {
  exportConversationByFormat,
  saveChatToProjectSources,
  getSidebarItemThreadIds,
} from "./sidebar/sidebar-chat-helpers";
import {
  SidebarDialogs,
  type DeleteTarget,
  type RenameTarget,
} from "./sidebar/sidebar-dialogs";
import { useSidebarSelection } from "./sidebar/use-sidebar-selection";
import { useSidebarDragAndDrop } from "./sidebar/use-sidebar-drag-and-drop";
import {
  SidebarHeaderMenu,
  ProjectContextMenu,
  ChatContextMenu,
} from "./sidebar/sidebar-context-menus";
import { SidebarBrandHeader } from "./sidebar/sidebar-brand-header";
import { ChatSidebarItem } from "./sidebar/chat-sidebar-item";
import { SidebarUserFooter } from "./sidebar/sidebar-user-footer";

export function AppSidebar() {
  const t = useT();
  const { isDark, toggleTheme, anchorRef } = useAnimatedThemeToggle();
  const sidebarMenu = useAppearanceCustomStore(
    (s) => s.customization.sidebarMenu,
  );
  const sidebarNav = useAppearanceCustomStore(
    (s) => s.customization.sidebarNav,
  );
  const [usesCustomTitlebar] = useState(shouldUseCustomWindowTitlebar);
  const [usesNativeMacTitlebar] = useState(shouldUseNativeMacWindowTitlebar);
  // Read from the shortcuts store, not the shipped default: a rebound or
  // cleared action must not leave the hint advertising a dead chord. Both
  // already render in the platform's own notation.
  const searchShortcutLabel = useShortcutLabel("searchChats");
  const settingsShortcutLabel = useShortcutLabel("openSettings");
  const { pathname, search } = useRouterState({
    select: (s) => ({
      pathname: s.location.pathname,
      search: s.location.search as Record<string, string | undefined>,
    }),
  });
  const {
    pinned,
    togglePinned,
    isMobile,
    setOpenMobile,
    state: sidebarState,
  } = useSidebar();
  const navigate = useNavigate();
  const router = useRouter();

  // `webUpdate` is non-null only when the installed (PyPI) version is behind the latest release.
  const { status: webUpdate } = useWebUpdateCheck();
  const showUpdateCard = Boolean(webUpdate);
  const updateVersion = webUpdate?.latestVersion ?? null;

  const closeMobileIfOpen = () => {
    if (isMobile) setOpenMobile(false);
  };

  const chatOnly = usePlatformStore((s) => s.isChatOnly());
  const chatOnlyReason = usePlatformStore((s) => s.chatOnlyReason);
  const chatOnlyDetail = usePlatformStore((s) => s.chatOnlyDetail);
  const detectionDeferred = usePlatformStore((s) => s.detectionDeferred);
  // Until /api/health answers, `chatOnly` is the browser-platform guess, so every Mac painted
  // Train and Video blacked out on load and only recovered once the backend reported. Gate the
  // rows on a measured verdict and let them spin until it lands.
  const capabilitiesUnknown = usePlatformStore((s) => s.capabilitiesUnknown());
  // Two things can change the verdict after the first /api/health. The backend MLX self-heal
  // (utils/mlx_repair) can reinstall MLX and flip chat_only false without a restart, and
  // detection can land after fetchDeviceType gave up waiting for it. The platform store cached
  // that first reply, so re-poll for both; the guard below stops it once neither applies.
  useEffect(() => {
    // Also while deferred: under the kill switch health settles nothing, so a GPU host would stay chat-only.
    const selfHealSettled =
      !chatOnly || (chatOnlyReason !== "mlx_unavailable" && !detectionDeferred);
    // And on any platform while the verdict itself is out. fetchDeviceType spends its bounded
    // wait at most once per page load, so a host that detects slower than that keeps the
    // provisional reply, and nothing else is scheduled to re-read it: the rows above would spin
    // and /studio would hold its loading panel for the rest of the session. This is the only
    // recovery poll in the app, and the sidebar is mounted on every route that gates on the
    // verdict (studio-page reads the same store, so it recovers with it; video-page reads the
    // backend's video verdict instead and needs nothing from here).
    if (selfHealSettled && !capabilitiesUnknown) return;
    let pollingSince = 0;
    // Which read currently owns the guard. A read that outlived the stall window is replaced,
    // and the replacement takes the guard with it; without an owner the abandoned read's
    // `finally` would clear a guard it no longer holds and let the next tick stack another
    // forced read onto the slow backend, every interval, which is the pile-up this prevents.
    let pollOwner = 0;
    const id = window.setInterval(
      () => {
        // A backend still importing torch answers slowly, so skip while a re-read is outstanding
        // rather than stacking them against it. Bounded, or a request that never settles would
        // hold the poll off for good.
        if (pollingSince && Date.now() - pollingSince < VERDICT_POLL_STALL_MS)
          return;
        const owned = ++pollOwner;
        pollingSince = Date.now();
        void fetchDeviceType({ force: true })
          .catch(() => undefined)
          .finally(() => {
            if (owned === pollOwner) pollingSince = 0;
          });
      },
      capabilitiesUnknown ? VERDICT_UNKNOWN_POLL_MS : SELF_HEAL_POLL_MS,
    );
    return () => window.clearInterval(id);
  }, [capabilitiesUnknown, chatOnly, chatOnlyReason, detectionDeferred]);

  const [shutdownOpen, setShutdownOpen] = useState(false);

  const isChatRoute = pathname.startsWith("/chat");
  const isStudioRoute =
    pathname === "/studio" || pathname.startsWith("/studio/");
  const [chatOpen, setChatOpen] = useState(true);

  // Hover previews the flyout; a primary click pins that preview open. The trigger owns pointer
  // clicks so Radix cannot interpret the already-hover-open menu as a request to close it.
  const [moreHoverOpen, setMoreHoverOpen] = useState(false);
  const [morePinnedOpen, setMorePinnedOpen] = useState(false);
  const moreOpen = moreHoverOpen || morePinnedOpen;
  const moreCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearMoreCloseTimer = useCallback(() => {
    if (!moreCloseTimer.current) return;
    clearTimeout(moreCloseTimer.current);
    moreCloseTimer.current = null;
  }, []);
  const openMorePreview = useCallback(() => {
    clearMoreCloseTimer();
    setMoreHoverOpen(true);
  }, [clearMoreCloseTimer]);
  const closeMorePreviewSoon = useCallback(() => {
    clearMoreCloseTimer();
    moreCloseTimer.current = setTimeout(() => setMoreHoverOpen(false), 180);
  }, [clearMoreCloseTimer]);
  const handleMoreOpenChange = useCallback((next: boolean) => {
    if (next) {
      setMorePinnedOpen(true);
      return;
    }
    setMorePinnedOpen(false);
    setMoreHoverOpen(false);
  }, []);
  useEffect(
    () => () => {
      clearMoreCloseTimer();
    },
    [clearMoreCloseTimer],
  );
  const [runsOpen, setRunsOpen] = useState(true);

  useEffect(() => {
    if (!isChatRoute) return;
    queueMicrotask(() => setChatOpen(true));
  }, [isChatRoute]);
  useEffect(() => {
    if (!isStudioRoute) return;
    queueMicrotask(() => setRunsOpen(true));
  }, [isStudioRoute]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrolled, setScrolled] = useState(false);
  // Bottom fade hides at the very bottom / for short lists so the last row isn't washed out.
  const [canScrollDown, setCanScrollDown] = useState(false);
  // Rail width: 0 where scrollbars overlay (macOS default) or the list fits,
  // the platform's thin rail where they are classic. Only rows inside the
  // scroller lose it, so the rows outside pad by it to keep one edge. Written
  // to the DOM, and only on a change: state here would loop (React #185).
  const railWidthRef = useRef<number | null>(null);
  const measureScrollRail = useCallback((el: HTMLDivElement) => {
    const rail = el.offsetWidth - el.clientWidth;
    if (rail === railWidthRef.current) return;
    railWidthRef.current = rail;
    el.parentElement?.style.setProperty("--sidebar-rail", `${rail}px`);
  }, []);

  // A callback ref, not an effect: the mobile Sheet unmounts its subtree on
  // close and the breakpoint swaps it for the desktop one, so the scroller is a
  // new node each time and an effect keyed on a stable callback never re-runs.
  // Still runs before paint.
  const railObserverRef = useRef<ResizeObserver | null>(null);
  const attachScroller = useCallback(
    (el: HTMLDivElement | null) => {
      railObserverRef.current?.disconnect();
      railObserverRef.current = null;
      scrollRef.current = el;
      // Per node: a new parent has no variable yet even at the same rail, and
      // the cache would otherwise skip the write.
      railWidthRef.current = null;
      if (!el) return;
      measureScrollRail(el);
      // Watch the box, not renders: the Images disclosure and the project
      // toggles change the row count without rendering this component, and a
      // scrollbar appearing shrinks the content box by its own width. Safe
      // where the earlier observer was not: it writes a variable, never state,
      // so there is no render to feed back (React #185).
      const observer = new ResizeObserver(() => measureScrollRail(el));
      observer.observe(el);
      railObserverRef.current = observer;
    },
    [measureScrollRail],
  );

  // Driven only from onScroll + a content-change effect below. No
  // ResizeObserver: its callback-driven setState caused a render loop (React
  // #185). Both setters bail out when unchanged, so neither path can loop.
  const syncScrollState = useCallback((el: HTMLDivElement) => {
    const nextScrolled = el.scrollTop > 0;
    setScrolled((prev) => (prev === nextScrolled ? prev : nextScrolled));
    const nextCanScrollDown =
      el.scrollHeight - el.scrollTop - el.clientHeight > 1;
    setCanScrollDown((prev) =>
      prev === nextCanScrollDown ? prev : nextCanScrollDown,
    );
  }, []);

  const isExportRoute =
    pathname === "/export" || pathname.startsWith("/export/");
  const { displayTitle, avatarDataUrl } = useEffectiveProfile();

  const { projects } = useChatProjects();
  const activeProjectId = isChatRoute
    ? ((search.project as string | undefined) ?? null)
    : null;
  const {
    items: allChatItems,
    archivedItems: archivedChatItems,
    loaded: chatItemsLoaded,
  } = useChatSidebarItems({
    enabled: !isStudioRoute,
    requireMessages: false,
  });
  const pinnedIds = usePinnedChatsStore((s) => s.pinnedIds);
  const togglePinnedChat = usePinnedChatsStore((s) => s.togglePin);
  const setPinnedChats = usePinnedChatsStore((s) => s.setPinned);
  const unpinChat = usePinnedChatsStore((s) => s.unpin);
  const confirmDeleteChats = useChatPreferencesStore(
    (s) => s.confirmDeleteChats,
  );
  const alwaysDeleteChatFiles = useChatPreferencesStore(
    (s) => s.alwaysDeleteChatFiles,
  );
  const pinnedIdSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);
  const organizeBy = useSidebarOrganizationStore((s) => s.organizeBy);
  const chatSort = useSidebarOrganizationStore((s) => s.chatSort);
  const pinnedSort = useSidebarOrganizationStore((s) => s.pinnedSort);
  const manualOrder = useSidebarOrganizationStore((s) => s.manualOrder);
  const setOrganizeBy = useSidebarOrganizationStore((s) => s.setOrganizeBy);
  const setChatSort = useSidebarOrganizationStore((s) => s.setChatSort);
  const setPinnedSort = useSidebarOrganizationStore((s) => s.setPinnedSort);
  const setManualOrder = useSidebarOrganizationStore((s) => s.setManualOrder);
  // With the Projects section on, a project chat lives in its folder and
  // repeating it here would be noise. With it off there are no folders, so
  // Recents is where those chats go, and a new project chat still lands
  // somewhere visible. Pinned chats are held back either way: the Pinned
  // section renders those.
  const recentChatItems = useMemo(
    () =>
      allChatItems.filter(
        (item) =>
          !pinnedIdSet.has(item.id) &&
          showsInRecents(item.projectId, organizeBy),
      ),
    [allChatItems, pinnedIdSet, organizeBy],
  );
  const [pinnedOpen, setPinnedOpen] = useState(true);
  const [projectsOpen, setProjectsOpen] = useState(true);
  const [showAllProjects, setShowAllProjects] = useState(false);
  // Pinning a project now sorts it to the top of Projects, not into its own section.
  const pinnedProjectIds = usePinnedProjectsStore((s) => s.pinnedIds);
  const toggleProjectPin = usePinnedProjectsStore((s) => s.togglePin);
  const pinnedProjectIdSet = useMemo(
    () => new Set(pinnedProjectIds),
    [pinnedProjectIds],
  );
  // Pinned chats, in pin order. A pinned project chat also stays in its folder.
  const pinnedChatItems = useMemo(() => {
    const byId = new Map(allChatItems.map((item) => [item.id, item]));
    return pinnedIds
      .map((id) => byId.get(id))
      .filter((item): item is SidebarItem => Boolean(item));
  }, [allChatItems, pinnedIds]);
  // Chats per project, newest first. Pinned ones stay: a chat belongs to its
  // project either way, and these rows are mirrored in Recents regardless.
  const chatsByProjectId = useMemo(() => {
    const map = new Map<string, SidebarItem[]>();
    for (const item of allChatItems) {
      if (!item.projectId) continue;
      const list = map.get(item.projectId);
      if (list) list.push(item);
      else map.set(item.projectId, [item]);
    }
    for (const list of map.values())
      list.sort((a, b) => b.updatedAt - a.updatedAt);
    return map;
  }, [allChatItems]);
  // Every project gets a folder: pinned first in pin order, then by activity,
  // then whatever the user dragged, which outranks both. Activity comes from
  // the member chats, since a project's own updatedAt only moves when its name,
  // instructions or archived flag are edited.
  const sidebarProjectRecords = useMemo(() => {
    const lastActivityAt = (project: ProjectRecord) => {
      let latest = project.updatedAt ?? project.createdAt;
      for (const chat of chatsByProjectId.get(project.id) ?? []) {
        if (chat.updatedAt > latest) latest = chat.updatedAt;
      }
      return latest;
    };
    const byId = new Map(projects.map((p) => [p.id, p]));
    const pinned = pinnedProjectIds
      .map((id) => byId.get(id))
      .filter((p): p is ProjectRecord => Boolean(p));
    const rest = projects
      .filter((p) => !pinnedProjectIdSet.has(p.id))
      .sort((a, b) => lastActivityAt(b) - lastActivityAt(a));
    return applyManualOrder(
      [...pinned, ...rest],
      manualOrder[PROJECT_ORDER_SCOPE],
      (project) => project.id,
    );
  }, [
    projects,
    pinnedProjectIds,
    pinnedProjectIdSet,
    manualOrder,
    chatsByProjectId,
  ]);
  const visibleProjectRecords = showAllProjects
    ? sidebarProjectRecords
    : sidebarProjectRecords.slice(0, SIDEBAR_PROJECT_LIMIT);
  // Default expanded; the row toggles this. Show-more reveals chats past the limit.
  const [collapsedProjectIds, setCollapsedProjectIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [expandedChatProjectIds, setExpandedChatProjectIds] = useState<
    Set<string>
  >(() => new Set());
  const toggleProjectCollapsed = (id: string) =>
    setCollapsedProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const toggleProjectShowAll = (id: string) =>
    setExpandedChatProjectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const storeThreadId = useChatRuntimeStore((s) => s.activeThreadId);
  const setActiveThreadId = useChatRuntimeStore((s) => s.setActiveThreadId);
  // The whole map, so each row can show its own spinner.
  const runningByThreadId = useChatRuntimeStore((s) => s.runningByThreadId);
  // Rows, not raw thread ids: a compare conversation runs two pane threads but is one row.
  const runningChatCount = useMemo(() => {
    const running = new Set(
      Object.entries(runningByThreadId)
        .filter(([, on]) => on)
        .map(([id]) => id),
    );
    if (running.size === 0) return 0;
    let rows = 0;
    for (const item of allChatItems) {
      const ids = item.type === "compare" ? (item.threadIds ?? []) : [item.id];
      let claimed = false;
      for (const id of ids) {
        if (running.delete(id)) claimed = true;
      }
      if (claimed) rows += 1;
    }
    // Anything left belongs to no known row (a first turn mid-persist); count it as one.
    return rows + running.size;
  }, [runningByThreadId, allChatItems]);
  const anyChatRunning = runningChatCount > 0;
  // Where "Return to Chat" lands: the newest running chat, not an empty New Chat draft (map
  // insertion order is start order). Compare rows resolve back to the pair id /chat expects.
  const runningTarget = useMemo(() => {
    const ids = Object.entries(runningByThreadId)
      .filter(([, on]) => on)
      .map(([id]) => id);
    const id = ids.length > 0 ? ids[ids.length - 1] : null;
    if (!id) return null;
    const pair = allChatItems.find(
      (item) => item.type === "compare" && (item.threadIds ?? []).includes(id),
    );
    return pair
      ? { id: pair.id, compare: true as const }
      : { id, compare: false as const };
  }, [runningByThreadId, allChatItems]);
  const activeThreadId = isChatRoute
    ? ((search.thread as string | undefined) ??
      (search.compare as string | undefined) ??
      storeThreadId ??
      undefined)
    : undefined;
  const queueByThreadId = usePromptQueueUI((s) => s.byThreadId);
  const [unreadThreadIds, setUnreadThreadIds] = useState<Set<string>>(
    () => new Set(),
  );
  const previousRunningByThreadIdRef = useRef<Record<string, boolean>>({});
  const activeVisibleThreadIds = useMemo(() => {
    if (!activeThreadId) {
      return [];
    }
    const activeItem = allChatItems.find((item) => item.id === activeThreadId);
    return activeItem ? getSidebarItemThreadIds(activeItem) : [activeThreadId];
  }, [activeThreadId, allChatItems]);
  const activeVisibleThreadIdKey = activeVisibleThreadIds.join("\n");

  // "Priority" lifts rows wanting attention (generating, queued, unread), then
  // falls back to recency, which "Last updated" sorts by outright.
  const chatPriorityRank = useCallback(
    (item: SidebarItem) => {
      const ids = getSidebarItemThreadIds(item);
      if (ids.some((id) => runningByThreadId[id])) return 0;
      if (ids.some((id) => queueByThreadId[id])) return 1;
      if (ids.some((id) => unreadThreadIds.has(id))) return 2;
      return 3;
    },
    [runningByThreadId, queueByThreadId, unreadThreadIds],
  );
  const sortChatItems = useCallback(
    (
      items: SidebarItem[],
      scope: string,
      mode: SidebarChatSort,
    ): SidebarItem[] => {
      if (mode === "manual") {
        // Incoming order is the list's own rule, so undragged rows keep it:
        // newest first in Recents, pin order in Pinned.
        return applyManualOrder(items, manualOrder[scope], (item) => item.id);
      }
      if (mode === "priority") {
        return [...items].sort(
          (a, b) =>
            chatPriorityRank(a) - chatPriorityRank(b) ||
            b.updatedAt - a.updatedAt,
        );
      }
      return [...items].sort((a, b) => b.updatedAt - a.updatedAt);
    },
    [manualOrder, chatPriorityRank],
  );
  const sortedRecentChatItems = useMemo(
    () => sortChatItems(recentChatItems, RECENTS_ORDER_SCOPE, chatSort),
    [recentChatItems, sortChatItems, chatSort],
  );
  const sortedPinnedChatItems = useMemo(
    () => sortChatItems(pinnedChatItems, PINNED_ORDER_SCOPE, pinnedSort),
    [pinnedChatItems, sortChatItems, pinnedSort],
  );
  const sortedChatsByProjectId = useMemo(() => {
    const map = new Map<string, SidebarItem[]>();
    for (const [projectId, items] of chatsByProjectId) {
      map.set(
        projectId,
        sortChatItems(items, projectOrderScope(projectId), chatSort),
      );
    }
    return map;
  }, [chatsByProjectId, sortChatItems, chatSort]);
  // One id array per list, shared by every row in it. Built per row, these
  // would be N arrays of length N on each render.
  const recentRowIds = useMemo(
    () => sortedRecentChatItems.map((item) => item.id),
    [sortedRecentChatItems],
  );
  const pinnedRowIds = useMemo(
    () => sortedPinnedChatItems.map((item) => item.id),
    [sortedPinnedChatItems],
  );
  // Whole lists, not the visible slices, so a drop cannot lose what a
  // collapsed "Show more" is hiding.
  const projectRowIds = useMemo(
    () => sidebarProjectRecords.map((project) => project.id),
    [sidebarProjectRecords],
  );
  const projectChatRowIds = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [projectId, items] of sortedChatsByProjectId) {
      map.set(
        projectId,
        items.map((item) => item.id),
      );
    }
    return map;
  }, [sortedChatsByProjectId]);
  // How many nested rows the Projects section renders, so the bottom fade can
  // re-measure when regrouping or a disclosure changes the list height.
  const projectChatRowCount = useMemo(() => {
    if (organizeBy !== "project") return 0;
    let rows = 0;
    for (const project of visibleProjectRecords) {
      if (collapsedProjectIds.has(project.id)) continue;
      const chats = sortedChatsByProjectId.get(project.id) ?? [];
      rows += expandedChatProjectIds.has(project.id)
        ? chats.length
        : Math.min(chats.length, PROJECT_CHAT_LIMIT);
      // The "Show more" row counts too.
      if (chats.length > PROJECT_CHAT_LIMIT) rows += 1;
    }
    return rows;
  }, [
    organizeBy,
    visibleProjectRecords,
    collapsedProjectIds,
    expandedChatProjectIds,
    sortedChatsByProjectId,
  ]);

  const {
    selectedChatIds,
    setSelectedChatIds,
    selectedChatItems,
    selectionCount,
    selectedProjectIds,
    setSelectedProjectIds,
    selectedProjectRecords,
    projectSelectionCount,
    dropChatSelection,
    dropProjectSelection,
    clearSelection,
    handleSelectionClick,
    selectForContextMenu,
    handleProjectSelectionClick,
    selectProjectForContextMenu,
  } = useSidebarSelection({
    allChatItems,
    projects,
    projectRowIds,
  });

  const allSelectedProjectsPinned =
    projectSelectionCount > 0 &&
    selectedProjectRecords.every((project) =>
      pinnedProjectIdSet.has(project.id),
    );

  function pinSelectedProjects(pinned: boolean) {
    for (const project of selectedProjectRecords) {
      if (pinnedProjectIdSet.has(project.id) !== pinned) {
        toggleProjectPin(project.id);
      }
    }
    clearSelection();
  }

  function deleteSelectedProjects() {
    if (projectSelectionCount === 0) return;
    openDeleteDialog({ kind: "projects", projects: selectedProjectRecords });
  }

  const allSelectedPinned =
    selectionCount > 0 &&
    selectedChatItems.every((item) => pinnedIdSet.has(item.id));

  function pinSelected(pinned: boolean) {
    setPinnedChats(
      selectedChatItems.map((item) => item.id),
      pinned,
    );
    clearSelection();
  }

  function markSelectedUnread() {
    const threadIds = selectedChatItems.flatMap(getSidebarItemThreadIds);
    clearSelection();
    setUnreadThreadIds((current) => {
      const next = new Set(current);
      for (const threadId of threadIds) next.add(threadId);
      return next;
    });
  }

  async function archiveSelected() {
    const items = selectedChatItems;
    clearSelection();
    // Sequential: each archive can reset the active thread, and two of those
    // racing would fight over where the chat pane lands.
    let archived = 0;
    let failure: unknown;
    for (const item of items) {
      // Per item, so one bad chat does not strand the rest of the batch
      // unarchived with the selection already gone.
      try {
        await archiveChatItem(item, activeThreadId, (view) => {
          navigate({
            to: "/chat",
            search: item.projectId
              ? { project: item.projectId }
              : { new: view.newThreadNonce },
          });
        });
        archived += 1;
      } catch (err) {
        failure = err;
      }
    }
    // One notice for the batch, not one per chat. A partial batch gets both:
    // where the archived ones went, and that the rest did not make it.
    if (archived > 0) showArchivedChatsToast();
    if (archived < items.length) {
      toast.error(translate("settings.data.failedToArchiveChats"), {
        description: failure instanceof Error ? failure.message : undefined,
      });
    }
  }

  function deleteSelected() {
    const items = selectedChatItems;
    if (items.length === 0) return;
    if (confirmDeleteChats) {
      openDeleteDialog({ kind: "chats", items });
      return;
    }
    clearSelection();
    void (async () => {
      for (const item of items) {
        await deleteChatWithCleanup(item, {
          deleteFiles: alwaysDeleteChatFiles,
        });
      }
    })();
  }

  const manualDragEnabled = chatSort === "manual";
  const pinnedDragEnabled = pinnedSort === "manual";
  const {
    draggingRow,
    dropTargetRowId,
    dropCueClass,
    moveRowItem,
    rowDragProps,
  } = useSidebarDragAndDrop({ setManualOrder });

  function renderMoveRowItems(
    scope: string,
    orderedIds: string[],
    rowId: string,
    at: number,
  ) {
    return (
      <>
        <DropdownMenuItem disabled={at <= 0} onSelect={() => moveRowItem(scope, orderedIds, rowId, -1)}>
          <HugeiconsIcon
            icon={ArrowUp01Icon}
            strokeWidth={1.75}
            className="size-icon"
          />
          <span>{t("shell.organize.moveUp")}</span>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={at === -1 || at >= orderedIds.length - 1}
          onSelect={() => moveRowItem(scope, orderedIds, rowId, 1)}
        >
          <HugeiconsIcon
            icon={ArrowDown01Icon}
            strokeWidth={1.75}
            className="size-icon"
          />
          <span>{t("shell.organize.moveDown")}</span>
        </DropdownMenuItem>
      </>
    );
  }

  useEffect(() => {
    const activeVisibleThreadIdSet = new Set(
      activeVisibleThreadIdKey ? activeVisibleThreadIdKey.split("\n") : [],
    );
    const previousRunningByThreadId = previousRunningByThreadIdRef.current;
    const completedThreadIds: string[] = [];

    for (const [threadId, wasRunning] of Object.entries(
      previousRunningByThreadId,
    )) {
      if (
        wasRunning &&
        !runningByThreadId[threadId] &&
        !activeVisibleThreadIdSet.has(threadId)
      ) {
        completedThreadIds.push(threadId);
      }
    }

    if (completedThreadIds.length > 0 || activeVisibleThreadIdSet.size > 0) {
      queueMicrotask(() => {
        setUnreadThreadIds((current) => {
          let next: Set<string> | null = null;
          const mutable = () => {
            next ??= new Set(current);
            return next;
          };

          for (const threadId of completedThreadIds) {
            if (!current.has(threadId)) {
              mutable().add(threadId);
            }
          }

          for (const threadId of activeVisibleThreadIdSet) {
            if (current.has(threadId)) {
              mutable().delete(threadId);
            }
          }

          return next ?? current;
        });
      });
    }
    previousRunningByThreadIdRef.current = runningByThreadId;
  }, [activeVisibleThreadIdKey, runningByThreadId]);

  // Export runs in the background; reflect it on the Export nav item from any tab.
  const exportInProgress = useExportRuntimeStore((s) => s.isExporting);
  // On any non-chat tab, offer a way back to the live chat instead of starting a new one
  // whenever a chat is running or its thread is active, or an export is in progress.
  const showReturnToChat =
    !isChatRoute &&
    (exportInProgress || anyChatRunning || storeThreadId != null);

  // Recompute bottom-fade on mount and whenever list height can change: onScroll never fires
  // for short, non-scrolling lists. Guarded setState below can't loop.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const next = el.scrollHeight - el.scrollTop - el.clientHeight > 1;
    setCanScrollDown((prev) => (prev === next ? prev : next));
  }, [
    recentChatItems.length,
    projects.length,
    chatOpen,
    pinnedOpen,
    // The update card grows the footer, so the scroll area shrinks under it.
    showUpdateCard,
    // Regrouping, collapsing a folder or revealing more adds and removes rows
    // with no scroll and no collapsible animation to re-measure off.
    projectsOpen,
    projectChatRowCount,
    visibleProjectRecords.length,
    // Pinning a project chat adds a Pinned row while Recents and the folder
    // counts both stay put, so nothing else here moves.
    pinnedChatItems.length,
    // And with no chats in them, folders appear and disappear on their own.
    organizeBy,
  ]);

  // Resizing changes clientHeight without firing onScroll, so the fade would
  // stay hidden while rows are still clipped. Window events only: no element
  // observer, so this can't feed back into the loop that caused React #185.
  useEffect(() => {
    const onResize = () => {
      const el = scrollRef.current;
      if (el) syncScrollState(el);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [syncScrollState]);

  const chatDisabled = false;
  const showTrainingRecents = false;
  const usesDesktopTitlebar = usesCustomTitlebar || usesNativeMacTitlebar;

  // One box for every row pill, so a hover pill has the same edges wherever it
  // lands. Rows outside the list scroller add the rail width it does not lose,
  // so both end on the same edge whether or not the scrollbar takes space.
  // Logical sides, since the rail is on the inline end and moves under rtl.
  const rowPadding = usesDesktopTitlebar
    ? "ps-[5px] pe-[calc(var(--sidebar-rail,0px)+5px)]"
    : "ps-1.5 pe-[calc(var(--sidebar-rail,0px)+6px)]";

  // Inside it the rail already sits in that space, so this is just the gap
  // between a pill and the scrollbar, matched to the gap on the other side.
  const scrollRowPadding = usesDesktopTitlebar ? "px-[5px]" : "px-1.5";

  // One definition per row, so pinned rows and the flyout can't drift apart.
  const navRows: Record<SidebarNavItemId, NavRowDef> = {
    projects: {
      icon: Folder01Icon,
      label: t("shell.navigation.projects"),
      active: pathname === "/projects" || pathname.startsWith("/projects/"),
      onClick: () => {
        navigate({ to: "/projects" });
        closeMobileIfOpen();
      },
      onIntent: () => {
        preloadSilently(router.preloadRoute({ to: "/projects" }));
      },
      className: "group/projects-item relative",
      // The inline "new project" affordance only fits a real row.
      children: (
        <button
          type="button"
          aria-label="New project"
          onClick={(e) => {
            e.stopPropagation();
            // NewProjectDialog owns its own name field, so opening it is just the move target plus the open flag.
            setProjectCreateMoveTarget(null);
            setCreatingProject(true);
          }}
          className="sidebar-row-action group-hover/projects-item:opacity-100 group-hover/projects-item:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto group-data-[collapsible=icon]:hidden"
        >
          <span className="sidebar-row-action-glyph">
            <HugeiconsIcon
              icon={PlusSignIcon}
              strokeWidth={1.75}
              className="size-4"
            />
          </span>
        </button>
      ),
    },
    hub: {
      icon: DashboardCircleIcon,
      label: t("shell.navigation.hub"),
      active: pathname === "/hub" || pathname.startsWith("/hub/"),
      onClick: () => {
        navigate({ to: "/hub" });
        closeMobileIfOpen();
      },
      onIntent: () => {
        preloadSilently(router.preloadRoute({ to: "/hub" }));
      },
    },
    images: {
      icon: Image03Icon,
      label: t("shell.navigation.images"),
      // No "New" pill: the row's trailing slot holds the workflow disclosure instead.
      active: pathname === "/images" || pathname.startsWith("/images/"),
      onClick: () => {
        navigate({ to: "/images" });
        closeMobileIfOpen();
      },
      onIntent: () => {
        preloadSilently(router.preloadRoute({ to: "/images" }));
      },
    },
    audio: {
      icon: AudioWave01Icon,
      label: t("shell.navigation.audio"),
      active: pathname === "/audio" || pathname.startsWith("/audio/"),
      onClick: () => {
        navigate({ to: "/audio" });
        closeMobileIfOpen();
      },
      onIntent: () => {
        preloadSilently(router.preloadRoute({ to: "/audio" }));
      },
    },
    recipes: {
      icon: ChefHatIcon,
      label: t("shell.navigation.recipes"),
      active: pathname.startsWith("/data-recipes"),
      onClick: () => {
        navigate({ to: "/data-recipes" });
        closeMobileIfOpen();
      },
      onIntent: () => {
        preloadSilently(router.preloadRoute({ to: "/data-recipes" }));
      },
    },
    export: {
      icon: DownloadSquare01Icon,
      label: t("shell.navigation.export"),
      active: pathname === "/export" || pathname.startsWith("/export/"),
      spinner: exportInProgress,
      onClick: () => {
        navigate({ to: "/export" });
        closeMobileIfOpen();
      },
      onIntent: () => {
        preloadSilently(router.preloadRoute({ to: "/export" }));
        preloadSilently(
          import("@/features/export/export-navigation-cache").then((module) =>
            module.preloadExportData(),
          ),
        );
      },
    },
    // The monitor page, not the API keys dialog the profile menu opens.
    api: {
      icon: Globe02Icon,
      label: t("shell.navigation.api"),
      active:
        pathname === "/api-monitor" || pathname.startsWith("/api-monitor/"),
      onClick: () => {
        navigate({ to: "/api-monitor" });
        closeMobileIfOpen();
      },
      onIntent: () => {
        preloadSilently(router.preloadRoute({ to: "/api-monitor" }));
      },
    },
  };
  const unpinnedNavIds = sidebarNav
    .filter((item) => item.id !== "recipes" && !item.pinned)
    .map((item) => item.id);
  // More needs two or more rows to be worth a click; with exactly one unpinned, the menu and that row are both dropped.
  const overflowNavIds = unpinnedNavIds.length > 1 ? unpinnedNavIds : [];
  const inlineNavIds = sidebarNav
    .filter((item) => item.id !== "recipes" && item.pinned)
    .map((item) => item.id);
  const imagesWorkflowsListed = sidebarState !== "collapsed";

  const showSidebarBrand = true;

  function chatSearchForProject(projectId: string | null) {
    if (projectId) {
      return { project: projectId };
    }
    return {
      new: createNavigationNonce(),
    };
  }

  function openNewChat(projectId = activeProjectId) {
    clearNewChatDraft();
    setActiveThreadId(null);
    useChatRuntimeStore.getState().setActiveProjectId(projectId);
    // The normal new-chat affordance is always a saved chat; only the toolbar toggle is temporary.
    useChatRuntimeStore.getState().setIncognito(false);
    navigate({ to: "/chat", search: chatSearchForProject(projectId) });
    closeMobileIfOpen();
  }

  function openProject(projectId: string) {
    setActiveThreadId(null);
    useChatRuntimeStore.getState().setActiveProjectId(projectId);
    navigate({ to: "/chat", search: { project: projectId } });
    closeMobileIfOpen();
  }

  async function handleDeleteThread(
    item: Parameters<typeof deleteChatItem>[0],
    args: { deleteFiles?: boolean } = {},
  ) {
    await deleteChatItem(
      item,
      activeThreadId,
      (view) => {
        navigate({
          to: "/chat",
          search: item.projectId
            ? { project: item.projectId }
            : { new: view.newThreadNonce },
        });
      },
      args,
    );
  }

  // Shared chat delete: same error toast and pin cleanup with or without the confirm dialog.
  async function deleteChatWithCleanup(
    item: SidebarItem,
    args: { deleteFiles?: boolean } = {},
  ) {
    try {
      await handleDeleteThread(item, args);
      unpinChat(item.id);
    } catch (err) {
      toast.error(translate("shell.toast.failedToDeleteChat"), {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  function showArchivedChatsToast() {
    const toastId = toast(
      <button
        type="button"
        onClick={() => {
          toast.dismiss(toastId);
          useSettingsDialogStore.getState().openArchivedChats();
        }}
        className="w-full cursor-pointer text-left"
      >
        {t("shell.toast.archivedChats")}
      </button>,
      { closeButton: true },
    );
  }

  async function handleArchiveThread(item: SidebarItem) {
    try {
      await archiveChatItem(item, activeThreadId, (view) => {
        navigate({
          to: "/chat",
          search: item.projectId
            ? { project: item.projectId }
            : { new: view.newThreadNonce },
        });
      });
      showArchivedChatsToast();
    } catch (err) {
      toast.error(t("shell.toast.failedToArchiveChat"), {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  const [renamingTarget, setRenamingTarget] = useState<RenameTarget | null>(
    null,
  );
  const [renameDraft, setRenameDraft] = useState("");
  // Skips the inline rename input's blur-commit when Enter/Escape already handled it.
  const skipRenameBlurRef = useRef(false);
  // Optimistic title while the debounced sidebar refresh catches up, so the old name doesn't flash.
  const [pendingRename, setPendingRename] = useState<{
    id: string;
    title: string;
  } | null>(null);
  useEffect(() => {
    if (!pendingRename) return;
    const match = allChatItems.find((i) => i.id === pendingRename.id);
    if (!match || match.title !== pendingRename.title) return;
    queueMicrotask(() => {
      setPendingRename((current) =>
        current?.id === pendingRename.id &&
        current.title === pendingRename.title
          ? null
          : current,
      );
    });
  }, [allChatItems, pendingRename]);
  const [creatingProject, setCreatingProject] = useState(false);
  const [projectCreateMoveTarget, setProjectCreateMoveTarget] =
    useState<SidebarItem | null>(null);
  const renameTrimmed = renameDraft.trim();
  const renameDirty =
    renamingTarget !== null &&
    (renamingTarget.kind === "chat"
      ? renameTrimmed.length > 0 && renameTrimmed !== renamingTarget.current
      : renameTrimmed.length > 0 && renameTrimmed !== renamingTarget.current);

  function openRenameChat(item: SidebarItem) {
    setRenameDraft(item.title);
    setRenamingTarget({ kind: "chat", item, current: item.title });
  }
  async function commitRename() {
    const target = renamingTarget;
    if (!target || !renameDirty) return;
    setRenamingTarget(null);
    if (target.kind === "chat") {
      setPendingRename({ id: target.item.id, title: renameTrimmed });
      try {
        await renameChatItem(target.item, renameTrimmed);
      } catch (err) {
        setPendingRename(null);
        toast.error(translate("shell.toast.failedToRenameChat"), {
          description: err instanceof Error ? err.message : undefined,
        });
      }
      return;
    }
    if (target.kind === "project") {
      try {
        await renameChatProject(target.project.id, renameTrimmed);
      } catch (err) {
        toast.error(t("shell.toast.failedToRenameProject"), {
          description: err instanceof Error ? err.message : undefined,
        });
      }
      return;
    }
  }

  // Inline chat rename commits on Enter or blur, cancels on Escape.
  function handleInlineRenameKeyDown(
    event: React.KeyboardEvent<HTMLInputElement>,
  ) {
    if (event.key === "Enter") {
      event.preventDefault();
      skipRenameBlurRef.current = true;
      // Commit when changed, else just close, so a no-op Enter doesn't leave the row an input.
      if (renameDirty) void commitRename();
      else setRenamingTarget(null);
    } else if (event.key === "Escape") {
      event.preventDefault();
      skipRenameBlurRef.current = true;
      setRenamingTarget(null);
    }
  }

  function handleInlineRenameBlur() {
    if (skipRenameBlurRef.current) {
      skipRenameBlurRef.current = false;
      return;
    }
    if (renameDirty) void commitRename();
    else setRenamingTarget(null);
  }

  const [confirmingDelete, setConfirmingDelete] = useState<DeleteTarget | null>(
    null,
  );
  const [deleteFilesOnDelete, setDeleteFilesOnDelete] = useState(false);

  /** Always through here: a stale switch would delete an unrelated sandbox. */
  function openDeleteDialog(target: DeleteTarget) {
    // Chats follow the preference, so the switch shows what will happen and can
    // still be turned off for this one delete. A project workspace is a bigger
    // thing to remove, so it keeps asking from scratch.
    const chats = target.kind === "chat" || target.kind === "chats";
    setDeleteFilesOnDelete(chats && alwaysDeleteChatFiles);
    setConfirmingDelete(target);
  }

  /** Only where a sandbox can actually be removed. A chat in a project still has one: anything it wrote before the move is in
   *  its own folder, and deletion never touches the project workspace. */
  function deleteTargetHasFiles(target: DeleteTarget | null): boolean {
    return target !== null;
  }

  async function commitDelete() {
    const target = confirmingDelete;
    if (!target) return;
    const shouldDeleteProjectFiles =
      (target.kind === "project" || target.kind === "projects") &&
      deleteFilesOnDelete;
    const shouldDeleteChatFiles =
      (target.kind === "chat" || target.kind === "chats") &&
      deleteFilesOnDelete;
    setConfirmingDelete(null);
    // Reset so the next delete never inherits this switch.
    setDeleteFilesOnDelete(false);
    if (target.kind === "chat") {
      await deleteChatWithCleanup(target.item, {
        deleteFiles: shouldDeleteChatFiles,
      });
      return;
    }
    if (target.kind === "chats") {
      clearSelection();
      // Sequential, so one failure's toast is not buried by the next delete.
      for (const item of target.items) {
        await deleteChatWithCleanup(item, {
          deleteFiles: shouldDeleteChatFiles,
        });
      }
      return;
    }
    if (target.kind === "projects") {
      clearSelection();
      // Only what actually went: a failed delete leaves that project in place,
      // and redirecting off it would strand the user for nothing.
      const deletedIds = new Set<string>();
      for (const project of target.projects) {
        try {
          await deleteChatProject(project.id, {
            deleteFiles: shouldDeleteProjectFiles,
          });
          deletedIds.add(project.id);
        } catch (err) {
          toast.error(t("shell.toast.failedToDeleteProject"), {
            description: err instanceof Error ? err.message : undefined,
          });
        }
      }
      // The same cleanup one delete does, once for the batch: refresh history so
      // member chats do not linger as rows, and leave a deleted project's page.
      // Unconditional, since a delete that threw may still have removed chats.
      notifyChatHistoryUpdated();
      const runtimeProjectId = useChatRuntimeStore.getState().activeProjectId;
      if (
        isChatRoute &&
        ((activeProjectId !== null && deletedIds.has(activeProjectId)) ||
          (runtimeProjectId !== null && deletedIds.has(runtimeProjectId)))
      ) {
        useChatRuntimeStore.getState().setActiveProjectId(null);
        navigate({ to: "/chat", search: { new: createNavigationNonce() } });
      }
      return;
    }
    if (target.kind === "project") {
      try {
        await deleteChatProject(target.project.id, {
          deleteFiles: shouldDeleteProjectFiles,
        });
        // Refresh chat history so the project's reparented chats don't linger as stale rows.
        notifyChatHistoryUpdated();
        // activeProjectId is only the ?project= param; on a thread-only URL the project comes from
        // the runtime store, so check that too or the user is stranded on a deleted thread. Only
        // redirect from a chat route: the runtime store value can be stale elsewhere.
        const runtimeProjectId = useChatRuntimeStore.getState().activeProjectId;
        if (
          isChatRoute &&
          (activeProjectId === target.project.id ||
            runtimeProjectId === target.project.id)
        ) {
          useChatRuntimeStore.getState().setActiveProjectId(null);
          navigate({ to: "/chat", search: { new: createNavigationNonce() } });
        }
      } catch (err) {
        toast.error(t("shell.toast.failedToDeleteProject"), {
          description: err instanceof Error ? err.message : undefined,
        });
      }
      return;
    }
  }

  // "New project" from a chat's menu moves that chat in and stays put; otherwise open the
  // project, unless a slow upload outlasted the route the user was on.
  async function afterCreateProject(
    project: ProjectRecord,
    { stayedOnRoute }: { stayedOnRoute: boolean },
  ) {
    const moveTarget = projectCreateMoveTarget;
    setProjectCreateMoveTarget(null);
    if (!moveTarget) {
      if (stayedOnRoute) openProject(project.id);
      return;
    }
    try {
      await moveChatItemToProject(moveTarget, project.id);
      if (activeThreadId === moveTarget.id) {
        useChatRuntimeStore.getState().setActiveProjectId(project.id);
      }
    } catch (err) {
      toast.error(t("shell.toast.failedToMoveChatToNewProject"), {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  async function moveChatToProject(
    item: SidebarItem,
    projectId: string | null,
  ) {
    if (item.projectId === projectId) return;
    try {
      await moveChatItemToProject(item, projectId);
      if (activeThreadId === item.id) {
        useChatRuntimeStore.getState().setActiveProjectId(projectId);
      }
    } catch (err) {
      toast.error(t("shell.toast.failedToMoveChat"), {
        description: err instanceof Error ? err.message : undefined,
      });
    }
  }

  function clearChatNotifications(item: SidebarItem) {
    const threadIds = getSidebarItemThreadIds(item);
    setUnreadThreadIds((current) => {
      if (!threadIds.some((threadId) => current.has(threadId))) {
        return current;
      }
      const next = new Set(current);
      for (const threadId of threadIds) {
        next.delete(threadId);
      }
      return next;
    });
  }

  // The "..." every list header carries. Only chat lists regroup, so that half
  // is opt-in; Pinned takes the sort half alone.
  function renderChatSidebarItem(
    item: SidebarItem,
    variant: "project" | "recent",
    drag?: { scope: string; orderedIds: string[]; index: number },
    list?: { scope: string; ids: string[] },
  ) {
    return (
      <ChatSidebarItem
        key={item.id}
        item={item}
        variant={variant}
        drag={drag}
        list={list}
        activeThreadId={activeThreadId}
        selectedChatIds={selectedChatIds}
        pinnedIdSet={pinnedIdSet}
        runningByThreadId={runningByThreadId}
        queueByThreadId={queueByThreadId}
        unreadThreadIds={unreadThreadIds}
        pendingRename={pendingRename}
        renamingTarget={renamingTarget}
        renameDraft={renameDraft}
        draggingRow={draggingRow}
        projects={projects}
        isTauri={isTauri}
        confirmDeleteChats={confirmDeleteChats}
        alwaysDeleteChatFiles={alwaysDeleteChatFiles}
        selectionCount={selectionCount}
        allSelectedPinned={allSelectedPinned}
        dropCueClass={dropCueClass}
        rowDragProps={rowDragProps}
        handleSelectionClick={handleSelectionClick}
        selectForContextMenu={selectForContextMenu}
        clearSelection={clearSelection}
        clearChatNotifications={clearChatNotifications}
        navigate={navigate}
        closeMobileIfOpen={closeMobileIfOpen}
        togglePinnedChat={togglePinnedChat}
        openRenameChat={openRenameChat}
        setRenameDraft={setRenameDraft}
        handleInlineRenameKeyDown={handleInlineRenameKeyDown}
        handleInlineRenameBlur={handleInlineRenameBlur}
        renderMoveRowItems={renderMoveRowItems}
        setProjectCreateMoveTarget={setProjectCreateMoveTarget}
        setCreatingProject={setCreatingProject}
        moveChatToProject={moveChatToProject}
        handleArchiveThread={handleArchiveThread}
        openDeleteDialog={openDeleteDialog}
        deleteChatWithCleanup={deleteChatWithCleanup}
        pinSelected={pinSelected}
        archiveSelected={archiveSelected}
        markSelectedUnread={markSelectedUnread}
        deleteSelected={deleteSelected}
      />
    );
  }

  return (
    <>
      <Sidebar
        collapsible="icon"
        collapseToZero={isTauri}
        variant="sidebar"
        className={cn(
          // Rail background comes from --sidebar-surface (index.css) so the footer fade can match it.
          "font-heading group-data-[collapsible=icon]:[&_[data-sidebar=sidebar]]:bg-[var(--sidebar-surface)]",
          usesNativeMacTitlebar &&
            "group-data-[collapsible=icon]:[&_[data-sidebar=sidebar]]:border-r-0",
        )}
      >
        <SidebarBrandHeader
          showSidebarBrand={showSidebarBrand}
          usesNativeMacTitlebar={usesNativeMacTitlebar}
          usesDesktopTitlebar={usesDesktopTitlebar}
          isMobile={isMobile}
          pinned={pinned}
          togglePinned={togglePinned}
          chatDisabled={chatDisabled}
          openNewChat={openNewChat}
          closeMobileIfOpen={closeMobileIfOpen}
          searchShortcutLabel={searchShortcutLabel}
        />

        <SidebarGroup
          className={cn(
            "group-data-[collapsible=icon]:px-0 shrink-0 transition-[padding]",
            rowPadding,
            usesDesktopTitlebar ? "pt-[11px]" : "pt-[9px]",
            // Scrolled: New Chat is pinned, give a little gap below it.
            scrolled ? "pb-[5px]" : "pb-px",
          )}
        >
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem
                icon={PencilEdit02Icon}
                label={
                  showReturnToChat
                    ? runningChatCount > 1
                      ? // Name the count rather than imply a single live chat.
                        t("shell.navigation.returnToChats", {
                          count: runningChatCount,
                        })
                      : t("shell.navigation.returnToChat")
                    : t("shell.navigation.newChat")
                }
                // Off-route this row is the only sign chats are still running.
                spinner={anyChatRunning && !isChatRoute}
                // An action, not a destination, so it never marks itself active: the active pill is the
                // hover pill, and on a blank new chat it left the row looking permanently hovered.
                active={false}
                onClick={() => {
                  if (showReturnToChat) {
                    // Prefer the running thread so we return to the live generation, not the empty new chat.
                    if (runningTarget && runningTarget.id !== storeThreadId) {
                      navigate({
                        to: "/chat",
                        search: runningTarget.compare
                          ? { compare: runningTarget.id }
                          : { thread: runningTarget.id },
                      });
                    } else {
                      navigate({ to: "/chat" });
                    }
                    closeMobileIfOpen();
                    return;
                  }
                  openNewChat(null);
                }}
              />
              {/* Search sits in the header when the brand row is shown (mac/web).
                Hide this row there, but keep it in the collapsed rail. On custom
                titlebars (win/linux) there's no header button, so keep the row. */}
              <NavItem
                icon={Search01Icon}
                label={t("shell.navigation.search")}
                active={false}
                className={
                  showSidebarBrand
                    ? "hidden group-data-[collapsible=icon]:block"
                    : undefined
                }
                onClick={() => {
                  useChatSearchStore.getState().open();
                  closeMobileIfOpen();
                }}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarContent
          ref={(element) => {
            attachScroller(element);
          }}
          onScroll={(e) => syncScrollState(e.currentTarget)}
          // Collapsible groups animate their height; re-measure the fade once the animation settles.
          onAnimationEnd={(e) => {
            if (
              e.animationName === "collapsible-down" ||
              e.animationName === "collapsible-up"
            ) {
              syncScrollState(e.currentTarget);
            }
          }}
          className={cn(
            // pb-2 keeps the last row's rounded highlight clear of the overflow clip edge.
            "sidebar-scroll-fade gap-0 overflow-y-auto overscroll-contain min-h-0 pb-2",
            scrolled && "is-scrolled",
          )}
        >
          <SidebarGroup
            data-tour="navbar"
            className={cn(
              "group-data-[collapsible=icon]:px-0 py-0 shrink-0",
              scrollRowPadding,
            )}
          >
            <SidebarGroupContent>
              <SidebarMenu>
                {/* Order and pin state come from Settings -> Appearance ->
                  Sidebar navigation. */}
                {inlineNavIds.map((id) => {
                  const row = navRows[id];
                  // A row whose capability is still unmeasured spins instead of blacking out.
                  const rowState = resolveNavRowState(row);
                  return (
                    <NavItem
                      key={id}
                      icon={row.icon}
                      label={row.label}
                      badge={row.badge}
                      // While the workflows are listed, the current one carries the highlight, not the Images row.
                      active={
                        id === "images" && imagesWorkflowsListed
                          ? false
                          : row.active
                      }
                      disabled={rowState.disabled}
                      tooltip={rowState.tooltip}
                      alwaysTooltip={rowState.pending}
                      spinner={rowState.spinner}
                      testId={`nav-row-${id}`}
                      onClick={row.onClick}
                      onIntent={row.onIntent}
                      className={cn(
                        row.className,
                        id === "images" && "group/images-item",
                      )}
                      // Off the Images page the list is folded, so the row offers a way to open it.
                      overlay={
                        id === "images" &&
                        !row.active &&
                        sidebarState !== "collapsed" ? (
                          <ImagesNavDisclosure />
                        ) : undefined
                      }
                    >
                      {/* Images carries its workflows as rows beneath it. */}
                      {id === "images" ? (
                        <ImagesWorkflowList
                          active={row.active}
                          collapsed={sidebarState === "collapsed"}
                          onPick={(workflowId) => {
                            useImageWorkflowStore
                              .getState()
                              .setWorkflow(workflowId);
                            navigate({ to: "/images" });
                            closeMobileIfOpen();
                          }}
                        />
                      ) : (
                        row.children
                      )}
                    </NavItem>
                  );
                })}
                <NavItem
                  icon={BubbleChatIcon}
                  label={t("shell.navigation.channels")}
                  badge={t("shell.navigation.comingSoon")}
                  active={false}
                  disabled={true}
                  tooltip={t("shell.navigation.channelsComingSoon")}
                  alwaysTooltip={true}
                  onClick={() => undefined}
                  testId="nav-row-channels"
                />
                {/* Unpinned destinations, behind one row. */}
                {overflowNavIds.length > 0 && (
                  <SidebarMenuItem
                    onPointerEnter={openMorePreview}
                    onPointerLeave={closeMorePreviewSoon}
                  >
                    <DropdownMenu
                      open={moreOpen}
                      onOpenChange={handleMoreOpenChange}
                      modal={false}
                    >
                      {/* Tooltip wraps the trigger rather than using the button's `tooltip` prop: that returns a Tooltip root, so DropdownMenuTrigger asChild would miss the DOM node. */}
                      <Tooltip>
                        <TooltipPrimitive.Trigger asChild>
                          <DropdownMenuTrigger asChild>
                            <SidebarMenuButton
                              // More is a container, not a destination: no active style just because the current page
                              // lives inside it. Keeps the row highlighted while the panel is open, after the pointer
                              // has left. Not data-state: the tooltip and menu triggers both write that one.
                              data-menu-open={moreOpen ? "true" : undefined}
                              onPointerDownCapture={(event) => {
                                if (event.button !== 0 || event.ctrlKey) return;
                                event.preventDefault();
                                event.stopPropagation();
                                event.currentTarget.focus({
                                  preventScroll: true,
                                });
                                clearMoreCloseTimer();
                                if (morePinnedOpen) {
                                  setMorePinnedOpen(false);
                                  setMoreHoverOpen(false);
                                } else {
                                  setMorePinnedOpen(true);
                                }
                              }}
                              className="sidebar-nav-btn h-[33px] rounded-full gap-[8.5px] pl-3 pr-2.5 font-medium group-data-[collapsible=icon]:px-2.5 group-data-[collapsible=icon]:!w-[32px] group-data-[collapsible=icon]:mx-auto"
                            >
                              <HugeiconsIcon
                                icon={MoreHorizontalIcon}
                                strokeWidth={1.75}
                                className="size-icon! shrink-0 group-hover/menu-button:animate-icon-pop"
                              />
                              <span className="text-ui-14p5 leading-ui-19 tracking-nav">
                                {t("shell.navigation.more")}
                              </span>
                            </SidebarMenuButton>
                          </DropdownMenuTrigger>
                        </TooltipPrimitive.Trigger>
                        {/* Collapsed rail only; expanded rows show their label. */}
                        <TooltipContent
                          side="right"
                          align="center"
                          className="tooltip-compact"
                          hidden={isMobile || sidebarState !== "collapsed"}
                        >
                          {t("shell.navigation.more")}
                        </TooltipContent>
                      </Tooltip>
                      <DropdownMenuContent
                        side="right"
                        align="start"
                        sideOffset={6}
                        className="w-48 p-1"
                        onPointerEnter={openMorePreview}
                        onPointerLeave={closeMorePreviewSoon}
                      >
                        {overflowNavIds.map((id) => {
                          const row = navRows[id];
                          // Same pending handling as the inline rows above.
                          const rowState = resolveNavRowState(row);
                          return (
                            <MoreMenuItem
                              key={id}
                              icon={row.icon}
                              label={row.label}
                              badge={row.badge}
                              active={row.active}
                              disabled={rowState.disabled}
                              tooltip={rowState.tooltip}
                              spinner={rowState.spinner}
                              onSelect={row.onClick}
                              onIntent={row.onIntent}
                            />
                          );
                        })}
                        {/* Way out of the flyout: jump straight to the control that
                          decides what lives here vs. on the sidebar itself.
                          my-1 matches the menu's own p-1, so the gap either side
                          of the rule equals the one under the last row. */}
                        <DropdownMenuSeparator className="mx-1! my-1! h-0! border-t border-border/70 bg-transparent! dark:border-white/15" />
                        <DropdownMenuItem
                          onSelect={() =>
                            useSettingsDialogStore
                              .getState()
                              .openDialog("appearance", {
                                scrollTarget: "appearance-sidebar-nav",
                              })
                          }
                        >
                          <HugeiconsIcon
                            icon={Settings02Icon}
                            strokeWidth={1.75}
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {t("shell.navigation.customizeSidebar")}
                          </span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>

          {/* Pinned chats */}
          {!isStudioRoute &&
            !showTrainingRecents &&
            pinnedChatItems.length > 0 && (
              <Collapsible
                open={pinnedOpen}
                onOpenChange={setPinnedOpen}
                asChild
              >
                <SidebarGroup className="group-data-[collapsible=icon]:hidden px-0 py-0">
                  <SidebarGroupLabel
                    className={cn(
                      "sidebar-sticky-label sidebar-sticky-label-following group/sidebar-header gap-1",
                      scrolled && "is-scrolled",
                    )}
                  >
                    <CollapsibleTrigger className="cursor-pointer flex min-w-0 flex-1 items-center gap-1 group/sb-collap">
                      Pinned
                      <ChevronDown className="size-3.5 opacity-0 transition-[transform,opacity] duration-200 group-hover/sb-collap:opacity-100 group-focus-visible/sb-collap:opacity-100 data-[state=open]:rotate-0 [[data-state=closed]_&]:rotate-[-90deg] [[data-state=closed]_&]:opacity-100" />
                    </CollapsibleTrigger>
                    {/* Pinning is the grouping, so no organize half and no "+". */}
                    {<SidebarHeaderMenu
                      ariaLabel={t("shell.organize.sortPinnedChats")}
                      sortLabel={t("shell.organize.sortPinnedBy")}
                      sortValue={pinnedSort}
                      onSortChange={setPinnedSort}
                    />}
                  </SidebarGroupLabel>
                  <CollapsibleContent>
                    <SidebarGroupContent className={scrollRowPadding}>
                      <SidebarMenu>
                        {sortedPinnedChatItems.map((item, index) =>
                          renderChatSidebarItem(
                            item,
                            "recent",
                            pinnedDragEnabled
                              ? {
                                  scope: PINNED_ORDER_SCOPE,
                                  orderedIds: pinnedRowIds,
                                  index,
                                }
                              : undefined,
                            { scope: PINNED_ORDER_SCOPE, ids: pinnedRowIds },
                          ),
                        )}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            )}

          {/* Projects: one folder per project, its chats nested underneath */}
          {!isStudioRoute &&
            !showTrainingRecents &&
            organizeBy === "project" &&
            sidebarProjectRecords.length > 0 && (
              <Collapsible
                open={projectsOpen}
                onOpenChange={setProjectsOpen}
                asChild
              >
                <SidebarGroup className="group-data-[collapsible=icon]:hidden px-0 py-0">
                  {/* Trigger takes the free space; the actions reveal beside it. */}
                  <SidebarGroupLabel
                    className={cn(
                      "sidebar-sticky-label sidebar-sticky-label-following group/sidebar-header gap-1",
                      scrolled && "is-scrolled",
                    )}
                  >
                    <CollapsibleTrigger className="cursor-pointer flex min-w-0 flex-1 items-center gap-1 group/sb-collap">
                      {t("shell.navigation.projects")}
                      <ChevronDown className="size-3.5 opacity-0 transition-[transform,opacity] duration-200 group-hover/sb-collap:opacity-100 group-focus-visible/sb-collap:opacity-100 data-[state=open]:rotate-0 [[data-state=closed]_&]:rotate-[-90deg] [[data-state=closed]_&]:opacity-100" />
                    </CollapsibleTrigger>
                    {<SidebarHeaderMenu
                      ariaLabel={t("shell.organize.organizeProjects")}
                      includeOrganize={true}
                      sortLabel={t("shell.organize.sortChatsBy")}
                      sortValue={chatSort}
                      onSortChange={setChatSort}
                      organizeBy={organizeBy}
                      onOrganizeByChange={setOrganizeBy}
                    />}
                    <button
                      type="button"
                      aria-label="New project"
                      onClick={() => {
                        setProjectCreateMoveTarget(null);
                        setCreatingProject(true);
                      }}
                      className="sidebar-header-action"
                    >
                      <HugeiconsIcon
                        icon={PlusSignIcon}
                        strokeWidth={1.75}
                        className="size-icon"
                      />
                    </button>
                  </SidebarGroupLabel>
                  <CollapsibleContent>
                    <SidebarGroupContent className={scrollRowPadding}>
                      <SidebarMenu>
                        {visibleProjectRecords.map((project, projectIndex) => {
                          const projectChats =
                            sortedChatsByProjectId.get(project.id) ?? [];
                          const projectChatIds =
                            projectChatRowIds.get(project.id) ?? [];
                          const expanded = !collapsedProjectIds.has(project.id);
                          const showAll = expandedChatProjectIds.has(
                            project.id,
                          );
                          const visibleChats =
                            expanded && !showAll
                              ? projectChats.slice(0, PROJECT_CHAT_LIMIT)
                              : projectChats;
                          const isProjectPinned = pinnedProjectIdSet.has(
                            project.id,
                          );
                          return (
                            <Fragment key={project.id}>
                              {/* Folders drag to reorder whatever the chat sort is. */}
                              <ContextMenu>
                                <ContextMenuTrigger asChild>
                                  <SidebarMenuItem
                                    className={cn(
                                      "group/recent-item relative",
                                      draggingRow?.id === project.id &&
                                        "opacity-50",
                                      dropCueClass(
                                        PROJECT_ORDER_SCOPE,
                                        projectRowIds,
                                        project.id,
                                      ),
                                    )}
                                    onContextMenu={() =>
                                      selectProjectForContextMenu(project.id)
                                    }
                                    {...rowDragProps(
                                      PROJECT_ORDER_SCOPE,
                                      projectRowIds,
                                      project.id,
                                    )}
                                  >
                                    <SidebarMenuButton
                                      // Highlight the folder only on the project home; with a chat open, only that row is active.
                                      isActive={
                                        activeProjectId === project.id &&
                                        !activeThreadId
                                      }
                                      data-selected={
                                        selectedProjectIds.has(project.id)
                                          ? "true"
                                          : undefined
                                      }
                                      onClick={(event) => {
                                        if (
                                          handleProjectSelectionClick(
                                            event,
                                            project.id,
                                          )
                                        )
                                          return;
                                        clearSelection();
                                        toggleProjectCollapsed(project.id);
                                      }}
                                      className="sidebar-nav-btn h-[33px] rounded-full gap-[8.5px] pl-3 pr-2.5 font-medium group-hover/recent-item:pr-16 group-has-[.sidebar-row-action[data-state=open]]/recent-item:pr-8 [@media(pointer:coarse)]:pr-16"
                                    >
                                      <HugeiconsIcon
                                        icon={Folder01Icon}
                                        strokeWidth={1.75}
                                        className="size-icon! shrink-0"
                                      />
                                      <span className="truncate text-ui-14p5 leading-ui-19 tracking-nav">
                                        {project.name}
                                      </span>
                                    </SidebarMenuButton>
                                    {/* New chat in this project */}
                                    <button
                                      type="button"
                                      aria-label={t("shell.navigation.newChat")}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openNewChat(project.id);
                                      }}
                                      className="sidebar-row-action sidebar-touch-reveal is-unpin-action group-hover/recent-item:opacity-100 group-hover/recent-item:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto"
                                    >
                                      <span className="sidebar-row-action-glyph">
                                        <HugeiconsIcon
                                          icon={PencilEdit02Icon}
                                          strokeWidth={1.75}
                                          className="size-icon"
                                        />
                                      </span>
                                    </button>
                                    {/* Project options */}
                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <button
                                          type="button"
                                          onClick={(e) => e.stopPropagation()}
                                          aria-label={t(
                                            "shell.navigation.projectOptions",
                                          )}
                                          className="sidebar-row-action sidebar-touch-reveal group-hover/recent-item:opacity-100 group-hover/recent-item:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto"
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
                                        <DropdownMenuItem
                                          onSelect={() =>
                                            openProject(project.id)
                                          }
                                        >
                                          <HugeiconsIcon
                                            icon={Folder01Icon}
                                            strokeWidth={1.75}
                                            className="size-icon"
                                          />
                                          <span>
                                            {t("shell.navigation.projectHome")}
                                          </span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onSelect={() =>
                                            openNewChat(project.id)
                                          }
                                        >
                                          <HugeiconsIcon
                                            icon={PencilEdit02Icon}
                                            strokeWidth={1.75}
                                            className="size-icon"
                                          />
                                          <span>
                                            {t("shell.navigation.newChat")}
                                          </span>
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          onSelect={() => {
                                            // Seed the shared draft so the dialog opens with the current name, not stale text.
                                            setRenameDraft(project.name);
                                            setRenamingTarget({
                                              kind: "project",
                                              project,
                                              current: project.name,
                                            });
                                          }}
                                        >
                                          <HugeiconsIcon
                                            icon={Edit03Icon}
                                            strokeWidth={1.75}
                                            className="size-icon"
                                          />
                                          <span>
                                            {t(
                                              "shell.navigation.renameProject",
                                            )}
                                          </span>
                                        </DropdownMenuItem>
                                        {renderMoveRowItems(
                                          PROJECT_ORDER_SCOPE,
                                          projectRowIds,
                                          project.id,
                                          projectIndex,
                                        )}
                                        <DropdownMenuItem
                                          onSelect={() =>
                                            toggleProjectPin(project.id)
                                          }
                                        >
                                          <HugeiconsIcon
                                            icon={
                                              isProjectPinned
                                                ? PinOffIcon
                                                : PinIcon
                                            }
                                            strokeWidth={1.75}
                                            className="size-icon"
                                          />
                                          <span>
                                            {t(
                                              isProjectPinned
                                                ? "shell.navigation.unpinProject"
                                                : "shell.navigation.pinProject",
                                            )}
                                          </span>
                                        </DropdownMenuItem>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          variant="destructive"
                                          onSelect={() => {
                                            // Start each delete with the file toggle off: Cancel closes programmatically and skips the
                                            openDeleteDialog({
                                              kind: "project",
                                              project,
                                            });
                                          }}
                                        >
                                          <HugeiconsIcon
                                            icon={Delete02Icon}
                                            strokeWidth={1.75}
                                            className="size-icon"
                                          />
                                          <span>
                                            {t(
                                              "shell.navigation.deleteProject",
                                            )}
                                          </span>
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </SidebarMenuItem>
                                </ContextMenuTrigger>
                                <ProjectContextMenu
                                  projectSelectionCount={projectSelectionCount}
                                  allSelectedProjectsPinned={allSelectedProjectsPinned}
                                  onPinSelectedProjects={pinSelectedProjects}
                                  onDeleteSelectedProjects={deleteSelectedProjects}
                                />
                              </ContextMenu>
                              {expanded &&
                                visibleChats.map((chat, index) =>
                                  renderChatSidebarItem(
                                    chat,
                                    "project",
                                    manualDragEnabled
                                      ? {
                                          scope: projectOrderScope(project.id),
                                          orderedIds: projectChatIds,
                                          index,
                                        }
                                      : undefined,
                                    {
                                      scope: projectOrderScope(project.id),
                                      ids: projectChatIds,
                                    },
                                  ),
                                )}
                              {expanded &&
                                projectChats.length > PROJECT_CHAT_LIMIT && (
                                  <SidebarMenuItem>
                                    <SidebarMenuButton
                                      onClick={() =>
                                        toggleProjectShowAll(project.id)
                                      }
                                      // Force the muted token: .sidebar-nav-btn's own color rule outweighs a plain text utility,
                                      // so Show more would otherwise match the chat rows.
                                      className="sidebar-nav-btn h-[30px] rounded-full pl-9 pr-4 font-medium text-nav-fg-muted!"
                                    >
                                      <span className="text-ui-13 leading-ui-18 tracking-nav">
                                        {t(
                                          showAll
                                            ? "shell.navigation.showLess"
                                            : "shell.navigation.showMore",
                                        )}
                                      </span>
                                    </SidebarMenuButton>
                                  </SidebarMenuItem>
                                )}
                            </Fragment>
                          );
                        })}
                        {/* Long project lists stay one row deep until asked. */}
                        {sidebarProjectRecords.length >
                          SIDEBAR_PROJECT_LIMIT && (
                          <SidebarMenuItem>
                            <SidebarMenuButton
                              onClick={() =>
                                setShowAllProjects((prev) => !prev)
                              }
                              className="sidebar-nav-btn h-[30px] rounded-full pl-3 pr-4 font-medium text-nav-fg-muted!"
                            >
                              <span className="text-ui-13 leading-ui-18 tracking-nav">
                                {t(
                                  showAllProjects
                                    ? "shell.navigation.showLess"
                                    : "shell.navigation.showMore",
                                )}
                              </span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        )}
                      </SidebarMenu>
                    </SidebarGroupContent>
                  </CollapsibleContent>
                </SidebarGroup>
              </Collapsible>
            )}

          {!isStudioRoute && !showTrainingRecents && (
            <Collapsible open={chatOpen} onOpenChange={setChatOpen} asChild>
              <SidebarGroup className="group-data-[collapsible=icon]:hidden px-0 py-0">
                <SidebarGroupLabel
                  className={cn(
                    "sidebar-sticky-label sidebar-sticky-label-following group/sidebar-header gap-1",
                    scrolled && "is-scrolled",
                    usesDesktopTitlebar && "translate-x-[2px]",
                  )}
                >
                  <CollapsibleTrigger className="cursor-pointer flex min-w-0 flex-1 items-center gap-1 group/sb-collap">
                    {t("shell.navigation.recents")}
                    <ChevronDown className="size-3.5 opacity-0 transition-[transform,opacity] duration-200 group-hover/sb-collap:opacity-100 group-focus-visible/sb-collap:opacity-100 data-[state=open]:rotate-0 [[data-state=closed]_&]:rotate-[-90deg] [[data-state=closed]_&]:opacity-100" />
                  </CollapsibleTrigger>
                  {<SidebarHeaderMenu
                    ariaLabel={t("shell.organize.organizeChats")}
                    includeOrganize={true}
                    sortLabel={t("shell.organize.sortChatsBy")}
                    sortValue={chatSort}
                    onSortChange={setChatSort}
                    organizeBy={organizeBy}
                    onOrganizeByChange={setOrganizeBy}
                  />}
                  {/* Starts a chat outside any project, whatever page is open. */}
                  <button
                    type="button"
                    aria-label={t("shell.navigation.newChat")}
                    onClick={() => openNewChat(null)}
                    className="sidebar-header-action"
                  >
                    <HugeiconsIcon
                      icon={PencilEdit02Icon}
                      strokeWidth={1.75}
                      className="size-icon"
                    />
                  </button>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent className={scrollRowPadding}>
                    <SidebarMenu>
                      {sortedRecentChatItems.map((item, index) =>
                        renderChatSidebarItem(
                          item,
                          "recent",
                          manualDragEnabled
                            ? {
                                scope: RECENTS_ORDER_SCOPE,
                                orderedIds: recentRowIds,
                                index,
                              }
                            : undefined,
                          { scope: RECENTS_ORDER_SCOPE, ids: recentRowIds },
                        ),
                      )}
                    </SidebarMenu>
                    {/* "No chats yet" only when there is truly no history:
                      project-scoped and archived threads leave Recents empty
                      but still count as existing chats. */}
                    {chatItemsLoaded &&
                      allChatItems.length === 0 &&
                      archivedChatItems.length === 0 && (
                        <p className="px-3 py-2 text-xs text-muted-foreground">
                          {t("shell.navigation.noChatsYet")}
                        </p>
                      )}
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          )}
        </SidebarContent>

        <SidebarUserFooter
          rowPadding={rowPadding}
          showUpdateCard={showUpdateCard}
          canScrollDown={canScrollDown}
          updateVersion={updateVersion}
          displayTitle={displayTitle}
          avatarDataUrl={avatarDataUrl}
          settingsShortcutLabel={settingsShortcutLabel}
          sidebarMenu={sidebarMenu}
          pathname={pathname}
          isDark={isDark}
          toggleTheme={toggleTheme}
          anchorRef={anchorRef}
          isTauri={isTauri}
          closeMobileIfOpen={closeMobileIfOpen}
          onOpenShutdown={() => setShutdownOpen(true)}
        />
      </Sidebar>
      <ChatSearchDialog />
      {!isTauri && (
        <ShutdownDialog open={shutdownOpen} onOpenChange={setShutdownOpen} />
      )}
      <SidebarDialogs
        confirmingDelete={confirmingDelete}
        onConfirmingDeleteChange={setConfirmingDelete}
        deleteFilesOnDelete={deleteFilesOnDelete}
        onDeleteFilesOnDeleteChange={setDeleteFilesOnDelete}
        onCommitDelete={commitDelete}
        renamingTarget={renamingTarget}
        onRenamingTargetChange={setRenamingTarget}
        renameDraft={renameDraft}
        onRenameDraftChange={setRenameDraft}
        onCommitRename={commitRename}
        renameDirty={renameDirty}
        creatingProject={creatingProject}
        onCreatingProjectChange={setCreatingProject}
        projectCreateMoveTarget={projectCreateMoveTarget}
        onAfterCreateProject={afterCreateProject}
      />
    </>
  );
}
