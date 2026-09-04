import { mlxRuntimeStateFrom } from "../../lib/mlx-runtime-state";
import { prepareHfTokenForUse } from "@/features/hf-auth";
import { DOWNLOAD_KIND } from "@/features/hub/download-manager/constants";
import {
  downloadManager,
  jobKeyOf,
  selectActiveJob,
  subscribeJobListeners,
  useDownloadManagerStore,
} from "@/features/hub/download-manager/download-manager-controller";
import {
  type LocalModelInfo,
  listLocalModels,
} from "@/features/hub/inventory/api";
import { isHiddenModelId } from "@/features/hub/lib/hidden-models";
import { resolveInitialConfig } from "@/features/model-picker";
import { isMlxId } from "@/features/model-picker/components/model-selector/recommended-fit";
import { loadManagedLlamaFlags } from "@/features/model-picker/api/llama-flags";
import { fetchLoadExtraArgs } from "@/features/model-picker/api/model-overrides";
import { sanitizeStoredExtraArgs } from "@/features/model-picker/model-config/llama-extra-args";
import { usePlatformStore } from "@/config/env";
import { createLoadingToastIcon, toast } from "@/lib/toast";
import { useSettingsDialogStore } from "@/features/settings/stores/settings-dialog-store";
import { snapshotQueuedChatRunSettings } from "../../utils/queued-chat-run-settings";
import type { QueuedModelCapabilities } from "../../utils/queued-model-capabilities";
import { isExternalModelId } from "../../external-providers";
import {
  reasoningCapsFromLoad,
  resolveInferenceCheckpointId,
  tryAdoptServerActiveModel,
} from "../../lib/apply-inference-status-to-store";
import { syncModelCapabilities } from "../../hooks/use-chat-model-runtime";
import { ensureGpuDeviceCache } from "@/hooks/use-gpu-info";
import type {
  CpuFallbackReason,
  MmprojFallbackReason,
  GgufVariantDetail,
} from "../../types/api";
import { isMultimodalResponse } from "../../types/api";
import { loadFallbackNotice } from "../../utils/mmproj-fallback";
import {
  type CachedGgufRepo,
  type CachedModelRepo,
  fetchGgufStagedMetadata,
  getInferenceStatus,
  listCachedGguf,
  listCachedModels,
  listGgufVariants,
  loadModel,
  validateModel,
} from "../chat-api";
import {
  readLastLocalModelLoad,
  recordLastLocalModelLoad,
  type LastLocalModelKind,
} from "../../utils/last-local-model-load";
import {
  GPU_LAYERS_AUTO,
  loadedGpuMemoryFields,
  reconcilePersistedGpuIds,
  resolveLoadedSpeculativeSettings,
  resolveSpeculativeSettingsForLoad,
  persistGpuMemoryModeOnLoad,
  resolvePreserveThinkingOnLoad,
  resolveToolsEnabledOnLoad,
  saveSpeculativeType,
} from "../../stores/chat-runtime-store";
import {
  resolveFitMaxSeqLength,
  resolveLoadMaxSeqLength,
  resolveManualAutoCtxPin,
} from "../../presets/preset-policy";
import { useChatRuntimeStore } from "../../stores/chat-runtime-store";
import {
  autoLoadSourceKey,
  isRememberedAutoLoadSource,
  normalizeAutoLoadTarget,
  orderAutoLoadSources,
  type AutoLoadSource,
} from "./model-autoload-selection";

export const MAX_AUTO_LOAD_ATTEMPTS = 3;
export const BIG_ENDIAN_GGUF_FILENAME_RE = /(^|[-_])be(?:[._-]|$)/gi;
export const GGUF_KNOWN_QUANT_RE =
  /(UD-)?(MXFP[0-9]+(?:_[A-Z0-9]+)*|IQ[0-9]+_[A-Z]+(?:_[A-Z0-9]+)?|TQ[0-9]+_[0-9]+|Q[0-9]+_K_[A-Z]+|Q[0-9]+_[0-9]+|Q[0-9]+_K|BF16|F16|F32)/i;

export type AutoLoadCandidate = {
  id: string;
  loadId?: string | null;
  kind: LastLocalModelKind;
  ggufVariant: string | null;
  maxSeqLength: number;
  successLabel: string;
};

export type QueuedResolvedModelRuntime = {
  checkpoint: string;
  supportsTools: boolean;
  supportsReasoning: boolean;
  reasoningAlwaysOn: boolean;
  reasoningStyle: ReturnType<typeof reasoningCapsFromLoad>["reasoningStyle"];
  supportsReasoningOff: boolean;
  reasoningEffortLevels: ReturnType<
    typeof reasoningCapsFromLoad
  >["reasoningEffortLevels"];
  supportsPreserveThinking: boolean;
  preserveThinking: boolean;
  ggufContextLength: number | null;
  loadedIsMultimodal: boolean;
  modelCapabilities: QueuedModelCapabilities | null;
};

export type ChatRuntimeState = ReturnType<typeof useChatRuntimeStore.getState>;

export const VISIBLE_MODEL_RUNTIME_KEYS = [
  "activeLoadId",
  "activeGgufVariant",
  "activeModelIsLocal",
  "ggufContextLength",
  "ggufMaxContextLength",
  "ggufNativeContextLength",
  "modelRequiresTrustRemoteCode",
  "supportsReasoning",
  "reasoningAlwaysOn",
  "reasoningEnabled",
  "reasoningStyle",
  "supportsReasoningOff",
  "reasoningEffortLevels",
  "supportsPreserveThinking",
  "preserveThinking",
  "supportsTools",
  "toolsEnabled",
  "codeToolsEnabled",
  "kvCacheDtype",
  "loadedKvCacheDtype",
  "nParallel",
  "loadedNParallel",
  "nBatch",
  "loadedNBatch",
  "nUbatch",
  "loadedNUbatch",
  "tensorParallel",
  "loadedTensorParallel",
  "gpuMemoryMode",
  "loadedGpuMemoryMode",
  "loadedCpuFallback",
  "gpuLayers",
  "loadedGpuLayers",
  "nCpuMoe",
  "loadedNCpuMoe",
  "splitRatio",
  "loadedSplitRatio",
  "ggufLayerCount",
  "moeLayerCount",
  "selectedGpuIds",
  "selectedGpuIndexKind",
  "loadedGpuIds",
  "loadedGpuIndexKind",
  "customContextLength",
  "loadedCustomContextLength",
  "defaultChatTemplate",
  "chatTemplateOverride",
  "loadedChatTemplateOverride",
  "chatTemplateOverrideReason",
  "mlxKvBits",
  "loadedMlxKvBitsRequested",
  "mlxKvQuantReason",
  "mlxKvQuantNote",
  "loadedIsMultimodal",
  "loadedIsDiffusion",
  "speculativeType",
  "loadedSpeculativeType",
  "specFallbackReason",
  "specDraftNMax",
  "loadedSpecDraftNMax",
] as const satisfies readonly (keyof ChatRuntimeState)[];

export type VisibleModelRuntimeState = Pick<
  ChatRuntimeState,
  (typeof VISIBLE_MODEL_RUNTIME_KEYS)[number]
>;

export type VisibleModelStateSnapshot = {
  settings: ReturnType<typeof snapshotQueuedChatRunSettings>;
  runtime: VisibleModelRuntimeState;
};

export function snapshotVisibleModelState(
  state: ChatRuntimeState,
): VisibleModelStateSnapshot {
  const runtime = {} as VisibleModelRuntimeState;
  for (const key of VISIBLE_MODEL_RUNTIME_KEYS) {
    Object.assign(runtime, { [key]: state[key] });
  }
  return {
    settings: snapshotQueuedChatRunSettings(state),
    runtime,
  };
}

export function restoreVisibleModelState(snapshot: VisibleModelStateSnapshot): void {
  const liveUsage = useChatRuntimeStore.getState();
  liveUsage.setCheckpoint(snapshot.settings.params.checkpoint, undefined, {
    trackQueuedSettings: false,
    persist: false,
  });
  useChatRuntimeStore.setState({
    ...snapshot.runtime,
    ...snapshot.settings,
    params: { ...snapshot.settings.params },
    contextUsage: liveUsage.contextUsage,
    contextUsageByThreadId: liveUsage.contextUsageByThreadId,
  });
}

export function queuedResolvedModelFromStore(
  state: ChatRuntimeState,
): QueuedResolvedModelRuntime {
  const activeModel = state.models.find(
    (model) => model.id === state.params.checkpoint,
  );
  return {
    checkpoint: state.params.checkpoint,
    supportsTools: state.supportsTools,
    supportsReasoning: state.supportsReasoning,
    reasoningAlwaysOn: state.reasoningAlwaysOn,
    reasoningStyle: state.reasoningStyle,
    supportsReasoningOff: state.supportsReasoningOff,
    reasoningEffortLevels: state.reasoningEffortLevels,
    supportsPreserveThinking: state.supportsPreserveThinking,
    preserveThinking: state.preserveThinking,
    ggufContextLength: state.ggufContextLength,
    loadedIsMultimodal: state.loadedIsMultimodal,
    modelCapabilities: activeModel
      ? {
          isVision: activeModel.isVision,
          isGguf: activeModel.isGguf,
          isAudio: activeModel.isAudio,
          audioType: activeModel.audioType,
          hasAudioInput: activeModel.hasAudioInput,
          hasVideoInput: activeModel.hasVideoInput,
        }
      : null,
  };
}

export type AutoLoadOptions = {
  skipAdoptServerModel?: boolean;
  preserveVisibleSettings?: boolean;
  captureResolvedRuntime?: (runtime: QueuedResolvedModelRuntime) => void;
  abortSignal?: AbortSignal;
};

export function applyAutoLoadRuntimeState(
  options: AutoLoadOptions | undefined,
  apply: () => void,
) {
  const visibleState = options?.preserveVisibleSettings
    ? snapshotVisibleModelState(useChatRuntimeStore.getState())
    : null;
  try {
    apply();
    options?.captureResolvedRuntime?.(
      queuedResolvedModelFromStore(useChatRuntimeStore.getState()),
    );
  } finally {
    if (visibleState) {
      restoreVisibleModelState(visibleState);
    }
  }
}

export function autoLoadCandidateKey(
  kind: LastLocalModelKind,
  id: string,
  ggufVariant?: string | null,
): string {
  return `${kind}:${normalizeAutoLoadTarget(id)}:${(ggufVariant ?? "").toLowerCase()}`;
}

export function hasBigEndianGgufMarker(
  filename: string,
  quant?: string | null,
): boolean {
  const normalized = filename.replace(/\\/g, "/").toLowerCase();
  const separatorIndex = normalized.lastIndexOf("/");
  const basename =
    separatorIndex >= 0 ? normalized.slice(separatorIndex + 1) : normalized;
  const parent = separatorIndex >= 0 ? normalized.slice(0, separatorIndex) : "";
  const stem = basename.replace(/\.[^.]*$/, "");
  const quantKey = quant?.trim().toLowerCase() || "";
  const quantIndex = quantKey ? stem.indexOf(quantKey) : -1;
  const quantInParentOnly =
    !!parent &&
    quantIndex < 0 &&
    ((!!quantKey && parent.includes(quantKey)) ||
      (!quantKey && GGUF_KNOWN_QUANT_RE.test(parent)));
  for (const match of stem.matchAll(BIG_ENDIAN_GGUF_FILENAME_RE)) {
    if (quantIndex >= 0 && quantIndex < (match.index ?? 0)) {
      return true;
    }
    const tail = stem
      .slice((match.index ?? 0) + match[0].length)
      .replace(/^[._-]+/, "");
    if (!tail || !GGUF_KNOWN_QUANT_RE.test(tail)) {
      return !quantInParentOnly;
    }
  }
  return false;
}

export function isAutoLoadableGgufVariant(variant: GgufVariantDetail | null): boolean {
  if (!variant?.filename) {
    return false;
  }
  const filename = variant.filename.trim().toLowerCase();
  if (!filename) {
    return false;
  }
  return !hasBigEndianGgufMarker(filename, variant.quant);
}

export const IMAGE_OR_VIDEO_TASKS: ReadonlySet<string> = new Set([
  "text-to-image",
  "text-to-video",
  "image-diffusion-unsupported",
]);

export const AUTO_LOAD_LOCAL_SOURCES: ReadonlySet<string> = new Set([
  "models_dir",
  "lmstudio",
  "custom",
]);

export function isChattableCachedRepo(repo: {
  partial?: boolean;
  task?: string | null;
  model_format?: string | null;
  capabilities?: { can_chat?: boolean } | null;
}): boolean {
  return (
    repo.partial !== true &&
    repo.capabilities?.can_chat !== false &&
    repo.model_format !== "adapter" &&
    !IMAGE_OR_VIDEO_TASKS.has(repo.task ?? "")
  );
}

export function isGgufLocalRow(row: LocalModelInfo): boolean {
  return (
    row.model_format === "gguf" || row.path.toLowerCase().endsWith(".gguf")
  );
}

export function runsOnThisPlatform(row: LocalModelInfo): boolean {
  const platform = usePlatformStore.getState();
  if (!platform.fetched || !platform.isChatOnly()) return true;
  if (isGgufLocalRow(row)) {
    return true;
  }
  return (
    platform.deviceType === "mac" &&
    (isMlxId(row.id) ||
      isMlxId(row.display_name ?? "") ||
      isMlxId(row.model_id ?? ""))
  );
}

export function cachedModelsRunOnThisPlatform(): boolean {
  const platform = usePlatformStore.getState();
  return !platform.fetched || !platform.isChatOnly();
}

export function isAutoLoadableLocalRow(
  row: LocalModelInfo,
  admitHfCache = false,
): boolean {
  return (
    (AUTO_LOAD_LOCAL_SOURCES.has(row.source) ||
      (admitHfCache && row.source === "hf_cache")) &&
    row.capabilities?.can_chat !== false &&
    row.partial !== true &&
    (isGgufLocalRow(row) || row.model_format === "safetensors") &&
    !IMAGE_OR_VIDEO_TASKS.has(row.task ?? "") &&
    runsOnThisPlatform(row) &&
    !isHiddenModelId(row.model_id, row.id, row.path)
  );
}

export function buildAutoLoadSources(
  ggufRepos: CachedGgufRepo[],
  modelRepos: CachedModelRepo[],
  localRows: LocalModelInfo[],
  safetensorsMaxSeqLength: number,
  signal?: AbortSignal,
): AutoLoadSource[] {
  const sources: AutoLoadSource[] = [];
  for (const repo of ggufRepos) {
    sources.push({
      kind: "gguf",
      id: repo.repo_id,
      loadId: repo.load_id || repo.repo_id,
      sizeBytes: repo.size_bytes,
      maxSeqLength: 0,
      listVariants: () =>
        listGgufVariants(repo.repo_id, undefined, {
          preferLocalCache: true,
          localPath: repo.cache_path,
          signal,
        }).then((response) => response.variants),
    });
  }
  for (const repo of modelRepos) {
    sources.push({
      kind: "model",
      id: repo.repo_id,
      loadId: repo.load_id || repo.repo_id,
      sizeBytes: repo.size_bytes,
      maxSeqLength: safetensorsMaxSeqLength,
      listVariants: null,
    });
  }
  for (const row of localRows) {
    const isGguf = isGgufLocalRow(row);
    const needsVariant = isGguf && row.capabilities?.requires_variant === true;
    sources.push({
      kind: isGguf ? "gguf" : "model",
      id: row.id,
      loadId: row.load_id || row.id,
      sizeBytes: row.size_bytes ?? 0,
      maxSeqLength: isGguf ? 0 : safetensorsMaxSeqLength,
      listVariants: needsVariant
        ? () =>
            listGgufVariants(row.path, undefined, {
              preferLocalCache: true,
              localPath: row.path,
              signal,
            }).then((response) => response.variants)
        : null,
    });
  }
  return sources;
}

export async function resolveAutoLoadCandidate(
  source: AutoLoadSource,
  rememberedVariant: string | null,
  isSkipped: (candidate: AutoLoadCandidate) => boolean,
): Promise<AutoLoadCandidate | null> {
  const build = (ggufVariant: string | null): AutoLoadCandidate => ({
    id: source.id,
    loadId: source.loadId,
    kind: source.kind,
    ggufVariant,
    maxSeqLength: source.maxSeqLength,
    successLabel: ggufVariant
      ? `Loaded ${source.id} (${ggufVariant})`
      : `Loaded ${source.id}`,
  });
  if (!source.listVariants) {
    const candidate = build(null);
    return isSkipped(candidate) ? null : candidate;
  }
  type VariantType = GgufVariantDetail;
  const downloaded: VariantType[] = ((await source.listVariants()) as VariantType[])
    .filter(
      (variant: VariantType) =>
        variant.downloaded &&
        variant.partial !== true &&
        isAutoLoadableGgufVariant(variant),
    )
    .sort((a: VariantType, b: VariantType) => a.size_bytes - b.size_bytes);
  const wanted = rememberedVariant?.trim().toLowerCase();
  const ordered = wanted
    ? [
        ...downloaded.filter((v: VariantType) => v.quant?.toLowerCase() === wanted),
        ...downloaded.filter((v: VariantType) => v.quant?.toLowerCase() !== wanted),
      ]
    : downloaded;
  for (const variant of ordered) {
    const candidate = build(variant.quant);
    if (!isSkipped(candidate)) return candidate;
  }
  return null;
}

export const DEFAULT_CHAT_MODEL_REPO = "unsloth/gemma-4-E2B-it-GGUF";
export const DEFAULT_CHAT_MODEL_VARIANT = "UD-Q4_K_XL";
export const DEFAULT_CHAT_MODEL_LABEL = "Gemma 4 E2B";

export function formatDownloadBytes(bytes: number): string {
  if (!(bytes > 0)) return "";
  const gb = bytes / 1024 ** 3;
  return gb >= 1
    ? `${gb.toFixed(1)} GB`
    : `${Math.max(1, Math.round(bytes / 1024 ** 2))} MB`;
}

export async function ensureDefaultModelDownloaded(
  hfToken: string | null,
  abortSignal: AbortSignal | undefined,
  setToast: (title: string, description: string, cancel?: () => void) => void,
): Promise<"ready" | "cancelled" | "failed"> {
  const variantKey = DEFAULT_CHAT_MODEL_VARIANT.toLowerCase();
  let expectedBytes = 0;
  try {
    const listing = await listGgufVariants(DEFAULT_CHAT_MODEL_REPO, undefined, {
      signal: abortSignal,
    });
    const variant = listing.variants.find(
      (entry) => entry.quant?.toLowerCase() === variantKey,
    );
    if (variant?.downloaded && variant.partial !== true) return "ready";
    expectedBytes = variant?.download_size_bytes || variant?.size_bytes || 0;
  } catch {
    // Sizing is cosmetic
  }
  abortSignal?.throwIfAborted();

  const prepared = await prepareHfTokenForUse(hfToken);
  abortSignal?.throwIfAborted();
  if (!prepared.proceed) return "cancelled";

  const request = {
    kind: DOWNLOAD_KIND.MODEL,
    repoId: DEFAULT_CHAT_MODEL_REPO,
    variant: DEFAULT_CHAT_MODEL_VARIANT,
    expectedBytes,
  };
  const jobKey = jobKeyOf(request.kind, request.repoId, request.variant);
  let cancelRequested = false;
  let cancelInFlight = false;
  let cancelEverIssued = false;

  const issueCancel = (): boolean => {
    const active = selectActiveJob(
      useDownloadManagerStore.getState(),
      request.kind,
      request.repoId,
      request.variant,
    );
    if (!active) return false;
    if (cancelInFlight || active.state === "cancelling") return true;
    cancelInFlight = true;
    cancelEverIssued = true;
    void downloadManager.cancel(active.key).finally(() => {
      cancelInFlight = false;
    });
    return true;
  };
  const cancelDownload = (): void => {
    cancelRequested = true;
    issueCancel();
  };
  const totalLabel = formatDownloadBytes(expectedBytes);
  const description =
    `Sparta couldn’t find an existing model. Sparta is now getting ` +
    `${DEFAULT_CHAT_MODEL_LABEL} ready for use. You can stop the download or ` +
    `manage models later in the 'Model hub'`;
  setToast(
    `Getting ${DEFAULT_CHAT_MODEL_LABEL} ready`,
    description,
    cancelDownload,
  );

  const isOurVariant = (variant: string | null): boolean =>
    (variant ?? "").toLowerCase() === variantKey;

  return await new Promise<"ready" | "cancelled" | "failed">((resolve) => {
    let settled = false;
    const cleanups: Array<() => void> = [];
    const finish = (outcome: "ready" | "cancelled" | "failed"): void => {
      if (settled) return;
      settled = true;
      for (const cleanup of cleanups) cleanup();
      resolve(outcome);
    };

    cleanups.push(
      subscribeJobListeners(request.kind, request.repoId, {
        onComplete: (variant) =>
          isOurVariant(variant) &&
          finish(cancelRequested ? "cancelled" : "ready"),
        onCancelled: (variant) => isOurVariant(variant) && finish("cancelled"),
        onError: (variant) => isOurVariant(variant) && finish("failed"),
      }),
    );

    cleanups.push(
      useDownloadManagerStore.subscribe((state) => {
        const job = state.jobs[jobKey];
        if (!job) return;
        if (cancelRequested) {
          if (!cancelEverIssued) issueCancel();
          return;
        }
        if (job.state === "cancelling") return;
        const done = formatDownloadBytes(job.downloadedBytes);
        const total = formatDownloadBytes(job.expectedBytes) || totalLabel;
        if (!done || !total) return;
        setToast(
          `Getting ${DEFAULT_CHAT_MODEL_LABEL} ready (${done} of ${total})`,
          description,
          cancelDownload,
        );
      }),
    );

    if (abortSignal) {
      const onAbort = () => finish("cancelled");
      abortSignal.addEventListener("abort", onAbort, { once: true });
      cleanups.push(() => abortSignal.removeEventListener("abort", onAbort));
    }

    void downloadManager.requestStart(request).then(
      (outcome) => {
        if (outcome === "started") {
          if (cancelRequested && !issueCancel()) finish("cancelled");
          return;
        }
        if (cancelRequested) {
          finish("cancelled");
          return;
        }
        finish("failed");
      },
      () => finish("failed"),
    );
  });
}

export function waitForModelReady(abortSignal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const check = () => {
      if (abortSignal?.aborted) {
        reject(new Error("Aborted"));
        return;
      }
      if (!useChatRuntimeStore.getState().modelLoading) {
        resolve();
        return;
      }
      setTimeout(check, 500);
    };
    check();
  });
}

export async function autoLoadSmallestModel(options?: AutoLoadOptions): Promise<{
  loaded: boolean;
  blockedByTrustRemoteCode: boolean;
  loadFailureReported?: boolean;
}> {
  options?.abortSignal?.throwIfAborted();
  if (!options?.skipAdoptServerModel) {
    const adoptedServerModel = await tryAdoptServerActiveModel();
    options?.abortSignal?.throwIfAborted();
    if (adoptedServerModel) {
      return { loaded: true, blockedByTrustRemoteCode: false };
    }
  }

  const store = useChatRuntimeStore.getState();
  const hfToken = store.hfToken || null;
  const trustRemoteCode = store.params.trustRemoteCode ?? false;
  const specSettings = resolveSpeculativeSettingsForLoad();
  const lastLoaded = await readLastLocalModelLoad(options?.abortSignal);
  let autoLoadToastDismissed = false;
  const toastId = toast.message("Loading a model…", {
    description: lastLoaded
      ? "Loading last used model."
      : "Auto-selecting the smallest downloaded model.",
    duration: Number.POSITIVE_INFINITY,
    closeButton: true,
    icon: createLoadingToastIcon(),
    onDismiss: () => {
      autoLoadToastDismissed = true;
    },
  });
  const updateAutoLoadToast = (
    message: string,
    description: string,
    onCancel?: () => void,
  ): void => {
    if (autoLoadToastDismissed) return;
    toast.message(message, {
      id: toastId,
      description,
      duration: Number.POSITIVE_INFINITY,
      action: onCancel
        ? { label: "Cancel", onClick: () => onCancel() }
        : undefined,
    });
  };

  const showAutoLoadSuccess = (
    message: string,
    cpuFallbackReason?: CpuFallbackReason | null,
    mmprojFallbackReason?: MmprojFallbackReason | null,
  ): void => {
    const notice = loadFallbackNotice(
      message,
      cpuFallbackReason,
      mmprojFallbackReason,
    );
    const options = {
      description: notice.description,
      duration: 5000,
      icon: undefined,
    };
    const showToast = notice.degraded ? toast.warning : toast.success;
    const title = notice.title;
    if (autoLoadToastDismissed) {
      showToast(title, options);
      return;
    }
    showToast(title, { ...options, id: toastId });
  };
  let blockedByTrustRemoteCode = false;
  let hadNonTrustFailure = false;
  let loadAttempts = 0;
  const skippedAutoLoadCandidates = new Set<string>();
  const loadFailure: {
    current: { label: string; detail: string; blamesModel: boolean } | null;
  } = { current: null };

  let autoLoadCancelled = false;

  function noteLoadFailure(label: string, error: unknown): void {
    const detail =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : "";
    const marker = error as {
      unslothTransportFailure?: boolean;
      unslothUserCancelled?: boolean;
    };
    const blamesModel = !(
      marker?.unslothTransportFailure === true ||
      marker?.unslothUserCancelled === true
    );
    loadFailure.current = {
      label,
      detail:
        detail || "The server did not report a reason. Check the Studio logs.",
      blamesModel,
    };
  }

  async function canAutoLoad(payload: {
    model_path: string;
    max_seq_length: number;
    is_lora: boolean;
    gguf_variant?: string | null;
    gpu_ids?: number[];
    gpu_memory_mode?: "auto" | "manual";
    cache_type_kv?: string | null;
    tensor_parallel?: boolean | null;
    speculative_type?: string | null;
    spec_draft_n_max?: number | null;
  }): Promise<boolean> {
    options?.abortSignal?.throwIfAborted();
    const validation = await validateModel({
      ...payload,
      hf_token: hfToken,
      load_in_4bit: true,
      trust_remote_code: trustRemoteCode,
    });
    options?.abortSignal?.throwIfAborted();
    if (
      validation.requires_trust_remote_code ||
      validation.requires_security_review
    ) {
      blockedByTrustRemoteCode = true;
      return false;
    }
    if (validation.requires_transformers_upgrade) {
      hadNonTrustFailure = true;
      return false;
    }
    return true;
  }

  function recordCandidateFailure(label: string, error: unknown): void {
    const marker = error as { unslothUserCancelled?: boolean };
    noteLoadFailure(label, error);
    if (marker?.unslothUserCancelled === true) {
      autoLoadCancelled = true;
    }
  }

  async function canAutoLoadRecordingFailures(
    label: string,
    payload: Parameters<typeof canAutoLoad>[0],
  ): Promise<boolean> {
    try {
      return await canAutoLoad(payload);
    } catch (error) {
      recordCandidateFailure(label, error);
      throw error;
    }
  }

  async function loadAutoLoadCandidate(
    candidate: AutoLoadCandidate,
  ): Promise<boolean> {
    if (autoLoadCancelled || loadAttempts >= MAX_AUTO_LOAD_ATTEMPTS) {
      return false;
    }
    const currentStore = useChatRuntimeStore.getState();
    const modelPath = candidate.loadId ?? candidate.id;
    const failureLabel = candidate.ggufVariant
      ? `${candidate.id} (${candidate.ggufVariant})`
      : candidate.id;
    const { config } = resolveInitialConfig(
      candidate.id,
      candidate.ggufVariant,
    );
    const effectiveMaxSeqLength = resolveLoadMaxSeqLength({
      modelId: candidate.id,
      ggufVariant: candidate.ggufVariant,
      isGguf: candidate.kind === "gguf",
      customContextLength: config.customContextLength,
      ggufContextLength: null,
      currentCheckpoint: currentStore.params.checkpoint,
      activeGgufVariant: currentStore.activeGgufVariant,
      maxSeqLength: config.maxSeqLength ?? candidate.maxSeqLength,
      presetSource: currentStore.activePresetSource,
    });
    const effectiveGpuMemoryMode =
      config.gpuMemoryMode ?? currentStore.gpuMemoryMode;
    const effectiveGpuLayers = config.gpuLayers ?? GPU_LAYERS_AUTO;
    const effectiveNCpuMoe = config.nCpuMoe ?? 0;
    if (config.selectedGpuIds != null) {
      await ensureGpuDeviceCache();
    }
    let isDiffusion = false;
    if (
      candidate.kind === "gguf" &&
      (config.selectedGpuIds != null || config.tensorParallel === true)
    ) {
      const preparedToken = await prepareHfTokenForUse(hfToken);
      if (!preparedToken.proceed) {
        const cancelled = Object.assign(new Error("Model load cancelled."), {
          unslothUserCancelled: true,
        });
        recordCandidateFailure(failureLabel, cancelled);
        throw cancelled;
      }
      isDiffusion = (
        await fetchGgufStagedMetadata({
          model_path: modelPath,
          gguf_variant: candidate.ggufVariant,
          hf_token: preparedToken.token,
        }).catch((error: unknown) => {
          recordCandidateFailure(failureLabel, error);
          throw error;
        })
      ).isDiffusion;
    }

    let resolvedExtraArgs = config.llamaExtraArgs;
    if (candidate.kind === "gguf" && !isDiffusion) {
      try {
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
        if (resolvedExtraArgs === undefined) {
          const stored = await fetchLoadExtraArgs(
            modelPath,
            candidate.id,
            candidate.ggufVariant ?? null,
          );
          if (stored.tokens.length > 0) {
            const cleaned = clean(stored.tokens);
            if (cleaned.length > 0) {
              resolvedExtraArgs = cleaned;
            }
          } else if (stored.explicit) {
            resolvedExtraArgs = [];
          }
        } else if (resolvedExtraArgs !== null && resolvedExtraArgs.length > 0) {
          const cleaned = clean(resolvedExtraArgs);
          if (cleaned.length !== resolvedExtraArgs.length) {
            resolvedExtraArgs = cleaned.length > 0 ? cleaned : [];
          }
        }
      } catch {
        // Continue
      }
    }
    const effectiveTensorParallel = isDiffusion ? false : config.tensorParallel;
    const effectiveGpuIds =
      config.selectedGpuIds !== undefined
        ? reconcilePersistedGpuIds(
            config.selectedGpuIds,
            config.selectedGpuIndexKind,
            isDiffusion,
          )
        : null;

    const fitMaxSeqLength = resolveFitMaxSeqLength(
      candidate.kind === "gguf",
      effectiveGpuMemoryMode,
      effectiveGpuLayers,
      config.customContextLength ?? null,
      effectiveMaxSeqLength,
    );
    const effectiveSpeculativeType =
      config.speculativeType ?? specSettings.speculativeType;
    const effectiveSpecDraftNMax =
      config.specDraftNMax ?? specSettings.specDraftNMax;
    const effectiveChatTemplateOverride = config.chatTemplateOverride?.trim()
      ? config.chatTemplateOverride
      : null;
    if (
      !(await canAutoLoadRecordingFailures(failureLabel, {
        model_path: modelPath,
        max_seq_length: fitMaxSeqLength,
        is_lora: false,
        gguf_variant: candidate.ggufVariant,
        cache_type_kv: config.kvCacheDtype,
        tensor_parallel: effectiveTensorParallel,
        speculative_type: effectiveSpeculativeType,
        spec_draft_n_max: effectiveSpecDraftNMax,
        ...(candidate.kind === "gguf"
          ? {
              gpu_ids: effectiveGpuIds ?? undefined,
              gpu_memory_mode: effectiveGpuMemoryMode,
              gpu_layers: effectiveGpuLayers,
              n_parallel: config.nParallel ?? null,
              ...(config.nBatch != null ? { n_batch: config.nBatch } : {}),
              ...(config.nUbatch != null ? { n_ubatch: config.nUbatch } : {}),
              ...(resolvedExtraArgs !== undefined
                ? { llama_extra_args: resolvedExtraArgs ?? [] }
                : {}),
            }
          : {}),
      }))
    ) {
      skippedAutoLoadCandidates.add(
        autoLoadCandidateKey(
          candidate.kind,
          candidate.loadId ?? candidate.id,
          candidate.ggufVariant,
        ),
      );
      return false;
    }
    loadAttempts += 1;
    options?.abortSignal?.throwIfAborted();
    const loadResp = await loadModel({
      model_path: modelPath,
      hf_token: hfToken,
      max_seq_length: fitMaxSeqLength,
      load_in_4bit: true,
      is_lora: false,
      gguf_variant: candidate.ggufVariant,
      trust_remote_code: trustRemoteCode,
      chat_template_override: effectiveChatTemplateOverride,
      cache_type_kv: config.kvCacheDtype,
      mlx_kv_bits: config.mlxKvBits ?? null,
      speculative_type: effectiveSpeculativeType,
      spec_draft_n_max: effectiveSpecDraftNMax,
      tensor_parallel: effectiveTensorParallel,
      ...(candidate.kind === "gguf"
        ? {
            gpu_memory_mode: effectiveGpuMemoryMode,
            gpu_layers: effectiveGpuLayers,
            n_cpu_moe: effectiveNCpuMoe,
            gpu_ids: effectiveGpuIds ?? undefined,
            n_parallel: config.nParallel ?? null,
            ...(config.nBatch != null ? { n_batch: config.nBatch } : {}),
            ...(config.nUbatch != null ? { n_ubatch: config.nUbatch } : {}),
            ...(resolvedExtraArgs !== undefined
              ? { llama_extra_args: resolvedExtraArgs ?? [] }
              : {}),
          }
        : {}),
    }).catch((error: unknown) => {
      noteLoadFailure(failureLabel, error);
      throw error;
    });

    options?.abortSignal?.throwIfAborted();
    applyAutoLoadRuntimeState(options, () => {
      if (config.speculativeType == null) {
        saveSpeculativeType(effectiveSpeculativeType);
      }
      persistGpuMemoryModeOnLoad(loadResp, effectiveGpuMemoryMode);
      const loadedModelId = loadResp.model || modelPath;
      useChatRuntimeStore.setState({
        activeLoadId: modelPath === candidate.id ? null : modelPath,
      });
      useChatRuntimeStore
        .getState()
        .setCheckpoint(loadedModelId, candidate.ggufVariant ?? undefined, {
          trackQueuedSettings: !options?.preserveVisibleSettings,
        });
      const store = useChatRuntimeStore.getState();
      store.setModelRequiresTrustRemoteCode(
        loadResp.requires_trust_remote_code ?? false,
      );
      store.setParams(
        {
          ...store.params,
          ...(candidate.kind === "gguf"
            ? {}
            : { maxSeqLength: effectiveMaxSeqLength }),
          maxTokens:
            candidate.kind === "gguf"
              ? (loadResp.context_length ?? 131072)
              : effectiveMaxSeqLength,
        },
        {
          persist: !options?.preserveVisibleSettings,
          trackQueuedSettings: !options?.preserveVisibleSettings,
          fromModelDefaults: true,
          maxTokensCap:
            candidate.kind === "gguf"
              ? (loadResp.context_length ?? undefined)
              : effectiveMaxSeqLength,
        },
      );
      syncModelCapabilities(loadedModelId, {
        ...loadResp,
        display_name: loadResp.display_name ?? candidate.id,
        is_gguf: loadResp.is_gguf ?? candidate.kind === "gguf",
      });
      if (candidate.kind === "gguf") {
        const keepCustomCtx = resolveManualAutoCtxPin(
          effectiveGpuMemoryMode,
          effectiveGpuLayers,
          config.customContextLength ?? null,
        );
        const committedSlots =
          (loadResp.is_diffusion ?? false) ? null : (config.nParallel ?? null);
        const committedNBatch =
          (loadResp.is_diffusion ?? false) ? null : (config.nBatch ?? null);
        const committedNUbatch =
          (loadResp.is_diffusion ?? false) ? null : (config.nUbatch ?? null);
        useChatRuntimeStore.setState({
          ggufContextLength: loadResp.context_length ?? 131072,
          ggufMaxContextLength:
            loadResp.max_context_length ?? loadResp.context_length ?? 131072,
          ggufNativeContextLength: loadResp.native_context_length ?? null,
          supportsReasoning: loadResp.supports_reasoning ?? false,
          reasoningAlwaysOn: loadResp.reasoning_always_on ?? false,
          reasoningEnabled: loadResp.supports_reasoning ?? false,
          ...reasoningCapsFromLoad(loadResp),
          supportsPreserveThinking:
            loadResp.supports_preserve_thinking ?? false,
          preserveThinking: resolvePreserveThinkingOnLoad(loadResp),
          supportsTools: loadResp.supports_tools ?? false,
          ...resolveToolsEnabledOnLoad(loadResp.supports_tools ?? false),
          kvCacheDtype: loadResp.cache_type_kv ?? null,
          loadedKvCacheDtype: loadResp.cache_type_kv ?? null,
          ...mlxRuntimeStateFrom(loadResp),
          nParallel: committedSlots,
          loadedNParallel: committedSlots,
          nBatch: committedNBatch,
          loadedNBatch: committedNBatch,
          nUbatch: committedNUbatch,
          loadedNUbatch: committedNUbatch,
          loadedLlamaExtraArgs:
            loadResp.requested_llama_extra_args !== undefined
              ? (loadResp.requested_llama_extra_args ?? [])
              : (resolvedExtraArgs ?? null),
          tensorParallel: loadResp.tensor_parallel ?? false,
          loadedTensorParallel: loadResp.tensor_parallel ?? false,
          ...loadedGpuMemoryFields(loadResp),
          loadedCustomContextLength: keepCustomCtx,
          defaultChatTemplate: loadResp.chat_template ?? null,
          chatTemplateOverride: effectiveChatTemplateOverride,
          loadedChatTemplateOverride: effectiveChatTemplateOverride,
          customContextLength: config.customContextLength,
          loadedIsMultimodal: isMultimodalResponse(loadResp),
          mmprojFallbackReason: loadResp.mmproj_fallback_reason ?? null,
          loadedIsDiffusion: loadResp.is_diffusion ?? false,
          activeModelIsLocal: loadResp.is_local_model ?? false,
          ...resolveLoadedSpeculativeSettings(loadResp),
        });
      } else {
        useChatRuntimeStore.setState({
          supportsReasoning: loadResp.supports_reasoning ?? false,
          reasoningAlwaysOn: loadResp.reasoning_always_on ?? false,
          reasoningEnabled: loadResp.supports_reasoning ?? false,
          ...reasoningCapsFromLoad(loadResp),
          supportsPreserveThinking:
            loadResp.supports_preserve_thinking ?? false,
          preserveThinking: resolvePreserveThinkingOnLoad(loadResp),
          supportsTools: loadResp.supports_tools ?? false,
          ...resolveToolsEnabledOnLoad(loadResp.supports_tools ?? false),
          kvCacheDtype: loadResp.cache_type_kv ?? null,
          loadedKvCacheDtype: loadResp.cache_type_kv ?? null,
          ...mlxRuntimeStateFrom(loadResp),
          nParallel: null,
          loadedNParallel: null,
          nBatch: null,
          loadedNBatch: null,
          nUbatch: null,
          loadedNUbatch: null,
          loadedLlamaExtraArgs: null,
          tensorParallel: loadResp.tensor_parallel ?? false,
          loadedTensorParallel: loadResp.tensor_parallel ?? false,
          ...loadedGpuMemoryFields(loadResp),
          defaultChatTemplate: loadResp.chat_template ?? null,
          chatTemplateOverride: effectiveChatTemplateOverride,
          loadedChatTemplateOverride: effectiveChatTemplateOverride,
          customContextLength: null,
          ...resolveLoadedSpeculativeSettings(loadResp),
          loadedIsMultimodal: isMultimodalResponse(loadResp),
          mmprojFallbackReason: loadResp.mmproj_fallback_reason ?? null,
          loadedIsDiffusion: loadResp.is_diffusion ?? false,
          activeModelIsLocal: loadResp.is_local_model ?? false,
        });
      }
      if (!(loadResp.is_lora ?? false)) {
        recordLastLocalModelLoad({
          id: candidate.id,
          kind: candidate.kind,
          ggufVariant: candidate.ggufVariant,
        });
      }
      showAutoLoadSuccess(
        candidate.successLabel,
        loadResp.cpu_fallback_reason,
        loadResp.mmproj_fallback_reason,
      );
    });
    return true;
  }

  try {
    const inventory = await Promise.allSettled([
      listCachedGguf(options?.abortSignal),
      listCachedModels(hfToken, options?.abortSignal),
      listLocalModels(),
    ]);
    options?.abortSignal?.throwIfAborted();

    const [ggufSettled, modelsSettled, localSettled] = inventory;
    const allGgufRepos =
      ggufSettled.status === "fulfilled" ? ggufSettled.value : [];
    const allModelRepos =
      modelsSettled.status === "fulfilled" ? modelsSettled.value : [];
    const localRows =
      localSettled.status === "fulfilled" ? localSettled.value.models : [];
    const inventoryIncomplete = inventory.some((r) => r.status === "rejected");
    const cachedInventoryFailed =
      ggufSettled.status === "rejected" || modelsSettled.status === "rejected";
    if (inventoryIncomplete) hadNonTrustFailure = true;

    const sources = orderAutoLoadSources(
      buildAutoLoadSources(
        allGgufRepos.filter(isChattableCachedRepo),
        cachedModelsRunOnThisPlatform()
          ? allModelRepos.filter(isChattableCachedRepo)
          : [],
        localRows.filter((row) =>
          isAutoLoadableLocalRow(row, cachedInventoryFailed),
        ),
        store.params.maxSeqLength,
        options?.abortSignal,
      ),
      lastLoaded,
    );

    const candidateResolvedFor = new Set<string>();
    for (const source of sources) {
      if (autoLoadCancelled || loadAttempts >= MAX_AUTO_LOAD_ATTEMPTS) break;
      const sourceKey = autoLoadSourceKey(source);
      if (candidateResolvedFor.has(sourceKey)) continue;
      const isRemembered = lastLoaded
        ? isRememberedAutoLoadSource(source, lastLoaded)
        : false;
      const isTried = (entry: AutoLoadCandidate): boolean =>
        skippedAutoLoadCandidates.has(
          autoLoadCandidateKey(
            entry.kind,
            entry.loadId ?? entry.id,
            entry.ggufVariant,
          ),
        );
      try {
        while (!autoLoadCancelled && loadAttempts < MAX_AUTO_LOAD_ATTEMPTS) {
          const candidate = await resolveAutoLoadCandidate(
            source,
            isRemembered ? (lastLoaded?.ggufVariant ?? null) : null,
            isTried,
          );
          options?.abortSignal?.throwIfAborted();
          if (!candidate) break;
          candidateResolvedFor.add(sourceKey);
          updateAutoLoadToast(
            isRemembered ? "Loading last used model…" : "Loading a model…",
            candidate.ggufVariant
              ? `${candidate.id} (${candidate.ggufVariant})`
              : candidate.id,
          );
          try {
            if (await loadAutoLoadCandidate(candidate)) {
              return { loaded: true, blockedByTrustRemoteCode: false };
            }
          } catch {
            options?.abortSignal?.throwIfAborted();
            hadNonTrustFailure = true;
            skippedAutoLoadCandidates.add(
              autoLoadCandidateKey(
                candidate.kind,
                candidate.loadId ?? candidate.id,
                candidate.ggufVariant,
              ),
            );
          }
        }
      } catch {
        hadNonTrustFailure = true;
      }
    }

    if (!autoLoadCancelled && !inventoryIncomplete && sources.length === 0) {
      const outcome = await ensureDefaultModelDownloaded(
        hfToken,
        options?.abortSignal,
        updateAutoLoadToast,
      );
      if (outcome === "ready") {
        const candidate: AutoLoadCandidate = {
          id: DEFAULT_CHAT_MODEL_REPO,
          kind: "gguf",
          ggufVariant: DEFAULT_CHAT_MODEL_VARIANT,
          maxSeqLength: 0,
          successLabel: `${DEFAULT_CHAT_MODEL_LABEL} ready`,
        };
        try {
          if (await loadAutoLoadCandidate(candidate)) {
            return { loaded: true, blockedByTrustRemoteCode: false };
          }
        } catch {
          options?.abortSignal?.throwIfAborted();
          hadNonTrustFailure = true;
        }
      }
      if (outcome === "cancelled") {
        toast.dismiss(toastId);
        return { loaded: false, blockedByTrustRemoteCode: false };
      }
      if (outcome === "failed") {
        hadNonTrustFailure = true;
      }
    }

    toast.dismiss(toastId);
    toast.info("No hay modelos disponibles", {
      description:
        "No tienes ningún proveedor de IA configurado ni modelo descargado. Conecta un proveedor para comenzar a chatear.",
      action: {
        label: "Conectar proveedor",
        onClick: () => {
          useSettingsDialogStore.getState().openDialog("connections");
        },
      },
      duration: 10000,
      closeButton: true,
    });
    return {
      loaded: false,
      blockedByTrustRemoteCode: false,
      loadFailureReported: true,
    };
  } catch {
    options?.abortSignal?.throwIfAborted();
    toast.dismiss(toastId);
    hadNonTrustFailure = true;
    return {
      loaded: false,
      blockedByTrustRemoteCode: blockedByTrustRemoteCode && !hadNonTrustFailure,
    };
  }
}

export async function resolveQueuedEmptyLocalModel(abortSignal: AbortSignal): Promise<{
  loaded: boolean;
  blockedByTrustRemoteCode: boolean;
  loadFailureReported?: boolean;
  modelRuntime: QueuedResolvedModelRuntime | null;
}> {
  let lifecycleLease = useChatRuntimeStore.getState().beginModelLoading();
  while (lifecycleLease === null) {
    await waitForModelReady(abortSignal);
    abortSignal.throwIfAborted();
    lifecycleLease = useChatRuntimeStore.getState().beginModelLoading();
  }

  try {
    abortSignal.throwIfAborted();
    const visibleState = useChatRuntimeStore.getState();
    if (isExternalModelId(visibleState.params.checkpoint)) {
      const status = await getInferenceStatus();
      abortSignal.throwIfAborted();
      const checkpoint = resolveInferenceCheckpointId(status);
      if (checkpoint) {
        return {
          loaded: true,
          blockedByTrustRemoteCode: false,
          modelRuntime: {
            checkpoint,
            supportsTools: status.supports_tools ?? false,
            supportsReasoning: status.supports_reasoning ?? false,
            reasoningAlwaysOn: status.reasoning_always_on ?? false,
            ...reasoningCapsFromLoad(status),
            supportsPreserveThinking:
              status.supports_preserve_thinking ?? false,
            preserveThinking: resolvePreserveThinkingOnLoad(status),
            ggufContextLength: status.is_gguf
              ? (status.context_length ?? null)
              : null,
            loadedIsMultimodal: isMultimodalResponse(status),
            modelCapabilities: {
              isVision: status.is_vision ?? false,
              isGguf: status.is_gguf ?? false,
              isAudio: status.is_audio ?? false,
              audioType: status.audio_type ?? null,
              hasAudioInput: status.has_audio_input ?? false,
              hasVideoInput: status.has_video_input ?? false,
            },
          },
        };
      }

      const visibleExternalState = snapshotVisibleModelState(visibleState);
      const visibleThreadEpoch = visibleState.activeThreadEpoch;
      const visibleSettingsEpoch = visibleState.queuedSettingsEpoch;
      const visibleRoute = window.location.href;
      let result: Awaited<ReturnType<typeof autoLoadSmallestModel>>;
      let modelRuntime: QueuedResolvedModelRuntime | null = null;
      try {
        result = await autoLoadSmallestModel({
          skipAdoptServerModel: true,
          preserveVisibleSettings: true,
          captureResolvedRuntime: (runtime) => {
            modelRuntime = runtime;
          },
          abortSignal,
        });
        if (result.loaded && !modelRuntime) {
          modelRuntime = queuedResolvedModelFromStore(
            useChatRuntimeStore.getState(),
          );
        }
      } finally {
        if (
          useChatRuntimeStore.getState().activeThreadEpoch ===
            visibleThreadEpoch &&
          useChatRuntimeStore.getState().queuedSettingsEpoch ===
            visibleSettingsEpoch &&
          window.location.href === visibleRoute
        ) {
          restoreVisibleModelState(visibleExternalState);
        }
      }
      return { ...result, modelRuntime };
    }

    if (visibleState.params.checkpoint) {
      return {
        loaded: true,
        blockedByTrustRemoteCode: false,
        modelRuntime: queuedResolvedModelFromStore(visibleState),
      };
    }

    const result = await autoLoadSmallestModel({ abortSignal });
    return {
      ...result,
      modelRuntime: result.loaded
        ? queuedResolvedModelFromStore(useChatRuntimeStore.getState())
        : null,
    };
  } finally {
    useChatRuntimeStore.getState().endModelLoading(lifecycleLease);
  }
}
