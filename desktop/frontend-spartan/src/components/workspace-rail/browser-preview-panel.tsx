import { useT as useUiT } from "@/i18n";
import { useSelectedChatArtifact } from "@/features/chat/artifacts/store";
import { useWorkspaceStore } from "@/features/chat/stores/use-workspace-store";
import { cn } from "@/lib/utils";
import { Empty, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  LockIcon,
  RotateCwIcon,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

export function BrowserPreviewPanel() {
  const uiT = useUiT();

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

  const selectedArtifact = useSelectedChatArtifact();
  const [inputUrl, setInputUrl] = useState(browserUrl);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setInputUrl(browserUrl);
  }, [browserUrl]);

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    let target = inputUrl.trim();
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

  const handleReload = () => {
    setIsLoading(
      Boolean(selectedArtifact?.code || /^https?:\/\//i.test(browserUrl)),
    );
    browserReload();
  };

  const previewUrl = /^https?:\/\//i.test(browserUrl) ? browserUrl : null;

  const canGoBack = browserHistoryIndex > 0;
  const canGoForward = browserHistoryIndex < browserHistory.length - 1;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="px-5 pt-5 pb-3 border-b border-border/30">
        <h2 className="font-serif text-2xl font-bold tracking-tight text-foreground/90 mb-3">
          {uiT("ui.web_preview")}
        </h2>

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
              isLoading && "animate-spin text-blue-500",
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
              <LockIcon className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              className="w-full pl-8 pr-8 py-1.5 text-xs rounded-full bg-muted/40 border border-border/40 font-mono text-foreground/90 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            />
          </form>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-950 p-6">
        {selectedArtifact?.code || previewUrl ? (
          <iframe
            key={browserReloadKey}
            srcDoc={selectedArtifact?.code || undefined}
            src={selectedArtifact?.code ? undefined : (previewUrl ?? undefined)}
            onLoad={() => setIsLoading(false)}
            title={uiT("ui.artifact_preview")}
            sandbox="allow-scripts allow-forms allow-same-origin"
            className="w-full h-full min-h-[500px] rounded-xl border border-border/40 shadow-xs"
          />
        ) : (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>{uiT("ui.no_preview_yet")}</EmptyTitle>
            </EmptyHeader>
          </Empty>
        )}
      </div>
    </div>
  );
}
