import { translate as uiTranslate } from "@/i18n";
import { useT as useUiT } from "@/i18n";
import { toast } from "@/lib/toast";
import { XIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { revealPathToken } from "../api";
import { useNativeIntentStore } from "../store";
import type { NativeIntent } from "../types";

interface NativeModelChipProps {
  intent: NativeIntent;
  nativeReadsDisabled: boolean;
  onLoad: (selection: {
    id: string;
    nativePathToken: string;
    isDownloaded: boolean;
    loadingDescription: string;
    forceReload: boolean;
    throwOnError?: boolean;
  }) => Promise<void> | void;
}

export function NativeModelChip({
  intent,
  nativeReadsDisabled,
  onLoad,
}: NativeModelChipProps) {
  const uiT = useUiT();

  const clearModelIntent = useNativeIntentStore(
    (state) => state.clearModelIntent,
  );
  const [loading, setLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const label =
    intent.path.displayLabel || intent.displayLabel || "Local GGUF model";
  const expired = intent.path.expiresAtMs <= now;

  useEffect(() => {
    if (expired) {
      return;
    }
    const remaining = Math.max(0, intent.path.expiresAtMs - Date.now());
    const timer = window.setTimeout(() => setNow(Date.now()), remaining);
    return () => window.clearTimeout(timer);
  }, [expired, intent.path.expiresAtMs]);

  async function handleLoad() {
    if (nativeReadsDisabled || expired) {
      return;
    }
    setLoading(true);
    try {
      await onLoad({
        id: label,
        nativePathToken: intent.path.token,
        isDownloaded: true,
        loadingDescription: "Loading selected local GGUF model.",
        forceReload: true,
        throwOnError: true,
      });
      clearModelIntent(intent.id);
    } catch {
      // selectModel reports the failure; keep the chip available for retry.
    } finally {
      setLoading(false);
    }
  }

  async function handleReveal() {
    try {
      await revealPathToken(intent.path.token);
    } catch (error) {
      toast.error(uiTranslate("ui.could_not_reveal_model"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return (
    <div className="flex min-w-0 max-w-[34rem] items-center gap-2 rounded-lg border border-border/70 bg-muted/70 px-2.5 py-1.5 text-xs">
      <span className="shrink-0 font-medium text-muted-foreground">
        {uiT("ui.local_gguf")}</span>
      <span className="min-w-0 flex-1 truncate" title={label}>
        {label}
      </span>
      <button
        type="button"
        onClick={handleReveal}
        disabled={expired}
        title={
          expired ? uiT("ui.selection_expired_pick_or_drop_the_file_again") : undefined
        }
        className="rounded-md px-2 py-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
      >
        {uiT("ui.reveal")}</button>
      <button
        type="button"
        onClick={handleLoad}
        disabled={nativeReadsDisabled || expired || loading}
        title={
          nativeReadsDisabled
            ? uiT("ui.managed_desktop_backend_required")
            : expired
              ? uiT("ui.selection_expired_pick_or_drop_the_file_again")
              : undefined
        }
        className="rounded-md bg-foreground px-2 py-1 text-background transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
      >
        {expired ? uiT("ui.expired") : loading ? uiT("chat.projectSwitcher.loading") : uiT("runSettings.loadModel")}
      </button>
      <button
        type="button"
        onClick={() => clearModelIntent(intent.id)}
        className="flex size-5 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
        aria-label={uiT("ui.dismiss_local_model")}
      >
        <XIcon className="size-3" />
      </button>
    </div>
  );
}
