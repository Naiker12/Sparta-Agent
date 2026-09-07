import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeftIcon, ChevronRightIcon, ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import type { PdfRegion } from "../types/rag";
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

export function PdfPreview({
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

