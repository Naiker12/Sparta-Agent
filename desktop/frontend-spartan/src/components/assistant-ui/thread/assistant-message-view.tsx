/**
 * Sparta Agent - Vistas de Mensajes del Asistente y Usuario (assistant-message-view)
 * Renderizado integral de mensajes: burbujas de texto, editor de etiquetas (<THINK>/<TOOL>),
 * barra de continuación de streaming, indicadores de generación, denoising canvas y slot unificado.
 */

import {
  useEffect,
  useRef,
  type FC,
} from "react";
import { FastForwardIcon, HeadphonesIcon, RefreshCwIcon } from "lucide-react";
import {
  ActionBarPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  useAui,
  useAuiEvent,
  useAuiState,
} from "@assistant-ui/react";
import { toast } from "sonner";
import { UserMessageAttachments } from "@/components/assistant-ui/attachment";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { MessageHtmlArtifacts } from "@/components/assistant-ui/message-html-artifacts";
import { MessageResponseModelBadge } from "@/components/assistant-ui/message-response-details-sheet";
import {
  Reasoning,
  ReasoningGroup,
} from "@/components/assistant-ui/reasoning";
import { RagSourcesGroup } from "@/components/assistant-ui/rag-sources";
import { Sources, SourcesGroup } from "@/components/assistant-ui/sources";
import {
  proplessSlot,
  threadMessageKind,
} from "@/components/assistant-ui/thread-message-slot";
import { withToolConfirmation } from "@/components/assistant-ui/tool-confirmation-controls";
import { ToolFallback } from "@/components/assistant-ui/tool-fallback";
import { ToolGroup } from "@/components/assistant-ui/tool-group";
import { CodeExecutionToolUI } from "@/components/assistant-ui/tool-ui-code-execution";
import { EditFileToolUI } from "@/components/assistant-ui/tool-ui-edit-file";
import { ImageGenerationToolUI } from "@/components/assistant-ui/tool-ui-image-generation";
import { KnowledgeBaseToolUI } from "@/components/assistant-ui/tool-ui-knowledge-base";
import { PythonToolUI } from "@/components/assistant-ui/tool-ui-python";
import { RenderHtmlToolUI } from "@/components/assistant-ui/tool-ui-render-html";
import { TerminalToolUI } from "@/components/assistant-ui/tool-ui-terminal";
import { WebSearchToolUI } from "@/components/assistant-ui/tool-ui-web-search";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ThinkingAvatar } from "@/components/ui/blobatar-avatar";
import {
  findLatestUserAudioBase64,
  sentAudioNames,
} from "@/features/chat/api/chat-adapter";
import { ResearchMessage } from "@/features/chat/components/research-message";
import { useChatRuntimeStore } from "@/features/chat/stores/chat-runtime-store";
import { useT } from "@/i18n";
import {
  CONTINUATION_RUN_CONFIG_KEY,
  incompleteLabel,
  isContinuableContent,
  modeAllowsContinuation,
  readIncompleteInfo,
  readTextThoughtSignature,
} from "@/features/chat/utils/continuation";
import { extractTaggedText } from "@/features/chat/utils/update-thread-message";
import { updateThreadMessage } from "@/features/chat/utils/update-thread-message";
import {
  AssistantActionBar,
  BranchPicker,
  UserActionBar,
} from "./assistant-action-bar";
import {
  useActionBarFocusReveal,
  useResearchMessageRunId,
  useThreadResearchActive,
} from "./message-action-hooks";
import { useImeComposerInputHandlers } from "./use-ime-composer";

export const MessageError: FC = () => {
  const t = useT();
  const researchRunId = useResearchMessageRunId();
  const researchActive = useThreadResearchActive();
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="aui-message-error-root mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-destructive/10 p-3 text-destructive text-sm dark:bg-destructive/5 dark:text-red-200">
        <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2 min-w-0 flex-1" />
        {!researchRunId && !researchActive && (
          <ActionBarPrimitive.Reload asChild={true}>
            <button
              type="button"
              className="aui-message-error-retry inline-flex shrink-0 items-center gap-1.5 rounded-md border border-destructive/40 px-2.5 py-1 text-xs font-medium transition-colors hover:bg-destructive/15"
            >
              <RefreshCwIcon strokeWidth={1.75} className="size-3.5" />
              {t("chat.actions.retry")}
            </button>
          </ActionBarPrimitive.Reload>
        )}
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

export const GeneratingIndicator: FC = () => {
  const t = useT();
  const show = useAuiState(
    ({ message }) => {
      if (message.status?.type !== "running") return false;
      // A tool call makes `content` non-empty, which used to hide the only
      // live indicator while the assistant was still generating a document.
      // Keep it visible until either answer text or a reasoning stream exists.
      return !message.parts.some(
        (part) => part.type === "text" || part.type === "reasoning",
      );
    },
  );
  if (!show) {
    return null;
  }
  return (
    <span
      className="flex items-center gap-2 text-sm text-muted-foreground"
      role="status"
    >
      <ThinkingAvatar
        name="sparta-assistant"
        size={24}
        fallback={<Spinner className="size-4" />}
      />
      {t("chat.actions.generating")}
    </span>
  );
};

export const CancelledIndicator: FC = () => {
  const t = useT();
  const show = useAuiState(
    ({ message }) =>
      message.content.length === 0 &&
      message.status?.type === "incomplete" &&
      message.status?.reason === "cancelled",
  );
  if (!show) {
    return null;
  }
  return (
    <span className="aui-cancelled-indicator text-sm italic text-muted-foreground">
      {t("chat.actions.cancelled")}
    </span>
  );
};

export function assistantMessageText(
  content: readonly unknown[] | undefined,
): string {
  if (!content) {
    return "";
  }
  return content
    .filter(
      (part): part is { type: "text"; text: string } =>
        (part as { type?: string })?.type === "text" &&
        typeof (part as { text?: unknown })?.text === "string",
    )
    .map((part) => part.text)
    .join("");
}

export const ContinueMessageBar: FC = () => {
  const isLast = useAuiState(({ message }) => message.isLast);
  if (!isLast) {
    return null;
  }
  return <ContinueMessageBarForLastMessage />;
};

export const ContinueMessageBarForLastMessage: FC = () => {
  const t = useT();
  const aui = useAui();
  const messageId = useAuiState(({ message }) => message.id);
  const isLast = useAuiState(({ message }) => message.isLast);
  const isRunning = useAuiState(({ thread }) => thread.isRunning);
  const researchRunId = useResearchMessageRunId();
  const researchActive = useThreadResearchActive();
  const status = useAuiState(({ message }) => message.status);
  const metadata = useAuiState(({ message }) => message.metadata);
  const partial = useAuiState(({ message }) =>
    assistantMessageText(message.content),
  );
  const continuable = useAuiState(({ message }) =>
    isContinuableContent(message.content),
  );
  const thoughtSignature = useAuiState(({ message }) =>
    readTextThoughtSignature(message.content),
  );
  const fromAudioInput = useAuiState(({ thread }) =>
    Boolean(findLatestUserAudioBase64(thread.messages, false)),
  );
  const audioOutputModel = useChatRuntimeStore((s) => {
    const activeModel = s.models.find((m) => m.id === s.params.checkpoint);
    return Boolean(activeModel?.isAudio && !activeModel.hasAudioInput);
  });
  const deepResearchArmed = useChatRuntimeStore((s) => s.deepResearchEnabled);

  const stamped = readIncompleteInfo(metadata);
  const cancelled =
    status?.type === "incomplete" && status?.reason === "cancelled";
  const reason = cancelled ? ("cancelled" as const) : stamped?.reason;

  if (
    !reason ||
    !isLast ||
    isRunning ||
    researchRunId ||
    researchActive ||
    !continuable ||
    !modeAllowsContinuation({
      fromAudioInput,
      audioOutputModel,
      deepResearchArmed,
    }) ||
    !partial.trim()
  ) {
    return null;
  }

  const handleContinue = () => {
    const messages = aui.thread().getState().messages;
    const index = messages.findIndex((message) => message.id === messageId);
    if (index < 0) {
      return;
    }
    const parentId = index > 0 ? messages[index - 1].id : null;
    aui.thread().startRun({
      parentId,
      runConfig: {
        custom: {
          [CONTINUATION_RUN_CONFIG_KEY]: { partial, thoughtSignature },
        },
      },
    });
  };

  const incompleteText =
    reason === "length"
      ? t("chat.actions.incompleteLength")
      : reason === "cancelled"
        ? t("chat.actions.incompleteCancelled")
        : reason === "interrupted"
          ? t("chat.actions.incompleteInterrupted")
          : incompleteLabel(reason);

  return (
    <div className="aui-continue-bar mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md border border-border/70 bg-muted/50 p-2.5 text-sm">
      <span className="min-w-0 flex-1 text-muted-foreground">
        {incompleteText}.
      </span>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="h-7 shrink-0 gap-1.5 text-xs"
        onClick={handleContinue}
      >
        <FastForwardIcon strokeWidth={1.75} className="size-3.5" />
        {t("chat.actions.continue")}
      </Button>
    </div>
  );
};

export const WebSearchToolUIConfirmable = withToolConfirmation(WebSearchToolUI);
export const KnowledgeBaseToolUIConfirmable =
  withToolConfirmation(KnowledgeBaseToolUI);
export const PythonToolUIConfirmable = withToolConfirmation(PythonToolUI);
export const TerminalToolUIConfirmable = withToolConfirmation(TerminalToolUI);
export const EditFileToolUIConfirmable = withToolConfirmation(EditFileToolUI);
export const CodeExecutionToolUIConfirmable =
  withToolConfirmation(CodeExecutionToolUI);
export const ImageGenerationToolUIConfirmable = withToolConfirmation(
  ImageGenerationToolUI,
);
export const RenderHtmlToolUIConfirmable =
  withToolConfirmation(RenderHtmlToolUI);
export const ToolFallbackConfirmable = withToolConfirmation(ToolFallback);

export const ASSISTANT_PART_COMPONENTS = {
  Text: MarkdownText,
  Reasoning,
  ReasoningGroup,
  Source: Sources,
  ToolGroup: ToolGroup,
  tools: {
    by_name: {
      web_search: WebSearchToolUIConfirmable,
      search_knowledge_base: KnowledgeBaseToolUIConfirmable,
      python: PythonToolUIConfirmable,
      terminal: TerminalToolUIConfirmable,
      edit_file: EditFileToolUIConfirmable,
      code_execution: CodeExecutionToolUIConfirmable,
      image_generation: ImageGenerationToolUIConfirmable,
      render_html: RenderHtmlToolUIConfirmable,
    },
    Fallback: ToolFallbackConfirmable,
  },
} as const;

export const DiffusionCanvas: FC = () => {
  const isRunning = useAuiState(
    ({ message }) => message.status?.type === "running",
  );
  const threadKey =
    useAuiState(({ threadListItem }) => threadListItem.remoteId) ?? "__default";
  const canvas = useChatRuntimeStore(
    (s) => s.activeDiffusionCanvasByThreadId[threadKey],
  );
  if (!isRunning || !canvas) {
    return null;
  }
  const stepLabel =
    canvas.total > 0 ? `step ${canvas.step + 1}/${canvas.total}` : "denoising";
  return (
    <div className="aui-diffusion-canvas my-1.5 overflow-hidden rounded-lg border border-primary/20 bg-primary/[0.03]">
      <div className="flex items-center gap-2 border-b border-primary/10 px-3 py-1.5 text-ui-11 font-medium text-primary/80">
        <span className="inline-block size-1.5 animate-pulse rounded-full bg-primary" />
        <span>Denoising</span>
        <span className="opacity-60">
          block {canvas.block + 1} - {stepLabel}
        </span>
      </div>
      <pre className="max-h-[60dvh] overflow-auto whitespace-pre-wrap px-3 py-2 font-mono text-ui-12p5 leading-relaxed text-foreground/90">
        {canvas.text}
      </pre>
    </div>
  );
};

export const AssistantMessage: FC = () => {
  const t = useT();
  const aui = useAui();
  const focusReveal = useActionBarFocusReveal();
  const messageId = useAuiState(({ message }) => message.id);
  const messageContent = useAuiState(({ message }) => message.content);
  const researchRunId = useAuiState(({ message }) => {
    const custom = (
      message.metadata as { custom?: { researchRunId?: unknown } } | undefined
    )?.custom;
    return typeof custom?.researchRunId === "string"
      ? custom.researchRunId
      : null;
  });
  const incognito = useChatRuntimeStore((s) => s.incognito);

  const editingId = useChatRuntimeStore((s) => s.editingMessageId);
  const setEditingId = useChatRuntimeStore((s) => s.setEditingMessageId);
  const isEditing = editingId === messageId;

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }
  };

  useEffect(() => {
    if (isEditing) setTimeout(adjustHeight, 0);
  }, [isEditing]);

  const handleSave = async () => {
    const finalText = textareaRef.current?.value || "";
    const remoteId =
      aui.threadListItem().getState().remoteId ||
      useChatRuntimeStore.getState().activeThreadId;

    if (!remoteId || remoteId === "" || remoteId === "/") {
      toast.error(t("chat.actions.noThreadFound"));
      setEditingId(null);
      return;
    }

    try {
      await updateThreadMessage({
        thread: {
          export: () => aui.thread().export(),
          import: (data) => aui.thread().import(data),
        },
        messageId,
        remoteId,
        newText: finalText,
        isIncognito: incognito,
      });
    } catch (error) {
      console.error("UI: Error during save:", error);
      toast.error(t("chat.actions.saveFailed"));
    } finally {
      setEditingId(null);
    }
  };

  return (
    <MessagePrimitive.Root
      className="group/assistant-message aui-assistant-message-root relative mx-auto min-w-0 w-full max-w-(--thread-content-max-width) pt-0.5 pb-4 text-ui-15p5 [font-weight:410] tracking-[0.01em] dark:tracking-[0.02em]"
      data-role="assistant"
      tabIndex={0}
      ref={focusReveal.ref}
      onFocus={focusReveal.onFocus}
      onBlur={focusReveal.onBlur}
    >
      <div className="aui-assistant-message-content wrap-break-word min-w-0 text-[#0d0d0d] dark:text-foreground leading-relaxed">
        {isEditing ? (
          <div className="flex flex-col gap-2 w-full">
            <textarea
              ref={textareaRef}
              defaultValue={extractTaggedText(messageContent)}
              className="w-full p-3 rounded-xl bg-muted border border-border text-foreground focus:ring-1 focus:ring-ring outline-none overflow-y-auto resize-none font-mono text-sm max-h-[70dvh]"
              autoFocus
              onInput={adjustHeight}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                  handleSave();
                }
                if (e.key === "Escape") {
                  setEditingId(null);
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setEditingId(null)}
                className="h-8 text-xs"
              >
                {t("chat.actions.cancel")}
              </Button>
              <Button size="sm" onClick={handleSave} className="h-8 text-xs">
                {t("chat.actions.save")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="pointer-events-none relative h-0 min-w-0">
              <MessageResponseModelBadge className="absolute -top-6 left-0 max-w-[min(22rem,100%)]" />
            </div>
            {researchRunId ? (
              <ResearchMessage />
            ) : (
              <>
                <GeneratingIndicator />
                <CancelledIndicator />
                <DiffusionCanvas />
                <MessagePrimitive.Parts
                  components={ASSISTANT_PART_COMPONENTS}
                />
                <SourcesGroup />
                <RagSourcesGroup />
                <MessageHtmlArtifacts />
                <ContinueMessageBar />
              </>
            )}
            <MessageError />
          </>
        )}
      </div>

      <div className="aui-assistant-message-footer mt-1.5 -ml-[var(--icon-btn-inset)] flex min-h-8">
        <BranchPicker className="mr-0.5" />
        <AssistantActionBar />
      </div>

      <span
        className="aui-assistant-reveal-sentinel"
        tabIndex={0}
        aria-label="Message actions"
      />
    </MessagePrimitive.Root>
  );
};

export const UserMessageAudio: FC = () => {
  const audioName = useAuiState(({ message }) =>
    sentAudioNames.get(message.id),
  );
  if (!audioName) {
    return null;
  }
  return (
    <div className="col-start-2 flex justify-end">
      <div className="flex items-center gap-2 rounded-lg border border-foreground/20 bg-muted px-3 py-1.5 text-xs">
        <HeadphonesIcon className="size-3.5 text-muted-foreground" />
        <span className="max-w-48 truncate">{audioName}</span>
      </div>
    </div>
  );
};

export const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      className="aui-user-message-root fade-in slide-in-from-bottom-1 mx-auto flex w-full max-w-(--thread-content-max-width) animate-in flex-col items-end gap-y-2 pt-6 pb-4 text-ui-15p5 [font-weight:410] tracking-[0.01em] dark:tracking-[0.02em] duration-150"
      data-role="user"
    >
      <UserMessageAttachments />
      <UserMessageAudio />

      <div className="aui-user-message-content-wrapper flex max-w-[80%] min-w-0 flex-col items-end">
        <div className="aui-user-message-content wrap-break-word w-fit max-w-full rounded-[24px] bg-[#f5f5f5] px-4 py-2.5 text-[#0d0d0d] dark:text-foreground dark:bg-card">
          <MessagePrimitive.Parts />
        </div>
        <div className="mt-1 -mr-[var(--icon-btn-inset)] flex min-h-8 items-center">
          <UserActionBar />
          <BranchPicker className="aui-user-branch-picker ml-0.5" />
        </div>
      </div>
    </MessagePrimitive.Root>
  );
};

export const EditComposer: FC = () => {
  const t = useT();
  const aui = useAui();
  const { inputProps, isComposingRef } = useImeComposerInputHandlers();
  const resendAfterCancelRef = useRef(false);
  const researchActive = useThreadResearchActive();

  useAuiEvent("thread.runEnd", () => {
    if (!resendAfterCancelRef.current) {
      return;
    }
    resendAfterCancelRef.current = false;
    aui.composer().send();
  });

  return (
    <MessagePrimitive.Root className="aui-edit-composer-wrapper mx-auto flex w-full max-w-(--thread-content-max-width) flex-col py-3">
      <ComposerPrimitive.Root className="aui-edit-composer-root ml-auto flex w-full max-w-[85%] flex-col rounded-2xl bg-muted">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input min-h-14 w-full resize-none bg-transparent p-4 text-foreground text-sm font-[450] outline-none"
          autoFocus={true}
          dir="auto"
          {...inputProps}
        />
        <div className="aui-edit-composer-footer mx-3 mb-3 flex items-center gap-2 self-end">
          <ComposerPrimitive.Cancel asChild={true}>
            <Button type="button" variant="ghost" size="sm">
              {t("chat.actions.cancel")}
            </Button>
          </ComposerPrimitive.Cancel>
          <Button
            type="button"
            size="sm"
            disabled={researchActive}
            onClick={(event) => {
              if (isComposingRef.current) {
                event.preventDefault();
                return;
              }
              const newText = aui.composer().getState().text;
              const originalText = aui.message().getCopyText();

              if (newText === originalText) {
                aui.composer().cancel();
                return;
              }

              if (aui.thread().getState().isRunning) {
                resendAfterCancelRef.current = true;
                aui.thread().cancelRun();
                return;
              }
              aui.composer().send();
            }}
          >
            {t("chat.actions.update")}
          </Button>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  );
};

export const ThreadMessage: FC = () => {
  const role = useAuiState(({ message }) => message.role);
  const isEditing = useAuiState(({ message }) => message.composer.isEditing);
  switch (threadMessageKind(role, isEditing)) {
    case "edit":
      return <EditComposer />;
    case "user":
      return <UserMessage />;
    case "assistant":
      return <AssistantMessage />;
    default:
      return null;
  }
};

export const renderThreadMessage = proplessSlot(ThreadMessage);
