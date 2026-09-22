import {
  Download01Icon,
  File02Icon,
  FolderOpenIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { Spinner } from "@/components/ui/spinner";
import { authFetch, getAuthToken } from "@/features/auth";
import { useWorkspaceStore } from "@/features/chat/stores/use-workspace-store";
import { preloadDocumentPreview } from "@/features/rag/components/document-preview-mount";
import { useDocumentPreviewStore } from "@/features/rag/components/preview-store";
import { useT } from "@/i18n";
import { apiUrl, isTauri } from "@/lib/api-base";
import { getAttachmentFileKind } from "@/lib/attachment-file-kind";
import { downloadUrlStreaming, isDownloadCancelled } from "@/lib/native-files";
import { ChevronRightIcon, GlobeIcon } from "lucide-react";

import { type SandboxFile, sandboxFilePath } from "./sandbox-files";
import { revealSandbox } from "./sandbox-reveal";

// Browser previews buffer the full response and some parsers make another
// ArrayBuffer copy. Downloads are streamed, so leave large files downloadable
// but refuse to load them into the renderer.
const MAX_LOCAL_PREVIEW_BYTES = 25 * 1024 * 1024;

function formatSize(size: number | null): string {
  if (size === null || size === undefined || Number.isNaN(size)) {
    return "";
  }
  if (size < 1024) {
    return `${size} B`;
  }
  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function fileTypeLabel(t: ReturnType<typeof useT>, filename: string): string {
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
  const [_previewing, setPreviewing] = useState(false);
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
        throw new Error(
          t("chat.files.previewRefused", { status: response.status }),
        );
      }
      const contentLength = Number(response.headers.get("content-length"));
      if (
        Number.isFinite(contentLength) &&
        contentLength > MAX_LOCAL_PREVIEW_BYTES
      ) {
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
        throw new Error(
          t("chat.files.downloadRefused", { status: probe.status }),
        );
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

  const isHtmlFile = file.name.endsWith(".html") || file.name.endsWith(".htm");

  const handleOpen = useCallback(() => {
    const path = sandboxFilePath(sessionId, file.name);
    const targetUrl = apiUrl(path);
    if (isHtmlFile) {
      useWorkspaceStore.getState().navigateBrowser(targetUrl, file.name);
    } else {
      preview();
    }
  }, [file.name, isHtmlFile, preview, sessionId]);

  return (
    <div
      onClick={handleOpen}
      className="group flex w-full max-w-[42rem] items-center justify-between gap-3 p-3.5 rounded-2xl border border-border/60 bg-card hover:bg-muted/40 hover:border-border hover:shadow-xs transition-all cursor-pointer select-none"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleOpen();
        }
      }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div
          aria-hidden={true}
          className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 group-hover:scale-105 transition-transform"
        >
          {isHtmlFile ? (
            <GlobeIcon className="size-5" />
          ) : (
            <HugeiconsIcon icon={File02Icon} className="size-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="truncate text-sm font-semibold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {file.name}
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            {isHtmlFile ? "Página web creada" : fileTypeLabel(t, file.name)}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            void save();
          }}
          disabled={busy}
          title={t("chat.files.download")}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
        >
          {busy ? (
            <Spinner className="size-4" />
          ) : (
            <HugeiconsIcon icon={Download01Icon} className="size-4" />
          )}
        </button>
        <div className="text-muted-foreground/60 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all">
          <ChevronRightIcon className="size-5" />
        </div>
      </div>
    </div>
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
        className="shrink-0 text-xs font-medium text-muted-foreground"
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
      className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
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
  if (!sessionId || files.length === 0) {
    return null;
  }
  return (
    <div className="mt-3 flex w-full max-w-[42rem] flex-col gap-2">
      {files.map((file) => (
        <SandboxFileRow key={file.name} sessionId={sessionId} file={file} />
      ))}
    </div>
  );
}
