import { useT } from "@/i18n";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from "@/components/ui/empty";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectGroup,
  SelectItem,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import {
  ChannelProfile,
  ChannelProjects,
  ChannelVoice,
  ChannelCapabilities,
  AccountCard,
  useChannels,
  channelsApi,
} from "@/features/channels";
import { useState } from "react";
import { SettingsSection } from "../components/settings-section";
import { useSettingsDialogStore } from "../stores/settings-dialog-store";

export function ChannelsPermissionsTab() {
  const t = useT();
  const { data, error, loading, refresh } = useChannels();
  const [actionError, setActionError] = useState(false);
  const [revoke, setRevoke] = useState<{
    accountId: string;
    userId: string;
  } | null>(null);
  const [revoking, setRevoking] = useState(false);
  const requested = useSettingsDialogStore((state) => state.channelAccountId);
  const account =
    data?.accounts.find((item) => item.id === requested) ?? data?.accounts[0];
  const changed = () => {
    setActionError(false);
    void refresh();
    window.dispatchEvent(new Event("spartan:channels-changed"));
  };
  async function confirmRevoke() {
    if (!revoke || revoking) return;
    setRevoking(true);
    try {
      await channelsApi.revokeUser(revoke.accountId, revoke.userId);
      setRevoke(null);
      changed();
    } catch {
      setActionError(true);
      setRevoke(null);
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-xl font-semibold">
            {t("channels.settings.title")}
          </h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("channels.settings.description")}
          </p>
        </div>
        <div>
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={() => void refresh()}
          >
            {t("channels.refresh")}
          </Button>
        </div>
      </header>
      {(error || actionError) && (
        <Alert variant="destructive">
          <AlertTitle>{t("channels.requestFailed")}</AlertTitle>
          <AlertDescription>{t("channels.retryHelp")}</AlertDescription>
        </Alert>
      )}
      {!data && loading && <Skeleton className="h-48 rounded-xl" />}
      {data && !account && (
        <Empty>
          <EmptyHeader>
            <EmptyTitle>{t("channels.settings.noConnections")}</EmptyTitle>
            <EmptyDescription>
              {t("channels.settings.noConnectionsHelp")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
      {data && account && (
        <>
          {data.accounts.length > 1 && (
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="channel-settings-account">
                  {t("channels.settings.connection")}
                </FieldLabel>
                <Select
                  value={account.id}
                  onValueChange={(value) => {
                    useSettingsDialogStore.setState({
                      channelAccountId: value,
                    });
                    setActionError(false);
                  }}
                >
                  <SelectTrigger id="channel-settings-account">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {data.accounts.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.name} · @{item.bot_username}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
            </FieldGroup>
          )}
          <AccountCard
            key={account.id}
            account={account}
            settings
            onChanged={changed}
            onError={() => setActionError(true)}
          />
          <div
            key={`permissions-${account.id}`}
            className="flex flex-col gap-6"
          >
            <SettingsSection
              title={t("channels.settings.people")}
              description={t("channels.settings.peopleHelp")}
            >
              <div className="mt-3 flex flex-col divide-y divide-border/60">
                {account.allowed_user_ids.map((id) => (
                  <div
                    key={id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <Badge variant="secondary">
                      {t("channels.projects.user")} {id}
                      {account.owner_user_id === id && (
                        <> · {t("channels.settings.owner")}</>
                      )}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        setRevoke({ accountId: account.id, userId: id })
                      }
                    >
                      {t("channels.settings.revoke")}
                    </Button>
                  </div>
                ))}
                {!account.allowed_user_ids.length && (
                  <p className="text-muted-foreground text-sm">
                    {t("channels.pairing.noUsers")}
                  </p>
                )}
              </div>
            </SettingsSection>
            <section data-settings-label={t("channels.profileBinding.title")}>
              {account.owner_user_id &&
              account.owner_user_id === account.profile_user_id ? (
                <SettingsSection
                  title={t("channels.profileBinding.title")}
                  description={t("channels.settings.personalProfileHelp")}
                >
                  <div className="mt-3">
                    <Badge variant="secondary">
                      {t("channels.profileBinding.linked")}
                    </Badge>
                  </div>
                </SettingsSection>
              ) : (
                <ChannelProfile
                  account={account}
                  onChanged={changed}
                  onError={() => setActionError(true)}
                />
              )}
            </section>
            <section data-settings-label={t("channels.projects.title")}>
              <ChannelProjects
                account={account}
                onChanged={changed}
                onError={() => setActionError(true)}
              />
            </section>
            <section data-settings-label={t("channels.voice.title")}>
              <ChannelVoice
                account={account}
                status={data.voice}
                onChanged={changed}
                onError={() => setActionError(true)}
              />
            </section>
          </div>
        </>
      )}
      {data && (
        <details className="rounded-xl border border-border/60 px-4 py-3">
          <summary className="cursor-pointer text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-4">
            {t("channels.capabilities")}
          </summary>
          <div className="mt-3">
            <ChannelCapabilities
              inventory={data.inventory}
              voiceStatus={data.voice}
            />
          </div>
        </details>
      )}
      <AlertDialog
        open={Boolean(revoke)}
        onOpenChange={(open) => {
          if (!open && !revoking) setRevoke(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("channels.settings.revoke")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("channels.settings.revokeHelp")} {revoke?.userId}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>
              {t("channels.cancel")}
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={revoking}
              onClick={() => void confirmRevoke()}
            >
              {t("channels.settings.revoke")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
