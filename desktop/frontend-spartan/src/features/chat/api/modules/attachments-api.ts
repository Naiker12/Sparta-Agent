import { authFetch } from "@/features/auth";
import { parseErrorText, parseJsonOrThrow } from "./base";

export interface ChatAttachmentRecord {
  id: string;
  messageId: string;
  threadId: string;
  pairId?: string | null;
  threadTitle?: string | null;
  name: string;
  type?: string | null;
  contentType?: string | null;
  sizeBytes?: number | null;
  createdAt?: number | null;
}

export interface ChatAttachmentPage {
  attachments: ChatAttachmentRecord[];
  nextOffset: number | null;
}

export async function listChatAttachments(
  offset = 0,
  limit = 50,
): Promise<ChatAttachmentPage> {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  const response = await authFetch(`/api/chat/attachments?${params}`);
  const data = await parseJsonOrThrow<{
    attachments: ChatAttachmentRecord[];
    nextOffset: number | null;
  }>(response);
  return {
    attachments: Array.isArray(data.attachments) ? data.attachments : [],
    nextOffset:
      typeof data.nextOffset === "number" && Number.isFinite(data.nextOffset)
        ? data.nextOffset
        : null,
  };
}

export async function fetchChatAttachmentBlob(
  messageId: string,
  attachmentId: string,
): Promise<Blob> {
  const response = await authFetch(
    `/api/chat/attachments/${encodeURIComponent(messageId)}/${encodeURIComponent(attachmentId)}/file`,
  );
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(parseErrorText(response.status, body));
  }
  return response.blob();
}

export async function deleteChatAttachment(
  messageId: string,
  attachmentId: string,
): Promise<void> {
  const response = await authFetch(
    `/api/chat/attachments/${encodeURIComponent(messageId)}/${encodeURIComponent(attachmentId)}`,
    { method: "DELETE" },
  );
  await parseJsonOrThrow<{ ok: boolean }>(response);
}
