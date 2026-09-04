
import {
  CheckmarkCircle01Icon,
  Download01Icon,
  File02Icon,
  FolderOpenIcon,
  ViewIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { authFetch, getAuthToken } from "@/features/auth";
import { preloadDocumentPreview } from "@/features/rag/components/document-preview-mount";
import { useDocumentPreviewStore } from "@/features/rag/components/preview-store";
import { useT } from "@/i18n";
import { getAttachmentFileKind } from "@/lib/attachment-file-kind";
import { apiUrl, isTauri } from "@/lib/api-base";
import { downloadUrlStreaming, isDownloadCancelled } from "@/lib/native-files";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

import { sandboxFilePath, type SandboxFile } from "./sandbox-files";
import { revealSandbox } from "./sandbox-reveal";

// Browser previews buffer the full response and some parsers make another
// ArrayBuffer copy. Downloads are streamed, so leave large files downloadable
// but refuse to load them into the renderer.
const MAX_LOCAL_PREVIEW_BYTES = 25 * 1024 * 1024;

function formatSize(size: number | null): string {
  if (size === null || size === undefined || Number.isNaN(size)) return "";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 1024)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeLabel(
  t: ReturnType<typeof useT>,
  filename: string,
): string {
  switch (getAttachmentFileKind(filename)) {
    case "excel":
      return t("chat.files.excelWorkbook");
    case "pdf":
      return t("chat.files.pdfDocument");
    case "word":
      return t("chat.files.wordDocument");
    case "csv":
      return t("chat.files.csvFile");
    default:
      return t("chat.files.generatedFile");
  }
}

function SandboxFileRow({
  sessionId,
  file,
}: {
  sessionId: string;
  file: SandboxFile;
}) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const openLocalPreview = useDocumentPreviewStore(
    (state) => state.openLocalPreview,
  );

  const preview = useCallback(async () => {
    setPreviewing(true);
    preloadDocumentPreview();
    try {
      const path = sandboxFilePath(sessionId, file.name);
      const response = await authFetch(apiUrl(path));
      if (!response.ok) {
        throw new Error(t("chat.files.previewRefused", { status: response.status }));
      }
      const contentLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > MAX_LOCAL_PREVIEW_BYTES) {
        throw new Error(t("chat.files.previewTooLarge"));
      }
      const blob = await response.blob();
      if (blob.size > MAX_LOCAL_PREVIEW_BYTES) {
        throw new Error(t("chat.files.previewTooLarge"));
      }
      openLocalPreview({
        blob,
        filename: file.name,
        kind: getAttachmentFileKind(
          file.name,
          response.headers.get("content-type"),
        ),
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("chat.files.previewFailed", { filename: file.name }),
      );
    } finally {
      setPreviewing(false);
    }
  }, [file.name, openLocalPreview, sessionId, t]);

  // Streamed to the chosen path rather than buffered: a tool can write a
  // multi-gigabyte artifact, and a Blob plus its IPC copy would be two more of
  // it in the renderer. The bearer goes in the query: no headers are sent.
  const save = useCallback(async () => {
    setBusy(true);
    try {
      const path = sandboxFilePath(sessionId, file.name);
      // The bearer rides in the URL, so nothing refreshes it: an expired
      // access token would save a 401 body under the file's name. authFetch
      // refreshes and retries, and the HEAD settles that the file is there.
      const probe = await authFetch(apiUrl(path), { method: "HEAD" });
      if (!probe.ok) {
        throw new Error(t("chat.files.downloadRefused", { status: probe.status }));
      }
      const token = getAuthToken();
      const separator = path.includes("?") ? "&" : "?";
      // Absolute: the native command parses this and rejects a relative URL,
      // so a bare /api path failed before the request was made.
      const url = apiUrl(
        token ? `${path}${separator}token=${encodeURIComponent(token)}` : path,
      );
      await downloadUrlStreaming(url, file.name);
    } catch (error) {
      if (!isDownloadCancelled(error)) {
        toast.error(t("chat.files.downloadFailed", { filename: file.name }));
      }
    } finally {
      setBusy(false);
    }
  }, [file.name, sessionId, t]);

  return (
    <Card size="sm" className="w-full max-w-sm gap-2 py-3!">
      <CardHeader className="px-3 [.border-b]:pb-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div
            aria-hidden={true}
            className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"
          >
            <HugeiconsIcon icon={File02Icon} className="size-3.5" />
          </div>
          <div className="min-w-0">
            <CardTitle className="truncate font-mono text-ui-13p5">{file.name}</CardTitle>
            <CardDescription className="mt-0 text-xs">
              {fileTypeLabel(t, file.name)}
              {file.size !== null ? ` · ${formatSize(file.size)}` : ""}
            </CardDescription>
          </div>
        </div>
        <CardAction>
          <Badge variant="secondary">
            <HugeiconsIcon icon={CheckmarkCircle01Icon} data-icon="inline-start" />
            {t("chat.files.ready")}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="px-3">
        <SandboxFolderLabel sessionId={sessionId} label={t("chat.files.showFolder")} />
      </CardContent>
      <CardFooter className="gap-2 border-t pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={preview}
          disabled={previewing}
          aria-label={t("chat.files.previewFile", { filename: file.name })}
        >
          {previewing ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <HugeiconsIcon icon={ViewIcon} data-icon="inline-start" />
          )}
          {t("chat.files.preview")}
        </Button>
        <Button
          type="button"
          size="sm"
          onClick={save}
          disabled={busy}
          aria-label={t("chat.files.downloadFile", { filename: file.name })}
        >
          {busy ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <HugeiconsIcon icon={Download01Icon} data-icon="inline-start" />
          )}
          {t("chat.files.download")}
        </Button>
      </CardFooter>
    </Card>
  );
}

/**
 * The row's heading, doubling as the way into the folder itself on desktop.
 * The backend opens the file manager, so in a browser it stays plain text and
 * says why.
 */
function SandboxFolderLabel({
  sessionId,
  label,
}: {
  sessionId: string;
  label: string;
}) {
  const t = useT();
  const open = useCallback(() => {
    revealSandbox(sessionId).catch(() => {
      toast.error(t("chat.files.folderOpenFailed"));
    });
  }, [sessionId, t]);

  if (!isTauri) {
    return (
      <span
        className="text-xs font-medium text-muted-foreground"
        title={t("chat.files.folderBrowserOnly")}
      >
        {label}
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={open}
      title={t("chat.files.openFolder")}
      className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      <HugeiconsIcon icon={FolderOpenIcon} className="size-3.5 shrink-0" />
      {label}
    </button>
  );
}

/**
 * "Files created" row under a tool card. Without it the only trace of a written
 * file was the model mentioning it in prose.
 */
export function SandboxFiles({
  sessionId,
  files,
}: {
  sessionId: string;
  files: SandboxFile[];
}) {
  if (!sessionId || files.length === 0) return null;
  return (
    <div className="mt-3 flex max-w-md flex-col gap-2">
      {files.map((file) => (
        <SandboxFileRow key={file.name} sessionId={sessionId} file={file} />
      ))}
    </div>
  );
}
