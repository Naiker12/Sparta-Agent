import type { ThreadMessage } from "@assistant-ui/react";
import type { MessageRecord } from "../types";
import { paneContextEvidence, PANE_EVIDENCE_LIMITS } from "./pane-context-evidence.ts";
import { cleanToolProtocolDisplay } from "./tool-protocol-display.ts";

/** Copy the visible branch plus inert evidence, with new ids and no execution state. */
export function copyPaneContext(
  messages: readonly ThreadMessage[], threadId: string,
  newId: () => string = () => crypto.randomUUID(), now = Date.now(),
  locale = "en",
): MessageRecord[] {
  const copied: MessageRecord[] = [];
  let evidenceBudget: number = PANE_EVIDENCE_LIMITS.totalChars;
  // Recent results explain the current task state; reserve their budget first
  // while keeping the copied conversation in its original chronological order.
  const evidenceByMessage: string[] = [];
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (message.role !== "user" && message.role !== "assistant") continue;
    const evidence = paneContextEvidence(message, locale.startsWith("es"), evidenceBudget);
    evidenceByMessage[index] = evidence;
    evidenceBudget = Math.max(0, evidenceBudget - evidence.length);
  }
  for (const [index, message] of messages.entries()) {
    if (message.role !== "user" && message.role !== "assistant") continue;
    const rawText = message.content
      .filter(part => part.type === "text")
      .map(part => part.type === "text" ? part.text : "").join("\n").trim();
    const text = cleanToolProtocolDisplay(rawText, message.role === "assistant" &&
      message.content.some(part => part.type === "tool-call")).trim();
    const evidence = evidenceByMessage[index] ?? "";
    if (!text && !evidence) continue;
    const content = [text, evidence].filter(Boolean).join("\n\n");
    copied.push({
      id: newId(), threadId, parentId: copied.at(-1)?.id ?? null,
      role: message.role, content: [{ type: "text", text: content }],
      createdAt: now + copied.length,
    });
  }
  return copied;
}
