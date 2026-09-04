import {
  getChatMessage,
  listChatMessages,
  saveChatMessage,
  syncChatMessages,
} from "../api/chat-api";
import { db } from "../db";
import type { MessageRecord } from "../types";
import { isChatThreadDeleted } from "../utils/chat-thread-tombstones";
import { isAssistantLocalThreadId } from "../utils/thread-ids";
import { isThreadIncognito } from "./storage-coordinator";

export async function listStoredChatMessages(
  threadId: string,
): Promise<MessageRecord[]> {
  if (isThreadIncognito(threadId)) return [];
  if (isChatThreadDeleted(threadId)) return [];

  // 1. Intentar consultar el backend primero
  try {
    const backendMessages = await listChatMessages(threadId);
    if (backendMessages && backendMessages.length > 0) {
      return backendMessages;
    }
  } catch (err) {
    // Si no es un error de ID local, registrar o seguir al fallback
    if (!isAssistantLocalThreadId(threadId)) {
      console.warn(`[MessageStorage] Backend fetch failed for ${threadId}:`, err);
    }
  }

  // 2. Fallback a Dexie (IndexedDB local)
  try {
    const legacyMessages = await db.messages
      .where("threadId")
      .equals(threadId)
      .toArray();
    if (legacyMessages && legacyMessages.length > 0) {
      return legacyMessages.filter((m) => !isChatThreadDeleted(m.threadId));
    }
  } catch {
    // Dexie no disponible o vacío
  }

  return [];
}

export async function getStoredChatMessage(
  threadId: string,
  messageId: string,
): Promise<MessageRecord | undefined> {
  if (isThreadIncognito(threadId)) return undefined;
  if (isChatThreadDeleted(threadId)) return undefined;

  try {
    const backendMessage = await getChatMessage(threadId, messageId);
    if (backendMessage) return backendMessage;
  } catch {
    // Ignorar y consultar Dexie
  }

  return (await db.messages.get(messageId).catch(() => undefined)) ?? undefined;
}

export async function saveStoredChatMessage(
  message: MessageRecord,
): Promise<MessageRecord> {
  if (isThreadIncognito(message.threadId)) return message;
  const saved = await saveChatMessage(message);
  await db.messages.put(saved).catch(() => {});
  return saved;
}

export async function syncStoredChatMessages(
  threadId: string,
  messages: MessageRecord[],
  options: { pruneMissing?: boolean } = {},
): Promise<MessageRecord[]> {
  if (isThreadIncognito(threadId)) return messages;
  const synced = await syncChatMessages(threadId, messages, options);
  await Promise.all(
    synced.map((msg) => db.messages.put(msg).catch(() => {})),
  );
  return synced;
}

export async function backfillStoredChatMessage(
  message: MessageRecord,
): Promise<void> {
  if (isThreadIncognito(message.threadId)) return;
  await saveChatMessage(message).catch(() => {});
  await db.messages.put(message).catch(() => {});
}
