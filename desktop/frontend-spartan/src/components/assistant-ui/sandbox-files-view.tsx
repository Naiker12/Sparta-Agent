import { default as Download01Icon } from "@hugeicons/core-free-icons/Download01Icon";
import { default as File02Icon } from "@hugeicons/core-free-icons/File02Icon";
import { default as FolderOpenIcon } from "@hugeicons/core-free-icons/FolderOpenIcon";
import { HugeiconsIcon } from "@hugeicons/react";
import { useCallback, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Button } from "@/components/ui/button";
// Import leaf modules to avoid initializing the chat renderer/tool registry recursively.
// eslint-disable-next-line no-restricted-imports
import { useChatArtifactsStore } from "@/features/chat/artifacts/store";
// Import leaf modules to avoid initializing the chat renderer/tool registry recursively.
// eslint-disable-next-line no-restricted-imports
import { useChatRuntimeStore } from "@/features/chat/stores/chat-runtime-store";
import { buildSandboxPreview } from "./sandbox-preview";
import { toast } from "@/lib/toast";

import { Spinner } from "@/components/ui/spinner";
import { authFetch, getAuthToken } from "@/features/auth";
// Import leaf modules to avoid initializing the chat renderer/tool registry recursively.
// eslint-disable-next-line no-restricted-imports
import { preloadDocumentPreview } from "@/features/rag/components/document-preview-mount";
// Import leaf modules to avoid initializing the chat renderer/tool registry recursively.
// eslint-disable-next-line no-restricted-imports
import { useDocumentPreviewStore } from "@/features/rag/components/preview-store";
import { useT } from "@/i18n";
import { apiUrl, isTauri } from "@/lib/api-base";
import { getAttachmentFileKind } from "@/lib/attachment-file-kind";
import { downloadUrlStreaming, isDownloadCancelled } from "@/lib/native-files";
import { CodeIcon, ChevronRightIcon, GlobeIcon } from "lucide-react";

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
  const reduceMotion = useReducedMotion();
  const isHtmlFile = /\.html?$/i.test(file.name);
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const openLocalPreview = useDocumentPreviewStore(
    (state) => state.openLocalPreview,
  );

  const preview = useCallback(async (sourceOnly = false) => {
    setPreviewing(true);
    preloadDocumentPreview();
    try {
      const load = async (name: string) => {
        const response = await authFetch(apiUrl(sandboxFilePath(sessionId, name)));
        if (!response.ok) throw new Error(t("chat.files.previewRefused", { status: response.status }) + ` (${name})`);
        if (Number(response.headers.get("content-length")) > MAX_LOCAL_PREVIEW_BYTES) throw new Error(t("chat.files.previewTooLarge"));
        const blob = await response.blob();
        if (blob.size > MAX_LOCAL_PREVIEW_BYTES) throw new Error(t("chat.files.previewTooLarge"));
        return blob;
      };
      if (isHtmlFile && !sourceOnly) {
        const threadId = useChatRuntimeStore.getState().activeThreadId;
        const original = await load(file.name);
        const previewCode = await buildSandboxPreview(file.name, name => name === file.name ? Promise.resolve(original) : load(name));
        if (useChatRuntimeStore.getState().activeThreadId !== threadId) return;
        useChatArtifactsStore.getState().closeArtifactSurface();
        openLocalPreview({
          blob: original,
          filename: file.name,
          kind: "html",
          previewId: `sandbox:${sessionId}:${file.name}`,
          previewCode,
        });
        return;
      }
      const blob = await load(file.name);
      openLocalPreview({
        blob,
        filename: file.name,
        kind: getAttachmentFileKind(file.name),
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
  }, [file.name, isHtmlFile, openLocalPreview, sessionId, t]);

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

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18 }}
      className="group flex w-full max-w-[42rem] items-center gap-2 rounded-2xl border border-border/60 bg-card p-2"
      aria-busy={previewing}
    >
      <button
        type="button"
        disabled={previewing}
        onClick={() => void preview()}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-1.5 text-left hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-70"
        aria-label={`${t("chat.files.preview")}: ${file.name}`}
      >
        <span aria-hidden="true" className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          {previewing ? <Spinner className="size-5" /> : isHtmlFile ? <GlobeIcon className="size-5" /> : <HugeiconsIcon icon={File02Icon} className="size-5" />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-sm font-medium">{file.name}</span>
          <span className="truncate text-xs text-muted-foreground" role="status">
            {previewing ? t("chat.tools.preparingFile") : `${fileTypeLabel(t, file.name)}${formatSize(file.size) ? ` · ${formatSize(file.size)}` : ""}`}
          </span>
        </span>
        <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {isHtmlFile && <Button type="button" variant="ghost" size="icon-sm" onClick={() => void preview(true)} disabled={previewing} title={t("chat.files.sourceCode")} aria-label={t("chat.files.sourceCode")}><CodeIcon /></Button>}
      <Button type="button" variant="ghost" size="icon-sm" onClick={() => void save()} disabled={busy} title={t("chat.files.download")} aria-label={`${t("chat.files.download")}: ${file.name}`}>
        {busy ? <Spinner /> : <HugeiconsIcon icon={Download01Icon} />}
      </Button>
    </motion.div>
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
  const t = useT();
  if (!sessionId || files.length === 0) {
    return null;
  }
  return (
    <div className="mt-3 flex w-full max-w-[42rem] flex-col gap-2">
      <SandboxFolderLabel sessionId={sessionId} label={t("chat.files.outputFolder")} />
      {files.map((file) => (
        <SandboxFileRow key={file.name} sessionId={sessionId} file={file} />
      ))}
    </div>
  );
}
