"use client";

import {
  Component,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/i18n";
import { DownloadIcon, Maximize2Icon, Minimize2Icon, XIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetCloseButton,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { getAttachmentIcon } from "@/lib/attachment-file-kind";
import { HugeiconsIcon } from "@hugeicons/react";
import { Suspense, lazy } from "react";
import { PreviewWorkspace } from "./preview-workspace";
import { PreviewToolbar, PreviewToolbarTarget } from "./preview-toolbar";
import { LocalSpreadsheetPreview } from "./spreadsheet-preview";
import { OfficeComponentBanner } from "./office-component-banner";
const PdfPreview = lazy(() =>
  import("./pdf-preview").then((m) => ({ default: m.PdfPreview })),
);
const WordPreview = lazy(() =>
  import("./word-preview").then((m) => ({ default: m.WordPreview })),
);
const RichPreview = lazy(() =>
  import("@/components/markdown/markdown-preview").then((m) => ({
    default: m.MarkdownPreview,
  })),
);
import { useWorkspaceStore } from "@/features/chat/stores/use-workspace-store";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { getDocumentFileUrl, getPreviewTarget } from "../api/rag-api";
import type { PreviewTarget } from "../types/rag";
import { type LocalPreview, useDocumentPreviewStore } from "./preview-store";

function LocalTextPreview({
  blob,
  filename,
  kind,
}: { blob: Blob; filename: string; kind: string }) {
  const t = useT();
  const [source, setSource] = useState(false);
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void blob
      .slice(0, 1024 * 1024)
      .text()
      .then((value) => !cancelled && setText(value))
      .catch(() => !cancelled && setText(t("chat.preview.textError")));
    return () => {
      cancelled = true;
    };
  }, [blob, t]);
  const markdown = /\.(md|markdown)$/i.test(filename);
  if (
    !source &&
    text !== null &&
    (markdown || kind === "code") &&
    blob.size <= 256 * 1024
  ) {
    const extension = filename.split(".").pop()?.toLowerCase() ?? "text";
    const languages: Record<string, string> = {
      py: "python",
      ts: "typescript",
      tsx: "tsx",
      js: "javascript",
      jsx: "jsx",
      json: "json",
      rs: "rust",
      sh: "bash",
      yml: "yaml",
      yaml: "yaml",
      html: "html",
      css: "css",
    };
    const fence = "`".repeat(
      Math.max(
        3,
        ...Array.from(text.matchAll(/`+/g), (match) => match[0].length + 1),
      ),
    );
    const content = markdown
      ? text
      : `${fence}${languages[extension] ?? "text"}\n${text}\n${fence}`;
    return (
      <div className="flex h-full flex-col">
        <PreviewToolbar>
          <Button size="sm" variant="ghost" onClick={() => setSource(true)}>
            {t("chat.preview.source")}
          </Button>
        </PreviewToolbar>
        <div className="min-h-0 flex-1">
          <Suspense
            fallback={<p className="p-5">{t("chat.preview.loading")}</p>}
          >
            <RichPreview
              markdown={content}
              className="h-full max-h-none rounded-none border-0 bg-background p-6 text-sm"
            />
          </Suspense>
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col">
      {source && (
        <PreviewToolbar>
          <Button size="sm" variant="ghost" onClick={() => setSource(false)}>
            {t("chat.files.preview")}
          </Button>
        </PreviewToolbar>
      )}
      {blob.size > 1024 * 1024 && (
        <p className="border-b p-2 text-xs text-muted-foreground">
          {t("chat.preview.textLimit")}
        </p>
      )}
      <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-xs leading-relaxed">
        {text ?? t("chat.preview.loading")}
      </pre>
    </div>
  );
}

/**
 * PDF.js can fetch a blob: URL through its worker. Electron's renderer does
 * not consistently expose those requests to the worker, which turns a valid
 * local file into an "Unexpected server response (0)" error. Give it the
 * downloaded bytes instead, while server-backed previews keep using a URL.
 */
function LocalPdfPreview({ blob }: { blob: Blob }) {
  const t = useT();
  const [data, setData] = useState<ArrayBuffer | null>(null);

  useEffect(() => {
    let cancelled = false;
    void blob
      .arrayBuffer()
      .then((buffer) => {
        if (!cancelled) {
          setData(buffer);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setData(new ArrayBuffer(0));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [blob]);

  if (data === null) {
    return (
      <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Spinner className="size-3.5" /> {t("chat.preview.loadingPdf")}
      </div>
    );
  }

  return <PdfPreview file={data} initialPage={1} regions={[]} />;
}

function OfficePdfPreview({ preview }: { preview: LocalPreview }) {
  const t = useT();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<ArrayBuffer | string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const bridge = (window as unknown as {
      electron?: { invoke: (channel: string, request: unknown) => Promise<{ ok: boolean; bytes?: Uint8Array; error?: string }> };
    }).electron;
    setResult(null);
    if (!bridge) { setResult("converter_missing"); return; }
    void preview.blob.arrayBuffer().then((buffer) => bridge.invoke("document:office-preview", {
      filename: preview.filename, bytes: new Uint8Array(buffer),
    })).then((value) => {
      if (!cancelled) setResult(value.ok && value.bytes ? Uint8Array.from(value.bytes).buffer : value.error ?? "conversion_failed");
    }).catch(() => { if (!cancelled) setResult("conversion_failed"); });
    return () => { cancelled = true; };
  }, [preview, attempt]);
  if (result instanceof ArrayBuffer) return <PdfPreview file={result} initialPage={1} regions={[]} />;
  if (result === "converter_missing") return <div className="p-6"><OfficeComponentBanner required onReady={() => setAttempt(value => value + 1)} /></div>;
  return <p role="status" className="p-6 text-sm text-muted-foreground">{t(
    result === null ? "chat.preview.convertingOffice" : result === "converter_missing"
      ? "chat.preview.officeConverterMissing" : "chat.preview.officeConversionError",
  )}</p>;
}

function LocalPreviewContent({ preview }: { preview: LocalPreview }) {
  const t = useT();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!["image", "video", "audio"].includes(preview.kind)) {
      return;
    }
    const objectUrl = URL.createObjectURL(preview.blob);
    // An object URL is an external resource owned and released by this effect.
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [preview]);
  if (preview.blob.size > 25 * 1024 * 1024) {
    return (
      <p className="p-6 text-sm text-muted-foreground">
        {t("chat.preview.localSafetyError")}
      </p>
    );
  }
  switch (preview.kind) {
    case "image":
      return url ? (
        <div className="flex h-full items-center justify-center overflow-auto p-4">
          <img
            src={url}
            alt={preview.filename}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      ) : null;
    case "video":
      return url ? (
        <video
          src={url}
          controls={true}
          playsInline={true}
          preload="metadata"
          className="h-full w-full object-contain"
        />
      ) : null;
    case "audio":
      return url ? (
        <div className="flex h-full items-center justify-center p-6">
          <audio
            src={url}
            controls={true}
            preload="metadata"
            className="w-full"
          />
        </div>
      ) : null;
    case "pdf":
      return <LocalPdfPreview blob={preview.blob} />;
    case "word":
      return /\.docx$/i.test(preview.filename)
        ? <WordPreview blob={preview.blob} /> : <OfficePdfPreview preview={preview} />;
    case "powerpoint":
      return <OfficePdfPreview preview={preview} />;
    case "excel":
    case "csv":
      return <LocalSpreadsheetPreview blob={preview.blob} />;
    case "code":
    case "text":
      return (
        <LocalTextPreview
          key={preview.filename}
          blob={preview.blob}
          filename={preview.filename}
          kind={preview.kind}
        />
      );
    default:
      return (
        <div className="p-6 text-sm text-muted-foreground">
          {t("chat.preview.unavailable")}
        </div>
      );
  }
}

/**
 * A parser or renderer must never take down the whole chat. Local files are
 * untrusted output from a tool, so contain a rendering exception to the panel
 * and leave the streamed download path available to the user.
 */
class LocalPreviewErrorBoundary extends Component<
  { preview: LocalPreview; message: string; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidUpdate(previous: { preview: LocalPreview }) {
    if (previous.preview !== this.props.preview && this.state.failed) {
      this.setState({ failed: false });
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="p-6 text-sm text-muted-foreground">
          {this.props.message}
        </div>
      );
    }
    return this.props.children;
  }
}

// Resizable preview width (px). Default matches the prior fixed 44rem; drag the
// left edge to widen. Persisted so it survives reopen.
const PREVIEW_WIDTH_KEY = "unsloth-rag-preview-width";
const MIN_PREVIEW_WIDTH = 384;
const DEFAULT_PREVIEW_WIDTH = 704;

function getAvailableContentWidth(): number {
  if (typeof window === "undefined") {
    return DEFAULT_PREVIEW_WIDTH;
  }

  // Measure where the left sidebar ends:
  let sidebarRight = 0;
  const insetEl = document.querySelector('[data-slot="sidebar-inset"]');
  if (insetEl) {
    sidebarRight = Math.max(0, insetEl.getBoundingClientRect().left);
  } else {
    const sidebarEl = document.querySelector('[data-sidebar="sidebar"]');
    if (sidebarEl) {
      sidebarRight = Math.max(0, sidebarEl.getBoundingClientRect().right);
    }
  }

  // Fallback on desktop if sidebar element isn't in DOM yet
  if (sidebarRight <= 0 && window.innerWidth >= 1024) {
    sidebarRight = 260;
  }

  // Right workspace rail width (48px / 3rem)
  const rightRailWidth = 48;

  const contentWidth = window.innerWidth - sidebarRight - rightRailWidth;
  return Math.max(MIN_PREVIEW_WIDTH, contentWidth);
}

const maxPreviewWidth = () => {
  if (typeof window === "undefined") {
    return DEFAULT_PREVIEW_WIDTH;
  }

  const availableContent = getAvailableContentWidth();
  // Keep at least 480px for the chat column so the composer stays usable,
  // and ensure the sheet NEVER expands into or overlaps the left sidebar.
  const minChatSpace = 480;
  const maxAllowed = availableContent - minChatSpace;

  return Math.max(MIN_PREVIEW_WIDTH, Math.round(maxAllowed));
};

const clampPreviewWidth = (w: number) =>
  Math.min(maxPreviewWidth(), Math.max(MIN_PREVIEW_WIDTH, Math.round(w)));

function readStoredPreviewWidth(): number {
  if (typeof window === "undefined") {
    return DEFAULT_PREVIEW_WIDTH;
  }
  let raw = 0;
  try {
    raw = Number(window.localStorage.getItem(PREVIEW_WIDTH_KEY));
  } catch {
    return DEFAULT_PREVIEW_WIDTH;
  }
  return Number.isFinite(raw) && raw > 0
    ? clampPreviewWidth(raw)
    : DEFAULT_PREVIEW_WIDTH;
}

function persistPreviewWidth(w: number) {
  try {
    window.localStorage.setItem(PREVIEW_WIDTH_KEY, String(Math.round(w)));
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
}

export function DocumentPreviewSheet() {
  const t = useT();
  const isMobile = useIsMobile();
  const [toolbarTarget, setToolbarTarget] = useState<HTMLDivElement | null>(null);
  const {
    open,
    revision,
    documentId,
    chunkId,
    filename,
    page,
    localPreview,
    closePreview,
    tabs,
    activeTabId,
    selectTab,
    closeTab,
  } = useDocumentPreviewStore();

  useEffect(() => {
    if (open) {
      useWorkspaceStore.getState().setOpen(false);
    }
  }, [open]);

  const [wide, setWide] = useState(() => window.innerWidth >= 1100);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1100px)");
    const update = () => setWide(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const [target, setTarget] = useState<PreviewTarget | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reserve room for the conversation on desktop; mobile remains modal.
  // Left-edge drag resizing of the panel.
  const [previewWidth, setPreviewWidth] = useState<number>(
    readStoredPreviewWidth,
  );
  useEffect(() => {
    if (!(open && wide)) {
      return;
    }
    const root = document.documentElement;
    root.style.setProperty("--document-preview-width", `${clampPreviewWidth(previewWidth)}px`);
    return () => {
      root.style.removeProperty("--document-preview-width");
    };
  }, [open, wide, previewWidth]);

  useEffect(() => {
    const handleResize = () => {
      setPreviewWidth((current) => clampPreviewWidth(current));
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  const [resizing, setResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const widthRef = useRef(previewWidth);
  useEffect(() => {
    widthRef.current = previewWidth;
  }, [previewWidth]);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startWidth: widthRef.current };
    setResizing(true);
  }, []);

  useEffect(() => {
    if (!resizing) {
      return;
    }
    const onMove = (e: MouseEvent) => {
      const start = resizeRef.current;
      if (!start) {
        return;
      }
      // Right-anchored panel: dragging left (smaller clientX) widens it.
      setPreviewWidth(
        clampPreviewWidth(start.startWidth + (start.startX - e.clientX)),
      );
    };
    const onUp = () => {
      setResizing(false);
      resizeRef.current = null;
      persistPreviewWidth(widthRef.current);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [resizing]);

  useEffect(() => {
    // Reset the remote request state when the source changes or closes.
    if (!(open && documentId)) {
      setLoading(false);
      setError(null);
      setTarget(null);
      setFileUrl(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTarget(null);
    setFileUrl(null);
    (async () => {
      try {
        const t = await getPreviewTarget(documentId, chunkId ?? undefined);
        if (cancelled) {
          return;
        }
        setTarget(t);
        if (t.mediaKind === "pdf") {
          const url = await getDocumentFileUrl(documentId);
          if (!cancelled) {
            setFileUrl(url);
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, documentId, chunkId]);

  const headerName =
    localPreview?.filename ??
    target?.filename ??
    filename ??
    t("chat.preview.document");
  const headerPage = target?.targetPage ?? page ?? null;

  return (
    <PreviewToolbarTarget.Provider value={toolbarTarget}>
    <Sheet modal={!wide} open={open} onOpenChange={(o) => !o && closePreview()}>
      <SheetContent
        side="right"
        aria-describedby={undefined}
        onInteractOutside={(event) => {
          if (wide) {
            event.preventDefault();
          }
        }}
        style={{
          width: clampPreviewWidth(previewWidth),
          maxWidth: isMobile ? "95vw" : `${maxPreviewWidth()}px`,
          right: isMobile ? 0 : "3rem",
        }}
        className={cn(
          "flex w-full flex-col gap-0 p-0 border-t border-r border-border overflow-hidden bg-background",
          resizing && "select-none",
        )}
        showCloseButton={false}
      >
        {/* Drag the left edge to widen the preview; double-click to reset. */}
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t("chat.preview.resize")}
          tabIndex={0}
          aria-valuemin={Math.min(MIN_PREVIEW_WIDTH, maxPreviewWidth())}
          aria-valuemax={maxPreviewWidth()}
          aria-valuenow={clampPreviewWidth(previewWidth)}
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) {
              return;
            }
            event.preventDefault();
            const width =
              event.key === "Home"
                ? clampPreviewWidth(DEFAULT_PREVIEW_WIDTH)
                : clampPreviewWidth(
                    previewWidth + (event.key === "ArrowLeft" ? 32 : -32),
                  );
            setPreviewWidth(width);
            persistPreviewWidth(width);
          }}
          onMouseDown={onResizeStart}
          onDoubleClick={() => {
            setPreviewWidth(DEFAULT_PREVIEW_WIDTH);
            persistPreviewWidth(DEFAULT_PREVIEW_WIDTH);
          }}
          className={cn(
            "absolute inset-y-0 left-0 z-20 w-2 cursor-col-resize transition-colors hover:bg-primary/25",
            resizing && "bg-primary/40",
          )}
        />
        <div role="tablist" aria-label={t("chat.preview.openDocuments")} className="flex min-h-11 shrink-0 items-center gap-1 overflow-x-auto border-b border-border bg-background px-2 py-1.5">
          {tabs.map((tab, index) => (
            <div key={tab.id} className={cn("flex min-w-0 max-w-64 shrink-0 items-center rounded-md border", activeTabId === tab.id ? "border-border bg-muted" : "border-transparent text-muted-foreground hover:bg-muted/50")}>
              <button type="button" role="tab" id={`preview-tab-${tab.id}`} aria-selected={activeTabId === tab.id} aria-controls="document-preview-content" tabIndex={activeTabId === tab.id ? 0 : -1} title={tab.filename ?? t("chat.preview.document")} onClick={() => selectTab(tab.id)} onKeyDown={(event) => {
                if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
                event.preventDefault();
                const next = event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
                selectTab(tabs[next].id);
                document.getElementById(`preview-tab-${tabs[next].id}`)?.focus();
              }} className="flex min-w-0 items-center gap-2 px-3 py-2 text-xs">
                <HugeiconsIcon icon={getAttachmentIcon(tab.filename ?? "")} className="size-3.5 shrink-0" />
                <span className="truncate">{tab.filename ?? t("chat.preview.document")}</span>
              </button>
              <Button size="icon-sm" variant="ghost" aria-label={t("chat.preview.closeTab", { filename: tab.filename ?? t("chat.preview.document") })} onClick={() => closeTab(tab.id)}><XIcon /></Button>
            </div>
          ))}
        </div>
        <SheetHeader className="flex-row items-center gap-2 border-b border-border bg-background px-3 py-2">
          <div className="min-w-0 flex-1">
            <SheetTitle className="flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-xs">
              <HugeiconsIcon
                icon={getAttachmentIcon(headerName)}
                className="size-4 shrink-0"
              />
              <span className="min-w-0 truncate" title={headerName}>{headerName}</span>
              {headerPage != null && (
                <span className="shrink-0 text-muted-foreground">
                  · {t("chat.preview.page", { page: headerPage })}
                </span>
              )}
            </SheetTitle>
          </div>
          <div ref={setToolbarTarget} className="flex min-w-0 shrink-0 items-center gap-0.5" />
          <div className="flex shrink-0 items-center gap-1">
            <div className="ml-auto flex items-center gap-1">
              {localPreview && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("chat.files.download")}
                  onClick={() => {
                    const url = URL.createObjectURL(localPreview.blob);
                    const anchor = document.createElement("a");
                    anchor.href = url;
                    anchor.download = localPreview.filename;
                    anchor.click();
                    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
                  }}
                >
                  <DownloadIcon data-icon="inline-start" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon-sm"
              aria-label={t("chat.preview.resize")}
              title={t("chat.preview.resize")}
                onClick={() =>
                  setPreviewWidth((current) =>
                    current >= maxPreviewWidth() - 10
                      ? clampPreviewWidth(DEFAULT_PREVIEW_WIDTH)
                      : maxPreviewWidth(),
                  )
                }
              >
                {previewWidth >= maxPreviewWidth() - 10 ? (
                  <Minimize2Icon data-icon="inline-start" />
                ) : (
                  <Maximize2Icon data-icon="inline-start" />
                )}
              </Button>
            </div>
          </div>
          <SheetCloseButton className="static shrink-0" />
        </SheetHeader>
        <PreviewWorkspace />

        <div id="document-preview-content" role="tabpanel" aria-labelledby={activeTabId ? `preview-tab-${activeTabId}` : undefined} className="min-h-0 flex-1">
          <Suspense
            fallback={
              <p className="p-6" role="status">
                {t("chat.preview.loading")}
              </p>
            }
          >
            {loading ? (
              <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
                <Spinner className="size-3.5" />{" "}
                {t("chat.preview.resolvingSource")}
              </div>
            ) : error ? (
              <div className="p-6 text-sm text-muted-foreground">
                {t("chat.preview.openError", { error })}
              </div>
            ) : localPreview ? (
              <LocalPreviewErrorBoundary
                preview={localPreview}
                message={t("chat.preview.localSafetyError")}
              >
                <LocalPreviewContent key={revision} preview={localPreview} />
              </LocalPreviewErrorBoundary>
            ) : target && target.mediaKind === "pdf" && fileUrl ? (
              <PdfPreview
                key={`${fileUrl}:${target.targetPage ?? 1}`}
                file={fileUrl}
                initialPage={target.targetPage ?? 1}
                regions={target.pdfRegions ?? []}
              />
            ) : target?.text ? (
              <div className="h-full overflow-auto bg-muted/20 p-6">
                <p className="mx-auto max-w-[48rem] whitespace-pre-wrap break-words rounded-xl border bg-background p-6 text-sm leading-7 sm:p-10">
                  {target.text}
                </p>
              </div>
            ) : (
              <div className="p-6 text-sm text-muted-foreground">
                {t("chat.preview.noSourcePreview")}
              </div>
            )}
          </Suspense>
        </div>
      </SheetContent>
    </Sheet>
    </PreviewToolbarTarget.Provider>
  );
}
