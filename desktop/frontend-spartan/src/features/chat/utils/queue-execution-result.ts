/** Evidence from the final assistant message, not from the global busy flag. */
export type QueueExecutionResult = {
  status: "completed" | "failed" | "cancelled" | "needs_review";
  messageId: string | null;
  summary: string;
  reason: "completed" | "cancelled" | "error" | "incomplete" | "unknown";
};

type MessageEvidence = {
  id: string;
  role: string;
  content: readonly { type: string; text?: string }[];
  status?: { type: string; reason?: string };
  metadata?: { custom?: Record<string, unknown> };
};

export function queueExecutionResult(
  messages: readonly MessageEvidence[], beforeAppend: ReadonlySet<string> | null,
): QueueExecutionResult {
  const unknown: QueueExecutionResult = { status: "needs_review", messageId: null, summary: "", reason: "unknown" };
  if (!beforeAppend) return unknown;
  const message = [...messages].reverse().find((item) => item.role === "assistant" && !beforeAppend.has(item.id));
  if (!message) return unknown;
  const result = { ...unknown, messageId: message.id,
    summary: message.content.filter((part) => part.type === "text").map((part) => part.text ?? "").join("\n").slice(0, 2000) };
  if (message.status?.type === "incomplete") {
    if (message.status.reason === "cancelled") return { ...result, status: "cancelled", reason: "cancelled" };
    if (message.status.reason === "error") return { ...result, status: "failed", reason: "error" };
    return { ...result, reason: "incomplete" };
  }
  if (message.metadata?.custom?.incomplete) return { ...result, reason: "incomplete" };
  if (message.status?.type === "complete") return { ...result, status: "completed", reason: "completed" };
  return result;
}
