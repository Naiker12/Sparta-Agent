import { projectHasSources } from "@/features/rag/api/rag-api";
import { getThreadWorkspace } from "../chat-api";
import {
  getStoredChatThread,
  isThreadIncognito,
} from "../../utils/chat-history-storage";
import { useChatRuntimeStore } from "../../stores/chat-runtime-store";
import { clampReasoningEffortToLevels } from "../../provider-capabilities";
import type { ThreadRecord } from "../../types";

export type ThreadRecordReader = () => Promise<ThreadRecord | undefined>;

const composerProjectByPendingThread = new Map<string, string | null>();

export function rememberComposerProjectForRun(
  threadId: string,
  projectId: string | null,
): void {
  if (isThreadIncognito(threadId)) return;
  if (!composerProjectByPendingThread.has(threadId)) {
    composerProjectByPendingThread.set(threadId, projectId);
  }
}

export async function resolveProjectId(
  threadId: string | undefined,
  readThreadRecord?: ThreadRecordReader,
  opts?: { rethrowReadFailure?: boolean; composerProjectId?: string | null },
): Promise<string | null> {
  const composerProjectId =
    opts?.composerProjectId !== undefined
      ? opts.composerProjectId
      : useChatRuntimeStore.getState().activeProjectId;
  if (threadId) {
    let thread: ThreadRecord | undefined;
    try {
      thread = await (readThreadRecord?.() ?? getStoredChatThread(threadId));
    } catch (error) {
      if (opts?.rethrowReadFailure) throw error;
      return null;
    }
    if (thread) {
      composerProjectByPendingThread.delete(threadId);
      return thread.projectId ?? null;
    }
    if (isThreadIncognito(threadId)) {
      return null;
    }
    const pending = composerProjectByPendingThread.get(threadId);
    if (pending !== undefined) {
      return pending;
    }
  }
  return composerProjectId ?? null;
}

export function buildLocalTokenCountReasoning(): Record<string, unknown> {
  const {
    supportsReasoning,
    reasoningStyle,
    reasoningEnabled,
    reasoningEffort,
    reasoningEffortLevels,
    supportsPreserveThinking,
    preserveThinking,
  } = useChatRuntimeStore.getState();

  const localReasoningEffort = clampReasoningEffortToLevels(
    reasoningEffort,
    reasoningEffortLevels,
  );
  return {
    ...(supportsReasoning
      ? reasoningStyle === "enable_thinking_effort"
        ? reasoningEnabled
          ? { enable_thinking: true, reasoning_effort: localReasoningEffort }
          : { enable_thinking: false }
        : reasoningStyle === "reasoning_effort"
          ? reasoningEnabled
            ? { reasoning_effort: localReasoningEffort }
            : {}
          : { enable_thinking: reasoningEnabled }
      : {}),
    ...(supportsPreserveThinking
      ? { preserve_thinking: preserveThinking }
      : {}),
  };
}

export async function buildLocalTokenCountExtras(
  threadId: string | undefined,
): Promise<Record<string, unknown>> {
  const {
    supportsTools,
    toolsEnabled,
    codeToolsEnabled,
    artifactsEnabled,
    mcpEnabledForChat,
    ragEnabled,
    ragSource,
    ragMode,
    ragTopK,
    autoHealToolCalls,
    bypassPermissions,
  } = useChatRuntimeStore.getState();
  if (!supportsTools) return {};

  const ragProjectId = await resolveProjectId(threadId);
  const projectRagEnabled = ragProjectId
    ? await projectHasSources(ragProjectId)
    : false;
  const workspaceEnabled = threadId
    ? Boolean(await getThreadWorkspace(threadId).catch(() => null))
    : false;
  const ragOn = ragEnabled || projectRagEnabled;
  if (
    !toolsEnabled &&
    !codeToolsEnabled &&
    !artifactsEnabled &&
    !mcpEnabledForChat &&
    !ragOn &&
    !workspaceEnabled
  ) {
    return { enable_tools: false, bypass_permissions: bypassPermissions };
  }

  return {
    enable_tools: true,
    auto_heal_tool_calls: autoHealToolCalls,
    bypass_permissions: bypassPermissions,
    enabled_tools: [
      ...(ragOn ? ["search_knowledge_base"] : []),
      ...(toolsEnabled ? ["web_search"] : []),
      ...(codeToolsEnabled ? ["python", "terminal", "edit_file"] : []),
      ...(workspaceEnabled
        ? [
            "list_directory",
            "read_file",
            "write_file",
            "create_file",
            "delete_path",
            "rename_path",
            "search_in_files",
          ]
        : []),
      ...(artifactsEnabled ? ["render_html"] : []),
    ],
    mcp_enabled: mcpEnabledForChat,
    ...(ragOn
      ? {
          rag_scope: {
            ...(ragEnabled && ragSource.type === "kb"
              ? { kb_id: ragSource.kbId }
              : {
                  ...(ragEnabled && threadId ? { thread_id: threadId } : {}),
                  ...(projectRagEnabled && ragProjectId
                    ? { project_id: ragProjectId }
                    : {}),
                }),
            default_top_k: ragTopK,
            mode: ragMode,
          },
        }
      : {}),
  };
}
