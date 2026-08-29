import type { OpenAIMessageContent } from "../../types/api";

type ReplayMessageWithExtra = {
  role: string;
  extra_content?: unknown;
};

export function buildReplayContent(
  textContent: string,
  imageParts: Array<{ type: "image_url"; image_url: { url: string } }>,
): OpenAIMessageContent {
  return imageParts.length > 0
    ? [{ type: "text", text: textContent }, ...imageParts]
    : textContent;
}

export function setAssistantCodexReasoning(
  message: ReplayMessageWithExtra,
  reasoning: unknown[] | undefined,
): void {
  if (!reasoning) return;
  const extra =
    message.extra_content &&
    typeof message.extra_content === "object" &&
    !Array.isArray(message.extra_content)
      ? (message.extra_content as Record<string, unknown>)
      : {};
  message.extra_content = { ...extra, openai_codex_reasoning: reasoning };
}

export function attachAssistantThoughtSignature(
  messages: ReplayMessageWithExtra[],
  thoughtSignature: string | undefined,
): void {
  if (!thoughtSignature) return;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role !== "assistant") continue;
    const extra =
      message.extra_content &&
      typeof message.extra_content === "object" &&
      !Array.isArray(message.extra_content)
        ? (message.extra_content as Record<string, unknown>)
        : {};
    const google =
      extra.google && typeof extra.google === "object" && !Array.isArray(extra.google)
        ? (extra.google as Record<string, unknown>)
        : {};
    message.extra_content = {
      ...extra,
      google: { ...google, thought_signature: thoughtSignature },
    };
    return;
  }
}
