import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { ZoomInIcon, ZoomOutIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PreviewToolbar } from "./preview-toolbar";

/** Render Word's page layout in an isolated document, not the chat's theme. */
export function WordPreview({ blob }: { blob: Blob }) {
  const t = useT();
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const frame = useRef<HTMLIFrameElement>(null);
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    setHtml(null);
    setError(null);
    void (async () => {
      const { renderAsync } = await import("docx-preview");
      const body = document.createElement("div");
      const styles = document.createElement("div");
      await renderAsync(await blob.arrayBuffer(), body, styles, {
        useBase64URL: true, breakPages: true, ignoreLastRenderedPageBreak: false,
        renderAltChunks: false, renderComments: false, ignoreFonts: false,
      });
      if (cancelled) return;
      // No scripts, remote resources or navigation are allowed in the frame.
      setHtml(`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline';"><style>html{background:#202020}body{margin:0;padding:24px;box-sizing:border-box}.docx-wrapper{background:transparent!important;padding:0!important}.docx-wrapper>section.docx{background:white!important;color:black;box-shadow:0 2px 12px #0003;margin:0 auto 24px!important}*{box-sizing:border-box}</style>${styles.innerHTML}</head><body>${body.innerHTML}</body></html>`);
    })().catch((cause) => {
      console.error("[Spartan Word preview]", cause);
      if (!cancelled) setError(cause instanceof Error ? cause.message : String(cause));
    });
    return () => { cancelled = true; };
  }, [blob]);

  const fit = useCallback(() => {
    const doc = frame.current?.contentDocument;
    const page = doc?.querySelector<HTMLElement>("section.docx");
    if (!doc || !page || !host.current) return;
    doc.documentElement.style.background = getComputedStyle(document.documentElement).getPropertyValue("--background").trim();
    doc.documentElement.style.colorScheme = document.documentElement.classList.contains("dark") ? "dark" : "light";
    const pageWidth = page.offsetWidth;
    if (pageWidth) doc.body.style.zoom = String(Math.min(1, Math.max(0.2, (host.current.clientWidth - 48) / pageWidth)) * zoom);
  }, [zoom]);
  useEffect(() => {
    fit();
    if (!host.current) return;
    const observer = new ResizeObserver(fit);
    observer.observe(host.current);
    const themeObserver = new MutationObserver(fit);
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-palette"] });
    return () => { observer.disconnect(); themeObserver.disconnect(); };
  }, [fit, html]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PreviewToolbar>
        <Button variant="ghost" size="icon-sm" aria-label={t("chat.preview.zoomOut")} disabled={zoom <= 0.5} onClick={() => setZoom(value => Math.max(0.5, value - 0.25))}><ZoomOutIcon /></Button>
        <Button variant="ghost" size="sm" title={t("chat.preview.resetZoom")} onClick={() => setZoom(1)}>{Math.round(zoom * 100)} %</Button>
        <Button variant="ghost" size="icon-sm" aria-label={t("chat.preview.zoomIn")} disabled={zoom >= 2} onClick={() => setZoom(value => Math.min(2, value + 0.25))}><ZoomInIcon /></Button>
      </PreviewToolbar>
      <div ref={host} className="min-h-0 flex-1">
        {error ? <p className="p-6 text-sm text-muted-foreground">{t("chat.preview.wordError")}</p> : html ? (
          <iframe ref={frame} title={t("chat.files.wordDocument")} sandbox="allow-same-origin" referrerPolicy="no-referrer" srcDoc={html} onLoad={() => {
            frame.current?.contentDocument?.addEventListener("click", event => {
              if ((event.target as Element)?.closest?.("a")) event.preventDefault();
            });
            fit();
          }} className="h-full w-full border-0" />
        ) : <p role="status" className="p-6 text-sm text-muted-foreground">{t("chat.preview.loading")}</p>}
      </div>
    </div>
  );
}
