import { Button } from "@/components/ui/button";
import { ReleaseNotesPanel } from "@/components/update/release-notes-panel";
import { useWebUpdateCheck } from "@/hooks/use-web-update-check";
import { useT } from "@/i18n";
import { cn } from "@/lib/utils";
import { Download, ExternalLink, Sparkles, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { type ReactElement, useState } from "react";

const EASE_OUT_QUART: [number, number, number, number] = [0.165, 0.84, 0.44, 1];

interface WebUpdateBannerProps {
  enabled?: boolean;
  positioned?: boolean;
}

export function WebUpdateBanner({
  enabled = true,
  positioned = true,
}: WebUpdateBannerProps): ReactElement | null {
  const { status, dismiss, snooze } = useWebUpdateCheck({ enabled });
  const t = useT();
  const [showNotes, setShowNotes] = useState(false);

  if (!status) {
    return null;
  }

  const handleDownload = () => {
    if (status.downloadUrl) {
      window.open(status.downloadUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <AnimatePresence>
      {status ? (
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.97 }}
          transition={{ duration: 0.35, ease: EASE_OUT_QUART }}
          className={cn(
            positioned
              ? "fixed bottom-4 right-4 z-[9999] w-[calc(100vw-2rem)] max-w-[448px]"
              : "pointer-events-auto flex min-h-[calc(109px+80px*var(--ui-font-scale,1))] w-[calc(100vw-2rem)] max-w-[448px] flex-col",
          )}
          data-overlay-dismissible="true"
          data-testid="sparta-update-banner"
        >
          <div className="relative flex max-h-[calc(100dvh_-_2rem)] min-h-0 flex-col overflow-hidden rounded-[20px] border border-border/70 bg-card p-5 shadow-2xl backdrop-blur-xl">
            {/* Close Button */}
            <button
              type="button"
              onClick={dismiss}
              className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={t("update.dismiss")}
              title={t("update.dismiss")}
            >
              <X className="size-4" />
            </button>

            {/* Header */}
            <div className="flex min-w-0 shrink-0 items-start gap-3.5 pr-6">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Sparkles className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="font-heading text-base font-semibold text-foreground">
                  {t("update.newVersionTitle")}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  v{status.currentVersion} &rarr;{" "}
                  <span className="font-semibold text-primary">
                    v{status.latestVersion}
                  </span>
                </p>
              </div>
            </div>

            {/* Optional Release Notes Panel */}
            {status.releaseNotes && showNotes && (
              <div className="mt-3 max-h-40 overflow-y-auto rounded-lg border border-border/50 bg-background/50 p-3 text-xs text-muted-foreground">
                <p className="whitespace-pre-wrap">{status.releaseNotes}</p>
              </div>
            )}

            {/* Actions */}
            <div className="mt-4 flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
              <Button
                size="sm"
                variant="ghost"
                className="h-8 rounded-lg px-2.5 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setShowNotes(!showNotes)}
              >
                {showNotes ? t("update.hideReleaseNotes") : t("update.showReleaseNotes")}
              </Button>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 rounded-lg px-2.5 text-xs text-muted-foreground hover:text-foreground"
                  onClick={snooze}
                >
                  {t("update.remindLater")}
                </Button>
                <Button
                  size="sm"
                  variant="default"
                  className="h-8 gap-1.5 rounded-lg px-3 text-xs font-semibold shadow-sm"
                  onClick={handleDownload}
                >
                  <Download className="size-3.5" />
                  {t("update.downloadUpdate")}
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
