import { useMemo, type ReactNode } from "react";
import { useAuiState } from "@assistant-ui/react";
import { useLocale, useT } from "@/i18n";
import { useChatPreferencesStore } from "@/features/chat/stores/chat-preferences-store";
import { ResponsePanelDisplay } from "@/features/chat/response-ui/response-ui";
import { formatFormValue, parsePanelResult, validateFormValues, type FormBlock, type ResponsePanel } from "@/features/chat/response-ui/panels";

/** Derive the receipt from the original validated form, never from arbitrary UI metadata. */
export function UserFormSubmission({children}: {children: ReactNode}) {
  const locale = useLocale();
  const t = useT();
  const visual = useChatPreferencesStore(s => s.visualResponses);
  const submission = useAuiState(({message}) => message.metadata.custom?.responseUiSubmission);
  const messages = useAuiState(({thread}) => thread.messages);
  const summary = useMemo<ResponsePanel | null>(() => {
    if (!submission || typeof submission !== "object") return null;
    const entry = submission as Record<string, unknown>;
    const origin = messages.find(message => message.id === entry.messageId && message.role === "assistant");
    const tool = origin?.content.find(part => part.type === "tool-call" && part.toolCallId === entry.toolCallId);
    if (!tool || tool.type !== "tool-call" || tool.toolName !== "present_ui") return null;
    const result = parsePanelResult(tool.result);
    const form = result?.panel.blocks.find((block): block is FormBlock => block.kind === "form" && block.id === entry.formId);
    if (!form || !entry.values || typeof entry.values !== "object") return null;
    const checked = validateFormValues(form, entry.values as Record<string, unknown>);
    if (checked.errors.length) return null;
    return {
      version: 1, title: form.title, description: t("chat.responseUi.formSubmitted"), layout: "grid",
      blocks: form.fields.map(field => {
        const value = formatFormValue(field, checked.values[field.id], locale);
        return value.length <= 200
          ? {kind: "metric", label: field.label, value}
          : {kind: "text", text: `${field.label}\n${value}`};
      }),
    };
  }, [submission, messages, locale, t]);
  if (!visual || !summary) return children;
  return <ResponsePanelDisplay panel={summary}>{children}</ResponsePanelDisplay>;
}
