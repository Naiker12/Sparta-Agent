import { useEffect, useRef, useState } from "react";
import { useT } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Spinner } from "@/components/ui/spinner";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { ChannelApiError, channelsApi } from "../api";
import type { ChannelAccount } from "../types";

type FilePermission = "web_download" | "file_create" | "file_send";
const permissions: FilePermission[] = ["web_download", "file_create", "file_send"];

export function ChannelFiles({
  account,
  onError,
  onChanged,
}: {
  account: ChannelAccount;
  onError: () => void;
  onChanged?: () => void;
}) {
  const t = useT();
  const [data, setData] = useState<Awaited<ReturnType<typeof channelsApi.filePermissions>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [unavailable, setUnavailable] = useState<"restartRequired" | "accountUnavailable" | null>(null);
  const inFlight = useRef(false);
  const owner = useRef(account.id);
  owner.current = account.id;
  useEffect(() => { setData(null); setUnavailable(null); }, [account.id]);
  function report(error: unknown) {
    if (error instanceof ChannelApiError && error.status === 404) {
      setData(null);
      setUnavailable(error.code === "account_not_found" ? "accountUnavailable" : "restartRequired");
    } else onError();
  }
  async function load() {
    if (inFlight.current || unavailable) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const next = await channelsApi.filePermissions(account.id);
      if (owner.current === account.id) setData(next);
    } catch (error) {
      if (owner.current === account.id) report(error);
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  async function toggle(user: string, key: FilePermission, enabled: boolean) {
    const current = data?.permissions[user];
    if (!current || busy || unavailable) return;
    setBusy(true);
    try {
      const next = { ...current, [key]: enabled };
      await channelsApi.setFilePermissions(account.id, user, next);
      setData({ ...data!, permissions: { ...data!.permissions, [user]: next } });
      onChanged?.();
    } catch (error) {
      if (owner.current === account.id) report(error);
    } finally {
      setBusy(false);
    }
  }
  return (
    <FieldSet className="mt-6">
      <FieldLegend>{t("channels.files.title")}</FieldLegend>
      <FieldDescription>{t("channels.files.help")}</FieldDescription>
      <Button variant="outline" size="sm" disabled={busy || Boolean(unavailable)} onClick={() => void load()}>
        {busy && <Spinner label={t("channels.loading")} />}
        {t("channels.files.manage")}
      </Button>
      {unavailable && <p role="alert" className="text-sm text-destructive">{t(`channels.files.${unavailable}`)}</p>}
      {data && (
        <FieldGroup>
          {account.allowed_user_ids.map((user) => (
            <FieldSet key={user}>
              <FieldLegend>{t("channels.projects.user")} {user}</FieldLegend>
              {permissions.map((key) => (
                <Field orientation="horizontal" key={key}>
                  <Checkbox
                    id={`channel-file-${account.id}-${user}-${key}`}
                    disabled={busy}
                    checked={data.permissions[user]?.[key] ?? false}
                    onCheckedChange={(value) => void toggle(user, key, value === true)}
                  />
                  <div className="flex min-w-0 flex-col gap-1">
                    <FieldLabel htmlFor={`channel-file-${account.id}-${user}-${key}`}>
                      {t(`channels.files.${key}`)}
                    </FieldLabel>
                    <FieldDescription>{t(`channels.files.${key}Help`)}</FieldDescription>
                  </div>
                </Field>
              ))}
            </FieldSet>
          ))}
        </FieldGroup>
      )}
    </FieldSet>
  );
}
