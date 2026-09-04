"use client";

import {
  Component,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Document, Page, pdfjs } from "react-pdf";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  FileTextIcon,
  ZoomInIcon,
  ZoomOutIcon,
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
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getDocumentFileUrl, getPreviewTarget } from "../api/rag-api";
import type { PdfRegion, PreviewTarget } from "../types/rag";
import { type LocalPreview, useDocumentPreviewStore } from "./preview-store";

// Serve the pdf.js worker from the app origin.
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url,
).toString();

// Highlight rects; coords are 0..1 of the page box.
function RegionOverlay({ regions }: { regions: PdfRegion[] }) {
  if (regions.length === 0) return null;
  return (
    <>
      {regions.map((r, i) => (
        <div
          key={i}
          className="pointer-events-none absolute rounded-sm bg-amber-300/35 ring-1 ring-amber-500/70 mix-blend-multiply"
          style={{
            left: `${r.x * 100}%`,
            top: `${r.y * 100}%`,
            width: `${r.width * 100}%`,
            height: `${r.height * 100}%`,
          }}
        />
      ))}
    </>
  );
}

// Zoom multiplies fit-to-panel width: 1 = fit.
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.25;

const clampZoom = (z: number) =>
  Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Number(z.toFixed(2))));

function PdfPreview({
  fileUrl,
  initialPage,
  regions,
}: {
  fileUrl: string;
  initialPage: number;
  regions: PdfRegion[];
}) {
  const t = useT();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(0);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(initialPage);
  const [scale, setScale] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [grabbing, setGrabbing] = useState(false);
  const [scrollable, setScrollable] = useState(false);
  const panRef = useRef<{
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);

  // Reset page/zoom when a new citation reuses this viewer.
  useEffect(() => setPage(initialPage), [initialPage, fileUrl]);

  useEffect(() => setScale(1), [fileUrl]);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Non-passive wheel listener so preventDefault can stop the panel scrolling.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setScale((s) => clampZoom(s - Math.sign(e.deltaY) * ZOOM_STEP));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  const onLoad = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setPage((p) => Math.min(Math.max(p, 1), n));
  }, []);

  const zoomBy = useCallback(
    (delta: number) => setScale((s) => clampZoom(s + delta)),
    [],
  );

  // Whether the page overflows the panel (so panning matters).
  const recheckScrollable = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setScrollable(
      el.scrollWidth > el.clientWidth + 1 ||
        el.scrollHeight > el.clientHeight + 1,
    );
  }, []);

  useEffect(() => {
    recheckScrollable();
  }, [recheckScrollable, width, scale, page, numPages]);

  // Grab-to-pan; listen on window so the drag tracks past the panel edge.
  useEffect(() => {
    if (!grabbing) return;
    const onMove = (e: MouseEvent) => {
      const el = containerRef.current;
      const start = panRef.current;
      if (!el || !start) return;
      el.scrollLeft = start.left - (e.clientX - start.x);
      el.scrollTop = start.top - (e.clientY - start.y);
    };
    const onUp = () => {
      setGrabbing(false);
      panRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [grabbing]);

  const onPanStart = useCallback(
    (e: React.MouseEvent) => {
      const el = containerRef.current;
      if (!el || e.button !== 0 || !scrollable) return;
      panRef.current = {
        x: e.clientX,
        y: e.clientY,
        left: el.scrollLeft,
        top: el.scrollTop,
      };
      setGrabbing(true);
      e.preventDefault(); // stop canvas image-drag / selection
    },
    [scrollable],
  );

  const pageRegions = regions.filter(
    (r) => r.pageNumber === page || r.pageIndex === page - 1,
  );

  if (error) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t("chat.preview.pdfError", { error: error.slice(0, 240) })}
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div
        ref={containerRef}
        onMouseDown={onPanStart}
        className={cn(
          "flex-1 overflow-auto bg-muted/30 px-4 py-3",
          grabbing
            ? "cursor-grabbing select-none"
            : scrollable
              ? "cursor-grab"
              : "",
        )}
      >
        <Document
          file={fileUrl}
          onLoadSuccess={onLoad}
          onSourceError={(e) => setError(e.message)}
          onLoadError={(e) => setError(e.message)}
          loading={
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Spinner className="size-3.5" /> {t("chat.preview.loadingPdf")}
            </div>
          }
        >
          {width > 0 && (
            // min-w-fit lets the zoomed row grow past the panel so the page stays
            // centered and reachable on both sides.
            <div className="flex min-w-fit justify-center">
              <div className="relative w-fit shadow-sm">
                <Page
                  pageNumber={page}
                  width={(width - 8) * scale}
                  renderTextLayer={false}
                  renderAnnotationLayer={false}
                  onRenderSuccess={recheckScrollable}
                  onRenderError={(e) => setError(e.message)}
                />
                <RegionOverlay regions={pageRegions} />
              </div>
            </div>
          )}
        </Document>
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center border-t px-3 py-2 text-xs">
        <div className="flex items-center gap-0.5 justify-self-start">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={scale <= ZOOM_MIN}
            onClick={() => zoomBy(-ZOOM_STEP)}
            aria-label={t("chat.preview.zoomOut")}
          >
            <ZoomOutIcon className="size-4" />
          </Button>
          <button
            type="button"
            onClick={() => setScale(1)}
            className="w-11 text-center tabular-nums text-muted-foreground hover:text-foreground"
            aria-label={t("chat.preview.resetZoom")}
          >
            {Math.round(scale * 100)}%
          </button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={scale >= ZOOM_MAX}
            onClick={() => zoomBy(ZOOM_STEP)}
            aria-label={t("chat.preview.zoomIn")}
          >
            <ZoomInIcon className="size-4" />
          </Button>
        </div>
        {numPages > 1 ? (
          <div className="flex items-center gap-3 justify-self-center">
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label={t("chat.preview.previousPage")}
            >
              <ChevronLeftIcon className="size-4" />
            </Button>
            <span className="tabular-nums text-muted-foreground">
              {t("chat.preview.pageOf", { page, total: numPages })}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              disabled={page >= numPages}
              onClick={() => setPage((p) => Math.min(numPages, p + 1))}
              aria-label={t("chat.preview.nextPage")}
            >
              <ChevronRightIcon className="size-4" />
            </Button>
          </div>
        ) : (
          <span />
        )}
        <span aria-hidden />
      </div>
    </div>
  );
}

function LocalTextPreview({ blob }: { blob: Blob }) {
  const t = useT();
  const [text, setText] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void blob
      .text()
      .then((value) => !cancelled && setText(value))
      .catch(() => !cancelled && setText(t("chat.preview.textError")));
    return () => {
      cancelled = true;
    };
  }, [blob, t]);
  return (
    <pre className="h-full overflow-auto whitespace-pre-wrap break-words p-5 font-mono text-xs leading-relaxed">
      {text ?? t("chat.preview.loading")}
    </pre>
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

function LocalSpreadsheetPreview({ blob }: { blob: Blob }) {
  const t = useT();
  const [sheet, setSheet] = useState<{
    blob: Blob;
    name: string;
    rows: unknown[][];
  } | null>(null);
  const [error, setError] = useState<{ blob: Blob; message: string } | null>(
    null,
  );
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const XLSX = await import("xlsx");
      const workbook = XLSX.read(await blob.arrayBuffer(), { type: "array" });
      const sheets = workbook.SheetNames.map((name) => ({
        name,
        rows: XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], {
          header: 1,
          defval: "",
        }),
      }));
      // openpyxl and other generators often leave the initial "Sheet" empty
      // and write the actual report to the next worksheet. Preview the first
      // sheet with cells instead of showing an apparently blank panel.
      const selected = sheets.find(({ rows }) => rows.length > 0) ?? sheets[0];
      if (!selected) throw new Error("No sheets");
      if (!cancelled) {
        setSheet({
          blob,
          name: selected.name,
          rows: selected.rows.slice(0, 500),
        });
      }
    })().catch((reason: unknown) => {
      if (cancelled) return;
      setSheet({ blob, name: "", rows: [] });
      setError({
        blob,
        message: (reason instanceof Error && reason.message
          ? reason.message
          : t("chat.preview.unsupportedSpreadsheet")
        ).slice(0, 240),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [blob, t]);
  if (!sheet || sheet.blob !== blob)
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t("chat.preview.loading")}
      </div>
    );
  if (!sheet.name)
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t("chat.preview.spreadsheetError", {
          error:
            error?.blob === blob
              ? error.message
              : t("chat.preview.unknownError"),
        })}
      </div>
    );
  if (sheet.rows.length === 0)
    return (
      <div className="p-6 text-sm text-muted-foreground">
        {t("chat.preview.spreadsheetError", {
          error: t("chat.preview.emptySpreadsheet"),
        })}
      </div>
    );
  return (
    <div className="h-full overflow-auto p-5">
      <p className="mb-3 text-sm text-muted-foreground">
        {sheet.name}
        {sheet.rows.length === 500
          ? ` · ${t("chat.preview.firstRows", { count: 500 })}`
          : ""}
      </p>
      <Table className="text-xs">
        <TableBody>
          {sheet.rows.map((row, rowIndex) => (
            <TableRow key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <TableCell
                  key={cellIndex}
                  className="max-w-72 truncate p-2 align-top"
                >
                  {String(cell ?? "")}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LocalPreviewContent({ preview }: { preview: LocalPreview }) {
  const t = useT();
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (preview.kind !== "pdf") return;
    const objectUrl = URL.createObjectURL(preview.blob);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [preview]);
  switch (preview.kind) {
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
      return <LocalTextPreview blob={preview.blob} />;
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
  const raw = Number(window.localStorage.getItem(PREVIEW_WIDTH_KEY));
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
    documentId,
    chunkId,
    filename,
    page,
    localPreview,
    closePreview,
  } = useDocumentPreviewStore();
  const [target, setTarget] = useState<PreviewTarget | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Left-edge drag resizing of the panel.
  const [previewWidth, setPreviewWidth] = useState<number>(
    readStoredPreviewWidth,
  );
  const [resizing, setResizing] = useState(false);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const widthRef = useRef(previewWidth);
  widthRef.current = previewWidth;

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
    if (!open || !documentId) return;
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
    <Sheet open={open} onOpenChange={(o) => !o && closePreview()}>
      <SheetContent
        side="right"
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
        <SheetHeader className="gap-1 border-b p-4">
          <div className="relative">
            <SheetTitle className="flex items-center gap-2 pr-10 text-sm">
              <FileTextIcon className="size-4 shrink-0" />
              <span className="min-w-0 truncate">{headerName}</span>
              {headerPage != null && (
                <span className="shrink-0 text-muted-foreground">
                  · {t("chat.preview.page", { page: headerPage })}
                </span>
              )}
            </SheetTitle>
            <SheetCloseButton className="absolute top-1/2 right-0 -translate-y-1/2" />
          </div>
        </SheetHeader>

        <div className="min-h-0 flex-1">
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
              <LocalPreviewContent preview={localPreview} />
            </LocalPreviewErrorBoundary>
          ) : target && target.mediaKind === "pdf" && fileUrl ? (
            <PdfPreview
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
        </div>
      </SheetContent>
    </Sheet>
  );
}
