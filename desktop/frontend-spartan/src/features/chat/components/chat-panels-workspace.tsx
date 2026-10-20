import { createContext, Fragment, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type MutableRefObject } from "react";
import { useAui, useAuiState, type ThreadMessage } from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import { Button } from "@/components/ui/button";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { GripVerticalIcon, MoreHorizontalIcon, XIcon } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { useIsMobile } from "@/hooks/use-mobile";
import { getLocale, useT } from "@/i18n";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { ChatRuntimeProvider } from "../runtime-provider";
import { useChatRuntimeStore } from "../stores/chat-runtime-store";
import { useExternalProvidersStore } from "../stores/external-providers-store";
import { CHAT_PANE_MIME, CHAT_PANE_OPEN_EVENT, useChatPanelsStore, type ChatPane } from "../stores/chat-panels-store";
import { deleteStoredChatThreads, getStoredChatThread, saveStoredChatThread, saveStoredChatMessage } from "../utils/chat-history-storage";
import { snapshotQueuedChatRunSettings, type QueuedChatRunSettings } from "../utils/queued-chat-run-settings";
import { sanitizeThreadScopedSettings, THREAD_SCOPED_PARAM_KEYS } from "../utils/thread-scoped-settings";
import { copyPaneContext } from "../utils/pane-context";
import { CHAT_HISTORY_UPDATED_EVENT } from "../api/modules/base";
import { isChatThreadDeleted } from "../utils/chat-thread-tombstones";
import { chatHistoryClearBoundary } from "../utils/chat-history-clear-boundary";
import { parseExternalModelId, externalModelSupportsStudioTools } from "../external-providers";
import { getExternalReasoningCapabilities } from "../provider-capabilities";
import { PaneComposer } from "./pane-composer";
import type { ThreadRecord } from "../types";

type Actions = {
  busy: boolean;
  add: () => void;
  copy: (messages: readonly ThreadMessage[], sourceId?: string) => void;
};
const ActionsContext = createContext<Actions | null>(null);

export function ChatPaneToolbar({ sourceId, paneId, onClose }: { sourceId?: string; paneId?: string; onClose?: () => void }) {
  const actions = useContext(ActionsContext);
  const runtime = useAui().thread();
  const t = useT();
  const running = useAuiState(({ thread }) => thread.isRunning);
  const loading = useAuiState(({ thread }) => thread.isLoading);
  const empty = useAuiState(({thread}) => thread.isEmpty);
  const title = useAuiState(({threadListItem}) => threadListItem.title);
  const panelCount = useChatPanelsStore(state => state.panes.length);
  if (!actions || (!paneId && !panelCount)) return null;
  return <div className="chat-pane-header flex h-10 min-h-10 shrink-0 items-center gap-1 border-b px-3" data-chat-pane-header>
    {paneId && <button type="button" className="cursor-grab touch-none rounded p-1 text-muted-foreground active:cursor-grabbing" aria-label={t("chat.panels.move")} draggable onDragStart={event => {event.dataTransfer.setData("application/x-spartan-chat-pane", paneId); event.dataTransfer.effectAllowed = "move";}}><GripVerticalIcon className="size-4" /></button>}
    <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground" title={title ?? undefined}>{empty ? t("chat.panels.chat") : title || t("chat.panels.primary")}</span>
    <DropdownMenu><DropdownMenuTrigger asChild><TooltipIconButton type="button" tooltip={t("chat.panels.actions")} aria-label={t("chat.panels.actions")} variant="ghost" className="size-7 rounded-full"><MoreHorizontalIcon className="size-4" /></TooltipIconButton></DropdownMenuTrigger>
      <DropdownMenuContent align="end"><DropdownMenuGroup>
        <DropdownMenuItem disabled={actions.busy || running || loading || empty} onSelect={() => actions.copy(runtime.getState().messages, sourceId)}>{t("chat.panels.copy")}</DropdownMenuItem>
      </DropdownMenuGroup></DropdownMenuContent>
    </DropdownMenu>
    {onClose && <TooltipIconButton type="button" tooltip={t("chat.panels.close")} aria-label={t("chat.panels.close")} disabled={running} variant="ghost" className="size-7 rounded-full" onClick={onClose}><XIcon className="size-4" /></TooltipIconButton>}
  </div>;
}

function initialSettings(thread: ThreadRecord): QueuedChatRunSettings {
  const settings = snapshotQueuedChatRunSettings(useChatRuntimeStore.getState());
  const stored = sanitizeThreadScopedSettings(thread.settings) ?? {};
  for (const [key, value] of Object.entries(stored)) {
    if ((THREAD_SCOPED_PARAM_KEYS as readonly string[]).includes(key)) Object.assign(settings.params, { [key]: value });
    else Object.assign(settings, { [key]: value });
  }
  settings.params.checkpoint = thread.modelId || settings.params.checkpoint;
  // A new engine never inherits approvals or an in-progress research session.
  settings.permissionMode = "ask";
  settings.confirmToolCalls = true;
  settings.bypassPermissions = false;
  settings.deepResearchEnabled = false;
  return settings;
}

function PaneBody({ pane, settings }: { pane: ChatPane; settings: MutableRefObject<QueuedChatRunSettings> }) {
  return <>
    <ChatPaneToolbar sourceId={pane.thread.id} paneId={pane.id} onClose={() => useChatPanelsStore.getState().close(pane.id)} />
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden"><Thread targetThreadId={pane.thread.id} composer={<PaneComposer pane={pane} settings={settings} />} /></div>
  </>;
}

function IndependentPane({ pane }: { pane: ChatPane }) {
  const settings = useRef<QueuedChatRunSettings>(initialSettings(pane.thread));
  const getRunSettings = useCallback(() => {
    const snapshot = structuredClone(settings.current);
    const selection = parseExternalModelId(snapshot.params.checkpoint);
    const provider = useExternalProvidersStore.getState().providers.find(row => row.id === selection?.providerId);
    if (provider && selection) {
      snapshot.supportsTools = externalModelSupportsStudioTools(snapshot.params.checkpoint);
      Object.assign(snapshot, getExternalReasoningCapabilities(provider.providerType, selection.modelId));
    }
    return snapshot;
  }, []);
  return <ChatRuntimeProvider modelType="base" pairId={`pane:${pane.id}`} initialThreadId={pane.thread.id} projectId={pane.thread.projectId} syncActiveThreadId={false} listThreads={false} getRunSettings={getRunSettings}>
    <PaneBody pane={pane} settings={settings} />
  </ChatRuntimeProvider>;
}

export function ChatPanelsWorkspace({ children, primaryThreadId, projectId }: { children: ReactNode; primaryThreadId?: string; projectId?: string | null }) {
  const panes = useChatPanelsStore(state => state.panes);
  const focusedId = useChatPanelsStore(state => state.focusedId);
  const restoringLayout = useChatPanelsStore(state => state.restoringLayout);
  const pendingRestoreCount = useChatPanelsStore(state => state.pendingRestoreIds.length);
  const incognito = useChatRuntimeStore(state => state.incognito);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [dragging, setDragging] = useState(false);
  const mobile = useIsMobile();
  const t = useT();
  const duplicatePrimary = panes.find(pane => pane.thread.id === primaryThreadId);
  const primary = useRef(primaryThreadId);
  primary.current = primaryThreadId;
  const restoreLayout = useCallback(() => {
    if (!useChatRuntimeStore.getState().incognito) void useChatPanelsStore.getState().restoreLayout(id => getStoredChatThread(id, { waitForWrites: true }));
  }, []);
  useEffect(() => {
    if (!incognito) restoreLayout();
    window.addEventListener("online", restoreLayout);
    return () => window.removeEventListener("online", restoreLayout);
  }, [incognito, restoreLayout]);
  const open = useCallback(async (id: string) => {
    try {
      if (useChatRuntimeStore.getState().incognito) { toast.info(t("chat.panels.incognito")); return; }
      if (id === primary.current || id === useChatRuntimeStore.getState().activeThreadId) { useChatPanelsStore.getState().focus(null); return; }
      const thread = await getStoredChatThread(id, { waitForWrites: true });
      if (!thread || thread.archived || thread.pairId) throw new Error(t("chat.panels.unavailable"));
      if (!useChatPanelsStore.getState().open(thread)) toast.info(t("chat.panels.limit"));
    } catch (cause) { toast.error(cause instanceof Error ? cause.message : t("chat.panels.failed")); }
  }, [t]);
  useEffect(() => {
    useChatPanelsStore.setState({ workspaceMounted: true });
    const pending = useChatPanelsStore.getState().requestedThreadId;
    if (pending) { useChatPanelsStore.setState({ requestedThreadId: null }); void open(pending); }
    const listener = (event: Event) => {
      const id = (event as CustomEvent).detail;
      if (typeof id === "string" && id.length < 200) {
        useChatPanelsStore.setState({ requestedThreadId: null }); void open(id);
      }
    };
    window.addEventListener(CHAT_PANE_OPEN_EVENT, listener);
    return () => { window.removeEventListener(CHAT_PANE_OPEN_EVENT, listener); useChatPanelsStore.setState({ workspaceMounted: false }); };
  }, [open]);
  useEffect(() => {
    const generation = chatHistoryClearBoundary.capture();
    const reconcile = () => {
      for (const pane of useChatPanelsStore.getState().panes) {
        if (chatHistoryClearBoundary.capture() !== generation || isChatThreadDeleted(pane.thread.id)) useChatPanelsStore.getState().close(pane.id);
      }
    };
    window.addEventListener(CHAT_HISTORY_UPDATED_EVENT, reconcile);
    return () => window.removeEventListener(CHAT_HISTORY_UPDATED_EVENT, reconcile);
  }, []);
  const create = async (messages?: readonly ThreadMessage[], sourceId?: string) => {
    if (lock.current) return;
    if (panes.length >= 3) { toast.info(t("chat.panels.limit")); return; }
    if (useChatRuntimeStore.getState().incognito) { toast.info(t("chat.panels.incognito")); return; }
    lock.current = true; setBusy(true);
    const id = crypto.randomUUID();
    let saved = false;
    try {
      const source = sourceId ? await getStoredChatThread(sourceId) : undefined;
      const records = messages ? copyPaneContext(messages, id, undefined, undefined, getLocale()) : [];
      if (messages && !records.length) throw new Error(t("chat.panels.empty"));
      const thread: ThreadRecord = {
        id, title: messages ? `${t("chat.panels.contextTitle")}: ${source?.title ?? t("chat.panels.chat")}` : t("chat.panels.chat"),
        modelType: "base", modelId: source?.modelId || useChatRuntimeStore.getState().params.checkpoint,
        projectId: source?.projectId ?? projectId ?? null, archived: false, createdAt: Date.now(),
        settings: { ...source?.settings, permissionMode: "ask", deepResearchEnabled: false },
        ...(source ? { forkedFromThreadId: source.id, forkedFromMessageId: messages?.at(-1)?.id } : {}),
      };
      await saveStoredChatThread(thread); saved = true;
      for (const record of records) await saveStoredChatMessage(record);
      if (!useChatPanelsStore.getState().open(thread)) throw new Error(t("chat.panels.limit"));
      if (messages) toast.info(t("chat.panels.copied"));
    } catch (cause) {
      if (saved) await deleteStoredChatThreads([id]).catch(() => {});
      toast.error(cause instanceof Error ? cause.message : t("chat.panels.failed"));
    } finally { lock.current = false; setBusy(false); }
  };
  const createRef = useRef(create);
  createRef.current = create;
  useEffect(() => {
    const add = () => void createRef.current();
    window.addEventListener("spartan:new-chat-pane", add);
    return () => window.removeEventListener("spartan:new-chat-pane", add);
  }, []);
  return <ActionsContext.Provider value={{ busy, add: () => void create(), copy: (messages, sourceId) => void create(messages, sourceId) }}>
    <div data-inline-pane-headers={panes.length > 0 && !mobile ? "true" : undefined} className={cn("chat-panels-workspace relative flex min-h-0 min-w-0 flex-1 flex-col", (!panes.length || mobile) && "pt-[var(--studio-chat-header-height,48px)]")} onDragOver={event => {
      if (!event.dataTransfer.types.includes(CHAT_PANE_MIME)) return;
      event.preventDefault(); event.dataTransfer.dropEffect = "copy"; setDragging(true);
    }} onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false); }} onDrop={event => {
      if (!event.dataTransfer.types.includes(CHAT_PANE_MIME)) return;
      event.preventDefault(); setDragging(false); const id = event.dataTransfer.getData(CHAT_PANE_MIME); if (id && id.length < 200) void open(id);
    }}>
      {restoringLayout ? <div role="status" className="flex shrink-0 items-center justify-center gap-2 p-2 text-sm"><Spinner />{t("chat.panels.restoring")}</div> : pendingRestoreCount > 0 && <div role="status" className="flex shrink-0 flex-wrap items-center justify-center gap-2 p-2 text-sm">
        <span>{t("chat.panels.restorePending")}</span><Button size="sm" variant="outline" onClick={restoreLayout}>{t("chat.panels.retryRestore")}</Button>
      </div>}
      {mobile && panes.length > 0 && <Tabs value={focusedId ?? "primary"} onValueChange={id => useChatPanelsStore.getState().focus(id === "primary" ? null : id)} className="shrink-0 p-2">
        <TabsList aria-label={t("chat.panels.title")} className="h-auto max-w-full flex-wrap">
          <TabsTrigger value="primary">{t("chat.panels.primary")}</TabsTrigger>
          {panes.map(pane => <TabsTrigger key={pane.id} value={pane.id} className="max-w-40 truncate">{pane.thread.title}</TabsTrigger>)}
        </TabsList>
      </Tabs>}
      <ResizablePanelGroup orientation="horizontal" className={cn("min-h-0 flex-1", mobile && "chat-panels-mobile")}>
        <ResizablePanel id="primary-chat" minSize="20%" data-pane-hidden={mobile && focusedId !== null ? "true" : undefined} className="flex min-h-0 flex-col">
          {duplicatePrimary && <Button variant="outline" size="sm" onClick={() => useChatPanelsStore.getState().focus(duplicatePrimary.id)}>{t("chat.panels.alreadyOpen")}</Button>}
          <div inert={Boolean(duplicatePrimary)} className="flex min-h-0 flex-1 flex-col">{children}</div>
        </ResizablePanel>
        {panes.map(pane => <Fragment key={pane.id}>
          {!mobile && <ResizableHandle withHandle className="chat-pane-resize-handle" aria-label={t("chat.panels.resize")} />}
          <ResizablePanel id={pane.id} minSize={mobile ? "0%" : "20%"} data-pane-hidden={mobile && focusedId !== pane.id ? "true" : undefined} data-pane-last={pane.id === panes.at(-1)?.id ? "true" : undefined} data-chat-pane-id={pane.id} className={cn("flex min-h-0 flex-col", focusedId === pane.id && "ring-1 ring-inset ring-border")} onFocusCapture={() => useChatPanelsStore.getState().focus(pane.id)} onDragOver={event => {
            if (!event.dataTransfer.types.includes("application/x-spartan-chat-pane")) return;
            event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = "move";
          }} onDrop={event => {
            if (!event.dataTransfer.types.includes("application/x-spartan-chat-pane")) return;
            event.preventDefault(); event.stopPropagation();
            const box = event.currentTarget.getBoundingClientRect();
            useChatPanelsStore.getState().move(event.dataTransfer.getData("application/x-spartan-chat-pane"), pane.id, event.clientX > box.left + box.width / 2);
          }}>
            <IndependentPane pane={pane} />
          </ResizablePanel>
        </Fragment>)}
      </ResizablePanelGroup>
      {dragging && <div className="pointer-events-none absolute inset-2 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-background/90" role="status">{t("chat.panels.drop")}</div>}
    </div>
  </ActionsContext.Provider>;
}
