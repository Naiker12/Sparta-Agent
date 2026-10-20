import { useCallback, useMemo } from "react";
import {
  useAui,
  useAuiState,
  type ToolCallMessagePartComponent,
} from "@assistant-ui/react";
import { ResponsePanelDisplay } from "@/features/chat/response-ui/response-ui";
import { PanelControlsContext } from "@/features/chat/response-ui/panel-controls";
import {
  formSubmissionText,
  parsePanelResult,
  validateFormValues,
  type FormBlock,
  type FormValues,
} from "@/features/chat/response-ui/panels";
import { useChatPreferencesStore } from "@/features/chat/stores/chat-preferences-store";
import { useChatRuntimeStore } from "@/features/chat/stores/chat-runtime-store";
import { isAssistantLocalThreadId } from "@/features/chat/utils/thread-ids";
import { useT, useLocale } from "@/i18n";

export const PresentUiToolUI: ToolCallMessagePartComponent = ({
  result,
  status,
  toolCallId,
}) => {
  const t = useT();
  const locale = useLocale();
  const aui = useAui();
  const visual = useChatPreferencesStore((s) => s.visualResponses);
  const presentation = useMemo(() => parsePanelResult(result), [result]);
  const messageId = useAuiState((s) => s.message.id);
  const running = useAuiState((s) => s.thread.isRunning);
  const messages = useAuiState((s) => s.thread.messages);
  // Local runtime ids change on reload; stored message/call ids do not.
  const ownerId = useAuiState((s) => s.threadListItem.remoteId);
  const incognito = useChatRuntimeStore(s => s.incognito);
  const persistentOwner = ownerId && !isAssistantLocalThreadId(ownerId) ? ownerId : null;
  const draftScope = incognito ? undefined : JSON.stringify([persistentOwner, messageId, toolCallId]);
  const submissions = useMemo(
    () =>
      messages
        .filter((message) => {
          const submission = message.metadata.custom?.responseUiSubmission as
            | { messageId?: string; toolCallId?: string }
            | undefined;
          return (
            message.role === "user" &&
            submission?.messageId === messageId &&
            submission.toolCallId === toolCallId
          );
        })
        .map(
          (message) =>
            message.metadata.custom?.responseUiSubmission as {
              formId: string;
              values?: FormValues;
            },
        ),
    [messages, messageId, toolCallId],
  );
  const submitted = useMemo(
    () => new Set(submissions.map((entry) => entry.formId)),
    [submissions],
  );
  const submittedValues = useMemo(() => {
    const values = new Map<string, FormValues>();
    for (const entry of submissions) {
      const form = presentation?.panel.blocks.find(
        (block): block is FormBlock =>
          block.kind === "form" && block.id === entry.formId,
      );
      if (!form || !entry.values || typeof entry.values !== "object") continue;
      const checked = validateFormValues(form, entry.values);
      if (!checked.errors.length) values.set(entry.formId, checked.values);
    }
    return values;
  }, [submissions, presentation]);
  const onSubmit = useCallback(
    async (form: FormBlock, values: FormValues) => {
      if (!presentation || status?.type !== "complete")
        throw new Error("Panel not ready");
      const state = aui.thread.getState();
      const item = aui.threadListItem.getState();
      const selected = aui.threads.getState().mainThreadId;
      if (
        state.isRunning ||
        (selected !== item.id && selected !== item.remoteId)
      )
        throw new Error("Thread is unavailable");
      // Recheck immediately before append: stale clicks cannot submit twice or
      // send a form belonging to a different conversation.
      if (
        state.messages.some((message) => {
          const entry = message.metadata.custom?.responseUiSubmission as
            | Record<string, unknown>
            | undefined;
          return (
            message.role === "user" &&
            entry?.messageId === messageId &&
            entry.toolCallId === toolCallId &&
            entry.formId === form.id
          );
        })
      )
        return;
      const validated = validateFormValues(form, values);
      if (validated.errors.length) throw new Error("Invalid form values");
      await aui.thread.append({
        role: "user",
        content: [
          {
            type: "text",
            text: formSubmissionText(
              presentation.panel,
              form,
              validated.values,
              locale,
            ),
          },
        ],
        metadata: {
          custom: {
            responseUiSubmission: {
              messageId,
              toolCallId,
              formId: form.id,
              values: validated.values,
            },
          },
        },
      });
    },
    [aui, presentation, status?.type, messageId, toolCallId, locale],
  );
  const controls = useMemo(
    () => ({
      draftScope,
      disabled: running || status?.type !== "complete",
      submitted,
      submittedValues,
      onSubmit,
    }),
    [running, status?.type, submitted, submittedValues, onSubmit, draftScope],
  );
  if (!presentation)
    return (
      <p
        role={status?.type === "incomplete" ? "alert" : "status"}
        className="text-sm text-muted-foreground"
      >
        {t(
          status?.type === "running"
            ? "chat.responseUi.panelPreparing"
            : "chat.responseUi.panelUnavailable",
        )}
      </p>
    );
  const fallback = (
    <pre className="whitespace-pre-wrap break-words text-sm">
      {presentation.fallbackText}
    </pre>
  );
  return (
    <PanelControlsContext.Provider value={controls}>
      {visual ? (
        <ResponsePanelDisplay panel={presentation.panel}>
          {fallback}
        </ResponsePanelDisplay>
      ) : (
        fallback
      )}
    </PanelControlsContext.Provider>
  );
};
