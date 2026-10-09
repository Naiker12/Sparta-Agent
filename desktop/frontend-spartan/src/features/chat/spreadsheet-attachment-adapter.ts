import type { AttachmentAdapter, CompleteAttachment, PendingAttachment } from "@assistant-ui/react";
import { SPREADSHEET_ATTACHMENT_ACCEPT } from "./utils/document-attachment-accept";

type SpreadsheetResult = {
  sheets: { name: string; rows: string[][]; truncated: boolean }[];
  limited?: boolean;
  error?: string;
};

/** Bound the prompt independently of the worker's per-sheet preview limits. */
export function spreadsheetAttachmentText(result: SpreadsheetResult): string {
  if (result.error) throw new Error(result.error);
  const limit = 100000;
  let text = "";
  let clipped = Boolean(result.limited);
  for (const sheet of result.sheets) {
    text += `\n[Sheet: ${sheet.name}]\n`;
    clipped ||= sheet.truncated;
    for (const row of sheet.rows) {
      text += row.join("\t") + "\n";
      if (text.length >= limit) { clipped = true; break; }
    }
    if (text.length >= limit) break;
  }
  return text.slice(0, limit) + (clipped ? "\n[Partial spreadsheet: extraction limits reached]" : "");
}

export function readSpreadsheetAttachment(file: File, signal: AbortSignal): Promise<string> {
  if (signal.aborted) return Promise.reject(new DOMException("Cancelled", "AbortError"));
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("../rag/components/spreadsheet-preview.worker.ts", import.meta.url), { type: "module" });
    const finish = (error?: Error, text?: string) => {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      worker.terminate();
      if (error) reject(error); else resolve(text ?? "");
    };
    const cancel = () => finish(new DOMException("Cancelled", "AbortError"));
    const timer = setTimeout(() => finish(new Error("Spreadsheet reader timed out")), 15000);
    signal.addEventListener("abort", cancel, { once: true });
    worker.onmessage = ({ data }: MessageEvent<SpreadsheetResult>) => {
      try { finish(undefined, spreadsheetAttachmentText(data)); }
      catch (error) { finish(error instanceof Error ? error : new Error(String(error))); }
    };
    worker.onerror = () => finish(new Error("Could not read spreadsheet"));
    try { worker.postMessage(file); }
    catch (error) { finish(error instanceof Error ? error : new Error(String(error))); }
  });
}

export class SpreadsheetAttachmentAdapter implements AttachmentAdapter {
  accept = SPREADSHEET_ATTACHMENT_ACCEPT;
  private readonly pending = new Map<string, AbortController>();
  private readonly read: typeof readSpreadsheetAttachment;
  constructor(read = readSpreadsheetAttachment) { this.read = read; }

  async add({ file }: { file: File }): Promise<PendingAttachment> {
    return {
      id: crypto.randomUUID(), type: "document", name: file.name, contentType: file.type,
      file, status: { type: "requires-action", reason: "composer-send" },
    };
  }

  async send(attachment: PendingAttachment): Promise<CompleteAttachment> {
    this.pending.get(attachment.id)?.abort();
    const controller = new AbortController();
    this.pending.set(attachment.id, controller);
    try {
      const text = await this.read(attachment.file, controller.signal);
      if (controller.signal.aborted) throw new DOMException("Cancelled", "AbortError");
      return {
        id: attachment.id, type: "document", name: attachment.name, contentType: attachment.contentType,
        content: [{ type: "text", text: `[Spreadsheet: ${attachment.name}]\n${text}` }],
        status: { type: "complete" },
      };
    } finally {
      if (this.pending.get(attachment.id) === controller) this.pending.delete(attachment.id);
    }
  }

  async remove(attachment: { id: string }): Promise<void> {
    this.pending.get(attachment.id)?.abort();
    this.pending.delete(attachment.id);
  }
}
