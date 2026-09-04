import { getAuthToken } from "@/features/auth";
import { projectHasSources } from "@/features/rag/api/rag-api";
import {
  SANDBOX_FILE_TOOLS,
  extractCreatedFiles,
  isSandboxFileList,
  isSandboxToolResult,
  type SandboxFile,
  sandboxSessionIdFor,
} from "@/components/assistant-ui/sandbox-files";
import { apiUrl } from "@/lib/api-base";
import { getLocale } from "@/i18n";
import { parseParamCountB } from "@/lib/model-size";
import { createLoadingToastIcon, toast } from "@/lib/toast";
import { useSettingsDialogStore } from "@/features/settings/stores/settings-dialog-store";
import { notifyPromptQueueRunFailed } from "../../utils/prompt-queue-boundary";
import {
  adoptPreStreamRunReservation,
  findPreStreamRunReservation,
  preStreamRunThreadIdsForAdapter,
  releasePreStreamRunForThreadIds,
  releasePreStreamRunReservation,
} from "../../utils/pre-stream-run-reservation";
import {
  consumeQueuedChatRunSettings,
  snapshotQueuedChatRunSettings,
} from "../../utils/queued-chat-run-settings";
import {
  mergeQueuedModelCapabilities,
  type QueuedModelCapabilities,
} from "../../utils/queued-model-capabilities";
import type { MessageTiming, ToolCallMessagePart } from "@assistant-ui/core";
import type { ChatModelAdapter } from "@assistant-ui/react";
import { parsePartialJsonObject } from "assistant-stream/utils";
import {
  getExternalProviderApiKey,
  isCustomProviderType,
  isExternalModelId,
  isPromptCacheTtl,
  loadExternalProviders,
  parseExternalModelId,
  providerModelSupportsStudioTools,
  providerModelSupportsVision,
  supportsProviderPromptCacheTtl,
  supportsProviderPromptCaching,
  toExternalBackendProviderType,
} from "../../external-providers";

import {
  addCodexReasoning,
  codexLocalToolRoundId,
  codexReasoningForToolCalls,
  readCodexReasoning,
  shouldReplayAssistantReasoning,
  startsNewCodexToolRound,
  type CodexReasoningLedger,
} from "../../codex-reasoning";

import { toolCallReplayArguments } from "../../tool-call-arguments";
import {
  findStreamedToolCallPartIndex,
  resolveToolCallPartId,
} from "../../tool-call-id";

import { buildResearchInferenceRequest } from "../../research-inference-request";
import { pickFriendlyContainerName } from "../../lib/friendly-names";

import {
  clampReasoningEffortToLevels,
  getExternalMaxOutputTokens,
  getExternalMinOutputTokens,
  getExternalReasoningCapabilities,
  getProviderCapabilities,
  isGeminiCustomOpenAICompatBase,
  providerHostsCodeExecution,
  providerSupportsBuiltinCodeExecution,
  providerSupportsBuiltinImageGeneration,
  providerSupportsBuiltinWebFetch,
  providerSupportsBuiltinWebSearch,
  providerSupportsFastMode,
} from "../../provider-capabilities";
import { selectCodeToolNames } from "../code-tool-placement";
import {
  buildCurrentTemporalContext,
  resolveSystemPromptVariables,
  attachAssistantThoughtSignature,
  buildReplayContent,
  setAssistantCodexReasoning,
  autoLoadSourceKey,
  isRememberedAutoLoadSource,
  normalizeAutoLoadTarget,
  orderAutoLoadSources,
  type AutoLoadSource,
  ThreadAutosaveHandle,
  useThreadAutosaveHandle,
  isContextLimitError,
  isSafeNavigableSourceUrl,
  documentCitationToSource,
  parseSourcesFromResult,
  parseLiveToolArgs,
  toolResultModelText,
  isMcpImageToolResult,
  isSandboxWrapper,
  isWrappedWithText,
  type McpImageToolResult,
  messagesContainImage,
  findLatestUserAudioBase64,
  findLatestUserVideoBase64,
  extractAudioPartBase64,
  extractVideoPartBase64,
  CANVAS_TOOL_INSTRUCTION,
  CANVAS_FALLBACK_INSTRUCTION,
  type RunMessages,
  type RunMessage,
  resolveProjectId,
  rememberComposerProjectForRun,
  buildLocalTokenCountReasoning,
  buildLocalTokenCountExtras,
  type ThreadRecordReader,
  wait,
  collectTextParts,
  collectImageParts,
  isServerSideBuiltinToolPart,
  SERVER_SIDE_BUILTIN_TOOL_NAMES,
  sanitizeAssistantReplayText,
  isAnthropicRefusalMessage,
  getToolPartReplayMetadata,
  serializeAssistantToolCallPart,
  serializeToolResultPart,
  canReplayToolCallWithoutRoleTool,
  extractImageBase64,
  findLatestUserImageBase64,
  collectAssistantTextThoughtSignature,
  serializeAssistantReplayMessages,
  toOpenAIMessages,
  toOpenAIImageEditReferenceMessage,
  normalizeOpenAIReasoningItem,
  estimateTokenCount,
  buildTiming,
  type SerializedMessage,
  type SerializedToolCall,
  type SerializedToolResult,
  type OpenAIChatMessage,
  type OpenAIMessageContent,
  type OpenAIReasoningContentPart,
  RESPONSE_LANGUAGE_BY_LOCALE,
  defaultResponseLanguageInstruction,
  resolveProjectInstructions,
  resolveProjectWorkspaceContext,
  resolveChatInstructions,
  resolveUseAdapter,
  resolveSandboxSessionId,
  buildOutboundMessagesForTokenCount,
  type OpenAIStreamAdapterOptions,
  waitForModelReady,
  autoLoadSmallestModel,
  resolveQueuedEmptyLocalModel,
  type QueuedResolvedModelRuntime,
} from "./index";

// A connected project is an explicit capability: these tools are available
// even when the generic Code pill is off, and mutations still use the normal
// permission gate sent with every local tool request.
const WORKSPACE_TOOL_NAMES = [
  "list_directory",
  "read_file",
  "write_file",
  "create_file",
  "delete_path",
  "rename_path",
  "search_in_files",
] as const;
import {
  type PendingImageEditReference,
  type RagAutoInject,
  awaitThreadScopedPairing,
  useChatRuntimeStore,
} from "../../stores/chat-runtime-store";
import { useExternalProvidersStore } from "../../stores/external-providers-store";
import {
  shouldPreserveFullOutput,
  toolOutputKey,
  toolPaneScope,
  toolThreadScope,
} from "../../tool-output-scope";
import type { ModelType, ThreadRecord } from "../../types";
import { isMultimodalResponse } from "../../types/api";
import type {
  CpuFallbackReason,
  MmprojFallbackReason,
  GgufVariantDetail,
  OpenAIChatCompletionsRequest,
} from "../../types/api";
import type { ChatModelSummary } from "../../types/runtime";
import { loadFallbackNotice } from "../../utils/mmproj-fallback";
import {
  getStoredChatThread,
  getStoredChatThreadReadResult,
  getStoredChatProject,
  isThreadIncognito,
  listStoredChatThreads,
  listStoredChatMessages,
  saveStoredChatMessage,
  updateStoredChatThread,
} from "../../utils/chat-history-storage";
import {
  readLastLocalModelLoad,
  recordLastLocalModelLoad,
  type LastLocalModelKind,
} from "../../utils/last-local-model-load";
import { createRetryableSharedRead } from "../../utils/retryable-shared-read";
import { getThreadWorkspace } from "../chat-api";
import { getImageInputUnavailableReason } from "../../utils/image-input-support";
import {
  createThinkTagTracker,
  extractDeltaText,
  parseAssistantContent,
} from "../../utils/parse-assistant-content";
import { createSegmentedAssistantText } from "../../utils/incremental-assistant-content";
import {
  createTrailingPlaceholderWatch,
  stripTrailingTemplatePlaceholder,
} from "../../utils/trailing-template-placeholder";
import { createStreamPublishGate } from "../../utils/stream-pacing";
import {
  countReasoningGroups,
  createReasoningDurationTracker,
  lastReasoningGroupTextLength,
} from "../../utils/reasoning-duration";
import { resolveLoadMaxSeqLength } from "../../presets/preset-policy";
import type { CachedGgufRepo, CachedModelRepo } from "../chat-api";
import {
  budgetImpliesTruncation,
  CONTINUE_INSTRUCTION,
  type IncompleteReason,
  joinContinuation,
  readIncompleteInfo,
  readContinuationRequest,
  rejectsAssistantPrefill,
  resumesExactly,
} from "../../utils/continuation";
import {
  generateAudio,
  GenerationLengthError,
  fetchGgufStagedMetadata,
  getInferenceStatus,
  listCachedGguf,
  listCachedModels,
  listGgufVariants,
  loadModel,
  streamChatCompletions,
  StreamInterruptedError,
  validateModel,
} from "../chat-api";
import {
  createOpenAIContainer,
  listOpenAIContainers,
} from "../openai-containers";
import {
  encryptProviderApiKey,
  isProviderKeyRotationError,
} from "../providers-api";
import {
  beginExternalResearchFollow,
  ingestResearchUpdate,
  terminalResearchStatuses,
  useResearchRunStore,
  watchResearchRun,
} from "../../stores/research-run-store";
import { cancelResearchRun, createResearchRun } from "../research-api";

// Small models (<=9B) answer from memory instead of calling search, so "auto"
// forces retrieval for them and leaves it to larger ones.
const AUTOINJECT_AUTO_MAX_SIZE_B = 9;

function resolveAutoInject(mode: RagAutoInject, checkpoint: string): boolean {
  if (mode === "on") return true;
  if (mode === "off") return false;
  const size = parseParamCountB(checkpoint);
  // Unknown size -> enable.
  return size === null || size <= AUTOINJECT_AUTO_MAX_SIZE_B;
}

/** Server-side usage data from llama-server (via stream_options.include_usage). */
interface ServerUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  // External prompt-cache fields (see _build_usage_chunk in
  // external_provider.py); cache_creation is Anthropic-only.
  prompt_tokens_details?: {
    cached_tokens?: number;
  };
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

/** Server-side timing data from llama-server's timings object. */
interface ServerTimings {
  prompt_n: number;
  cache_n: number;
  prompt_ms: number;
  prompt_per_token_ms: number;
  prompt_per_second: number;
  predicted_n: number;
  predicted_ms: number;
  predicted_per_token_ms: number;
  predicted_per_second: number;
  // DiffusionGemma-only extras (present when serving a diffusion model; ignored otherwise).
  diffusion?: boolean;
  diffusion_blocks?: number;
  diffusion_steps?: number;
  diffusion_canvas?: number;
  diffusion_prompt_n?: number;
  diffusion_prompt_prepare_ms?: number;
  diffusion_decode_ms?: number;
  diffusion_wall_ms?: number;
  // Honest throughput, matching the standalone diffusion CLI:
  //   effective = canvas*blocks/wall, parallel = canvas/per_step, output = answer tokens/wall.
  diffusion_effective_tok_s?: number;
  diffusion_parallel_tok_s?: number;
  diffusion_output_tok_s?: number;
  diffusion_steps_per_second?: number;
}

interface ResponseDetailsMetadata {
  modelId: string;
  modelLabel: string;
  responseModelId: string;
  providerId?: string;
  providerName: string;
  providerType: string;
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  sessionId?: string;
  cancelId: string;
  toolCalls: string[];
  tools: {
    search: boolean;
    fetch: boolean;
    code: boolean;
    images: boolean;
    mcp: boolean;
    docs: boolean;
    artifacts: boolean;
    confirmToolCalls: boolean;
    bypassPermissions: boolean;
    permissionMode?: string;
  };
}


/** Tracks which user messages were sent with an audio file (messageId → filename). */
export const sentAudioNames = new Map<string, string>();






async function updateStoredChatThreadEventually(
  threadId: string,
  patch: Parameters<typeof updateStoredChatThread>[1],
): Promise<void> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const updated = await updateStoredChatThread(threadId, patch).catch(
      () => undefined,
    );
    if (updated) return;
    await wait(50);
  }
}












export function createOpenAIStreamAdapter(
  options: OpenAIStreamAdapterOptions = {},
): ChatModelAdapter {
  const adapter = {
    async *run({
      messages,
      runConfig,
      abortSignal,
      unstable_threadId,
      unstable_assistantMessageId,
    }) {
      // Before the first await: hydration and a model load both run ahead of the
      // first resolveProjectId, and a send survives navigation. Only consulted
      // while the thread's own row is still missing.
      const composerProjectIdAtSend =
        useChatRuntimeStore.getState().activeProjectId ?? null;
      await useChatRuntimeStore.getState().hydratePersistedSettings();
      // Every run reaches here: the composer, Reload, Continue, and send from the edit
      // composer. Waiting for the open chat's own settings in this one place is what
      // keeps the message-level controls from starting a run on the installation
      // defaults that stand in while the read is out, which for a chat stored as "ask"
      // would mean running tools without asking.
      // Bound to this run's own chat: a run for A released by B's pairing ending would
      // resume and read B's settings for A.
      const runThreadId =
        unstable_threadId ?? useChatRuntimeStore.getState().activeThreadId;
      // Refused rather than run on whatever the store holds now: the wait only runs out
      // for a chat the user left mid-read, and the settings on screen are then some
      // other chat's. The run is recoverable by reopening the chat; a message sent with
      // another chat's tools and permission level is not.
      if (!(await awaitThreadScopedPairing(runThreadId))) {
        throw new Error(
          "This chat's settings could not be loaded, so the message was not sent. Reopen the chat and try again.",
        );
      }
      let runtime = useChatRuntimeStore.getState();
      // Capture the thread ID once so it stays stable even if the user
      // switches chats while waiting for model load / auto-load.
      const resolvedThreadId =
        (runThreadId ?? runtime.activeThreadId) || undefined;
      if (resolvedThreadId) {
        rememberComposerProjectForRun(
          resolvedThreadId,
          composerProjectIdAtSend,
        );
      }
      const sharedThreadRecordRead = resolvedThreadId
        ? createRetryableSharedRead(
            () => getStoredChatThreadReadResult(resolvedThreadId),
            (result) => result.cacheable,
          )
        : undefined;
      const readThreadRecord = sharedThreadRecordRead
        ? async () => (await sharedThreadRecordRead()).thread
        : undefined;
      const releaseCurrentPreStreamRun = () =>
        releasePreStreamRunForThreadIds([unstable_threadId, resolvedThreadId]);
      const queuedRunSettings = consumeQueuedChatRunSettings(resolvedThreadId);
      let queuedEmptyModelRuntime: QueuedResolvedModelRuntime | null = null;
      const persistResolvedQueuedModel = async (modelId: string) => {
        if (
          !queuedRunSettings ||
          queuedRunSettings.params.checkpoint ||
          !resolvedThreadId ||
          !modelId
        ) {
          return;
        }
        try {
          await updateStoredChatThread(resolvedThreadId, { modelId });
        } catch (error) {
          throw error;
        }
      };
      if (queuedRunSettings) {
        runtime = { ...runtime, ...queuedRunSettings };
      }
      const threadAlreadyResearched = Boolean(
        resolvedThreadId &&
        useResearchRunStore.getState().claimedThreadIds[resolvedThreadId],
      );
      if (runtime.deepResearchEnabled && threadAlreadyResearched) {
        if (queuedRunSettings) {
          runtime = { ...runtime, deepResearchEnabled: false };
        } else {
          runtime.setDeepResearchEnabled(false);
          runtime = useChatRuntimeStore.getState();
        }
      }
      if (
        runtime.deepResearchEnabled &&
        !options.pairId &&
        (options.modelType === undefined || options.modelType === "base")
      ) {
        if (runtime.modelLoading) {
          toast.info("Waiting for model to finish loading…");
          try {
            await waitForModelReady(abortSignal);
          } catch (error) {
            throw error;
          }
        }
        if (!runtime.params.checkpoint) {
          let resolution: Awaited<
            ReturnType<typeof resolveQueuedEmptyLocalModel>
          >;
          try {
            resolution = await resolveQueuedEmptyLocalModel(abortSignal);
          } catch (error) {
            throw error;
          }
          queuedEmptyModelRuntime = resolution.modelRuntime;
          if (!resolution.loaded) {
            // A reported failure already names the model; generic advice buries it.
            if (!resolution.loadFailureReported) {
              toast.error(
                resolution.blockedByTrustRemoteCode
                  ? "This model needs custom code approval"
                  : "No model loaded",
                {
                  description: resolution.blockedByTrustRemoteCode
                    ? "Select it from the top bar to review and approve its custom code, or pick another model."
                    : "Pick a model in the top bar, then retry.",
                },
              );
            }
            throw new Error("Load a model first.");
          }
        }
        const liveRuntime = useChatRuntimeStore.getState();
        runtime = queuedRunSettings
          ? queuedRunSettings.params.checkpoint
            ? { ...liveRuntime, ...queuedRunSettings }
            : {
                ...liveRuntime,
                ...queuedRunSettings,
                params: {
                  ...queuedRunSettings.params,
                  checkpoint:
                    queuedEmptyModelRuntime?.checkpoint ??
                    liveRuntime.params.checkpoint,
                },
                supportsTools:
                  queuedEmptyModelRuntime?.supportsTools ??
                  liveRuntime.supportsTools,
                supportsReasoning:
                  queuedEmptyModelRuntime?.supportsReasoning ??
                  liveRuntime.supportsReasoning,
                reasoningAlwaysOn:
                  queuedEmptyModelRuntime?.reasoningAlwaysOn ??
                  liveRuntime.reasoningAlwaysOn,
                reasoningStyle:
                  queuedEmptyModelRuntime?.reasoningStyle ??
                  liveRuntime.reasoningStyle,
                supportsReasoningOff:
                  queuedEmptyModelRuntime?.supportsReasoningOff ??
                  liveRuntime.supportsReasoningOff,
                reasoningEffortLevels:
                  queuedEmptyModelRuntime?.reasoningEffortLevels ??
                  liveRuntime.reasoningEffortLevels,
                supportsPreserveThinking:
                  queuedEmptyModelRuntime?.supportsPreserveThinking ??
                  liveRuntime.supportsPreserveThinking,
                preserveThinking:
                  queuedEmptyModelRuntime?.preserveThinking ??
                  liveRuntime.preserveThinking,
                ggufContextLength:
                  queuedEmptyModelRuntime !== null
                    ? queuedEmptyModelRuntime.ggufContextLength
                    : liveRuntime.ggufContextLength,
                models: mergeQueuedModelCapabilities(
                  liveRuntime.models,
                  queuedEmptyModelRuntime?.checkpoint ?? "",
                  queuedEmptyModelRuntime?.modelCapabilities ?? null,
                ),
              }
          : liveRuntime;
        if (!resolvedThreadId)
          throw new Error("Research requires a saved chat.");
        if (!unstable_assistantMessageId) {
          throw new Error(
            "Deep research could not bind its assistant message. Please retry the send.",
          );
        }
        const userMessage = [...messages]
          .reverse()
          .find((m) => m.role === "user");
        if (!userMessage) throw new Error("Research requires a user message.");
        const userMessageIndex = messages.indexOf(userMessage);
        const userMessageParentId =
          userMessageIndex > 0 ? messages[userMessageIndex - 1]!.id : null;
        const { params } = runtime;
        await persistResolvedQueuedModel(params.checkpoint);
        const selectedCheckpoint = params.checkpoint.trim();
        const researchExternalSelection =
          parseExternalModelId(selectedCheckpoint);
        const researchExternalProvider = researchExternalSelection
          ? loadExternalProviders().find(
              (provider) =>
                provider.id === researchExternalSelection.providerId,
            )
          : null;
        if (
          !selectedCheckpoint ||
          (researchExternalSelection &&
            providerModelSupportsStudioTools(
              researchExternalProvider?.providerType,
              researchExternalSelection.modelId,
            ) !== true)
        ) {
          throw new Error(
            "Deep research requires a selected local model or a connection whose provider supports Studio tools.",
          );
        }
        const reasoningRequested =
          runtime.reasoningAlwaysOn ||
          (runtime.reasoningEnabled && runtime.reasoningEffort !== "none");
        const inferenceRequest = buildResearchInferenceRequest({
          checkpoint: selectedCheckpoint,
          external:
            researchExternalSelection && researchExternalProvider
              ? {
                  providerId: researchExternalProvider.id,
                  providerType: researchExternalProvider.providerType,
                  modelId: researchExternalSelection.modelId,
                }
              : undefined,
          temperature: params.temperature,
          topP: params.topP,
          maxTokens: params.maxTokens,
          reasoningRequested,
          reasoningStyle: runtime.reasoningStyle,
          reasoningEffort: runtime.reasoningEffort,
          reasoningEffortLevels: runtime.reasoningEffortLevels,
          clampReasoningEffort: clampReasoningEffortToLevels,
        });
        const researchProjectId = await resolveProjectId(
          resolvedThreadId,
          readThreadRecord,
        );
        const projectRagEnabled = researchProjectId
          ? await projectHasSources(researchProjectId)
          : false;
        const researchInstructions = await resolveChatInstructions(
          resolvedThreadId,
          params.systemPrompt,
          params.systemVariables,
          readThreadRecord,
        );
        const ragScope =
          runtime.ragEnabled || projectRagEnabled
            ? runtime.ragEnabled && runtime.ragSource.type === "kb"
              ? {
                  kb_id: runtime.ragSource.kbId,
                  default_top_k: runtime.ragTopK,
                  mode: runtime.ragMode,
                  autoinject: runtime.ragAutoInject,
                  autoinject_min_score: runtime.ragAutoInjectMinScore,
                }
              : {
                  ...(runtime.ragEnabled
                    ? { thread_id: resolvedThreadId }
                    : {}),
                  ...(projectRagEnabled && researchProjectId
                    ? { project_id: researchProjectId }
                    : {}),
                  default_top_k: runtime.ragTopK,
                  mode: runtime.ragMode,
                  autoinject: runtime.ragAutoInject,
                  autoinject_min_score: runtime.ragAutoInjectMinScore,
                }
            : undefined;

        const threadKey = resolvedThreadId;
        // The run is durable on the server, but Stop, archive and delete reach a background
        // thread only through this map: without a handle the supervisor kept planning against
        // a deleted conversation. Registered before the run exists, since the thread can be
        // stopped while createResearchRun is still in flight.
        let researchRunId: string | null = null;
        let researchStopRequested = false;
        const researchServerCancel = () => {
          researchStopRequested = true;
          if (researchRunId) {
            void cancelResearchRun(researchRunId).catch(() => {});
          }
        };
        runtime.registerThreadServerCancel(threadKey, researchServerCancel);
        releaseCurrentPreStreamRun();
        runtime.setThreadRunning(threadKey, true, {
          owner: researchServerCancel,
        });
        let report = "";
        let releaseResearchFollow: (() => void) | null = null;
        const researchFollowController = new AbortController();
        const detachResearchFollow = () => {
          researchFollowController.abort({ detach: true });
        };
        const forwardAdapterAbort = () => {
          researchFollowController.abort(abortSignal.reason);
        };
        abortSignal.addEventListener("abort", forwardAdapterAbort, {
          once: true,
        });
        try {
          // The normal history adapter persists messages after model execution,
          // but research validates the user message before it can start.
          const storedUserMessage = (
            await listStoredChatMessages(resolvedThreadId)
          ).find((message) => message.id === userMessage.id);
          await saveStoredChatMessage({
            id: userMessage.id,
            threadId: resolvedThreadId,
            parentId: storedUserMessage?.parentId ?? userMessageParentId,
            role: "user",
            content: userMessage.content,
            ...(userMessage.attachments?.length
              ? { attachments: userMessage.attachments }
              : {}),
            createdAt: userMessage.createdAt?.getTime?.() ?? Date.now(),
          });
          const createdRun = await createResearchRun({
            threadId: resolvedThreadId,
            userMessageId: userMessage.id,
            assistantMessageId: unstable_assistantMessageId,
            inferenceRequest,
            ...(researchInstructions
              ? { instructions: researchInstructions }
              : {}),
            ...(ragScope ? { ragScope } : {}),
            budgets: {
              modelTimeoutSeconds: runtime.researchModelTimeoutSeconds,
            },
            websitePolicy: {
              allowedDomains: [...runtime.researchWebsitePolicy.allowedDomains],
              blockedDomains: [...runtime.researchWebsitePolicy.blockedDomains],
            },
          });
          researchRunId = createdRun.id;
          if (researchStopRequested) {
            // Stopped while createResearchRun was still in flight, so the handle had no
            // id to act on. Replay it rather than following a run the user already ended.
            void cancelResearchRun(createdRun.id).catch(() => {});
            return;
          }
          releaseResearchFollow = beginExternalResearchFollow(
            createdRun,
            detachResearchFollow,
          );
          if (
            !queuedRunSettings ||
            resolvedThreadId === useChatRuntimeStore.getState().activeThreadId
          ) {
            runtime.setDeepResearchEnabled(false);
          }
          if (abortSignal.aborted) {
            const detached = Boolean(
              (abortSignal.reason as { detach?: boolean } | undefined)?.detach,
            );
            if (!detached) {
              try {
                ingestResearchUpdate(await cancelResearchRun(createdRun.id));
              } catch {
                // The durable run remains visible and can be stopped again after recovery.
              }
            }
            return;
          }
          // read the store, not the stream: a stalled reader here must not freeze ingestion.
          let yieldedStatus: string | null = null;
          for await (const run of watchResearchRun(createdRun.id, {
            signal: researchFollowController.signal,
          })) {
            if (typeof run.report === "string") {
              report = run.report;
            }
            const settled = terminalResearchStatuses.has(run.status);
            // per-delta yields would rewrite the message and drive an autosave the server rejects.
            if (run.status === yieldedStatus && !settled) {
              continue;
            }
            yieldedStatus = run.status;
            yield {
              content: [{ type: "text" as const, text: report }],
              metadata: {
                custom: {
                  researchRunId: run.id,
                  researchRun: run,
                  serverManaged: true,
                  serverRevision: run.lastEventSeq,
                },
              },
            };
          }
        } catch (error) {
          if (
            !abortSignal.aborted &&
            !researchFollowController.signal.aborted
          ) {
            throw error;
          }
        } finally {
          abortSignal.removeEventListener("abort", forwardAdapterAbort);
          releaseResearchFollow?.();
          runtime.clearThreadServerCancel(threadKey, researchServerCancel);
          runtime.setThreadRunning(threadKey, false, {
            owner: researchServerCancel,
          });
        }
        return;
      }
      const toolConfirmationIdsByBackendId = new Map<string, string>();
      // Local tool ids ("call_0") repeat across turns, panes and conversations, so scope by pane
      // AND thread. unstable_threadId alone, no activeThreadId fallback: the reader has only
      // threadListItem.remoteId, which is exactly this value.
      const toolOutputPaneScope = toolThreadScope(
        toolPaneScope(options.modelType, options.pairId),
        unstable_threadId,
      );
      const scopedToolOutputKey = (id: string) =>
        toolOutputKey(toolOutputPaneScope, id);
      const runToolLiveOutputKeys = new Set<string>();
      const resolvedThreadKey = resolvedThreadId ?? null;
      // Which conversation was on screen when this run started. A first turn has no id yet, so
      // this is the only way to tell later whether the user has switched away from it.
      const activeThreadIdAtRunStart =
        useChatRuntimeStore.getState().activeThreadId ?? null;
      const pendingImageEditReferenceForRun = runtime.pendingImageEditReference;
      const selectedImageEditReference =
        (pendingImageEditReferenceForRun?.threadId ?? null) ===
        resolvedThreadKey
          ? pendingImageEditReferenceForRun
          : null;
      const clearSelectedImageEditReference = () => {
        if (!selectedImageEditReference) {
          return;
        }
        const store = useChatRuntimeStore.getState();
        const pending = store.pendingImageEditReference;
        if (
          pending?.openaiImageGenerationCallId ===
            selectedImageEditReference.openaiImageGenerationCallId &&
          pending.openaiResponseId ===
            selectedImageEditReference.openaiResponseId &&
          (pending.threadId ?? null) ===
            (selectedImageEditReference.threadId ?? null)
        ) {
          store.clearPendingImageEditReference();
        }
      };
      // Wait for in-progress model load before inferring.
      if (runtime.modelLoading) {
        toast.info("Waiting for model to finish loading…");
        try {
          await waitForModelReady(abortSignal);
        } catch (error) {
          clearSelectedImageEditReference();
          throw error;
        }
      }

      if (!runtime.params.checkpoint) {
        let resolution: Awaited<
          ReturnType<typeof resolveQueuedEmptyLocalModel>
        >;
        try {
          resolution = await resolveQueuedEmptyLocalModel(abortSignal);
        } catch (error) {
          clearSelectedImageEditReference();
          throw error;
        }
        queuedEmptyModelRuntime = resolution.modelRuntime;
        if (!resolution.loaded) {
          // A reported failure already names the model; generic advice buries it.
          if (!resolution.loadFailureReported) {
            toast.error(
              resolution.blockedByTrustRemoteCode
                ? "This model needs custom code approval"
                : "No model loaded",
              {
                description: resolution.blockedByTrustRemoteCode
                  ? "Select it from the top bar to review and approve its custom code, or pick another model."
                  : "Pick a model in the top bar, then retry.",
              },
            );
          }
          clearSelectedImageEditReference();
          throw new Error("Load a model first.");
        }
      }

      // Re-read store after auto-load / model-ready wait.
      const liveRuntime = useChatRuntimeStore.getState();
      runtime = queuedRunSettings
        ? queuedRunSettings.params.checkpoint
          ? { ...liveRuntime, ...queuedRunSettings }
          : {
              ...liveRuntime,
              ...queuedRunSettings,
              params: {
                ...queuedRunSettings.params,
                checkpoint:
                  queuedEmptyModelRuntime?.checkpoint ??
                  liveRuntime.params.checkpoint,
              },
              supportsTools:
                queuedEmptyModelRuntime?.supportsTools ??
                liveRuntime.supportsTools,
              supportsReasoning:
                queuedEmptyModelRuntime?.supportsReasoning ??
                liveRuntime.supportsReasoning,
              reasoningAlwaysOn:
                queuedEmptyModelRuntime?.reasoningAlwaysOn ??
                liveRuntime.reasoningAlwaysOn,
              reasoningStyle:
                queuedEmptyModelRuntime?.reasoningStyle ??
                liveRuntime.reasoningStyle,
              supportsReasoningOff:
                queuedEmptyModelRuntime?.supportsReasoningOff ??
                liveRuntime.supportsReasoningOff,
              reasoningEffortLevels:
                queuedEmptyModelRuntime?.reasoningEffortLevels ??
                liveRuntime.reasoningEffortLevels,
              supportsPreserveThinking:
                queuedEmptyModelRuntime?.supportsPreserveThinking ??
                liveRuntime.supportsPreserveThinking,
              preserveThinking:
                queuedEmptyModelRuntime?.preserveThinking ??
                liveRuntime.preserveThinking,
              ggufContextLength:
                queuedEmptyModelRuntime !== null
                  ? queuedEmptyModelRuntime.ggufContextLength
                  : liveRuntime.ggufContextLength,
              loadedIsMultimodal:
                queuedEmptyModelRuntime?.loadedIsMultimodal ??
                liveRuntime.loadedIsMultimodal,
              models: mergeQueuedModelCapabilities(
                liveRuntime.models,
                queuedEmptyModelRuntime?.checkpoint ?? "",
                queuedEmptyModelRuntime?.modelCapabilities ?? null,
              ),
            }
        : liveRuntime;
      const { params } = runtime;
      await persistResolvedQueuedModel(params.checkpoint);
      const sandboxSessionId = await resolveSandboxSessionId(
        resolvedThreadId,
        readThreadRecord,
      );
      const toolConfirmationScopeId = resolvedThreadId
        ? `${sandboxSessionId || "_default"}:${resolvedThreadId}`
        : sandboxSessionId || "_default";
      const {
        supportsTools,
        toolsEnabled,
        codeToolsEnabled,
        imageToolsEnabled,
        artifactsEnabled,
        mcpEnabledForChat,
        confirmToolCalls,
        bypassPermissions,
        permissionMode,
        webFetchToolsEnabled,
        ragEnabled,
        ragSource,
        ragMode,
        ragTopK,
        ragAutoInject,
        ragAutoInjectMinScore,
      } = runtime;
      // Project sources auto-scope: a chat inside a project retrieves from the
      // project's indexed sources even when the Docs pill is off. The probe is
      // cached, so this is one round trip per project every ~30s at most.
      const ragProjectId = await resolveProjectId(
        resolvedThreadId,
        readThreadRecord,
      );
      const projectRagEnabled = ragProjectId
        ? await projectHasSources(ragProjectId)
        : false;
      const workspaceEnabled = resolvedThreadId
        ? Boolean(await getThreadWorkspace(resolvedThreadId).catch(() => null))
        : false;
      const externalSelection = parseExternalModelId(params.checkpoint);
      const isExternalRequest = externalSelection !== null;
      if (
        isExternalRequest &&
        !useExternalProvidersStore.getState().connectionsEnabled
      ) {
        toast.error("Connections are disabled.", {
          description:
            "Turn on Enable connections in Settings → Connections to use hosted models.",
        });
        clearSelectedImageEditReference();
        throw new Error("Connections disabled.");
      }
      const externalProvider = isExternalRequest
        ? loadExternalProviders().find(
            (provider) => provider.id === externalSelection.providerId,
          )
        : null;

      const externalUsesStudioTools =
        providerModelSupportsStudioTools(
          externalProvider?.providerType,
          externalSelection?.modelId,
        ) === true;

      const supportsStudioToolsForThisTurn = isExternalRequest
        ? externalUsesStudioTools
        : supportsTools;
      const selectedModelSummary = runtime.models.find(
        (model) => model.id === params.checkpoint,
      );
      const externalApiKey =
        externalProvider && !externalProvider.hasApiKey
          ? getExternalProviderApiKey(externalProvider.id).trim()
          : "";

      if (isExternalRequest && !externalProvider) {
        toast.error("Connection not found.", {
          description: "Open Settings → Connections and add it again.",
        });
        clearSelectedImageEditReference();
        throw new Error("Connection not found.");
      }
      // Local providers and custom Gemini bases allow an empty key.
      const externalProviderIsCustom = externalProvider
        ? isCustomProviderType(externalProvider.providerType)
        : false;
      const externalProviderIsGeminiCustomBase = Boolean(
        externalProvider &&
        externalProvider.providerType === "gemini" &&
        isGeminiCustomOpenAICompatBase(externalProvider.baseUrl),
      );
      const externalProviderUsesOAuth =
        externalProvider?.authKind === "chatgpt_oauth";

      if (
        isExternalRequest &&
        !externalApiKey &&
        !externalProvider?.hasApiKey &&
        !externalProviderUsesOAuth &&
        !externalProviderIsCustom &&
        !externalProviderIsGeminiCustomBase
      ) {
        toast.error("Missing API key for selected connection.", {
          description: "Open Settings → Connections and set the API key again.",
        });
        clearSelectedImageEditReference();
        throw new Error("Missing connection API key.");
      }

      // Image-generation flag (OpenAI cloud + Responses-capable model);
      // computed first so Gemini image mode can suppress Search/Code.
      const imageGenerationEnabledForThisTurn = Boolean(
        externalProvider &&
        externalSelection &&
        imageToolsEnabled &&
        providerSupportsBuiltinImageGeneration(
          externalProvider.providerType,
          externalSelection.modelId,
          externalProvider.baseUrl,
        ),
      );
      // Per-model Search/Code allowances live in
      // providerSupportsBuiltin*; this flag just signals image-mode.
      const geminiImageModeForThisTurn =
        externalProvider?.providerType === "gemini" &&
        imageGenerationEnabledForThisTurn;
      const webSearchEnabledForThisTurn = Boolean(
        externalProvider &&
        externalSelection &&
        toolsEnabled &&
        providerSupportsBuiltinWebSearch(
          externalProvider.providerType,
          externalSelection.modelId,
          externalProvider.baseUrl,
        ),
      );
      const codeExecEnabledForThisTurn = Boolean(
        externalProvider &&
        externalSelection &&
        codeToolsEnabled &&
        !geminiImageModeForThisTurn &&
        providerSupportsBuiltinCodeExecution(
          externalProvider.providerType,
          externalSelection.modelId,
          externalProvider.baseUrl,
        ),
      );
      // Fetch pill is independent of Search (Anthropic bills web_fetch
      // separately). Sourced from `webFetchToolsEnabled`; on providers
      // without web_fetch the toggle is forced off in chat-page setState.
      const webFetchEnabledForThisTurn = Boolean(
        externalProvider &&
        webFetchToolsEnabled &&
        providerSupportsBuiltinWebFetch(externalProvider.providerType),
      );
      const providerShipsWebFetch = Boolean(
        externalProvider &&
        providerSupportsBuiltinWebFetch(externalProvider.providerType),
      );
      // Which side of the connection the Code pill runs code on. Hosted
      // `code_execution` and local `python` / `terminal` are two trust
      // boundaries, not two spellings of one feature, so the stored pill keeps
      // meaning the provider's sandbox wherever it meant that before the Studio
      // loop reached these providers. See code-tool-placement.ts.
      const {
        local: studioLocalCodeTools,
        hosted: hostedCodeToolsForThisTurn,
      } = selectCodeToolNames({
        codeToolsEnabled,
        hostedCodeExecutionForThisTurn: codeExecEnabledForThisTurn,
        providerHostsCodeExecution: providerHostsCodeExecution(
          externalProvider?.providerType,
        ),
      });

      if (selectedImageEditReference && !imageGenerationEnabledForThisTurn) {
        clearSelectedImageEditReference();
        toast.error("Image editing is unavailable", {
          description:
            "Select an OpenAI image-generation model, then retry the edit.",
        });
        throw new Error("Image generation edit unavailable.");
      }

      // Drop refused assistant turns + their triggering user prompt;
      // otherwise context re-triggers the classifier.
      const survivingMessages: RunMessage[] = [];
      for (const message of messages) {
        if (isAnthropicRefusalMessage(message)) {
          const last = survivingMessages.at(-1);
          if (last && last.role === "user") {
            survivingMessages.pop();
          }
          continue;
        }
        survivingMessages.push(message);
      }

      // toOpenAIMessages emits assistant tool_calls + role="tool"
      // follow-ups; the backend Gemini translator rebuilds the
      // functionCall / functionResponse parts (with thoughtSignature).
      const outboundMessages = survivingMessages
        .flatMap((message) => toOpenAIMessages(message, !isExternalRequest))
        .filter((message): message is NonNullable<typeof message> =>
          Boolean(message),
        );
      if (selectedImageEditReference) {
        const referenceMessage = toOpenAIImageEditReferenceMessage(
          selectedImageEditReference,
        );
        if (!referenceMessage) {
          clearSelectedImageEditReference();
          toast.error("This generated image cannot be edited", {
            description:
              "The original image reference is missing. Generate the image again, then retry the edit.",
          });
          throw new Error("Generated image edit reference missing.");
        }
        let insertAt = outboundMessages.length;
        for (let i = outboundMessages.length - 1; i >= 0; i -= 1) {
          if (outboundMessages[i]?.role === "user") {
            insertAt = i;
            break;
          }
        }
        // OpenAIChatMessage is a structural superset of SerializedMessage
        // on the role/content axis; cast through unknown since
        // referenceMessage carries no tool_calls (plain assistant turn).
        outboundMessages.splice(
          insertAt,
          0,
          referenceMessage as unknown as SerializedMessage,
        );
      }

      // The run's messages stop at the user turn (this is a sibling branch), so the
      // partial is appended here for the backend to resume.
      const continuation = readContinuationRequest(runConfig);
      if (continuation) {
        outboundMessages.push({
          role: "assistant",
          content: continuation.partial,
        });
        // The original assistant message is not in this branch, so without its
        // signature the model history goes back unsigned.
        attachAssistantThoughtSignature(
          outboundMessages,
          continuation.thoughtSignature,
        );
        // Anthropic 400s when the last message is an assistant turn, so it gets an
        // instruction turn after the partial instead of a prefill.
        if (rejectsAssistantPrefill(externalProvider?.providerType)) {
          outboundMessages.push({
            role: "user",
            content: CONTINUE_INSTRUCTION,
          });
        }
      }

      const combinedSystemPrompt = await resolveChatInstructions(
        resolvedThreadId,
        params.systemPrompt,
        params.systemVariables,
        readThreadRecord,
      );
      if (combinedSystemPrompt) {
        outboundMessages.unshift({
          role: "system",
          content: combinedSystemPrompt,
        });
      }
      let disabledToolGuard: string | null = null;
      const disabledToolGuardProviderType = externalProvider?.providerType;
      if (
        disabledToolGuardProviderType === "anthropic" ||
        disabledToolGuardProviderType === "openai"
      ) {
        const webLabel = providerShipsWebFetch
          ? "web search or web fetch"
          : "web search";
        // Treat search and fetch as one "any web tool" axis so the guard
        // only warns when neither pill is on; checking webSearch alone
        // mis-fired when only Fetch was on and suppressed web_fetch.
        const anyWebEnabledForThisTurn =
          webSearchEnabledForThisTurn || webFetchEnabledForThisTurn;
        if (
          !anyWebEnabledForThisTurn &&
          !codeExecEnabledForThisTurn &&
          !imageGenerationEnabledForThisTurn
        ) {
          disabledToolGuard =
            `You do not have ${webLabel}, code execution, or image generation tools in this conversation. ` +
            "Answer from your own knowledge. " +
            "If a request genuinely requires tool use, live data fetch, running code, or image generation, " +
            "inform the user that you do not have access to these capabilities. " +
            "Do not return tool-call syntax inside your response.";
        } else if (!anyWebEnabledForThisTurn && !codeExecEnabledForThisTurn) {
          disabledToolGuard =
            `You do not have ${webLabel} or code execution tools in this conversation. ` +
            "You may still use image generation tools when they are available and useful. " +
            "If a request genuinely requires live data fetch or running code, " +
            "inform the user that you do not have access to these capabilities. " +
            "Do not return tool-call syntax inside your response.";
        } else if (!anyWebEnabledForThisTurn) {
          const availableTools = [
            codeExecEnabledForThisTurn ? "code execution" : null,
            imageGenerationEnabledForThisTurn ? "image generation" : null,
          ].filter(Boolean);
          disabledToolGuard =
            `You do not have ${webLabel} tools in this conversation. ` +
            (availableTools.length > 0
              ? `You may still use ${availableTools.join(" and ")} tools when they are available and useful. `
              : "") +
            "If a request genuinely requires live data fetch or web search tool use, " +
            "inform the user that you do not have access to these capabilities. " +
            "Do not return tool-call syntax inside your response.";
        } else if (!codeExecEnabledForThisTurn) {
          const availableTools = [
            webLabel,
            imageGenerationEnabledForThisTurn ? "image generation" : null,
          ].filter(Boolean);
          disabledToolGuard =
            "You do not have code execution tools in this conversation. " +
            `You may still use ${availableTools.join(" and ")} tools when they are available and useful. ` +
            "If a request genuinely requires running code or code execution tool use, " +
            "inform the user that you do not have access to these capabilities. " +
            "Do not return tool-call syntax inside your response.";
        }
      }
      type OutboundMessage = (typeof outboundMessages)[number];
      function addSystemInstruction(
        targetMessages: OutboundMessage[],
        text: string | null,
      ): void {
        if (!text) return;
        const firstMessage = targetMessages[0];
        if (firstMessage?.role === "system") {
          if (typeof firstMessage.content === "string") {
            targetMessages[0] = {
              ...firstMessage,
              content: `${firstMessage.content}\n\n${text}`,
            };
          } else {
            targetMessages[0] = {
              ...firstMessage,
              content: [
                ...(Array.isArray(firstMessage.content)
                  ? firstMessage.content
                  : []),
                { type: "text", text: `\n\n${text}` },
              ],
            };
          }
          return;
        }
        targetMessages.unshift({ role: "system", content: text });
      }

      // Scan post-prune history so a refused user turn's image/audio
      // doesn't gate or mis-attribute the next turn.
      const imageBase64 = findLatestUserImageBase64(survivingMessages);
      // A continuation resumes the turn as it was sent: picking up a clip staged in the
      // composer since would switch it onto the audio path, which cannot be continued.
      const audioBase64 = findLatestUserAudioBase64(
        survivingMessages,
        !queuedRunSettings && !continuation,
      );
      const videoBase64 = findLatestUserVideoBase64(survivingMessages);
      const hasOutboundImage = Boolean(imageBase64);

      // Keep render_html local-only and mirror the backend image-turn gate.
      // Canvas is independent of Search/Code: a local tool-capable model
      // with Canvas on exposes render_html even with no other pills active.
      const renderHtmlToolEnabledForThisTurn = Boolean(
        !isExternalRequest &&
        supportsTools &&
        artifactsEnabled &&
        !hasOutboundImage,
      );
      const artifactInstruction = artifactsEnabled
        ? renderHtmlToolEnabledForThisTurn
          ? CANVAS_TOOL_INSTRUCTION
          : CANVAS_FALLBACK_INSTRUCTION
        : null;
      const effectiveDisabledToolGuard =
        disabledToolGuard && artifactsEnabled
          ? `${disabledToolGuard} HTML, CSS, or JavaScript canvas requests can still be answered by following the canvas fallback instruction.`
          : disabledToolGuard;
      addSystemInstruction(outboundMessages, effectiveDisabledToolGuard);
      addSystemInstruction(outboundMessages, artifactInstruction);

      // Block when ANY image is in the outbound payload (current or prior
      // turns) and the loaded model can't process images. Once a chat
      // contains an image, a non-vision model can't respond — the user
      // starts a new chat to switch models.
      if (imageBase64) {
        const activeModel = runtime.models.find(
          (m) => m.id === params.checkpoint,
        );
        const imageGateReason = getImageInputUnavailableReason({
          activeModel,
          isExternalModel: isExternalRequest,
          externalSupportsVision: providerModelSupportsVision(
            externalProvider?.providerType,
            externalSelection?.modelId,
          ),
          externalModelLabel: externalSelection?.modelId ?? null,
          loadedIsMultimodal: runtime.loadedIsMultimodal,
          modelLoaded: !!params.checkpoint && !runtime.modelLoading,
          loadError: runtime.lastModelLoadError,
          mmprojFallbackReason: runtime.mmprojFallbackReason,
        });
        if (imageGateReason) {
          toast.error(imageGateReason);
          // Flip the per-thread running flag on→off so compare-mode
          // waitForRunEnd resolves instead of hanging: this gate fires
          // before the streaming path's setThreadRunning(true).
          const gatedThreadKey = resolvedThreadId || "__default";
          // Own token: siblings share "__default", so an ownerless clear would drop their
          // entries while they are still generating.
          const gateOwner = () => {};
          runtime.setThreadRunning(gatedThreadKey, true, { owner: gateOwner });
          runtime.setThreadRunning(gatedThreadKey, false, { owner: gateOwner });
          clearSelectedImageEditReference();
          throw new Error(imageGateReason);
        }
      }
      // Clear pending audio from store after extracting (consumed on send).
      if (audioBase64 && !queuedRunSettings) {
        const audioName = runtime.pendingAudioName;
        if (audioName) {
          const lastUserMsg = [...survivingMessages]
            .reverse()
            .find((m) => m.role === "user");
          if (lastUserMsg) sentAudioNames.set(lastUserMsg.id, audioName);
        }
        runtime.clearPendingAudio();
      }
      const useAdapter = await resolveUseAdapter(
        resolvedThreadId,
        options,
        readThreadRecord,
      );

      const threadKey = resolvedThreadId || "__default";
      // A first turn files its handles under "__default"; autosave then assigns a real id and
      // adoptDefaultThreadRun re-keys them mid-run. Resolve per use so later writes and the
      // final clear follow the run instead of stranding entries behind.
      const liveThreadKey = (owner: () => void) =>
        threadKey === "__default"
          ? useChatRuntimeStore.getState().runKeyForOwner(threadKey, owner)
          : threadKey;

      // Per-run token so a delayed stop POST can't match the next run.
      const cancelId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

      // Per-run abort, chained to assistant-ui's signal. cancelByThreadId only holds the visible
      // thread's cancelRun(), so this controller is the only way to end a backgrounded chat's
      // request; the cancel POST below reaches llama-server only.
      const runAbort = new AbortController();
      const runSignal = runAbort.signal;
      const forwardAbort = () => runAbort.abort(abortSignal.reason);
      // Declared here, not at its registration below: it doubles as this run's identity token
      // on the per-thread maps (see registerThreadServerCancel).
      const serverCancel = () => runAbort.abort();
      if (abortSignal.aborted) {
        forwardAbort();
      } else {
        abortSignal.addEventListener("abort", forwardAbort, { once: true });
      }

      // ── Audio model path (non-streaming) ─────────────────────
      const activeModel = runtime.models.find(
        (m) => m.id === params.checkpoint,
      );
      if (activeModel?.isAudio && !activeModel?.hasAudioInput) {
        const audioCancel = () => runAbort.abort();
        runtime.registerThreadServerCancel(threadKey, audioCancel);
        releaseCurrentPreStreamRun();
        runtime.setThreadRunning(threadKey, true, { owner: audioCancel });
        try {
          yield {
            content: [{ type: "text" as const, text: "Generating audio..." }],
          };

          const result = await generateAudio(
            {
              model: params.checkpoint,
              messages: outboundMessages,
              // Same run in both registries: without it the backend files this under no
              // thread, and the stop-chats prompt counts the named local run and the
              // unnamed backend one as two.
              ...(resolvedThreadId ? { thread_id: resolvedThreadId } : {}),
              stream: false,
              temperature: params.temperature,
              top_p: params.topP,
              max_tokens: params.maxTokens,
              top_k: params.topK,
              min_p: params.minP,
              repetition_penalty: params.repetitionPenalty,
              presence_penalty: params.presencePenalty,
              ...(useAdapter === undefined ? {} : { use_adapter: useAdapter }),
            },
            runSignal,
          );

          const audioUrl = `data:audio/wav;base64,${result.audio.data}`;
          yield {
            content: [
              {
                type: "text" as const,
                text: `<audio-player src="${audioUrl}" />`,
              },
            ],
          };
        } catch (err) {
          if (!runSignal.aborted) {
            toast.error("Audio generation failed", {
              description: err instanceof Error ? err.message : "Unknown error",
            });
          }
          throw err;
        } finally {
          abortSignal.removeEventListener("abort", forwardAbort);
          const audioKey = liveThreadKey(audioCancel);
          runtime.setThreadRunning(audioKey, false, { owner: audioCancel });
          runtime.clearThreadServerCancel(audioKey, audioCancel);
        }
        return;
      }

      let waitingFirstChunk = true;
      let firstTokenSettled = false;
      const streamStartTime = Date.now();
      let responseModelId = externalSelection?.modelId ?? params.checkpoint;
      let firstTokenTime: number | undefined;
      let totalChunks = 0;
      let resolveFirstToken: (() => void) | null = null;
      let rejectFirstToken: ((err: unknown) => void) | null = null;
      const firstTokenPromise = new Promise<void>((resolve, reject) => {
        resolveFirstToken = resolve;
        rejectFirstToken = reject;
      });
      // Avoid unhandled rejections if toast.promise never attached.
      void firstTokenPromise.catch(() => {});

      function settleFirstTokenOk(): void {
        if (firstTokenSettled) return;
        firstTokenSettled = true;
        resolveFirstToken?.();
      }

      function settleFirstTokenErr(err: unknown): void {
        if (firstTokenSettled) return;
        firstTokenSettled = true;
        rejectFirstToken?.(err);
      }

      const warmupDelayMs = 450;
      const warmupTimer = setTimeout(() => {
        if (!waitingFirstChunk) return;
        if (runSignal.aborted) return;
        runtime.setGeneratingStatus("waiting");
      }, warmupDelayMs);
      // Flagged local/external so the model-swap gate only counts the chats a reload ends; the
      // backend leaves external-provider runs out of active_generations for the same reason.
      releaseCurrentPreStreamRun();
      runtime.setThreadRunning(threadKey, true, {
        local: !isExternalRequest,
        owner: serverCancel,
      });
      // Seeded with the partial so the bubble reads as one response; the boundary lets
      // the finalizers re-derive the new output and repair a repeat/restart.
      let cumulativeText = continuation ? continuation.partial : "";
      // Reading `cumulativeText` at all costs O(reply): each `+=` builds a cons
      // string and the first read of it flattens the whole reply, so one
      // charCodeAt per arrival is as expensive as a scan. Everything below that
      // used to consult the buffer once per arrival is fed the delta instead,
      // through `appendCumulative`, and the buffer is only read where the reply
      // is actually published.
      //
      // Answers "does the text end inside <think>" from what each arrival adds.
      const thinkTags = createThinkTagTracker();
      // Answers "could the trailing ${...} strip cut anything" the same way, so
      // the strip itself runs only on an arrival that ends in a fragment.
      const placeholderWatch = createTrailingPlaceholderWatch();
      // What the cap is measured against: only grows, unlike cumulativeText,
      // and counts tool-argument deltas, which never reach it.
      let streamedChars = 0;
      // Whether this run appended reply text of its own. A continuation is
      // SEEDED with the previous run's partial, and that partial is the middle
      // of a reply someone is still writing rather than the end of a finished
      // one, so a run that adds nothing to it must not have its tail trimmed.
      // Read by the trailing-fragment strip after the stream.
      let producedReplyText = false;
      const continuationPartial = continuation?.partial ?? "";
      // Local backends (and a self-hosted vLLM / llama-server, which get the flags)
      // resume at the exact token boundary, so their output is already the rest of the
      // answer and trimming could only delete words the model meant to write. The repair
      // is for providers that may ignore the prefill and repeat or restart.
      const repairContinuation =
        isExternalRequest && !resumesExactly(externalProvider?.providerType);
      const mergeContinuation = (text: string): string =>
        continuationPartial && repairContinuation
          ? joinContinuation(
              continuationPartial,
              text.slice(continuationPartial.length),
            )
          : text;
      // The parse of everything already streamed, extended by each delta.
      // `mergeContinuation` can rewrite the prefix it is handed, and a rewritten
      // prefix is exactly what an extend-only parse cannot follow, so that one
      // path keeps reparsing the whole reply as before. It is a continuation of
      // an external provider that may repeat itself, not the streaming case.
      const segmentedText = createSegmentedAssistantText({
        trustAppends: !(continuationPartial && repairContinuation),
      });
      // The single place `cumulativeText` grows, so everything derived from it
      // sees the same characters in the same order.
      const appendCumulative = (text: string): void => {
        if (!text) {
          return;
        }
        cumulativeText += text;
        segmentedText.appendText(text);
        thinkTags.append(text);
        placeholderWatch.append(text);
      };
      // A resumed turn starts with the partial already in the buffer. One read
      // of it, once per turn, is what puts the trackers in step with it.
      if (cumulativeText) {
        thinkTags.append(cumulativeText);
        placeholderWatch.append(cumulativeText);
      }
      // Every streamed yield carries the repaired text, not just the terminal ones:
      // assistant-ui drops whatever is yielded after an abort, so on Stop the last
      // STREAMED yield is what gets saved.
      let codexReasoningLedger: CodexReasoningLedger = { byToolCall: {} };
      let codexRoundToolCallIds: string[] = [];

      const liveAssistantContent = () =>
        buildAssistantContent(mergeContinuation(cumulativeText));
      // Provisional reason on every streamed yield: an abort skips the terminal yields
      // and a reload rebuilds messages as "complete", so a stopped turn would otherwise
      // lose why it was short. The terminal yields overwrite or clear it.
      const liveCustom = () => ({
        ...reasoningDurationTracker.metadata(),
        openaiCodexReasoning: codexReasoningLedger,
        incomplete: { reason: "cancelled" as const },
      });
      // Why this turn stopped early. Drives the Continue affordance.
      let incompleteReason: IncompleteReason | null = null;
      // MLX reports finish_reason "stop" even at the cap, so an exhausted budget is its
      // only truncation signal. Everyone else reports "length" honestly.
      let requestedMaxTokens: number | undefined;
      const isMlxRequest = !isExternalRequest && activeModel?.isMlx === true;
      const reasoningDurationTracker = createReasoningDurationTracker();
      // True while wrapping a `delta.reasoning_content` stream in
      // <think>...</think> for parseAssistantContent. Lives outside the
      // SSE loop because the close tag fires when content arrives.
      let reasoningContentOpen = false;
      type ToolCallProvenance = {
        source?: string;
        healed?: boolean;
        forced?: boolean;
        provisional?: boolean;
        duplicate?: boolean;
        reason?: string;
        mcp_server?: string;
        [key: string]: unknown;
      };
      type PositionedToolCallPart = ToolCallMessagePart & {
        textCursor?: number;
        _delta_index?: number;
        _has_stable_id?: boolean;
        extra_content?: unknown;
        provenance?: ToolCallProvenance;
      };
      // Tool call parts, cumulative; result lands on tool_end.
      const toolCallParts: PositionedToolCallPart[] = [];
      // Raw tool_args accumulator per card: the backend forwards arguments while
      // the model is still WRITING them, and the partial parse below feeds the
      // card's args so the code renders live.
      const liveArgsTextById = new Map<string, string>();
      // Backend tool ids ("call_0", ...) restart every response, so a bare id as
      // store key lets a later turn's stream overwrite the preserved output an
      // earlier still-mounted finished card reads (the tool_start stale-clear
      // only guards the forward direction). Mint one per-run-unique part id per
      // backend id (confirmation ids already synthesize their own) so each card
      // key is unique; every tool_start/output/args/end resolves the same id via
      // this map, dropped at tool_end.
      const toolPartIdByBackendId = new Map<string, string>();
      const resolveToolPartId = (backendToolCallId: string): string =>
        resolveToolCallPartId(
          toolPartIdByBackendId,
          backendToolCallId,
          toolConfirmationIdsByBackendId.get(backendToolCallId),
          toolCallParts[toolCallParts.length - 1]?.toolCallId ?? "",
          () => `${backendToolCallId}:${crypto.randomUUID()}`,
        );
      // Latest Gemini text-part thoughtSignature; pinned onto the final
      // text MessagePart so next-turn replay carries it.
      let latestTextThoughtSignature: string | undefined;
      const pinTextThoughtSignature = <T extends { type: string }>(
        parts: T[],
      ): T[] => {
        if (!latestTextThoughtSignature || parts.length === 0) return parts;
        for (let i = parts.length - 1; i >= 0; i -= 1) {
          if (parts[i].type === "text") {
            parts[i] = {
              ...parts[i],
              _google_thought_signature: latestTextThoughtSignature,
            } as T;
            break;
          }
        }
        return parts;
      };
      const buildAssistantContent = (rawText: string) => {
        const positionedTools = toolCallParts
          .map((part, index) => {
            const cursor = (part as PositionedToolCallPart).textCursor;
            return {
              part,
              index,
              cursor:
                typeof cursor === "number" && Number.isFinite(cursor)
                  ? Math.min(Math.max(cursor, 0), rawText.length)
                  : 0,
            };
          })
          .sort((a, b) => a.cursor - b.cursor || a.index - b.index);

        // The distinct cursors, which are where the text is cut into runs. The
        // runs before them never change again once a later one exists, so only
        // the last one is still growing.
        const boundaries: number[] = [];
        for (const positioned of positionedTools) {
          if (boundaries[boundaries.length - 1] !== positioned.cursor) {
            boundaries.push(positioned.cursor);
          }
        }
        const runs = segmentedText.runs(rawText, boundaries);

        const assembled: Array<
          ReturnType<typeof parseAssistantContent>[number] | ToolCallMessagePart
        > = [];
        let toolIndex = 0;

        for (let index = 0; index < boundaries.length; index += 1) {
          assembled.push(...runs[index]);
          const cursor = boundaries[index];
          while (
            toolIndex < positionedTools.length &&
            positionedTools[toolIndex].cursor === cursor
          ) {
            assembled.push(positionedTools[toolIndex].part);
            toolIndex += 1;
          }
        }
        assembled.push(...runs[boundaries.length]);

        return pinTextThoughtSignature(assembled);
      };

      // Yielded before the request starts: an abort during load skips the partial-content
      // yield below, saving an empty message and stranding the resumed text.
      if (continuation) {
        yield {
          content: buildAssistantContent(cumulativeText),
          metadata: { custom: liveCustom() },
        };
      }

      const parseToolProvenance = (
        value: unknown,
      ): ToolCallProvenance | undefined => {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
          return undefined;
        }
        return { ...(value as Record<string, unknown>) } as ToolCallProvenance;
      };
      const mergeToolProvenance = (
        existing: ToolCallProvenance | undefined,
        incoming: ToolCallProvenance | undefined,
      ): ToolCallProvenance | undefined => {
        if (!incoming) return existing;
        if (!existing) return incoming;
        const merged: ToolCallProvenance = { ...existing, ...incoming };
        for (const key of [
          "healed",
          "forced",
          "provisional",
          "duplicate",
        ] as const) {
          if (existing[key] === true || incoming[key] === true) {
            merged[key] = true;
          }
        }
        return merged;
      };
      const closeReasoningContent = () => {
        if (reasoningContentOpen) {
          appendCumulative("</think>");
          reasoningContentOpen = false;
        }
        reasoningDurationTracker.finishGroup();
      };
      // Anthropic document_citations payload, converted to Sources-panel
      // parts at end-of-stream so inline [N] markers have matching entries.
      const documentCitationParts: Array<{
        type: "source";
        sourceType: "url";
        id: string;
        url: string;
        title: string;
        metadata?: { description: string };
      }> = [];
      // Latched on the `anthropic_refusal` tool event; stamped onto final
      // assistant metadata as `custom.anthropicRefusal` to drive the
      // history-prune above.
      let anthropicRefusalSeen = false;
      let serverMetadata: {
        usage?: ServerUsage;
        timings?: ServerTimings;
      } | null = null;

      // Colab-style proxies can swallow fetch aborts, so also POST
      // /inference/cancel explicitly on abort.
      const onAbortCancel = () => {
        // assistant-ui aborts with detach=true when a runtime unmounts and detach=false for an
        // explicit Stop. Only a real Stop cancels the backend run; runSignal forwards the reason.
        if ((runSignal.reason as { detach?: boolean } | undefined)?.detach) {
          return;
        }
        const body: Record<string, string> = { cancel_id: cancelId };
        if (sandboxSessionId) body.session_id = sandboxSessionId;
        // Plain fetch, not authFetch: authFetch redirects to login on
        // 401, which would kick the user out mid-stop.
        const token = getAuthToken();
        // Use apiUrl so the cancel POST reaches the right origin in Tauri
        // production builds (webview origin != backend at 127.0.0.1:<port>).
        // Browser/dev builds get the empty base, so the path is unchanged.
        void fetch(apiUrl("/api/inference/cancel"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
          keepalive: true,
        }).catch(() => {});
      };

      // Stop handle for when this conversation is not the visible one, which cancelByThreadId
      // cannot reach. Aborting this run's own controller closes just its request, and the
      // listener above posts its cancel_id so llama-server stops decoding too. For an
      // external provider the abort is the stop, since its cancel_id is never registered.
      runtime.registerThreadServerCancel(threadKey, serverCancel);
      try {
        if (runSignal.aborted) {
          onAbortCancel();
        } else {
          runSignal.addEventListener("abort", onAbortCancel, { once: true });
        }

        const {
          supportsReasoning,
          reasoningEnabled,
          reasoningStyle,
          reasoningEffort,
          reasoningEffortLevels,
          supportsPreserveThinking,
          preserveThinking,
        } = runtime;
        const externalBackendProviderType = toExternalBackendProviderType(
          externalProvider?.providerType,
        );
        const buildResponseDetails = (
          finishedAt: number,
        ): ResponseDetailsMetadata => ({
          modelId: params.checkpoint,
          modelLabel:
            (isExternalRequest || responseModelId !== params.checkpoint
              ? responseModelId
              : selectedModelSummary?.name || responseModelId) ||
            params.checkpoint ||
            "Unknown model",
          responseModelId:
            responseModelId || externalSelection?.modelId || params.checkpoint,
          ...(externalProvider?.id ? { providerId: externalProvider.id } : {}),
          providerName:
            externalProvider?.name ??
            (isExternalRequest ? "External provider" : "Local model"),
          providerType: externalProvider?.providerType ?? "local",
          startedAt: streamStartTime,
          finishedAt,
          durationMs: finishedAt - streamStartTime,
          ...(sandboxSessionId ? { sessionId: sandboxSessionId } : {}),
          cancelId,
          toolCalls: Array.from(
            new Set(
              toolCallParts
                .map((part) => part.toolName)
                .filter(
                  (toolName): toolName is string =>
                    typeof toolName === "string" && toolName.length > 0,
                ),
            ),
          ),
          tools: {
            search:
              webSearchEnabledForThisTurn ||
              (!isExternalRequest && supportsTools && toolsEnabled),
            fetch: webFetchEnabledForThisTurn,
            code:
              codeExecEnabledForThisTurn ||
              (!isExternalRequest && supportsTools && codeToolsEnabled),
            images: imageGenerationEnabledForThisTurn,
            mcp: supportsStudioToolsForThisTurn && mcpEnabledForChat,
            docs:
              supportsStudioToolsForThisTurn &&
              (ragEnabled || projectRagEnabled),
            artifacts: renderHtmlToolEnabledForThisTurn,
            confirmToolCalls,
            bypassPermissions,
            permissionMode,
          },
        });
        const externalCapabilities = getProviderCapabilities(
          externalProvider?.providerType,
        );
        const externalReasoningCaps: ReturnType<
          typeof getExternalReasoningCapabilities
        > =
          externalSelection && externalProvider
            ? getExternalReasoningCapabilities(
                externalProvider.providerType,
                externalSelection.modelId,
                {
                  isReasoningProvider:
                    externalProvider.isReasoningModel === true,
                  baseUrl: externalProvider.baseUrl ?? null,
                },
              )
            : {
                supportsReasoning,
                reasoningStyle,
                reasoningAlwaysOn: false,
                supportsReasoningOff: false,
                reasoningEffortLevels: ["low", "medium", "high"] as const,
              };
        type RequestReasoningEffort = Extract<
          NonNullable<OpenAIChatCompletionsRequest["reasoning_effort"]>,
          "none" | "minimal" | "low" | "medium" | "high" | "max" | "xhigh"
        >;
        const fallbackExternalEffort = (externalReasoningCaps
          .reasoningEffortLevels[0] ?? "low") as RequestReasoningEffort;
        const selectedExternalEffort: RequestReasoningEffort =
          clampReasoningEffortToLevels(
            reasoningEffort,
            externalReasoningCaps.reasoningEffortLevels,
          ) as RequestReasoningEffort;
        // Clamp to the loaded local model's advertised levels so a stale value
        // (e.g. "max" carried over from an external model, or a level this model
        // lacks) becomes one the backend will honor instead of being dropped:
        // gpt-oss-style reasoning_effort gets low|medium|high, GLM-style
        // enable_thinking_effort gets high|max.
        const localReasoningEffort = clampReasoningEffortToLevels(
          reasoningEffort,
          reasoningEffortLevels,
        );
        const externalReasoningEnabled =
          !externalReasoningCaps.supportsReasoningOff ? true : reasoningEnabled;
        const buildRequestPayload = async (
          forceRefreshPublicKey = false,
        ): Promise<OpenAIChatCompletionsRequest> => {
          if (externalSelection && externalProvider) {
            // Per-thread container reuse; empty/undefined falls back to
            // container_auto. Anthropic uses anthropicCodeExecContainerId.
            let openaiCodeExecContainerId: string | null = null;
            let anthropicCodeExecContainerId: string | null = null;
            if (codeExecEnabledForThisTurn && resolvedThreadId) {
              try {
                // Container selection can change while this run waits for model loading,
                // so read it at payload construction instead of reusing run-start metadata.
                const thread = await getStoredChatThread(resolvedThreadId);
                openaiCodeExecContainerId =
                  thread?.openaiCodeExecContainerId ?? null;
                anthropicCodeExecContainerId =
                  thread?.anthropicCodeExecContainerId ?? null;
              } catch {
                openaiCodeExecContainerId = null;
                anthropicCodeExecContainerId = null;
              }
              // Pre-send container validation (OpenAI). Stale ids drop
              // silently and fall through to lazy-create; on list-call
              // failure, rely on the backend's retry path.
              let activeContainerIds: Set<string> | null = null;
              if (externalProvider.providerType === "openai") {
                try {
                  const list = await listOpenAIContainers({
                    providerId: externalProvider.id,

                    apiKey: externalApiKey,
                    baseUrl: externalProvider.baseUrl || null,
                  });
                  activeContainerIds = new Set(list.map((c) => c.id));
                } catch {
                  activeContainerIds = null;
                }
                if (
                  activeContainerIds &&
                  openaiCodeExecContainerId &&
                  !activeContainerIds.has(openaiCodeExecContainerId)
                ) {
                  void updateStoredChatThreadEventually(resolvedThreadId, {
                    openaiCodeExecContainerId: null,
                  }).catch(() => {});
                  openaiCodeExecContainerId = null;
                }
              }
              // Cross-thread inheritance: reuse the most recent container
              // from any other thread; opt-out via the picker.
              if (
                !openaiCodeExecContainerId &&
                externalProvider.providerType === "openai"
              ) {
                try {
                  const others = await listStoredChatThreads({
                    includeArchived: true,
                  });
                  for (const t of others) {
                    if (t.id === resolvedThreadId) continue;
                    if (!t.openaiCodeExecContainerId) continue;
                    // Skip ids not in active set; null the source thread so
                    // the next pass doesn't re-pick a dead id.
                    if (
                      activeContainerIds &&
                      !activeContainerIds.has(t.openaiCodeExecContainerId)
                    ) {
                      void updateStoredChatThreadEventually(t.id, {
                        openaiCodeExecContainerId: null,
                      }).catch(() => {});
                      continue;
                    }
                    openaiCodeExecContainerId = t.openaiCodeExecContainerId;
                    void updateStoredChatThreadEventually(resolvedThreadId, {
                      openaiCodeExecContainerId,
                    }).catch(() => {});
                    break;
                  }
                } catch {
                  /* fall through to lazy-create below */
                }
              }
              // Pre-create our own container (vs container_auto) so it shows
              // in the picker with a friendly name and the configured TTL.
              // Falls back to container_auto on failure.
              if (
                !openaiCodeExecContainerId &&
                externalProvider.providerType === "openai"
              ) {
                const ttl = externalProvider.openaiContainerTtlMinutes;
                const ttlToUse = typeof ttl === "number" && ttl >= 1 ? ttl : 20;
                try {
                  const created = await createOpenAIContainer(
                    {
                      providerId: externalProvider.id,

                      apiKey: externalApiKey,
                      baseUrl: externalProvider.baseUrl || null,
                    },
                    {
                      // Friendly English-word name so the container is
                      // human-readable in the picker (e.g. "kestrel-3f9c")
                      // instead of a thread-id slug or blank default.
                      name: pickFriendlyContainerName(),
                      ttlMinutes: ttlToUse,
                    },
                  );
                  openaiCodeExecContainerId = created.id;
                  void updateStoredChatThreadEventually(resolvedThreadId, {
                    openaiCodeExecContainerId: created.id,
                  }).catch(() => {});
                } catch {
                  // Fall back to the backend's container_auto path on
                  // failure — keeps the chat moving (the auto-created
                  // container is unnamed); the next turn can retry.
                  openaiCodeExecContainerId = null;
                }
              }
            }
            return {
              model: externalSelection.modelId,
              messages: outboundMessages,
              stream: true,
              // Never forwarded upstream (the proxy sends an explicit field list);
              // the trailing assistant turn is what asks a provider to continue.
              ...(continuation ? { continue_final_message: true } : {}),
              // Reasoning-class models (OpenAI gpt-5.x / o3) reject
              // temperature and top_p; forward only when supported.
              ...(externalCapabilities?.temperature !== false
                ? { temperature: params.temperature }
                : {}),
              ...(externalCapabilities?.topP !== false
                ? { top_p: params.topP }
                : {}),
              // Floor at the provider's documented min (Kimi thinking
              // needs >=16k); clamp at the per-model max.
              max_tokens: Math.min(
                Math.max(
                  params.maxTokens,
                  getExternalMinOutputTokens(externalProvider?.providerType),
                ),
                getExternalMaxOutputTokens(
                  externalProvider?.providerType,
                  externalSelection?.modelId,
                  externalProvider?.maxOutputTokens,
                ),
              ),

              ...(externalUsesStudioTools && resolvedThreadId
                ? { thread_id: resolvedThreadId }
                : {}),
              // Forward only sampling knobs the provider accepts.
              ...(externalCapabilities?.topK ? { top_k: params.topK } : {}),
              ...(externalCapabilities?.presencePenalty
                ? { presence_penalty: params.presencePenalty }
                : {}),
              // Studio executes the calls for any provider that advertises the
              // capability. Providers that do not keep their provider-hosted
              // tool envelope in the branch below.
              // studioLocalCodeTools, not codeToolsEnabled: a Code pill that
              // resolved to the provider's own sandbox is a hosted request and
              // belongs in the branch below. Sending this body for it would
              // attach permission_mode to a passthrough turn, which the route
              // answers with a 400.
              ...(supportsStudioToolsForThisTurn &&
              (toolsEnabled ||
                studioLocalCodeTools.length > 0 ||
                mcpEnabledForChat ||
                ragEnabled ||
                projectRagEnabled ||
                workspaceEnabled)
                ? {
                    enable_tools: true,
                    enabled_tools: [
                      ...(ragEnabled || projectRagEnabled
                        ? ["search_knowledge_base"]
                        : []),
                      ...(toolsEnabled ? ["web_search"] : []),
                      ...studioLocalCodeTools,
                      ...(workspaceEnabled ? WORKSPACE_TOOL_NAMES : []),
                      // Hosted tools Studio has no local stand-in for. Their
                      // pills stay lit whether or not a Studio tool is on, so
                      // listing only the local names here would silently drop
                      // Images (or Fetch) the moment Search, Code, MCP or a
                      // project's automatic RAG selected this branch. Search
                      // deliberately does not ride along: that is the one
                      // Studio runs itself just above. Code rides along only
                      // when it resolved to the provider's sandbox, which is
                      // mutually exclusive with the local names above.
                      ...(imageGenerationEnabledForThisTurn
                        ? ["image_generation"]
                        : []),
                      ...(webFetchEnabledForThisTurn ? ["web_fetch"] : []),
                      ...hostedCodeToolsForThisTurn,
                    ],
                    mcp_enabled: mcpEnabledForChat,
                    permission_mode: permissionMode,
                    ...(permissionMode === "auto"
                      ? {}
                      : { confirm_tool_calls: permissionMode === "ask" }),
                    bypass_permissions: bypassPermissions,
                    max_tool_calls_per_message: runtime.maxToolCallsPerMessage,
                    tool_call_timeout:
                      runtime.toolCallTimeout >= 9999
                        ? 9999
                        : runtime.toolCallTimeout * 60,
                    // Self-hosted models often write a call as text rather than
                    // emitting structured tool_calls, so the external loop heals
                    // like the local one. Omitting this left the backend on its
                    // process default, which is not what the user set in Settings.
                    // nudge_tool_calls is deliberately absent: it is the
                    // non-streaming client-tool passthrough retry, which this
                    // streaming server-side loop does not perform.
                    auto_heal_tool_calls: runtime.autoHealToolCalls,
                    // This branch runs the tools here, so say so by name:
                    // enabled_tools ["web_search"] is byte-identical to what an
                    // older bundle sent meaning hosted search, so without this
                    // flag Search silently stayed hosted.
                    run_tools_locally: true,
                    ...(sandboxSessionId
                      ? { session_id: sandboxSessionId }
                      : {}),
                    ...(resolvedThreadId
                      ? { thread_id: resolvedThreadId }
                      : {}),
                    ...(ragEnabled || projectRagEnabled
                      ? {
                          rag_scope: {
                            ...(ragEnabled && ragSource.type === "kb"
                              ? { kb_id: ragSource.kbId }
                              : {
                                  ...(ragEnabled && resolvedThreadId
                                    ? { thread_id: resolvedThreadId }
                                    : {}),
                                  ...(projectRagEnabled && ragProjectId
                                    ? { project_id: ragProjectId }
                                    : {}),
                                }),
                            default_top_k: ragTopK,
                            mode: ragMode,
                            autoinject: resolveAutoInject(
                              ragAutoInject,
                              params.checkpoint,
                            ),
                            autoinject_min_score: ragAutoInjectMinScore,
                            ...(ragAutoInject === "off"
                              ? { whole_doc: false }
                              : {}),
                            context_length:
                              runtime.ggufContextLength ??
                              params.maxSeqLength ??
                              undefined,
                          },
                        }
                      : {}),
                  }
                : webSearchEnabledForThisTurn ||
                    webFetchEnabledForThisTurn ||
                    codeExecEnabledForThisTurn ||
                    imageGenerationEnabledForThisTurn
                  ? {
                      enable_tools: true,
                      enabled_tools: [
                        ...(webSearchEnabledForThisTurn ? ["web_search"] : []),
                        ...(webFetchEnabledForThisTurn ? ["web_fetch"] : []),
                        ...(codeExecEnabledForThisTurn
                          ? ["code_execution"]
                          : []),
                        ...(imageGenerationEnabledForThisTurn
                          ? ["image_generation"]
                          : []),
                      ],
                    }
                  : // Explicit false: an omitted field falls back to the
                    // server's tools-on default, which would bill provider
                    // server tools.
                    { enable_tools: false }),
              provider_id: externalProvider.id,
              provider_type: externalBackendProviderType,
              external_model: externalSelection.modelId,
              ...(externalApiKey
                ? {
                    encrypted_api_key: await encryptProviderApiKey(
                      externalApiKey,
                      forceRefreshPublicKey,
                    ),
                  }
                : {}),
              provider_base_url: externalProvider.baseUrl || null,
              ...(openaiCodeExecContainerId
                ? {
                    openai_code_exec_container_id: openaiCodeExecContainerId,
                  }
                : {}),
              ...(anthropicCodeExecContainerId
                ? {
                    anthropic_code_exec_container_id:
                      anthropicCodeExecContainerId,
                  }
                : {}),
              ...(supportsProviderPromptCaching(externalProvider.providerType)
                ? {
                    enable_prompt_caching:
                      externalProvider.enablePromptCaching ?? true,
                  }
                : {}),
              // Anthropic prompt-cache TTL; unknown values no-op on backend.
              ...(supportsProviderPromptCacheTtl(
                externalProvider.providerType,
              ) &&
              (externalProvider.enablePromptCaching ?? true) &&
              isPromptCacheTtl(externalProvider.promptCacheTtl)
                ? { prompt_cache_ttl: externalProvider.promptCacheTtl }
                : {}),
              // Anthropic fast mode (Opus 4.6 / 4.7 only); backend
              // silently drops on unsupported models as a backstop.
              ...(params.fastMode &&
              providerSupportsFastMode(
                externalProvider.providerType,
                externalSelection.modelId,
              )
                ? { fast_mode: true }
                : {}),
              ...(externalReasoningCaps.supportsReasoning
                ? externalReasoningCaps.reasoningStyle === "reasoning_effort"
                  ? externalReasoningEnabled
                    ? { reasoning_effort: selectedExternalEffort }
                    : externalReasoningCaps.supportsReasoningOff
                      ? { reasoning_effort: "none" }
                      : {
                          reasoning_effort: fallbackExternalEffort,
                        }
                  : {
                      thinking: {
                        type: reasoningEnabled ? "enabled" : "disabled",
                      },
                    }
                : {}),
            };
          }

          return {
            model: params.checkpoint,
            messages: outboundMessages,
            stream: true,
            ...(continuation ? { continue_final_message: true } : {}),
            // Opt into the trailing usage chunk so the context-usage bar
            // and tok/s readout populate (backend gates it on include_usage).
            stream_options: { include_usage: true },
            temperature: params.temperature,
            top_p: params.topP,
            max_tokens: params.maxTokens,
            // A local model can have a large native window but a smaller context
            // that fits in the current GPU. Keep the conversation usable once it
            // reaches that real limit: the backend retains the instructions,
            // task anchor and recent turns, then retries within the window.
            // This is local-only; external providers keep their own policies.
            context_overflow: "truncate_middle",
            top_k: params.topK,
            min_p: params.minP,
            repetition_penalty: params.repetitionPenalty,
            presence_penalty: params.presencePenalty,
            image_base64: imageBase64,
            audio_base64: audioBase64,
            video_base64: videoBase64,
            cancel_id: cancelId,
            ...(sandboxSessionId ? { session_id: sandboxSessionId } : {}),
            ...(resolvedThreadId ? { thread_id: resolvedThreadId } : {}),
            ...(useAdapter === undefined ? {} : { use_adapter: useAdapter }),
            ...(supportsReasoning
              ? reasoningStyle === "enable_thinking_effort"
                ? // GLM-5.2-style: on/off gate plus an effort level. Disabling
                  // sends enable_thinking=false (a real disable); enabling sends
                  // the chosen level (e.g. high|max).
                  reasoningEnabled
                  ? {
                      enable_thinking: true,
                      reasoning_effort: localReasoningEffort,
                    }
                  : { enable_thinking: false }
                : reasoningStyle === "reasoning_effort"
                  ? reasoningEnabled
                    ? { reasoning_effort: localReasoningEffort }
                    : {}
                  : {
                      thinking: {
                        type: reasoningEnabled ? "enabled" : "disabled",
                      },
                    }
              : {}),
            ...(supportsPreserveThinking
              ? { preserve_thinking: preserveThinking }
              : {}),
            // Permission level for local tool calls is sent for every local
            // chat, not only when a tool pill is on: a process policy
            // (unsloth run --enable-tools) can open the tool loop with no pill,
            // and the backend must still see the selected gate. "auto" OMITS
            // confirm_tool_calls: an explicit true would make the backend treat
            // every auto request as needing a stream and defeat the safe-only
            // no-stream exception. "ask" sends true; off/full send false (full
            // also drops the sandbox).
            permission_mode: permissionMode,
            ...(permissionMode === "auto"
              ? {}
              : { confirm_tool_calls: permissionMode === "ask" }),
            bypass_permissions: bypassPermissions,
            ...(supportsTools &&
            (toolsEnabled ||
              codeToolsEnabled ||
              renderHtmlToolEnabledForThisTurn ||
              mcpEnabledForChat ||
              ragEnabled ||
              projectRagEnabled ||
              workspaceEnabled)
              ? {
                  enable_tools: true,
                  enabled_tools: [
                    // First so retrieval is the primary tool when Docs is on.
                    ...(ragEnabled || projectRagEnabled
                      ? ["search_knowledge_base"]
                      : []),
                    ...(toolsEnabled ? ["web_search"] : []),
                    ...(codeToolsEnabled
                      ? ["python", "terminal", "edit_file"]
                      : []),
                    ...(workspaceEnabled ? WORKSPACE_TOOL_NAMES : []),
                    ...(renderHtmlToolEnabledForThisTurn
                      ? ["render_html"]
                      : []),
                  ],
                  mcp_enabled: mcpEnabledForChat,
                  // Scope: thread_id = this thread's docs, kb_id = a KB,
                  // project_id = the thread's project sources (auto-on whenever
                  // the project has indexed sources, no Docs pill needed).
                  ...(ragEnabled || projectRagEnabled
                    ? {
                        rag_scope: {
                          ...(ragEnabled && ragSource.type === "kb"
                            ? { kb_id: ragSource.kbId }
                            : {
                                ...(ragEnabled && resolvedThreadId
                                  ? { thread_id: resolvedThreadId }
                                  : {}),
                                ...(projectRagEnabled && ragProjectId
                                  ? { project_id: ragProjectId }
                                  : {}),
                              }),
                          default_top_k: ragTopK,
                          mode: ragMode,
                          autoinject: resolveAutoInject(
                            ragAutoInject,
                            params.checkpoint,
                          ),
                          autoinject_min_score: ragAutoInjectMinScore,

                          ...(ragAutoInject === "off"
                            ? { whole_doc: false }
                            : {}),
                          context_length:
                            runtime.ggufContextLength ??
                            params.maxSeqLength ??
                            undefined,
                        },
                      }
                    : {}),
                  auto_heal_tool_calls: runtime.autoHealToolCalls,
                  nudge_tool_calls: runtime.nudgeToolCalls,
                  max_tool_calls_per_message: runtime.maxToolCallsPerMessage,
                  tool_call_timeout: (() => {
                    const mins = runtime.toolCallTimeout;
                    return mins >= 9999 ? 9999 : mins * 60;
                  })(),
                }
              : // Explicit false, not an omitted field: the server defaults tools
                // on for a request that never mentions them, so a model with no
                // tool pill lit has to say so.
                { enable_tools: false }),
          };
        };

        let retriedWithRefreshedKey = false;
        while (true) {
          try {
            let requestPayload: OpenAIChatCompletionsRequest;
            try {
              requestPayload = await buildRequestPayload(
                retriedWithRefreshedKey,
              );
            } catch (error) {
              clearSelectedImageEditReference();
              throw error;
            }
            clearSelectedImageEditReference();
            requestedMaxTokens = requestPayload.max_tokens;
            await ThreadAutosaveHandle.awaitFirstSave(resolvedThreadId);
            const stream = streamChatCompletions(requestPayload, runSignal);
            // Per run, not per module: two turns must not share a cycle.
            const canPublish = createStreamPublishGate();

            for await (const chunk of stream) {
              const chunkModel = (chunk as { model?: unknown }).model;
              if (typeof chunkModel === "string" && chunkModel.length > 0) {
                responseModelId = chunkModel;
              }

              // Handle tool status events
              const toolStatusText = (
                chunk as unknown as { _toolStatus?: string }
              )._toolStatus;
              if (toolStatusText !== undefined) {
                runtime.setToolStatus(
                  liveThreadKey(serverCancel),
                  toolStatusText || null,
                  serverCancel,
                );
                continue;
              }

              // Local GGUF sends server-timed reasoning duration. Guard the type
              // so a malformed or proxied chunk (string/null/NaN duration) can
              // never turn the label into NaN.
              const reasoningMs = (
                chunk as { _reasoningDurationMs?: number } | null | undefined
              )?._reasoningDurationMs;
              if (reasoningDurationTracker.recordServerDuration(reasoningMs)) {
                continue;
              }

              // Diffusion frame: a transient canvas snapshot. Route it to the transient
              // store (the in-bubble renderer reads it) and skip it; it has no assistant
              // text, so it never enters the transcript or the counters below.
              const diffusionFrame = (
                chunk as unknown as {
                  _diffusionFrame?: {
                    block?: number;
                    step?: number;
                    total?: number;
                    text?: string;
                  };
                }
              )._diffusionFrame;
              if (diffusionFrame !== undefined) {
                // Keyed by thread so a background run's frames stay out of the visible chat
                // instead of overwriting the frame it is painting.
                runtime.setActiveDiffusionCanvas(liveThreadKey(serverCancel), {
                  block: diffusionFrame.block ?? 0,
                  step: diffusionFrame.step ?? 0,
                  total: diffusionFrame.total ?? 0,
                  text: diffusionFrame.text ?? "",
                });
                continue;
              }

              // Emit tool-call content parts for assistant-ui.
              // tool_start: add a part (renders "running").
              // tool_end: set result on the part (transitions to "complete").
              const toolEvent = (
                chunk as unknown as { _toolEvent?: Record<string, unknown> }
              )._toolEvent;
              if (toolEvent !== undefined) {
                // Persist container_id onto the thread (OpenAI / Anthropic).
                if (toolEvent.type === "container_ready") {
                  const newContainerId = toolEvent.container_id as
                    string | undefined;
                  if (newContainerId && resolvedThreadId) {
                    const field =
                      externalProvider?.providerType === "anthropic"
                        ? "anthropicCodeExecContainerId"
                        : "openaiCodeExecContainerId";
                    void updateStoredChatThreadEventually(resolvedThreadId, {
                      [field]: newContainerId,
                    }).catch(() => {});
                  }
                  continue;
                }
                if (toolEvent.type === "document_citations") {
                  // Convert citations_delta footnotes into Sources-panel
                  // entries matching the inline [N] markers.
                  const cits = toolEvent.citations;
                  if (Array.isArray(cits)) {
                    cits.forEach((entry, idx) => {
                      if (!entry || typeof entry !== "object") return;
                      const part = documentCitationToSource(
                        entry as Record<string, unknown>,
                        idx,
                      );
                      if (
                        part &&
                        !documentCitationParts.some((p) => p.id === part.id)
                      ) {
                        documentCitationParts.push(part);
                      }
                    });
                  }
                  continue;
                }
                if (toolEvent.type === "container_invalidated") {
                  if (resolvedThreadId) {
                    const field =
                      externalProvider?.providerType === "anthropic"
                        ? "anthropicCodeExecContainerId"
                        : "openaiCodeExecContainerId";
                    void updateStoredChatThreadEventually(resolvedThreadId, {
                      [field]: null,
                    }).catch(() => {});
                  }
                  continue;
                }
                if (toolEvent.type === "anthropic_refusal") {
                  // Latch the backend refusal signal so final message
                  // metadata can drive the prune.
                  anthropicRefusalSeen = true;
                  continue;
                }
                if (toolEvent.type === "tool_output") {
                  // Incremental stdout from a running tool: append to the live
                  // store so the card renders it while the spinner runs. Final
                  // result arrives via tool_end.
                  const backendToolCallId =
                    (toolEvent.tool_call_id as string) || "";
                  const liveId = resolveToolPartId(backendToolCallId);
                  const liveText =
                    typeof toolEvent.text === "string" ? toolEvent.text : "";
                  if (liveId && liveText) {
                    const liveKey = scopedToolOutputKey(liveId);
                    runToolLiveOutputKeys.add(liveKey);
                    useChatRuntimeStore
                      .getState()
                      .appendToolLiveOutput(liveKey, liveText);
                  }
                  continue;
                }
                if (toolEvent.type === "tool_args") {
                  // The model is still WRITING this call's arguments: accumulate
                  // the raw stream and feed a partial parse into the part's args
                  // so the card shows the code live. tool_start later replaces
                  // args with the authoritative parse.
                  const backendToolCallId =
                    (toolEvent.tool_call_id as string) || "";
                  const liveId = resolveToolPartId(backendToolCallId);
                  const fragment =
                    typeof toolEvent.text === "string" ? toolEvent.text : "";
                  if (liveId && fragment) {
                    const accum =
                      (liveArgsTextById.get(liveId) ?? "") + fragment;
                    liveArgsTextById.set(liveId, accum);
                    streamedChars += fragment.length;
                    const partial = parseLiveToolArgs(accum);
                    const idx = toolCallParts.findIndex(
                      (p) => p.toolCallId === liveId,
                    );
                    if (partial && idx !== -1) {
                      const existing = toolCallParts[
                        idx
                      ] as PositionedToolCallPart;
                      toolCallParts[idx] = {
                        ...existing,
                        args: partial.args as ToolCallMessagePart["args"],
                        argsText: partial.argsText,
                      };
                      // A preview: it repeats per argument delta and
                      // tool_start replaces it. Tool events carry state, so
                      // they stay ungated.
                      if (canPublish(streamedChars)) {
                        yield {
                          content: liveAssistantContent(),
                          metadata: {
                            timing: buildTiming(
                              streamStartTime,
                              totalChunks,
                              firstTokenTime,
                            ),
                            custom: liveCustom(),
                          },
                        };
                      }
                    }
                  }
                  continue;
                }
                closeReasoningContent();
                const toolProvenance = parseToolProvenance(
                  toolEvent.provenance,
                );
                if (toolEvent.type === "tool_start") {
                  const backendToolCallId =
                    (toolEvent.tool_call_id as string) || "";
                  const approvalId = (toolEvent.approval_id as string) || "";
                  const awaitingConfirmation =
                    toolEvent.awaiting_confirmation === true;
                  // Reuse a provisional card's part id, else the confirmation-scoped id
                  // opens a second card and the first spins "Running" forever.
                  const openPartId = backendToolCallId
                    ? toolPartIdByBackendId.get(backendToolCallId)
                    : undefined;
                  const reuseOpenPart =
                    !!openPartId &&
                    toolCallParts.some((p) => p.toolCallId === openPartId);
                  const id =
                    awaitingConfirmation && approvalId && !reuseOpenPart
                      ? `${toolConfirmationScopeId}:${approvalId}`
                      : backendToolCallId
                        ? resolveToolPartId(backendToolCallId)
                        : approvalId || `${toolEvent.tool_name}_${Date.now()}`;
                  if (awaitingConfirmation && backendToolCallId) {
                    toolConfirmationIdsByBackendId.set(backendToolCallId, id);
                  }
                  // "call_0" restarts every response: drop stale live/preserved
                  // output under this key, else the card shows the previous call's.
                  const staleKey = scopedToolOutputKey(id);
                  useChatRuntimeStore.getState().clearToolLiveOutput(staleKey);
                  useChatRuntimeStore.getState().clearToolFullOutput(staleKey);
                  const toolArgs = (toolEvent.arguments ??
                    {}) as ToolCallMessagePart["args"];
                  const idx = toolCallParts.findIndex(
                    (p) => p.toolCallId === id,
                  );
                  if (idx !== -1) {
                    const existing = toolCallParts[
                      idx
                    ] as PositionedToolCallPart;
                    toolCallParts[idx] = {
                      ...existing,
                      toolName: toolEvent.tool_name as string,
                      argsText: JSON.stringify(toolArgs),
                      args: toolArgs,
                      provenance: mergeToolProvenance(
                        existing.provenance,
                        toolProvenance,
                      ),
                    };
                  } else {
                    toolCallParts.push({
                      type: "tool-call" as const,
                      toolCallId: id,
                      toolName: toolEvent.tool_name as string,
                      argsText: JSON.stringify(toolArgs),
                      args: toolArgs,
                      textCursor: cumulativeText.length,
                      ...(toolProvenance ? { provenance: toolProvenance } : {}),
                    } as PositionedToolCallPart);
                  }
                  if (awaitingConfirmation) {
                    useChatRuntimeStore
                      .getState()
                      .setToolConfirmation(
                        id,
                        approvalId,
                        sandboxSessionId ?? "",
                        toolConfirmationScopeId,
                      );
                  }
                } else if (toolEvent.type === "tool_end") {
                  const backendToolCallId =
                    (toolEvent.tool_call_id as string) || "";
                  const id = resolveToolPartId(backendToolCallId);
                  if (backendToolCallId) {
                    toolConfirmationIdsByBackendId.delete(backendToolCallId);
                    toolPartIdByBackendId.delete(backendToolCallId);
                  }
                  useChatRuntimeStore.getState().clearToolConfirmation(id);
                  // The result replaces the live output, but if the stream
                  // captured MORE than the truncated result, preserve it so the
                  // finished card keeps everything. Uses the shared predicate,
                  // not a length compare (footer / "Exit code N:" / __IMAGES__
                  // tail can make the result longer by byte).
                  const liveKey = scopedToolOutputKey(id);
                  const liveOutput =
                    useChatRuntimeStore.getState().toolLiveOutput[liveKey] ??
                    "";
                  if (
                    id &&
                    shouldPreserveFullOutput(
                      liveOutput,
                      (toolEvent.result as string) ?? "",
                    )
                  ) {
                    useChatRuntimeStore
                      .getState()
                      .setToolFullOutput(liveKey, liveOutput);
                  }
                  useChatRuntimeStore.getState().clearToolLiveOutput(liveKey);
                  runToolLiveOutputKeys.delete(liveKey);
                  liveArgsTextById.delete(id);
                  const idx = toolCallParts.findIndex(
                    (p) => p.toolCallId === id,
                  );
                  if (idx !== -1) {
                    const rawEvent = (toolEvent.result as string) ?? "";
                    // Pulled out first, ahead of __IMAGES__, so the image
                    // slice below is unchanged. Only from the tools that emit
                    // it: elsewhere that line is content, not an envelope.
                    const { text: rawResult, files: createdFiles } =
                      SANDBOX_FILE_TOOLS.has(toolCallParts[idx].toolName ?? "")
                        ? extractCreatedFiles(rawEvent)
                        : { text: rawEvent, files: [] as SandboxFile[] };
                    const imgMarker = "\n__IMAGES__:";
                    const imgIdx = rawResult.lastIndexOf(imgMarker);
                    const mcpImgMarker = "\n__MCP_IMAGES__:";
                    const mcpImgIdx = rawResult.lastIndexOf(mcpImgMarker);
                    let parsedResult:
                      | string
                      | {
                          text: string;
                          images: string[];
                          sessionId: string;
                          files?: SandboxFile[];
                        }
                      | McpImageToolResult
                      | {
                          image_b64: string;
                          image_mime: string;
                          size?: string;
                          quality?: string;
                          background?: string;
                          prompt?: string;
                        };
                    const imageB64 = toolEvent.image_b64 as string | undefined;
                    // A valid MCP image envelope wins; an invalid marker falls
                    // through so a sandbox __IMAGES__ suffix still renders and
                    // legit text round-trips unchanged.
                    let mcpImages: McpImageToolResult | null = null;
                    if (mcpImgIdx !== -1) {
                      try {
                        const images = JSON.parse(
                          rawResult.slice(mcpImgIdx + mcpImgMarker.length),
                        );
                        const candidate = {
                          text: rawResult.slice(0, mcpImgIdx),
                          images,
                        };
                        if (isMcpImageToolResult(candidate))
                          mcpImages = candidate;
                      } catch {
                        // Not a valid envelope; fall through below.
                      }
                    }
                    if (
                      toolCallParts[idx].toolName === "image_generation" &&
                      typeof imageB64 === "string" &&
                      imageB64
                    ) {
                      // Backend keeps base64 on separate image_b64 /
                      // image_mime fields so logs stay small; repackage here.
                      parsedResult = {
                        image_b64: imageB64,
                        image_mime:
                          (toolEvent.image_mime as string | undefined) ??
                          "image/png",
                        size: toolEvent.size as string | undefined,
                        quality: toolEvent.quality as string | undefined,
                        background: toolEvent.background as string | undefined,
                        prompt: toolEvent.prompt as string | undefined,
                      };
                    } else if (mcpImages !== null) {
                      parsedResult = mcpImages;
                    } else if (imgIdx !== -1) {
                      const text = rawResult.slice(0, imgIdx);
                      // Fall back to "_default" to match the backend sandbox
                      // dir used when no session_id (see tools.py _get_workdir).
                      const sessionId = sandboxSessionId || "_default";
                      try {
                        const images = JSON.parse(
                          rawResult.slice(imgIdx + imgMarker.length),
                        ) as string[];
                        parsedResult = {
                          text,
                          images,
                          sessionId,
                          files: createdFiles,
                        };
                      } catch {
                        parsedResult = rawResult;
                      }
                    } else if (
                      createdFiles.length > 0 ||
                      SANDBOX_FILE_TOOLS.has(toolCallParts[idx].toolName ?? "")
                    ) {
                      // Structured with files, for the download card, and with
                      // neither, because the session is the only record of WHERE
                      // this call ran: _created_file_sentinels emits nothing
                      // when a concurrent call shared the directory, so a run
                      // that wrote files can arrive bare and a moved chat would
                      // then name a folder from its current scope. Downstream is
                      // unaffected: both toolResultModelText and the outbound
                      // translator unwrap a sandbox wrapper to this same .text.
                      parsedResult = {
                        text: rawResult,
                        images: [],
                        sessionId: sandboxSessionId || "_default",
                        files: createdFiles,
                      };
                    } else {
                      parsedResult = rawResult;
                    }
                    // Merge tool_end args first, then Gemini native_part.
                    const nextArgs =
                      toolEvent.arguments &&
                      typeof toolEvent.arguments === "object"
                        ? (toolEvent.arguments as ToolCallMessagePart["args"])
                        : undefined;
                    const mergedArgs: ToolCallMessagePart["args"] = {
                      ...(toolCallParts[idx].args ?? {}),
                      ...(nextArgs ?? {}),
                    } as ToolCallMessagePart["args"];
                    // Merge tool_end native_part into args.google so the
                    // outbound translator replays both start (executableCode)
                    // and end (result / inlineData) on the same turn.
                    // Concatenate so each part keeps its own thoughtSignature.
                    const endGoogle = (
                      toolEvent as { google?: { native_part?: unknown } }
                    ).google;
                    if (
                      endGoogle &&
                      typeof endGoogle === "object" &&
                      endGoogle.native_part &&
                      typeof endGoogle.native_part === "object"
                    ) {
                      const argsObj = mergedArgs as Record<string, unknown>;
                      const existingGoogle = (argsObj.google ?? {}) as Record<
                        string,
                        unknown
                      >;
                      const existingNative =
                        (existingGoogle.native_part as Record<
                          string,
                          unknown
                        >) ?? {};
                      const endNative = endGoogle.native_part as Record<
                        string,
                        unknown
                      >;
                      // Extract part entries from parts:[...] or legacy
                      // single-object native_part. Legacy thoughtSignature
                      // always belongs on executableCode.
                      const collectParts = (
                        native: Record<string, unknown>,
                      ): Record<string, unknown>[] => {
                        if (Array.isArray(native.parts)) {
                          return (native.parts as unknown[]).filter(
                            (entry): entry is Record<string, unknown> =>
                              Boolean(entry) &&
                              typeof entry === "object" &&
                              !Array.isArray(entry),
                          );
                        }
                        const out: Record<string, unknown>[] = [];
                        const legacySig =
                          typeof native.thoughtSignature === "string"
                            ? native.thoughtSignature
                            : typeof native.thought_signature === "string"
                              ? (native.thought_signature as string)
                              : null;
                        for (const key of [
                          "executableCode",
                          "codeExecutionResult",
                          "inlineData",
                        ] as const) {
                          const sub = native[key];
                          if (sub && typeof sub === "object") {
                            const entry: Record<string, unknown> = {
                              [key]: sub,
                            };
                            if (key === "executableCode" && legacySig) {
                              entry.thoughtSignature = legacySig;
                            }
                            out.push(entry);
                          }
                        }
                        return out;
                      };
                      const mergedParts = [
                        ...collectParts(existingNative),
                        ...collectParts(endNative),
                      ];
                      argsObj.google = {
                        ...existingGoogle,
                        native_part: { parts: mergedParts },
                      };
                    }
                    const existing = toolCallParts[
                      idx
                    ] as PositionedToolCallPart;
                    toolCallParts[idx] = {
                      ...existing,
                      args: mergedArgs,
                      argsText: JSON.stringify(mergedArgs ?? {}),
                      result: parsedResult,
                      provenance: mergeToolProvenance(
                        existing.provenance,
                        toolProvenance,
                      ),
                    };
                  }
                }
                yield {
                  content: liveAssistantContent(),
                  metadata: {
                    timing: buildTiming(
                      streamStartTime,
                      totalChunks,
                      firstTokenTime,
                    ),
                    custom: liveCustom(),
                  },
                };
                continue;
              }

              // OpenAI usage may arrive either in an empty trailing chunk or on
              // the terminal Codex chunk that also carries reasoning metadata.
              if (chunk.usage) {
                serverMetadata = {
                  usage: chunk.usage,
                  timings: (chunk as Record<string, unknown>).timings as
                    ServerTimings | undefined,
                };
                if (chunk.choices?.length === 0) continue;
              }

              totalChunks += 1;
              // Latched, not read off the last chunk: a provider can send the
              // terminal reason ahead of its usage chunk.
              if (chunk.choices?.[0]?.finish_reason === "length") {
                incompleteReason = "length";
              } else if (chunk.choices?.[0]?.finish_reason) {
                incompleteReason = null;
              }
              // Latch the chunk's `model` field so the openrouter/free chip
              // shows the chosen underlying model.
              if (
                isExternalRequest &&
                externalProvider?.providerType === "openrouter" &&
                externalSelection?.modelId === "openrouter/free"
              ) {
                const chunkModel = (chunk as { model?: unknown }).model;
                if (
                  typeof chunkModel === "string" &&
                  chunkModel.length > 0 &&
                  chunkModel !== externalSelection.modelId
                ) {
                  const storeState = useChatRuntimeStore.getState();
                  if (storeState.lastOpenRouterChosenModel !== chunkModel) {
                    storeState.setLastOpenRouterChosenModel(chunkModel);
                  }
                }
              }
              const rawDelta = chunk.choices?.[0]?.delta?.content;
              // Normalize structured delta.content (mistral magistral).
              const { text: delta, structuredReasoningContinues } =
                extractDeltaText(rawDelta);
              // Latest Gemini text-part thoughtSignature for next-turn replay.
              const deltaExtraContent = (
                chunk.choices?.[0]?.delta as
                  { extra_content?: unknown } | undefined
              )?.extra_content;
              // Replay state reaches the message only through a yield, so a
              // Stop while the gate holds one persists a turn that cannot
              // replay. Pace previews, never state.
              let replayStateChanged = false;
              if (deltaExtraContent && typeof deltaExtraContent === "object") {
                const extraRecord = deltaExtraContent as Record<
                  string,
                  unknown
                >;
                const eGoogle = extraRecord.google;
                if (eGoogle && typeof eGoogle === "object") {
                  const sig = (eGoogle as Record<string, unknown>)
                    .thought_signature;
                  if (typeof sig === "string" && sig) {
                    replayStateChanged ||= sig !== latestTextThoughtSignature;
                    latestTextThoughtSignature = sig;
                  }
                }
                const codexReasoning = extraRecord.openai_codex_reasoning;
                if (
                  Array.isArray(codexReasoning) &&
                  codexReasoning.length > 0
                ) {
                  codexReasoningLedger = addCodexReasoning(
                    codexReasoningLedger,
                    codexReasoning,
                    codexRoundToolCallIds,
                  );
                  replayStateChanged = true;
                }
              }

              if (chunk.choices?.[0]?.finish_reason) {
                codexRoundToolCallIds = [];
              }
              // Kimi / DeepSeek stream thinking via delta.reasoning_content;
              // wrap inline as <think>...</think> for parseAssistantContent.
              const rawReasoning = (
                chunk.choices?.[0]?.delta as
                  { reasoning_content?: unknown } | undefined
              )?.reasoning_content;
              // OpenRouter ships reasoning as delta.reasoning_details[]
              // regardless of provider; merge into the same wrap path.
              const rawReasoningDetails = (
                chunk.choices?.[0]?.delta as
                  { reasoning_details?: unknown } | undefined
              )?.reasoning_details;
              const reasoningFromDetails = Array.isArray(rawReasoningDetails)
                ? rawReasoningDetails
                    .map((part) => {
                      if (!part || typeof part !== "object") return "";
                      const text = (part as { text?: unknown }).text;
                      return typeof text === "string" ? text : "";
                    })
                    .join("")
                : "";
              const reasoning =
                (typeof rawReasoning === "string" ? rawReasoning : "") +
                reasoningFromDetails;
              // OpenAI delta.tool_calls: streams fragments by index;
              // accumulate into one part. extra_content carries Gemini 3
              // thoughtSignature for replay.
              const rawDeltaToolCalls = (
                chunk.choices?.[0]?.delta as
                  { tool_calls?: unknown } | undefined
              )?.tool_calls;
              if (
                Array.isArray(rawDeltaToolCalls) &&
                rawDeltaToolCalls.length > 0
              ) {
                closeReasoningContent();
                // Extending a call's arguments is a preview; introducing one
                // is state, so it always publishes.
                let addedToolCall = false;
                for (const tc of rawDeltaToolCalls) {
                  if (!tc || typeof tc !== "object") continue;
                  const call = tc as {
                    id?: string;
                    index?: number;
                    function?: { name?: string; arguments?: string };
                    extra_content?: unknown;
                  };
                  const idx =
                    typeof call.index === "number" ? call.index : undefined;
                  const stableId = call.id;
                  // Studio's local Codex loop follows the OpenAI tool-call delta with
                  // tool_start/tool_end events. Resolve the backend id now so all three
                  // event shapes update one run-unique card instead of leaving the raw
                  // provisional card beside a second execution card.
                  const stablePartId = stableId
                    ? resolveToolPartId(stableId)
                    : undefined;
                  // match by resolved id when the fragment carries one, else by
                  // index slot; streams that send neither get a minted
                  // tool_call_<n> id.
                  const existingIndex = findStreamedToolCallPartIndex(
                    toolCallParts,
                    stablePartId,
                    idx,
                  );
                  const existing =
                    existingIndex === -1
                      ? undefined
                      : toolCallParts[existingIndex];

                  if (
                    stablePartId &&
                    !codexRoundToolCallIds.includes(stablePartId)
                  ) {
                    codexRoundToolCallIds.push(stablePartId);
                  }
                  const argsFragment = call.function?.arguments ?? "";
                  streamedChars +=
                    argsFragment.length + (call.function?.name?.length ?? 0);
                  if (existing) {
                    const prevName = existing.toolName ?? "";
                    const nextName = call.function?.name ?? prevName;
                    const merged = (existing.argsText ?? "") + argsFragment;
                    let parsedArgs: ToolCallMessagePart["args"] =
                      existing.args ?? {};
                    if (merged) {
                      try {
                        parsedArgs = JSON.parse(
                          merged,
                        ) as ToolCallMessagePart["args"];
                      } catch {
                        parsedArgs = {
                          _raw: merged,
                        } as ToolCallMessagePart["args"];
                      }
                    }
                    const prevExtra = (existing as PositionedToolCallPart)
                      .extra_content;
                    if (
                      call.extra_content !== undefined &&
                      JSON.stringify(call.extra_content) !==
                        JSON.stringify(prevExtra)
                    ) {
                      // Gemini puts the thought signature on the call, and
                      // the next turn is rejected without it.
                      replayStateChanged = true;
                    }
                    const updated: PositionedToolCallPart = {
                      ...(existing as PositionedToolCallPart),
                      // a late id claims the slot its id-less opening fragment
                      // created, so tool_start and tool_end find the same card.
                      ...(stablePartId
                        ? { toolCallId: stablePartId, _has_stable_id: true }
                        : {}),
                      toolName: nextName,
                      argsText: merged,
                      args: parsedArgs,
                      ...(call.extra_content !== undefined
                        ? { extra_content: call.extra_content }
                        : prevExtra !== undefined
                          ? { extra_content: prevExtra }
                          : {}),
                      ...(idx !== undefined ? { _delta_index: idx } : {}),
                    };
                    toolCallParts[existingIndex] = updated;
                  } else {
                    const callId =
                      stablePartId ||
                      `tool_call_${idx ?? toolCallParts.length}`;

                    if (!codexRoundToolCallIds.includes(callId)) {
                      codexRoundToolCallIds.push(callId);
                    }
                    const argsText = argsFragment;
                    let parsedArgs: ToolCallMessagePart["args"] = {};
                    if (argsText) {
                      try {
                        parsedArgs = JSON.parse(
                          argsText,
                        ) as ToolCallMessagePart["args"];
                      } catch {
                        parsedArgs = {
                          _raw: argsText,
                        } as ToolCallMessagePart["args"];
                      }
                    }
                    const fresh: PositionedToolCallPart = {
                      type: "tool-call" as const,
                      toolCallId: callId,
                      toolName: call.function?.name ?? "",
                      argsText,
                      args: parsedArgs,
                      textCursor: cumulativeText.length,
                      ...(call.extra_content !== undefined
                        ? { extra_content: call.extra_content }
                        : {}),
                      ...(stablePartId ? { _has_stable_id: true } : {}),
                      ...(idx !== undefined ? { _delta_index: idx } : {}),
                    };
                    toolCallParts.push(fresh);
                    addedToolCall = true;
                  }
                }
                if (
                  addedToolCall ||
                  replayStateChanged ||
                  canPublish(streamedChars)
                ) {
                  yield {
                    content: liveAssistantContent(),
                    metadata: {
                      timing: buildTiming(
                        streamStartTime,
                        totalChunks,
                        firstTokenTime,
                      ),
                      custom: liveCustom(),
                    },
                  };
                }
                continue;
              }
              // extra_content can arrive with no content at all: a Gemini
              // thoughtSignature fragment, or the codex reasoning ledger on a
              // terminal delta. The skip below would drop both.
              if (replayStateChanged && !delta && !reasoning) {
                const replayContent = liveAssistantContent();
                if (replayContent.length > 0) {
                  yield {
                    content: replayContent,
                    metadata: {
                      timing: buildTiming(
                        streamStartTime,
                        totalChunks,
                        firstTokenTime,
                      ),
                      custom: liveCustom(),
                    },
                  };
                }
                continue;
              }
              if (!delta && !reasoning) {
                continue;
              }
              // So a chunk that added nothing can be told from one that did.
              const textLenBeforeChunk = cumulativeText.length;
              if (waitingFirstChunk) {
                waitingFirstChunk = false;
                firstTokenTime = Date.now() - streamStartTime;
                settleFirstTokenOk();
                runtime.setGeneratingStatus(null);
              }

              if (reasoning) {
                if (!reasoningContentOpen) {
                  reasoningDurationTracker.startGroup();
                  appendCumulative(`<think>${reasoning}`);
                  reasoningContentOpen = true;
                } else {
                  appendCumulative(reasoning);
                }
              }
              if (delta) {
                if (reasoningContentOpen) {
                  closeReasoningContent();
                }
                appendCumulative(delta);
              }
              streamedChars += reasoning.length + delta.length;
              producedReplyText = true;
              // The trailing ${...} strip used to run here, once per arrival.
              // It now runs once, on the finished reply, below the loop. See
              // the comment there. Nothing on this path reads the buffer any
              // more, so no arrival can flatten it.
              const textEndsInsideThink = thinkTags.endsInsideThink();
              const assistantContent = liveAssistantContent();

              // Fallback when no server-side reasoning_summary arrives.
              const parsedReasoningGroupCount =
                countReasoningGroups(assistantContent);
              if (
                parsedReasoningGroupCount > reasoningDurationTracker.groupCount
              ) {
                reasoningDurationTracker.startGroup(
                  parsedReasoningGroupCount - 1,
                );
              }
              if (parsedReasoningGroupCount > 0) {
                // Providers that close every reasoning block atomically
                // (structured parts wrapped as <think>..</think>) end the group
                // on each chunk. Reopen while the reasoning text is still
                // growing so the timer spans the whole pass.
                reasoningDurationTracker.resumeGroup(
                  parsedReasoningGroupCount - 1,
                  lastReasoningGroupTextLength(assistantContent),
                );
              }
              if (
                reasoningDurationTracker.hasActiveGroup &&
                !reasoningContentOpen &&
                !structuredReasoningContinues &&
                !textEndsInsideThink
              ) {
                reasoningDurationTracker.finishGroup();
              }

              // Everything above runs on every arrival; only the publish is
              // coalesced. The cost being removed is downstream of the yield
              // (assistant-ui, React, markdown, paint), not the rebuild, which
              // is tens of milliseconds across a whole reply.
              //
              // A chunk with nothing new is skipped rather than paced: the gate
              // would spend this cycle on an identical publish and hold the
              // next real one.
              if (
                !replayStateChanged &&
                (assistantContent.length === 0 ||
                  cumulativeText.length === textLenBeforeChunk)
              ) {
                continue;
              }
              if (!replayStateChanged && !canPublish(streamedChars)) {
                continue;
              }

              if (assistantContent.length > 0) {
                yield {
                  content: assistantContent,
                  metadata: {
                    timing: buildTiming(
                      streamStartTime,
                      totalChunks,
                      firstTokenTime,
                    ),
                    custom: liveCustom(),
                  },
                };
              }
            }
            break;
          } catch (streamError) {
            if (
              isExternalRequest &&
              !retriedWithRefreshedKey &&
              isProviderKeyRotationError(streamError)
            ) {
              retriedWithRefreshedKey = true;
              continue;
            }
            throw streamError;
          }
        }
        // Strip a trailing ${...} template-literal fragment from external
        // streams (mistral magistral occasionally emits one at the end of an
        // otherwise complete answer).
        //
        // Once, on the finished reply. "Ends with ${...}" is a property of the
        // completed answer, and running the strip on every arrival tested it
        // against every prefix of that answer instead: the one arrival whose
        // buffer happened to end at `...${name}` was cut, and reassigning the
        // result made the cut permanent, so "return `Hi, ${name}!`" arrived as
        // "return `Hi,!`". Any reply containing a template literal lost text.
        // See #9098.
        //
        // Only where the stream ran to completion. An abort leaves more text
        // still to come, so its tail is a prefix again and stripping it would
        // be the same bug; that path keeps the buffer whole and this runs on
        // the resumed reply instead. `producedReplyText` is the same case one
        // step in: a continuation that finishes without a text or reasoning
        // delta, having emitted only a tool call, leaves the buffer holding
        // nothing but the seeded partial, and a partial is a prefix too.
        //
        // The watch still gates the scan, and now saves the whole reply from
        // being flattened rather than one arrival's worth: a reply that does
        // not end in a brace is rejected without the buffer being read at all.
        // Before the <think> close below, so a fragment at the end of an
        // unterminated reasoning block is still the end of the reply when it
        // is tested.
        if (
          isExternalRequest &&
          producedReplyText &&
          placeholderWatch.isCandidate()
        ) {
          const stripped = stripTrailingTemplatePlaceholder(cumulativeText);
          if (stripped.length !== cumulativeText.length) {
            cumulativeText = stripped;
            // A suffix went away, so both trackers have to be told; the parse
            // notices by itself, from the length.
            thinkTags.retract(cumulativeText);
            placeholderWatch.retract(cumulativeText);
          }
        }
        // If the stream ended while we were still inside a
        // delta.reasoning_content block (Kimi / DeepSeek path), close
        // the open <think> tag so the reasoning panel parses cleanly.
        closeReasoningContent();
        settleFirstTokenOk();

        // Extract source parts from completed web_search and web_fetch
        // calls. Both emit the same `Title:` / `URL:` / `Snippet:` block
        // shape, so the parser need not branch on tool name.
        const sourceParts = toolCallParts.flatMap((tc) => {
          if (
            (tc.toolName !== "web_search" && tc.toolName !== "web_fetch") ||
            !tc.result
          ) {
            return [];
          }
          return parseSourcesFromResult(
            typeof tc.result === "string" ? tc.result : "",
          );
        });

        const meta = serverMetadata;
        const finalTokenCount =
          meta?.usage?.completion_tokens ?? estimateTokenCount(cumulativeText);
        const finalTokPerSec = meta?.timings?.predicted_per_second;
        const serverPromptEvalTime = meta?.timings?.prompt_ms;

        // Prefer llama-server timings; fall back to provider usage envelope.
        const cachedTokens =
          meta?.timings?.cache_n ??
          meta?.usage?.prompt_tokens_details?.cached_tokens ??
          meta?.usage?.cache_read_input_tokens ??
          0;
        // Anthropic-only (billed at the write premium).
        const cacheWriteTokens = meta?.usage?.cache_creation_input_tokens ?? 0;

        // Gate on the captured checkpoint so a late completion from provider A cannot populate
        // the bar after a mid-stream switch to B, and on the captured thread so a background
        // run finishing after New Chat cannot repaint another chat's usage. An unresolved run
        // has no id to compare, so compare what was on screen when it started. A first turn is
        // adopted onto an id mid-run and autosave moves activeThreadId with it, so read the
        // adopted key, or the run stays "unresolved" for life and the bar stays blank.
        const usageKey = liveThreadKey(serverCancel);
        const usageThreadKey = usageKey === "__default" ? null : usageKey;
        const usageThreadIsVisible =
          useChatRuntimeStore.getState().activeThreadId ===
          (usageThreadKey ?? activeThreadIdAtRunStart);
        if (
          meta?.usage &&
          typeof meta.usage.prompt_tokens === "number" &&
          typeof meta.usage.completion_tokens === "number" &&
          typeof meta.usage.total_tokens === "number"
        ) {
          const usage = {
            promptTokens: meta.usage.prompt_tokens,
            completionTokens: meta.usage.completion_tokens,
            totalTokens: meta.usage.total_tokens,
            cachedTokens,
            cacheWriteTokens,
          };
          // File it under this run's own thread even when the gate below blocks the visible
          // write, so switching back re-applies it.
          if (usageThreadKey !== null) {
            useChatRuntimeStore
              .getState()
              .setThreadContextUsage(usageThreadKey, usage);
          }
          if (
            usageThreadIsVisible &&
            useChatRuntimeStore.getState().params.checkpoint ===
              params.checkpoint
          ) {
            useChatRuntimeStore.getState().setContextUsage(usage);
          }
        }

        if (
          incompleteReason === null &&
          budgetImpliesTruncation({
            isMlx: isMlxRequest,
            maxTokens: requestedMaxTokens,
            completionTokens: meta?.usage?.completion_tokens,
          })
        ) {
          incompleteReason = "length";
        }

        const finishedAt = Date.now();
        const finalTiming = buildTiming(
          streamStartTime,
          totalChunks,
          serverPromptEvalTime ?? firstTokenTime,
          finishedAt - streamStartTime,
          finalTokenCount,
          toolCallParts.length,
          finalTokPerSec,
        );

        // Finalize reasoning-only streams.
        reasoningDurationTracker.finishGroup();
        yield {
          content: [
            ...buildAssistantContent(mergeContinuation(cumulativeText)),
            ...sourceParts,
            ...documentCitationParts,
          ],
          metadata: {
            timing: finalTiming,
            custom: {
              ...reasoningDurationTracker.metadata(),
              // Persisted so Continue survives a reload; cleared on a normal end.

              openaiCodexReasoning: codexReasoningLedger,
              incomplete: incompleteReason
                ? { reason: incompleteReason }
                : undefined,
              // Persisted refusal flag driving the two-pass prune.
              anthropicRefusal: anthropicRefusalSeen || undefined,
              serverTimings: meta?.timings ?? undefined,
              contextUsage: meta?.usage
                ? {
                    promptTokens: meta.usage.prompt_tokens,
                    completionTokens: meta.usage.completion_tokens,
                    totalTokens: meta.usage.total_tokens,
                    cachedTokens,
                    cacheWriteTokens,
                    modelId: params.checkpoint,
                  }
                : undefined,
              responseDetails: buildResponseDetails(finishedAt),
              timing: finalTiming,
            },
          },
        };
      } catch (err) {
        settleFirstTokenErr(
          err instanceof Error ? err : new Error("Generation failed"),
        );
        if (!runSignal.aborted) {
          const msg = err instanceof Error ? err.message : String(err);
          if (err instanceof GenerationLengthError) {
            toast.error("Response ran out of tokens", {
              description:
                "The model used the full Max Tokens budget while thinking " +
                "and did not produce a final answer. Increase Max Tokens in " +
                "chat Settings or turn off thinking, then retry.",
              duration: 8000,
            });
          } else if (err instanceof StreamInterruptedError) {
            // Connection dropped mid-turn: surface it explicitly (the rethrow
            // below also marks the message with an inline error + Retry).
            toast.error("Response interrupted", {
              description:
                "The connection dropped before the model finished. " +
                "The partial answer is kept. Use Retry to regenerate.",
              duration: 8000,
            });
          } else if (isContextLimitError(msg)) {
            // llama-server runs with --no-context-shift, returning a hard
            // error instead of silently dropping old KV-cache turns. Point
            // the user at the control that raises the ceiling.
            toast.error("Context limit reached", {
              description:
                "The conversation has filled the model's context window. " +
                'Increase "Context Length" in the chat Settings panel (⚙ in the top-right), ' +
                "or start a new chat.",
              duration: 8000,
            });
          } else {
            toast.error("Generation failed", {
              description: msg || "Unknown error",
            });
          }
        }
        if (!abortSignal.aborted) {
          closeReasoningContent();
          const partialText = mergeContinuation(cumulativeText);
          const partialContent = buildAssistantContent(partialText);
          if (partialContent.length > 0) {
            const partialTiming = buildTiming(
              streamStartTime,
              totalChunks,
              firstTokenTime,
              Date.now() - streamStartTime,
              estimateTokenCount(partialText),
              toolCallParts.length,
            );
            yield {
              content: partialContent,
              metadata: {
                timing: partialTiming,
                custom: {
                  ...reasoningDurationTracker.metadata(),
                  // This partial is unfinished too, so it also offers Continue.
                  incomplete: {
                    reason:
                      err instanceof GenerationLengthError
                        ? "length"
                        : "interrupted",
                  },
                  timing: partialTiming,
                },
              },
            };
          }
        }
        throw err;
      } finally {
        runSignal.removeEventListener("abort", onAbortCancel);
        abortSignal.removeEventListener("abort", forwardAbort);
        // Resolve once: the clears below drop the owner the lookup keys on.
        const cleanupKey = liveThreadKey(serverCancel);
        const confirmStore = useChatRuntimeStore.getState();
        for (const part of toolCallParts) {
          confirmStore.clearToolConfirmation(part.toolCallId);
        }
        runtime.setGeneratingStatus(null);
        // Scoped by thread AND by run: a global clear wiped every other running chat's badge,
        // and an unowned one wiped a concurrent run's badge behind the same key.
        runtime.setToolStatus(cleanupKey, null, serverCancel);
        // Clear only this run's live keys (a concurrent pane owns its own). A
        // key still here streamed stdout but never reached tool_end (SSE drop or
        // cancel), so promote it to full output first, else the partial
        // diagnostics the user was watching vanish from the card.
        for (const liveKey of runToolLiveOutputKeys) {
          const store = useChatRuntimeStore.getState();
          const liveOutput = store.toolLiveOutput[liveKey] ?? "";
          if (liveOutput) {
            store.setToolFullOutput(liveKey, liveOutput);
          }
          store.clearToolLiveOutput(liveKey);
        }
        runToolLiveOutputKeys.clear();
        // Drop the transient denoising canvas so the finished bubble shows only the committed
        // answer. Scoped: a global clear wiped another denoising chat's frame.
        runtime.clearActiveDiffusionCanvasForThread(cleanupKey);
        clearTimeout(warmupTimer);
        if (waitingFirstChunk) {
          if (firstTokenSettled) {
            settleFirstTokenOk();
          } else if (runSignal.aborted) {
            settleFirstTokenErr(new Error("Cancelled"));
          } else {
            settleFirstTokenErr(new Error("No tokens received"));
          }
        }
        // serverCancel narrows both clears: runs with no resolved thread id share the "__default"
        // key, so a blind clear could drop a sibling's entry.
        runtime.setThreadRunning(cleanupKey, false, { owner: serverCancel });
        runtime.clearThreadServerCancel(cleanupKey, serverCancel);
      }
    },
  } satisfies ChatModelAdapter;
  return {
    async *run(args) {
      const preStreamThreadIds = preStreamRunThreadIdsForAdapter(
        args.unstable_threadId,
        useChatRuntimeStore.getState().activeThreadId,
      );
      const reservationToken = findPreStreamRunReservation(preStreamThreadIds);
      if (reservationToken) {
        adoptPreStreamRunReservation(reservationToken, preStreamThreadIds);
      }
      try {
        yield* adapter.run(args);
      } catch (error) {
        if (!args.abortSignal.aborted) {
          notifyPromptQueueRunFailed(
            args.unstable_threadId ?? preStreamThreadIds[0] ?? null,
          );
        }
        throw error;
      } finally {
        if (
          reservationToken &&
          releasePreStreamRunReservation(reservationToken)
        ) {
          notifyPromptQueueRunFailed(args.unstable_threadId ?? null);
        }
      }
    },
  };
}
