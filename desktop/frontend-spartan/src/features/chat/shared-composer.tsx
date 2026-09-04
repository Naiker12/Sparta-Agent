import { mlxRuntimeStateFrom } from "./lib/mlx-runtime-state";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import {
  thinkEffortAriaLabel,
  thinkToggleAriaLabel,
} from "@/components/assistant-ui/think-aria-label";
import { Button } from "@/components/ui/button";
import { BulbIcon } from "@/lib/bulb-icon";
import { MicIcon } from "@/lib/mic-icon";
import { Tick02Icon } from "@/lib/tick-icon";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { applyQwenThinkingParams } from "@/features/chat/utils/qwen-params";
import { AUDIO_ACCEPT } from "@/lib/audio-utils";
import { isTauri } from "@/lib/api-base";
import { isMultimodalResponse } from "./types/api";
import { getImageInputUnavailableReason } from "./utils/image-input-support";
import { confirmStopRunningChatsIfNeeded } from "./utils/confirm-stop-running-chats";
import { requestLocalPromptQueueStop } from "./utils/prompt-queue-boundary";
import { cancelPreStreamRunReservations } from "./utils/pre-stream-run-reservation";
import type { ModelLifecycleLease } from "./utils/model-lifecycle-gate";
import { useAui } from "@assistant-ui/react";
import {
  ArrowUpIcon,
  Columns2Icon,
  GlobeIcon,
  HeadphonesIcon,
  SquareIcon,
  XIcon,
} from "lucide-react";
import {
  AttachmentIcon,
  CodeIcon,
  Download01Icon,
  Image03Icon,
  PencilRulerIcon,
} from "@hugeicons/core-free-icons";
import { useNavigate } from "@tanstack/react-router";
import { HugeiconsIcon } from "@hugeicons/react";
import { toast } from "@/lib/toast";
import { useSettingsDialogStore } from "@/features/settings/stores/settings-dialog-store";
import { loadExternalProviders } from "./external-providers";
import { PromptStorageDialog } from "./prompt-storage/prompt-storage-dialog";
import { listPromptEntries, type PromptEntry } from "./api/prompts-api";
import { McpComposerButton } from "./mcp-composer-button";
import { PermissionModeComposerPill } from "./permission-mode-select";
import { reasoningCapsFromLoad } from "./lib/apply-inference-status-to-store";
import { NewProjectDialog } from "./components/new-project-dialog";
import { ThreadWorkspaceChip } from "./components/thread-workspace-chip";
import { useChatProjects } from "./hooks/use-chat-projects";
import { usePlusMenuPrefsStore } from "./stores/plus-menu-prefs-store";
import { useT } from "@/i18n";
import { confirmRemoteCodeIfNeeded } from "@/features/security";
import {
  DEFAULT_MAX_SEQ_LENGTH,
  normalizeMaxSeqLength,
  resolveInitialConfig,
  type PerModelConfig,
} from "@/features/model-picker";
import { loadManagedLlamaFlags } from "@/features/model-picker/api/llama-flags";
import { fetchLoadExtraArgs } from "@/features/model-picker/api/model-overrides";
import { sanitizeStoredExtraArgs } from "@/features/model-picker/model-config/llama-extra-args";
import {
  confirmTransformersUpgradeIfNeeded,
  useTransformersUpgradeDialogStore,
} from "@/features/transformers-upgrade";
import { prepareHfTokenForUse } from "@/features/hf-auth";
import {
  fetchGgufStagedMetadata,
  loadModel,
  validateModel,
} from "./api/chat-api";
import { resolveFitMaxSeqLength, resolveManualAutoCtxPin } from "./presets/preset-policy";
import { ensureGpuDeviceCache } from "@/hooks/use-gpu-info";
import {
  parseExternalModelId,
  providerModelSupportsVision,
} from "./external-providers";
import { compareModelDisplayName } from "./lib/external-model-label";
import { useExternalProvidersStore } from "./stores/external-providers-store";
import { useComposerPillFit } from "@/hooks/use-composer-pill-fit";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  resolveComparePlacement,
  shouldPinDiffusionPlacement,
} from "./lib/gpu-placement";
import {
  loadedGpuMemoryFields,
  type ReasoningEffort,
  reconcilePersistedGpuIds,
  resolveLoadedSpeculativeSettings,
  resolvePreserveThinkingOnLoad,
  persistGpuMemoryModeOnLoad,
  resolveSpeculativeSettingsForLoad,
  saveSpeculativeType,
  useChatRuntimeStore,
} from "./stores/chat-runtime-store";
import {
  getExternalReasoningCapabilities,
  providerSupportsBuiltinCodeExecution,
  providerSupportsBuiltinImageGeneration,
  providerSupportsBuiltinWebFetch,
} from "./provider-capabilities";
import {
  type CompositionEvent,
  type ClipboardEvent,
  type FC,
  type KeyboardEvent,
  type MutableRefObject,
  type ReactElement,
  type ReactNode,
  Fragment,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

// ---------------------------------------------------------------------------
// Imports desde submódulos de shared-composer/
// ---------------------------------------------------------------------------
import {
  type CompareMessagePart,
  type CompareHandle,
  type CompareHandles,
  CompareHandlesContext,
  CompareHandlesProvider,
  RegisterCompareHandle,
} from "./shared-composer/compare-handles";
export type { CompareMessagePart, CompareHandle, CompareHandles };
export { CompareHandlesProvider, RegisterCompareHandle };

import { useDictation } from "./shared-composer/use-dictation";

import {
  formatReasoningEffortLabel,
  formatReasoningDisabledLabel,
} from "./shared-composer/reasoning-labels";

import {
  IMAGE_ACCEPT,
  MAX_IMAGE_SIZE,
  IME_STUCK_TIMEOUT_MS,
  isNativeComposing,
  ArrowDownStandardIcon,
  fileToBase64DataURL,
  type PendingImage,
  PendingImageThumb,
  PillGlyph,
} from "./shared-composer/composer-ui-helpers";

import {
  type CompareModelSelection,
  cleanCompareChatTemplate,
  resolveCompareSpecDraftNMax,
} from "./shared-composer/compare-model-types";
import { SharedComposerToolsMenu } from "./shared-composer/shared-composer-tools-menu";
import { useComparePromptQueue } from "./shared-composer/use-compare-prompt-queue";
import { useCompareAttachments } from "./shared-composer/use-compare-attachments";


// ---------------------------------------------------------------------------
// SharedComposer — orquestador principal
// (useDictation, PendingImageThumb, PillGlyph, reasoning labels
//  y compare-handle types se importan desde ./shared-composer/)
// ---------------------------------------------------------------------------

export function SharedComposer({
  handlesRef,
  model1,
  model2,
  onExitCompare,
  model1ThreadId,
  model2ThreadId,
}: {
  handlesRef: CompareHandles;
  model1?: CompareModelSelection;
  model2?: CompareModelSelection;
  onExitCompare?: () => void;
  model1ThreadId?: string;
  model2ThreadId?: string;
}): ReactElement {
  const t = useT();
  const navigate = useNavigate();
  // Exit compare: parent's restore handler, or fresh chat if opened by URL.
  const handleExitCompare = useCallback(() => {
    if (onExitCompare) {
      onExitCompare();
      return;
    }
    navigate({ to: "/chat" });
  }, [navigate, onExitCompare]);
  const [text, setText] = useState("");
  const [running, setRunning] = useState(false);
  const [comparing, setComparing] = useState(false);
  const textRef = useRef(text);
  const [dragging, setDragging] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);
  const [promptStorageOpen, setPromptStorageOpen] = useState(false);
  const [recentPrompts, setRecentPrompts] = useState<PromptEntry[]>([]);
  const refreshRecentPrompts = useCallback(async () => {
    try {
      const rows = await listPromptEntries();
      const byRecent = [...rows].sort((a, b) => b.updatedAt - a.updatedAt);
      // Pinned prompts take over the submenu; fall back to the 3 most recent.
      const pinnedIds = usePlusMenuPrefsStore.getState().pinnedPromptIds;
      const pinned = byRecent.filter((p) => pinnedIds.includes(p.id));
      setRecentPrompts(pinned.length > 0 ? pinned : byRecent.slice(0, 3));
    } catch {
    }
  }, []);
  const compareStepSucceededRef = useRef(false);
  const sendRef = useRef<(() => void) | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const composingRef = useRef(false);
  const stuckImeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  const activeModel = useChatRuntimeStore((s) => {
    const checkpoint = s.params.checkpoint;
    return s.models.find((m) => m.id === checkpoint);
  });
  const checkpoint = useChatRuntimeStore((s) => s.params.checkpoint);
  const connectionsEnabled = useExternalProvidersStore(
    (s) => s.connectionsEnabled,
  );
  const externalProvidersAll = useExternalProvidersStore((s) => s.providers);
  const externalProviders = connectionsEnabled ? externalProvidersAll : [];
  const modelLoaded = useChatRuntimeStore(
    (s) => !!s.params.checkpoint && !s.modelLoading,
  );
  const lastModelLoadError = useChatRuntimeStore((s) => s.lastModelLoadError);
  const loadedIsMultimodal = useChatRuntimeStore((s) => s.loadedIsMultimodal);
  const mmprojFallbackReason = useChatRuntimeStore(
    (s) => s.mmprojFallbackReason,
  );
  const supportsReasoning = useChatRuntimeStore((s) => s.supportsReasoning);
  const reasoningAlwaysOn = useChatRuntimeStore((s) => s.reasoningAlwaysOn);
  const reasoningEnabled = useChatRuntimeStore((s) => s.reasoningEnabled);
  const setReasoningEnabled = useChatRuntimeStore((s) => s.setReasoningEnabled);
  const reasoningStyle = useChatRuntimeStore((s) => s.reasoningStyle);
  const reasoningEffort = useChatRuntimeStore((s) => s.reasoningEffort);
  const supportsReasoningOff = useChatRuntimeStore(
    (s) => s.supportsReasoningOff,
  );
  const reasoningEffortLevels = useChatRuntimeStore(
    (s) => s.reasoningEffortLevels,
  );
  const setReasoningEffort = useChatRuntimeStore((s) => s.setReasoningEffort);
  const supportsPreserveThinking = useChatRuntimeStore(
    (s) => s.supportsPreserveThinking,
  );
  const preserveThinking = useChatRuntimeStore((s) => s.preserveThinking);
  const setPreserveThinking = useChatRuntimeStore((s) => s.setPreserveThinking);
  const supportsTools = useChatRuntimeStore((s) => s.supportsTools);
  const supportsBuiltinWebSearch = useChatRuntimeStore(
    (s) => s.supportsBuiltinWebSearch,
  );
  const toolsEnabled = useChatRuntimeStore((s) => s.toolsEnabled);
  const setToolsEnabled = useChatRuntimeStore((s) => s.setToolsEnabled);
  const codeToolsEnabled = useChatRuntimeStore((s) => s.codeToolsEnabled);
  const setCodeToolsEnabled = useChatRuntimeStore((s) => s.setCodeToolsEnabled);
  const imageToolsEnabled = useChatRuntimeStore((s) => s.imageToolsEnabled);
  const setImageToolsEnabled = useChatRuntimeStore(
    (s) => s.setImageToolsEnabled,
  );
  const artifactsEnabled = useChatRuntimeStore((s) => s.artifactsEnabled);
  const setArtifactsEnabled = useChatRuntimeStore((s) => s.setArtifactsEnabled);
  const showCanvasMenuItem = useChatRuntimeStore((s) => s.showCanvasMenuItem);
  const mcpEnabledForChat = useChatRuntimeStore((s) => s.mcpEnabledForChat);
  const setMcpEnabledForChat = useChatRuntimeStore(
    (s) => s.setMcpEnabledForChat,
  );
  // Three most recently updated projects for the quick-access submenu
  const { projects } = useChatProjects();
  const recentProjects = [...projects]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, 3);
  const openProject = (projectId: string) => {
    useChatRuntimeStore.getState().setActiveProjectId(projectId);
    navigate({ to: "/chat", search: { project: projectId } });
  };
  const webFetchToolsEnabled = useChatRuntimeStore(
    (s) => s.webFetchToolsEnabled,
  );
  const setWebFetchToolsEnabled = useChatRuntimeStore(
    (s) => s.setWebFetchToolsEnabled,
  );
  const activeThreadId = useChatRuntimeStore((s) => s.activeThreadId);
  // Empty until a compare run; gates Export chat off.
  const exportThreadIds = [model1ThreadId, model2ThreadId, activeThreadId].filter(
    (id): id is string => Boolean(id),
  );
  const lastOpenRouterChosenModel = useChatRuntimeStore(
    (s) => s.lastOpenRouterChosenModel,
  );
  const externalSelection = parseExternalModelId(checkpoint);
  const isExternalModel = externalSelection !== null;
  const selectedExternalProvider =
    externalSelection != null
      ? externalProviders.find((p) => p.id === externalSelection.providerId)
      : undefined;
  const imageUnavailableReason = getImageInputUnavailableReason({
    activeModel,
    isExternalModel,
    externalSupportsVision: providerModelSupportsVision(
      selectedExternalProvider?.providerType,
      externalSelection?.modelId,
    ),
    externalModelLabel: externalSelection?.modelId ?? null,
    loadedIsMultimodal,
    modelLoaded,
    loadError: lastModelLoadError,
    mmprojFallbackReason,
  });
  const isCompareMode = Boolean(model1?.id || model2?.id);
  // Attach-time gate. Compare mode defers to send: the catalog can lag a
  // model's real capabilities (e.g. a GGUF whose mmproj arrives after the
  // snapshot), and models[] only syncs after ensureModelLoaded at send time.
  // Single mode uses the loaded model's runtime capability.
  const attachUnavailableReason = isCompareMode ? null : imageUnavailableReason;
  const effectiveExternalModelId =
    selectedExternalProvider?.providerType === "openrouter" &&
    externalSelection?.modelId === "openrouter/free" &&
    lastOpenRouterChosenModel
      ? lastOpenRouterChosenModel
      : externalSelection?.modelId;
  const externalReasoningCaps =
    externalSelection != null
      ? getExternalReasoningCapabilities(
          selectedExternalProvider?.providerType,
          effectiveExternalModelId,
          {
            isReasoningProvider:
              selectedExternalProvider?.isReasoningModel === true,
            baseUrl: selectedExternalProvider?.baseUrl ?? null,
          },
        )
      : null;
  const isExternalOpenAIReasoning =
    externalReasoningCaps?.supportsReasoning === true &&
    externalReasoningCaps.reasoningStyle === "reasoning_effort";
  const effectiveReasoningStyle =
    externalReasoningCaps?.reasoningStyle ?? reasoningStyle;
  const effectiveReasoningAlwaysOn =
    externalReasoningCaps?.reasoningAlwaysOn ?? reasoningAlwaysOn;
  const effectiveSupportsReasoningOff =
    externalReasoningCaps?.supportsReasoningOff ?? supportsReasoningOff;
  const effectiveReasoningEffortLevels =
    externalReasoningCaps?.reasoningEffortLevels ?? reasoningEffortLevels;
  const effectiveSupportsReasoning =
    externalReasoningCaps?.supportsReasoning ?? supportsReasoning;
  const reasoningLockedOn =
    effectiveSupportsReasoning &&
    (effectiveReasoningAlwaysOn || !effectiveSupportsReasoningOff);
  // Kimi's $web_search builtin mandates thinking=disabled
  // (https://platform.kimi.ai/docs/guide/use-web-search). Both pills stay
  // clickable, but turning one on flips the other off; the click handlers
  // below enforce this so the visible state matches what the backend sends.
  const isKimiExternal = selectedExternalProvider?.providerType === "kimi";
  const effectiveReasoningEnabled = reasoningLockedOn ? true : reasoningEnabled;
  const effectiveReasoningVisualEnabled =
    effectiveReasoningEnabled && reasoningEffort !== "none";
  const reasoningDisabled = !modelLoaded || !effectiveSupportsReasoning;
  const showReasoningControl =
    effectiveSupportsReasoning || effectiveReasoningAlwaysOn;
  // enable_thinking_effort (GLM-5.2: high|max + disable) reuses the effort
  // dropdown; it just also carries an Off row via supportsReasoningOff.
  const isEffort =
    effectiveReasoningStyle === "reasoning_effort" ||
    effectiveReasoningStyle === "enable_thinking_effort";
  // GLM-5.2's effort menu (Off, high, max) has short rows, so it can sit a
  // touch skinnier. Skip the narrower floor when a Preserve thinking row is
  // present, since that longer label needs the wider width to stay one line.
  const narrowEffortMenu =
    effectiveReasoningStyle === "enable_thinking_effort" &&
    !supportsPreserveThinking;
  const thinkingActiveLook = isEffort
    ? reasoningLockedOn || (effectiveReasoningVisualEnabled && !reasoningDisabled)
    : reasoningLockedOn || (effectiveReasoningEnabled && !reasoningDisabled);
  // Two-pill gating: Search lights up on a local tool runtime (supportsTools:
  // Code/python + local web_search) OR a provider-run server-side web_search
  // (supportsBuiltinWebSearch: OpenAI/Anthropic/OpenRouter/Kimi). Code lights
  // up on the local runtime OR Anthropic with a model accepting the
  // server-side code_execution_20250825 tool (see
  // providerSupportsBuiltinCodeExecution). Anthropic is the only external
  // provider shipping a code-execution tool today.
  const supportsBuiltinCodeExecution = providerSupportsBuiltinCodeExecution(
    selectedExternalProvider?.providerType,
    effectiveExternalModelId,
    selectedExternalProvider?.baseUrl,
  );
  const supportsBuiltinImageGeneration = providerSupportsBuiltinImageGeneration(
    selectedExternalProvider?.providerType,
    effectiveExternalModelId,
    selectedExternalProvider?.baseUrl,
  );
  const supportsBuiltinWebFetch = providerSupportsBuiltinWebFetch(
    selectedExternalProvider?.providerType,
  );
  // Gemini rejects codeExecution alongside image modalities. Search is
  // blocked on older Gemini image ids but allowed on Gemini 3 image models
  // (supportsBuiltinWebSearch encodes the per-model allowance), so we only
  // disable Code unconditionally in Gemini image mode.
  const isExternalGemini = selectedExternalProvider?.providerType === "gemini";
  const imageDisabled = !modelLoaded || !supportsBuiltinImageGeneration;
  const imageModeDisablesCode =
    isExternalGemini && imageToolsEnabled && !imageDisabled;
  // Image-tier Gemini models always reject codeExecution and reject
  // web_search on older ids (Gemini 3.x Pro/Flash allow it, encoded in
  // supportsBuiltinWebSearch). Don't let local `supportsTools` re-enable a
  // pill the Gemini backend silently drops: detect image-tier Gemini and
  // gate strictly on provider builtin support.
  const isGeminiImageTier =
    isExternalGemini && supportsBuiltinImageGeneration;
  // Disable only when a loaded model lacks the capability; with no model the
  // tool can still be pre-selected, matching the + menu.
  const searchDisabled =
    modelLoaded &&
    (isGeminiImageTier
      ? !supportsBuiltinWebSearch
      : !(supportsTools || supportsBuiltinWebSearch));
  const codeDisabled =
    (modelLoaded &&
      (isGeminiImageTier
        ? true
        : !(supportsTools || supportsBuiltinCodeExecution))) ||
    imageModeDisablesCode;
  // Images pill lights only on OpenAI cloud Responses-API models and the
  // Gemini Nano Banana family. No local tool runtime fallback.
  const showImagePill = supportsBuiltinImageGeneration;
  // Fetch pill: Anthropic-only (web_fetch_20250910 / web_fetch_20260209).
  const webFetchDisabled = !modelLoaded || !supportsBuiltinWebFetch;
  const showWebFetchPill = supportsBuiltinWebFetch;
  // Above 4 pills, collapse to icons only. Compare, Search, Code, and
  // permissions always show; the rest are conditional. Narrow viewports
  // collapse too: the labelled row is wider than a phone-width composer.
  const isMobile = useIsMobile();
  const pillCount =
    4 +
    (showImagePill ? 1 : 0) +
    (showWebFetchPill ? 1 : 0) +
    (artifactsEnabled ? 1 : 0) +
    (mcpEnabledForChat ? 1 : 0);
  // Under the count threshold the row still overflows on long labels, wrapping
  // onto a second line inside the action bar. Measuring collapses just enough
  // to keep it beside the dictate/send controls.
  const { pillRowRef, pillCompact } = useComposerPillFit(
    isMobile || pillCount > 4,
  );
  // Backwards-compatible alias for call sites still referencing
  // `toolsDisabled` (rare; both pills used it before).
  const toolsDisabled = codeDisabled;
  const {
    pendingImages,
    setPendingImages,
    pendingAudio,
    setPendingAudio,
    addFiles,
    removePendingImage,
    removePendingAudio,
    clearAttachments,
    handleFilePaste,
  } = useCompareAttachments({ attachUnavailableReason });

  const pendingImagesRef = useRef(pendingImages);
  const pendingAudioRef = useRef(pendingAudio);
  useEffect(() => {
    textRef.current = text;
    pendingImagesRef.current = pendingImages;
    pendingAudioRef.current = pendingAudio;
  }, [text, pendingImages, pendingAudio]);

  const {
    isDictating,
    isFinalizing: isDictationFinalizing,
    start: startDictation,
    stop: stopDictation,
  } = useDictation(setText);

  useEffect(() => {
    const id = setInterval(() => {
      const handles = handlesRef.current;
      const any = Object.values(handles).some((h) => h.isRunning());
      setRunning(any);
    }, 200);
    return () => clearInterval(id);
  }, [handlesRef]);

  const {
    isQueueRunning,
    queueProgress,
    startQueue,
    resetPromptQueue,
  } = useComparePromptQueue({
    running,
    comparing,
    setText,
    sendRef,
    compareStepSucceededRef,
  });

  // Auto-expand textarea up to 6 rows, then scroll (matches regular chat composer).
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    const styles = window.getComputedStyle(ta);
    const lineHeight = parseFloat(styles.lineHeight) || 20;
    const paddingY =
      parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
    const borderY =
      parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth);
    const maxHeight = lineHeight * 6 + paddingY + borderY;
    const next = Math.min(ta.scrollHeight, maxHeight);
    ta.style.height = `${next}px`;
    ta.style.overflowY = ta.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [text]);


  function clearStuckImeTimer() {
    if (stuckImeTimerRef.current) {
      clearTimeout(stuckImeTimerRef.current);
      stuckImeTimerRef.current = null;
    }
  }

  function setCompositionState(next: boolean) {
    composingRef.current = next;
    setIsComposing(next);
    clearStuckImeTimer();
    if (next) {
      stuckImeTimerRef.current = setTimeout(() => {
        stuckImeTimerRef.current = null;
        composingRef.current = false;
        setIsComposing(false);
      }, IME_STUCK_TIMEOUT_MS);
    }
  }

  function refreshStuckImeTimer() {
    if (!composingRef.current) {
      return;
    }
    clearStuckImeTimer();
    stuckImeTimerRef.current = setTimeout(() => {
      stuckImeTimerRef.current = null;
      composingRef.current = false;
      setIsComposing(false);
    }, IME_STUCK_TIMEOUT_MS);
  }

  useEffect(() => () => clearStuckImeTimer(), []);

  async function send() {
    if (composingRef.current) {
      resetPromptQueue();
      return;
    }
    const submittedText = text;
    const submittedImages = pendingImages;
    const submittedAudio = pendingAudio;
    const msg = submittedText.trim();
    if (!msg && submittedImages.length === 0 && !submittedAudio) {
      resetPromptQueue();
      return;
    }

    const hasCompareHandles = Boolean(
      handlesRef.current["model1"] || handlesRef.current["model2"],
    );
    const isGeneralizedCompare =
      hasCompareHandles && Boolean(model1?.id && model2?.id);

    // Generalized compare requires both panes to have a model. A half-
    // selected send either races to an empty bubble with bogus tok/s (#5569)
    // or leaves the empty pane with a dangling prompt. hasCompareHandles is
    // true only in GeneralCompareContent, so LoraCompare and single-pane
    // chats are unaffected.
    if (hasCompareHandles && !isGeneralizedCompare) {
      toast.error("Pick a model in each pane to compare", {
        description:
          "Use the model dropdown above each pane, then send your prompt.",
      });
      resetPromptQueue();
      return;
    }

    const currentCheckpoint = useChatRuntimeStore.getState().params.checkpoint;
    const currentProviders = loadExternalProviders();
    if (!currentCheckpoint && currentProviders.length === 0 && !isGeneralizedCompare) {
      toast.error("No hay proveedor conectado", {
        description:
          "Por favor, conecta un proveedor de IA para comenzar a chatear.",
        action: {
          label: "Conectar proveedor",
          onClick: () => {
            useSettingsDialogStore.getState().openDialog("connections");
          },
        },
        duration: 10000,
        closeButton: true,
      });
      resetPromptQueue();
      return;
    }

    if (
      submittedImages.length > 0 &&
      !isGeneralizedCompare &&
      imageUnavailableReason
    ) {
      // Single mode: the loaded model's runtime capability is known here.
      // Compare mode defers: each ensureModelLoaded sets loadedIsMultimodal
      // for its side, and the chat-adapter's pre-stream gate runs per-side
      // against that fresh state.
      toast.error(imageUnavailableReason);
      resetPromptQueue();
      return;
    }

    const content: CompareMessagePart[] = [];
    for (const { file } of submittedImages) {
      try {
        const image = await fileToBase64DataURL(file);
        content.push({ type: "image", image });
      } catch {
        // skip failed image
      }
    }
    if (submittedAudio) {
      content.push({
        type: "audio",
        name: submittedAudio.name,
        audio: `data:${submittedAudio.contentType};base64,${submittedAudio.base64}`,
      });
    }
    if (msg) {
      content.push({ type: "text", text: msg });
    }
    if (content.length === 0) {
      resetPromptQueue();
      return;
    }

    let compareLifecycleLease: ModelLifecycleLease | null = null;
    if (isGeneralizedCompare) {
      compareLifecycleLease = useChatRuntimeStore
        .getState()
        .beginModelLoading();
      if (compareLifecycleLease === null) {
        toast.info("A model is loading", {
          description: "Wait for it to finish or cancel it first.",
        });
        resetPromptQueue();
        return;
      }
    }
    const releaseCompareModelLifecycle = () => {
      if (compareLifecycleLease === null) {
        return;
      }
      useChatRuntimeStore.getState().endModelLoading(compareLifecycleLease);
      compareLifecycleLease = null;
    };
    const acquireCompareModelLifecycle = () => {
      if (compareLifecycleLease !== null) {
        return;
      }
      compareLifecycleLease = useChatRuntimeStore
        .getState()
        .beginModelLoading();
      if (compareLifecycleLease === null) {
        throw new Error("Another model load started during comparison");
      }
    };
    const submittedDraftIsCurrent = () =>
      textRef.current === submittedText &&
      pendingImagesRef.current === submittedImages &&
      pendingAudioRef.current === submittedAudio;
    const keepChangedDraft = () => {
      releaseCompareModelLifecycle();
      resetPromptQueue();
      toast.info("Message changed while preparing", {
        description: "Your updated draft was kept. Send it again when ready.",
      });
    };
    const clearSubmittedDraft = () => {
      setText("");
      clearAttachments();
      textareaRef.current?.focus();
    };

    let compareStopDecision: Awaited<
      ReturnType<typeof confirmStopRunningChatsIfNeeded>
    > | null = null;
    if (isGeneralizedCompare) {
      try {
        compareStopDecision = await confirmStopRunningChatsIfNeeded(
          "Loading models for comparison",
          "reload",
        );
      } catch (error) {
        releaseCompareModelLifecycle();
        resetPromptQueue();
        toast.error("Compare failed", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
        return;
      }
      if (!compareStopDecision.proceed) {
        releaseCompareModelLifecycle();
        resetPromptQueue();
        return;
      }
    }
    if (!submittedDraftIsCurrent()) {
      keepChangedDraft();
      return;
    }

    // Generalized compare: load each model before dispatching to its side
    if (isGeneralizedCompare) {
      const store = useChatRuntimeStore.getState();
      const trustRemoteCode = store.params.trustRemoteCode ?? false;
      const fallbackTensorParallel = store.tensorParallel;
      const specSettings = resolveSpeculativeSettingsForLoad({
        usePersistedPreference: true,
      });
      let loadedFromConfig = false;

      // Warm the device cache before the snapshot below reconciles the GPU
      // pick: on a cold cache the reconcile passes a stale pick through.
      try {
        if (store.selectedGpuIds != null) {
          await ensureGpuDeviceCache();
        }
      } catch (error) {
        releaseCompareModelLifecycle();
        resetPromptQueue();
        toast.error("Compare failed", {
          description: error instanceof Error ? error.message : "Unknown error",
        });
        return;
      }
      // The GPU/offload knobs both compare loads must use, snapshotted at Send.
      // ensureModelLoaded runs sequentially and the first load's response echo
      // (loadedGpuMemoryFields) rewrites the live store -- a non-GGUF or Auto
      // first model resets gpuLayers/nCpuMoe/split/pick to defaults -- so
      // reading the store per load would hand model 2 the first model's echoed
      // defaults instead of the settings the user pressed Send with.
      const compareLoadKnobs = {
        gpuMemoryMode: store.gpuMemoryMode,
        gpuLayers: store.gpuLayers,
        nCpuMoe: store.nCpuMoe,
        splitRatio: store.splitRatio,
        selectedGpuIds: store.selectedGpuIds,
        selectedGpuIndexKind: store.selectedGpuIndexKind,
      };
      if (!submittedDraftIsCurrent()) {
        keepChangedDraft();
        return;
      }
      clearSubmittedDraft();
      // Set when an accepted transformers install unloaded the active model
      // server-side; a later failure must then clear the stale checkpoint.
      let upgradeUnloadedActive = false;
      const compareSelectionNeedsLoad = (sel: CompareModelSelection) => {
        const currentStore = useChatRuntimeStore.getState();
        const isAlreadyActive =
          currentStore.params.checkpoint === sel.id &&
          (currentStore.activeGgufVariant ?? null) ===
            (sel.ggufVariant ?? null);
        return !isAlreadyActive || sel.config != null || loadedFromConfig;
      };
      const applyCompareStopDecision = () => {
        cancelPreStreamRunReservations(
          compareStopDecision?.preStreamRunTokens ?? [],
        );
        requestLocalPromptQueueStop(compareStopDecision?.promptQueueThreadIds);
      };
      // Helper: load a model and update store checkpoint
      async function ensureModelLoaded(
        sel: CompareModelSelection,
      ): Promise<string> {
        const currentStore = useChatRuntimeStore.getState();
        const config = sel.config ?? null;
        // This pane's effective config: an explicit selection config, else the
        // remembered store config for this model/quant (never the other pane's).
        // No saved config resolves to all-null defaults, so settings below fall
        // through to their session default.
        const resolved = config
          ? { config, remembered: true }
          : resolveInitialConfig(sel.id, sel.ggufVariant ?? null);
        const ownConfig = resolved.config;
        const ownRemembered = resolved.remembered;
        const isAlreadyActive =
          currentStore.params.checkpoint === sel.id &&
          (currentStore.activeGgufVariant ?? null) ===
            (sel.ggufVariant ?? null);
        if (isAlreadyActive && !config && !loadedFromConfig) {
          applyCompareStopDecision();
          return "ready";
        }
        const targetIsGguf =
          (sel.ggufVariant ?? null) != null ||
          sel.id.toLowerCase().endsWith(".gguf");
        let resolvedIsDiffusion = sel.isDiffusion;
        // Set when the preflight could not classify the GGUF, so a false
        // resolvedIsDiffusion below must not be read as "ordinary".
        let diffusionUnknown = false;
        if (targetIsGguf && resolvedIsDiffusion === undefined) {
          const preparedToken = await prepareHfTokenForUse(
            currentStore.hfToken,
          );
          if (!preparedToken.proceed) {
            throw new Error("Model load cancelled.");
          }
          const staged = await fetchGgufStagedMetadata({
            model_path: sel.id,
            gguf_variant: sel.ggufVariant ?? null,
            hf_token: preparedToken.token,
          });
          resolvedIsDiffusion = staged.isDiffusion;
          diffusionUnknown = staged.diffusionUnknown;
        }
        // Pass-through arguments can live only in the server's override map (set
        // through the API, or from another browser), and this config comes from
        // local storage. /load's omission path inherits them from a RESIDENT
        // instance of the same model, which a compare pane starting cold or
        // switching away from the other model does not have, so without this the
        // experiment runs a different command from the one that was saved.
        if (
          targetIsGguf &&
          // Not for the diffusion runner, which appends none of them.
          resolvedIsDiffusion !== true
        ) {
          try {
            // Sanitised for the same reason the panel sanitises what it hydrates:
            // either list becomes an EXPLICIT /load argument, which is validated
            // strictly rather than going through the carry-over paths that drop a
            // newly denied flag quietly. A pane on an install upgraded across a
            // denylist change would otherwise answer 400 on a comparison that ran
            // the day before, whether the list came from the server or from this
            // browser's own storage.
            const managed = await loadManagedLlamaFlags();
            const clean = (tokens: readonly string[]) =>
              sanitizeStoredExtraArgs(
                tokens,
                managed?.managed ?? new Set<string>(),
                {
                  maxBytes: managed?.maxBytes,
                  windowsCommandBudget: managed?.windowsCommandBudget,
                },
              );
            const local = ownConfig.llamaExtraArgs;
            if (local === undefined) {
              const resolvedArgs = await fetchLoadExtraArgs(
                sel.id,
                sel.id,
                sel.ggufVariant ?? null,
              );
              const cleaned = clean(resolvedArgs.tokens);
              if (cleaned.length > 0) {
                ownConfig.llamaExtraArgs = cleaned;
              } else if (resolvedArgs.explicit) {
                // An explicit empty row is a cleared box, and this pane has to send
                // it as one: left undefined the field is omitted and /load carries
                // the resident model's arguments into the comparison, so the panes
                // would not be running the command they are compared on.
                ownConfig.llamaExtraArgs = [];
              }
            } else if (local !== null && local.length > 0) {
              const cleaned = clean(local);
              if (cleaned.length !== local.length) {
                ownConfig.llamaExtraArgs = cleaned.length > 0 ? cleaned : [];
              }
            }
          } catch {
            // The load still works; a real overrides outage surfaces there.
          }
        }
        // Mirror single-view resolveLoadMaxSeqLength: a GGUF pane with no explicit
        // context loads at native (0 -> n_ctx_train), not the session maxSeqLength,
        // which would silently shrink the shown context.
        // A non-GGUF pane with no saved maxSeqLength falls back to the app default,
        // not the active model's shared runtime snapshot: else comparing a saved
        // 128K model against an unconfigured one loads the latter at 128K and OOMs.
        const effectiveMaxSeqLength =
          ownConfig.customContextLength ??
          normalizeMaxSeqLength(ownConfig.maxSeqLength) ??
          (targetIsGguf ? 0 : DEFAULT_MAX_SEQ_LENGTH);
        const effectiveChatTemplateOverride = cleanCompareChatTemplate(
          ownConfig.chatTemplateOverride,
        );
        const effectiveSpeculativeType =
          ownConfig.speculativeType ?? specSettings.speculativeType;
        const effectiveSpecDraftNMax = ownRemembered
          ? resolveCompareSpecDraftNMax(
              effectiveSpeculativeType,
              ownConfig.specDraftNMax,
            )
          : specSettings.specDraftNMax;
        const effectiveTensorParallel = resolvedIsDiffusion
          ? false
          : ownRemembered
            ? ownConfig.tensorParallel
            : fallbackTensorParallel;
        if (ownConfig.selectedGpuIds != null) {
          await ensureGpuDeviceCache();
        }
        // A pane's OWN saved split is sent instead of being forced to Auto
        // (#7574); the shared Send-time snapshot is not, since its layer count
        // is bounded by another GGUF. Knobs the runner has no equivalent for
        // (MoE offload, tensor parallel) stay hard-forced. An UNCLASSIFIED GGUF
        // is pinned too: see lib/gpu-placement.ts.
        const {
          gpuMemoryMode: effectiveGpuMemoryMode,
          gpuLayers: effectiveGpuLayers,
        } = resolveComparePlacement(
          ownConfig,
          compareLoadKnobs,
          shouldPinDiffusionPlacement(
            targetIsGguf,
            resolvedIsDiffusion,
            diffusionUnknown,
          ),
        );
        const effectiveNCpuMoe =
          resolvedIsDiffusion
            ? 0
            : (ownConfig.nCpuMoe ?? compareLoadKnobs.nCpuMoe);
        const effectiveSelectedGpuIds =
          ownConfig.selectedGpuIds !== undefined
            ? reconcilePersistedGpuIds(
                ownConfig.selectedGpuIds,
                ownConfig.selectedGpuIndexKind,
                resolvedIsDiffusion === true,
              )
            : reconcilePersistedGpuIds(
                compareLoadKnobs.selectedGpuIds,
                compareLoadKnobs.selectedGpuIndexKind,
                resolvedIsDiffusion === true,
              );
        // A pane's context comes from its own config only: a saved pin, or null
        // (Auto/native). It must not inherit the active model's shared snapshot --
        // resolveFitMaxSeqLength would treat that as a pin and load this pane at
        // the other model's context (changing VRAM/results or OOMing).
        const effectiveCustomContextLength = ownConfig.customContextLength;
        let loadTrustRemoteCode = trustRemoteCode;
        let approvedRemoteCodeFingerprint: string | null = null;
        // Size validation exactly as the load below, so the training-guard
        // preflight checks the footprint that actually loads (under Manual + Auto
        // layers the load sends 0 / the pinned context, not raw maxSeqLength).
        const compareMaxSeqLength = resolveFitMaxSeqLength(
          targetIsGguf,
          effectiveGpuMemoryMode,
          effectiveGpuLayers,
          // Prefer this pane's own saved context pin over the shared snapshot,
          // falling back to its per-pane effective context (GGUF with no saved
          // context loads at native, not the session maxSeqLength).
          effectiveCustomContextLength,
          effectiveMaxSeqLength,
        );
        const validation = await validateModel({
          model_path: sel.id,
          hf_token: currentStore.hfToken || null,
          max_seq_length: compareMaxSeqLength,
          load_in_4bit: true,
          is_lora: sel.isLora,
          gguf_variant: sel.ggufVariant ?? null,
          trust_remote_code: loadTrustRemoteCode,
          chat_template_override: effectiveChatTemplateOverride,
          cache_type_kv: ownConfig.kvCacheDtype ?? null,
          tensor_parallel: effectiveTensorParallel,
          // Scope the validate to the picked GPUs. GGUF-only, like the load
          // below: a non-GGUF target must not inherit a hidden GGUF GPU pick.
          ...(targetIsGguf
            ? {
                gpu_ids: effectiveSelectedGpuIds ?? undefined,
                gpu_memory_mode: effectiveGpuMemoryMode,
                // Sized like the load below: a manual DiffusionGemma split
                // must not be validated as a full-GGUF occupant.
                gpu_layers: effectiveGpuLayers,
                // Slots scale the KV estimate; keep validate sized like the load.
                n_parallel: ownConfig.nParallel ?? null,
                // Only when this panel has read the stored value: omitted, the load
                // inherits it, which is what keeps CLI-set flags working.
                ...(ownConfig.llamaExtraArgs !== undefined
                  ? // biome-ignore lint/style/useNamingConvention: API schema
                    { llama_extra_args: ownConfig.llamaExtraArgs ?? [] }
                  : {}),
                // omitted when blank: a null counts as set and strips inherited -b / -ub
                ...(ownConfig.nBatch != null
                  ? { n_batch: ownConfig.nBatch }
                  : {}),
                ...(ownConfig.nUbatch != null
                  ? { n_ubatch: ownConfig.nUbatch }
                  : {}),
              }
            : {}),
        });
        // Upgrade dialog first (mirrors the primary load path).
        if (validation.requires_transformers_upgrade) {
          const upgraded = await confirmTransformersUpgradeIfNeeded({
            modelName: sel.id,
            upgrade: validation.transformers_upgrade,
            // No installable release: custom-code models may fall back to the trust_remote_code gate below.
            trustRemoteCodeFallback: validation.requires_trust_remote_code,
            forceCancelActive:
              compareStopDecision?.forceCancelActive ?? false,
          });
          // The install unloads the active model before the swap (even when the
          // swap then fails); if a later gate cancels or the load fails, the UI
          // must stop pointing at that unloaded model.
          if (
            useTransformersUpgradeDialogStore
              .getState()
              .consumeServerUnloadedChat()
            && currentStore.params.checkpoint
          ) {
            upgradeUnloadedActive = true;
          }
          if (!upgraded) {
            throw new Error(
              `${compareModelDisplayName(sel.id)} needs a newer transformers release to load.`,
            );
          }
        }
        if (
          validation.requires_trust_remote_code ||
          validation.requires_security_review
        ) {
          const approved = await confirmRemoteCodeIfNeeded({
            modelName: sel.id,
            hfToken: currentStore.hfToken || null,
            requiresTrustRemoteCode: true,
            onApprove: (fp) => {
              loadTrustRemoteCode = true;
              approvedRemoteCodeFingerprint = fp;
            },
          });
          if (!approved) {
            throw new Error(
              `${compareModelDisplayName(sel.id)} needs custom code approval to load.`,
            );
          }
        }
        applyCompareStopDecision();
        const resp = await loadModel({
          model_path: sel.id,
          hf_token: useChatRuntimeStore.getState().hfToken || null,
          max_seq_length: compareMaxSeqLength,
          load_in_4bit: true,
          is_lora: sel.isLora,
          gguf_variant: sel.ggufVariant ?? null,
          trust_remote_code: loadTrustRemoteCode,
          approved_remote_code_fingerprint: approvedRemoteCodeFingerprint,
          chat_template_override: effectiveChatTemplateOverride,
          cache_type_kv: ownConfig.kvCacheDtype ?? null,
          mlx_kv_bits: ownConfig.mlxKvBits ?? null,
          speculative_type: effectiveSpeculativeType,
          spec_draft_n_max: effectiveSpecDraftNMax,
          tensor_parallel: effectiveTensorParallel,
          force_cancel_active:
            compareStopDecision?.forceCancelActive ?? false,
          ...(targetIsGguf
            ? {
                gpu_memory_mode: effectiveGpuMemoryMode,
                gpu_layers: effectiveGpuLayers,
                n_cpu_moe: effectiveNCpuMoe,
                tensor_split: compareLoadKnobs.splitRatio ?? undefined,
                gpu_ids: effectiveSelectedGpuIds ?? undefined,
                n_parallel: ownConfig.nParallel ?? null,
                // Only when this panel has read the stored value: omitted, the load
                // inherits it, which is what keeps CLI-set flags working.
                ...(ownConfig.llamaExtraArgs !== undefined
                  ? // biome-ignore lint/style/useNamingConvention: API schema
                    { llama_extra_args: ownConfig.llamaExtraArgs ?? [] }
                  : {}),
                ...(ownConfig.nBatch != null
                  ? { n_batch: ownConfig.nBatch }
                  : {}),
                ...(ownConfig.nUbatch != null
                  ? { n_ubatch: ownConfig.nUbatch }
                  : {}),
              }
            : {}),
        });
        // Keep a compare pane's per-model speculative choice load-local: persist
        // the global preference only when it came from global settings.
        if (ownConfig.speculativeType == null) {
          saveSpeculativeType(effectiveSpeculativeType);
        }
        // Persist the GPU Memory mode on a non-diffusion GGUF compare-load too,
        // so an applied manual choice survives a restart.
        persistGpuMemoryModeOnLoad(resp, effectiveGpuMemoryMode);
        upgradeUnloadedActive = false;
        const store = useChatRuntimeStore.getState();
        store.setCheckpoint(
          resp.model,
          resp.is_gguf ? (sel.ggufVariant ?? undefined) : null,
          // Same cap as the interactive load: this replays the model's
          // remembered settings, and a budget kept from a larger context does
          // not fit the one it just loaded with.
          {
            maxTokensCap: resp.is_gguf
              ? (resp.context_length ?? undefined)
              : effectiveMaxSeqLength,
          },
        );
        store.setModelRequiresTrustRemoteCode(
          resp.requires_trust_remote_code ?? false,
        );
        // Keep an explicit Manual+Auto context pin the load just applied (so a
        // later Apply/Reset doesn't silently revert the model to auto-fit
        // sizing), mirroring the interactive path's keepCustomCtx. Non-GGUF
        // compare loads don't send the pin, so their baseline clears.
        const keepCustomCtx = targetIsGguf
          ? resolveManualAutoCtxPin(
              effectiveGpuMemoryMode,
              effectiveGpuLayers,
              effectiveCustomContextLength,
            )
          : null;
        // Slots this compare load committed. Diffusion ignores --parallel, so a
        // count there would mint a phantom override a preset carries onto a GGUF.
        const committedSlots =
          targetIsGguf && !(resp.is_diffusion ?? false)
            ? (ownConfig.nParallel ?? null)
            : null;
        // same rule for the batch sizes
        const committedNBatch =
          targetIsGguf && !(resp.is_diffusion ?? false)
            ? (ownConfig.nBatch ?? null)
            : null;
        const committedNUbatch =
          targetIsGguf && !(resp.is_diffusion ?? false)
            ? (ownConfig.nUbatch ?? null)
            : null;
        useChatRuntimeStore.setState({
          supportsReasoning: resp.supports_reasoning ?? false,
          reasoningAlwaysOn: resp.reasoning_always_on ?? false,
          ...reasoningCapsFromLoad(resp),
          supportsPreserveThinking: resp.supports_preserve_thinking ?? false,
          preserveThinking: resolvePreserveThinkingOnLoad(resp),
          supportsTools: resp.supports_tools ?? false,
          kvCacheDtype: resp.cache_type_kv ?? null,
          loadedKvCacheDtype: resp.cache_type_kv ?? null,
          ...mlxRuntimeStateFrom(resp),
          // Click-time value, not the resolved echo (see the single-model load).
          nParallel: committedSlots,
          loadedNParallel: committedSlots,
          nBatch: committedNBatch,
          loadedNBatch: committedNBatch,
          nUbatch: committedNUbatch,
          loadedNUbatch: committedNUbatch,
          // What this pane's launch is running, for a later rollback: the status
          // applier is held off for the whole load, so nothing else records it, and
          // a switch straight after would snapshot the other model's list.
          loadedLlamaExtraArgs:
            resp.requested_llama_extra_args !== undefined
              ? (resp.requested_llama_extra_args ?? [])
              : (ownConfig.llamaExtraArgs ?? null),
          tensorParallel: resp.tensor_parallel ?? false,
          loadedTensorParallel: resp.tensor_parallel ?? false,
          defaultChatTemplate: resp.chat_template ?? null,
          chatTemplateOverride: effectiveChatTemplateOverride,
          loadedChatTemplateOverride: effectiveChatTemplateOverride,
          // The context baseline this pane loaded with (see keepCustomCtx above),
          // so a later Apply/Reset can't silently revert a Manual+Auto pin.
          loadedCustomContextLength: keepCustomCtx,
          // Adopt the load response's GPU-memory fields (mode/layers/MoE/split/pick
          // plus loaded baselines) so the GPU controls round-trip. (gguf context,
          // customContextLength and native-path token/expiry clear in the tail below.)
          ...loadedGpuMemoryFields(resp),
          // Drives the GPU Memory controls' diffusion gate; set alongside the
          // GPU fields on every load path so the gate can't read stale.
          loadedIsDiffusion: resp.is_diffusion ?? false,
          loadedIsMultimodal: isMultimodalResponse(resp),

          mmprojFallbackReason: resp.mmproj_fallback_reason ?? null,
          activeModelIsLocal: resp.is_local_model ?? false,
          // Record the context this pane loaded with (like the single-model path)
          // so when it becomes the active model, the UI and later reload/save use
          // its context, not the previous/default one.
          customContextLength: targetIsGguf
            ? (ownConfig.customContextLength ?? keepCustomCtx)
            : null,
          ggufContextLength: resp.is_gguf ? (resp.context_length ?? null) : null,
          ggufNativeContextLength: resp.is_gguf
            ? (resp.native_context_length ?? null)
            : null,
          ggufMaxContextLength: resp.is_gguf
            ? (resp.max_context_length ?? null)
            : null,
          // Compare selections load by repo/variant, never from the file picker,
          // so they carry no native lease. Clear any prior picked file's
          // token/expiry so the reload path never sends a stale lease.
          activeNativePathToken: null,
          activeNativePathExpiresAtMs: null,
          ...resolveLoadedSpeculativeSettings(resp),
        });
        if (!targetIsGguf) {
          // Non-GGUF panes carry their context in params.maxSeqLength.
          store.setParams({
            ...useChatRuntimeStore.getState().params,
            maxSeqLength: effectiveMaxSeqLength,
          });
        }
        loadedFromConfig = config != null;
        // Sync the models[] entry with the load response so attach/send gates
        // read fresh capabilities. /api/models/list can lag a model's actual
        // state (e.g. a GGUF whose mmproj arrived after the snapshot).
        const currentModels = useChatRuntimeStore.getState().models;
        const idx = currentModels.findIndex((m) => m.id === sel.id);
        const synced = {
          isVision: Boolean(resp.is_vision),
          isGguf: Boolean(resp.is_gguf),
          isAudio: Boolean(resp.is_audio),
          audioType: resp.audio_type ?? null,
          hasAudioInput: Boolean(resp.has_audio_input),
          hasVideoInput: Boolean(resp.has_video_input),
        };
        if (idx === -1) {
          store.setModels([
            ...currentModels,
            {
              id: sel.id,
              name: resp.display_name ?? sel.id,
              isLora: sel.isLora,
              ...synced,
            },
          ]);
        } else {
          const next = [...currentModels];
          next[idx] = { ...next[idx], ...synced };
          store.setModels(next);
        }
        return resp.status;
      }

      const handle1 = handlesRef.current["model1"];
      const handle2 = handlesRef.current["model2"];

      // Show user messages immediately on both sides
      if (handle1) handle1.appendMessage(content);
      if (handle2) handle2.appendMessage(content);

      const name1 = model1?.id ? compareModelDisplayName(model1.id) : "";
      const name2 = model2?.id ? compareModelDisplayName(model2.id) : "";
      const toastId = toast("Comparing models…", { duration: Infinity });

      setComparing(true);
      try {
        // Side 1: load → generate → wait
        if (handle1 && model1?.id) {
          toast("Loading Model 1…", {
            id: toastId,
            description: name1,
            duration: Infinity,
          });
          const status1 = await ensureModelLoaded(model1);
          releaseCompareModelLifecycle();
          toast("Generating with Model 1…", {
            id: toastId,
            description: `${name1} (${status1})`,
            duration: Infinity,
          });
          const done = handle1.waitForRunEnd();
          handle1.startRun();
          await done;
        }

        // Side 2: load → generate → wait
        if (handle2 && model2?.id) {
          acquireCompareModelLifecycle();
          const needsLoad = compareSelectionNeedsLoad(model2);
          if (needsLoad) {
            const currentStopDecision =
              await confirmStopRunningChatsIfNeeded(
                "Loading the second model for comparison",
                "reload",
              );
            if (!currentStopDecision.proceed) {
              throw new Error("Second comparison model load cancelled.");
            }
            compareStopDecision = currentStopDecision;
            toast("Loading Model 2…", {
              id: toastId,
              description: name2,
              duration: Infinity,
            });
          }
          const status2 = await ensureModelLoaded(model2);
          releaseCompareModelLifecycle();
          toast("Generating with Model 2…", {
            id: toastId,
            description: `${name2} (${status2})`,
            duration: Infinity,
          });
          const done = handle2.waitForRunEnd();
          handle2.startRun();
          await done;
        }

        compareStepSucceededRef.current = true;
        toast.success("Compare complete", { id: toastId, duration: 2000 });
      } catch (err) {
        compareStepSucceededRef.current = false;
        resetPromptQueue();
        // The install already unloaded the previously active model; drop the
        // checkpoint so the UI does not keep pointing at an unloaded model.
        if (upgradeUnloadedActive) {
          useChatRuntimeStore.getState().clearCheckpoint();
        }
        toast.error("Compare failed", {
          id: toastId,
          description: err instanceof Error ? err.message : "Unknown error",
          duration: 4000,
        });
      } finally {
        releaseCompareModelLifecycle();
        setComparing(false);
      }
    } else {
      // Original behavior: fire all handles simultaneously
      clearSubmittedDraft();
      for (const handle of Object.values(handlesRef.current)) {
        handle.append(content);
      }
    }
  }
  sendRef.current = send;

  function stop() {
    if (isDictating) stopDictation();
    for (const handle of Object.values(handlesRef.current)) {
      handle.cancel();
    }
  }

  const busy = running || comparing;

  function onKeyDown(e: KeyboardEvent) {
    // IME composition (JP/CN/KR): Enter commits the candidate, don't hijack it
    // (#5318). Re-pin composingRef in case the stuck watchdog (#5546) cleared
    // it during a long candidate-window pause, so a follow-up click-Send won't
    // submit preedit text. Re-arm the watchdog on the same path; without it the
    // WSL+Chrome no-compositionend case pins composingRef forever after an IME
    // keypress and re-locks Send.
    if (e.nativeEvent.isComposing || e.keyCode === 229) {
      composingRef.current = true;
      refreshStuckImeTimer();
      return;
    }
    // Non-IME key while composingRef is stuck; mirrors the fix in thread.tsx.
    // On macOS, switching input methods without composing can leave composingRef
    // pinned; clear it immediately on the first non-IME keystroke.
    if (composingRef.current) {
      // Candidate-confirming Enter can arrive as non-composing; keep it gated.
      if (e.key === "Enter") {
        if (!e.shiftKey) {
          e.preventDefault();
        }
        refreshStuckImeTimer();
        return;
      }
      setCompositionState(false);
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!busy && !isDictating) {
        send();
      }
    }
  }

  const canSend =
    (text.trim().length > 0 ||
      pendingImages.length > 0 ||
      pendingAudio !== null) &&
    !busy &&
    !isComposing &&
    !isDictating;


  return (
    <div
      className="chat-composer-surface"
      onDragOver={(e) => {
        if (isTauri) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        // Phase 1 native model drops own Tauri local-path drops. Restore
        // browser attachment drops in Tauri once Phase 1d adds token bridging.
        if (isTauri) return;
        e.preventDefault();
        setDragging(false);
        addFiles(e.dataTransfer.files);
      }}
    >
      <PromptStorageDialog
        open={promptStorageOpen}
        onOpenChange={setPromptStorageOpen}
        onUse={(t) => {
          setText(t);
          requestAnimationFrame(() => textareaRef.current?.focus());
        }}
        onRunList={(items) => {
          const hasCompareHandles = Boolean(
            handlesRef.current["model1"] || handlesRef.current["model2"],
          );
          const isGeneralizedCompare =
            hasCompareHandles && Boolean(model1?.id && model2?.id);
          if (hasCompareHandles && !isGeneralizedCompare) {
            toast.error("Pick a model in each pane to compare", {
              description:
                "Use the model dropdown above each pane, then send your prompt.",
            });
            return;
          }
          setPromptStorageOpen(false);
          startQueue(items);
        }}
      />
      {/* Gemini-style drop affordance, mirrored from the single composer. */}
      <div
        className={`pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-1 overflow-hidden rounded-[32px] bg-background/90 backdrop-blur-sm transition-opacity duration-150 dark:bg-card/90 ${dragging ? "opacity-100" : "opacity-0"}`}
      >
        <HugeiconsIcon
          icon={AttachmentIcon}
          strokeWidth={2}
          className="size-6 text-primary"
        />
        <span className="text-sm font-medium text-primary">Drop files here</span>
      </div>
      {(pendingImages.length > 0 || pendingAudio) && (
        <div className="mb-2 flex w-full flex-row flex-wrap items-center gap-2 px-1.5 pt-0.5 pb-1">
          {pendingImages.map(({ id, file }) => (
            <PendingImageThumb
              key={id}
              file={file}
              onRemove={() => removePendingImage(id)}
            />
          ))}
          {pendingAudio && (
            <div className="flex items-center gap-2 rounded-lg border border-foreground/20 bg-muted px-3 py-1.5 text-xs">
              <HeadphonesIcon className="size-3.5 text-muted-foreground" />
              <span className="max-w-48 truncate">{pendingAudio.name}</span>
              <button
                type="button"
                onClick={removePendingAudio}
                className="flex size-4 items-center justify-center rounded-full hover:bg-destructive hover:text-destructive-foreground"
                aria-label="Remove audio"
              >
                <XIcon className="size-3" />
              </button>
            </div>
          )}
        </div>
      )}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => {
          // ALWAYS mirror the DOM value into React state, even during IME
          // composition: the controlled `value` must match the DOM at all
          // times, else an unrelated parent re-render reconciles the textarea
          // back to the stored value mid-composition, wiping the IME preedit
          // AND prior committed text (e.g. Tab-cycling candidates erases
          // earlier words). #5318.
          setCompositionState(isNativeComposing(e.nativeEvent));
          setText(e.target.value);
        }}
        onCompositionStart={() => {
          setCompositionState(true);
        }}
        onCompositionUpdate={() => {
          refreshStuckImeTimer();
        }}
        onCompositionEnd={(e: CompositionEvent<HTMLTextAreaElement>) => {
          setCompositionState(false);
          setText(e.currentTarget.value);
        }}
        onKeyDown={onKeyDown}
        onPaste={handleFilePaste}
        onBlur={() => {
          // Mac: switching input methods can fire compositionstart without a
          // matching compositionend, leaving composingRef pinned. The OS always
          // commits or cancels composition before the element loses focus.
          setCompositionState(false);
        }}
        placeholder="Send to both models..."
        className="composer-input"
        rows={1}
        // dir="auto" detects RTL (Arabic/Hebrew/Persian/Urdu) from the first
        // strong character; no effect on LTR scripts.
        dir="auto"
      />
      <div className="composer-action-wrapper">
        <div
          ref={pillRowRef}
          className="flex min-w-0 flex-wrap items-center gap-0.5"
          data-pill-compact={pillCompact}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={audioInputRef}
            type="file"
            accept={AUDIO_ACCEPT}
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <NewProjectDialog
            open={newProjectOpen}
            onOpenChange={setNewProjectOpen}
          />
          {/* Same + menu as single-chat (ComposerToolsMenu), wired to the
              compare composer's own file/audio inputs and tools. */}
          <SharedComposerToolsMenu
            onOpenPlusMenu={() => void refreshRecentPrompts()}
            onSelectImageFiles={() => fileInputRef.current?.click()}
            onSelectAudioFiles={() => audioInputRef.current?.click()}
            hasAudioInput={Boolean(activeModel?.hasAudioInput)}
            searchDisabled={searchDisabled}
            toolsEnabled={toolsEnabled}
            onToggleSearch={() => {
              const next = !toolsEnabled;
              setToolsEnabled(next);
              if (isKimiExternal) {
                setReasoningEnabled(!next, { persist: false });
                applyQwenThinkingParams(!next);
              }
            }}
            codeDisabled={codeDisabled}
            codeToolsEnabled={codeToolsEnabled}
            onToggleCode={() => setCodeToolsEnabled(!codeToolsEnabled)}
            showImagePill={Boolean(showImagePill)}
            imageDisabled={imageDisabled}
            imageToolsEnabled={imageToolsEnabled}
            onToggleImages={() => setImageToolsEnabled(!imageToolsEnabled)}
            supportsTools={supportsTools}
            mcpEnabledForChat={mcpEnabledForChat}
            setMcpEnabledForChat={setMcpEnabledForChat}
            recentPrompts={recentPrompts}
            setText={setText}
            textareaRef={textareaRef}
            setPromptStorageOpen={setPromptStorageOpen}
            handleExitCompare={handleExitCompare}
            exportThreadIds={exportThreadIds}
            showCanvasMenuItem={showCanvasMenuItem}
            artifactsEnabled={artifactsEnabled}
            setArtifactsEnabled={setArtifactsEnabled}
            setNewProjectOpen={setNewProjectOpen}
            recentProjects={recentProjects}
            openProject={openProject}
          />
          {/* Active in compare mode; sits first. Click to exit back to single chat. */}
          <button
            type="button"
            onClick={handleExitCompare}
            className="composer-pill-btn"
            data-active="true"
            data-keep-label="true"
            aria-label="Exit compare chat"
          >
            <PillGlyph>
              <Columns2Icon className="size-[14px]" />
            </PillGlyph>
            <span>{t("chat.composer.compareChat")}</span>
          </button>
          {/* Permission-level pill sits immediately after Compare and ahead
              of every other tool pill (Search, Code, ...) so the Full access
              danger state reads first; only Compare outranks it. */}
          <PermissionModeComposerPill side="top" />
          <ThreadWorkspaceChip />
          <button
            type="button"
            disabled={searchDisabled}
            onClick={() => {
              const next = !toolsEnabled;
              setToolsEnabled(next);
              // Kimi's $web_search builtin requires thinking=disabled
              // (https://platform.kimi.ai/docs/guide/use-web-search): toggle
              // the Think pill off when Search is on, mirroring the backend.
              if (isKimiExternal) {
                setReasoningEnabled(!next, { persist: false });
                applyQwenThinkingParams(!next);
              }
            }}
            className="composer-pill-btn"
            data-pill-label={t("chat.composer.searchPill")}
            data-active={toolsEnabled && !searchDisabled ? "true" : "false"}
            aria-label={
              toolsEnabled ? "Disable web search" : "Enable web search"
            }
          >
            <PillGlyph>
              <GlobeIcon className="size-[15px]" />
            </PillGlyph>
            <span>{t("chat.composer.searchPill")}</span>
          </button>
          <button
            type="button"
            disabled={codeDisabled}
            onClick={() => setCodeToolsEnabled(!codeToolsEnabled)}
            className="composer-pill-btn"
            data-pill-label={t("chat.composer.codePill")}
            data-active={codeToolsEnabled && !codeDisabled ? "true" : "false"}
            aria-label={
              codeToolsEnabled
                ? "Disable code execution"
                : "Enable code execution"
            }
          >
            <PillGlyph>
              <HugeiconsIcon
                icon={CodeIcon}
                className="size-[18.5px]"
                strokeWidth={2}
              />
            </PillGlyph>
            <span>{t("chat.composer.codePill")}</span>
          </button>
          {showImagePill && (
            <button
              type="button"
              disabled={imageDisabled}
              onClick={() => setImageToolsEnabled(!imageToolsEnabled)}
              className="composer-pill-btn"
              data-pill-label="Images"
              data-active={
                imageToolsEnabled && !imageDisabled ? "true" : "false"
              }
              aria-label={
                imageToolsEnabled
                  ? "Disable image generation"
                  : "Enable image generation"
              }
            >
              <PillGlyph>
                <HugeiconsIcon
                  icon={Image03Icon}
                  className="size-3.5"
                  strokeWidth={2}
                />
              </PillGlyph>
              <span>Images</span>
            </button>
          )}
          {showWebFetchPill && (
            <button
              type="button"
              disabled={webFetchDisabled}
              onClick={() => setWebFetchToolsEnabled(!webFetchToolsEnabled)}
              className="composer-pill-btn"
              data-pill-label="Fetch"
              data-active={
                webFetchToolsEnabled && !webFetchDisabled ? "true" : "false"
              }
              aria-label={
                webFetchToolsEnabled ? "Disable URL fetch" : "Enable URL fetch"
              }
            >
              <PillGlyph>
                <HugeiconsIcon icon={Download01Icon} className="size-3.5" />
              </PillGlyph>
              <span>Fetch</span>
            </button>
          )}
          {artifactsEnabled ? (
            <button
              type="button"
              onClick={() => setArtifactsEnabled(false)}
              className="composer-pill-btn"
              data-pill-label="Canvas"
              data-active="true"
              aria-label="Disable canvas"
            >
              <PillGlyph>
                <HugeiconsIcon
                  icon={PencilRulerIcon}
                  className="size-[15.5px]"
                  strokeWidth={2}
                />
              </PillGlyph>
              <span>Canvas</span>
            </button>
          ) : null}
          {mcpEnabledForChat ? <McpComposerButton side="top" /> : null}
        </div>
        {/* mr-0.5 matches the send button inset from the edge in normal chat;
            gap-1.5 matches its control spacing. */}
        <div className="ml-auto mr-0.5 flex items-center gap-1.5">
          {showReasoningControl ? (
            isEffort || supportsPreserveThinking ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild={true}>
                  <button
                    type="button"
                    disabled={reasoningDisabled}
                    className="unsloth-thinking-pill"
                    data-pill-label="Thinking settings"
                    data-active={thinkingActiveLook ? "true" : "false"}
                    aria-label={thinkEffortAriaLabel({
                      modelLoaded,
                      reasoningDisabled,
                      reasoningEffort,
                    })}
                  >
                    <BulbIcon className="size-[15.5px]" />
                    {thinkingActiveLook ? (
                      <span className="unsloth-thinking-label">
                        {isEffort
                          ? `Thinking · ${formatReasoningEffortLabel(
                              reasoningEffort,
                              externalSelection?.modelId,
                            )}`
                          : "Thinking"}
                      </span>
                    ) : null}
                    <ArrowDownStandardIcon className="unsloth-thinking-caret size-[15px]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  side="top"
                  align="end"
                  className={cn(
                    "unsloth-plus-menu",
                    narrowEffortMenu ? "min-w-40" : "min-w-44",
                  )}
                >
                  {isEffort ? (
                    <>
                      {effectiveSupportsReasoningOff && (
                        <DropdownMenuItem
                          onSelect={() => {
                            setReasoningEnabled(false);
                            applyQwenThinkingParams(false);
                            // Preserve thinking needs thinking on, so turn it off too.
                            setPreserveThinking(false);
                          }}
                        >
                          <HugeiconsIcon
                    icon={Tick02Icon}
                    strokeWidth={2}
                            className={cn(
                              "unsloth-tick size-4",
                              effectiveReasoningVisualEnabled && "opacity-0",
                            )}
                          />
                          {formatReasoningDisabledLabel(
                            effectiveSupportsReasoningOff,
                            isExternalOpenAIReasoning,
                            checkpoint,
                          )}
                        </DropdownMenuItem>
                      )}
                      {effectiveReasoningEffortLevels
                        .filter((level) => level !== "none")
                        .map((level) => (
                          <DropdownMenuItem
                            key={level}
                            onSelect={() => {
                              setReasoningEffort(level);
                              setReasoningEnabled(true);
                              applyQwenThinkingParams(true);
                              // Mutual exclusion: turning thinking on for a
                              // Kimi model forces the web_search builtin off.
                              if (isKimiExternal && toolsEnabled) {
                                setToolsEnabled(false, { persist: false });
                              }
                            }}
                          >
                            <HugeiconsIcon
                    icon={Tick02Icon}
                    strokeWidth={2}
                              className={cn(
                                "unsloth-tick size-4",
                                !(
                                  effectiveReasoningVisualEnabled &&
                                  reasoningEffort === level
                                ) && "opacity-0",
                              )}
                            />
                            {formatReasoningEffortLabel(
                              level,
                              externalSelection?.modelId,
                            )}
                          </DropdownMenuItem>
                        ))}
                    </>
                  ) : (
                    effectiveSupportsReasoningOff &&
                    !reasoningLockedOn && (
                      <DropdownMenuItem
                        onSelect={() => {
                          const next = !reasoningEnabled;
                          setReasoningEnabled(next);
                          applyQwenThinkingParams(next);
                          // Preserve thinking cannot run without thinking.
                          if (!next) setPreserveThinking(false);
                          if (isKimiExternal && next && toolsEnabled) {
                            setToolsEnabled(false, { persist: false });
                          }
                        }}
                      >
                        <HugeiconsIcon
                    icon={Tick02Icon}
                    strokeWidth={2}
                          className={cn(
                            "unsloth-tick size-4",
                            !effectiveReasoningEnabled && "opacity-0",
                          )}
                        />
                        Thinking
                      </DropdownMenuItem>
                    )
                  )}
                  {supportsPreserveThinking && (
                    <DropdownMenuItem
                      disabled={!modelLoaded}
                      onSelect={(e) => {
                        e.preventDefault();
                        const next = !preserveThinking;
                        setPreserveThinking(next);
                        // Preserve thinking requires thinking on.
                        if (next) {
                          setReasoningEnabled(true);
                          applyQwenThinkingParams(true);
                        }
                      }}
                    >
                      <HugeiconsIcon
                    icon={Tick02Icon}
                    strokeWidth={2}
                        className={cn(
                          "unsloth-tick size-4",
                          !preserveThinking && "opacity-0",
                        )}
                      />
                      Preserve thinking
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                type="button"
                disabled={reasoningDisabled || reasoningLockedOn}
                aria-disabled={reasoningDisabled || reasoningLockedOn}
                title={
                  reasoningLockedOn
                    ? "This model requires reasoning to stay on."
                    : undefined
                }
                onClick={() => {
                  if (reasoningLockedOn) return;
                  const next = !reasoningEnabled;
                  setReasoningEnabled(next);
                  applyQwenThinkingParams(next);
                  // Mutual exclusion: Kimi's $web_search builtin requires
                  // thinking off, so turning thinking on flips Search off.
                  if (isKimiExternal && next && toolsEnabled) {
                    setToolsEnabled(false, { persist: false });
                  }
                }}
                className="unsloth-thinking-pill"
                data-pill-label="Thinking"
                data-active={thinkingActiveLook ? "true" : "false"}
                aria-label={thinkToggleAriaLabel({
                  reasoningLockedOn,
                  modelLoaded,
                  reasoningDisabled,
                  effectiveReasoningEnabled,
                })}
              >
                <PillGlyph>
                  <BulbIcon className="size-[15.5px]" />
                </PillGlyph>
                {thinkingActiveLook ? (
                  <span className="unsloth-thinking-label">Thinking</span>
                ) : null}
              </button>
            )
          ) : null}
          {
            <>
              {!isDictating ? (
                <TooltipIconButton
                  tooltip="Dictate"
                  side="bottom"
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-full text-muted-foreground"
                  onClick={startDictation}
                  aria-label="Dictate"
                >
                  <MicIcon className="unsloth-dictate-icon size-4" />
                </TooltipIconButton>
              ) : (
                <TooltipIconButton
                  tooltip={
                    isDictationFinalizing
                      ? "Cancel transcription"
                      : "Stop dictation"
                  }
                  side="bottom"
                  variant="ghost"
                  size="icon"
                  className="size-8 rounded-full text-destructive"
                  onClick={stopDictation}
                  aria-label={
                    isDictationFinalizing
                      ? "Cancel transcription"
                      : "Stop dictation"
                  }
                >
                  <SquareIcon className="size-3 animate-pulse fill-current" />
                </TooltipIconButton>
              )}
            </>
          }
          {isQueueRunning ? (
            <button
              type="button"
              onClick={() => {
                resetPromptQueue();
                stop();
              }}
              aria-label="Stop prompt queue"
              className="ml-1.5 flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/60 px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <SquareIcon className="size-2.5 shrink-0 fill-current" />
              <span className="tabular-nums">
                Stop queue {queueProgress.current}/{queueProgress.total}
              </span>
            </button>
          ) : busy ? (
            <Button
              type="button"
              variant="default"
              size="icon"
              className="ml-1.5 size-9 rounded-full"
              onClick={stop}
            >
              <SquareIcon className="size-3 fill-current" />
            </Button>
          ) : (
            <TooltipIconButton
              tooltip="Send message"
              side="bottom"
              variant="default"
              size="icon"
              className="ml-1.5 size-9 rounded-full"
              onClick={send}
              disabled={!canSend}
              aria-label="Send message"
            >
              <ArrowUpIcon className="unsloth-send-icon size-[22px] stroke-2" />
            </TooltipIconButton>
          )}
        </div>
      </div>
    </div>
  );
}
