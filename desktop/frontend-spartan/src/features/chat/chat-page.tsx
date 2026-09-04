
import {
  applyModelLoadConfigToRuntime,
  currentRuntimePerModelConfig,
  type DeletedModelRef,
  type ExternalConnectionRef,
  type ExternalModelOption,
  type LoraModelOption,
  missingExternalModel,
  type ModelOption,
  ModelSelector,
  type ModelSelectorChangeMeta,
  type PerModelConfig,
  resolveInitialConfig,
  SidebarModelConfig,
  useActiveModelConfig,
} from "@/features/model-picker";
import {
  ChatComposerModelSelectorProvider,
  ProjectComposer,
  Thread,
} from "@/components/assistant-ui/thread";
import { useT } from "@/i18n";
import { useOnlineStatus } from "@/features/hub";
import { CopyableErrorChip } from "@/components/ui/copyable-error-chip";
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
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DOWNLOAD_KIND,
  downloadManager,
  useRepoDownload,
} from "@/features/hub/download-manager";
import {
  INVENTORY_FRESHNESS_WINDOW_MS,
  useDeviceInventorySources,
} from "@/features/hub/inventory";
import { DeleteChatFilesSwitch } from "./components/delete-chat-files-switch";
import { chatLocalModelOptions } from "./local-model-options";
import {
  type NativeIntent,
  NativeAttachmentTargetContext,
  NativeModelChip,
  NativeModelDropOverlay,
  useNativeIntentStore,
  useNativeModelDrop,
  useNativePathLeasesSupported,
} from "@/features/native-intents";
import { GuidedTour, useGuidedTourController } from "@/features/tour";
import { isTauri } from "@/lib/api-base";
import { chatModelLoaded } from "./lib/chat-model-loaded";
import { hasKnownContextWindow } from "./lib/context-window-known";
import { isDownloadCancelled } from "@/lib/native-files";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import {
  CONVERSATION_MARKDOWN_FORMAT,
  CONVERSATION_MARKDOWN_LABEL,
} from "./utils/conversation-markdown";
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
  LayoutAlignRightIcon,
  MoreHorizontalIcon,
  MoreVerticalIcon,
  PinIcon,
  PinOffIcon,
  PencilEdit02Icon,
  Telescope02Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useNavigate } from "@tanstack/react-router";
import { Tooltip as TooltipPrimitive } from "radix-ui";
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
import type { PanelImperativeHandle } from "react-resizable-panels";
import { notifyChatHistoryUpdated } from "./api/chat-api";
import { codeToolCanRun } from "./api/code-tool-placement";
import { ArtifactSurface } from "./artifacts/artifact-surface";
import {
  clearAutoOpenedArtifacts,
  useChatArtifactsStore,
  useSelectedChatArtifact,
} from "./artifacts/store";
import type { ChatArtifact, ChatArtifactSurface } from "./artifacts/types";
import { ChatSettingsPanel } from "./chat-settings-sheet";
import {
  ResearchActivityPanel,
  ResearchActivitySheet,
} from "./components/research-activity-panel";
import { ChatModelNotice } from "./components/chat-model-notice";
import { chatModelSwitchMeta } from "./components/chat-model-notice-switch";
import { ContextUsageBar } from "./components/context-usage-bar";
import { ModelLoadInlineStatus } from "./components/model-load-status";
import { ProjectSwitcher } from "./components/project-switcher";
import {
  buildExternalModelId,
  isExternalModelId,
  parseExternalModelId,

  providerModelSupportsStudioTools,
} from "./external-providers";
import { useChatModelRuntime } from "./hooks/use-chat-model-runtime";
import type { SelectedModelInput } from "./hooks/use-chat-model-runtime";
import {
  deleteChatProject,
  moveChatItemToProject,
  renameChatProject,
  useChatProjects,
} from "./hooks/use-chat-projects";
import {
  type SidebarItem,
  archiveChatItem,
  deleteChatItem,
  renameChatItem,
  useChatSidebarItems,
} from "./hooks/use-chat-sidebar-items";
import { usePinnedChatsStore } from "./stores/pinned-chats-store";
import { usePinnedProjectsStore } from "./stores/pinned-projects-store";
import {
  clampReasoningEffortToLevels,
  getExternalReasoningCapabilities,
  getProviderCapabilities,
  providerHostsCodeExecution,
  providerSupportsBuiltinCodeExecution,
  providerSupportsBuiltinImageGeneration,
  providerSupportsBuiltinWebFetch,
  providerSupportsBuiltinWebSearch,
} from "./provider-capabilities";
import {
  ChatActiveContext,
  ChatRuntimeProvider,
  useChatActive,
} from "./runtime-provider";
import { CompareContent, modelMatchesDeleted } from "./components/compare-content";
import { ProjectLanding } from "./components/project-landing";
import { SingleContent } from "./components/single-content";
import {
  type ChatSearch,
  type PendingHubAutoLoad,
  getExternalProviderDropdownRank,
  messageHasImage,
  normalizeModelRef,
  validateChatSearch,
} from "./components/chat-page-helpers";
export { validateChatSearch, type ChatSearch };
import { BypassPermissionsConfirmDialog } from "./bypass-permissions-menu-item";
import {
  CHAT_CODE_TOOLS_ENABLED_KEY,
  CHAT_IMAGE_TOOLS_ENABLED_KEY,
  CHAT_TOOLS_ENABLED_KEY,
  CHAT_WEB_FETCH_TOOLS_ENABLED_KEY,
  PENDING_CHAT_ATTACHMENT_KEY,
  hasGgufSource,
  isDownloadableHubRepo,
  loadOptionalBool,
  readPendingAttachmentTargetClaim,
  threadScopedOverride,
  useChatRuntimeStore,
} from "./stores/chat-runtime-store";
import { useChatPreferencesStore } from "./stores/chat-preferences-store";
import { useResearchRunStore } from "./stores/research-run-store";
import { useExternalProvidersStore } from "./stores/external-providers-store";
import { buildChatTourSteps } from "./tour";
import type { ChatView, MessageRecord } from "./types";
import { clearNewChatDraft } from "./utils/composer-draft";
import {
  getStoredChatThread,
  isExpectedBackgroundChatStorageError,
  listStoredChatMessages,
  listStoredChatThreads,
} from "./utils/chat-history-storage";
import { requestTemporaryPromptQueueStop } from "./utils/prompt-queue-boundary";
import { isAssistantLocalThreadId } from "./utils/thread-ids";

export function ChatPage({
  search,
  active,
}: { search: ChatSearch; active: boolean }): ReactElement {
  const navigate = useNavigate();
  const t = useT();

  const settingsOpen = useChatRuntimeStore((s) => s.settingsPanelOpen);
  const setSettingsOpen = useChatRuntimeStore((s) => s.setSettingsPanelOpen);
  const incognito = useChatRuntimeStore((s) => s.incognito);
  const setIncognito = useChatRuntimeStore((s) => s.setIncognito);
  const incognitoLabel = incognito
    ? t("chat.toolbar.turnOffTemporaryChat")
    : t("chat.toolbar.turnOnTemporaryChat");
  const toggleIncognito = useCallback(() => {
    const store = useChatRuntimeStore.getState();
    const wasIncognito = store.incognito;
    store.setIncognito(!store.incognito);
    // On an empty scratch chat there's nothing to abandon, so flip in
    // place: navigating would remount the thread and bounce the composer
    // (it docks to the bottom before the welcome state re-centers it).
    // Otherwise start a clean chat so the temporary session can't inherit
    // or leave behind a persisted thread (matches ChatGPT / Gemini).
    const onEmptyScratchChat =
      !search.thread &&
      !search.compare &&
      !search.project &&
      store.activeThreadId == null;
    if (wasIncognito) {
      requestTemporaryPromptQueueStop();
    }
    if (onEmptyScratchChat) return;
    // setActiveThreadId already clears contextUsage.
    store.setActiveThreadId(null);
    store.setActiveProjectId(null);
    navigate({ to: "/chat", search: { new: crypto.randomUUID() } });
  }, [navigate, search]);
  const hydratePersistedSettings = useChatRuntimeStore(
    (s) => s.hydratePersistedSettings,
  );
  const settingsHydrated = useChatRuntimeStore((s) => s.settingsHydrated);
  const externalProviders = useExternalProvidersStore((s) => s.providers);
  const connectionsEnabled = useExternalProvidersStore(
    (s) => s.connectionsEnabled,
  );
  const online = useOnlineStatus();
  const remoteModelsAvailable = connectionsEnabled && online;
  const setExternalProviders = useExternalProvidersStore((s) => s.setProviders);
  const externalProvidersForChat = remoteModelsAvailable ? externalProviders : [];

  useEffect(() => {
    void hydratePersistedSettings();
  }, [hydratePersistedSettings]);

  useEffect(() => {
    // Skip while off-route: ChatPage stays mounted, and toast+navigate here would
    // yank the user back to chat from whatever tab they're on.
    if (!active) return;
    const threadId = search.thread;
    if (!threadId) return;
    // Local threads (__LOCALID_*) exist only in memory and are not persisted to
    // the backend. getStoredChatThread returns undefined for them, which would
    // incorrectly trigger the "Chat not found" toast when a provider is selected.
    if (isAssistantLocalThreadId(threadId)) return;

    let canceled = false;
    void getStoredChatThread(threadId)
      .then((thread) => {
        if (canceled || thread) return;
        useChatRuntimeStore.getState().setActiveThreadId(null);
        toast.info("Chat not found", {
          description: "That thread no longer exists, so we opened a new chat.",
        });
        navigate({
          to: "/chat",
          search: search.project
            ? { project: search.project }
            : { new: crypto.randomUUID() },
          replace: true,
        });
      })
      .catch(() => {
        if (useChatRuntimeStore.getState().activeThreadId === threadId) {
          useChatRuntimeStore.getState().setActiveThreadId(null);
        }
      });

    return () => {
      canceled = true;
    };
  }, [active, navigate, search.thread]);

  const [modelSelectorOpen, setModelSelectorOpen] = useState(false);
  const [modelSelectorLocked, setModelSelectorLocked] = useState(false);
  const viewBeforeCompareRef = useRef<ChatSearch | null>(null);
  // Latest non-compare view, so exiting compare can restore it even when
  // compare was opened from a path that doesn't set viewBeforeCompareRef.
  const lastNonCompareViewRef = useRef<ChatSearch | null>(null);
  useEffect(() => {
    if (!search.compare) {
      lastNonCompareViewRef.current = { ...search };
    }
  }, [search]);
  const inferenceParams = useChatRuntimeStore((state) => state.params);
  const setInferenceParams = useChatRuntimeStore((state) => state.setParams);
  const activeGgufVariant = useChatRuntimeStore(
    (state) => state.activeGgufVariant,
  );
  const residentCheckpoint = useChatRuntimeStore(
    (state) => state.residentCheckpoint,
  );
  const ggufContextLength = useChatRuntimeStore(
    (state) => state.ggufContextLength,
  );
  const ggufNativeContextLength = useChatRuntimeStore(
    (state) => state.ggufNativeContextLength,
  );
  const contextUsage = useChatRuntimeStore((state) => state.contextUsage);
  const modelsFromStore = useChatRuntimeStore((state) => state.models);
  const lorasFromStore = useChatRuntimeStore((state) => state.loras);
  const modelsError = useChatRuntimeStore((state) => state.modelsError);
  const modelLoading = useChatRuntimeStore((state) => state.modelLoading);
  const clearCheckpoint = useChatRuntimeStore((state) => state.clearCheckpoint);
  const resetArtifacts = useChatArtifactsStore((state) => state.resetArtifacts);
  const activeThreadId = useChatRuntimeStore((state) => state.activeThreadId);
  const latestResearchRunId = useResearchRunStore((state) =>
    activeThreadId ? state.latestRunByThreadId[activeThreadId] : undefined,
  );
  // Status, not the run: this subscribes in ChatPage itself, so a run selector re-rendered the
  // whole page on every streamed research delta.
  const latestResearchRunStatus = useResearchRunStore((state) =>
    latestResearchRunId
      ? state.sessions[latestResearchRunId]?.run.status
      : undefined,
  );
  const openResearchPanel = useResearchRunStore((state) => state.openPanel);
  const openResearchRunId = useResearchRunStore((state) => state.openRunId);
  const closeResearchPanel = useResearchRunStore((state) => state.closePanel);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(
    search.project ?? null,
  );
  const { projects, isLoading: projectsLoading } = useChatProjects();
  const currentProject = currentProjectId
    ? (projects.find((project) => project.id === currentProjectId) ?? null)
    : null;
  const { items: currentProjectItems } = useChatSidebarItems({
    projectId: currentProjectId ?? "__no_project_selected__",
  });
  const currentChatTitle = activeThreadId
    ? currentProjectItems.find((item) => item.id === activeThreadId)?.title
    : undefined;
  const openProjectLanding = useCallback(
    (projectId: string) => {
      useChatRuntimeStore.getState().setActiveThreadId(null);
      useChatRuntimeStore.getState().setActiveProjectId(projectId);
      navigate({ to: "/chat", search: { project: projectId } });
    },
    [navigate],
  );

  const handleDesktopNewChat = useCallback(() => {
    clearNewChatDraft();
    const runtime = useChatRuntimeStore.getState();
    runtime.setActiveThreadId(null);
    runtime.setActiveProjectId(currentProjectId);
    runtime.setIncognito(false);
    navigate({
      to: "/chat",
      search: currentProjectId
        ? { project: currentProjectId }
        : { new: crypto.randomUUID() },
    });
  }, [currentProjectId, navigate]);
  const openProjectsList = useCallback(() => {
    navigate({ to: "/projects" });
  }, [navigate]);
  const persistedActiveThreadId = isAssistantLocalThreadId(activeThreadId)
    ? null
    : activeThreadId;
  // A chat opened as ?new=<nonce> has no thread in the URL, and it keeps none after
  // the first send, so the model notice never saw the row that send created: switching
  // model in a chat you just started offered nothing until you navigated away and
  // reopened it. The store does learn the id -- runtime-provider publishes it once the
  // visible thread is the one being persisted -- but it still holds the PREVIOUS chat's
  // id for the first render, until ThreadNewChatSwitch blanks it in an effect. Handing
  // that over would put the previous chat's notice on this one. So latch on having seen
  // it blanked for this nonce; before the first send there is nothing to offer anyway.
  const newChatBlankedRef = useRef<string | null>(null);
  if (
    search.new &&
    (activeThreadId === null || isAssistantLocalThreadId(activeThreadId))
  ) {
    newChatBlankedRef.current = search.new;
  }
  const newChatThreadId =
    search.new && newChatBlankedRef.current === search.new
      ? persistedActiveThreadId
      : null;
  const modelOperationInProgress = useChatRuntimeStore(
    (state) => state.modelLoading,
  );
  const {
    refresh,
    selectModel,
    ejectModel,
    cancelLoading,
    loadingModel,
    loadProgress,
    loadToastDismissed,
  } = useChatModelRuntime();
  const prevConnectionsEnabledRef = useRef(remoteModelsAvailable);
  useEffect(() => {
    const turnedOff = prevConnectionsEnabledRef.current && !remoteModelsAvailable;
    if (!remoteModelsAvailable && isExternalModelId(inferenceParams.checkpoint)) {
      resetArtifacts();
      clearCheckpoint();
      if (turnedOff) {
        toast.info("Connections disabled", {
          description: "Switched away from the hosted model.",
        });
      }
    }
    prevConnectionsEnabledRef.current = remoteModelsAvailable;
  }, [
    clearCheckpoint,
    remoteModelsAvailable,
    inferenceParams.checkpoint,
    resetArtifacts,
  ]);
  const pendingNativeModelIntent = useNativeIntentStore(
    (state) => state.pendingModelIntent,
  );
  const nativePathLeasesSupported = useNativePathLeasesSupported();
  const refreshRef = useRef(refresh);
  const selectModelRef = useRef(selectModel);

  useEffect(() => {
    refreshRef.current = refresh;
    selectModelRef.current = selectModel;
  }, [refresh, selectModel]);
  const rememberedConfigFor = useCallback(
    (selection: {
      id: string;
      ggufVariant?: string | null;
      source?: string;
    }) => {
      if (selection.source === "external") return null;
      const resolved = resolveInitialConfig(selection.id, selection.ggufVariant);
      return resolved.remembered ? resolved.config : null;
    },
    [],
  );
  const isExternalModel = useMemo(
    () => isExternalModelId(inferenceParams.checkpoint),
    [inferenceParams.checkpoint],
  );
  const contextWindowKnown = hasKnownContextWindow({
    ggufContextLength,
    modelLoading,
    isExternalModel,
    residentCheckpoint,
  });
  const {
    checkpoint: runtimeCheckpoint,
    isGguf: runtimeModelIsGguf,
    config: activeModelConfig,
  } = useActiveModelConfig();
  const activeModelIsGguf =
    runtimeCheckpoint != null && !isExternalModel && runtimeModelIsGguf;
  const activeModelIsDiffusion = useChatRuntimeStore(
    (s) => s.loadedIsDiffusion,
  );
  const activeModelIsLora = useMemo(() => {
    const checkpoint = inferenceParams.checkpoint;
    if (!checkpoint || isExternalModel) return false;
    const model = modelsFromStore.find((entry) => entry.id === checkpoint);
    if (model) return model.isLora;
    const lora = lorasFromStore.find((entry) => entry.id === checkpoint);
    return lora?.exportType === "lora";
  }, [inferenceParams.checkpoint, isExternalModel, modelsFromStore, lorasFromStore]);
  const reasoningEnabled = useChatRuntimeStore((s) => s.reasoningEnabled);
  const reasoningStyle = useChatRuntimeStore((s) => s.reasoningStyle);
  const reasoningEffort = useChatRuntimeStore((s) => s.reasoningEffort);
  const supportsReasoningOff = useChatRuntimeStore(
    (s) => s.supportsReasoningOff,
  );
  const activeExternalProvider = useMemo(() => {
    const selection = parseExternalModelId(inferenceParams.checkpoint);
    if (!selection) return null;
    return (
      externalProvidersForChat.find((p) => p.id === selection.providerId) ??
      null
    );
  }, [externalProvidersForChat, inferenceParams.checkpoint]);
  const activeExternalProviderType =
    activeExternalProvider?.providerType ?? null;
  const activeProviderCapabilities = useMemo(() => {
    const selection = parseExternalModelId(inferenceParams.checkpoint);
    if (!selection) return null;
    const provider = externalProvidersForChat.find(
      (p) => p.id === selection.providerId,
    );
    const baseCapabilities = getProviderCapabilities(provider?.providerType);
    if (!baseCapabilities) return baseCapabilities;
    const anthropicThinkingEnabled =
      provider?.providerType === "anthropic" &&
      reasoningStyle === "reasoning_effort" &&
      (supportsReasoningOff ? reasoningEnabled : true) &&
      reasoningEffort !== "none";
    if (!anthropicThinkingEnabled) return baseCapabilities;
    return {
      ...baseCapabilities,
      temperature: false,
      topK: false,
    };
  }, [
    externalProvidersForChat,
    inferenceParams.checkpoint,
    reasoningEnabled,
    reasoningStyle,
    reasoningEffort,
    supportsReasoningOff,
  ]);
  useEffect(() => {
    const selection = parseExternalModelId(inferenceParams.checkpoint);
    if (!selection) return;
    const provider = externalProvidersForChat.find(
      (p) => p.id === selection.providerId,
    );
    const reasoningCaps = getExternalReasoningCapabilities(
      provider?.providerType,
      selection.modelId,
      {
        isReasoningProvider: provider?.isReasoningModel === true,
        baseUrl: provider?.baseUrl ?? null,
      },
    );
    const state = useChatRuntimeStore.getState();
    const preferredEffort = state.reasoningEffort;
    const effortLevels = reasoningCaps.reasoningEffortLevels;
    const clampedEffort = clampReasoningEffortToLevels(
      preferredEffort,
      effortLevels,
    );
    // Per-provider default effort. Anthropic gets the highest level since
    // Claude's adaptive thinking adjusts cost per turn (top of dial =
    // strongest answers, still skips thinking when trivial). OpenAI gets
    // "high" (gpt-5.x accept it across the board; good cost/quality for
    // Responses-API tools). Everyone else "medium". Overridable via Think.
    const isAnthropic = provider?.providerType === "anthropic";
    const isOpenAI = provider?.providerType === "openai";
    const anthropicTopEffort = effortLevels.includes("xhigh")
      ? "xhigh"
      : effortLevels.includes("high")
        ? "high"
        : clampedEffort;
    const openaiDefaultEffort = effortLevels.includes("high")
      ? "high"
      : effortLevels.includes("medium")
        ? "medium"
        : clampedEffort;
    const nextReasoningEffort = reasoningCaps.supportsReasoning
      ? isAnthropic
        ? anthropicTopEffort
        : isOpenAI
          ? openaiDefaultEffort
          : effortLevels.includes("medium")
            ? "medium"
            : clampedEffort
      : state.reasoningEffort;
    const supportsBuiltinWebSearch = providerSupportsBuiltinWebSearch(
      provider?.providerType,
      selection.modelId,
      provider?.baseUrl,
    );
    const supportsBuiltinCodeExecution = providerSupportsBuiltinCodeExecution(
      provider?.providerType,
      selection.modelId,
      provider?.baseUrl,
    );
    const supportsBuiltinImageGeneration =
      providerSupportsBuiltinImageGeneration(
        provider?.providerType,
        selection.modelId,
        provider?.baseUrl,
      );
    const supportsBuiltinWebFetch = providerSupportsBuiltinWebFetch(
      provider?.providerType,
    );
    // Kimi's k2.6/k2.5 default to thinking enabled server-side (per
    // https://platform.kimi.ai/docs/models). Mirror that so the Think pill
    // comes up clicked for Kimi models. Search stays off; the composer's
    // mutual-exclusion handlers flip the two when needed.
    const isKimi = provider?.providerType === "kimi";
    // Web search on by default only for the two providers we trust most:
    // Anthropic and OpenAI (both with structured citations). Others stay
    // off-by-default; OpenRouter and Kimi work on opt-in but are less
    // reliable, so we don't pre-enable them.
    const searchOnByDefault =
      supportsBuiltinWebSearch &&
      (provider?.providerType === "anthropic" ||
        provider?.providerType === "openai");
    // the open chat's own pills win, or selecting a model would revert them to the global ones.
    const storedToolsEnabled =
      threadScopedOverride("toolsEnabled") ??
      loadOptionalBool(CHAT_TOOLS_ENABLED_KEY);
    const storedCodeToolsEnabled =
      threadScopedOverride("codeToolsEnabled") ??
      loadOptionalBool(CHAT_CODE_TOOLS_ENABLED_KEY);
    const storedImageToolsEnabled =
      threadScopedOverride("imageToolsEnabled") ??
      loadOptionalBool(CHAT_IMAGE_TOOLS_ENABLED_KEY);
    const storedWebFetchToolsEnabled =
      threadScopedOverride("webFetchToolsEnabled") ??
      loadOptionalBool(CHAT_WEB_FETCH_TOOLS_ENABLED_KEY);
    // Studio runs Search and Code itself for any provider that advertises the
    // capability, so a self-hosted connection has no hosted builtin to key off.
    // Keying the pill state on the hosted flags alone discarded the user's saved
    // preference on every reload and sent enable_tools: false, even though the
    // composer left both pills clickable.
    const supportsStudioToolsHere =
      providerModelSupportsStudioTools(
        provider?.providerType,
        selection.modelId,
      ) === true;
    const canSearch = supportsBuiltinWebSearch || supportsStudioToolsHere;
    // Read out of the placement rule, not off the Studio-tools flag: a model on
    // a sandbox-owning provider that cannot use it runs nothing either way, and
    // offering the pill there restored a preference that sent no tools at all.
    const canRunCode = codeToolCanRun({
      hostedCodeExecutionForThisTurn: supportsBuiltinCodeExecution,
      providerHostsCodeExecution: providerHostsCodeExecution(provider?.providerType),
      supportsStudioTools: supportsStudioToolsHere,
    });
    const nextToolsEnabled = canSearch
      ? isKimi
        ? false
        : (storedToolsEnabled ?? searchOnByDefault)
      : false;
    useChatRuntimeStore.setState({
      supportsReasoning: reasoningCaps.supportsReasoning,
      reasoningAlwaysOn: reasoningCaps.reasoningAlwaysOn,
      reasoningStyle: reasoningCaps.reasoningStyle,
      supportsReasoningOff: reasoningCaps.supportsReasoningOff,
      reasoningEffortLevels: effortLevels,
      reasoningEffort: nextReasoningEffort,
      reasoningEnabled: reasoningCaps.supportsReasoning
        ? reasoningCaps.supportsReasoningOff
          ? isKimi
            ? true
            : state.reasoningEnabled
          : true
        : state.reasoningEnabled,
      supportsPreserveThinking: false,
      supportsTools: supportsStudioToolsHere,
      supportsBuiltinWebSearch,
      supportsBuiltinCodeExecution,
      supportsBuiltinImageGeneration,
      supportsBuiltinWebFetch,
      toolsEnabled: nextToolsEnabled,
      codeToolsEnabled: canRunCode ? (storedCodeToolsEnabled ?? false) : false,
      imageToolsEnabled: supportsBuiltinImageGeneration
        ? (storedImageToolsEnabled ?? false)
        : false,
      // Default Fetch off (Anthropic bills per fetch); deliberate opt-in.
      webFetchToolsEnabled: supportsBuiltinWebFetch
        ? (storedWebFetchToolsEnabled ?? false)
        : false,
    });
    // Reruns once settings hydrate: this normalization reads the stored pills
    // and clamps them to the model, and hydration refreshes what it reads, so
    // it has to be the one applied last.
  }, [externalProvidersForChat, inferenceParams.checkpoint, settingsHydrated]);
  const canCompare = useMemo(() => {
    return Boolean(inferenceParams.checkpoint) && !isExternalModel;
  }, [inferenceParams.checkpoint, isExternalModel]);

  useEffect(() => {
    let canceled = false;

    async function resolveProjectId(): Promise<void> {
      if (search.project) {
        setCurrentProjectId(search.project);
        useChatRuntimeStore.getState().setActiveProjectId(search.project);
        return;
      }

      if (search.thread) {
        const thread = await getStoredChatThread(search.thread).catch(
          () => null,
        );
        if (!canceled) {
          const projectId = thread?.projectId ?? null;
          setCurrentProjectId(projectId);
          useChatRuntimeStore.getState().setActiveProjectId(projectId);
        }
        return;
      }

      if (search.compare) {
        const threads = await listStoredChatThreads({
          pairId: search.compare,
          includeArchived: true,
        }).catch(() => []);
        if (!canceled) {
          const projectId = threads[0]?.projectId ?? null;
          setCurrentProjectId(projectId);
          useChatRuntimeStore.getState().setActiveProjectId(projectId);
        }
        return;
      }

      setCurrentProjectId(null);
      useChatRuntimeStore.getState().setActiveProjectId(null);
    }

    void resolveProjectId();
    return () => {
      canceled = true;
    };
  }, [search.compare, search.project, search.thread]);

  // Derive view from URL search params
  const view = useMemo<ChatView>(() => {
    if (search.compare) {
      return {
        mode: "compare",
        pairId: search.compare,
        projectId: currentProjectId,
      };
    }
    if (search.thread) {
      return {
        mode: "single",
        threadId: search.thread,
        projectId: currentProjectId,
      };
    }
    if (search.new) {
      return {
        mode: "single",
        newThreadNonce: search.new,
        projectId: currentProjectId,
      };
    }
    if (search.project) {
      return {
        mode: "project",
        projectId: search.project,
      };
    }
    if (persistedActiveThreadId) {
      return {
        mode: "single",
        threadId: persistedActiveThreadId,
        projectId: currentProjectId,
      };
    }
    return { mode: "single", projectId: currentProjectId };
  }, [
    search.thread,
    search.compare,
    search.new,
    search.project,
    persistedActiveThreadId,
    currentProjectId,
  ]);

  // Temporary chat only applies to a fresh single-view chat. Exit incognito
  // when we land on anything else (compare, a project, or an existing thread
  // via sidebar/deep link/back), so the toggle isn't stranded and the UI
  // never implies a saved thread is temporary.
  useEffect(() => {
    const onFreshSingleChat = view.mode === "single" && !view.threadId;
    if (incognito && !onFreshSingleChat) {
      setIncognito(false);
    }
  }, [view, incognito, setIncognito]);

  const selectedArtifact = useSelectedChatArtifact();
  const artifactSurface = useChatArtifactsStore((state) => state.surface);
  const closeArtifactSurface = useChatArtifactsStore(
    (state) => state.closeArtifactSurface,
  );
  const artifactViewKey =
    view.mode === "single"
      ? `single:${view.threadId ?? view.newThreadNonce ?? "new"}`
      : view.mode === "compare"
        ? `compare:${view.pairId}`
        : `project:${view.projectId}`;

  const attachmentScope =
    view.mode === "single" && !search.thread && !search.new && !search.project
      ? "single:implicit"
      : artifactViewKey;

  useEffect(() => {
    clearAutoOpenedArtifacts();
    closeArtifactSurface();
  }, [artifactViewKey, closeArtifactSurface]);

  useEffect(() => {
    if (view.mode !== "single") return;
    if (view.threadId || !selectedArtifact) return;
    // Close any canvas that doesn't belong to the active thread.
    if (
      selectedArtifact.threadId &&
      selectedArtifact.threadId === activeThreadId
    )
      return;
    closeArtifactSurface();
  }, [activeThreadId, closeArtifactSurface, selectedArtifact, view]);

  const hasActiveModel = Boolean(inferenceParams.checkpoint);
  const chatContextKey = `${view.mode}|${activeThreadId ?? ""}|${search.new ?? ""}|${search.project ?? ""}`;
  const [pendingHubAutoLoad, setPendingHubAutoLoad] =
    useState<PendingHubAutoLoad | null>(null);
  const stageOrLoad = useCallback(
    async (selection: SelectedModelInput) => {
      const store = useChatRuntimeStore.getState();
      const wantManagerDownload =
        isDownloadableHubRepo(selection) && !selection.isDownloaded;
      if (store.modelLoading) {
        const wantBackgroundDownload =
          wantManagerDownload ||
          (selection.source === "hub" &&
            hasGgufSource(selection) &&
            !selection.isDownloaded);
        const isLoadingThisPick =
          !!loadingModel &&
          normalizeModelRef(loadingModel.id) ===
          normalizeModelRef(selection.id) &&
          (loadingModel.ggufVariant ?? null) === (selection.ggufVariant ?? null);
        if (isLoadingThisPick) {
          toast.info("This model is already loading", {
            description: "It's downloading as part of the load in progress.",
          });
        } else if (wantBackgroundDownload) {
          const outcome = await downloadManager.requestStart({
            kind: DOWNLOAD_KIND.MODEL,
            repoId: selection.id,
            variant: selection.ggufVariant ?? null,
            expectedBytes: selection.expectedBytes ?? 0,
          });
          if (outcome === "started") {
            toast.info("Downloading in the background", {
              description:
                "It'll be ready to load once the current model finishes.",
            });
          } else if (outcome === "conflict") {
            toast.info("Resume this download from Models", {
              description:
                "An earlier partial download used a different transport. Open the Model hub tab to resume or restart it.",
            });
          } else if (outcome === "busy") {
            toast.info("Download already in progress", {
              description:
                "Another download for this model is still running. Reselect it once that finishes to load it.",
            });
          }
        } else {
          toast.info("Another model is already loading", {
            description: "Wait for it to finish or cancel it first.",
          });
        }
        return;
      }
      const wantManagerStage =
        wantManagerDownload ||
        (selection.source === "hub" &&
          hasGgufSource(selection) &&
          !selection.isDownloaded);
      if (wantManagerStage) {
        setPendingHubAutoLoad((current) =>
          current &&
            current.selection.id === selection.id &&
            (current.selection.ggufVariant ?? null) ===
            (selection.ggufVariant ?? null) &&
            current.contextKey === chatContextKey &&
            current.originCheckpoint === store.params.checkpoint &&
            current.originGgufVariant === store.activeGgufVariant
            ? current
            : {
              selection,
              contextKey: chatContextKey,
              originCheckpoint: store.params.checkpoint,
              originGgufVariant: store.activeGgufVariant,
            },
        );
        return;
      }
      setPendingHubAutoLoad(null);
      const previousConfig = currentRuntimePerModelConfig({
        includeMaxSeqLength: true,
      });
      const loadConfig =
        selection.config ?? rememberedConfigFor(selection);
      await selectModel({
        ...selection,
        ...(loadConfig ? { config: loadConfig, keepSpeculative: true } : {}),
        previousConfig,
      });
    },
    [selectModel, loadingModel, rememberedConfigFor, chatContextKey],
  );
  useRepoDownload({
    kind: DOWNLOAD_KIND.MODEL,
    repoId: pendingHubAutoLoad?.selection.id ?? "__hub_autoload_idle__",
    activeVariant: pendingHubAutoLoad?.selection.ggufVariant ?? null,
    onComplete: (variant) => {
      const pending = pendingHubAutoLoad;
      if (
        !pending ||
        (pending.selection.ggufVariant ?? null) !== (variant ?? null)
      ) {
        return;
      }
      setPendingHubAutoLoad(null);
      const store = useChatRuntimeStore.getState();
      if (
        !active ||
        pending.contextKey !== chatContextKey ||
        normalizeModelRef(pending.originCheckpoint) !==
        normalizeModelRef(store.params.checkpoint) ||
        pending.originGgufVariant !== store.activeGgufVariant
      ) {
        return;
      }
      void stageOrLoad({ ...pending.selection, isDownloaded: true });
    },
    onError: (variant) => {
      if (
        pendingHubAutoLoad &&
        (pendingHubAutoLoad.selection.ggufVariant ?? null) === (variant ?? null)
      ) {
        setPendingHubAutoLoad(null);
      }
    },
    onCancelled: (variant) => {
      if (
        pendingHubAutoLoad &&
        (pendingHubAutoLoad.selection.ggufVariant ?? null) === (variant ?? null)
      ) {
        setPendingHubAutoLoad(null);
      }
    },
  });
  useEffect(() => {
    const pending = pendingHubAutoLoad;
    if (!pending) return;
    let active = true;
    void (async () => {
      const outcome = await downloadManager.requestStart({
        kind: DOWNLOAD_KIND.MODEL,
        repoId: pending.selection.id,
        variant: pending.selection.ggufVariant ?? null,
        expectedBytes: pending.selection.expectedBytes ?? 0,
      });
      if (!active) return;
      if (outcome === "started") {
        toast.info("Downloading model", {
          description: "It'll load automatically once the download finishes.",
        });
        return;
      }
      if (outcome === "conflict") {
        // Keep pendingHubAutoLoad bound so this surface's cleanup does not wipe
        // the conflict just recorded by requestStart (which the toast points the
        // user to); resolving it from the Hub completes the download and this
        // surface's onComplete auto-loads, mirroring the "started" branch.
        toast.info("Resume this download from Models", {
          description:
            "An earlier partial download used a different transport. Open the Model hub tab to resume or restart it.",
        });
        return;
      }
      if (outcome === "busy") {
        toast.info("Download already in progress", {
          description:
            "Another download for this model is still running. Reselect it once that finishes to load it.",
        });
      }
      setPendingHubAutoLoad((current) => (current === pending ? null : current));
    })();
    return () => {
      active = false;
    };
  }, [pendingHubAutoLoad]);
  const loadNativeModelIntent = useCallback(
    async (intent: NativeIntent, loadingDescription: string) => {
      const label =
        intent.path.displayLabel || intent.displayLabel || "Local GGUF model";
      await stageOrLoad({
        id: label,
        nativePathToken: intent.path.token,
        nativePathExpiresAtMs: intent.path.expiresAtMs ?? null,
        isDownloaded: true,
        loadingDescription,
        forceReload: true,
        throwOnError: true,
      });
      useNativeIntentStore.getState().clearModelIntent(intent.id);
    },
    [stageOrLoad],
  );
  const handleNativeModelDropAutoLoad = useCallback(
    (intent: NativeIntent) =>
      loadNativeModelIntent(
        intent,
        hasActiveModel
          ? "Replacing with dropped local GGUF model."
          : "Loading dropped local GGUF model.",
      ),
    [hasActiveModel, loadNativeModelIntent],
  );
  // Dropped documents go to the thread bar, which owns the RAG upload and can
  // materialize a thread id for a chat that hasn't been sent to yet.
  const handleNativeAttachmentDrop = useCallback(
    (intents: NativeIntent[]) => {
      useNativeIntentStore.getState().addAttachments(artifactViewKey, intents);
    },
    [artifactViewKey],
  );
  const handleNativeImageDrop = useCallback(
    (intents: NativeIntent[]) => {
      useNativeIntentStore.getState().addImageAttachments(artifactViewKey, intents);
    },
    [artifactViewKey],
  );
  const handleNativeAudioDrop = useCallback(
    (intents: NativeIntent[]) => {
      useNativeIntentStore.getState().addAudioAttachments(artifactViewKey, intents);
    },
    [artifactViewKey],
  );
  const handleNativeVideoDrop = useCallback(
    (intents: NativeIntent[]) => {
      useNativeIntentStore.getState().addVideoAttachments(artifactViewKey, intents);
    },
    [artifactViewKey],
  );
  const nativeModelDropState = useNativeModelDrop({
    // Compare used to disable this outright, so a drop there vanished with no
    // overlay and no message (#9036). Keep listening and refuse out loud. The
    // refusal covers models too: nothing may load behind a compare view.
    enabled: active,
    dropsUnsupportedReason:
      view.mode === "single"
        ? undefined
        : "Dropped files need a single chat. Open one, then drop it there.",
    attachmentScope,
    attachmentTargetKey: artifactViewKey,
    nativePathLeasesSupported,
    hasActiveModel,
    isModelLoading: Boolean(loadingModel) || modelLoading,
    onAutoLoad: handleNativeModelDropAutoLoad,
    onAttach: handleNativeAttachmentDrop,
    onAttachImages: handleNativeImageDrop,
    onAttachAudio: handleNativeAudioDrop,
    onAttachVideo: handleNativeVideoDrop,
  });

  const handleCheckpointChange = useCallback(
    (
      value: string,
      meta?: ModelSelectorChangeMeta,
    ) => {
      const store = useChatRuntimeStore.getState();
      const currentCheckpoint = store.params.checkpoint;
      const currentVariant = store.activeGgufVariant;
      if (!value) return;
      setPendingHubAutoLoad(null);
      const isSameLoadedModel =
        value === currentCheckpoint &&
        (meta?.ggufVariant ?? null) === (currentVariant ?? null);
      if (isSameLoadedModel && !meta?.forceReload) {
        return;
      }
      if (meta?.source === "external" || isExternalModelId(value)) {
        const selectedExternal = parseExternalModelId(value);
        const selectedProvider = selectedExternal
          ? externalProvidersForChat.find(
            (p) => p.id === selectedExternal.providerId,
          )
          : null;
        const reasoningCaps = getExternalReasoningCapabilities(
          selectedProvider?.providerType,
          selectedExternal?.modelId,
          {
            isReasoningProvider: selectedProvider?.isReasoningModel === true,
            baseUrl: selectedProvider?.baseUrl ?? null,
          },
        );
        const preferredEffort = store.reasoningEffort;
        const effortLevels = reasoningCaps.reasoningEffortLevels;
        const clampedEffort = clampReasoningEffortToLevels(
          preferredEffort,
          effortLevels,
        );
        // Same per-provider default policy as the useEffect above:
        // Anthropic highest level, OpenAI "high", everyone else "medium".
        const isAnthropic = selectedProvider?.providerType === "anthropic";
        const isOpenAI = selectedProvider?.providerType === "openai";
        const anthropicTopEffort = effortLevels.includes("xhigh")
          ? "xhigh"
          : effortLevels.includes("high")
            ? "high"
            : clampedEffort;
        const openaiDefaultEffort = effortLevels.includes("high")
          ? "high"
          : effortLevels.includes("medium")
            ? "medium"
            : clampedEffort;
        const nextReasoningEffort = reasoningCaps.supportsReasoning
          ? isAnthropic
            ? anthropicTopEffort
            : isOpenAI
              ? openaiDefaultEffort
              : effortLevels.includes("medium")
                ? "medium"
                : clampedEffort
          : store.reasoningEffort;
        // Clear any cached router-picked openrouter/free model unless staying
        // on openrouter/free, else the chip keeps a stale ":<chosen>" suffix.
        const stillOnOpenRouterFree =
          selectedProvider?.providerType === "openrouter" &&
          selectedExternal?.modelId === "openrouter/free";
        store.setCheckpoint(value, null);
        const supportsBuiltinWebSearch = providerSupportsBuiltinWebSearch(
          selectedProvider?.providerType,
          selectedExternal?.modelId,
          selectedProvider?.baseUrl,
        );
        const supportsBuiltinCodeExecution =
          providerSupportsBuiltinCodeExecution(
            selectedProvider?.providerType,
            selectedExternal?.modelId,
            selectedProvider?.baseUrl,
          );
        const supportsBuiltinImageGeneration =
          providerSupportsBuiltinImageGeneration(
            selectedProvider?.providerType,
            selectedExternal?.modelId,
            selectedProvider?.baseUrl,
          );
        const supportsBuiltinWebFetch = providerSupportsBuiltinWebFetch(
          selectedProvider?.providerType,
        );
        // See sibling useEffect: Kimi's k2.x default to thinking enabled
        // (Think pill clicked). Search stays off; the composer's mutual
        // exclusion flips them.
        const isKimi = selectedProvider?.providerType === "kimi";
        // Mirror of sibling useEffect: Anthropic/OpenAI get Search on by
        // default (structured citations end-to-end); others stay off.
        const searchOnByDefault =
          supportsBuiltinWebSearch &&
          (selectedProvider?.providerType === "anthropic" ||
            selectedProvider?.providerType === "openai");
        // mirror of the sibling effect: the open chat's own pills win over the global ones.
        const storedToolsEnabled =
          threadScopedOverride("toolsEnabled") ??
          loadOptionalBool(CHAT_TOOLS_ENABLED_KEY);
        const storedCodeToolsEnabled =
          threadScopedOverride("codeToolsEnabled") ??
          loadOptionalBool(CHAT_CODE_TOOLS_ENABLED_KEY);
        const storedImageToolsEnabled =
          threadScopedOverride("imageToolsEnabled") ??
          loadOptionalBool(CHAT_IMAGE_TOOLS_ENABLED_KEY);
        const storedWebFetchToolsEnabled =
          threadScopedOverride("webFetchToolsEnabled") ??
          loadOptionalBool(CHAT_WEB_FETCH_TOOLS_ENABLED_KEY);
        // Same rule as the selection handler above: a self-hosted connection has
        // no hosted builtin, so keying the pills on those flags threw away the
        // user's saved preference every time this ran.
        const supportsStudioToolsHere =
          providerModelSupportsStudioTools(
            selectedProvider?.providerType,
            selectedExternal?.modelId,
          ) === true;
        const canSearch = supportsBuiltinWebSearch || supportsStudioToolsHere;
        // Same placement rule as the selection handler above.
        const canRunCode = codeToolCanRun({
          hostedCodeExecutionForThisTurn: supportsBuiltinCodeExecution,
          providerHostsCodeExecution: providerHostsCodeExecution(
            selectedProvider?.providerType,
          ),
          supportsStudioTools: supportsStudioToolsHere,
        });
        const nextToolsEnabled = canSearch
          ? isKimi
            ? false
            : (storedToolsEnabled ?? searchOnByDefault)
          : false;
        useChatRuntimeStore.setState({
          activeGgufVariant: null,
          ggufContextLength: null,
          ggufMaxContextLength: null,
          ggufNativeContextLength: null,
          activeNativePathToken: null,
          activeNativePathExpiresAtMs: null,
          // Clear previous-model counters, else the relaxed external-provider render gate shows
          // stale stats. The per-thread copies go too, so a switch back cannot re-apply.
          contextUsage: null,
          contextUsageByThreadId: {},
          supportsReasoning: reasoningCaps.supportsReasoning,
          reasoningAlwaysOn: reasoningCaps.reasoningAlwaysOn,
          reasoningStyle: reasoningCaps.reasoningStyle,
          supportsReasoningOff: reasoningCaps.supportsReasoningOff,
          reasoningEffortLevels: effortLevels,
          reasoningEffort: nextReasoningEffort,
          reasoningEnabled: reasoningCaps.supportsReasoning
            ? reasoningCaps.supportsReasoningOff
              ? isKimi
                ? true
                : store.reasoningEnabled
              : true
            : store.reasoningEnabled,
          supportsPreserveThinking: false,
          supportsTools: supportsStudioToolsHere,
          supportsBuiltinWebSearch,
          supportsBuiltinCodeExecution,
          supportsBuiltinImageGeneration,
          supportsBuiltinWebFetch,
          toolsEnabled: nextToolsEnabled,
          codeToolsEnabled: canRunCode
            ? (storedCodeToolsEnabled ?? false)
            : false,
          imageToolsEnabled: supportsBuiltinImageGeneration
            ? (storedImageToolsEnabled ?? false)
            : false,
          webFetchToolsEnabled: supportsBuiltinWebFetch
            ? (storedWebFetchToolsEnabled ?? false)
            : false,
          ...(stillOnOpenRouterFree ? {} : { lastOpenRouterChosenModel: null }),
        });
        return;
      }
      // Local model picked → drop any cached openrouter/free chosen model.
      useChatRuntimeStore.setState({ lastOpenRouterChosenModel: null });
      void (async () => {
        let showImageCompatibilityWarning = false;
        if (view.mode === "single" && activeThreadId) {
          const thread = await getStoredChatThread(activeThreadId);
          if (thread?.modelId && thread.modelId !== value) {
            const messages = await listStoredChatMessages(activeThreadId);
            if (messages.length > 0) {
              const hasImage = messages.some(messageHasImage);
              const targetModel = modelsFromStore.find(
                (model) => model.id === value,
              );
              showImageCompatibilityWarning =
                hasImage && targetModel?.isVision === false;
            }
          }
        }

        if (showImageCompatibilityWarning) {
          toast.warning("Selected model may not handle earlier images", {
            description:
              "This chat already includes images. Text-only models can ignore them or fail on follow-up replies.",
            duration: 6000,
          });
        }
        const selection = {
          id: value,
          loadId: meta?.loadId,
          source: meta?.source,
          isLora: meta?.isLora,
          ggufVariant: meta?.ggufVariant,
          isDownloaded: meta?.isDownloaded || isSameLoadedModel,
          expectedBytes: meta?.expectedBytes,
          isGguf: meta?.isGguf,
          isDiffusion: meta?.isDiffusion,
          config: meta?.config,
          nativePathToken: meta?.nativePathToken,
          nativePathExpiresAtMs: meta?.nativePathExpiresAtMs,
          forceReload: meta?.forceReload ?? (isSameLoadedModel || undefined),
        };
        await stageOrLoad(selection);
      })();
    },
    [
      activeThreadId,
      externalProvidersForChat,
      modelsFromStore,
      stageOrLoad,
      view,
    ],
  );
  const handleReloadActiveModel = useCallback(
    (config: PerModelConfig) => {
      const checkpoint = inferenceParams.checkpoint;
      if (!checkpoint) return;
      const runtime = useChatRuntimeStore.getState();
      const activeLoadId = runtime.activeLoadId;
      const nativeToken = runtime.activeNativePathToken;
      const nativeExpiry = runtime.activeNativePathExpiresAtMs;
      // A file-picked GGUF is reachable only via its native path token, which
      // the desktop host prunes after a TTL. Reusing an expired token makes the
      // reload fail with an opaque error, so prompt the user to re-select the
      // file instead.
      if (nativeToken && nativeExpiry != null && Date.now() >= nativeExpiry) {
        toast.error("This local model file's access has expired.", {
          description: "Re-select the model file to reload it.",
        });
        return;
      }
      handleCheckpointChange(checkpoint, {
        source: "local",
        isLora: activeModelIsLora,
        // The checkpoint is the id, so a pinned model reloads from that same snapshot.
        loadId: activeLoadId,
        ggufVariant: activeGgufVariant ?? undefined,
        // Without the native token the reload validates the display label as a
        // repo and fails.
        nativePathToken: nativeToken ?? undefined,
        nativePathExpiresAtMs: nativeExpiry,
        isGguf: activeModelIsGguf,
        isDiffusion: activeModelIsDiffusion,
        isDownloaded: true,
        config,
        forceReload: true,
      });
    },
    [
      inferenceParams.checkpoint,
      activeGgufVariant,
      activeModelIsLora,
      activeModelIsGguf,
      activeModelIsDiffusion,
      handleCheckpointChange,
    ],
  );
  const handleEject = useCallback(() => {
    void (async () => {
      if (await ejectModel()) {
        resetArtifacts();
      }
    })();
  }, [ejectModel, resetArtifacts]);

  const openModelSelector = useCallback(() => {
    setModelSelectorLocked(true);
    setModelSelectorOpen(true);
  }, []);

  const closeModelSelector = useCallback(() => {
    setModelSelectorLocked(false);
    setModelSelectorOpen(false);
  }, []);

  const handleModelSelectorOpenChange = useCallback(
    (open: boolean) => {
      if (!open && modelSelectorLocked) return;
      setModelSelectorOpen(open);
    },
    [modelSelectorLocked],
  );
  const openSettings = useCallback(
    () => setSettingsOpen(true),
    [setSettingsOpen],
  );
  const closeSettings = useCallback(
    () => setSettingsOpen(false),
    [setSettingsOpen],
  );
  const { isMobile, pinned } = useSidebar();

  const enterCompare = useCallback(() => {
    viewBeforeCompareRef.current = { ...search };
    useChatRuntimeStore.getState().setActiveThreadId(null);
    useChatRuntimeStore.getState().setContextUsage(null);
    navigate({
      to: "/chat",
      search: {
        compare: crypto.randomUUID(),
        ...(currentProjectId ? { project: currentProjectId } : {}),
      },
    });
  }, [currentProjectId, navigate, search]);

  const exitCompare = useCallback(() => {
    // Prefer the explicit save; fall back to the last non-compare view so
    // the composer + menu path also returns where the user started.
    const saved = viewBeforeCompareRef.current ?? lastNonCompareViewRef.current;
    // No saved view (compare opened by direct URL); fall back to a fresh chat.
    if (!saved) {
      navigate({ to: "/chat" });
      return;
    }
    viewBeforeCompareRef.current = null;
    navigate({ to: "/chat", search: saved });
    // Restore usage from the last assistant message, only if it matches the
    // active checkpoint, else the relaxed render gate shows stale stats.
    const threadId =
      saved.thread ?? useChatRuntimeStore.getState().activeThreadId;
    if (threadId) {
      void listStoredChatMessages(threadId)
        .then(
          (messages) =>
            [...messages].sort((a, b) => b.createdAt - a.createdAt)[0],
        )
        .then((msg) => {
          const metadata = msg?.metadata as Record<string, unknown> | undefined;
          const usage = metadata?.contextUsage as ReturnType<
            typeof useChatRuntimeStore.getState
          >["contextUsage"];
          if (!usage) return;
          const store = useChatRuntimeStore.getState();
          const activeCheckpoint = store.params.checkpoint;
          const usageModelId = (usage as { modelId?: unknown }).modelId;
          // Scope by modelId when present; reject if no active checkpoint
          // (model-scoped usage can't be attributed to "nothing").
          if (typeof usageModelId === "string" && usageModelId) {
            if (!activeCheckpoint || usageModelId !== activeCheckpoint) {
              return;
            }
          }
          // For local turns, also require the restored count to fit in
          // the active window. Skip when unknown (external provider).
          const limit = store.ggufContextLength;
          if (
            typeof limit === "number" &&
            limit > 0 &&
            (usage.totalTokens ?? 0) > limit
          ) {
            return;
          }
          // Key by the thread this restore read, like the history loader: the await above can
          // outlast a switch away, and an unkeyed write would file this thread's usage under
          // the incoming one.
          store.setThreadContextUsage(threadId, usage);
          if (store.activeThreadId === threadId) {
            store.setContextUsage(usage);
          }
        })
        .catch((error) => {
          if (!isExpectedBackgroundChatStorageError(error)) {
            throw error;
          }
        });
    }
  }, [navigate]);

  const models = useMemo<ModelOption[]>(
    () =>
      modelsFromStore.map((model) => ({
        id: model.id,
        name: model.name,
        description: model.description,
        isGguf: model.isGguf,
      })),
    [modelsFromStore],
  );
  const lastOpenRouterChosenModel = useChatRuntimeStore(
    (s) => s.lastOpenRouterChosenModel,
  );
  const externalModels = useMemo<ExternalModelOption[]>(
    () =>
      [...externalProvidersForChat]
        .sort(
          (a, b) =>
            getExternalProviderDropdownRank(a.providerType) -
            getExternalProviderDropdownRank(b.providerType),
        )
        .flatMap((provider) =>
          provider.models.map((model) => {
            // For OpenRouter's free router we know which underlying free
            // model the gateway picked once a stream completes (chat-adapter
            // latches `chunk.model`). Render the chip as
            // `openrouter:<short-chosen>`, dropping the redundant `/free`
            // and the chosen id's org prefix (e.g. openrouter/free +
            // inclusionai/ring-2.6-1t-20260508:free ->
            // openrouter:ring-2.6-1t-20260508:free). The `:free` suffix
            // already conveys "free model".
            let displayName = model;
            if (
              provider.providerType === "openrouter" &&
              model === "openrouter/free" &&
              lastOpenRouterChosenModel
            ) {
              const lastSlash = lastOpenRouterChosenModel.lastIndexOf("/");
              const shortChosen =
                lastSlash >= 0
                  ? lastOpenRouterChosenModel.slice(lastSlash + 1)
                  : lastOpenRouterChosenModel;
              displayName = `openrouter:${shortChosen}`;
            }
            return {
              id: buildExternalModelId(provider.id, model),
              name: displayName,
              providerId: provider.id,
              providerName: provider.name,
              providerType: provider.providerType,
            };
          }),
        ),
    [externalProvidersForChat, lastOpenRouterChosenModel],
  );
  // `externalModels` above is flat-mapped from `provider.models`, the ids the user ticked,
  // so a model unticked in the connection dialog leaves it exactly like one the provider
  // withdrew. The connection also caches the whole fetched catalogue, which tells the two
  // apart, and the picker needs that to avoid blaming the provider for the user's own edit.
  // Depends on the store value and the gate rather than on `externalProvidersForChat`,
  // which is a plain conditional and so hands every hook that reads it a fresh array each
  // render.
  const externalConnections = useMemo<ExternalConnectionRef[]>(
    () =>
      remoteModelsAvailable
        ? externalProviders.map((provider) => ({
          id: provider.id,
          name: provider.name,
          providerType: provider.providerType,
          availableModels: provider.availableModels,
        }))
        : [],
    [remoteModelsAvailable, externalProviders],
  );

  const localModelInventory = useDeviceInventorySources(["localModels"], {
    enabled: active,
  });
  const localModels = useMemo<LoraModelOption[]>(
    () => chatLocalModelOptions(localModelInventory.localModels.rows),
    [localModelInventory.localModels.rows],
  );

  const refreshLocalModels = useCallback(() => {
    void localModelInventory.refresh();
  }, [localModelInventory.refresh]);

  const refreshModelLists = useCallback(
    (deletedModel?: DeletedModelRef) => {
      const { checkpoint } = useChatRuntimeStore.getState().params;
      const activeGgufVariant =
        useChatRuntimeStore.getState().activeGgufVariant;
      if (
        modelMatchesDeleted(
          { id: checkpoint, ggufVariant: activeGgufVariant },
          deletedModel,
        )
      ) {
        useChatRuntimeStore.getState().clearCheckpoint();
      }
      void refresh();
      refreshLocalModels();
    },
    [refresh, refreshLocalModels],
  );

  const loraModels = useMemo<LoraModelOption[]>(() => {
    const fromLoras = lorasFromStore.map((lora) => ({
      id: lora.id,
      name: lora.name,
      baseModel: lora.baseModel,
      updatedAt: lora.updatedAt,
      source: lora.source,
      exportType: lora.exportType,
      audioType: lora.audioType,
    }));
    return [...fromLoras, ...localModels];
  }, [lorasFromStore, localModels]);

  // Everything the picker can offer right now, so the chat's own model is only
  // proposed when selecting it would actually work. A model since deleted, or a
  // connection since removed, drops out and the notice stays quiet.
  const selectableModelIds = useMemo(
    () =>
      new Set<string>([
        ...models.map((model) => model.id),
        ...loraModels.map((model) => model.id),
        ...externalModels.map((model) => model.id),
      ]),
    [models, loraModels, externalModels],
  );

  // Still handleCheckpointChange, the picker's own handler, but reached the way
  // the picker reaches it: with the row's metadata, not the bare id. A local or
  // fine-tuned row is in neither `/api/models/list` nor the external ids, so
  // without it the switch loads on different arguments than the menu would.
  const handleSwitchBackToChatModel = useCallback(
    (modelId: string) => {
      handleCheckpointChange(
        modelId,
        chatModelSwitchMeta(modelId, loraModels),
      );
    },
    [handleCheckpointChange, loraModels],
  );

  const inventoryRefreshStartedRef = useRef(false);
  const refreshDeferredModelInventories = useCallback(() => {
    inventoryRefreshStartedRef.current = true;
    void refresh({ includeLoras: true });
    void localModelInventory.refreshIfOlderThan(INVENTORY_FRESHNESS_WINDOW_MS);
  }, [refresh, localModelInventory.refreshIfOlderThan]);

  useEffect(() => {
    void refresh({ includeLoras: false });
    const timeoutId = window.setTimeout(() => {
      if (!inventoryRefreshStartedRef.current) {
        refreshDeferredModelInventories();
      }
    }, 1200);
    return () => window.clearTimeout(timeoutId);
  }, [refresh, refreshDeferredModelInventories]);

  useEffect(() => {
    if (!active || !modelSelectorOpen) return;
    refreshDeferredModelInventories();
  }, [active, modelSelectorOpen, refreshDeferredModelInventories]);

  const tourSteps = useMemo(
    () =>
      buildChatTourSteps({
        t,
        canCompare,
        openModelSelector,
        closeModelSelector,
        openSettings,
        closeSettings,
        enterCompare,
        exitCompare,
      }),
    [
      t,
      canCompare,
      closeModelSelector,
      closeSettings,
      enterCompare,
      exitCompare,
      openModelSelector,
      openSettings,
    ],
  );

  const tour = useGuidedTourController({
    id: "chat",
    steps: tourSteps,
  });

  useEffect(() => {
    if (tour.open) return;
    if (!modelSelectorLocked) return;
    const timeoutId = window.setTimeout(() => {
      setModelSelectorLocked(false);
      setModelSelectorOpen(false);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [modelSelectorLocked, tour.open]);

  const showArtifactOverlay = Boolean(
    selectedArtifact &&
    (view.mode === "compare" || artifactSurface === "overlay"),
  );

  return (
    // Provides `active` to ChatRuntimeProvider (drops the message views/composers
    // while off-route, keeping the runtime alive) and to the compare chrome.
    <ChatActiveContext.Provider value={active}>
      <div className="flex min-h-0 min-w-0 flex-1 basis-0 overflow-hidden bg-background pt-[var(--studio-content-top-inset,0px)]">
        {/* Portaled surfaces render to document.body, escaping the parent's hidden
          wrapper, so gate them on `active` to keep them off other tabs. */}
        {active && <GuidedTour {...tour.tourProps} />}
        {/* Single app-level mount for the Bypass permissions warning. It is driven
          by global store state, so it must live at one stable root (not inside a
          Composer) -- otherwise Compare mode's multiple composers would each
          render their own copy and the shared-composer menu would have none. It
          also portals to body, so gate it on `active` like the tour above. */}
        {active && <BypassPermissionsConfirmDialog />}
        {/* `--studio-chat-notice-height` is 0 until ChatModelNotice is actually on
          screen, and the thread viewport adds it to the top padding it already
          reserves for the header. Without it the notice is an opaque bar over
          space nothing reserved, and the top of the first message reads
          underneath it. Declared here, on the nearest ancestor of BOTH the
          notice and the viewport, so the two cannot disagree about its height. */}
        <div className="relative flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden [--studio-content-top-inset:0px] has-[[data-chat-model-notice]]:[--studio-chat-notice-height:2.25rem]">
          <NativeModelDropOverlay state={nativeModelDropState} />
          {/* Fade under the top bar so messages dissolve as they scroll
            beneath it, instead of a hard cut. */}
          {view.mode !== "compare" && (
            <div
              aria-hidden
              className="chat-header-fade pointer-events-none absolute left-0 right-[10px] top-[calc(var(--studio-content-top-inset,0px)+var(--studio-chat-header-height,48px)+var(--studio-chat-notice-height,0px))] z-20 h-6 bg-gradient-to-b from-background to-transparent"
            />
          )}
          <div
            className={cn(
              "pointer-events-none absolute top-[var(--studio-content-top-inset,0px)] left-0 right-0 z-40 flex h-[var(--studio-chat-header-height,48px)] shrink-0 items-start bg-background pt-[var(--studio-chat-header-padding-top,11px)] pr-3 md:pr-4",
              isMobile
                ? "pl-12"
                : pinned
                  ? "pl-2"
                  : isTauri
                    ? "pl-[var(--studio-collapsed-chat-controls-inset,0.75rem)]"
                    : "pl-[calc(0.5rem+max(0px,var(--studio-mac-traffic-light-inset,0px)-var(--sidebar-width-icon,3rem)))]",
              view.mode === "compare" &&
              "right-0 left-auto w-auto bg-transparent pl-0 pr-3 md:pr-4",
            )}
          >
            <div className="pointer-events-auto flex items-center gap-1">
              {isTauri && !isMobile && !pinned && view.mode !== "compare" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  title="New chat"
                  aria-label="New chat"
                  onClick={handleDesktopNewChat}
                  className="!size-[30px] rounded-[10px] text-muted-foreground"
                >
                  <HugeiconsIcon
                    icon={PencilEdit02Icon}
                    strokeWidth={1.75}
                    className="size-icon"
                  />
                </Button>
              )}
              {view.mode !== "compare" && currentProjectId && (
                <nav
                  aria-label="Project location"
                  className="flex h-[var(--studio-chat-control-height,34px)] min-w-0 items-center gap-1.5 self-center text-ui-13p5 tracking-nav text-muted-foreground"
                >
                  <ProjectSwitcher
                    currentProject={currentProject}
                    projects={projects}
                    isLoading={projectsLoading}
                    onSelectProject={openProjectLanding}
                    onViewAllProjects={openProjectsList}
                  />
                  {currentProject && activeThreadId ? (
                    <>
                      <span className="shrink-0" aria-hidden={true}>
                        /
                      </span>
                      <span className="min-w-0 truncate">
                        {currentChatTitle ?? "New chat"}
                      </span>
                    </>
                  ) : null}
                </nav>
              )}
              {pendingNativeModelIntent && view.mode !== "compare" ? (
                <NativeModelChip
                  intent={pendingNativeModelIntent}
                  nativeReadsDisabled={!nativePathLeasesSupported}
                  onLoad={() =>
                    loadNativeModelIntent(
                      pendingNativeModelIntent,
                      "Loading selected local GGUF model.",
                    )
                  }
                />
              ) : null}
              {loadingModel ? (
                <ModelLoadInlineStatus
                  label={
                    loadProgress?.phase === "starting"
                      ? t("picker.startingModel")
                      : loadingModel.isDownloaded || loadingModel.isCachedLora
                        ? t("picker.loadingModel")
                        : t("picker.downloadingModel")
                  }
                  title={
                    loadingModel.isDownloaded
                      ? t("picker.loadingFromCache", { name: loadingModel.displayName })
                      : loadingModel.isCachedLora
                        ? t("picker.loadingInMemory", { name: loadingModel.displayName })
                        : t("picker.loadingWithDownload", { name: loadingModel.displayName })
                  }
                  progressPercent={loadProgress?.percent}
                  progressLabel={loadProgress?.label}
                  stopLabel={t("picker.stop")}
                  onStop={cancelLoading}
                />
              ) : null}
              {!loadingModel && modelsError ? (
                <div
                  className="relative top-0.5 pl-0.5"
                  role="status"
                  aria-live="polite"
                >
                  <CopyableErrorChip message={modelsError} />
                </div>
              ) : null}
            </div>
            <div className="pointer-events-auto ml-auto flex items-center gap-1">
              {view.mode === "single" && (contextUsage || contextWindowKnown) ? (
                <ContextUsageBar
                  used={contextUsage?.totalTokens ?? null}
                  // null on external providers; the bar handles that.
                  total={ggufContextLength}
                  cached={contextUsage?.cachedTokens}
                  cacheWrites={contextUsage?.cacheWriteTokens}
                  promptTokens={contextUsage?.promptTokens}
                  completionTokens={contextUsage?.completionTokens}
                  className="h-[var(--studio-chat-control-height,34px)]"
                />
              ) : null}
              {view.mode === "single" && (
                <Tooltip>
                  <TooltipPrimitive.Trigger asChild={true}>
                    <button
                      type="button"
                      onClick={toggleIncognito}
                      className={cn(
                        "flex h-[30px] cursor-pointer items-center gap-1.5 rounded-[10px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                        incognito
                          ? "bg-primary/15 px-2 font-medium text-primary text-xs hover:bg-primary/20"
                          : "size-[30px] justify-center text-nav-fg hover:bg-nav-surface-hover hover:text-black dark:hover:text-white",
                      )}
                      aria-label={incognitoLabel}
                      aria-pressed={incognito}
                    >
                      <HugeiconsIcon
                        icon={BubbleChatTemporaryIcon}
                        strokeWidth={1.75}
                        className="size-icon shrink-0"
                      />
                      {incognito && (
                        <span className="text-xs">{t("chat.toolbar.temporaryChatActive")}</span>
                      )}
                    </button>
                  </TooltipPrimitive.Trigger>
                  <TooltipContent
                    side="bottom"
                    sideOffset={6}
                    className="tooltip-compact"
                  >
                    {incognitoLabel}
                  </TooltipContent>
                </Tooltip>
              )}
              {view.mode === "single" &&
                latestResearchRunId &&
                latestResearchRunStatus ? (
                <Tooltip>
                  <TooltipPrimitive.Trigger asChild={true}>
                    <button
                      type="button"
                      onClick={() => {
                        if (openResearchRunId === latestResearchRunId) {
                          closeResearchPanel();
                          return;
                        }
                        setSettingsOpen(false);
                        closeArtifactSurface();
                        openResearchPanel(latestResearchRunId);
                      }}
                      className="relative flex size-[30px] cursor-pointer items-center justify-center rounded-[10px] text-nav-fg transition-colors hover:bg-nav-surface-hover hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:hover:text-white"
                      aria-label={t("chat.toolbar.researchActivity")}
                      aria-pressed={openResearchRunId === latestResearchRunId}
                    >
                      <HugeiconsIcon
                        icon={Telescope02Icon}
                        className="size-icon"
                        strokeWidth={1.75}
                      />
                      {!['completed', 'failed', 'cancelled'].includes(latestResearchRunStatus) ? (
                        <span className="absolute right-1 top-1 size-1.5 rounded-full bg-primary ring-2 ring-background" />
                      ) : null}
                    </button>
                  </TooltipPrimitive.Trigger>
                  <TooltipContent side="bottom" sideOffset={6} className="tooltip-compact">
                    {t("chat.toolbar.researchActivity")}
                  </TooltipContent>
                </Tooltip>
              ) : null}
              {!settingsOpen && (
                <Tooltip>
                  <TooltipPrimitive.Trigger asChild={true}>
                    <button
                      type="button"
                      onClick={() => {
                        useResearchRunStore.getState().closePanel();
                        setSettingsOpen(true);
                      }}
                      className="flex size-[30px] cursor-pointer items-center justify-center rounded-[10px] text-nav-fg transition-colors hover:bg-nav-surface-hover hover:text-black dark:hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      aria-label={t("chat.toolbar.openRunSettings")}
                    >
                      <HugeiconsIcon
                        icon={LayoutAlignRightIcon}
                        strokeWidth={1.75}
                        className="size-icon"
                      />
                    </button>
                  </TooltipPrimitive.Trigger>
                  <TooltipContent
                    side="bottom"
                    sideOffset={6}
                    className="tooltip-compact"
                  >
                    {t("chat.toolbar.openRunSettings")}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>

          {view.mode === "single" && (
            <ChatModelNotice
              threadId={view.threadId ?? newChatThreadId ?? undefined}
              checkpoint={inferenceParams.checkpoint}
              selectableModelIds={selectableModelIds}
              onSwitch={handleSwitchBackToChatModel}
            />
          )}

          {view.mode === "project" ? (
            <ProjectLanding
              key={view.projectId}
              projectId={view.projectId}
              projectName={currentProject?.name ?? "Project"}
              items={currentProjectItems}
            />
          ) : view.mode === "single" ? (
            // Keyed by project only (not thread / new-chat nonce) so switching threads or
            // starting a New Chat reuses the same provider and switches in place. This keeps
            // an in-flight generation streaming in the background (assistant-ui keeps every
            // alive thread's runtime mounted) instead of remounting the provider and cutting
            // it off; returning to that thread reattaches the live run rather than reloading
            // a half-saved one.
            <ChatComposerModelSelectorProvider
              selector={
                <ModelSelector
                  models={models}
                  loraModels={loraModels}
                  externalModels={externalModels}
                  externalConnections={externalConnections}
                  value={inferenceParams.checkpoint}
                  loaded={chatModelLoaded({
                    checkpoint: inferenceParams.checkpoint,
                    isExternalModel: isExternalModelId(inferenceParams.checkpoint),
                    isExternalMissing: Boolean(
                      missingExternalModel(
                        inferenceParams.checkpoint,
                        externalModels,
                        externalConnections,
                      ),
                    ),
                    residentCheckpoint,
                  })}
                  activeGgufVariant={activeGgufVariant}
                  activeModelConfig={activeModelConfig}
                  activeGgufContextLength={ggufContextLength}
                  onValueChange={handleCheckpointChange}
                  onEject={handleEject}
                  onFoldersChange={refreshLocalModels}
                  onModelsChange={refreshModelLists}
                  deleteDisabled={modelOperationInProgress}
                  variant="muted"
                  size="sm"
                  open={active && modelSelectorOpen}
                  onOpenChange={handleModelSelectorOpenChange}
                  triggerDataTour="chat-model-selector"
                  contentDataTour="chat-model-selector-popover"
                  showCloudIndicator={isExternalModel}
                  className="max-w-full !pr-2"
                />
              }
            >
              <NativeAttachmentTargetContext.Provider value={artifactViewKey}>
                <SingleContent
                  key={view.projectId ?? "single"}
                  threadId={view.threadId}
                  newThreadNonce={view.newThreadNonce}
                  projectId={view.projectId}
                  artifact={selectedArtifact}
                  artifactSurface={artifactSurface}
                  onCloseArtifact={closeArtifactSurface}
                />
              </NativeAttachmentTargetContext.Provider>
            </ChatComposerModelSelectorProvider>
          ) : (
            <CompareContent
              key={view.pairId}
              pairId={view.pairId}
              projectId={view.projectId}
              models={models}
              loraModels={loraModels}
              externalModels={externalModels}
              externalConnections={externalConnections}
              onFoldersChange={refreshLocalModels}
              onModelsChange={refreshModelLists}
              deleteDisabled={modelOperationInProgress}
              onExitCompare={exitCompare}
            />
          )}

          {active && showArtifactOverlay && selectedArtifact ? (
            <ArtifactSurface
              artifact={selectedArtifact}
              variant="overlay"
              onClose={closeArtifactSurface}
            />
          ) : null}
        </div>

        <ChatSettingsPanel
          open={active && settingsOpen}
          onOpenChange={(open) => {
            setSettingsOpen(open);
          }}
          params={inferenceParams}
          onParamsChange={setInferenceParams}
          modelConfig={
            view.mode !== "compare" && activeModelConfig && !modelLoading ? (
              <SidebarModelConfig
                modelId={inferenceParams.checkpoint}
                ggufVariant={activeGgufVariant ?? null}
                isGguf={activeModelIsGguf}
                isDiffusion={activeModelIsDiffusion}
                nativeContextLength={ggufNativeContextLength}
                loadedContextLength={ggufContextLength}
                loadedConfig={activeModelConfig}
                onReload={handleReloadActiveModel}
              />
            ) : null
          }
          isExternalModel={isExternalModel}
          providerCapabilities={activeProviderCapabilities}
          activeExternalProvider={activeExternalProvider}
          onExternalProviderChange={(updatedProvider) => {
            setExternalProviders(
              externalProviders.map((provider) =>
                provider.id === updatedProvider.id ? updatedProvider : provider,
              ),
            );
          }}
          externalProviderType={activeExternalProviderType}
        />
      </div>
    </ChatActiveContext.Provider>
  );
}
