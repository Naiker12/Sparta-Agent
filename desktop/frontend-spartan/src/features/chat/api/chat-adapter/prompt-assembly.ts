import { getLocale } from "@/i18n";
import { sandboxSessionIdFor } from "@/components/assistant-ui/sandbox-files";
import { useChatRuntimeStore } from "../../stores/chat-runtime-store";
import { getStoredChatProject } from "../../storage/project-storage";
import { getStoredChatThread } from "../../storage/thread-storage";
import { getThreadWorkspace } from "../chat-api";
import type { ModelType } from "../../types";
import {
  buildCurrentTemporalContext,
  resolveSystemPromptVariables,
} from "./system-prompt";
import { resolveProjectId, type ThreadRecordReader } from "./token-counting";
import {
  isAnthropicRefusalMessage,
  toOpenAIMessages,
  type OpenAIChatMessage,
} from "./message-serialization";
import {
  CANVAS_FALLBACK_INSTRUCTION,
  CANVAS_TOOL_INSTRUCTION,
  type RunMessage,
  type RunMessages,
} from "./multimodal-detection";

export type OpenAIStreamAdapterOptions = {
  modelType?: ModelType;
  pairId?: string;
};

export const RESPONSE_LANGUAGE_BY_LOCALE = {
  en: "English",
  "zh-CN": "Simplified Chinese",
  ja: "Japanese",
  ko: "Korean",
  es: "Spanish",
  "pt-BR": "Brazilian Portuguese",
  fr: "French",
  de: "German",
  it: "Italian",
  ru: "Russian",
  hi: "Hindi",
  ar: "Arabic",
} as const;

/**
 * Mantiene el idioma de respuesta por defecto del modelo alineado con el idioma de la interfaz.
 */
export function defaultResponseLanguageInstruction(): string {
  const language = RESPONSE_LANGUAGE_BY_LOCALE[getLocale()];
  return [
    `Default to replying in ${language}.`,
    "Follow an explicit language requested by the user or existing system/project instructions instead.",
  ].join(" ");
}

export async function resolveProjectInstructions(
  threadId: string | undefined,
  readThreadRecord?: ThreadRecordReader,
): Promise<string> {
  const projectId = await resolveProjectId(threadId, readThreadRecord);
  if (!projectId) {
    return "";
  }

  const project = await getStoredChatProject(projectId).catch(() => null);
  if (!project || project.archived) {
    return "";
  }
  return project.instructions?.trim() ?? "";
}

/**
 * Informa al modelo de la existencia de un workspace sin filtrar rutas absolutas locales del usuario.
 */
export async function resolveProjectWorkspaceContext(
  threadId: string | undefined,
  _readThreadRecord?: ThreadRecordReader,
): Promise<string> {
  if (!threadId) return "";
  const workspace = await getThreadWorkspace(threadId).catch(() => null);
  if (!workspace) return "";
  const canWrite = workspace.access !== "read";
  return [
    "<thread_workspace>",
    `The user connected a ${workspace.access.replace(/_/g, "-")} workspace folder to this chat.`,
    canWrite
      ? "Use file tools only inside this workspace when the user requests file changes. Do not reveal or request its absolute local path."
      : "This workspace is read-only. Do not modify, create, rename, or delete its files. Do not reveal or request its absolute local path.",
    "</thread_workspace>",
  ].join("\n");
}

export async function resolveChatInstructions(
  threadId: string | undefined,
  systemPrompt: unknown,
  systemVariables: unknown,
  readThreadRecord?: ThreadRecordReader,
): Promise<string> {
  const safeSystemPrompt =
    typeof systemPrompt === "string"
      ? resolveSystemPromptVariables(
          systemPrompt,
          typeof systemVariables === "string" ? systemVariables : "",
        )
      : "";
  const projectInstructions = await resolveProjectInstructions(
    threadId,
    readThreadRecord,
  );
  const projectWorkspaceContext = await resolveProjectWorkspaceContext(
    threadId,
    readThreadRecord,
  );
  const responseLanguageInstruction = defaultResponseLanguageInstruction();
  return [
    projectInstructions
      ? `<project_instructions>\n${projectInstructions}\n</project_instructions>`
      : "",
    projectWorkspaceContext,
    safeSystemPrompt.trim(),
    buildCurrentTemporalContext(getLocale()),
    responseLanguageInstruction,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export async function resolveUseAdapter(
  threadId: string | undefined,
  options: OpenAIStreamAdapterOptions = {},
  readThreadRecord?: ThreadRecordReader,
): Promise<boolean | undefined> {
  if (options.modelType === "model1" || options.modelType === "model2") {
    return undefined;
  }
  if (
    options.pairId &&
    (options.modelType === "base" || options.modelType === "lora")
  ) {
    return options.modelType === "lora";
  }
  if (!threadId) {
    return undefined;
  }
  try {
    const thread = await (readThreadRecord?.() ??
      getStoredChatThread(threadId));
    if (!thread?.pairId) {
      return undefined;
    }
    if (thread.modelType === "model1" || thread.modelType === "model2") {
      return undefined;
    }
    return thread.modelType === "lora";
  } catch {
    return undefined;
  }
}

export async function resolveSandboxSessionId(
  threadId: string | undefined,
  readThreadRecord?: ThreadRecordReader,
): Promise<string | undefined> {
  const projectId = await resolveProjectId(threadId, readThreadRecord);
  return sandboxSessionIdFor(threadId, projectId);
}

/**
 * Ensambla la lista completa de mensajes salientes para la estimación de tokens y completion,
 * aplicando el filtrado de turnos rechazados, inyección de system prompt y directivas Canvas.
 */
export async function buildOutboundMessagesForTokenCount(
  messages: RunMessages,
  threadId: string | undefined,
): Promise<OpenAIChatMessage[]> {
  const survivingMessages: RunMessage[] = [];
  for (const message of messages) {
    if (isAnthropicRefusalMessage(message)) {
      const last = survivingMessages.at(-1);
      if (last && last.role === "user") survivingMessages.pop();
      continue;
    }
    survivingMessages.push(message);
  }

  const outboundMessages = survivingMessages
    .flatMap((message) => toOpenAIMessages(message, true))
    .filter((message): message is NonNullable<typeof message> =>
      Boolean(message),
    );

  const { params, artifactsEnabled, supportsTools } =
    useChatRuntimeStore.getState();
  const safeSystemPrompt =
    typeof params.systemPrompt === "string"
      ? resolveSystemPromptVariables(
          params.systemPrompt,
          typeof params.systemVariables === "string"
            ? params.systemVariables
            : "",
        )
      : "";
  const projectInstructions = await resolveProjectInstructions(threadId);
  const projectWorkspaceContext =
    await resolveProjectWorkspaceContext(threadId);
  const combinedSystemPrompt = [
    projectInstructions
      ? `<project_instructions>\n${projectInstructions}\n</project_instructions>`
      : "",
    projectWorkspaceContext,
    safeSystemPrompt.trim(),
    buildCurrentTemporalContext(getLocale()),
    defaultResponseLanguageInstruction(),
  ]
    .filter(Boolean)
    .join("\n\n");
  if (combinedSystemPrompt) {
    outboundMessages.unshift({
      role: "system",
      content: combinedSystemPrompt,
    });
  }

  const canvasInstruction = artifactsEnabled
    ? supportsTools
      ? CANVAS_TOOL_INSTRUCTION
      : CANVAS_FALLBACK_INSTRUCTION
    : "";
  if (canvasInstruction) {
    const first = outboundMessages[0];
    if (first && first.role === "system" && typeof first.content === "string") {
      outboundMessages[0] = {
        ...first,
        content: `${first.content}\n\n${canvasInstruction}`,
      };
    } else {
      outboundMessages.unshift({ role: "system", content: canvasInstruction });
    }
  }

  return outboundMessages as OpenAIChatMessage[];
}
