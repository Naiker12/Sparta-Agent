import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n";
import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";

type Status = { installed: boolean; version: string | null; latestVersion: string | null; updateAvailable: boolean; supported: boolean; progress: string; percent: number };
function bridge() { return (window as unknown as { electron?: { invoke: (channel: string, value?: unknown) => Promise<unknown> } }).electron; }

export function OfficeComponentBanner({ required = false, onReady }: { required?: boolean; onReady?: () => void }) {
  const t = useT();
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const preparing = busy || status?.progress === "downloading" || status?.progress === "installing";
  useEffect(() => {
    let active = true;
    const native = bridge();
    if (!native) {
      setStatus({ installed: false, version: null, latestVersion: null, updateAvailable: false, supported: false, progress: "idle", percent: 0 });
      return;
    }
    const refresh = () => void native.invoke("document:office-status", !preparing).then(value => {
      if (active) setStatus(value as Status);
    }).catch(() => undefined);
    refresh();
    const timer = window.setInterval(refresh, preparing ? 2000 : 24 * 60 * 60 * 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, [preparing]);
  if (!status) return required ? <p role="status">{t("chat.preview.loading")}</p> : null;
  if (dismissed || (!required && !status.updateAvailable && status.progress !== "error" && !preparing)) return null;
  if (status.installed && !status.updateAvailable && !preparing) return null;
  return <Alert className="pointer-events-auto w-full max-w-md shrink-0" data-overlay-dismissible={preparing ? undefined : "true"}>
    <Download />
    <AlertTitle>{t(status.installed ? "chat.preview.officeUpdateTitle" : "chat.preview.officeInstallTitle")}</AlertTitle>
    <AlertDescription>
      <p>{t("chat.preview.officeComponentHelp")}</p>
      {status.version && <p>{status.version} → {status.latestVersion}</p>}
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant="outline" disabled={preparing || !status.supported} onClick={() => {
          setBusy(true); setFailed(false);
          void bridge()?.invoke("document:office-install").then(value => {
            if (!(value as { ok: boolean }).ok) { setFailed(true); return; }
            onReady?.();
          }).catch(() => setFailed(true)).finally(() => setBusy(false));
        }}>{preparing ? t(status.progress === "installing" ? "chat.preview.officeInstalling" : "chat.preview.officeDownloading", { percent: status.percent }) : t(status.installed ? "chat.preview.officeUpdate" : "chat.preview.officeInstall")}</Button>
        {!required && !preparing && <Button size="icon-sm" variant="ghost" aria-label={t("ui.dismiss")} onClick={() => setDismissed(true)}><X /></Button>}
      </div>
      {!status.supported && <p>{t("chat.preview.officeManualInstall")}</p>}
      {(failed || status.progress === "error") && <p role="alert">{t("chat.preview.officeInstallFailed")}</p>}
    </AlertDescription>
  </Alert>;
}
