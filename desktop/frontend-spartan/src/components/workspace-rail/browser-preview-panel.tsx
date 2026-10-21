import { useT as useUiT } from "@/i18n";
// Keep the panel outside the chat renderer initialization cycle.
// eslint-disable-next-line no-restricted-imports
import { useWorkspaceStore } from "@/features/chat/stores/use-workspace-store";
import { cn } from "@/lib/utils";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  LockIcon,
  RotateCwIcon,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { useT } from "@/i18n";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

export function BrowserPreviewPanel() {
  const uiT = useUiT();
  const t = useT();

  const browserUrl = useWorkspaceStore((state) => state.browserUrl);
  const browserReloadKey = useWorkspaceStore((state) => state.browserReloadKey);
  const browserHistoryIndex = useWorkspaceStore(
    (state) => state.browserHistoryIndex,
  );
  const browserHistory = useWorkspaceStore((state) => state.browserHistory);
  const navigateBrowser = useWorkspaceStore((state) => state.navigateBrowser);
  const browserGoBack = useWorkspaceStore((state) => state.browserGoBack);
  const browserGoForward = useWorkspaceStore((state) => state.browserGoForward);
  const browserReload = useWorkspaceStore((state) => state.browserReload);

  const [urlDraft, setUrlDraft] = useState({ base: browserUrl, value: browserUrl });
  const inputUrl = urlDraft.base === browserUrl ? urlDraft.value : browserUrl;

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let target = inputUrl.trim();
    if (!target) return;
    if (
      !(
        target.startsWith("http://") ||
        target.startsWith("https://") ||
        target.startsWith("about:")
      )
    ) {
      target = `http://${target}`;
    }
    navigateBrowser(target);
  };

  const handleReload = () => browserReload();

  const previewUrl = /^https?:\/\//i.test(browserUrl) ? browserUrl : null;

  const canGoBack = browserHistoryIndex > 0;
  const canGoForward = browserHistoryIndex < browserHistory.length - 1;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="px-3 py-3 border-b border-border/40">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={browserGoBack}
            disabled={!canGoBack}
            title={uiT("tour.back")}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={browserGoForward}
            disabled={!canGoForward}
            title={uiT("ui.go_forward")}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ArrowRightIcon className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleReload}
            title={uiT("settings.dialog.panelReload")}
            className={cn(
              "p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors",
            )}
          >
            <RotateCwIcon className="w-4 h-4" />
          </button>

          {/* URL Input Bar */}
          <form
            onSubmit={handleUrlSubmit}
            className="flex-1 relative flex items-center"
          >
            <div className="absolute left-3 flex items-center gap-1.5 pointer-events-none text-muted-foreground/60">
              {browserUrl.startsWith("https://") ? <LockIcon className="size-3.5" /> : null}
            </div>
            <input
              type="text"
              aria-label={t("chat.preview.browserAddress")}
              placeholder="https://"
              value={inputUrl}
              onChange={(e) => setUrlDraft({ base: browserUrl, value: e.target.value })}
              className="w-full pl-8 pr-8 py-1.5 text-xs rounded-full bg-muted/40 border border-border/40 font-mono text-foreground/90 focus:outline-none focus:ring-1 focus:ring-ring transition-all"
            />
          </form>
        </div>
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-background">
        {previewUrl ? (
          <BrowserPageFrame key={`${previewUrl}:${browserReloadKey}`} url={previewUrl} onRetry={browserReload} />
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{uiT("ui.no_preview_yet")}</EmptyTitle>
              <EmptyDescription>{t("chat.preview.browserEmpty")}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
}


function BrowserPageFrame({ url, onRetry }: { url: string; onRetry: () => void }) {
  const t = useT();
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  useEffect(() => {
    if (status !== "loading") return;
    const timeout = window.setTimeout(() => setStatus("error"), 15_000);
    return () => window.clearTimeout(timeout);
  }, [status]);
  return <div className="relative flex min-h-0 flex-1 flex-col">
    {status === "loading" && <div role="status" aria-live="polite" className="absolute inset-x-0 top-0 flex items-center justify-center gap-2 border-b bg-background p-3 text-sm text-muted-foreground"><Spinner className="size-4" />{t("chat.preview.browserLoading")}</div>}
    {status === "error" && <div className="absolute inset-x-0 top-0 p-3"><Alert><AlertTitle>{t("chat.preview.browserFailed")}</AlertTitle><AlertDescription><p>{t("chat.preview.browserFailedHelp")}</p><Button variant="outline" size="sm" onClick={onRetry}>{t("settings.dialog.panelReload")}</Button></AlertDescription></Alert></div>}
    <iframe src={url} onLoad={() => setStatus("loaded")} onError={() => setStatus("error")} title={t("chat.files.preview")} sandbox="allow-scripts allow-forms" className="h-full min-h-0 w-full flex-1 border-0 bg-background" />
  </div>;
}
