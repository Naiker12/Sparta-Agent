import { authFetch } from "@/features/auth";
import { isAssistantLocalThreadId } from "../../utils/thread-ids";
import type { MessageRecord } from "../../types";
import {
  notifyChatHistoryUpdated,
  parseJsonOrThrow,
  threadWriteFetch,
} from "./base";

export async function listChatMessages(
  threadId: string,
): Promise<MessageRecord[]> {
  if (isAssistantLocalThreadId(threadId)) return [];
  const response = await authFetch(
    `/api/chat/threads/${encodeURIComponent(threadId)}/messages`,
  );
  if (response.status === 404) return [];
  const data = await parseJsonOrThrow<{ messages: MessageRecord[] }>(response);
  return Array.isArray(data.messages) ? data.messages : [];
}

export async function batchListChatMessages(
  threadIds: string[],
): Promise<Map<string, MessageRecord[]>> {
  const out = new Map<string, MessageRecord[]>();
  if (threadIds.length === 0) return out;
  const response = await authFetch("/api/chat/messages:batch", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ threadIds }),
  });
  if (response.status === 404 || response.status === 405) {
    const per = await Promise.all(
      threadIds.map(async (id) => [id, await listChatMessages(id)] as const),
    );
    for (const [id, msgs] of per) out.set(id, msgs);
    return out;
  }
  const data = await parseJsonOrThrow<{
    messagesByThreadId: Record<string, MessageRecord[]>;
  }>(response);
  for (const id of threadIds) {
    out.set(id, data.messagesByThreadId[id] ?? []);
  }
  return out;
}

export async function getChatMessage(
  threadId: string,
  messageId: string,
): Promise<MessageRecord | null> {
  const response = await authFetch(
    `/api/chat/threads/${encodeURIComponent(threadId)}/messages/${encodeURIComponent(messageId)}`,
  );
  if (response.status === 404) return null;
  return parseJsonOrThrow<MessageRecord>(response);
}

export async function saveChatMessage(
  message: MessageRecord,
): Promise<MessageRecord> {
  const response = await authFetch(
    `/api/chat/threads/${encodeURIComponent(message.threadId)}/messages/${encodeURIComponent(message.id)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message),
    },
  );
  const savedMessage = await parseJsonOrThrow<MessageRecord>(response);
  notifyChatHistoryUpdated();
  return savedMessage;
}

export async function syncChatMessages(
  threadId: string,
  messages: MessageRecord[],
  options: { pruneMissing?: boolean } = {},
): Promise<MessageRecord[]> {
  const response = await threadWriteFetch(
    `/api/chat/threads/${encodeURIComponent(threadId)}/messages`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages,
        pruneMissing: options.pruneMissing ?? false,
      }),
    },
  );
  const data = await parseJsonOrThrow<{ messages: MessageRecord[] }>(response);
  notifyChatHistoryUpdated();
  return data.messages;
}
