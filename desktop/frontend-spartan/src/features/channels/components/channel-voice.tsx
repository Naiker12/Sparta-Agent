import { useId, useState } from "react";
import { useT } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { useSettingsDialogStore } from "@/features/settings";
import { channelsApi } from "../api";
import type { ChannelAccount, ChannelVoiceStatus } from "../types";

export function ChannelVoice({
  account,
  status,
  onChanged,
  onError,
}: {
  account: ChannelAccount;
  status?: ChannelVoiceStatus;
  onChanged: () => void;
  onError: () => void;
}) {
  const t = useT();
  const id = useId();
  const [busy, setBusy] = useState(false);
  const ready = status?.ready === true;
  async function toggle(enabled: boolean) {
    if (busy) return;
    setBusy(true);
    try {
      await channelsApi.setVoiceEnabled(account.id, enabled);
      onChanged();
    } catch {
      onError();
    } finally {
      setBusy(false);
    }
  }
  async function prepare() {
    if (busy) return;
    setBusy(true);
    try {
      await channelsApi.prepareVoice(account.id);
      onChanged();
    } catch {
      onError();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mt-5 flex flex-col gap-4">
      <Separator />
      <Field orientation="horizontal">
        <FieldContent>
          <FieldLabel htmlFor={id}>{t("channels.voice.title")}</FieldLabel>
          <FieldDescription id={`${id}-help`}>
            {t("channels.voice.description")}
          </FieldDescription>
        </FieldContent>
        {busy && <Spinner label={t("channels.loading")} />}
        <Switch
          id={id}
          aria-describedby={`${id}-help`}
          checked={Boolean(account.voice_enabled)}
          disabled={busy || (!ready && !account.voice_enabled)}
          onCheckedChange={(enabled) => void toggle(enabled)}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant="secondary">
          {(status?.downloading || status?.installing) && (
            <Spinner label={t("channels.voice.downloading")} />
          )}
          {t(
            ready
              ? status?.engine === "remote"
                ? "channels.voice.configurationReady"
                : "channels.voice.ready"
              : status?.installing
                ? "channels.voice.installing"
                : status?.downloading
                  ? "channels.voice.downloading"
                  : "channels.voice.needsPreparation",
          )}
        </Badge>
        <span className="text-muted-foreground text-xs">
          {status?.provider_name ?? "Whisper"} {status?.model ?? "base"} ·{" "}
          {status?.engine === "remote" ? "API" : t("channels.voice.local")}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => useSettingsDialogStore.getState().openDialog("voice")}
        >
          {t("channels.voice.openSettings")}
        </Button>
      </div>
      {!ready && status?.engine !== "remote" && (
        <Button
          variant="outline"
          size="sm"
          disabled={busy || status?.downloading || status?.installing}
          onClick={() => void prepare()}
        >
          {busy && <Spinner label={t("channels.loading")} />}
          {t("channels.voice.install")}
        </Button>
      )}
      {status?.downloading && status.bytes_done != null && (
        <p role="status" className="text-muted-foreground text-xs">
          {t("channels.voice.downloaded")}{" "}
          {Math.floor(status.bytes_done / 1048576)} MB
          {status.bytes_total != null &&
            ` / ${Math.ceil(status.bytes_total / 1048576)} MB`}
        </p>
      )}
      <details className="text-muted-foreground text-xs">
        <summary className="cursor-pointer">
          {t("channels.compact.voiceHelp")}
        </summary>
        {!ready && (
          <p className="text-muted-foreground text-xs leading-relaxed">
            {t("channels.voice.prepareHelp")}
          </p>
        )}
        {!ready &&
          !status?.downloading &&
          (status?.download_failed || status?.setup_failed) && (
            <Alert variant="destructive">
              <AlertDescription>
                {t("channels.voice.prepareFailed")}
              </AlertDescription>
            </Alert>
          )}
        <p className="text-muted-foreground text-xs leading-relaxed">
          {t("channels.voice.limits")}
        </p>
        <p className="text-muted-foreground text-xs leading-relaxed">
          {t(
            status?.engine === "remote"
              ? "channels.voice.remotePrivacy"
              : "channels.voice.privacy",
          )}
        </p>
      </details>
    </div>
  );
}
