import { useEffect, useRef, useState } from "react";
import { authFetch } from "@/features/auth";
import { useT } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/lib/toast";
import { Alert, AlertDescription } from "@/components/ui/alert";

type VoiceStatus = {
  ready: boolean;
  bytes_done?: number | null;
  bytes_total?: number | null;
  installing?: boolean;
  downloading?: boolean;
  setup_failed?: boolean;
  failure_code?: string | null;
  download_failed?: boolean;
};

export function LocalVoiceTab() {
  const t = useT();
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const submitting = useRef(false);
  const toastId = useRef<string | number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    async function read() {
      try {
        const response = await authFetch("/api/voice/status", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error();
        const value = (await response.json()) as VoiceStatus;
        if (!controller.signal.aborted) {
          setStatus(value);
          if (
            !submitting.current &&
            toastId.current !== null &&
            !value.installing &&
            !value.downloading
          ) {
            if (value.ready) {
              toast.success(t("channels.voice.ready"), { id: toastId.current });
              toastId.current = null;
            } else if (value.setup_failed || value.download_failed) {
              toast.error(t("channels.voice.setupFailed"), {
                id: toastId.current,
              });
              toastId.current = null;
            }
          }
          setError(false);
        }
      } catch {
        if (!controller.signal.aborted) setError(true);
      }
    }
    void read();
    const timer = setInterval(() => void read(), 3000);
    return () => {
      controller.abort();
      clearInterval(timer);
      if (toastId.current !== null) toast.dismiss(toastId.current);
    };
  }, [t]);
  async function prepare() {
    submitting.current = true;
    setBusy(true);
    toastId.current = toast.loading(t("channels.voice.preparing"));
    setError(false);
    try {
      const response = await authFetch(
        "/api/voice/prepare",
        { method: "POST", signal: AbortSignal.timeout(90000) },
        { retryNetworkErrors: false },
      );
      if (!response.ok) throw new Error();
      const value = (await response.json()) as VoiceStatus;
      setStatus(value);
      if (
        value.ready ||
        (!value.installing &&
          !value.downloading &&
          (value.setup_failed || value.download_failed))
      ) {
        const options = { id: toastId.current! };
        if (value.ready) toast.success(t("channels.voice.ready"), options);
        else toast.error(t("channels.voice.setupFailed"), options);
        toastId.current = null;
      }
    } catch {
      setError(true);
      if (toastId.current !== null)
        toast.error(t("channels.voice.setupFailed"), { id: toastId.current });
      toastId.current = null;
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }
  const preparing = busy || status?.installing || status?.downloading;
  const percentage =
    status?.downloading &&
    typeof status.bytes_done === "number" &&
    typeof status.bytes_total === "number" &&
    status.bytes_total > 0
      ? Math.min(
          100,
          Math.max(0, (status.bytes_done / status.bytes_total) * 100),
        )
      : undefined;
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-medium">{t("channels.voice.title")}</h2>
      <div className="flex items-center gap-2">
        <span className="font-medium">Whisper base</span>
        <Badge variant="secondary">{t("channels.voice.recommended")}</Badge>
      </div>
      <p className="text-muted-foreground text-sm">
        {t("channels.voice.localSummary")}
      </p>
      <Badge variant="secondary">
        {preparing && <Spinner label={t("channels.voice.installing")} />}
        {t(
          status?.ready
            ? "channels.voice.ready"
            : preparing
              ? "channels.voice.installing"
              : "channels.voice.needsPreparation",
        )}
      </Badge>
      <p className="text-muted-foreground text-sm">
        Whisper base · {t("channels.voice.local")}
      </p>
      {preparing && (
        <div className="flex flex-col gap-2" role="status" aria-live="polite">
          <div className="flex justify-between gap-2 text-sm">
            <span>
              {t(
                status?.downloading
                  ? "channels.voice.downloading"
                  : "channels.voice.runtimeInstalling",
              )}
            </span>
            {percentage !== undefined && <span>{Math.floor(percentage)}%</span>}
          </div>
          <Progress
            value={percentage}
            indeterminate={percentage === undefined}
            aria-label={t("channels.voice.preparing")}
          />
        </div>
      )}
      <Button
        className="self-start"
        variant="outline"
        disabled={!status || Boolean(preparing) || status.ready}
        onClick={() => void prepare()}
      >
        {t("channels.voice.install")}
      </Button>
      {(error ||
        (!preparing &&
          !status?.ready &&
          (status?.setup_failed || status?.download_failed))) && (
        <Alert variant="destructive">
          <AlertDescription>
            {t(
              status?.failure_code === "runtime_blocked"
                ? "channels.voice.runtimeBlocked"
                : status?.failure_code === "runtime_launch_failed"
                ? "channels.voice.runtimeLaunchFailed"
                : status?.failure_code === "runtime_incompatible"
                  ? "channels.voice.runtimeIncompatible"
                  : "channels.voice.setupFailed",
            )}
          </AlertDescription>
        </Alert>
      )}
      <details>
        <summary className="cursor-pointer text-sm">
          {t("channels.voice.setupDetails")}
        </summary>
        <div className="flex flex-col gap-2 pt-3 text-xs text-muted-foreground">
          <p>{t("channels.voice.installHelp")}</p>
          <p>{t("channels.voice.privacy")}</p>
        </div>
      </details>
    </section>
  );
}
