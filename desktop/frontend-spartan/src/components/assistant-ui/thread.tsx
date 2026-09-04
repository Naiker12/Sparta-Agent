import {
  ComposerAttachments,
  UserMessageAttachments,
} from "@/components/assistant-ui/attachment";
import {
  GeneratedImageOverlayProvider,
  useGeneratedImageOverlay,
} from "@/components/assistant-ui/generated-image-overlay-context";
import { downloadImagePart } from "@/components/assistant-ui/image";
import { threadHasResearchMessage } from "@/components/assistant-ui/thread-research-presence";
import { ChatDictationBar } from "@/components/assistant-ui/chat-dictation-bar";
import {
  PROMPT_QUEUE_DRAG_TYPE,
  hasPendingPromptQueueStart,
  isPastedTextFile,
  isPromptQueueChord,
  isPromptQueueDragTypes,
  pastedTextQueueKey,
  promptQueueActiveItemChanged,
  reorderPromptQueueItems,
  pasteClipboardFiles,
  extractYoutubeVideoId,
  pasteLongTextAsFile,
  isStudioDictationAvailable,
  notifyStudioDictationUnavailable,
  YoutubeTranscriptPrompt,
} from "@/features/chat";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import {
  IntentAwareScrollProvider,
  useIntentAwareAutoScroll,
  useIsThreadAtBottom,
  useScrollThreadToBottom,
} from "@/components/assistant-ui/use-intent-aware-autoscroll";
import { Button } from "@/components/ui/button";
import {
  GeneratedAvatar,
  ThinkingAvatar,
} from "@/components/ui/blobatar-avatar";
import { publicAssetUrl } from "@/components/mascot-img";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { resolveProjectId } from "@/features/chat/api/chat-adapter";
import {
  PromptStorageDialog,
  exportConversationShareGPT,
  exportConversationRawJsonl,
  exportConversationCsv,
  exportConversationMarkdown,
} from "@/features/chat/prompt-storage/prompt-storage-dialog";
import {
  listPromptEntries,
  type PromptEntry,
} from "@/features/chat/api/prompts-api";
import { useChatPreferencesStore } from "@/features/chat/stores/chat-preferences-store";
import {
  createChatProject,
  getDroppedNativePath,
  setChatProjectWorkspace,
  useChatProjects,
} from "@/features/chat/hooks/use-chat-projects";
import { NewProjectDialog } from "@/features/chat/components/new-project-dialog";

import {
  DeepResearchComposerButton,
  DeepResearchWebsiteAccessDialog,
} from "@/features/chat/components/deep-research-composer-button";
import {
  type NativeIntent,
  useNativeAttachmentTargetKey,
  useNativeIntentStore,
} from "@/features/native-intents";
import { nativeAttachmentIntentToFile } from "@/features/native-intents/native-attachment-file";
import { cancelResearchRun } from "@/features/chat/api/research-api";
import {
  ingestResearchUpdate,
  useResearchRunStore,
} from "@/features/chat/stores/research-run-store";
import {
  parseExternalModelId,
  providerModelSupportsStudioTools,
} from "@/features/chat/external-providers";
import { toolStatusKind } from "@/features/chat/utils/tool-status";

import { McpComposerButton } from "@/features/chat/mcp-composer-button";
import { ComposerMentions } from "@/features/chat/composer-mentions";
import { getExternalReasoningCapabilities } from "@/features/chat/provider-capabilities";
import { useRagToolDisabled } from "@/features/chat/hooks/use-rag-tool-disabled";
import { BypassPermissionsMenuItem } from "@/features/chat/bypass-permissions-menu-item";
import { PermissionModeComposerPill } from "@/features/chat/permission-mode-select";
import { ThreadWorkspaceChip } from "@/features/chat/components/thread-workspace-chip";
import { useChatRuntimeStore } from "@/features/chat/stores/chat-runtime-store";
import { useT, type TranslationKey } from "@/i18n";
import { useExternalProvidersStore } from "@/features/chat/stores/external-providers-store";
import {
  PLUS_MENU_ORDER,
  CONVERSATION_MARKDOWN_LABEL,
  PROMPT_QUEUE_RUN_FAILED_EVENT,
  PROMPT_QUEUE_STOP_EVENT,
  addQueuedChatRunSettingsThreadIds,
  adoptPreStreamRunReservation,
  chatHistoryClearBoundary,
  deleteStoredChatThreads,
  discardQueuedChatRunSettings,
  discardQueuedChatRunSettingsForThread,
  hasPreStreamRunReservation,
  localPromptQueueModelBoundary,
  notifyPromptQueueRunFailed,
  planLocalPromptQueueStop,
  registerQueuedChatRunSettings,
  releasePreStreamRunReservation,
  reservePreStreamRun,
  shouldAbortPendingQueueForModelBoundary,
  shouldAbortPendingQueueForSettingsChange,
  snapshotQueuedChatRunSettings,
  composerDraftKey,
  composerPasteDraftKey,
  createPastedTextFile,
  pastedTextOf,
  readPasteDraft,
  writePasteDraft,
  markThreadIncognito,
  markChatThreadDeleted,
  type PromptQueueRunFailedEventDetail,
  type PromptQueueStopEventDetail,
  dictationFailed,
  dictationProducedTranscript,
  readComposerDraft,
  type PromptQueueUIEntry,
  type PromptQueueUIItem,
  type PromptQueueUIItemStatus,
  type PromptQueueUIState,
  usePromptQueueUI,
  type PlusMenuItemId,
  usePlusMenuPrefsStore,
  writeComposerDraft,
} from "@/features/chat";
import {
  applySentTextGuard,
  armSentTextGuard,
  isGuardRetiringKey,
  markSentTextGuardUserInput,
  sentTextGuardBlocksDraft,
  type SentTextGuard,
} from "@/features/chat/utils/composer-send-guard";
import { updateStoredChatThread } from "@/features/chat/utils/chat-history-storage";
import {
  dictationSendBlocked,
  shouldSubmitDictation,
} from "@/features/chat/utils/dictation-send";
import {
  isRagClientError,
  listProjectDocuments,
  listThreadDocuments,
  projectWorkCount,
} from "@/features/rag/api/rag-api";
import { useRagAvailabilityStore } from "@/features/rag/api/rag-availability";
import { ThreadDocumentsBar } from "@/features/rag/components/thread-documents-bar";
import { KnowledgeBaseComposerButton } from "@/features/rag/components/knowledge-base-composer-button";
import { DocumentPreviewMount } from "@/features/rag/components/document-preview-mount";
import { useUserProfileStore } from "@/features/profile/stores/user-profile-store";
import { usePublishedFrame } from "@/features/settings/hooks/use-published-frame";
import { useVoiceSettingsStore } from "@/features/settings/stores/voice-settings-store";
import { applyQwenThinkingParams } from "@/features/chat/utils/qwen-params";
import { isTauri } from "@/lib/api-base";
import { MicIcon } from "@/lib/mic-icon";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  AuiIf,
  ComposerPrimitive,
  ThreadPrimitive,
  useAui,
  useAuiEvent,
  useAuiState,
} from "@assistant-ui/react";
import { flushResourcesSync } from "@assistant-ui/tap";
import {
  AttachmentIcon,
  BubbleChatTemporaryIcon,
  Download01Icon,
  FileDatabaseIcon,
  Folder01Icon,
  FolderAddIcon,
  Image03Icon,
  McpServerIcon,
  PencilRulerIcon,
  Telescope02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Columns2Icon,
  GlobeIcon,
  PlusIcon,
  SquareIcon,
  TerminalIcon,
  XIcon,
} from "lucide-react";
import {
  type ChangeEvent,
  type CompositionEvent,
  type ClipboardEvent,
  type FC,
  type KeyboardEvent,
  type DragEvent as ReactDragEvent,
  type ReactNode,
  Fragment,
  createContext,
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { updateStoredChatThread as _updateStoredChatThread } from "@/features/chat/utils/chat-history-storage";
import { useComposerPillFit } from "@/hooks/use-composer-pill-fit";
import { useIsMobile } from "@/hooks/use-mobile";

// True while a file is dragged anywhere over the chat page, so the composer
// can show its "Drop files here" affordance.
const PageDragContext = createContext(false);

// The page owns model inventory and loading. The composer only owns message
// entry, so receive the already-controlled selector as a visual slot instead
// of creating a second picker with a second source of truth.
const ChatComposerModelSelectorContext = createContext<ReactNode>(null);

/** Extract one absolute path from a paste without treating ordinary prose as a path. */
function extractAbsoluteFolderPath(value: string): string | null {
  const match = value.match(
    /(?:^|[\s"'])([A-Za-z]:[\\/][^\r\n"']+|\/(?:Users|home|mnt|var|opt|tmp)\/[^\r\n\s"']+)/,
  );
  if (!match?.[1]) return null;
  // A common chat phrasing is "D:\\project what is this?". Keep the folder
  // portion instead of making the question part of the local path.
  const withoutQuestion = match[1].replace(
    /\s+(?:de\s+qu[eé]\s+se\s+trata|qu[eé]\s+es|que\s+es|what\s+is|how\s+does|por\s+favor)\b.*$/i,
    "",
  );
  return withoutQuestion.replace(/[),.;:!?]+$/, "").trim() || null;
}

function droppedFolderPath(dataTransfer: DataTransfer): string | null {
  for (const item of Array.from(dataTransfer.items)) {
    const entry = (
      item as DataTransferItem & {
        webkitGetAsEntry?: () => { isDirectory: boolean } | null;
      }
    ).webkitGetAsEntry?.();
    if (!entry?.isDirectory) continue;
    const file = item.getAsFile();
    if (file) return getDroppedNativePath(file);
  }
  return null;
}

export const ChatComposerModelSelectorProvider: FC<{
  selector: ReactNode;
  children: ReactNode;
}> = ({ selector, children }) => (
  <ChatComposerModelSelectorContext.Provider value={selector}>
    {children}
  </ChatComposerModelSelectorContext.Provider>
);

import {
  type PromptQueueTarget,
  type PromptQueueItem,
  type PromptQueueRun,
  type PromptQueueCallbacks,
  PromptQueueContext,
  startPromptQueue,
  stopPromptQueueRunForThreadIds,
  findPromptQueueEntry,
  cancelPendingPromptQueueFactoriesForStop,
  compactIds,
  syncPromptQueueUI,
  appendTextToThread,
  PromptQueueStack,
  ReasoningToggle,
  WebSearchToggle,
  CodeToolsToggle,
  ImagesToggle,
  ArtifactsToggle,
  ToolStatusDisplay,
  ComposerToolsMenu,
  ComposerRightControls,
  COMPOSER_SCROLL_GAP_PX,
  FOOTER_GAP_BELOW_SPACER_PX,
  RUN_SHRINK_WINDOW_MS,
  ThreadComposerDock,
  ThreadScrollToBottom,
  ThreadWelcome,
  PendingAudioChip,
  useImeComposerInputHandlers,
  renderThreadMessage,
  useThreadForkCounts,
} from "./thread/index";


// Memoized: chat-page renders this inline in a store-subscribing component, so a parent render
// would otherwise reconcile the whole message list.
export const Thread: FC<{
  hideComposer?: boolean;
  hideWelcome?: boolean;
  targetThreadId?: string;
}> = memo(({ hideComposer, hideWelcome, targetThreadId }) => {
  // Intent-aware autoscroll replaces assistant-ui's built-in autoscroll to
  // prevent the streaming-mutation race that snaps the viewport back to the
  // bottom while the user scrolls up (see the hook for the full explanation).
  const { ref: viewportRef, context: autoScrollContext } =
    useIntentAwareAutoScroll();

  const isComposerAttachPending = useAuiState(({ threads }) =>
    targetThreadId ? threads.mainThreadId !== targetThreadId : false,
  );
  const runtimeThreadId = useAuiState(
    ({ threadListItem }) => threadListItem.id,
  );
  const activeThreadId = useChatRuntimeStore((s) => s.activeThreadId);
  const incognito = useChatRuntimeStore((s) => s.incognito);
  const t = useT();
  const threadId = targetThreadId ?? activeThreadId ?? null;
  const aui = useAui();
  useThreadForkCounts();

  // Measured height of the floating composer dock (null until measured).
  // Drives the bottom spacer and the scroll-to-bottom footer offset.
  const [composerHeight, setComposerHeight] = useState<number | null>(null);
  const footerBottomPx =
    composerHeight == null
      ? null
      : composerHeight + COMPOSER_SCROLL_GAP_PX - FOOTER_GAP_BELOW_SPACER_PX;

  // Viewport element is owned by the autoscroll hook; mirror it locally for
  // the spacer clamp math. State, not a ref: the keyed provider remounts the
  // viewport on thread switches and the scroll listener must re-attach.
  const [viewportEl, setViewportEl] = useState<HTMLElement | null>(null);
  const composedViewportRef = useCallback(
    (node: HTMLElement | null) => {
      setViewportEl(node);
      viewportRef(node);
    },
    [viewportRef],
  );

  // Bottom spacer sizing. Invariant: chat never moves on its own on composer
  // resize.
  // - Grow (attachment added, multiline): grow at once; growth below the
  //   scroll position is invisible and only adds room.
  // - Shrink (attachment removed): shrinking scrollHeight near the bottom
  //   clamps scrollTop and yanks the chat down. Defer until invisible (user
  //   scrolled up) or a bottom-pinning moment.
  // Applied imperatively so a remounted spacer can be sized from refs even
  // when composerHeight did not change (e.g. thread switch).
  const spacerElRef = useRef<HTMLDivElement | null>(null);
  const desiredSpacerPxRef = useRef<number | null>(null);
  const appliedSpacerPxRef = useRef<number | null>(null);

  const applySpacerPx = useCallback((px: number) => {
    appliedSpacerPxRef.current = px;
    const node = spacerElRef.current;
    if (node) {
      node.style.height = `${px}px`;
    }
  }, []);

  // Release any deferred shrink; used at moments that pin to the bottom
  // anyway, where the clamp is the intended motion.
  const releaseSpacerExcess = useCallback(() => {
    const desired = desiredSpacerPxRef.current;
    const applied = appliedSpacerPxRef.current;
    if (desired != null && applied != null && applied > desired) {
      applySpacerPx(desired);
    }
  }, [applySpacerPx]);

  const spacerRef = useCallback(
    (node: HTMLDivElement | null) => {
      spacerElRef.current = node;
      // Fresh mounts (thread switch, first message) start at desired size;
      // deferral state from a previous mount is moot.
      const desired = desiredSpacerPxRef.current;
      if (node && desired != null) {
        applySpacerPx(desired);
      }
    },
    [applySpacerPx],
  );

  const prevComposerHeightRef = useRef<number | null>(null);
  // Set on thread.runStart; see RUN_SHRINK_WINDOW_MS.
  const runStartAtRef = useRef(0);
  useLayoutEffect(() => {
    const prev = prevComposerHeightRef.current;
    prevComposerHeightRef.current = composerHeight;
    if (composerHeight == null || hideComposer) {
      desiredSpacerPxRef.current = null;
      appliedSpacerPxRef.current = null;
      spacerElRef.current?.style.removeProperty("height");
      return;
    }
    const desired = composerHeight + COMPOSER_SCROLL_GAP_PX;
    desiredSpacerPxRef.current = desired;
    const applied = appliedSpacerPxRef.current;
    if (applied == null || desired >= applied) {
      applySpacerPx(desired);
    } else {
      const distance = viewportEl
        ? viewportEl.scrollHeight -
          viewportEl.scrollTop -
          viewportEl.clientHeight
        : Number.POSITIVE_INFINITY;
      const runOwnsBottom =
        aui.thread().getState().isRunning ||
        performance.now() - runStartAtRef.current < RUN_SHRINK_WINDOW_MS;
      // At the bottom the shrink only drops blank spacer, so apply it now
      // rather than strand dead space until the next pin.
      if (
        runOwnsBottom ||
        distance >= applied - desired ||
        autoScrollContext.getIsAtBottom()
      ) {
        applySpacerPx(desired);
      }
      // else: deferred; released on scroll or a bottom-pinning event.
    }
    if (prev != null && composerHeight > prev) {
      // Chat is now above the new bottom. Detach as if the user scrolled up
      // so no later signal re-pins and shoves the chat up (scrolling back
      // down re-attaches; explicit pins still work). Skip mid-run: that
      // growth is tool-status rows, not the user, and detaching would break
      // streaming autoscroll.
      if (!aui.thread().getState().isRunning) {
        autoScrollContext.detachFromBottom();
      }
    }
  }, [
    composerHeight,
    hideComposer,
    autoScrollContext,
    aui,
    applySpacerPx,
    viewportEl,
  ]);

  // Drop deferred spacer excess once the user has scrolled far enough above
  // the bottom that the shrink cannot clamp scrollTop. Keyed on viewportEl
  // so the listener follows viewport remounts.
  useEffect(() => {
    const el = viewportEl;
    if (!el) {
      return;
    }
    const onScroll = () => {
      const desired = desiredSpacerPxRef.current;
      const applied = appliedSpacerPxRef.current;
      if (desired == null || applied == null || applied <= desired) {
        return;
      }
      const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distance >= applied - desired) {
        applySpacerPx(desired);
      }
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [viewportEl, applySpacerPx]);

  // These pin to the bottom, so releasing the excess here is invisible.
  // runStart also opens the shrink window for the send-clears-chips case.
  useAuiEvent("thread.runStart", () => {
    runStartAtRef.current = performance.now();
    releaseSpacerExcess();
  });
  useAuiEvent("thread.initialize", releaseSpacerExcess);
  useAuiEvent("threadListItem.switchedTo", releaseSpacerExcess);

  // Page-wide drag-and-drop: dropping a file anywhere on the chat page
  // attaches it and shows the composer drop affordance. The composer's own
  // dropzone handles drops on the box and calls preventDefault, so the page
  // handler skips them (no double-add).
  const [pageDragging, setPageDragging] = useState(false);
  const dragDepth = useRef(0);
  const hasFiles = (e: ReactDragEvent) =>
    Array.from(e.dataTransfer?.types ?? []).includes("Files");
  const onDragEnter = (e: ReactDragEvent) => {
    if (isTauri || !hasFiles(e)) return;
    dragDepth.current += 1;
    setPageDragging(true);
  };
  const onDragOver = (e: ReactDragEvent) => {
    if (isTauri || !hasFiles(e)) return;
    e.preventDefault();
  };
  const onDragLeave = (e: ReactDragEvent) => {
    if (isTauri || !hasFiles(e)) return;
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setPageDragging(false);
  };
  const onDrop = (e: ReactDragEvent) => {
    if (isTauri) return;
    dragDepth.current = 0;
    setPageDragging(false);
    const folderPath = droppedFolderPath(e.dataTransfer);
    if (folderPath) {
      window.dispatchEvent(
        new CustomEvent<string>("sparta:workspace-folder-drop", {
          detail: folderPath,
        }),
      );
      e.preventDefault();
      return;
    }
    // Compare panes hide this composer and use the shared composer's own
    // dropzone, so don't capture drops into a hidden composer here.
    if (hideComposer) return;
    // Drops on the composer box are handled by its dropzone (preventDefault);
    // skip those here so the file isn't added twice.
    if (e.defaultPrevented) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length === 0) return;
    e.preventDefault();
    for (const file of files) {
      aui
        .composer()
        .addAttachment(file)
        .catch(() => {
          // Adapter shows its own toast (e.g. "Load a model before adding images").
        });
    }
  };

  return (
    <GeneratedImageOverlayProvider key={runtimeThreadId} threadId={threadId}>
      <PageDragContext.Provider value={pageDragging}>
        <ThreadPrimitive.Root
          className="aui-root aui-thread-root @container relative flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden"
          style={{
            ["--thread-max-width" as string]: "48rem",
            ["--thread-content-max-width" as string]:
              "calc(var(--thread-max-width) - 1.5rem)",
          }}
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <IntentAwareScrollProvider value={autoScrollContext}>
            <ThreadPrimitive.Viewport
              ref={composedViewportRef}
              autoScroll={false}
              scrollToBottomOnRunStart={false}
              scrollToBottomOnInitialize={false}
              scrollToBottomOnThreadSwitch={false}
              className={cn(
                "aui-thread-viewport aui-stream-viewport relative flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-x-auto overflow-y-auto scroll-smooth px-5",
                hideComposer
                  ? "pt-[calc(var(--studio-content-top-inset,0px)+1rem)]"
                  : // + the chat-model notice, which is an opaque absolute bar
                    // directly under the header. 0px whenever it is not showing,
                    // so every other surface keeps the padding it had.
                    "pt-[calc(var(--studio-content-top-inset,0px)+48px+var(--studio-chat-notice-height,0px))]",
              )}
            >
              {!hideWelcome && (
                <AuiIf
                  condition={({ thread }) =>
                    thread.isEmpty && !thread.isLoading
                  }
                >
                  <ThreadWelcome
                    hideComposer={hideComposer}
                    threadId={threadId}
                    composer={<ComposerAnimated threadId={threadId} />}
                  />
                </AuiIf>
              )}

              {hideWelcome && (
                <AuiIf condition={({ thread }) => thread.isEmpty && thread.isLoading}>
                  <div className="flex flex-1 flex-col items-center justify-center py-24 text-muted-foreground animate-in fade-in duration-300">
                    <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent mb-3" />
                    <p className="text-sm font-medium">Cargando conversación...</p>
                  </div>
                </AuiIf>
              )}

              {incognito && (
                <AuiIf
                  condition={({ thread }) => hideWelcome || !thread.isEmpty}
                >
                  <div className="mx-auto my-2 flex w-full max-w-(--thread-max-width) items-center gap-2.5 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2 text-xs text-foreground/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <HugeiconsIcon
                      icon={BubbleChatTemporaryIcon}
                      strokeWidth={2}
                      className="size-4 shrink-0 text-primary"
                    />
                    <div className="flex flex-1 flex-wrap items-center justify-between gap-x-3 gap-y-1">
                      <span className="font-medium text-primary">
                        {t("chat.welcome.temporaryChat")}
                      </span>
                      <span className="text-muted-foreground">
                        {t("chat.welcome.temporaryChatDescription")}
                      </span>
                    </div>
                  </div>
                </AuiIf>
              )}

              <ThreadPrimitive.Messages>
                {renderThreadMessage}
              </ThreadPrimitive.Messages>

              {/* Bottom slack so the last message has room above the sticky
            scroll-to-bottom button (and floating composer in single mode),
            instead of butting against the footer. */}
              <AuiIf condition={({ thread }) => hideWelcome || !thread.isEmpty}>
                <div
                  ref={spacerRef}
                  className={cn(
                    "shrink-0",
                    hideComposer
                      ? "h-16"
                      : composerHeight == null
                        ? "h-40"
                        : undefined,
                  )}
                  aria-hidden={true}
                />
              </AuiIf>

              <AuiIf condition={({ thread }) => hideWelcome || !thread.isEmpty}>
                <ThreadPrimitive.ViewportFooter
                  className={cn(
                    "aui-thread-viewport-footer pointer-events-none sticky z-20 flex w-full justify-center bg-transparent",
                    // 150px (was 140px) to add a small gap above the composer
                    hideComposer
                      ? "bottom-3"
                      : footerBottomPx == null
                        ? "bottom-[150px]"
                        : undefined,
                  )}
                  style={
                    !hideComposer && footerBottomPx != null
                      ? { bottom: footerBottomPx }
                      : undefined
                  }
                >
                  <ThreadScrollToBottom />
                </ThreadPrimitive.ViewportFooter>
              </AuiIf>
            </ThreadPrimitive.Viewport>

            <GeneratedImageViewportOverlay
              hideComposer={hideComposer}
              bottomOffsetPx={footerBottomPx}
            />

            {!hideComposer && (
              <AuiIf condition={({ thread }) => hideWelcome || !thread.isEmpty}>
                <ThreadComposerDock
                  disabled={isComposerAttachPending}
                  threadId={threadId}
                  onHeightChange={setComposerHeight}
                >
                  <ComposerAnimated
                    disabled={isComposerAttachPending}
                    threadId={threadId}
                    menuSide="top"
                  />
                </ThreadComposerDock>
              </AuiIf>
            )}
          </IntentAwareScrollProvider>
        </ThreadPrimitive.Root>
        {/* Document preview, opened by citation badges. */}
        <DocumentPreviewMount />
      </PageDragContext.Provider>
    </GeneratedImageOverlayProvider>
  );
});
Thread.displayName = "Thread";

const GeneratedImageViewportOverlay: FC<{
  hideComposer?: boolean;
  bottomOffsetPx?: number | null;
}> = ({ hideComposer, bottomOffsetPx }) => {
  const { overlay, closeOverlay } = useGeneratedImageOverlay();

  useEffect(() => {
    if (!overlay) {
      return;
    }
    document.querySelector<HTMLTextAreaElement>(".aui-composer-input")?.focus();
  }, [overlay]);

  if (!overlay) {
    return null;
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-30">
      <button
        type="button"
        className="pointer-events-auto absolute inset-0 bg-background/65 backdrop-blur-[1px] dark:bg-background/55"
        onClick={closeOverlay}
        aria-label="Close generated image preview"
      />
      <section
        className={cn(
          "pointer-events-none absolute inset-x-5 top-[48px] flex flex-col items-center",
          hideComposer
            ? "bottom-4"
            : bottomOffsetPx == null
              ? "bottom-[150px]"
              : undefined,
        )}
        style={
          !hideComposer && bottomOffsetPx != null
            ? { bottom: bottomOffsetPx }
            : undefined
        }
        aria-label="Generated image preview"
      >
        <div className="pointer-events-auto relative flex min-h-0 w-full max-w-[1100px] flex-1 flex-col items-center justify-center gap-3 rounded-3xl bg-muted/10 p-3 ring-1 ring-border/20">
          <div className="absolute inset-x-3 top-3 z-10 flex justify-end">
            <div className="flex shrink-0 items-center gap-1 rounded-full bg-background/70 p-1 ring-1 ring-border/20 backdrop-blur-sm">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-7 rounded-full"
                onClick={() =>
                  downloadImagePart({
                    image: overlay.image,
                    filename: overlay.filename,
                  })
                }
                aria-label="Download generated image"
              >
                <HugeiconsIcon icon={Download01Icon} className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-7 rounded-full"
                onClick={closeOverlay}
                aria-label="Close generated image preview"
              >
                <XIcon className="size-3.5" />
              </Button>
            </div>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center pt-1">
            <img
              src={overlay.image}
              alt={overlay.title}
              className="max-h-full max-w-full object-contain"
            />
          </div>
          <div
            className="w-full max-w-[min(100%,46rem)] shrink-0 text-center"
            title={overlay.title}
          >
            <p className="truncate text-xs font-semibold text-foreground/80">
              Generated image
            </p>
            {overlay.metadata ? (
              <p className="truncate text-ui-11 font-medium text-muted-foreground">
                {overlay.metadata}
              </p>
            ) : null}
            {hideComposer ? null : (
              <p className="mx-auto mt-2 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                Type edits below, then send
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};
export const ProjectComposer: FC<{
  disabled?: boolean;
  placeholder?: string;
}> = ({ disabled, placeholder }) => {
  return (
    <GeneratedImageOverlayProvider>
      {/* New chat in a project: queuing follow-ups here misbinds the thread,
          so the queue only runs once the user is inside a chat session. */}
      <ComposerAnimated
        disabled={disabled}
        placeholder={placeholder}
        disableQueue
      />
    </GeneratedImageOverlayProvider>
  );
};

const ComposerAnimated: FC<{
  disabled?: boolean;
  placeholder?: string;
  threadId?: string | null;
  menuSide?: "top" | "bottom";
  disableQueue?: boolean;
}> = ({ disabled, threadId, menuSide, disableQueue }) => {
  return (
    <div className="relative mx-auto min-w-0 w-full max-w-[46rem]">
      <div className="relative z-10 w-full">
        <Composer
          disabled={disabled}
          threadId={threadId}
          menuSide={menuSide}
          disableQueue={disableQueue}
        />
      </div>
    </div>
  );
};


const Composer: FC<{
  disabled?: boolean;
  placeholder?: string;
  threadId?: string | null;
  menuSide?: "top" | "bottom";
  disableQueue?: boolean;
}> = ({ disabled, placeholder, threadId, menuSide, disableQueue }) => {
  const t = useT();
  const modelSelector = useContext(ChatComposerModelSelectorContext);
  const aui = useAui();
  const isDictating = useAuiState((s) => s.composer.dictation != null);
  const pageDragging = useContext(PageDragContext);
  const { overlay, closeOverlay } = useGeneratedImageOverlay();
  const setImageToolsEnabled = useChatRuntimeStore(
    (s) => s.setImageToolsEnabled,
  );
  const toolsEnabled = useChatRuntimeStore((s) => s.toolsEnabled);
  const codeToolsEnabled = useChatRuntimeStore((s) => s.codeToolsEnabled);
  const imageToolsEnabled = useChatRuntimeStore((s) => s.imageToolsEnabled);
  const supportsBuiltinImageGeneration = useChatRuntimeStore(
    (s) => s.supportsBuiltinImageGeneration,
  );
  const artifactsEnabled = useChatRuntimeStore((s) => s.artifactsEnabled);
  const mcpEnabledForChat = useChatRuntimeStore((s) => s.mcpEnabledForChat);
  const ragEnabled = useChatRuntimeStore((s) => s.ragEnabled);
  const deepResearchEnabled = useChatRuntimeStore((s) => s.deepResearchEnabled);
  const activeThreadId = useChatRuntimeStore((s) => s.activeThreadId);
  const activeProjectId = useChatRuntimeStore((s) => s.activeProjectId);
  const researchThreadId = threadId ?? activeThreadId ?? null;
  const researchThreadClaimed = useResearchRunStore((state) =>
    researchThreadId
      ? Boolean(state.claimedThreadIds[researchThreadId])
      : false,
  );
  // Derive in the selector, as useThreadResearchActive does: a bare run selector re-renders the
  // composer on every streamed research delta.
  const isResearchActive = useResearchRunStore((state) => {
    const runId = researchThreadId
      ? state.latestRunByThreadId[researchThreadId]
      : undefined;
    const run = runId ? state.sessions[runId]?.run : undefined;
    return Boolean(
      run && !["completed", "failed", "cancelled"].includes(run.status),
    );
  });
  const hasResearchMessage = useAuiState(({ thread }) =>
    threadHasResearchMessage(thread.messages),
  );
  const researchUsed = researchThreadClaimed || hasResearchMessage;
  const effectiveDeepResearchEnabled = deepResearchEnabled && !researchUsed;
  const [researchWebsiteAccessOpen, setResearchWebsiteAccessOpen] =
    useState(false);
  useEffect(() => {
    if (!researchUsed) return;
    if (hasResearchMessage && researchThreadId) {
      useResearchRunStore.getState().setThreadClaimed(researchThreadId, true);
    }
    if (deepResearchEnabled) {
      useChatRuntimeStore.getState().setDeepResearchEnabled(false);
    }
  }, [deepResearchEnabled, hasResearchMessage, researchThreadId, researchUsed]);
  // More than 4 pills: collapse to icons only. Search, Code, and permissions
  // always show; Images, RAG, Canvas, MCP and Deep Research are conditional.
  // Narrow viewports collapse too: the labelled row is wider than a phone composer.
  const isMobile = useIsMobile();
  const pillCount =
    3 +
    (ragEnabled ? 1 : 0) +
    (supportsBuiltinImageGeneration ? 1 : 0) +
    (artifactsEnabled ? 1 : 0) +
    (mcpEnabledForChat ? 1 : 0) +
    (effectiveDeepResearchEnabled ? 1 : 0);
  // Under the count threshold the row still overflows on long labels ("Run
  // automatically" next to "Deep research"), which dropped the dictate and
  // send buttons onto a second line. Measuring collapses just enough.
  const { pillRowRef, pillCompact } = useComposerPillFit(
    isMobile || pillCount > 4,
  );
  const setPendingImageEditReference = useChatRuntimeStore(
    (s) => s.setPendingImageEditReference,
  );
  const pastedTextMinChars = useChatPreferencesStore(
    (state) => state.pastedTextMinChars,
  );
  // Set by Cmd/Ctrl+Enter and read once by the handleSubmit that requestSubmit
  // reaches synchronously. Armed only when that call will happen: with no form,
  // or no requestSubmit, it would stay armed and queue whatever submit came
  // next.
  const forceQueueRef = useRef(false);
  const queueOnModEnter = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      const form = event.currentTarget.form;
      if (typeof form?.requestSubmit !== "function") {
        return;
      }
      forceQueueRef.current = true;
      try {
        form.requestSubmit();
      } catch {
        forceQueueRef.current = false;
      }
    },
    [],
  );
  // Read by both writers that could put the sent text back, the input handlers
  // and the draft restore. Armed by every path that clears the composer.
  const justSentRef = useRef<SentTextGuard | null>(null);
  // Thread on screen, so the guard can tell whether a write belongs to the
  // thread that sent. Kept in step by the effect alongside pasteDraftKeyRef.
  const draftKeyRef = useRef<string | null>(null);
  const { inputProps, isComposing, isComposingRef } =
    useImeComposerInputHandlers({
      submitOnEnter: true,
      onModEnter: queueOnModEnter,
      justSentRef,
      draftKeyRef,
    });
  // A pasted YouTube link offers a transcript attachment above the composer.
  const [youtubeLink, setYoutubeLink] = useState<string | null>(null);
  const [workspacePathOffer, setWorkspacePathOffer] = useState<string | null>(
    null,
  );
  useEffect(() => {
    const onFolderDrop = (event: Event) => {
      const path = (event as CustomEvent<string>).detail;
      if (path && activeProjectId) setWorkspacePathOffer(path);
    };
    window.addEventListener("sparta:workspace-folder-drop", onFolderDrop);
    return () =>
      window.removeEventListener("sparta:workspace-folder-drop", onFolderDrop);
  }, [activeProjectId]);
  const handleFilePaste = useCallback(
    (event: ClipboardEvent<HTMLTextAreaElement>) => {
      const pastedText = event.clipboardData?.getData("text/plain") ?? "";
      const pastedWorkspacePath = extractAbsoluteFolderPath(pastedText);
      if (pastedWorkspacePath && activeProjectId) {
        setWorkspacePathOffer(pastedWorkspacePath);
      }
      if (extractYoutubeVideoId(pastedText)) {
        setYoutubeLink(pastedText.trim());
      }
      // Bulk text pastes attach as a file instead of filling the input, except
      // in image-edit mode, whose submit path takes an inline instruction only.
      const input = event.currentTarget;
      // An attachment is serialised after all inline text, so only a paste that
      // was already heading to the end can become one. Mid-text pastes stay
      // inline, where the order the user typed them in survives.
      const pasteGoesLast = input.selectionEnd === input.value.length;
      const { selectionStart, selectionEnd, value } = input;
      // Swallowing the paste also swallowed the replacement the browser would
      // have made. Only once the attachment is in, and only if the composer is
      // still the one that was pasted into, or a failed paste eats the text.
      const dropReplacedSelection = () => {
        if (selectionStart === selectionEnd) return;
        const composer = aui.composer();
        if (composer.getState().text !== value) return;
        composer.setText(
          value.slice(0, selectionStart) + value.slice(selectionEnd),
        );
      };
      const attachedPastedText =
        !overlay &&
        pasteGoesLast &&
        pasteLongTextAsFile(
          event,
          async (file) => {
            await aui.composer().addAttachment(file);
            dropReplacedSelection();
          },
          () =>
            toast.error("Could not attach the pasted text.", {
              description: "Paste it again, or paste it in smaller pieces.",
            }),
          pastedTextMinChars,
        );
      if (attachedPastedText) return;
      pasteClipboardFiles(
        event,
        async (files) => {
          await Promise.all(
            files.map((file) => aui.composer().addAttachment(file)),
          );
        },
        () =>
          toast.error("Could not paste files.", {
            description:
              "The clipboard item is unsupported, unreadable, or exceeds its size limit.",
          }),
      );
      // A paste is a gesture, so it retires the guard and re-pasting the sent
      // prompt goes through. Last, and only when the browser will really insert
      // the text: a payload carrying files is preventDefaulted above, so
      // retiring for it would just free the next queued write to refill.
      if (
        pastedText.length > 0 &&
        !event.defaultPrevented &&
        justSentRef.current?.draftKey === draftKeyRef.current
      ) {
        justSentRef.current = null;
      }
    },
    [activeProjectId, aui, overlay, pastedTextMinChars],
  );

  const connectOfferedWorkspace = useCallback(
    async (workspaceAccess: "read" | "write") => {
      if (!workspacePathOffer) return;
      try {
        let projectId = activeProjectId;
        if (!projectId) {
          const folderName =
            workspacePathOffer
              .replace(/[\\/]+$/, "")
              .split(/[\\/]/)
              .at(-1) || "Workspace";
          const project = await createChatProject(folderName);
          projectId = project.id;
          useChatRuntimeStore.getState().setActiveProjectId(projectId);
          if (activeThreadId) {
            await updateStoredChatThread(activeThreadId, { projectId });
          }
        }
        const folder = await setChatProjectWorkspace(
          projectId,
          workspacePathOffer,
          workspaceAccess,
        );
        if (folder) {
          toast.success(t("projectsPage.folderConnected"), {
            description: folder,
          });
          setWorkspacePathOffer(null);
        }
      } catch (error) {
        toast.error(t("projectsPage.failedToUpdateFolder"), {
          description: error instanceof Error ? error.message : undefined,
        });
      }
    },
    [activeProjectId, activeThreadId, t, workspacePathOffer],
  );

  const composerText = useAuiState(({ composer }) => composer.text);
  const typedWorkspacePath = extractAbsoluteFolderPath(composerText);
  useEffect(() => {
    if (typedWorkspacePath && activeProjectId) {
      setWorkspacePathOffer((current) => current ?? typedWorkspacePath);
    }
  }, [activeProjectId, typedWorkspacePath]);
  // Derived, not cleared in an effect: the offer retracts as soon as the link
  // leaves the draft, which also covers sending.
  const youtubeOfferUrl =
    youtubeLink !== null && composerText.includes(youtubeLink)
      ? youtubeLink
      : null;
  // Expand only once the input wraps to a second line, not on first keystroke.
  // Latch until cleared so it can't flip-flop at the wrap boundary.
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Cache line metrics so getComputedStyle runs once, not per keystroke.
  const lineMetricsRef = useRef<{ lineHeight: number; padding: number } | null>(
    null,
  );
  const [isMultiline, setIsMultiline] = useState(false);
  useEffect(() => {
    if (composerText.length === 0) {
      setIsMultiline(false);
      lineMetricsRef.current = null;
      return;
    }
    // Latched on: stays until the text clears, so skip re-measuring.
    if (isMultiline) return;
    const el = inputRef.current;
    if (!el) {
      return;
    }
    if (!lineMetricsRef.current) {
      const cs = getComputedStyle(el);
      const lineHeight = Number.parseFloat(cs.lineHeight) || 24;
      const padTop = Number.parseFloat(cs.paddingTop) || 0;
      const padBottom = Number.parseFloat(cs.paddingBottom) || 0;
      lineMetricsRef.current = { lineHeight, padding: padTop + padBottom };
    }
    const { lineHeight, padding } = lineMetricsRef.current;
    const contentHeight = el.scrollHeight - padding;
    if (contentHeight > lineHeight * 1.5) setIsMultiline(true);
  }, [composerText, isMultiline]);
  const hasAttachments = useAuiState(
    ({ composer }) => composer.attachments.length > 0,
  );
  const hasPendingAttachments = useAuiState(({ composer }) =>
    composer.attachments.some(
      (attachment) => attachment.status.type === "running",
    ),
  );
  const attachmentsAreAllPastedText = useAuiState(
    ({ composer }) =>
      composer.attachments.length > 0 &&
      composer.attachments.every((attachment) =>
        isPastedTextFile((attachment as { file?: File }).file),
      ),
  );
  // Identities only: paste autosave keys off this, and the bodies behind it can
  // be megabytes. Every attachment counts, not just pasted ones, so removing an
  // ordinary file also releases the paste restore waiting on it.
  const composerAttachmentSignature = useAuiState(({ composer }) =>
    composer.attachments.map((attachment) => attachment.id).join(","),
  );
  const hasPendingAudio = useChatRuntimeStore((s) =>
    Boolean(s.pendingAudioName),
  );
  const nativeAttachmentTargetKey = useNativeAttachmentTargetKey();
  const nativeAttachmentTargetKeyRef = useRef(nativeAttachmentTargetKey);
  nativeAttachmentTargetKeyRef.current = nativeAttachmentTargetKey;
  const hasPendingImageAttachments = useNativeIntentStore((s) =>
    Boolean(
      nativeAttachmentTargetKey &&
      (s.pendingImageAttachments[nativeAttachmentTargetKey]?.length ?? 0) > 0,
    ),
  );
  const registeringImageDrops = useNativeIntentStore(
    (s) => s.registeringImageDrops > 0,
  );
  const [materializingDroppedImages, setMaterializingDroppedImages] =
    useState(false);
  const hasPendingAudioAttachments = useNativeIntentStore((s) =>
    Boolean(
      nativeAttachmentTargetKey &&
      (s.pendingAudioAttachments[nativeAttachmentTargetKey]?.length ?? 0) > 0,
    ),
  );
  const registeringAudioDrops = useNativeIntentStore(
    (s) => s.registeringAudioDrops > 0,
  );
  const [materializingDroppedAudio, setMaterializingDroppedAudio] =
    useState(false);
  const hasPendingVideoAttachments = useNativeIntentStore((s) =>
    Boolean(
      nativeAttachmentTargetKey &&
      (s.pendingVideoAttachments[nativeAttachmentTargetKey]?.length ?? 0) > 0,
    ),
  );
  const registeringVideoDrops = useNativeIntentStore(
    (s) => s.registeringVideoDrops > 0,
  );
  const [materializingDroppedVideo, setMaterializingDroppedVideo] =
    useState(false);
  // A parked send must not fire on a failed drop: the user is owed the toast and
  // their text, not a send of the text alone. Assigned below, once the callback exists.
  const cancelQueuedSendRef = useRef<(() => void) | null>(null);
  // Which composer is mounted, for deciding where a drain puts work back.
  const composerIdentityRef = useRef("");
  const imageDropFailures = useNativeIntentStore(
    (s) =>
      (nativeAttachmentTargetKey
        ? s.imageDropFailures[nativeAttachmentTargetKey]
        : 0) ?? 0,
  );
  const seenImageDropFailuresRef = useRef(imageDropFailures);
  // Registration fails before an intent exists, so the drain never sees it.
  // Cancel here or the parked send goes out with the text alone.
  useEffect(() => {
    if (seenImageDropFailuresRef.current === imageDropFailures) return;
    seenImageDropFailuresRef.current = imageDropFailures;
    cancelQueuedSendRef.current?.();
  }, [imageDropFailures]);
  const audioDropFailures = useNativeIntentStore(
    (s) =>
      (nativeAttachmentTargetKey
        ? s.audioDropFailures[nativeAttachmentTargetKey]
        : 0) ?? 0,
  );
  const seenAudioDropFailuresRef = useRef(audioDropFailures);
  // Cancel the parked send before `endAudioDropRegistration` reopens the gate.
  useEffect(() => {
    if (seenAudioDropFailuresRef.current === audioDropFailures) return;
    seenAudioDropFailuresRef.current = audioDropFailures;
    cancelQueuedSendRef.current?.();
  }, [audioDropFailures]);
  const videoDropFailures = useNativeIntentStore(
    (s) =>
      (nativeAttachmentTargetKey
        ? s.videoDropFailures[nativeAttachmentTargetKey]
        : 0) ?? 0,
  );
  const seenVideoDropFailuresRef = useRef(videoDropFailures);
  // Cancel the parked send before `endVideoDropRegistration` reopens the gate.
  useEffect(() => {
    if (seenVideoDropFailuresRef.current === videoDropFailures) return;
    seenVideoDropFailuresRef.current = videoDropFailures;
    cancelQueuedSendRef.current?.();
  }, [videoDropFailures]);
  // Registering and reading a dropped clip is async, so hold the send gate:
  // the composer sees nothing until `addAttachment` lands.
  useEffect(() => {
    if (!nativeAttachmentTargetKey) {
      return;
    }
    const targetKey = nativeAttachmentTargetKey;
    const identityAtSetup = composerIdentityRef.current;
    useNativeIntentStore
      .getState()
      .claimAudioAttachments(identityAtSetup, targetKey);
    let disposed = false;
    let draining = false;

    // A re-key follows the same composer; a thread switch parks the clip back.
    const stillThisComposer = () =>
      composerIdentityRef.current === identityAtSetup;
    // A remount hides the new key, so tag the batch; the next instance claims it.
    const requeue = (intents: NativeIntent[]) => {
      const key = stillThisComposer()
        ? (nativeAttachmentTargetKeyRef.current ?? targetKey)
        : targetKey;
      const store = useNativeIntentStore.getState();
      store.addAudioAttachments(key, intents);
      store.noteAudioDropOwner(key, identityAtSetup);
    };

    const drainPendingAudio = async () => {
      if (disposed || draining) return;
      draining = true;
      setMaterializingDroppedAudio(true);
      try {
        while (!disposed) {
          const intents = useNativeIntentStore
            .getState()
            .takeAudioAttachments(targetKey);
          if (intents.length === 0) break;
          for (const [index, intent] of intents.entries()) {
            if (disposed) {
              requeue(intents.slice(index));
              return;
            }
            let file: File;
            try {
              file = await nativeAttachmentIntentToFile(intent);
            } catch (error) {
              toast.error("Could not attach dropped audio", {
                description:
                  error instanceof Error ? error.message : String(error),
              });
              // Do not let a send parked on this clip go out as bare text.
              if (stillThisComposer()) cancelQueuedSendRef.current?.();
              continue;
            }
            // The read is async; a chat switch in that window must not steal the clip.
            if (
              disposed ||
              nativeAttachmentTargetKeyRef.current !== targetKey
            ) {
              requeue(intents.slice(index));
              return;
            }
            try {
              await aui.composer().addAttachment(file);
            } catch {
              // Chat-wide, not per file (no audio model, too large, already
              // attached), and every adapter path toasted: stop quietly.
              if (stillThisComposer()) cancelQueuedSendRef.current?.();
              return;
            }
          }
        }
      } finally {
        draining = false;
        // A drain for a target already left must not touch the flag; cleanup
        // cleared it, and the live target may have set it again.
        if (!disposed) {
          // The early returns requeue mid-batch, and a drop can land while
          // `draining` gated the subscription.
          const pending =
            useNativeIntentStore.getState().pendingAudioAttachments[targetKey]
              ?.length ?? 0;
          // Only the instance still owning this composer re-drains; otherwise
          // the batch stays parked rather than looping here forever.
          if (pending > 0 && stillThisComposer()) {
            void drainPendingAudio();
          } else {
            setMaterializingDroppedAudio(false);
          }
        }
      }
    };

    const unsubscribe = useNativeIntentStore.subscribe((state) => {
      // A predecessor's requeue can land after setup, so keep watching.
      const orphaned = Object.entries(state.audioDropOwners).some(
        ([key, owner]) => owner === identityAtSetup && key !== targetKey,
      );
      if (orphaned) {
        useNativeIntentStore
          .getState()
          .claimAudioAttachments(identityAtSetup, targetKey);
        return;
      }
      if ((state.pendingAudioAttachments[targetKey]?.length ?? 0) > 0) {
        void drainPendingAudio();
      }
    });
    void drainPendingAudio();

    return () => {
      disposed = true;
      setMaterializingDroppedAudio(false);
      unsubscribe();
    };
  }, [nativeAttachmentTargetKey, aui]);

  // Same drain as audio, one queue over: one clip per message, and the send
  // gate has to hold across the read either way.
  useEffect(() => {
    if (!nativeAttachmentTargetKey) {
      return;
    }
    const targetKey = nativeAttachmentTargetKey;
    const identityAtSetup = composerIdentityRef.current;
    useNativeIntentStore
      .getState()
      .claimVideoAttachments(identityAtSetup, targetKey);
    let disposed = false;
    let draining = false;

    // A re-key follows the same composer; a thread switch parks the clip back.
    const stillThisComposer = () =>
      composerIdentityRef.current === identityAtSetup;
    // A remount hides the new key, so tag the batch; the next instance claims it.
    const requeue = (intents: NativeIntent[]) => {
      const key = stillThisComposer()
        ? (nativeAttachmentTargetKeyRef.current ?? targetKey)
        : targetKey;
      const store = useNativeIntentStore.getState();
      store.addVideoAttachments(key, intents);
      store.noteVideoDropOwner(key, identityAtSetup);
    };

    const drainPendingVideo = async () => {
      if (disposed || draining) return;
      draining = true;
      setMaterializingDroppedVideo(true);
      try {
        while (!disposed) {
          const intents = useNativeIntentStore
            .getState()
            .takeVideoAttachments(targetKey);
          if (intents.length === 0) break;
          for (const [index, intent] of intents.entries()) {
            if (disposed) {
              requeue(intents.slice(index));
              return;
            }
            let file: File;
            try {
              file = await nativeAttachmentIntentToFile(intent);
            } catch (error) {
              toast.error("Could not attach dropped video", {
                description:
                  error instanceof Error ? error.message : String(error),
              });
              // Do not let a send parked on this clip go out as bare text.
              if (stillThisComposer()) cancelQueuedSendRef.current?.();
              continue;
            }
            // The read is async; a chat switch in that window must not steal the clip.
            if (
              disposed ||
              nativeAttachmentTargetKeyRef.current !== targetKey
            ) {
              requeue(intents.slice(index));
              return;
            }
            try {
              await aui.composer().addAttachment(file);
            } catch {
              // Chat-wide, not per file (no video mmproj, no ffmpeg, too large,
              // already attached), and every adapter path toasted: stop quietly.
              if (stillThisComposer()) cancelQueuedSendRef.current?.();
              return;
            }
          }
        }
      } finally {
        draining = false;
        // A drain for a target already left must not touch the flag; cleanup
        // cleared it, and the live target may have set it again.
        if (!disposed) {
          // The early returns requeue mid-batch, and a drop can land while
          // `draining` gated the subscription.
          const pending =
            useNativeIntentStore.getState().pendingVideoAttachments[targetKey]
              ?.length ?? 0;
          // Only the instance still owning this composer re-drains; otherwise
          // the batch stays parked rather than looping here forever.
          if (pending > 0 && stillThisComposer()) {
            void drainPendingVideo();
          } else {
            setMaterializingDroppedVideo(false);
          }
        }
      }
    };

    const unsubscribe = useNativeIntentStore.subscribe((state) => {
      // A predecessor's requeue can land after setup, so keep watching.
      const orphaned = Object.entries(state.videoDropOwners).some(
        ([key, owner]) => owner === identityAtSetup && key !== targetKey,
      );
      if (orphaned) {
        useNativeIntentStore
          .getState()
          .claimVideoAttachments(identityAtSetup, targetKey);
        return;
      }
      if ((state.pendingVideoAttachments[targetKey]?.length ?? 0) > 0) {
        void drainPendingVideo();
      }
    });
    void drainPendingVideo();

    return () => {
      disposed = true;
      setMaterializingDroppedVideo(false);
      unsubscribe();
    };
  }, [nativeAttachmentTargetKey, aui]);

  useEffect(() => {
    if (!nativeAttachmentTargetKey) {
      return;
    }
    const targetKey = nativeAttachmentTargetKey;
    const identityAtSetup = composerIdentityRef.current;
    useNativeIntentStore
      .getState()
      .claimImageAttachments(identityAtSetup, targetKey);
    let disposed = false;
    let draining = false;

    // A fresh chat re-keys from "single:new" to its thread id under the same
    // composer, so follow it; a real thread switch keeps the original target.
    const stillThisComposer = () =>
      composerIdentityRef.current === identityAtSetup;
    const requeueKey = () =>
      stillThisComposer()
        ? (nativeAttachmentTargetKeyRef.current ?? targetKey)
        : targetKey;
    // A fresh chat persisting remounts this composer, so the key it moves to is
    // not visible here. Tag the batch instead; the next instance claims it.
    const requeue = (intents: NativeIntent[]) => {
      const key = requeueKey();
      const store = useNativeIntentStore.getState();
      store.addImageAttachments(key, intents);
      store.noteImageDropOwner(key, identityAtSetup);
    };

    const drainPendingImages = async () => {
      if (disposed || draining) {
        return;
      }
      draining = true;
      setMaterializingDroppedImages(true);
      let readFailures = 0;
      let lastReadError: unknown;
      try {
        while (!disposed) {
          const intents = useNativeIntentStore
            .getState()
            .takeImageAttachments(targetKey);
          if (intents.length === 0) {
            break;
          }
          for (let index = 0; index < intents.length; index += 1) {
            if (disposed) {
              requeue(intents.slice(index));
              return;
            }
            const intent = intents[index]!;
            let file: File;
            try {
              file = await nativeAttachmentIntentToFile(intent);
            } catch (error) {
              // Report once below rather than one toast per file: a whole batch
              // can go unreadable at once (volume ejected, tokens expired).
              readFailures += 1;
              lastReadError = error;
              continue;
            }
            if (
              disposed ||
              nativeAttachmentTargetKeyRef.current !== targetKey
            ) {
              requeue(intents.slice(index));
              return;
            }
            try {
              await aui.composer().addAttachment(file);
            } catch {
              // Chat-wide, not per file (no vision model, or none loaded). The
              // adapter toasted, and the rest would fail alike: stop quietly.
              if (stillThisComposer()) cancelQueuedSendRef.current?.();
              return;
            }
          }
        }
      } finally {
        draining = false;
        if (readFailures > 0) {
          toast.error("Could not attach dropped images", {
            description:
              lastReadError instanceof Error
                ? lastReadError.message
                : String(lastReadError),
          });
          // A re-key still owns the parked send; a real thread switch does not.
          if (stillThisComposer()) cancelQueuedSendRef.current?.();
        }
        // A drain for a target the composer has already left must not touch the
        // flag: cleanup cleared it, and the live target may have set it again.
        if (disposed) {
          return;
        }
        const pending =
          useNativeIntentStore.getState().pendingImageAttachments[targetKey]
            ?.length ?? 0;
        if (pending > 0) {
          void drainPendingImages();
        } else {
          setMaterializingDroppedImages(false);
        }
      }
    };

    const unsubscribe = useNativeIntentStore.subscribe((state) => {
      // The predecessor's requeue can land after the claim at setup, so keep
      // watching rather than claiming once.
      const orphaned = Object.entries(state.imageDropOwners).some(
        ([key, owner]) => owner === identityAtSetup && key !== targetKey,
      );
      if (orphaned) {
        useNativeIntentStore
          .getState()
          .claimImageAttachments(identityAtSetup, targetKey);
        return;
      }
      const pending = state.pendingImageAttachments[targetKey]?.length ?? 0;
      if (pending > 0) {
        void drainPendingImages();
      }
    });

    void drainPendingImages();

    return () => {
      disposed = true;
      setMaterializingDroppedImages(false);
      unsubscribe();
    };
  }, [nativeAttachmentTargetKey, aui]);
  const hasMaterializingImageAttachments =
    registeringImageDrops ||
    hasPendingImageAttachments ||
    materializingDroppedImages;
  const hasMaterializingAudioAttachments =
    registeringAudioDrops ||
    hasPendingAudioAttachments ||
    materializingDroppedAudio;
  const hasMaterializingVideoAttachments =
    registeringVideoDrops ||
    hasPendingVideoAttachments ||
    materializingDroppedVideo;
  const threadIsRunning = useAuiState(({ thread }) => thread.isRunning);
  const threadListItemId = useAuiState(
    ({ threadListItem }) => threadListItem.id,
  );
  const threadListItemRemoteId = useAuiState(
    ({ threadListItem }) => threadListItem.remoteId,
  );
  const referenceThreadId = threadId ?? activeThreadId ?? null;
  const promptQueueThreadIds = compactIds([
    threadListItemId,
    threadListItemRemoteId,
    threadId,
  ]);
  const preStreamThreadIds = compactIds([
    ...promptQueueThreadIds,
    referenceThreadId,
  ]);
  const preStreamRunReservationRef = useRef<symbol | null>(null);
  useEffect(() => {
    const token = preStreamRunReservationRef.current;
    if (!token) {
      return;
    }
    adoptPreStreamRunReservation(token, preStreamThreadIds);
    // Keep the reservation until the adapter consumes or fails it. React can
    // expose isRunning before persistence and model preflight finish; releasing
    // here would hide that accepted send from a concurrent model-change gate.
  }, [preStreamThreadIds]);
  const promptQueueActive = usePromptQueueUI((s) =>
    Boolean(findPromptQueueEntry(s, promptQueueThreadIds)),
  );
  const hasSendableContent =
    composerText.trim().length > 0 || hasAttachments || hasPendingAudio;
  const composerAcceptsQueueing =
    !hasPendingAudio &&
    !isComposing &&
    !hasPendingAttachments &&
    !hasMaterializingImageAttachments &&
    !hasMaterializingAudioAttachments &&
    !hasMaterializingVideoAttachments &&
    !disabled &&
    !overlay;
  const canQueueCurrentPrompt =
    composerText.trim().length > 0 &&
    !hasAttachments &&
    composerAcceptsQueueing;
  // A long paste is text the composer parked in a chip, so it queues like the
  // same text did before it attached, rather than being refused as a file.
  const canQueuePastedTextPrompt =
    attachmentsAreAllPastedText && composerAcceptsQueueing;

  // Per-thread draft autosave: restore on mount, then mirror composer text
  // into localStorage (debounced) so a half-typed message survives a
  // navigation or reload. Cleared once empty (i.e. after a send). Setting the
  // text even when no draft exists keeps a thread from inheriting the
  // previous thread's composer contents.
  const draftThreadId = referenceThreadId;
  const draftKey = draftThreadId ? composerDraftKey(draftThreadId) : null;
  // A pasted attachment is a File held in memory only, so without its own slot
  // an unsent paste is the one draft a reload throws away.
  const pasteDraftKey = draftThreadId
    ? composerPasteDraftKey(draftThreadId)
    : null;
  const lastDraftKeyRef = useRef(draftKey);
  // Which key the paste restore has finished for. The save effect writes only
  // for that key, so a draft is never cleared before it has been put back.
  const restoredPasteKeyRef = useRef<string | null>(null);
  const draftSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const draft = draftKey ? (readComposerDraft(draftKey) ?? "") : "";
    const composer = aui.composer();
    if (!composer.getState().isEditing) return;
    // A save that raced the send still holds the sent text, so restoring it
    // would undo the clear. Keyed on the sending thread, so another thread's
    // identical draft still restores. Clear rather than return early, which
    // would leave the previous thread's text on screen under this one.
    if (sentTextGuardBlocksDraft(justSentRef.current, draft, draftKey)) {
      // Written inline rather than via clearStoredDraft, which is declared
      // below this effect. Cancel the pending save too, or it rewrites the key.
      if (draftSaveTimerRef.current !== null) {
        clearTimeout(draftSaveTimerRef.current);
        draftSaveTimerRef.current = null;
      }
      if (draftKey) writeComposerDraft(draftKey, "");
      composer.setText("");
      return;
    }
    composer.setText(draft);
  }, [draftKey, aui]);
  // The saved-prompt menu and the prompt storage dialog fill the composer
  // directly, bypassing the guard. Text appearing while the sending thread is
  // on screen was put there deliberately, so retire; the draftKey check keeps
  // another thread's restored draft from doing the same. Read live, or a
  // pending render retires it on stale text. Must stay after the restore
  // above, which clears the raced draft this would otherwise retire on.
  useEffect(() => {
    const guard = justSentRef.current;
    if (guard === null || guard.draftKey !== draftKey) return;
    if (aui.composer().getState().text.length === 0) return;
    justSentRef.current = null;
  }, [composerText, draftKey, aui]);
  // Separate from the text restore above, which must stay keyed on the draft
  // alone: this one retries on attachment changes, and rewriting the composer
  // text on those would drop whatever had been typed since the last autosave.
  useEffect(() => {
    const composer = aui.composer();
    if (!composer.getState().isEditing) return;
    if (restoredPasteKeyRef.current === pasteDraftKey) return;
    // The composer outlives a thread switch, so restore only into an empty one
    // rather than mixing this thread's draft with whatever the last one left.
    // Changing attachments re-runs this effect, which is how the retry happens.
    if (composer.getState().attachments.length > 0) return;
    const stored = pasteDraftKey ? readPasteDraft(pasteDraftKey) : [];
    if (stored.length === 0) {
      restoredPasteKeyRef.current = pasteDraftKey;
      return;
    }
    // Claim the key only once the attachments are in, so the save effect
    // cannot write an empty composer over the draft still being restored.
    void Promise.all(
      stored.map((text) => composer.addAttachment(createPastedTextFile(text))),
    ).finally(() => {
      restoredPasteKeyRef.current = pasteDraftKey;
    });
  }, [pasteDraftKey, composerAttachmentSignature, aui]);
  // Keyed on the paste identities, never their bodies, so typing beside a
  // megabyte paste does not rewrite it to localStorage every 300ms.
  useEffect(() => {
    if (!pasteDraftKey || restoredPasteKeyRef.current !== pasteDraftKey) return;
    const pastes = aui
      .composer()
      .getState()
      .attachments.flatMap((attachment) => {
        const text = pastedTextOf((attachment as { file?: File }).file);
        return text === undefined ? [] : [text];
      });
    writePasteDraft(pasteDraftKey, pastes);
  }, [composerAttachmentSignature, pasteDraftKey, aui]);
  useEffect(() => {
    // After a thread switch composerText can still hold the previous
    // thread's text; skip that cycle so it isn't saved under the new key.
    if (lastDraftKeyRef.current !== draftKey) {
      lastDraftKeyRef.current = draftKey;
      return;
    }
    if (!draftKey) {
      return;
    }
    const t = setTimeout(() => writeComposerDraft(draftKey, composerText), 300);
    draftSaveTimerRef.current = t;
    return () => clearTimeout(t);
  }, [composerText, draftKey]);
  const pasteDraftKeyRef = useRef(pasteDraftKey);
  useEffect(() => {
    draftKeyRef.current = draftKey;
    pasteDraftKeyRef.current = pasteDraftKey;
  }, [draftKey, pasteDraftKey]);
  // Call wherever the composer is emptied because its text left as a message.
  const armJustSent = useCallback((...texts: string[]) => {
    justSentRef.current = armSentTextGuard(texts, draftKeyRef.current);
  }, []);
  const clearStoredDraft = useCallback(() => {
    if (draftSaveTimerRef.current !== null) {
      clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
    const key = draftKeyRef.current;
    if (key) {
      writeComposerDraft(key, "");
    }
    const pasteKey = pasteDraftKeyRef.current;
    if (pasteKey) {
      writePasteDraft(pasteKey, []);
    }
  }, []);
  // react-textarea-autosize re-measures only on value change or window resize,
  // not on the width swap from expanding, so it keeps the taller height and
  // leaves a stray blank row. Nudge a resize whenever input width changes.
  useEffect(() => {
    const el = inputRef.current;
    if (!el || typeof ResizeObserver === "undefined") {
      return;
    }
    let lastWidth = -1;
    const pending: Array<ReturnType<typeof setTimeout>> = [];
    const observer = new ResizeObserver((entries) => {
      const width = Math.round(entries[0]?.contentRect.width ?? 0);
      // Width changes only; reacting to autosize's height change would loop.
      if (width === lastWidth) {
        return;
      }
      lastWidth = width;
      // Re-measure after layout settles. An immediate dispatch races
      // autosize's own measurement (stale pre-expand width); 0ms + 64ms wins.
      while (pending.length) {
        clearTimeout(pending.pop());
      }
      for (const delay of [0, 64]) {
        pending.push(
          setTimeout(() => {
            window.dispatchEvent(new Event("resize"));
          }, delay),
        );
      }
    });
    observer.observe(el);
    return () => {
      while (pending.length) {
        clearTimeout(pending.pop());
      }
      observer.disconnect();
    };
  }, []);
  // Docked composer opens upward; the welcome composer opens downward by
  // default and only flips up via collision detection when it won't fit.
  const effectiveMenuSide = menuSide ?? "bottom";

  // While this thread's docs index, hold the send and fire it once they finish so
  // retrieval covers all of them.
  const [indexingActive, setIndexingActive] = useState(false);
  const indexingActiveRef = useRef(false);
  const promptQueueTargetMountedRef = useRef(true);
  const promptQueueStartPendingRef = useRef(
    new Map<
      string,
      {
        temporary: boolean;
        cancelled: boolean;
        threadId: string | null;
        localModelBoundaryGeneration: number;
        queuedSettingsEpoch: number;
      }
    >(),
  );
  // Reading a pasted-text attachment happens before the queue start is
  // registered, so the intent is recorded here for the length of the read.
  // Keyed like a reservation so a submit during the read cannot start a second
  // read of the same attachment, and carrying the boundaries the read predates.
  const pastedTextQueuePendingRef = useRef(
    new Map<
      string,
      {
        temporary: boolean;
        cancelled: boolean;
        threadId: string | null;
        localModelBoundaryGeneration: number;
        queuedSettingsEpoch: number;
        historyClearGeneration: number;
      }
    >(),
  );
  useEffect(() => {
    promptQueueTargetMountedRef.current = true;
    return () => {
      promptQueueTargetMountedRef.current = false;
    };
  }, []);
  useEffect(() => {
    const cancelPendingQueueFactories = (event: Event) => {
      const detail =
        (event as CustomEvent<PromptQueueStopEventDetail>).detail ?? {};
      const state = aui.threadListItem().getState();
      const aliases = compactIds([state.id, state.remoteId, referenceThreadId]);
      cancelPendingPromptQueueFactoriesForStop(
        promptQueueStartPendingRef.current,
        aliases,
        detail,
      );
      // A read in flight has no reservation yet, so it needs cancelling here
      // too or Clear all lets it queue a prompt and recreate the chat.
      cancelPendingPromptQueueFactoriesForStop(
        pastedTextQueuePendingRef.current,
        aliases,
        detail,
      );
    };
    window.addEventListener(
      PROMPT_QUEUE_STOP_EVENT,
      cancelPendingQueueFactories,
    );
    return () => {
      window.removeEventListener(
        PROMPT_QUEUE_STOP_EVENT,
        cancelPendingQueueFactories,
      );
    };
  }, [aui, referenceThreadId]);
  const [pendingSend, setPendingSend] = useState(false);
  const pendingSendRef = useRef(false);
  // Whether the parked send is a queue gesture. A chord pressed while this
  // chat's settings load parks like any other send, and the release path would
  // otherwise send the prompt the user asked to stack.
  const pendingSendForceQueueRef = useRef(false);
  const waitToastRef = useRef<string | number | null>(null);
  // This chat's own settings are still on their way; a send now would run on the
  // installation defaults showing in their place.
  const threadScopedSettingsPending = useChatRuntimeStore(
    (s) => s.threadScopedSettingsPending,
  );

  const handleIndexingChange = useCallback((active: boolean) => {
    // ThreadDocumentsBar can report the same state again while a first upload
    // materializes its thread. Do not turn a repeated notification into another
    // composer render: that feedback loop can otherwise exceed React's update
    // depth before the document row settles.
    if (indexingActiveRef.current === active) return;
    indexingActiveRef.current = active;
    setIndexingActive(active);
  }, []);

  const createPromptQueueTarget =
    useCallback(async (): Promise<PromptQueueTarget | null> => {
      const assistantRuntime = aui.threads().__internal_getAssistantRuntime?.();
      const initialState = aui.threadListItem().getState();
      const initialRunningThreadIds = [
        initialState.id,
        initialState.remoteId,
        referenceThreadId,
      ].filter((id): id is string => Boolean(id));
      const initialDocumentThreadId =
        initialState.remoteId ?? referenceThreadId ?? null;
      const historyClearGeneration = chatHistoryClearBoundary.capture();
      await useChatRuntimeStore.getState().hydratePersistedSettings();
      if (
        !promptQueueTargetMountedRef.current ||
        chatHistoryClearBoundary.capture() !== historyClearGeneration
      ) {
        return null;
      }
      const currentState = aui.threadListItem().getState();
      if (
        !compactIds([currentState.id, currentState.remoteId]).some((id) =>
          initialRunningThreadIds.includes(id),
        )
      ) {
        return null;
      }
      const chatStateAtQueueStart = useChatRuntimeStore.getState();
      const incognitoAtQueueStart = chatStateAtQueueStart.incognito;
      // A chat with no row yet has no project to look up, and the store holds
      // whichever project is on screen when the queue polls. Read it here.
      const projectIdAtQueueStart = incognitoAtQueueStart
        ? null
        : (chatStateAtQueueStart.activeProjectId ?? null);
      const usesThreadDocumentsAtQueueStart =
        chatStateAtQueueStart.ragEnabled &&
        chatStateAtQueueStart.ragSource.type === "thread";
      const usesKnowledgeBaseAtQueueStart =
        chatStateAtQueueStart.ragEnabled &&
        chatStateAtQueueStart.ragSource.type === "kb";
      const runSettingsAtQueueStart = snapshotQueuedChatRunSettings(
        chatStateAtQueueStart,
      );
      const getThreadListItemState = () => {
        const runtime =
          assistantRuntime ?? aui.threads().__internal_getAssistantRuntime?.();
        if (!runtime) {
          return null;
        }
        for (const id of initialRunningThreadIds) {
          try {
            return runtime.threads.getItemById(id).getState();
          } catch {
            // Try the next captured id.
          }
        }
        return null;
      };
      const getQueueThreadIds = () => {
        const state = getThreadListItemState();
        return compactIds([
          ...initialRunningThreadIds,
          state?.id,
          state?.remoteId,
        ]);
      };
      const getThreadRuntime = () => {
        const runtime =
          assistantRuntime ?? aui.threads().__internal_getAssistantRuntime?.();
        if (!runtime) {
          return null;
        }
        for (const id of getQueueThreadIds()) {
          try {
            const thread = runtime.threads.getById(id);
            thread.getState();
            return thread;
          } catch {
            // Try the next captured id.
          }
        }
        return null;
      };
      const isTargetCurrentThread = () => {
        const state = aui.threadListItem().getState();
        return compactIds([state.id, state.remoteId]).some((id) =>
          initialRunningThreadIds.includes(id),
        );
      };
      const pendingSettingsIds = new Set<number>();
      let cancelled = false;
      let shouldCorrectPersistedModel: boolean | null = null;
      let initializedFreshThreadId: string | null = null;
      let freshThreadAppendAccepted = false;
      const removeFreshThreadPersistedAfterAbort = () => {
        const historyWasCleared =
          chatHistoryClearBoundary.capture() !== historyClearGeneration;
        if (
          !initializedFreshThreadId ||
          freshThreadAppendAccepted ||
          (!cancelled && !historyWasCleared)
        ) {
          return false;
        }
        // Tombstone synchronously so a late initializer cannot leave an empty
        // record visible while backend cleanup completes.
        markChatThreadDeleted(initializedFreshThreadId);
        // the tombstone is never rolled back: a failed DELETE may still have committed, and the
        // backend tombstones on commit, so resurrecting the id would leave it 410 on every write
        void deleteStoredChatThreads([initializedFreshThreadId]).catch(
          () => undefined,
        );
        if (!historyWasCleared && isTargetCurrentThread()) {
          void Promise.resolve(aui.threads().switchToNewThread()).catch(
            () => undefined,
          );
        }
        return true;
      };
      const discardOldestPendingSettings = () => {
        const settingsId = pendingSettingsIds.values().next().value;
        if (settingsId === undefined) {
          return;
        }
        pendingSettingsIds.delete(settingsId);
        discardQueuedChatRunSettings(settingsId);
      };
      return {
        getDocumentThreadId: () => {
          const state = getThreadListItemState();
          return (
            state?.remoteId ?? referenceThreadId ?? initialDocumentThreadId
          );
        },
        getRunningThreadIds: () => {
          return getQueueThreadIds();
        },
        isRunning: () =>
          hasPreStreamRunReservation(getQueueThreadIds()) ||
          Boolean(getThreadRuntime()?.getState().isRunning),
        append: async (prompt) => {
          const thread = getThreadRuntime();
          if (!thread) {
            throw new Error("Prompt queue thread runtime is unavailable");
          }
          if (incognitoAtQueueStart) {
            for (const id of getQueueThreadIds()) {
              markThreadIncognito(id);
            }
          }
          const settingsId = registerQueuedChatRunSettings(
            getQueueThreadIds(),
            {
              ...runSettingsAtQueueStart,
              params: { ...runSettingsAtQueueStart.params },
            },
          );
          pendingSettingsIds.add(settingsId);
          try {
            const runtime =
              assistantRuntime ??
              aui.threads().__internal_getAssistantRuntime?.();
            const state = getThreadListItemState();
            if (!runtime || !state) {
              throw new Error("Prompt queue thread item is unavailable");
            }
            if (chatHistoryClearBoundary.capture() !== historyClearGeneration) {
              return;
            }
            shouldCorrectPersistedModel ??= !state.remoteId;
            const initializingFreshThread = !state.remoteId;
            // A fresh chat receives its remote id during initialization. Await it
            // before append so the adapter can match the queued settings using
            // unstable_threadId on its first invocation.
            const { remoteId } = await runtime.threads
              .getItemById(state.id)
              .initialize();
            if (initializingFreshThread) {
              initializedFreshThreadId = remoteId;
            }
            if (
              removeFreshThreadPersistedAfterAbort() ||
              cancelled ||
              !pendingSettingsIds.has(settingsId)
            ) {
              return;
            }
            addQueuedChatRunSettingsThreadIds(settingsId, [
              ...getQueueThreadIds(),
              remoteId,
            ]);
            if (shouldCorrectPersistedModel) {
              // initialize() persists a fresh thread using the live global model.
              // Correct that metadata to the model captured for this queued run
              // before any later navigation or compatibility check can observe it.
              await updateStoredChatThread(remoteId, {
                modelId: runSettingsAtQueueStart.params.checkpoint ?? "",
              });
              shouldCorrectPersistedModel = false;
              if (
                removeFreshThreadPersistedAfterAbort() ||
                cancelled ||
                !pendingSettingsIds.has(settingsId)
              ) {
                return;
              }
            }
            // Initialization can replace a fresh thread's local id with a remote
            // id. Refresh queue aliases before the run begins so stop dialogs
            // deduplicate the two identities.
            syncPromptQueueUI();
            const appendResult = thread.append(
              appendTextToThread(prompt),
            ) as unknown;
            freshThreadAppendAccepted = true;
            // Calling append synchronously accepts the user turn; its promise
            // follows the whole provider run. Do not turn a later paid/streaming
            // failure into an automatic duplicate dispatch.
            if (
              appendResult &&
              typeof (appendResult as Promise<void>).catch === "function"
            ) {
              void (appendResult as Promise<void>).catch(() => undefined);
            }
          } catch (error) {
            // A setup failure is retryable. Keep the initialized record unless a
            // concurrent stop or Clear all explicitly invalidated this queue.
            removeFreshThreadPersistedAfterAbort();
            pendingSettingsIds.delete(settingsId);
            discardQueuedChatRunSettings(settingsId);
            throw error;
          }
        },
        complete: discardOldestPendingSettings,
        cancel: () => {
          cancelled = true;
          removeFreshThreadPersistedAfterAbort();
          for (const settingsId of pendingSettingsIds) {
            discardQueuedChatRunSettings(settingsId);
          }
          pendingSettingsIds.clear();
          getThreadRuntime()?.cancelRun();
        },
        isIndexing: () =>
          promptQueueTargetMountedRef.current &&
          isTargetCurrentThread() &&
          indexingActiveRef.current,
        getQueueProjectId: () => projectIdAtQueueStart,
        usesThreadDocuments: usesThreadDocumentsAtQueueStart,
        usesKnowledgeBase: usesKnowledgeBaseAtQueueStart,
        usesLocalModel:
          parseExternalModelId(runSettingsAtQueueStart.params.checkpoint) ===
          null,
        usesDeepResearch: runSettingsAtQueueStart.deepResearchEnabled,
        temporary: incognitoAtQueueStart,
        consumeDeepResearch: () => {
          runSettingsAtQueueStart.deepResearchEnabled = false;
        },
      };
    }, [aui, referenceThreadId]);

  // Whether a pending start is already going to be refused when it resolves,
  // so a retry replaces it rather than being turned away as a duplicate and
  // leaving neither gesture to queue anything. Only the checks that need no
  // queue target are here; the model boundary stays with the reservation,
  // where usesLocalModel is known, so this can never be the stricter of the
  // two and start a second queue for the same prompt.
  const pendingQueueStartIsStale = useCallback(
    (pending: {
      cancelled: boolean;
      temporary: boolean;
      queuedSettingsEpoch: number;
      historyClearGeneration?: number;
    }): boolean => {
      if (pending.cancelled) return true;
      if (
        pending.historyClearGeneration !== undefined &&
        chatHistoryClearBoundary.capture() !== pending.historyClearGeneration
      ) {
        return true;
      }
      const chatState = useChatRuntimeStore.getState();
      return shouldAbortPendingQueueForSettingsChange({
        capturedEpoch: pending.queuedSettingsEpoch,
        currentEpoch: chatState.queuedSettingsEpoch,
        capturedTemporary: pending.temporary,
        currentTemporary: chatState.incognito,
      });
    },
    [],
  );

  const startHydratedPromptQueue = useCallback(
    (
      items: string[],
      waitForCurrentRun = false,
      onStarted?: () => void,
      onAborted?: () => void,
      // Captured before an awaited step that precedes this call, so a boundary
      // or setting changed during that step still invalidates the queue.
      capturedAt?: {
        localModelBoundaryGeneration: number;
        queuedSettingsEpoch: number;
        temporary: boolean;
      },
    ) => {
      const reservationKey = JSON.stringify([
        referenceThreadId,
        items,
        waitForCurrentRun,
      ]);
      // A reservation that is still going to start owns this prompt. One that
      // is already invalid is replaced, so the retry is the one that queues.
      const existing = promptQueueStartPendingRef.current.get(reservationKey);
      if (existing && !pendingQueueStartIsStale(existing)) {
        return false;
      }
      const reservation = {
        temporary:
          capturedAt?.temporary ?? useChatRuntimeStore.getState().incognito,
        cancelled: false,
        threadId: referenceThreadId,
        localModelBoundaryGeneration:
          capturedAt?.localModelBoundaryGeneration ??
          localPromptQueueModelBoundary.capture(),
        queuedSettingsEpoch:
          capturedAt?.queuedSettingsEpoch ??
          useChatRuntimeStore.getState().queuedSettingsEpoch,
      };
      promptQueueStartPendingRef.current.set(reservationKey, reservation);
      void createPromptQueueTarget()
        .then((target) => {
          const currentQueueSettings = useChatRuntimeStore.getState();
          const modelBoundaryInvalidated = target
            ? shouldAbortPendingQueueForModelBoundary({
                capturedGeneration: reservation.localModelBoundaryGeneration,
                usesLocalModel: target.usesLocalModel,
                modelLoading: currentQueueSettings.modelLoading,
              })
            : false;
          const settingsInvalidated = shouldAbortPendingQueueForSettingsChange({
            capturedEpoch: reservation.queuedSettingsEpoch,
            currentEpoch: currentQueueSettings.queuedSettingsEpoch,
            capturedTemporary: reservation.temporary,
            currentTemporary: currentQueueSettings.incognito,
          });
          if (
            target &&
            !reservation.cancelled &&
            !modelBoundaryInvalidated &&
            !settingsInvalidated &&
            promptQueueStartPendingRef.current.get(reservationKey) ===
              reservation
          ) {
            startPromptQueue(items, target, waitForCurrentRun);
            onStarted?.();
          } else if (
            promptQueueStartPendingRef.current.get(reservationKey) ===
            reservation
          ) {
            // Superseded reservations stay quiet: the one that replaced this
            // is still going, so nothing has been lost to report.
            onAborted?.();
          }
        })
        .catch((error) => {
          toast.error("Could not start prompt queue", {
            description:
              error instanceof Error ? error.message : "Please try again.",
          });
          onAborted?.();
        })
        .finally(() => {
          if (
            promptQueueStartPendingRef.current.get(reservationKey) ===
            reservation
          ) {
            promptQueueStartPendingRef.current.delete(reservationKey);
          }
        });
      return true;
    },
    [createPromptQueueTarget, pendingQueueStartIsStale, referenceThreadId],
  );

  // The queue carries text, and a long paste is text the composer parked in a
  // chip, so fold it back in rather than refusing to queue it as a file.
  const queuePastedTextPrompt = useCallback(
    (waitForCurrentRun: boolean): boolean => {
      const composer = aui.composer();
      const attachments = composer.getState().attachments;
      const files: File[] = [];
      for (const attachment of attachments) {
        const file = (attachment as { file?: File }).file;
        if (file === undefined || !isPastedTextFile(file)) return false;
        files.push(file);
      }
      if (files.length === 0) return false;

      const attachmentIds = attachments.map((attachment) => attachment.id);
      const textAtQueue = composer.getState().text.trim();
      const queueTexts = (
        texts: string[],
        // Captured before an awaited read, when there was one.
        capturedAt?: {
          localModelBoundaryGeneration: number;
          queuedSettingsEpoch: number;
          temporary: boolean;
        },
      ) => {
        const queuedPrompt = [textAtQueue, ...texts]
          .filter((part) => part.trim().length > 0)
          .join("\n\n");
        if (queuedPrompt.length === 0) return;
        startHydratedPromptQueue(
          [queuedPrompt],
          waitForCurrentRun,
          () => {
            const state = composer.getState();
            // Only clear the composer this prompt was queued from.
            if (
              state.text.trim() !== textAtQueue ||
              state.attachments.length !== attachmentIds.length ||
              !state.attachments.every(
                (attachment, index) => attachment.id === attachmentIds[index],
              )
            ) {
              return;
            }
            void composer.clearAttachments();
            flushResourcesSync(() => {
              composer.setText("");
            });
            clearStoredDraft();
            armJustSent(state.text);
          },
          () => {
            toast.info("Pasted text was not queued", {
              description: "The chat settings changed. Send it again.",
            });
          },
          capturedAt,
        );
      };

      // createPastedTextFile records the body under the File identity matched
      // above, so read it from there: a gesture that awaits the File joins the
      // queue behind any later one that does not, reversing the two.
      const cachedTexts: string[] = [];
      for (const file of files) {
        const text = pastedTextOf(file);
        if (text === undefined) break;
        cachedTexts.push(text);
      }
      if (cachedTexts.length === files.length) {
        queueTexts(cachedTexts);
        return true;
      }

      // Registered before the read, or a submit during it takes the send path
      // and this queues the same text again once the read finishes.
      const pendingKey = pastedTextQueueKey(
        referenceThreadId,
        textAtQueue,
        attachmentIds,
      );
      // The same intent as a read already running: report it handled rather
      // than queue a duplicate. A read whose baselines have gone stale will
      // abort, so it must not absorb the retry either.
      const inFlight = pastedTextQueuePendingRef.current.get(pendingKey);
      if (inFlight && !pendingQueueStartIsStale(inFlight)) return true;
      // Every baseline the reservation would otherwise take after the read, so
      // a setting or boundary changed during it still aborts the queue.
      const chatState = useChatRuntimeStore.getState();
      const pendingRead = {
        temporary: chatState.incognito,
        cancelled: false,
        threadId: referenceThreadId,
        // The chat the read began in. The target is anchored after the read,
        // so a switch mid-read would otherwise dispatch into the new chat.
        composerIdentity: composerIdentityRef.current,
        localModelBoundaryGeneration: localPromptQueueModelBoundary.capture(),
        queuedSettingsEpoch: chatState.queuedSettingsEpoch,
        historyClearGeneration: chatHistoryClearBoundary.capture(),
      };
      // Replaces a stale read under the same key. That read still resolves, but
      // it no longer owns the key, so its own start is skipped and only this
      // one can queue.
      pastedTextQueuePendingRef.current.set(pendingKey, pendingRead);
      void Promise.all(files.map((file) => file.text()))
        .then((texts) => {
          // Stopped, cleared, replaced, or aimed at another chat while the
          // read was in flight.
          if (
            pendingQueueStartIsStale(pendingRead) ||
            composerIdentityRef.current !== pendingRead.composerIdentity ||
            pastedTextQueuePendingRef.current.get(pendingKey) !== pendingRead
          ) {
            return;
          }
          queueTexts(texts, pendingRead);
        })
        .catch(() => {
          toast.error("Could not queue the pasted text.", {
            description: "Show it in the text field, then send it again.",
          });
        })
        .finally(() => {
          if (
            pastedTextQueuePendingRef.current.get(pendingKey) === pendingRead
          ) {
            pastedTextQueuePendingRef.current.delete(pendingKey);
          }
        });
      return true;
    },
    [
      armJustSent,
      aui,
      clearStoredDraft,
      pendingQueueStartIsStale,
      referenceThreadId,
      startHydratedPromptQueue,
    ],
  );

  // Queue whatever the composer holds. Hoisted out of handleSubmit because the
  // parked-send release needs it too and cannot reach that closure. Reads the
  // live composer, not the rendered text, which at release time can be a commit
  // behind.
  const queueComposerText = useCallback(
    (waitForCurrentRun: boolean) => {
      const queuedPrompt = aui.composer().getState().text.trim();
      if (!queuedPrompt) {
        return;
      }
      startHydratedPromptQueue([queuedPrompt], waitForCurrentRun, () => {
        // Guard the untrimmed text too: that is what a late write carries.
        const cleared = aui.composer().getState().text;
        if (cleared.trim() !== queuedPrompt) {
          return;
        }
        flushResourcesSync(() => {
          aui.composer().setText("");
        });
        clearStoredDraft();
        armJustSent(queuedPrompt, cleared);
      });
    },
    [armJustSent, aui, clearStoredDraft, startHydratedPromptQueue],
  );

  const dismissWaitToast = useCallback(() => {
    if (waitToastRef.current !== null) {
      toast.dismiss(waitToastRef.current);
      waitToastRef.current = null;
    }
  }, []);

  // Declared here because cancelQueuedSend has to clear the dictation hold too.
  const sendAfterDictationRef = useRef(false);
  // Composer text while a send waits on dictationBlocked, so an edit can drop it.
  const heldTextRef = useRef<string | null>(null);

  const cancelQueuedSend = useCallback(() => {
    pendingSendRef.current = false;
    pendingSendForceQueueRef.current = false;
    setPendingSend(false);
    // A dictation send held behind the same block would otherwise fire alone.
    sendAfterDictationRef.current = false;
    heldTextRef.current = null;
    dismissWaitToast();
  }, [dismissWaitToast]);
  cancelQueuedSendRef.current = cancelQueuedSend;

  const enqueueSend = useCallback(
    (
      waitingOn:
        "indexing" | "images" | "audio" | "video" | "settings" = "indexing",
    ) => {
      if (pendingSendRef.current) return;
      pendingSendRef.current = true;
      setPendingSend(true);
      const title =
        waitingOn === "images"
          ? "Waiting for dropped images"
          : waitingOn === "audio"
            ? "Waiting for dropped audio"
            : waitingOn === "video"
              ? "Waiting for dropped video"
              : waitingOn === "settings"
                ? "Loading this chat's settings"
                : "Waiting for documents to finish indexing";
      waitToastRef.current = toast(title, {
        description:
          "Your message will send automatically once they are ready.",
        duration: Infinity,
        cancel: { label: "Cancel", onClick: cancelQueuedSend },
      });
    },
    [cancelQueuedSend],
  );

  // A materializing image or clip is a wait, not a refusal: park the send.
  // Both gates share this so they cannot disagree on what is recoverable.
  const parkIfWaitingOnAttachments = useCallback(() => {
    if (
      disabled ||
      overlay ||
      (!hasMaterializingImageAttachments &&
        !hasMaterializingAudioAttachments &&
        !hasMaterializingVideoAttachments) ||
      !hasSendableContent ||
      isComposingRef.current ||
      hasPendingAttachments
    ) {
      return;
    }
    // Name what is actually being waited on, or a parked video drop reports
    // itself as audio.
    enqueueSend(
      hasMaterializingImageAttachments
        ? "images"
        : hasMaterializingAudioAttachments
          ? "audio"
          : "video",
    );
  }, [
    disabled,
    overlay,
    hasMaterializingImageAttachments,
    hasMaterializingAudioAttachments,
    hasMaterializingVideoAttachments,
    hasSendableContent,
    hasPendingAttachments,
    isComposingRef,
    enqueueSend,
  ]);

  const shouldBlockSend = useCallback(
    () =>
      !hasSendableContent ||
      isComposingRef.current ||
      hasPendingAttachments ||
      hasMaterializingImageAttachments ||
      hasMaterializingAudioAttachments ||
      hasMaterializingVideoAttachments,
    [
      hasMaterializingAudioAttachments,
      hasMaterializingVideoAttachments,
      hasMaterializingImageAttachments,
      hasPendingAttachments,
      hasSendableContent,
      isComposingRef,
    ],
  );

  // alsoGuard: text the composer showed before this path rewrote it, so a late
  // write carrying what the user actually typed is refused too.
  const sendReservedComposer = useCallback(
    (...alsoGuard: string[]) => {
      const assistantRuntime = aui.threads().__internal_getAssistantRuntime?.();
      let reservationToken: symbol | null = null;
      reservationToken = reservePreStreamRun(preStreamThreadIds, {
        usesLocalModel:
          parseExternalModelId(
            useChatRuntimeStore.getState().params.checkpoint,
          ) === null,
        cancel: (reservedThreadIds) => {
          if (preStreamRunReservationRef.current === reservationToken) {
            preStreamRunReservationRef.current = null;
          }
          for (const reservedThreadId of reservedThreadIds) {
            try {
              assistantRuntime?.threads.getById(reservedThreadId).cancelRun();
              return;
            } catch {
              // Thread hydration can retire an alias; try the next captured id.
            }
          }
        },
      });
      if (!reservationToken) {
        toast.error("Wait for the current response to finish");
        return;
      }
      preStreamRunReservationRef.current = reservationToken;
      try {
        const sentText = aui.composer().getState().text;
        aui.composer().send();
        // Empty texts are dropped, so an attachment-only send still clears.
        armJustSent(sentText, ...alsoGuard);
      } catch (error) {
        if (releasePreStreamRunReservation(reservationToken)) {
          notifyPromptQueueRunFailed(referenceThreadId);
        }
        preStreamRunReservationRef.current = null;
        toast.error("Could not prepare attachments", {
          description:
            error instanceof Error ? error.message : "Please retry the send.",
        });
      }
    },
    [aui, armJustSent, preStreamThreadIds, referenceThreadId],
  );

  // Gate for both form submit and the Send button. Returns true when it handled
  // the event (blocked or queued) so callers stop.
  const interceptSend = useCallback(
    (event: { preventDefault: () => void }) => {
      if (disabled || shouldBlockSend()) {
        event.preventDefault();
        parkIfWaitingOnAttachments();
        return true;
      }
      if (indexingActive && !overlay) {
        event.preventDefault();
        enqueueSend();
        return true;
      }
      // This chat's own settings have been asked for and have not arrived, so the store
      // is showing the installation defaults and the run would be captured with them:
      // a chat stored as "ask" could run tools without asking. Park it like any other
      // wait, so the click still counts and the send fires once the snapshot lands.
      if (threadScopedSettingsPending && !overlay) {
        event.preventDefault();
        enqueueSend("settings");
        return true;
      }
      return false;
    },
    [
      disabled,
      shouldBlockSend,
      indexingActive,
      overlay,
      threadScopedSettingsPending,
      enqueueSend,
      parkIfWaitingOnAttachments,
    ],
  );

  // Fire the parked send once indexing clears, unless the user emptied the
  // composer while waiting (then drop it quietly). An image dropped after the
  // send was parked has to land first, or indexing finishing early sends the
  // text without it and the image attaches to the next draft.
  useEffect(() => {
    // pendingSendRef too: a cancel earlier in this same commit has already
    // dropped the send, while `pendingSend` still reads true from this render.
    if (
      !pendingSend ||
      !pendingSendRef.current ||
      indexingActive ||
      threadScopedSettingsPending ||
      hasMaterializingImageAttachments ||
      hasMaterializingAudioAttachments ||
      hasMaterializingVideoAttachments
    ) {
      return;
    }
    const { text, attachments } = aui.composer().getState();
    const forceQueue = pendingSendForceQueueRef.current;
    pendingSendRef.current = false;
    pendingSendForceQueueRef.current = false;
    setPendingSend(false);
    dismissWaitToast();
    if (text.trim().length > 0 || attachments.length > 0) {
      clearStoredDraft();
      if (forceQueue) {
        // Wait mode read now, not carried from the parked submit: a run can
        // start while the settings load, and ignoring it would dispatch on top
        // of the response already streaming.
        const waitForCurrentRun = aui.thread().getState().isRunning;
        // The chord's own two branches from handleSubmit, in the same order. A
        // long paste lives in an attachment, so queueing the text alone queues
        // nothing at all when that is all there is.
        if (canQueueCurrentPrompt) {
          queueComposerText(waitForCurrentRun);
          return;
        }
        if (
          canQueuePastedTextPrompt &&
          queuePastedTextPrompt(waitForCurrentRun)
        ) {
          return;
        }
        // Nothing queueable: send, as this path did before it carried intent.
      }
      sendReservedComposer();
    }
  }, [
    pendingSend,
    indexingActive,
    threadScopedSettingsPending,
    hasMaterializingImageAttachments,
    hasMaterializingAudioAttachments,
    hasMaterializingVideoAttachments,
    aui,
    canQueueCurrentPrompt,
    canQueuePastedTextPrompt,
    clearStoredDraft,
    dismissWaitToast,
    queueComposerText,
    queuePastedTextPrompt,
    sendReservedComposer,
  ]);

  // Drop any queued send + toast on unmount (e.g. thread switch).
  useEffect(
    () => () => {
      pendingSendRef.current = false;
      pendingSendForceQueueRef.current = false;
      if (waitToastRef.current !== null) toast.dismiss(waitToastRef.current);
    },
    [],
  );

  // Recording bar's send: stop dictating, then submit once the transcript
  // lands. Going through the form keeps queueing, indexing holds and draft
  // clearing identical to a typed send.
  const formRef = useRef<HTMLFormElement | null>(null);
  // Mirrored into state so the publish effect re-runs when the node mounts: a
  // ref mutation does not re-render. See usePublishedFrame.
  const [composerEl, setComposerEl] = useState<HTMLFormElement | null>(null);
  const attachComposer = useCallback((node: HTMLFormElement | null) => {
    formRef.current = node;
    setComposerEl(node);
  }, []);
  // The composer docks to the bottom of the viewport once a thread has turns,
  // in the same column the corner overlay stack occupies. Published so the
  // stack lifts above it rather than covering the Send button.
  //
  // Coverable, though: in a window too short to hold the update cards above it
  // there is no arrangement that dodges the composer AND shows them whole, and
  // a card clipped at the rail's edge looks like it has slid behind the page.
  // The stack takes the corner and paints over the composer there instead.
  usePublishedFrame(composerEl, { coverable: true });
  const dictationBaseTextRef = useRef("");
  const dictationComposerRef = useRef("");
  // Thread switches reuse this composer, so the send has to know where it
  // started to avoid submitting the destination thread's draft. The list item
  // id, not referenceThreadId: that one moves from null to the remote id when
  // a new chat first persists, which is the same composer.
  const composerIdentity = threadListItemId ?? "";
  composerIdentityRef.current = composerIdentity;
  const sendAfterDictation = useCallback(() => {
    sendAfterDictationRef.current = true;
    dictationComposerRef.current = composerIdentity;
    aui.composer().stopDictation();
  }, [aui, composerIdentity]);

  // One gate for the recording bar's send: it greys the button out, and holds
  // a pending send when the composer changes under it after the press.
  const dictationBlocked = dictationSendBlocked({
    composerDisabled: Boolean(disabled),
    uploading:
      hasPendingAttachments ||
      hasMaterializingImageAttachments ||
      hasMaterializingAudioAttachments ||
      hasMaterializingVideoAttachments,
    researchActive: isResearchActive,
    runActive: threadIsRunning || promptQueueActive,
    queueDisabled: Boolean(disableQueue),
    hasOverlay: Boolean(overlay),
    hasAttachments,
    hasPendingAudio,
  });
  const wasDictatingRef = useRef(false);
  useEffect(() => {
    if (isDictating) {
      if (wasDictatingRef.current) return;
      wasDictatingRef.current = true;
      // A new recording supersedes a send still held for an upload.
      sendAfterDictationRef.current = false;
      heldTextRef.current = null;
      // Text at session start is the dictation base. Anchor on it, not on the
      // text when send was pressed: the browser engine streams interim results
      // into the composer, so a final matching its interim would look unchanged.
      dictationBaseTextRef.current = aui.composer().getState().text;
      return;
    }
    wasDictatingRef.current = false;
    if (!sendAfterDictationRef.current) return;
    // A partial transcript (a failed chunk, or an engine error after one
    // landed) belongs in the composer, but must not send half a message.
    // Silence, a thread switch mid-transcription, or a plus-menu insertion
    // with no speech: keep the draft, submit nothing. Settled before the hold
    // below, so nothing to send never leaves an intent pending.
    const text = composerText;
    const sendable =
      !dictationFailed() &&
      shouldSubmitDictation({
        originComposer: dictationComposerRef.current,
        currentComposer: composerIdentity,
        producedTranscript: dictationProducedTranscript(),
        baseText: dictationBaseTextRef.current,
        text,
      });
    if (!sendable) {
      sendAfterDictationRef.current = false;
      heldTextRef.current = null;
      return;
    }
    // The plus stays live while transcribing, so an upload or an attachment
    // can appear after the press. Keep the intent until the composer accepts
    // a submit again, rather than spending it on one that would bounce.
    if (dictationBlocked) {
      // The bar is gone by now, so the hold is invisible. It lasts only as
      // long as the transcript it was pressed for: editing hands control
      // back, rather than sending that edit when the block clears.
      if (heldTextRef.current === null) {
        heldTextRef.current = text;
      } else if (heldTextRef.current !== text) {
        sendAfterDictationRef.current = false;
        heldTextRef.current = null;
      }
      return;
    }
    sendAfterDictationRef.current = false;
    heldTextRef.current = null;
    formRef.current?.requestSubmit();
  }, [isDictating, aui, composerIdentity, dictationBlocked, composerText]);

  const handleSubmit = useCallback(
    (event: { preventDefault: () => void; stopPropagation?: () => void }) => {
      // Read once per submit: a rejected send must not leave it armed.
      const forceQueue = forceQueueRef.current;
      forceQueueRef.current = false;
      const workspacePathInDraft = extractAbsoluteFolderPath(
        aui.composer().getState().text,
      );
      if (workspacePathInDraft && activeProjectId) {
        event.preventDefault();
        // assistant-ui is still committing its resource tree while submit is
        // dispatched. Deferring avoids a nested React update that can roll its
        // internal version back below the committed version.
        queueMicrotask(() => setWorkspacePathOffer(workspacePathInDraft));
        return;
      }
      if (isResearchActive) {
        event.preventDefault();
        return;
      }
      if (disabled || shouldBlockSend()) {
        event.preventDefault();
        parkIfWaitingOnAttachments();
        return;
      }
      // Before the queue branch below, not after it: a prompt queued while this chat's
      // own settings are still on their way is snapshotted from the installation
      // defaults on screen, so a chat stored as "ask" would queue as "off".
      if (threadScopedSettingsPending && !overlay) {
        event.preventDefault();
        // The intent rides with the parked send; the release reads it back.
        if (forceQueue) {
          pendingSendForceQueueRef.current = true;
        }
        enqueueSend("settings");
        return;
      }

      // React may not have rendered threadIsRunning yet when several submits
      // arrive immediately after a send. The imperative runtime is already
      // current, so use it (and the live queue store) for this decision.
      const liveThreadIsRunning =
        threadIsRunning || aui.thread().getState().isRunning;
      const livePromptQueueActive =
        promptQueueActive ||
        hasPendingPromptQueueStart(
          promptQueueStartPendingRef.current.values(),
          referenceThreadId,
        ) ||
        hasPendingPromptQueueStart(
          pastedTextQueuePendingRef.current.values(),
          referenceThreadId,
        ) ||
        Boolean(
          findPromptQueueEntry(
            usePromptQueueUI.getState(),
            promptQueueThreadIds,
          ),
        );
      const livePreStreamRunActive =
        hasPreStreamRunReservation(preStreamThreadIds);

      if (
        liveThreadIsRunning ||
        livePromptQueueActive ||
        livePreStreamRunActive
      ) {
        event.preventDefault();
        // Project new-chat composer: never queue, just ask the user to wait.
        if (disableQueue) {
          toast.error("Wait for the current response to finish");
          return;
        }
        if (!canQueueCurrentPrompt) {
          if (
            canQueuePastedTextPrompt &&
            queuePastedTextPrompt(liveThreadIsRunning || livePreStreamRunActive)
          ) {
            return;
          }
          if (overlay || hasAttachments || hasPendingAudio) {
            toast.error(
              liveThreadIsRunning
                ? "Wait for the current response to finish"
                : "Wait for the prompt queue to finish",
              {
                description:
                  "Only text prompts can be queued while a response is running or the prompt queue is active.",
              },
            );
          }
          return;
        }
        queueComposerText(liveThreadIsRunning || livePreStreamRunActive);
        return;
      }

      // Cmd/Ctrl+Enter queues even with nothing running, so prompts can be
      // stacked up front. The queue dispatches this one immediately; the next
      // Cmd/Ctrl+Enter lands behind it.
      if (forceQueue && !disableQueue) {
        if (canQueueCurrentPrompt) {
          event.preventDefault();
          queueComposerText(false);
          return;
        }
        if (canQueuePastedTextPrompt) {
          event.preventDefault();
          if (queuePastedTextPrompt(false)) {
            return;
          }
        }
      }

      if (interceptSend(event)) return;

      if (overlay) {
        const trimmed = composerText.trim();
        if (!trimmed) {
          event.preventDefault();
          return;
        }
        if (!overlay.openaiImageGenerationCallId) {
          event.preventDefault();
          toast.error("This generated image cannot be edited", {
            description:
              "The original image reference is missing. Generate the image again, then retry the edit.",
          });
          closeOverlay();
          return;
        }
        if ((overlay.threadId ?? null) !== referenceThreadId) {
          event.preventDefault();
          toast.error("This generated image belongs to another chat", {
            description: "Open the original chat and retry the edit.",
          });
          closeOverlay();
          return;
        }
        clearStoredDraft();
        setImageToolsEnabled(true);
        setPendingImageEditReference({
          threadId: overlay.threadId ?? referenceThreadId,
          openaiImageGenerationCallId: overlay.openaiImageGenerationCallId,
          ...(overlay.openaiResponseId
            ? { openaiResponseId: overlay.openaiResponseId }
            : {}),
          openaiReasoningItem: overlay.openaiReasoningItem,
        });
        // Live, not composerText: a late DOM write carries exactly what the
        // textarea held, whitespace and all, and that is what must be armed.
        const visibleBeforeWrap = aui.composer().getState().text;
        flushResourcesSync(() => {
          aui
            .composer()
            .setText(
              `Use the selected generated image as the reference and apply this edit: ${trimmed}. Preserve everything else exactly.`,
            );
        });
        closeOverlay();
        event.preventDefault();
        // The wrapper replaced what the user typed, so guard that text as well.
        sendReservedComposer(visibleBeforeWrap, trimmed);
        return;
      }

      if (hasAttachments || hasPendingAudio) {
        event.preventDefault();
        clearStoredDraft();
        sendReservedComposer();
        return;
      }
      event.preventDefault();
      clearStoredDraft();
      sendReservedComposer();
    },
    [
      aui,
      canQueueCurrentPrompt,
      canQueuePastedTextPrompt,
      queueComposerText,
      queuePastedTextPrompt,
      clearStoredDraft,
      closeOverlay,
      composerText,
      disabled,
      disableQueue,
      hasAttachments,
      hasPendingAudio,
      enqueueSend,
      interceptSend,
      isResearchActive,
      overlay,
      parkIfWaitingOnAttachments,
      threadScopedSettingsPending,
      promptQueueActive,
      promptQueueThreadIds,
      preStreamThreadIds,
      referenceThreadId,
      setImageToolsEnabled,
      setPendingImageEditReference,
      sendReservedComposer,
      shouldBlockSend,
      threadIsRunning,
    ],
  );

  const stopQueue = useCallback(() => {
    stopPromptQueueRunForThreadIds(promptQueueThreadIds);
  }, [promptQueueThreadIds]);

  const startQueue = useCallback(
    (
      items: string[],
      waitForCurrentRun = threadIsRunning || aui.thread().getState().isRunning,
      onAborted?: () => void,
    ) => {
      // Saved-prompt Run-list calls this directly, so honour disableQueue here
      // too: queuing from the project new-chat composer misbinds the thread.
      if (disableQueue) return false;
      return startHydratedPromptQueue(
        items,
        waitForCurrentRun,
        undefined,
        onAborted,
      );
    },
    [aui, startHydratedPromptQueue, threadIsRunning, disableQueue],
  );

  const queueContextValue: PromptQueueCallbacks = { startQueue, stopQueue };

  const composerContent = (
    <>
      {!isDictating ? (
        <>
          <ComposerAttachments />
          <PendingAudioChip />
        </>
      ) : null}
      {/* Keep indexing state subscribed while dictating, but hide its chips so
          the waveform stays the composer's only status indicator. */}
      <div className={isDictating ? "hidden" : "contents"}>
        <ThreadDocumentsBar
          threadId={referenceThreadId}
          onIndexingChange={handleIndexingChange}
        />
      </div>
      {!isDictating ? <ToolStatusDisplay /> : null}
      <div
        className="unsloth-composer-line"
        // The permission pill is always visible, so keep the two-row layout
        // expanded whenever not dictating; dictation collapses to the bar.
        data-expanded={!isDictating ? "true" : "false"}
        data-dictating={isDictating ? "true" : undefined}
      >
        <div
          ref={pillRowRef}
          className="unsloth-composer-left"
          data-pill-compact={pillCompact}
        >
          <ComposerToolsMenu
            side={effectiveMenuSide}
            researchAvailable={!researchUsed}
          />
          {/* While dictating, show only the "+"; hide the pill and tool toggles
              so the waveform is the sole status indicator. */}
          {!isDictating ? (
            <>
              {/* Permission-level pill: always visible, opens the level dropdown. */}
              <PermissionModeComposerPill side={effectiveMenuSide} />
              {effectiveDeepResearchEnabled ? (
                <DeepResearchComposerButton
                  onConfigure={() => setResearchWebsiteAccessOpen(true)}
                />
              ) : null}
              <WebSearchToggle />
              <CodeToolsToggle />
              <ImagesToggle />
              <KnowledgeBaseComposerButton side={effectiveMenuSide} />
              {artifactsEnabled ? <ArtifactsToggle /> : null}
              {mcpEnabledForChat ? (
                <McpComposerButton side={effectiveMenuSide} />
              ) : null}
            </>
          ) : null}
        </div>
        {isDictating ? (
          // The recording UI replaces the input and send controls; only the
          // left plus stays visible alongside it.
          <ChatDictationBar
            onSend={sendAfterDictation}
            // Every state handleSubmit rejects, since it would reject after
            // transcription with the send intent already spent. Text presence
            // is left out: the transcript supplies it.
            sendDisabled={dictationBlocked}
          />
        ) : (
          <>
            <ComposerPrimitive.Input
              placeholder={
                placeholder ??
                (overlay
                  ? t("chat.composer.imageEditPlaceholder")
                  : t("chat.composer.askAnything"))
              }
              ref={inputRef}
              className="aui-composer-input unsloth-composer-input"
              minRows={1}
              maxRows={12}
              autoFocus={!disabled}
              disabled={disabled}
              aria-label={overlay ? "Image edit instructions" : "Message input"}
              // dir="auto": browser picks LTR/RTL from the first strong char;
              // no effect on Latin / CJK / Devanagari.
              dir="auto"
              {...inputProps}
              addAttachmentOnPaste={false}
              onPaste={handleFilePaste}
            />
            <ComposerRightControls
              disabled={
                disabled ||
                !hasSendableContent ||
                isComposing ||
                hasPendingAttachments
              }
              // disableQueue (project new-chat composer) also blocks the queue
              // button, so a running thread shows Stop instead of Queue.
              queueDisabled={
                disableQueue ||
                !(canQueueCurrentPrompt || canQueuePastedTextPrompt)
              }
              onQueueClick={() => {
                if (disableQueue) return;
                // Same pasted-text path the Enter key takes, or the button
                // would refuse what submitting the form accepts.
                if (canQueuePastedTextPrompt && queuePastedTextPrompt(true)) {
                  return;
                }
                const queuedPrompt = composerText.trim();
                if (queuedPrompt.length === 0) {
                  return;
                }
                startHydratedPromptQueue([queuedPrompt], true, () => {
                  const cleared = aui.composer().getState().text;
                  if (cleared.trim() !== queuedPrompt) {
                    return;
                  }
                  flushResourcesSync(() => {
                    aui.composer().setText("");
                  });
                  clearStoredDraft();
                  armJustSent(queuedPrompt, cleared);
                });
              }}
              // ComposerPrimitive.Send handles clicks itself rather than
              // submitting the form, so run the complete queue/capacity path.
              onSendClick={handleSubmit}
              onStopClick={stopQueue}
              pendingSend={pendingSend}
              menuSide={effectiveMenuSide}
              queueThreadIds={promptQueueThreadIds}
            />
          </>
        )}
      </div>
      {!isDictating ? (
        <div className="thread-workspace-strip">
          <ThreadWorkspaceChip />
        </div>
      ) : null}
      <DeepResearchWebsiteAccessDialog
        open={researchWebsiteAccessOpen && effectiveDeepResearchEnabled}
        onOpenChange={setResearchWebsiteAccessOpen}
      />
    </>
  );

  return (
    <PromptQueueContext.Provider value={queueContextValue}>
      <ComposerPrimitive.Unstable_TriggerPopoverRoot>
        <ComposerPrimitive.Root
          ref={attachComposer}
          className="aui-composer-root relative flex w-full flex-col"
          aria-disabled={disabled}
          onSubmit={handleSubmit}
        >
          <ComposerMentions threadId={referenceThreadId} />
          <PromptQueueStack queueThreadIds={promptQueueThreadIds} />
          {youtubeOfferUrl && !isDictating && !disabled ? (
            // Keyed by URL: pasting a second link while the first is still fetching
            // remounts the prompt, so its cleanup aborts the request that is no
            // longer the one on offer.
            <YoutubeTranscriptPrompt
              key={youtubeOfferUrl}
              url={youtubeOfferUrl}
              onClose={() => setYoutubeLink(null)}
            />
          ) : null}
          {workspacePathOffer &&
          activeProjectId &&
          !isDictating &&
          !disabled ? (
            <div className="mb-2 flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-muted/60 px-3 py-2 text-sm">
              <HugeiconsIcon
                icon={Folder01Icon}
                className="size-4 shrink-0 text-primary"
                strokeWidth={1.8}
              />
              <span className="min-w-0 flex-1">
                {t("projectsPage.connectPastedFolder")}{" "}
                <span className="font-medium">{workspacePathOffer}</span>
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void connectOfferedWorkspace("read")}
              >
                {t("projectsPage.workspaceReadOnly")}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void connectOfferedWorkspace("write")}
              >
                {t("projectsPage.workspaceAllowEdits")}
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                aria-label={t("projectsPage.dismissFolderConnection")}
                onClick={() => setWorkspacePathOffer(null)}
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          ) : null}
          {isTauri ? (
            // Phase 1 native model owns Tauri local-path drops. Restore browser
            // attachment drops in Tauri once Phase 1d adds token bridging.
            <div className="aui-composer-attachment-dropzone unsloth-composer-surface relative z-10">
              {modelSelector ? (
                <div className="flex min-w-0 items-center px-1.5 pb-2">
                  {modelSelector}
                </div>
              ) : null}
              {composerContent}
            </div>
          ) : (
            <ComposerPrimitive.AttachmentDropzone className="group/dropzone aui-composer-attachment-dropzone unsloth-composer-surface relative z-10">
              {modelSelector ? (
                <div className="flex min-w-0 items-center px-1.5 pb-2">
                  {modelSelector}
                </div>
              ) : null}
              {composerContent}
              {/* Gemini-style drop affordance, shown while a file is dragged over
              the composer. Absolute + pointer-events-none so the outline adds
              no layout shift and the drop still lands. */}
              <div
                className={cn(
                  "aui-composer-drop-overlay pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 overflow-hidden rounded-[32px] bg-background/90 opacity-0 backdrop-blur-sm transition-opacity duration-150 group-data-[dragging=true]/dropzone:opacity-100 dark:bg-card/90",
                  pageDragging && "opacity-100",
                )}
              >
                <HugeiconsIcon
                  icon={AttachmentIcon}
                  strokeWidth={2}
                  className="size-6 text-primary"
                />
                <span className="text-sm font-medium text-primary">
                  Drop files here
                </span>
              </div>
            </ComposerPrimitive.AttachmentDropzone>
          )}
        </ComposerPrimitive.Root>
      </ComposerPrimitive.Unstable_TriggerPopoverRoot>
    </PromptQueueContext.Provider>
  );
};
