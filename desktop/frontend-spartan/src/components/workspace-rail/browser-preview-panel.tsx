import { useSelectedChatArtifact } from "@/features/chat/artifacts/store";
import { useWorkspaceStore } from "@/features/chat/stores/use-workspace-store";
import { cn } from "@/lib/utils";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  GlobeIcon,
  LockIcon,
  RotateCwIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  ZapIcon,
} from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";

export function BrowserPreviewPanel() {
  const browserUrl = useWorkspaceStore((state) => state.browserUrl);
  const browserReloadKey = useWorkspaceStore((state) => state.browserReloadKey);
  const browserHistoryIndex = useWorkspaceStore(
    (state) => state.browserHistoryIndex,
  );
  const browserHistory = useWorkspaceStore((state) => state.browserHistory);
  const _setBrowserUrl = useWorkspaceStore((state) => state.setBrowserUrl);
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
    setIsLoading(true);
    browserReload();
    setTimeout(() => setIsLoading(false), 300);
  };

  const canGoBack = browserHistoryIndex > 0;
  const canGoForward = browserHistoryIndex < browserHistory.length - 1;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="px-5 pt-5 pb-3 border-b border-border/30">
        <h2 className="font-serif text-2xl font-bold tracking-tight text-foreground/90 mb-3">
          Vista previa web
        </h2>

        {/* Browser Navigation Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={browserGoBack}
            disabled={!canGoBack}
            title="Atrás"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ArrowLeftIcon className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={browserGoForward}
            disabled={!canGoForward}
            title="Adelante"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 disabled:opacity-30 disabled:pointer-events-none transition-colors"
          >
            <ArrowRightIcon className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleReload}
            title="Recargar"
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

      {/* Web Canvas Viewport */}
      <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-950 p-6">
        {selectedArtifact?.code ? (
          <iframe
            key={browserReloadKey}
            srcDoc={selectedArtifact.code}
            title="Artifact Preview"
            sandbox="allow-scripts allow-forms allow-same-origin"
            className="w-full h-full min-h-[500px] rounded-xl border border-border/40 shadow-xs"
          />
        ) : (
          /* Live Mockup Demo Web Page (As in Mockup 3) */
          <div className="flex flex-col max-w-2xl mx-auto text-slate-900 dark:text-slate-100 font-sans">
            {/* Nav */}
            <header className="flex items-center justify-between pb-8 pt-2">
              <div className="flex items-center gap-2 font-bold text-lg text-blue-600 dark:text-blue-400">
                <GlobeIcon className="w-5 h-5" />
                <span>MiSitio</span>
              </div>
              <nav className="flex items-center gap-5 text-xs text-muted-foreground font-medium">
                <span className="hover:text-foreground cursor-pointer transition-colors">
                  Inicio
                </span>
                <span className="hover:text-foreground cursor-pointer transition-colors">
                  Servicios
                </span>
                <span className="hover:text-foreground cursor-pointer transition-colors">
                  Nosotros
                </span>
                <span className="hover:text-foreground cursor-pointer transition-colors">
                  Contacto
                </span>
              </nav>
            </header>

            {/* Hero Section */}
            <main className="flex flex-col gap-6 py-6">
              <span className="inline-flex self-start px-3 py-1 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/40">
                Bienvenido
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div className="flex flex-col gap-4">
                  <h1 className="font-serif text-3xl md:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
                    Construye el futuro con nosotros
                  </h1>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Soluciones digitales que impulsan tu negocio. Diseño,
                    desarrollo y tecnología en un solo lugar.
                  </p>
                  <div>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all hover:scale-102"
                    >
                      Comenzar ahora →
                    </button>
                  </div>
                </div>

                {/* Illustration Card */}
                <div className="relative rounded-2xl bg-gradient-to-tr from-blue-100 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/30 p-8 flex items-center justify-center border border-blue-200/40 dark:border-blue-900/30">
                  <div className="w-32 h-24 rounded-lg bg-white dark:bg-zinc-900 shadow-md border border-border/50 flex flex-col items-center justify-center gap-2 p-2">
                    <div className="w-10 h-8 rounded bg-blue-50 dark:bg-blue-950/60 flex items-center justify-center">
                      <GlobeIcon className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="w-16 h-1.5 rounded-full bg-muted" />
                  </div>
                </div>
              </div>

              {/* 3 Value Props */}
              <div className="grid grid-cols-3 gap-4 pt-10 border-t border-border/30 text-left">
                <div className="flex flex-col gap-1.5">
                  <ZapIcon className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-foreground">Rápido</h3>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Tu sitio web siempre cargará en segundos.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <ShieldCheckIcon className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-foreground">Seguro</h3>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Protegemos lo que más te importa.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <SmartphoneIcon className="w-4 h-4 text-blue-600" />
                  <h3 className="text-xs font-bold text-foreground">
                    Responsivo
                  </h3>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    Se ve increíble en todos los dispositivos.
                  </p>
                </div>
              </div>
            </main>
          </div>
        )}
      </div>
    </div>
  );
}
