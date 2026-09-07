"use client";

import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import {
  DownloadIcon,
  Maximize2Icon,
} from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/i18n";

import {
  Sheet,
  SheetCloseButton,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { LocalSpreadsheetPreview } from "./spreadsheet-preview";
import { HugeiconsIcon } from "@hugeicons/react";
import { getAttachmentIcon } from "@/lib/attachment-file-kind";
import { PreviewWorkspace } from "./preview-workspace";
import { lazy, Suspense } from "react";
const PdfPreview = lazy(() => import("./pdf-preview").then(m => ({ default: m.PdfPreview })));
const RichPreview = lazy(() => import("@/components/markdown/markdown-preview").then(m => ({ default: m.MarkdownPreview })));
import { cn } from "@/lib/utils";
import { getDocumentFileUrl, getPreviewTarget } from "../api/rag-api";
import type { PreviewTarget } from "../types/rag";
import { type LocalPreview, useDocumentPreviewStore } from "./preview-store";

function LocalTextPreview({ blob, filename, kind }: { blob: Blob; filename: string; kind: string }) {
  const t = useT();
  const [source, setSource] = useState(false);
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void blob.slice(0, 1024 * 1024)
      .text()
      .then((value) => !cancelled && setText(value))
      .catch(() => !cancelled && setText(t("chat.preview.textError")));
    return () => {
      cancelled = true;
    };
  }, [blob, t]);
  const markdown = /\.(md|markdown)$/i.test(filename);
  if (!source && text !== null && (markdown || kind === "code") && blob.size <= 256 * 1024) {
    const extension = filename.split(".").pop()?.toLowerCase() ?? "text";
    const languages: Record<string,string> = { py: "python", ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx", json: "json", rs: "rust", sh: "bash", yml: "yaml", yaml: "yaml", html: "html", css: "css" };
    const fence = "`".repeat(Math.max(3, ...Array.from(text.matchAll(/`+/g), match => match[0].length + 1)));
    const content = markdown ? text : `${fence}${languages[extension] ?? "text"}\n${text}\n${fence}`;
    return <div className="flex h-full flex-col"><div className="flex justify-end border-b px-3 py-1"><Button size="sm" variant="ghost" onClick={()=>setSource(true)}>{t("chat.preview.source")}</Button></div><div className="min-h-0 flex-1"><Suspense fallback={<p className="p-5">{t("chat.preview.loading")}</p>}><RichPreview markdown={content} className="h-full max-h-none rounded-none border-0 bg-background p-6 text-sm" /></Suspense></div></div>;
  }
  return (
    <div className="flex h-full flex-col">{source && <div className="flex justify-end border-b px-3 py-1"><Button size="sm" variant="ghost" onClick={()=>setSource(false)}>{t("chat.files.preview")}</Button></div>}{blob.size > 1024 * 1024 && <p className="border-b p-2 text-xs text-muted-foreground">{t("chat.preview.textLimit")}</p>}<pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-xs leading-relaxed">
      {text ?? t("chat.preview.loading")}
    </pre></div>
  );
}

function LocalWordPreview({ blob }: { blob: Blob }) {
  const t = useT();
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const mammoth = await import("mammoth");
      const result = await mammoth.convertToHtml({
        arrayBuffer: await blob.arrayBuffer(),
      });
      const document = new DOMParser().parseFromString(
        result.value,
        "text/html",
      );
      document
        .querySelectorAll("script, style, iframe, object, embed")
        .forEach((node) => node.remove());
      document.querySelectorAll("*").forEach((node) => {
        for (const attribute of Array.from(node.attributes)) {
          if (
            attribute.name.startsWith("on") ||
            (attribute.name === "href" &&
              attribute.value.trim().toLowerCase().startsWith("javascript:"))
          )
            node.removeAttribute(attribute.name);
        }
      });
      if (!cancelled) setHtml(document.body.innerHTML);
    })().catch(() => !cancelled && setHtml(""));
    return () => {
      cancelled = true;
    };
  }, [blob, t]);
  return html === null ? (
    <div className="p-6 text-sm text-muted-foreground">
      {t("chat.preview.loading")}
    </div>
  ) : html ? (
    <article
      className="h-full overflow-auto p-6 text-sm leading-relaxed [&_img]:max-w-full [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:p-2 [&_th]:border [&_th]:bg-muted [&_th]:p-2"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  ) : (
    <div className="p-6 text-sm text-muted-foreground">
      {t("chat.preview.wordError")}
    </div>
  );
}

function LocalPreviewContent({ preview }: { preview: LocalPreview }) {
  const t = useT();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!["pdf", "image", "video", "audio"].includes(preview.kind)) return;
    const objectUrl = URL.createObjectURL(preview.blob);
    // An object URL is an external resource owned and released by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [preview]);
  if (preview.blob.size > 25 * 1024 * 1024) return <p className="p-6 text-sm text-muted-foreground">{t("chat.preview.localSafetyError")}</p>;
  switch (preview.kind) {
    case "image":
      return url ? <div className="flex h-full items-center justify-center overflow-auto p-4"><img src={url} alt={preview.filename} className="max-h-full max-w-full object-contain" /></div> : null;
    case "video":
      return url ? <video src={url} controls playsInline preload="metadata" className="h-full w-full object-contain" /> : null;
    case "audio":
      return url ? <div className="flex h-full items-center justify-center p-6"><audio src={url} controls preload="metadata" className="w-full" /></div> : null;
    case "pdf":
      return url ? (
        <PdfPreview key={url} fileUrl={url} initialPage={1} regions={[]} />
      ) : null;
    case "word":
      return <LocalWordPreview blob={preview.blob} />;
    case "excel":
    case "csv":
      return <LocalSpreadsheetPreview blob={preview.blob} />;
    case "code":
    case "text":
      return <LocalTextPreview key={preview.filename} blob={preview.blob} filename={preview.filename} kind={preview.kind} />;
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

const maxPreviewWidth = () =>
  typeof window === "undefined"
    ? DEFAULT_PREVIEW_WIDTH
    : Math.round(window.innerWidth * 0.95);

const clampPreviewWidth = (w: number) =>
  Math.min(maxPreviewWidth(), Math.max(MIN_PREVIEW_WIDTH, Math.round(w)));

function readStoredPreviewWidth(): number {
  if (typeof window === "undefined") return DEFAULT_PREVIEW_WIDTH;
  let raw = 0;
  try { raw = Number(window.localStorage.getItem(PREVIEW_WIDTH_KEY)); } catch { return DEFAULT_PREVIEW_WIDTH; }
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
  const {
    open,
    revision,
    documentId,
    chunkId,
    filename,
    page,
    localPreview,
    closePreview,
  } = useDocumentPreviewStore();
  const [wide, setWide] = useState(() => window.innerWidth >= 1400);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 1400px)");
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
    if (!open || !wide) return;
    const root = document.documentElement;
    root.style.setProperty("--document-preview-width", `${previewWidth}px`);
    return () => { root.style.removeProperty("--document-preview-width"); };
  }, [open, wide, previewWidth]);
  const [resizing, setResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const widthRef = useRef(previewWidth);
  useEffect(() => { widthRef.current = previewWidth; }, [previewWidth]);

  const onResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = { startX: e.clientX, startWidth: widthRef.current };
    setResizing(true);
  }, []);

  useEffect(() => {
    if (!resizing) return;
    const onMove = (e: MouseEvent) => {
      const start = resizeRef.current;
      if (!start) return;
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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open || !documentId) { setLoading(false); setError(null); setTarget(null); setFileUrl(null); return; }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setTarget(null);
    setFileUrl(null);
    (async () => {
      try {
        const t = await getPreviewTarget(documentId, chunkId ?? undefined);
        if (cancelled) return;
        setTarget(t);
        if (t.mediaKind === "pdf") {
          const url = await getDocumentFileUrl(documentId);
          if (!cancelled) setFileUrl(url);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, documentId, chunkId]);

  const headerName =
    localPreview?.filename ?? target?.filename ?? filename ?? t("chat.preview.document");
  const headerPage = target?.targetPage ?? page ?? null;

  return (
    <Sheet modal={!wide} open={open} onOpenChange={(o) => !o && closePreview()}>
      <SheetContent
        side="right"
        aria-describedby={undefined}
        onInteractOutside={event => { if (wide) event.preventDefault(); }}
        style={{ width: previewWidth, maxWidth: "95vw" }}
        className={cn(
          "flex w-full flex-col gap-0 p-0",
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
          aria-valuenow={previewWidth}
          onKeyDown={event => {
            if (!["ArrowLeft", "ArrowRight", "Home"].includes(event.key)) return;
            event.preventDefault();
            const width = event.key === "Home" ? clampPreviewWidth(DEFAULT_PREVIEW_WIDTH) : clampPreviewWidth(previewWidth + (event.key === "ArrowLeft" ? 32 : -32));
            setPreviewWidth(width); persistPreviewWidth(width);
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
        <SheetHeader className="flex-row items-center gap-2 border-b px-3 py-2">
          <div className="min-w-0 flex-1">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <HugeiconsIcon icon={getAttachmentIcon(headerName)} className="size-4 shrink-0" />
              <span className="min-w-0 truncate">{headerName}</span>
              {headerPage != null && (
                <span className="shrink-0 text-muted-foreground">
                  · {t("chat.preview.page", { page: headerPage })}
                </span>
              )}
            </SheetTitle>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <div className="ml-auto flex items-center gap-1">
              {localPreview && <Button variant="ghost" size="icon-sm" aria-label={t("chat.files.download")} onClick={() => {
                const url = URL.createObjectURL(localPreview.blob);
                const anchor = document.createElement("a"); anchor.href = url; anchor.download = localPreview.filename; anchor.click();
                window.setTimeout(() => URL.revokeObjectURL(url), 1000);
              }}><DownloadIcon data-icon="inline-start" /></Button>}
              <Button variant="ghost" size="icon-sm" aria-label={t("chat.preview.resize")} onClick={()=>setPreviewWidth(current => current > DEFAULT_PREVIEW_WIDTH ? clampPreviewWidth(DEFAULT_PREVIEW_WIDTH) : maxPreviewWidth())}><Maximize2Icon data-icon="inline-start" /></Button>
            </div>
          </div>
          <SheetCloseButton className="static shrink-0" />
        </SheetHeader>
        <PreviewWorkspace />

        <div className="min-h-0 flex-1"><Suspense fallback={<p className="p-6" role="status">{t("chat.preview.loading")}</p>}>
          {loading ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Spinner className="size-3.5" /> {t("chat.preview.resolvingSource")}
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
              fileUrl={fileUrl}
              initialPage={target.targetPage ?? 1}
              regions={target.pdfRegions ?? []}
            />
          ) : target?.text ? (
            <div className="h-full overflow-auto p-5">
              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
                {target.text}
              </p>
            </div>
          ) : (
            <div className="p-6 text-sm text-muted-foreground">
              {t("chat.preview.noSourcePreview")}
            </div>
          )}
        </Suspense></div>
      </SheetContent>
    </Sheet>
  );
}
