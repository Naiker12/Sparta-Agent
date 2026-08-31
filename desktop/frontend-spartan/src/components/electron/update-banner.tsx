import { Button } from "@/components/ui/button";
import { ReleaseNotesPanel } from "@/components/update/release-notes-panel";
import { useElectronUpdate } from "@/hooks/use-electron-update";
import { useT } from "@/i18n";
import { Download, RefreshCcw, RotateCw, Sparkles, X } from "lucide-react";
import { type ReactElement, useEffect, useState } from "react";

interface ElectronUpdateBannerProps {
  enabled?: boolean;
}

export function ElectronUpdateBanner({ enabled = true }: ElectronUpdateBannerProps): ReactElement | null {
  const { available, state, check, download, installAndRestart } = useElectronUpdate();
  const t = useT();
  const [showNotes, setShowNotes] = useState(false);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  useEffect(() => {
    if (state.version && dismissedVersion && state.version !== dismissedVersion) {
      setDismissedVersion(null);
    }
  }, [dismissedVersion, state.version]);

  if (!enabled || !available || state.stage === "idle" || state.stage === "checking" || state.stage === "not-available") return null;

  if (dismissedVersion === (state.version ?? "unknown")) {
    return (
      <button
        type="button"
        onClick={() => setDismissedVersion(null)}
        className="pointer-events-auto relative flex size-12 items-center justify-center rounded-full border border-border/70 bg-card text-primary shadow-xl transition-transform hover:scale-105"
        aria-label={t("update.newVersionTitle")}
        data-testid="electron-update-minimized"
      >
        {state.stage === "downloading" ? (
          <span className="text-[10px] font-semibold">{state.percent ?? 0}%</span>
        ) : (
          <Download className="size-5" />
        )}
        <span className="absolute right-0.5 top-0.5 size-2.5 rounded-full bg-primary ring-2 ring-card" />
      </button>
    );
  }

  return (
    <div className="pointer-events-auto flex w-[calc(100vw-2rem)] max-w-[448px] flex-col rounded-[20px] border border-border/70 bg-card p-5 shadow-2xl backdrop-blur-xl" data-testid="electron-update-banner">
      <div className="flex min-w-0 items-start gap-3.5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Sparkles className="size-5" /></div>
        <div className="min-w-0 flex-1">
          <p className="font-heading text-base font-semibold text-foreground">
            {state.stage === "downloaded"
              ? t("update.readyToInstall", { version: state.version ?? "" })
              : state.stage === "installing"
                ? t("update.installing")
                : t("update.newVersionTitle")}
          </p>
          {state.version && <p className="mt-0.5 text-xs text-muted-foreground">v{state.version}</p>}
        </div>
        {state.stage !== "installing" && (
          <Button
            size="icon"
            variant="ghost"
            className="-mr-2 -mt-2 size-8 shrink-0 rounded-full"
            onClick={() => setDismissedVersion(state.version ?? "unknown")}
            aria-label={t("update.dismiss")}
          >
            <X className="size-4" />
          </Button>
        )}
      </div>
      {state.version && <ReleaseNotesPanel version={state.version} open={showNotes} fallbackMarkdown={state.releaseNotes} />}
      {state.stage === "available" && (
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/40 pt-3">
          <Button size="sm" variant="ghost" onClick={() => setShowNotes((value) => !value)}>{showNotes ? t("update.hideReleaseNotes") : t("update.showReleaseNotes")}</Button>
          <Button size="sm" className="gap-1.5" onClick={() => void download()}><Download className="size-3.5" />{t("update.downloadInBackground")}</Button>
        </div>
      )}
      {state.stage === "downloading" && <div className="mt-4"><div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all" style={{ width: `${state.percent ?? 0}%` }} /></div><p className="mt-1 text-xs text-muted-foreground">{state.percent ?? 0}%</p></div>}
      {state.stage === "downloaded" && <div className="mt-4 flex justify-end border-t border-border/40 pt-3"><Button size="sm" className="gap-1.5" onClick={() => void installAndRestart()}><RefreshCcw className="size-3.5" />{t("update.installAndRestart")}</Button></div>}
      {state.stage === "installing" && <div className="mt-4 flex items-center gap-2 border-t border-border/40 pt-3 text-xs text-muted-foreground"><RotateCw className="size-3.5 animate-spin" />{t("update.preparingRestart")}</div>}
      {state.stage === "error" && <div className="mt-4 flex items-center justify-between gap-2 border-t border-border/40 pt-3"><p className="text-xs text-destructive">{state.error ?? t("update.updateFailed")}</p><Button size="sm" variant="outline" className="gap-1.5" onClick={() => void check()}><RotateCw className="size-3.5" />{t("update.tryAgain")}</Button></div>}
    </div>
  );
}
