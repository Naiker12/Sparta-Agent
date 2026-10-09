import { useState } from "react";
import { useT } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import { channelsApi } from "../api";
import type { ChannelAccount } from "../types";
export function ChannelProfile({
  account,
  onChanged,
  onError,
}: {
  account: ChannelAccount;
  onChanged: () => void;
  onError: () => void;
}) {
  const t = useT();
  const [user, setUser] = useState(account.profile_user_id ?? "none");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<string | undefined>(undefined);
  const [failed, setFailed] = useState(false);
  const current = saved ?? account.profile_user_id ?? "none";
  const dirty = user !== current;
  const linked =
    current !== "none" && account.allowed_user_ids.includes(current);
  async function save() {
    setBusy(true);
    setFailed(false);
    try {
      await channelsApi.bindProfile(account.id, user === "none" ? null : user);
      setSaved(user);
      onChanged();
    } catch {
      setFailed(true);
      onError();
    } finally {
      setBusy(false);
    }
  }
  return (
    <FieldGroup>
      <Field>
        <FieldLabel>
          {t("channels.profileBinding.title")}
          <Badge variant="secondary">
            {t(
              dirty
                ? "channels.profileBinding.pending"
                : linked
                  ? "channels.profileBinding.linked"
                  : "channels.profileBinding.unlinked",
            )}
          </Badge>
        </FieldLabel>
        <Select value={user} onValueChange={setUser} disabled={busy}>
          <SelectTrigger aria-label={t("channels.profileBinding.title")}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="none">
                {t("channels.profileBinding.disabled")}
              </SelectItem>
              {account.allowed_user_ids.map(
                (id) =>
                  (!account.owner_user_id || account.owner_user_id === id) && (
                    <SelectItem key={id} value={id}>
                      {id}
                    </SelectItem>
                  ),
              )}
            </SelectGroup>
          </SelectContent>
        </Select>
        <FieldDescription>{t("channels.profileBinding.help")}</FieldDescription>
        <FieldDescription>
          {t("channels.profileBinding.saveRequired")}
        </FieldDescription>
      </Field>
      {failed && (
        <Alert variant="destructive">
          <AlertDescription>
            {t("channels.profileBinding.failed")}
          </AlertDescription>
        </Alert>
      )}
      {saved !== undefined && !dirty && !failed && (
        <p role="status" className="text-muted-foreground text-sm">
          {t(
            linked
              ? "channels.profileBinding.saved"
              : "channels.profileBinding.removed",
          )}
        </p>
      )}
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        disabled={busy || !dirty}
        onClick={() => void save()}
      >
        {t("channels.profileBinding.save")}
      </Button>
    </FieldGroup>
  );
}
